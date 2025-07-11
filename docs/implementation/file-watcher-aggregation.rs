// Example implementation of enhanced file watcher with event aggregation
// Demonstrates efficient file system monitoring with batching and filtering

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};
use std::collections::{HashMap, HashSet, VecDeque};
use tokio::sync::{mpsc, RwLock, Mutex};
use dashmap::DashMap;
use notify::{Event, EventKind, RecursiveMode, Watcher};
use serde::{Serialize, Deserialize};
use tauri::Manager;

// ===== Event Types and Structures =====

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum AggregatedEventType {
    Created,
    Modified,
    Removed,
    Renamed,
    Multiple, // When multiple types occurred
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AggregatedFileEvent {
    pub event_type: AggregatedEventType,
    pub path: PathBuf,
    pub related_paths: Vec<PathBuf>, // For renames, bulk operations
    pub count: usize,
    pub first_seen: chrono::DateTime<chrono::Utc>,
    pub last_seen: chrono::DateTime<chrono::Utc>,
    pub size_bytes: Option<u64>,
    pub is_directory: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEventBatch {
    pub events: Vec<AggregatedFileEvent>,
    pub batch_id: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub total_events: usize,
    pub aggregated_from: usize,
}

// ===== Event Aggregator =====

pub struct FileEventAggregator {
    events: Arc<DashMap<PathBuf, EventAccumulator>>,
    config: AggregatorConfig,
    event_tx: mpsc::UnboundedSender<FileEventBatch>,
    metrics: Arc<AggregatorMetrics>,
}

#[derive(Debug, Clone)]
struct EventAccumulator {
    path: PathBuf,
    event_types: HashSet<EventKind>,
    first_seen: Instant,
    last_seen: Instant,
    count: usize,
    related_paths: HashSet<PathBuf>,
    metadata: Option<FileMetadata>,
}

#[derive(Debug, Clone)]
struct FileMetadata {
    size_bytes: u64,
    is_directory: bool,
}

#[derive(Debug, Clone)]
pub struct AggregatorConfig {
    pub aggregation_window: Duration,
    pub max_events_per_batch: usize,
    pub coalesce_threshold: Duration,
    pub directory_depth_limit: usize,
    pub ignore_patterns: Vec<glob::Pattern>,
}

impl Default for AggregatorConfig {
    fn default() -> Self {
        Self {
            aggregation_window: Duration::from_millis(100),
            max_events_per_batch: 1000,
            coalesce_threshold: Duration::from_millis(50),
            directory_depth_limit: 10,
            ignore_patterns: vec![
                glob::Pattern::new("**/.git/**").unwrap(),
                glob::Pattern::new("**/node_modules/**").unwrap(),
                glob::Pattern::new("**/target/**").unwrap(),
                glob::Pattern::new("**/*.swp").unwrap(),
                glob::Pattern::new("**/*.tmp").unwrap(),
            ],
        }
    }
}

struct AggregatorMetrics {
    total_events: AtomicU64,
    aggregated_events: AtomicU64,
    ignored_events: AtomicU64,
    batches_sent: AtomicU64,
}

impl FileEventAggregator {
    pub fn new(
        config: AggregatorConfig,
    ) -> (Self, mpsc::UnboundedReceiver<FileEventBatch>) {
        let (tx, rx) = mpsc::unbounded_channel();
        
        let aggregator = Self {
            events: Arc::new(DashMap::new()),
            config,
            event_tx: tx,
            metrics: Arc::new(AggregatorMetrics {
                total_events: AtomicU64::new(0),
                aggregated_events: AtomicU64::new(0),
                ignored_events: AtomicU64::new(0),
                batches_sent: AtomicU64::new(0),
            }),
        };
        
        aggregator.start_aggregation_task();
        
        (aggregator, rx)
    }
    
    fn start_aggregation_task(&self) {
        let events = self.events.clone();
        let config = self.config.clone();
        let tx = self.event_tx.clone();
        let metrics = self.metrics.clone();
        
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(config.aggregation_window / 2);
            
            loop {
                interval.tick().await;
                
                let now = Instant::now();
                let mut batch_events = Vec::new();
                let mut total_aggregated = 0;
                
                // Collect events ready for batching
                events.retain(|path, accumulator| {
                    let age = now.duration_since(accumulator.last_seen);
                    
                    if age > config.coalesce_threshold {
                        // Convert to aggregated event
                        if let Some(event) = create_aggregated_event(accumulator) {
                            batch_events.push(event);
                            total_aggregated += accumulator.count;
                        }
                        false // Remove from map
                    } else {
                        true // Keep accumulating
                    }
                });
                
                // Send batch if we have events
                if !batch_events.is_empty() {
                    let batch = FileEventBatch {
                        batch_id: generate_batch_id(),
                        events: batch_events,
                        timestamp: chrono::Utc::now(),
                        total_events: batch_events.len(),
                        aggregated_from: total_aggregated,
                    };
                    
                    if tx.send(batch).is_ok() {
                        metrics.batches_sent.fetch_add(1, Ordering::Relaxed);
                        metrics.aggregated_events.fetch_add(total_aggregated as u64, Ordering::Relaxed);
                    }
                }
            }
        });
    }
    
    pub fn handle_notify_event(&self, event: notify::Event) {
        self.metrics.total_events.fetch_add(1, Ordering::Relaxed);
        
        // Filter ignored paths
        for path in &event.paths {
            if self.should_ignore_path(path) {
                self.metrics.ignored_events.fetch_add(1, Ordering::Relaxed);
                return;
            }
        }
        
        // Process each path in the event
        for path in event.paths {
            self.accumulate_event(path, event.kind);
        }
    }
    
    fn accumulate_event(&self, path: PathBuf, kind: EventKind) {
        self.events
            .entry(path.clone())
            .and_modify(|acc| {
                acc.event_types.insert(kind);
                acc.last_seen = Instant::now();
                acc.count += 1;
            })
            .or_insert_with(|| {
                let metadata = std::fs::metadata(&path).ok().map(|m| FileMetadata {
                    size_bytes: m.len(),
                    is_directory: m.is_dir(),
                });
                
                EventAccumulator {
                    path: path.clone(),
                    event_types: vec![kind].into_iter().collect(),
                    first_seen: Instant::now(),
                    last_seen: Instant::now(),
                    count: 1,
                    related_paths: HashSet::new(),
                    metadata,
                }
            });
    }
    
    fn should_ignore_path(&self, path: &Path) -> bool {
        let path_str = path.to_string_lossy();
        
        // Check depth limit
        let depth = path.components().count();
        if depth > self.config.directory_depth_limit {
            return true;
        }
        
        // Check ignore patterns
        for pattern in &self.config.ignore_patterns {
            if pattern.matches(&path_str) {
                return true;
            }
        }
        
        false
    }
    
    pub fn get_metrics(&self) -> FileWatcherMetrics {
        FileWatcherMetrics {
            total_events: self.metrics.total_events.load(Ordering::Relaxed),
            aggregated_events: self.metrics.aggregated_events.load(Ordering::Relaxed),
            ignored_events: self.metrics.ignored_events.load(Ordering::Relaxed),
            batches_sent: self.metrics.batches_sent.load(Ordering::Relaxed),
            pending_events: self.events.len(),
        }
    }
}

