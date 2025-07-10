// Terminal Buffer Management
//
// Handles output buffering, scrollback history, and efficient
// data management for terminal streams.

use bytes::Bytes;
use std::collections::VecDeque;
use tokio::sync::RwLock;
use std::sync::Arc;

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
    
    /// Add data to buffer
    pub fn push(&mut self, data: &[u8]) -> Option<Bytes> {
        self.buffer.extend_from_slice(data);
        
        // Check if we should flush
        if self.should_flush() {
            Some(self.flush())
        } else {
            None
        }
    }
    
    /// Check if buffer should be flushed
    pub fn should_flush(&self) -> bool {
        self.buffer.len() >= self.max_size ||
        self.last_flush.elapsed() >= self.flush_interval
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
        lines.iter()
            .skip(start)
            .take(count)
            .cloned()
            .collect()
    }
    
    /// Get last N lines
    pub async fn get_last_lines(&self, count: usize) -> Vec<ScrollbackLine> {
        let lines = self.lines.read().await;
        let start = lines.len().saturating_sub(count);
        lines.iter()
            .skip(start)
            .cloned()
            .collect()
    }
    
    /// Search scrollback
    pub async fn search(&self, pattern: &str, case_sensitive: bool) -> Vec<(usize, ScrollbackLine)> {
        let lines = self.lines.read().await;
        let pattern = if case_sensitive {
            pattern.to_string()
        } else {
            pattern.to_lowercase()
        };
        
        lines.iter()
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