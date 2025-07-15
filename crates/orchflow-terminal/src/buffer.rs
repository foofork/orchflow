// Terminal Buffer Management
//
// Handles output buffering, scrollback history, and efficient
// data management for terminal streams.

use bytes::Bytes;
use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Maximum scrollback lines to keep in memory
const DEFAULT_MAX_SCROLLBACK: usize = 10000;

/// Maximum size of a single output chunk
const MAX_CHUNK_SIZE: usize = 64 * 1024; // 64KB

/// Output buffer for efficient batching
pub struct OutputBuffer {
    buffer: Vec<u8>,
    max_size: usize,
    flush_interval: tokio::time::Duration,
    last_flush: tokio::time::Instant,
}

impl OutputBuffer {
    pub fn new(max_size: usize) -> Self {
        Self {
            buffer: Vec::with_capacity(max_size),
            max_size,
            flush_interval: tokio::time::Duration::from_millis(16), // ~60fps
            last_flush: tokio::time::Instant::now(),
        }
    }

    /// Create with default max chunk size
    pub fn with_default_size() -> Self {
        Self::new(MAX_CHUNK_SIZE)
    }

    /// Add data to buffer
    pub fn push(&mut self, data: &[u8]) -> Option<Bytes> {
        // If data is larger than max chunk size, split it
        if data.len() > MAX_CHUNK_SIZE {
            let mut result = Vec::new();
            for chunk in data.chunks(MAX_CHUNK_SIZE) {
                self.buffer.extend_from_slice(chunk);
                if self.should_flush() {
                    result.push(self.flush());
                }
            }
            if result.is_empty() {
                None
            } else {
                // Concatenate all chunks
                let total_len = result.iter().map(|b| b.len()).sum();
                let mut combined = Vec::with_capacity(total_len);
                for bytes in result {
                    combined.extend_from_slice(&bytes);
                }
                Some(Bytes::from(combined))
            }
        } else {
            self.buffer.extend_from_slice(data);

            // Check if we should flush
            if self.should_flush() {
                Some(self.flush())
            } else {
                None
            }
        }
    }

    /// Check if buffer should be flushed
    pub fn should_flush(&self) -> bool {
        self.buffer.len() >= self.max_size || self.last_flush.elapsed() >= self.flush_interval
    }

    /// Flush the buffer
    pub fn flush(&mut self) -> Bytes {
        let data = Bytes::from(self.buffer.clone());
        self.buffer.clear();
        self.last_flush = tokio::time::Instant::now();
        data
    }

    /// Force flush if there's any data
    pub fn force_flush(&mut self) -> Option<Bytes> {
        if !self.buffer.is_empty() {
            Some(self.flush())
        } else {
            None
        }
    }
}

/// Scrollback buffer for terminal history
pub struct ScrollbackBuffer {
    lines: Arc<RwLock<VecDeque<ScrollbackLine>>>,
    max_lines: usize,
    total_size: Arc<RwLock<usize>>,
    max_total_size: usize,
}

#[derive(Clone)]
pub struct ScrollbackLine {
    pub content: Bytes,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub line_number: usize,
}

impl ScrollbackBuffer {
    pub fn new(max_lines: usize) -> Self {
        Self {
            lines: Arc::new(RwLock::new(VecDeque::with_capacity(max_lines))),
            max_lines,
            total_size: Arc::new(RwLock::new(0)),
            max_total_size: 10 * 1024 * 1024, // 10MB default
        }
    }

    /// Create with default scrollback size
    pub fn with_default_size() -> Self {
        Self::new(DEFAULT_MAX_SCROLLBACK)
    }

    /// Add output to scrollback
    pub async fn add_output(&self, data: &[u8]) {
        let mut current_line = Vec::new();
        let mut lines = self.lines.write().await;
        let mut total_size = self.total_size.write().await;

        // Split data into lines
        for &byte in data {
            current_line.push(byte);

            if byte == b'\n' {
                // Complete line
                let line = ScrollbackLine {
                    content: Bytes::from(current_line.clone()),
                    timestamp: chrono::Utc::now(),
                    line_number: lines.len(),
                };

                *total_size += line.content.len();
                lines.push_back(line);
                current_line.clear();

                // Trim if needed
                while lines.len() > self.max_lines || *total_size > self.max_total_size {
                    if let Some(removed) = lines.pop_front() {
                        *total_size -= removed.content.len();
                    }
                }
            }
        }

        // Handle incomplete line
        if !current_line.is_empty() {
            // If we have an incomplete line at the end, append to last line
            if let Some(last_line) = lines.back_mut() {
                let mut combined = last_line.content.to_vec();
                combined.extend_from_slice(&current_line);
                *total_size -= last_line.content.len();
                last_line.content = Bytes::from(combined);
                *total_size += last_line.content.len();
            } else {
                // First line
                let line = ScrollbackLine {
                    content: Bytes::from(current_line),
                    timestamp: chrono::Utc::now(),
                    line_number: 0,
                };
                *total_size += line.content.len();
                lines.push_back(line);
            }
        }
    }