// ===== Enhanced File Watcher =====

pub struct EnhancedFileWatcher {
    watcher: Arc<Mutex<Option<notify::RecommendedWatcher>>>,
    aggregator: Arc<FileEventAggregator>,
    watched_paths: Arc<RwLock<HashMap<PathBuf, WatchedPath>>>,
    event_buffer: Arc<RwLock<VecDeque<FileEventBatch>>>,
    max_buffer_size: usize,
}

#[derive(Debug, Clone)]
struct WatchedPath {
    path: PathBuf,
    recursive: bool,
    watch_id: String,
    created_at: chrono::DateTime<chrono::Utc>,
}

impl EnhancedFileWatcher {
    pub fn new(config: AggregatorConfig) -> Self {
        let (aggregator, mut rx) = FileEventAggregator::new(config);
        let aggregator = Arc::new(aggregator);
        
        let event_buffer = Arc::new(RwLock::new(VecDeque::with_capacity(1000)));
        let buffer_clone = event_buffer.clone();
        
        // Start buffer management task
        tokio::spawn(async move {
            while let Some(batch) = rx.recv().await {
                let mut buffer = buffer_clone.write().await;
                
                // Maintain buffer size limit
                if buffer.len() >= 1000 {
                    buffer.pop_front();
                }
                
                buffer.push_back(batch);
            }
        });
        
        Self {
            watcher: Arc::new(Mutex::new(None)),
            aggregator,
            watched_paths: Arc::new(RwLock::new(HashMap::new())),
            event_buffer,
            max_buffer_size: 1000,
        }
    }
    
