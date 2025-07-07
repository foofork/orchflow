use tauri::State;
use serde::{Deserialize, Serialize};
use crate::orchestrator::Orchestrator;
use crate::error::Result;
use crate::file_watcher::{FileWatchEvent, FileWatchConfig};

/// Start watching a path for file changes
#[tauri::command]
pub async fn start_file_watcher(
    orchestrator: State<'_, Orchestrator>,
    path: String,
    recursive: bool,
) -> Result<WatcherStartResult> {
    if let Some(file_watcher) = &orchestrator.file_watcher {
        let mut watcher = file_watcher.write().await;
        match watcher.watch_path(&std::path::Path::new(&path)).await {
            Ok(_) => {
                // Emit event for the orchestrator
                let _ = orchestrator.event_tx.send(crate::orchestrator::Event::FileWatchStarted { 
                    path: path.clone(), 
                    recursive 
                });
                
                Ok(WatcherStartResult {
                    path: path.clone(),
                    watching: true,
                    message: format!("Started watching {} (recursive: {})", path, recursive),
                })
            },
            Err(e) => Err(crate::error::OrchflowError::FileError {
                operation: "start_file_watcher".to_string(),
                path: path.clone(),
                reason: e.to_string(),
            })
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
pub async fn stop_file_watcher(
    orchestrator: State<'_, Orchestrator>,
    path: String,
) -> Result<()> {
    if let Some(file_watcher) = &orchestrator.file_watcher {
        let mut watcher = file_watcher.write().await;
        match watcher.unwatch_path(&path).await {
            Ok(_) => {
                // Emit event for the orchestrator
                let _ = orchestrator.event_tx.send(crate::orchestrator::Event::FileWatchStopped { 
                    path: path.clone() 
                });
                Ok(())
            },
            Err(e) => Err(crate::error::OrchflowError::FileError {
                operation: "stop_file_watcher".to_string(),
                path: path.clone(),
                reason: e.to_string(),
            })
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
pub async fn get_watched_paths(
    orchestrator: State<'_, Orchestrator>,
) -> Result<Vec<String>> {
    if let Some(file_watcher) = &orchestrator.file_watcher {
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
    orchestrator: State<'_, Orchestrator>,
    limit: Option<usize>,
) -> Result<Vec<FileWatchEvent>> {
    if let Some(file_watcher) = &orchestrator.file_watcher {
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
    orchestrator: State<'_, Orchestrator>,
    config: FileWatchConfig,
) -> Result<()> {
    if let Some(file_watcher) = &orchestrator.file_watcher {
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
pub async fn get_file_watcher_config(
    orchestrator: State<'_, Orchestrator>,
) -> Result<FileWatchConfig> {
    if let Some(file_watcher) = &orchestrator.file_watcher {
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
pub async fn clear_file_watch_buffer(
    orchestrator: State<'_, Orchestrator>,
) -> Result<()> {
    if let Some(file_watcher) = &orchestrator.file_watcher {
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