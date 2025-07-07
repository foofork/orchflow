use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_mini::{DebounceEventResult, DebouncedEventKind, new_debouncer};
use std::time::Duration;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use crate::error::{OrchflowError, Result};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileWatchEvent {
    pub event_type: FileWatchEventType,
    pub paths: Vec<PathBuf>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum FileWatchEventType {
    Created,
    Modified,
    Removed,
    Renamed,
    Any,
}

impl From<DebouncedEventKind> for FileWatchEventType {
    fn from(kind: DebouncedEventKind) -> Self {
        match kind {
            DebouncedEventKind::Any => FileWatchEventType::Any,
            DebouncedEventKind::AnyContinuous => FileWatchEventType::Any,
            _ => FileWatchEventType::Any, // Handle any other variants
        }
    }
}

pub struct FileWatcher {
    watcher: Option<notify_debouncer_mini::Debouncer<RecommendedWatcher>>,
    event_sender: mpsc::UnboundedSender<FileWatchEvent>,
    event_receiver: Arc<RwLock<mpsc::UnboundedReceiver<FileWatchEvent>>>,
    watched_paths: Arc<RwLock<Vec<PathBuf>>>,
    debounce_duration: Duration,
}

impl FileWatcher {
    pub fn new(debounce_ms: u64) -> Result<Self> {
        let (tx, rx) = mpsc::unbounded_channel();
        
        Ok(Self {
            watcher: None,
            event_sender: tx,
            event_receiver: Arc::new(RwLock::new(rx)),
            watched_paths: Arc::new(RwLock::new(Vec::new())),
            debounce_duration: Duration::from_millis(debounce_ms),
        })
    }
    
    /// Start watching a path
    pub async fn watch_path(&mut self, path: &Path, recursive: bool) -> Result<()> {
        // Create debouncer if not exists
        if self.watcher.is_none() {
            let tx_clone = self.event_sender.clone();
            
            let debouncer = new_debouncer(
                self.debounce_duration,
                move |result: DebounceEventResult| {
                    match result {
                        Ok(events) => {
                            for event in events {
                                let file_event = FileWatchEvent {
                                    event_type: event.kind.into(),
                                    paths: vec![event.path], // DebouncedEvent has a single path
                                    timestamp: Utc::now(),
                                };
                                let _ = tx_clone.send(file_event);
                            }
                        }
                        Err(error) => {
                            eprintln!("File watcher error: {:?}", error);
                        }
                    }
                }
            ).map_err(|e| OrchflowError::FileError {
                operation: "create_watcher".to_string(),
                path: path.to_string_lossy().to_string(),
                reason: e.to_string(),
            })?;
            
            self.watcher = Some(debouncer);
        }
        
        // Add path to watcher
        if let Some(watcher) = &mut self.watcher {
            let mode = if recursive {
                RecursiveMode::Recursive
            } else {
                RecursiveMode::NonRecursive
            };
            
            watcher.watcher()
                .watch(path, mode)
                .map_err(|e| OrchflowError::FileError {
                    operation: "watch_path".to_string(),
                    path: path.to_string_lossy().to_string(),
                    reason: e.to_string(),
                })?;
            
            // Track watched paths
            self.watched_paths.write().await.push(path.to_path_buf());
        }
        
        Ok(())
    }
    
    /// Stop watching a path
    pub async fn unwatch_path(&mut self, path: &Path) -> Result<()> {
        if let Some(watcher) = &mut self.watcher {
            watcher.watcher()
                .unwatch(path)
                .map_err(|e| OrchflowError::FileError {
                    operation: "unwatch_path".to_string(),
                    path: path.to_string_lossy().to_string(),
                    reason: e.to_string(),
                })?;
            
            // Remove from tracked paths
            let mut paths = self.watched_paths.write().await;
            paths.retain(|p| p != path);
        }
        
        Ok(())
    }
    
    /// Get all watched paths
    pub async fn get_watched_paths(&self) -> Vec<PathBuf> {
        self.watched_paths.read().await.clone()
    }
    
    /// Receive file watch events
    pub async fn recv_event(&self) -> Option<FileWatchEvent> {
        self.event_receiver.write().await.recv().await
    }
    
    /// Try to receive a file watch event without blocking
    pub async fn try_recv_event(&self) -> Option<FileWatchEvent> {
        self.event_receiver.write().await.try_recv().ok()
    }
    
    /// Update debounce duration
    pub async fn set_debounce_duration(&mut self, ms: u64) -> Result<()> {
        self.debounce_duration = Duration::from_millis(ms);
        
        // If watcher exists, we need to recreate it with new duration
        if self.watcher.is_some() {
            let paths = self.get_watched_paths().await;
            
            // Stop current watcher
            self.watcher = None;
            
            // Re-watch all paths with new debouncer
            for path in paths {
                self.watch_path(&path, true).await?;
            }
        }
        
        Ok(())
    }
}

/// Configuration for file watching
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileWatchConfig {
    pub debounce_ms: u64,
    pub recursive: bool,
    pub ignore_patterns: Vec<String>,
    pub max_events_per_second: u32,
}

impl Default for FileWatchConfig {
    fn default() -> Self {
        Self {
            debounce_ms: 300,
            recursive: true,
            ignore_patterns: vec![
                "**/.git/**".to_string(),
                "**/node_modules/**".to_string(),
                "**/target/**".to_string(),
                "**/.DS_Store".to_string(),
                "**/Thumbs.db".to_string(),
                "**/*.swp".to_string(),
                "**/*.swo".to_string(),
                "**/*~".to_string(),
            ],
            max_events_per_second: 100,
        }
    }
}

/// Advanced file watcher with filtering and rate limiting
pub struct AdvancedFileWatcher {
    watcher: FileWatcher,
    config: FileWatchConfig,
    event_buffer: Arc<RwLock<Vec<FileWatchEvent>>>,
    last_event_time: Arc<RwLock<DateTime<Utc>>>,
    watched_paths: Arc<RwLock<Vec<PathBuf>>>,
    event_history: Arc<RwLock<Vec<FileWatchEvent>>>,
    max_history_size: usize,
}

impl AdvancedFileWatcher {
    pub fn new(config: FileWatchConfig) -> Result<Self> {
        let watcher = FileWatcher::new(config.debounce_ms)?;
        
        Ok(Self {
            watcher,
            config,
            event_buffer: Arc::new(RwLock::new(Vec::new())),
            last_event_time: Arc::new(RwLock::new(Utc::now())),
            watched_paths: Arc::new(RwLock::new(Vec::new())),
            event_history: Arc::new(RwLock::new(Vec::new())),
            max_history_size: 1000,
        })
    }
    
    /// Start watching with filtering
    pub async fn watch_path(&mut self, path: &Path) -> Result<()> {
        self.watcher.watch_path(path, self.config.recursive).await?;
        
        // Track the watched path
        let mut paths = self.watched_paths.write().await;
        if !paths.contains(&path.to_path_buf()) {
            paths.push(path.to_path_buf());
        }
        
        Ok(())
    }
    
    /// Process events with rate limiting and filtering
    pub async fn process_events(&self) -> Vec<FileWatchEvent> {
        let mut events = Vec::new();
        let mut buffer = self.event_buffer.write().await;
        
        // Collect new events
        while let Some(event) = self.watcher.try_recv_event().await {
            if self.should_process_event(&event).await {
                buffer.push(event.clone());
                
                // Add to history
                let mut history = self.event_history.write().await;
                history.push(event);
                
                // Trim history if needed
                if history.len() > self.max_history_size {
                    let drain_count = history.len() - self.max_history_size;
                    history.drain(0..drain_count);
                }
            }
        }
        
        // Apply rate limiting
        let now = Utc::now();
        let last_time = *self.last_event_time.read().await;
        let elapsed = (now - last_time).num_milliseconds() as f64 / 1000.0;
        
        if elapsed > 0.0 {
            let max_events = (self.config.max_events_per_second as f64 * elapsed) as usize;
            let drain_count = buffer.len().min(max_events);
            
            events.extend(buffer.drain(..drain_count));
            *self.last_event_time.write().await = now;
        }
        
        events
    }
    
    /// Check if event should be processed based on ignore patterns
    async fn should_process_event(&self, event: &FileWatchEvent) -> bool {
        for path in &event.paths {
            let path_str = path.to_string_lossy();
            
            // Check ignore patterns
            for pattern in &self.config.ignore_patterns {
                if self.matches_pattern(&path_str, pattern) {
                    return false;
                }
            }
        }
        
        true
    }
    
    /// Simple pattern matching (supports * and ** wildcards)
    fn matches_pattern(&self, path: &str, pattern: &str) -> bool {
        // Handle ** wildcard for directory traversal
        if pattern.contains("**") {
            // For patterns like **/.git/**, check if .git is in the path
            let core_pattern = pattern
                .trim_start_matches("**/")
                .trim_end_matches("/**");
            
            // Check if the core pattern exists in the path
            return path.contains(&format!("/{}/", core_pattern)) || 
                   path.contains(&format!("/{}", core_pattern)) ||
                   path.ends_with(&format!("/{}", core_pattern));
        } else if pattern.contains("*") {
            // For single * wildcard, do simple matching
            let parts: Vec<&str> = pattern.split('*').collect();
            if parts.len() == 2 {
                return path.starts_with(parts[0]) && path.ends_with(parts[1]);
            }
        }
        
        // Exact match
        path == pattern
    }
    
    /// Get buffered events without processing
    pub async fn get_buffered_events(&self) -> Vec<FileWatchEvent> {
        self.event_buffer.read().await.clone()
    }
    
    /// Clear event buffer
    pub async fn clear_buffer(&self) {
        self.event_buffer.write().await.clear();
    }
    
    /// Update configuration
    pub async fn update_config_async(&mut self, config: FileWatchConfig) -> Result<()> {
        if config.debounce_ms != self.config.debounce_ms {
            self.watcher.set_debounce_duration(config.debounce_ms).await?;
        }
        
        self.config = config;
        Ok(())
    }

    /// Stop watching a path
    pub async fn unwatch_path(&mut self, path: &str) -> Result<()> {
        let path_buf = PathBuf::from(path);
        
        // Remove from watcher
        self.watcher.unwatch_path(&path_buf).await?;
        
        // Remove from tracked paths
        let mut paths = self.watched_paths.write().await;
        paths.retain(|p| p != &path_buf);
        
        Ok(())
    }

    /// Get list of watched paths
    pub fn get_watched_paths(&self) -> Vec<String> {
        // Block to get async value synchronously
        tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current().block_on(async {
                self.watched_paths.read().await
                    .iter()
                    .map(|p| p.to_string_lossy().to_string())
                    .collect()
            })
        })
    }

    /// Get recent events
    pub fn get_recent_events(&self, limit: usize) -> Vec<FileWatchEvent> {
        // Block to get async value synchronously
        tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current().block_on(async {
                let history = self.event_history.read().await;
                let start = history.len().saturating_sub(limit);
                history[start..].to_vec()
            })
        })
    }

    /// Get current configuration
    pub fn get_config(&self) -> &FileWatchConfig {
        &self.config
    }

    /// Update configuration (non-async version)
    pub fn update_config(&mut self, config: FileWatchConfig) {
        self.config = config;
    }

    /// Clear event buffer
    pub fn clear_event_buffer(&mut self) {
        // Clear the buffer synchronously
        tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current().block_on(async {
                self.event_buffer.write().await.clear();
            });
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use tokio::fs;
    use tokio::time::sleep;
    
    #[tokio::test]
    async fn test_file_watcher() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        let mut watcher = FileWatcher::new(100)?;
        
        // Start watching
        watcher.watch_path(temp_dir.path(), true).await?;
        
        // Give the watcher time to start
        sleep(Duration::from_millis(50)).await;
        
        // Create a file
        let test_file = temp_dir.path().join("test.txt");
        fs::write(&test_file, "hello").await.unwrap();
        
        // Wait for debounce and processing
        sleep(Duration::from_millis(300)).await;
        
        // Try to get event multiple times
        let mut found = false;
        for _ in 0..5 {
            if let Some(event) = watcher.try_recv_event().await {
                if event.paths.iter().any(|p| p.ends_with("test.txt")) {
                    found = true;
                    break;
                }
            }
            sleep(Duration::from_millis(50)).await;
        }
        
        assert!(found, "Expected to receive file creation event");
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_ignore_patterns() -> Result<()> {
        let config = FileWatchConfig::default();
        let watcher = AdvancedFileWatcher::new(config)?;
        
        // Test ignore patterns
        let event = FileWatchEvent {
            event_type: FileWatchEventType::Modified,
            paths: vec![PathBuf::from("/project/.git/HEAD")],
            timestamp: Utc::now(),
        };
        
        assert!(!watcher.should_process_event(&event).await);
        
        Ok(())
    }
}