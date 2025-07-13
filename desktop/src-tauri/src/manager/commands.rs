// Tauri command handlers

use super::{Action, Manager, PluginInfo};
use serde_json::Value;
use tauri;

// ===== Core API Commands (Protected Names) =====

#[tauri::command]
pub async fn orchestrator_execute(
    manager: tauri::State<'_, Manager>,
    action: Action,
) -> Result<Value, String> {
    manager.execute_action(action).await
}

#[tauri::command]
pub async fn orchestrator_subscribe(
    manager: tauri::State<'_, Manager>,
    event_types: Vec<String>,
) -> Result<Value, String> {
    // WebSocket subscriptions are handled by the WebSocket server
    // This command is kept for compatibility but directs users to use WebSocket

    // Log the subscription request for debugging
    tracing::info!("Subscription request for events: {:?}", event_types);

    // Emit a test event to confirm the event system is working
    if event_types.contains(&"test".to_string()) {
        manager.emit_event(super::Event::Custom {
            event_type: "subscription_test".to_string(),
            data: serde_json::json!({
                "message": "Test event from orchestrator_subscribe",
                "requested_types": event_types
            }),
        });
    }

    Ok(serde_json::json!({
        "subscribed": true,
        "message": "Use WebSocket connection on port 50505 for real-time events",
        "websocket_url": "ws://localhost:50505",
        "requested_events": event_types
    }))
}

// ===== Session Management =====

#[tauri::command]
pub async fn get_sessions(manager: tauri::State<'_, Manager>) -> Result<Vec<Value>, String> {
    let sessions = manager.state_manager.list_sessions().await;
    Ok(sessions
        .into_iter()
        .map(|s| serde_json::to_value(s).unwrap())
        .collect())
}

#[tauri::command]
pub async fn get_session(
    manager: tauri::State<'_, Manager>,
    session_id: String,
) -> Result<Value, String> {
    let session = manager
        .state_manager
        .get_session(&session_id)
        .await
        .ok_or_else(|| format!("Session not found: {}", session_id))?;
    Ok(serde_json::to_value(session).unwrap())
}

// ===== Pane Management =====

#[tauri::command]
pub async fn get_panes(
    manager: tauri::State<'_, Manager>,
    session_id: String,
) -> Result<Vec<Value>, String> {
    let panes = manager.state_manager.list_panes(&session_id).await;
    Ok(panes
        .into_iter()
        .map(|p| serde_json::to_value(p).unwrap())
        .collect())
}

#[tauri::command]
pub async fn get_pane(
    manager: tauri::State<'_, Manager>,
    pane_id: String,
) -> Result<Value, String> {
    let pane = manager
        .state_manager
        .get_pane(&pane_id)
        .await
        .ok_or_else(|| format!("Pane not found: {}", pane_id))?;
    Ok(serde_json::to_value(pane).unwrap())
}

#[tauri::command]
pub async fn select_backend_pane(
    manager: tauri::State<'_, Manager>,
    pane_id: String,
) -> Result<Value, String> {
    // Focus the pane in the backend
    manager
        .mux_backend
        .select_pane(&pane_id)
        .await
        .map_err(|e| e.to_string())?;

    // Get pane info and emit focus event
    if let Some(_pane) = manager.state_manager.get_pane(&pane_id).await {
        manager.emit_event(super::Event::PaneFocused {
            pane_id: pane_id.clone(),
        });
    }

    Ok(serde_json::json!({
        "focused": true,
        "pane_id": pane_id
    }))
}

// ===== Plugin Management =====

#[tauri::command]
pub async fn list_plugins(manager: tauri::State<'_, Manager>) -> Result<Vec<PluginInfo>, String> {
    let plugins = manager.plugins.read().await;
    let mut plugin_list = Vec::new();

    for (id, plugin) in plugins.iter() {
        let plugin_lock = plugin.lock().await;
        let metadata = plugin_lock.metadata();
        plugin_list.push(PluginInfo {
            id: id.clone(),
            name: metadata.name,
            version: metadata.version,
            author: metadata.author,
            description: metadata.description,
            capabilities: metadata.capabilities,
            loaded: true,
        });
    }

    Ok(plugin_list)
}

