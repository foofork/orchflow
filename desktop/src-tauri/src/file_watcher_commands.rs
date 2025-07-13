use crate::error::Result;
use crate::file_watcher::{FileWatchConfig, FileWatchEvent};
use crate::manager::Manager;
use serde::{Deserialize, Serialize};
use tauri::State;

/// Start watching a path for file changes
#[tauri::command]
pub async fn start_file_watcher(
    manager: State<'_, Manager>,
    path: String,
    recursive: bool,
) -> Result<WatcherStartResult> {
    if let Some(file_watcher) = &manager.file_watcher {
        let mut watcher = file_watcher.write().await;
        match watcher.watch_path(&std::path::Path::new(&path)).await {
            Ok(_) => {
                // Emit event for the orchestrator
                let _ = manager
                    .event_tx
                    .send(crate::manager::Event::FileWatchStarted {
                        path: path.clone(),
                        recursive,
                    });

                Ok(WatcherStartResult {
                    path: path.clone(),
                    watching: true,
                    message: format!("Started watching {} (recursive: {})", path, recursive),
                })
            }
            Err(e) => Err(crate::error::OrchflowError::FileOperationError {
                operation: "start_file_watcher".to_string(),
                path: path.clone().into(),
                reason: e.to_string(),
            }),
        }
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "file_watcher".to_string(),
            reason: "File watcher not initialized".to_string(),
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WatcherStartResult {
    pub path: String,
    pub watching: bool,
    pub message: String,
}

/// Stop watching a path
#[tauri::command]
pub async fn stop_file_watcher(manager: State<'_, Manager>, path: String) -> Result<()> {
    if let Some(file_watcher) = &manager.file_watcher {
        let mut watcher = file_watcher.write().await;
        match watcher.unwatch_path(&path).await {
            Ok(_) => {
                // Emit event for the orchestrator
                let _ = manager
                    .event_tx
                    .send(crate::manager::Event::FileWatchStopped { path: path.clone() });
                Ok(())
            }
            Err(e) => Err(crate::error::OrchflowError::FileOperationError {
                operation: "stop_file_watcher".to_string(),
                path: path.clone().into(),
                reason: e.to_string(),
            }),
        }
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "file_watcher".to_string(),
            reason: "File watcher not initialized".to_string(),
        })
    }
}

/// Get all watched paths
#[tauri::command]
pub async fn get_watched_paths(manager: State<'_, Manager>) -> Result<Vec<String>> {
    if let Some(file_watcher) = &manager.file_watcher {
        let watcher = file_watcher.read().await;
        let paths = watcher.get_watched_paths();
        Ok(paths)
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "file_watcher".to_string(),
            reason: "File watcher not initialized".to_string(),
        })
    }
}

/// Get file watch events
#[tauri::command]
pub async fn get_file_watch_events(
    manager: State<'_, Manager>,
    limit: Option<usize>,
) -> Result<Vec<FileWatchEvent>> {
    if let Some(file_watcher) = &manager.file_watcher {
        let watcher = file_watcher.read().await;
        let events = watcher.get_recent_events(limit.unwrap_or(100));
        Ok(events)
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "file_watcher".to_string(),
            reason: "File watcher not initialized".to_string(),
        })
    }
}

/// Update file watcher configuration
#[tauri::command]
pub async fn update_file_watcher_config(
    manager: State<'_, Manager>,
    config: FileWatchConfig,
) -> Result<()> {
    if let Some(file_watcher) = &manager.file_watcher {
        let mut watcher = file_watcher.write().await;
        watcher.update_config(config);
        Ok(())
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "file_watcher".to_string(),
            reason: "File watcher not initialized".to_string(),
        })
    }
}

/// Get current file watcher configuration
#[tauri::command]
pub async fn get_file_watcher_config(manager: State<'_, Manager>) -> Result<FileWatchConfig> {
    if let Some(file_watcher) = &manager.file_watcher {
        let watcher = file_watcher.read().await;
        let config = watcher.get_config().clone();
        Ok(config)
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "file_watcher".to_string(),
            reason: "File watcher not initialized".to_string(),
        })
    }
}

/// Clear file watch event buffer
#[tauri::command]
pub async fn clear_file_watch_buffer(manager: State<'_, Manager>) -> Result<()> {
    if let Some(file_watcher) = &manager.file_watcher {
        let mut watcher = file_watcher.write().await;
        watcher.clear_event_buffer();
        Ok(())
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "file_watcher".to_string(),
            reason: "File watcher not initialized".to_string(),
        })
    }
}

/// Subscribe to file watch events via WebSocket
#[derive(Debug, Serialize, Deserialize)]
pub struct FileWatchSubscription {
    pub path: String,
    pub recursive: bool,
    pub filter_patterns: Vec<String>,
}

/// File watch event for frontend
#[derive(Debug, Serialize, Deserialize)]
pub struct FileWatchNotification {
    pub event: FileWatchEvent,
    pub subscription_path: String,
}