    pub async fn watch_path(&self, path: &Path, recursive: bool) -> Result<String, WatchError> {
        // Initialize watcher if needed
        {
            let mut watcher_lock = self.watcher.lock().await;
            if watcher_lock.is_none() {
                let aggregator = self.aggregator.clone();
                
                let watcher = notify::recommended_watcher(move |event: notify::Result<Event>| {
                    if let Ok(event) = event {
                        aggregator.handle_notify_event(event);
                    }
                }).map_err(|e| WatchError::InitError(e.to_string()))?;
                
                *watcher_lock = Some(watcher);
            }
        }
        
        // Add path to watcher
        let watch_id = generate_watch_id();
        
        {
            let mut watcher_lock = self.watcher.lock().await;
            if let Some(watcher) = watcher_lock.as_mut() {
                let mode = if recursive {
                    RecursiveMode::Recursive
                } else {
                    RecursiveMode::NonRecursive
                };
                
                watcher.watch(path, mode)
                    .map_err(|e| WatchError::WatchError(e.to_string()))?;
            }
        }
        
        // Track watched path
        {
            let mut paths = self.watched_paths.write().await;
            paths.insert(path.to_path_buf(), WatchedPath {
                path: path.to_path_buf(),
                recursive,
                watch_id: watch_id.clone(),
                created_at: chrono::Utc::now(),
            });
        }
        
        Ok(watch_id)
    }
    
    pub async fn unwatch_path(&self, path: &Path) -> Result<(), WatchError> {
        // Remove from watcher
        {
            let mut watcher_lock = self.watcher.lock().await;
            if let Some(watcher) = watcher_lock.as_mut() {
                watcher.unwatch(path)
                    .map_err(|e| WatchError::UnwatchError(e.to_string()))?;
            }
        }
        
        // Remove from tracked paths
        {
            let mut paths = self.watched_paths.write().await;
            paths.remove(path);
        }
        
        Ok(())
    }
    
    pub async fn get_events(&self, max_count: usize) -> Vec<FileEventBatch> {
        let mut buffer = self.event_buffer.write().await;
        let count = max_count.min(buffer.len());
        
        (0..count)
            .filter_map(|_| buffer.pop_front())
            .collect()
    }
    
    pub async fn get_watched_paths(&self) -> Vec<WatchedPathInfo> {
        let paths = self.watched_paths.read().await;
        
        paths.values()
            .map(|wp| WatchedPathInfo {
                path: wp.path.to_string_lossy().to_string(),
                recursive: wp.recursive,
                watch_id: wp.watch_id.clone(),
                watching_since: wp.created_at,
            })
            .collect()
    }
    
    pub async fn clear_buffer(&self) {
        self.event_buffer.write().await.clear();
    }
}

// ===== Tauri Integration =====