    /// Get lines from scrollback
    pub async fn get_lines(&self, start: usize, count: usize) -> Vec<ScrollbackLine> {
        let lines = self.lines.read().await;
        lines.iter().skip(start).take(count).cloned().collect()
    }

    /// Get last N lines
    pub async fn get_last_lines(&self, count: usize) -> Vec<ScrollbackLine> {
        let lines = self.lines.read().await;
        let start = lines.len().saturating_sub(count);
        lines.iter().skip(start).cloned().collect()
    }

    /// Search scrollback
    pub async fn search(
        &self,
        pattern: &str,
        case_sensitive: bool,
    ) -> Vec<(usize, ScrollbackLine)> {
        let lines = self.lines.read().await;
        let pattern = if case_sensitive {
            pattern.to_string()
        } else {
            pattern.to_lowercase()
        };

        lines
            .iter()
            .enumerate()
            .filter_map(|(idx, line)| {
                let content = String::from_utf8_lossy(&line.content);
                let content_to_search = if case_sensitive {
                    content.to_string()
                } else {
                    content.to_lowercase()
                };

                if content_to_search.contains(&pattern) {
                    Some((idx, line.clone()))
                } else {
                    None
                }
            })
            .collect()
    }

    /// Clear scrollback
    pub async fn clear(&self) {
        self.lines.write().await.clear();
        *self.total_size.write().await = 0;
    }

    /// Get total line count
    pub async fn line_count(&self) -> usize {
        self.lines.read().await.len()
    }

    /// Get total size in bytes
    pub async fn total_size(&self) -> usize {
        *self.total_size.read().await
    }
}

/// Ring buffer for efficient terminal output
pub struct RingBuffer {
    buffer: Vec<u8>,
    capacity: usize,
    head: usize,
    tail: usize,
    size: usize,
}

impl RingBuffer {
    pub fn new(capacity: usize) -> Self {
        Self {
            buffer: vec![0; capacity],
            capacity,
            head: 0,
            tail: 0,
            size: 0,
        }
    }

    /// Write data to ring buffer
    pub fn write(&mut self, data: &[u8]) {
        for &byte in data {
            self.buffer[self.head] = byte;
            self.head = (self.head + 1) % self.capacity;

            if self.size < self.capacity {
                self.size += 1;
            } else {
                // Overwrite oldest data
                self.tail = (self.tail + 1) % self.capacity;
            }
        }
    }

    /// Read all data from ring buffer
    pub fn read_all(&self) -> Vec<u8> {
        let mut result = Vec::with_capacity(self.size);

        if self.size == 0 {
            return result;
        }

        if self.tail < self.head {
            result.extend_from_slice(&self.buffer[self.tail..self.head]);
        } else {
            result.extend_from_slice(&self.buffer[self.tail..]);
            result.extend_from_slice(&self.buffer[..self.head]);
        }

        result
    }

    /// Clear the buffer
    pub fn clear(&mut self) {
        self.head = 0;
        self.tail = 0;
        self.size = 0;
    }
}

#[cfg(test)]
mod tests {
    use crate::buffer::{
        OutputBuffer, RingBuffer, ScrollbackBuffer, DEFAULT_MAX_SCROLLBACK, MAX_CHUNK_SIZE,
    };

    #[test]
    fn test_output_buffer_respects_chunk_size() {
        let mut buffer = OutputBuffer::new(100);

        // Add data smaller than limit
        let small_data = vec![b'a'; 50];
        assert!(buffer.push(&small_data).is_none());

        // Add more data to exceed limit
        let more_data = vec![b'b'; 60];
        let flushed = buffer.push(&more_data);
        assert!(flushed.is_some());
        assert_eq!(flushed.unwrap().len(), 110);
    }

    #[test]
    fn test_output_buffer_splits_large_chunks() {
        let mut buffer = OutputBuffer::with_default_size();

        // Add data larger than MAX_CHUNK_SIZE
        let large_data = vec![b'x'; MAX_CHUNK_SIZE * 2 + 1000];
        let result = buffer.push(&large_data);

        // Should have flushed data
        assert!(result.is_some());

        // Buffer should still have remaining data
        assert!(!buffer.buffer.is_empty());
        assert!(buffer.buffer.len() < MAX_CHUNK_SIZE);
    }

    #[tokio::test]
    async fn test_scrollback_buffer_enforces_line_limit() {
        let buffer = ScrollbackBuffer::new(10);

        // Add more lines than the limit
        for i in 0..20 {
            let line = format!("Line {i}\n");
            buffer.add_output(line.as_bytes()).await;
        }

        // Should only have 10 lines
        let lines = buffer.get_lines(0, 100).await;
        assert_eq!(lines.len(), 10);

        // Should have kept the newest lines
        let first_line = String::from_utf8(lines[0].content.to_vec()).unwrap();
        assert!(first_line.contains("Line 10"));
    }

