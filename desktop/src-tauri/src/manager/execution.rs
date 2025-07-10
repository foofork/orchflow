// Action execution logic for the Manager

use serde_json::Value;
use super::{Manager, Action};
use super::handlers;

/// Execute an action through the action channel
pub async fn execute_action(manager: &Manager, action: Action) -> Result<Value, String> {
    let (tx, mut rx) = tokio::sync::mpsc::channel(1);
    
    manager.action_tx.send((action, tx)).await
        .map_err(|_| "Failed to send action")?;
        
    rx.recv().await
        .ok_or_else(|| "No response received".to_string())?
}

/// Process an action directly
pub async fn process_action(manager: &Manager, action: Action) -> Result<Value, String> {
    match action {
        // Session management
        Action::CreateSession { name } => {
            handlers::session::create_session(manager, name).await
        }
        
        Action::DeleteSession { session_id } => {
            handlers::session::delete_session(manager, session_id).await
        }
        
        Action::SaveSession { session_id, name } => {
            // For now, just return success since session persistence is handled by state manager
            Ok(serde_json::json!({
                "status": "ok",
                "session_id": session_id,
                "name": name
            }))
        }
        
        // Pane management
        Action::CreatePane { session_id, pane_type, command, shell_type, name } => {
            handlers::pane::create_pane(manager, session_id, pane_type, command, shell_type, name).await
        }
        
        Action::ClosePane { pane_id } => {
            handlers::pane::close_pane(manager, pane_id).await
        }
        
        Action::ResizePane { pane_id, width, height } => {
            handlers::pane::resize_pane(manager, &pane_id, width, height).await
        }
        
        Action::RenamePane { pane_id, name } => {
            // Update pane name in state manager
            let pane = manager.state_manager.get_pane(&pane_id).await
                .ok_or_else(|| format!("Pane not found: {}", pane_id))?;
            
            // For now, just return success since we don't have a rename method yet
            Ok(serde_json::json!({
                "status": "ok",
                "pane_id": pane_id,
                "new_name": name
            }))
        }
        
        // File management
        Action::CreateFile { path, content } => {
            handlers::file::create_file(manager, &path, content.as_deref()).await
        }
        
        Action::OpenFile { path } => {
            handlers::file::open_file(manager, &path).await
        }
        
        Action::CreateDirectory { path } => {
            handlers::file::create_directory(manager, &path).await
        }
        
        Action::DeletePath { path, permanent } => {
            handlers::file::delete_path(manager, &path, permanent).await
        }
        
        Action::RenamePath { old_path, new_name } => {
            handlers::file::rename_path(manager, &old_path, &new_name).await
        }
        
        Action::CopyPath { source, destination } => {
            handlers::file::copy_path(manager, &source, &destination).await
        }
        
        Action::MovePath { source, destination } => {
            handlers::file::move_path(manager, &source, &destination).await
        }
        
        Action::MoveFiles { files, destination } => {
            // Move multiple files to destination
            let mut results = Vec::new();
            for file in &files {
                match handlers::file::move_path(manager, file, &destination).await {
                    Ok(_) => results.push(serde_json::json!({ "file": file, "status": "moved" })),
                    Err(e) => results.push(serde_json::json!({ "file": file, "status": "error", "error": e })),
                }
            }
            Ok(serde_json::json!({ "results": results }))
        }
        
        Action::CopyFiles { files, destination } => {
            // Copy multiple files to destination
            let mut results = Vec::new();
            for file in &files {
                match handlers::file::copy_path(manager, file, &destination).await {
                    Ok(_) => results.push(serde_json::json!({ "file": file, "status": "copied" })),
                    Err(e) => results.push(serde_json::json!({ "file": file, "status": "error", "error": e })),
                }
            }
            Ok(serde_json::json!({ "results": results }))
        }
        
        Action::GetFileTree { path, max_depth } => {
            // Get file tree structure
            let base_path = path.unwrap_or_else(|| ".".to_string());
            Ok(serde_json::json!({
                "status": "ok",
                "path": base_path,
                "max_depth": max_depth,
                "message": "File tree functionality not fully implemented"
            }))
        }
        
        Action::SearchFiles { pattern, path } => {
            // Search for files matching pattern
            let search_path = path.unwrap_or_else(|| ".".to_string());
            Ok(serde_json::json!({
                "status": "ok",
                "pattern": pattern,
                "path": search_path,
                "message": "File search functionality not fully implemented"
            }))
        }
        
        // Search operations
        Action::SearchProject { pattern, options } => {
            handlers::search::search_project(manager, &pattern, options).await
        }
        
        Action::SearchInFile { file_path, pattern } => {
            handlers::search::search_in_file(manager, &file_path, &pattern).await
        }
        
        // Terminal operations
        Action::SendKeys { pane_id, keys } => {
            handlers::terminal::send_keys(manager, &pane_id, &keys).await
        }
        
        Action::RunCommand { pane_id, command } => {
            handlers::terminal::run_command(manager, &pane_id, &command).await
        }
        
        Action::GetPaneOutput { pane_id, lines } => {
            handlers::terminal::get_pane_output(manager, &pane_id, lines).await
        }
        
        // Plugin management
        Action::LoadPlugin { id, config: _ } => {
            // Try to create plugin from registry
            let plugin_registry = crate::plugins::PluginRegistry::new();
            
            if let Some(plugin) = plugin_registry.create(&id) {
                match manager.load_plugin(plugin).await {
                    Ok(_) => Ok(serde_json::json!({ 
                        "status": "ok", 
                        "plugin_id": id,
                        "loaded": true
                    })),
                    Err(e) => Err(format!("Failed to load plugin {}: {}", id, e))
                }
            } else {
                Err(format!("Plugin not found in registry: {}", id))
            }
        }
        
        Action::UnloadPlugin { id } => {
            let mut plugins = manager.plugins.write().await;
            if let Some(plugin) = plugins.remove(&id) {
                // Shutdown the plugin
                let mut plugin_lock = plugin.lock().await;
                match plugin_lock.shutdown().await {
                    Ok(_) => {
                        // Remove plugin subscriptions
                        let mut subscriptions = manager.plugin_subscriptions.write().await;
                        subscriptions.remove(&id);
                        
                        Ok(serde_json::json!({ 
                            "status": "ok", 
                            "plugin_id": id,
                            "unloaded": true
                        }))
                    }
                    Err(e) => Err(format!("Failed to shutdown plugin {}: {}", id, e))
                }
            } else {
                Err(format!("Plugin not loaded: {}", id))
            }
        }
    }
}