#[tauri::command]
pub async fn emit_file_events_compressed(
    app_handle: tauri::AppHandle,
    batch: FileEventBatch,
) -> Result<(), String> {
    // Group events by directory for compression
    let compressed = if batch.events.len() > 50 {
        compress_event_batch(batch)
    } else {
        batch
    };
    
    app_handle
        .emit_all("file-watch-events", &compressed)
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

fn compress_event_batch(mut batch: FileEventBatch) -> FileEventBatch {
    // Group by parent directory
    let mut by_directory: HashMap<PathBuf, Vec<AggregatedFileEvent>> = HashMap::new();
    
    for event in batch.events {
        if let Some(parent) = event.path.parent() {
            by_directory
                .entry(parent.to_path_buf())
                .or_insert_with(Vec::new)
                .push(event);
        }
    }
    
    // Create summary events for directories with many changes
    let mut compressed_events = Vec::new();
    
    for (dir, events) in by_directory {
        if events.len() > 10 {
            // Create a directory-level summary
            compressed_events.push(AggregatedFileEvent {
                event_type: AggregatedEventType::Multiple,
                path: dir,
                related_paths: events.iter().map(|e| e.path.clone()).collect(),
                count: events.len(),
                first_seen: events.iter().map(|e| e.first_seen).min().unwrap(),
                last_seen: events.iter().map(|e| e.last_seen).max().unwrap(),
                size_bytes: None,
                is_directory: true,
            });
        } else {
            // Keep individual events
            compressed_events.extend(events);
        }
    }
    
    batch.events = compressed_events;
    batch
}

// ===== Helper Functions =====

fn create_aggregated_event(acc: &EventAccumulator) -> Option<AggregatedFileEvent> {
    let event_type = determine_aggregated_type(&acc.event_types);
    
    Some(AggregatedFileEvent {
        event_type,
        path: acc.path.clone(),
        related_paths: acc.related_paths.iter().cloned().collect(),
        count: acc.count,
        first_seen: chrono::Utc::now() - chrono::Duration::from_std(
            Instant::now().duration_since(acc.first_seen)
        ).ok()?,
        last_seen: chrono::Utc::now() - chrono::Duration::from_std(
            Instant::now().duration_since(acc.last_seen)
        ).ok()?,
        size_bytes: acc.metadata.as_ref().map(|m| m.size_bytes),
        is_directory: acc.metadata.as_ref().map(|m| m.is_directory).unwrap_or(false),
    })
}

fn determine_aggregated_type(types: &HashSet<EventKind>) -> AggregatedEventType {
    use notify::EventKind::*;
    
    if types.len() > 1 {
        AggregatedEventType::Multiple
    } else if types.contains(&Create(_)) {
        AggregatedEventType::Created
    } else if types.contains(&Modify(_)) {
        AggregatedEventType::Modified
    } else if types.contains(&Remove(_)) {
        AggregatedEventType::Removed
    } else {
        AggregatedEventType::Modified // Default
    }
}

fn generate_batch_id() -> String {
    use uuid::Uuid;
    Uuid::new_v4().to_string()
}

fn generate_watch_id() -> String {
    use uuid::Uuid;
    format!("watch-{}", Uuid::new_v4())
}

// ===== Types and Errors =====

#[derive(Debug, Clone, Serialize)]
pub struct FileWatcherMetrics {
    pub total_events: u64,
    pub aggregated_events: u64,
    pub ignored_events: u64,
    pub batches_sent: u64,
    pub pending_events: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct WatchedPathInfo {
    pub path: String,
    pub recursive: bool,
    pub watch_id: String,
    pub watching_since: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, thiserror::Error)]
pub enum WatchError {
    #[error("Failed to initialize watcher: {0}")]
    InitError(String),
    
    #[error("Failed to watch path: {0}")]
    WatchError(String),
    
    #[error("Failed to unwatch path: {0}")]
    UnwatchError(String),
}

// ===== Tests =====

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[tokio::test]
    async fn test_event_aggregation() {
        let config = AggregatorConfig {
            aggregation_window: Duration::from_millis(50),
            coalesce_threshold: Duration::from_millis(25),
            ..Default::default()
        };
        
        let (aggregator, mut rx) = FileEventAggregator::new(config);
        
        // Simulate multiple events for same file
        let path = PathBuf::from("/test/file.txt");
        for _ in 0..5 {
            aggregator.accumulate_event(path.clone(), EventKind::Modify(Default::default()));
            tokio::time::sleep(Duration::from_millis(5)).await;
        }
        
        // Wait for aggregation
        tokio::time::sleep(Duration::from_millis(100)).await;
        
        // Should receive one aggregated event
        if let Some(batch) = rx.recv().await {
            assert_eq!(batch.events.len(), 1);
            assert_eq!(batch.events[0].count, 5);
            assert_eq!(batch.aggregated_from, 5);
        } else {
            panic!("Expected to receive batch");
        }
    }
    
    #[test]
    fn test_ignore_patterns() {
        let config = AggregatorConfig::default();
        let (aggregator, _) = FileEventAggregator::new(config);
        
        assert!(aggregator.should_ignore_path(Path::new("/project/.git/HEAD")));
        assert!(aggregator.should_ignore_path(Path::new("/project/node_modules/package/index.js")));
        assert!(!aggregator.should_ignore_path(Path::new("/project/src/main.rs")));
    }
}

use std::sync::atomic::{AtomicU64, Ordering};