    #[tokio::test]
    async fn test_scrollback_buffer_enforces_size_limit() {
        let buffer = ScrollbackBuffer::new(1000);

        // Add lines that exceed total size limit
        let large_line = vec![b'x'; 1024 * 1024]; // 1MB line
        for _ in 0..15 {
            buffer.add_output(&large_line).await;
            buffer.add_output(b"\n").await;
        }

        // Total size should be under 10MB
        let total_size = *buffer.total_size.read().await;
        assert!(total_size <= buffer.max_total_size);

        // Should have fewer lines due to size constraint
        let lines = buffer.get_lines(0, 1000).await;
        assert!(lines.len() < 15);
    }

    #[tokio::test]
    async fn test_scrollback_default_size() {
        let buffer = ScrollbackBuffer::with_default_size();

        // Add DEFAULT_MAX_SCROLLBACK + 100 lines
        for i in 0..(DEFAULT_MAX_SCROLLBACK + 100) {
            let line = format!("Line {i}\n");
            buffer.add_output(line.as_bytes()).await;
        }

        // Should be limited to DEFAULT_MAX_SCROLLBACK
        let lines = buffer.get_lines(0, DEFAULT_MAX_SCROLLBACK + 200).await;
        assert_eq!(lines.len(), DEFAULT_MAX_SCROLLBACK);
    }

    #[test]
    fn test_ring_buffer_wrap_around() {
        let mut ring = RingBuffer::new(10);

        // Fill buffer
        ring.write(b"0123456789");
        assert_eq!(ring.read_all(), b"0123456789");

        // Write more to wrap around
        ring.write(b"ABCDE");
        let data = ring.read_all();
        assert_eq!(data.len(), 10);
        assert_eq!(&data[0..5], b"56789");
        assert_eq!(&data[5..10], b"ABCDE");
    }

    #[tokio::test]
    async fn test_scrollback_search_case_sensitive() {
        let buffer = ScrollbackBuffer::new(100);

        // Add test data
        buffer.add_output(b"Hello World\n").await;
        buffer.add_output(b"hello world\n").await;
        buffer.add_output(b"HELLO WORLD\n").await;
        buffer.add_output(b"Testing search functionality\n").await;

        // Case sensitive search
        let results = buffer.search("Hello", true).await;
        assert_eq!(results.len(), 1);
        assert!(String::from_utf8_lossy(&results[0].1.content).contains("Hello World"));

        // Case insensitive search
        let results = buffer.search("hello", false).await;
        assert_eq!(results.len(), 3);
    }

    #[tokio::test]
    async fn test_scrollback_search_pattern_matching() {
        let buffer = ScrollbackBuffer::new(100);

        // Add test data with different patterns
        buffer.add_output(b"Error: File not found\n").await;
        buffer.add_output(b"Warning: Deprecated function\n").await;
        buffer.add_output(b"Info: Processing complete\n").await;
        buffer.add_output(b"Error: Permission denied\n").await;

        // Search for errors
        let error_results = buffer.search("Error:", true).await;
        assert_eq!(error_results.len(), 2);

        // Search for warnings
        let warning_results = buffer.search("Warning:", true).await;
        assert_eq!(warning_results.len(), 1);

        // Search for non-existent pattern
        let no_results = buffer.search("Debug:", true).await;
        assert_eq!(no_results.len(), 0);
    }

    #[tokio::test]
    async fn test_scrollback_get_lines_range() {
        let buffer = ScrollbackBuffer::new(100);

        // Add numbered lines
        for i in 0..10 {
            let line = format!("Line {i}\n");
            buffer.add_output(line.as_bytes()).await;
        }

        // Get specific range
        let lines = buffer.get_lines(2, 3).await;
        assert_eq!(lines.len(), 3);
        assert!(String::from_utf8_lossy(&lines[0].content).contains("Line 2"));
        assert!(String::from_utf8_lossy(&lines[1].content).contains("Line 3"));
        assert!(String::from_utf8_lossy(&lines[2].content).contains("Line 4"));

        // Get last lines
        let last_lines = buffer.get_last_lines(3).await;
        assert_eq!(last_lines.len(), 3);
        assert!(String::from_utf8_lossy(&last_lines[2].content).contains("Line 9"));
    }

    #[tokio::test]
    async fn test_scrollback_clear_functionality() {
        let buffer = ScrollbackBuffer::new(100);

        // Add some data
        buffer.add_output(b"Test line 1\n").await;
        buffer.add_output(b"Test line 2\n").await;

        // Verify data exists
        let lines_before = buffer.get_lines(0, 10).await;
        assert_eq!(lines_before.len(), 2);
        assert!(buffer.total_size().await > 0);

        // Clear buffer
        buffer.clear().await;

        // Verify data is cleared
        let lines_after = buffer.get_lines(0, 10).await;
        assert_eq!(lines_after.len(), 0);
        assert_eq!(buffer.total_size().await, 0);
        assert_eq!(buffer.line_count().await, 0);
    }
}