#[tauri::command]
pub async fn get_plugin_metadata(
    manager: tauri::State<'_, Manager>,
    plugin_id: String,
) -> Result<super::PluginMetadata, String> {
    let plugins = manager.plugins.read().await;

    if let Some(plugin) = plugins.get(&plugin_id) {
        let plugin_lock = plugin.lock().await;
        Ok(plugin_lock.metadata())
    } else {
        Err(format!("Plugin not found: {}", plugin_id))
    }
}

// ===== Search Commands =====

// ===== State Persistence =====

#[tauri::command]
pub async fn persist_state(manager: tauri::State<'_, Manager>) -> Result<Value, String> {
    // State is auto-persisted, but we can trigger a manual save
    // by getting all sessions and panes
    let sessions = manager.state_manager.list_sessions().await;

    Ok(serde_json::json!({
        "persisted": true,
        "sessions_count": sessions.len(),
        "timestamp": chrono::Utc::now()
    }))
}

// ===== Command History =====

#[tauri::command]
pub async fn get_command_history(
    manager: tauri::State<'_, Manager>,
    pane_id: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<Value>, String> {
    // Get command history - using search with empty query to get all
    let limit = limit.unwrap_or(1000);
    let history = manager
        .command_history
        .search(
            "", // empty query to get all
            pane_id.as_deref(),
            None, // session_id
            limit,
        )
        .await
        .map_err(|e| e.to_string())?;

    Ok(history
        .into_iter()
        .map(|h| serde_json::to_value(h).unwrap())
        .collect())
}

#[tauri::command]
pub async fn search_command_history(
    manager: tauri::State<'_, Manager>,
    pattern: String,
    pane_id: Option<String>,
) -> Result<Vec<Value>, String> {
    let results = manager
        .command_history
        .search(&pattern, pane_id.as_deref(), None, 100)
        .await
        .map_err(|e| e.to_string())?;
    Ok(results
        .into_iter()
        .map(|r| serde_json::to_value(r).unwrap())
        .collect())
}

// ===== File Operations =====

#[tauri::command]
pub async fn list_directory(
    manager: tauri::State<'_, Manager>,
    path: String,
) -> Result<Value, String> {
    let file_manager = manager
        .file_manager
        .as_ref()
        .ok_or_else(|| "File manager not initialized".to_string())?;

    use std::path::Path;
    let path = Path::new(&path);

    // Use expand_directory to get directory contents
    let entries = file_manager
        .expand_directory(path)
        .await
        .map_err(|e| e.to_string())?;

    Ok(serde_json::to_value(entries).unwrap())
}

#[tauri::command]
pub async fn read_file(manager: tauri::State<'_, Manager>, path: String) -> Result<String, String> {
    // Read file using tokio
    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))?;

    // Emit file read event
    manager.emit_event(super::Event::FileRead {
        path: path.clone(),
        size: content.len(),
    });

    Ok(content)
}

#[tauri::command]
pub async fn save_file(
    manager: tauri::State<'_, Manager>,
    path: String,
    content: String,
) -> Result<(), String> {
    // Save file using tokio
    tokio::fs::write(&path, &content)
        .await
        .map_err(|e| format!("Failed to save file: {}", e))?;

    // Emit file saved event
    manager.emit_event(super::Event::FileSaved { path });

    Ok(())
}

// ===== File Watching =====

#[tauri::command]
pub async fn watch_file(
    manager: tauri::State<'_, Manager>,
    path: String,
    recursive: bool,
) -> Result<(), String> {
    let file_watcher = manager
        .file_watcher
        .as_ref()
        .ok_or_else(|| "File watcher not initialized".to_string())?;

    let mut watcher = file_watcher.write().await;
    use std::path::Path;
    watcher
        .watch_path(Path::new(&path))
        .await
        .map_err(|e| e.to_string())?;

    // Emit watch started event
    manager.emit_event(super::Event::FileWatchStarted { path, recursive });

    Ok(())
}

#[tauri::command]
pub async fn unwatch_file(manager: tauri::State<'_, Manager>, path: String) -> Result<(), String> {
    let file_watcher = manager
        .file_watcher
        .as_ref()
        .ok_or_else(|| "File watcher not initialized".to_string())?;

    let mut watcher = file_watcher.write().await;
    watcher
        .unwatch_path(&path)
        .await
        .map_err(|e| e.to_string())?;

    // Emit watch stopped event
    manager.emit_event(super::Event::FileWatchStopped { path });

    Ok(())
}
