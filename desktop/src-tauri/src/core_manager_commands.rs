// Core Manager API Commands - Missing backend methods implementation
//
// This module implements the missing backend API methods for:
// - Plugin command execution
// - Terminal output streaming
// - Tab management integration
// - Neovim editor integration

use crate::error::{OrchflowError, Result};
use crate::manager::{Action, Manager, PaneType};
use crate::neovim::NeovimManager;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use tauri::{Emitter, State};
use tokio::sync::RwLock;

// ===== Plugin Command Execution =====

/// Execute a plugin command
#[tauri::command]
pub async fn execute_plugin_command(
    manager: State<'_, Manager>,
    plugin_id: String,
    command: String,
    params: Option<Value>,
) -> Result<Value> {
    // Get the plugin
    let plugins = manager.plugins.read().await;
    let plugin = plugins
        .get(&plugin_id)
        .ok_or_else(|| OrchflowError::PluginError {
            plugin_id: plugin_id.clone(),
            operation: "execute_command".to_string(),
            reason: format!("Plugin '{}' not found", plugin_id),
        })?;

    // Execute the command through the plugin's handle_request method
    let mut plugin_guard = plugin.lock().await;
    let result = plugin_guard
        .handle_request(&command, params.unwrap_or(json!({})))
        .await
        .map_err(|e| OrchflowError::PluginError {
            plugin_id: plugin_id.clone(),
            operation: "handle_request".to_string(),
            reason: format!("Command execution failed: {}", e),
        })?;

    Ok(result)
}

// ===== Terminal Output Streaming =====

/// Get terminal output with streaming support
#[tauri::command]
pub async fn get_output(
    manager: State<'_, Manager>,
    pane_id: String,
    lines: Option<u32>,
    follow: Option<bool>,
) -> Result<TerminalOutput> {
    // Execute GetPaneOutput action
    let action = Action::GetPaneOutput {
        pane_id: pane_id.clone(),
        lines,
    };

    let result = manager
        .execute_action(action)
        .await
        .map_err(|e| OrchflowError::TerminalError {
            operation: "get_output".to_string(),
            reason: e,
        })?;

    // Parse the output
    let output = result
        .as_str()
        .unwrap_or("")
        .to_string();

    // If follow is true, we'll need to set up a streaming mechanism
    // For now, return the current output with metadata
    Ok(TerminalOutput {
        pane_id,
        content: output,
        lines_returned: lines.unwrap_or(0) as usize,
        has_more: false, // TODO: Implement proper pagination
        cursor_position: None,
        follow: follow.unwrap_or(false),
    })
}

/// Stream terminal output updates
#[tauri::command]
pub async fn stream_terminal_output(
    manager: State<'_, Manager>,
    app_handle: tauri::AppHandle,
    pane_id: String,
    start_line: Option<u32>,
) -> Result<String> {
    // Generate a unique stream ID
    let stream_id = format!("stream_{}", uuid::Uuid::new_v4());
    
    // Clone values for the async task
    let pane_id_clone = pane_id.clone();
    let stream_id_clone = stream_id.clone();
    let manager_clone = (*manager).clone();
    
    // Start streaming in background
    tokio::spawn(async move {
        let mut last_line_count = start_line.unwrap_or(0);
        let mut interval = tokio::time::interval(tokio::time::Duration::from_millis(100));
        
        loop {
            interval.tick().await;
            
            // Get new output
            let action = Action::GetPaneOutput {
                pane_id: pane_id_clone.clone(),
                lines: Some(1000), // Get last 1000 lines
            };
            
            if let Ok(result) = manager_clone.execute_action(action).await {
                if let Some(output) = result.as_str() {
                    let lines: Vec<&str> = output.lines().collect();
                    let current_line_count = lines.len() as u32;
                    
                    if current_line_count > last_line_count {
                        // Send only new lines
                        let new_lines = lines[last_line_count as usize..]
                            .iter()
                            .map(|s| s.to_string())
                            .collect::<Vec<_>>();
                        
                        // Emit event with new output
                        let _ = app_handle.emit(
                            &format!("terminal-output-{}", stream_id_clone),
                            TerminalStreamUpdate {
                                stream_id: stream_id_clone.clone(),
                                pane_id: pane_id_clone.clone(),
                                new_lines,
                                line_start: last_line_count as usize,
                            },
                        );
                        
                        last_line_count = current_line_count;
                    }
                }
            }
            
            // Check if stream should continue (could check a cancellation token here)
            // For now, streams run until explicitly stopped
        }
    });
    
    Ok(stream_id)
}

/// Stop streaming terminal output
#[tauri::command]
pub async fn stop_terminal_stream(
    _manager: State<'_, Manager>,
    _stream_id: String,
) -> Result<()> {
    // TODO: Implement proper stream cancellation mechanism
    // For now, just return success
    Ok(())
}

// ===== Tab Management Integration =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TabInfo {
    pub id: String,
    pub session_id: String,
    pub title: String,
    pub pane_ids: Vec<String>,
    pub active_pane_id: Option<String>,
    pub is_active: bool,
    pub order: usize,
}

/// Get all tabs for a session
#[tauri::command]
pub async fn get_tabs(
    manager: State<'_, Manager>,
    session_id: String,
) -> Result<Vec<TabInfo>> {
    // Get session to check active pane
    let session = manager
        .state_manager
        .get_session(&session_id)
        .await
        .ok_or_else(|| OrchflowError::SessionNotFound {
            id: session_id.clone(),
        })?;

    // Get all panes for the session
    let panes = manager.state_manager.list_panes(&session_id).await;

    // Group panes by their "tab" (for now, we'll treat each pane as a tab)
    // In a future implementation, we might want to group multiple panes per tab
    let tabs: Vec<TabInfo> = panes
        .into_iter()
        .enumerate()
        .map(|(index, pane)| TabInfo {
            id: format!("tab_{}", pane.id),
            session_id: session_id.clone(),
            title: pane.title.clone(),
            pane_ids: vec![pane.id.clone()],
            active_pane_id: Some(pane.id.clone()),
            is_active: session.active_pane.as_ref() == Some(&pane.id),
            order: index,
        })
        .collect();

    Ok(tabs)
}

/// Create a new tab
#[tauri::command]
pub async fn create_tab(
    manager: State<'_, Manager>,
    session_id: String,
    title: Option<String>,
    pane_type: Option<String>,
) -> Result<TabInfo> {
    // Determine pane type
    let pane_type = match pane_type.as_deref() {
        Some("terminal") => PaneType::Terminal,
        Some("editor") => PaneType::Editor,
        Some("file_tree") => PaneType::FileTree,
        Some("output") => PaneType::Output,
        Some(custom) => PaneType::Custom(custom.to_string()),
        None => PaneType::Terminal, // Default to terminal
    };

    // Create a new pane (which acts as a tab for now)
    let action = Action::CreatePane {
        session_id: session_id.clone(),
        pane_type,
        command: None,
        shell_type: None,
        name: title.clone(),
    };

    let result = manager
        .execute_action(action)
        .await
        .map_err(|e| OrchflowError::TerminalError {
            operation: "create_tab".to_string(),
            reason: e,
        })?;

    // Parse the created pane
    let pane: crate::state_manager::PaneState =
        serde_json::from_value(result).map_err(|e| OrchflowError::ValidationError {
            field: "pane_result".to_string(),
            reason: format!("Failed to parse pane: {}", e),
        })?;

    // Get current tab count for ordering
    let existing_panes = manager.state_manager.list_panes(&session_id).await;

    Ok(TabInfo {
        id: format!("tab_{}", pane.id),
        session_id,
        title: title.unwrap_or_else(|| pane.title.clone()),
        pane_ids: vec![pane.id.clone()],
        active_pane_id: Some(pane.id.clone()),
        is_active: true, // New tabs are active by default
        order: existing_panes.len(),
    })
}

/// Switch to a different tab
#[tauri::command]
pub async fn switch_tab(
    manager: State<'_, Manager>,
    session_id: String,
    tab_id: String,
) -> Result<()> {
    // Extract pane_id from tab_id (format: "tab_{pane_id}")
    let pane_id = tab_id
        .strip_prefix("tab_")
        .ok_or_else(|| OrchflowError::ValidationError {
            field: "tab_id".to_string(),
            reason: "Invalid tab ID format".to_string(),
        })?;

    // Update the session's active pane
    manager
        .state_manager
        .set_active_pane(&session_id, pane_id)
        .await
        .map_err(|e| OrchflowError::StateError {
            operation: "switch_tab".to_string(),
            reason: e.to_string(),
        })?;

    Ok(())
}

/// Close a tab
#[tauri::command]
pub async fn close_tab(
    manager: State<'_, Manager>,
    tab_id: String,
) -> Result<()> {
    // Extract pane_id from tab_id
    let pane_id = tab_id
        .strip_prefix("tab_")
        .ok_or_else(|| OrchflowError::ValidationError {
            field: "tab_id".to_string(),
            reason: "Invalid tab ID format".to_string(),
        })?;

    // Close the pane
    let action = Action::ClosePane {
        pane_id: pane_id.to_string(),
    };

    manager
        .execute_action(action)
        .await
        .map_err(|e| OrchflowError::TerminalError {
            operation: "close_tab".to_string(),
            reason: e,
        })?;

    Ok(())
}

// ===== Neovim Editor Integration =====

/// Create a Neovim editor pane
#[tauri::command]
pub async fn create_neovim_editor(
    manager: State<'_, Manager>,
    neovim_manager: State<'_, NeovimManager>,
    session_id: String,
    file_path: Option<String>,
) -> Result<NeovimEditorInfo> {
    // Create a unique ID for this Neovim instance
    let nvim_id = format!("nvim_{}", uuid::Uuid::new_v4());

    // Create the Neovim instance
    neovim_manager
        .create_instance(nvim_id.clone())
        .map_err(|e| OrchflowError::EditorError {
            operation: "create_instance".to_string(),
            reason: e.message,
        })?;

    // Open file if provided
    if let Some(path) = &file_path {
        let instances = neovim_manager
            .get_instance(&nvim_id)
            .map_err(|e| OrchflowError::EditorError {
                operation: "get_instance".to_string(),
                reason: e.message,
            })?;
        
        if let Some(instance) = instances.get(&nvim_id) {
            instance
                .open_file(path)
                .map_err(|e| OrchflowError::EditorError {
                    operation: "open_file".to_string(),
                    reason: e.message,
                })?;
        }
    }

    // Create an editor pane for this Neovim instance
    let action = Action::CreatePane {
        session_id: session_id.clone(),
        pane_type: PaneType::Editor,
        command: None,
        shell_type: None,
        name: Some(format!("Neovim: {}", file_path.as_deref().unwrap_or("untitled"))),
    };

    let result = manager
        .execute_action(action)
        .await
        .map_err(|e| OrchflowError::EditorError {
            operation: "create_pane".to_string(),
            reason: e,
        })?;

    // Parse the created pane
    let pane: crate::state_manager::PaneState =
        serde_json::from_value(result).map_err(|e| OrchflowError::ValidationError {
            field: "pane_result".to_string(),
            reason: format!("Failed to parse pane: {}", e),
        })?;

    Ok(NeovimEditorInfo {
        pane_id: pane.id,
        neovim_id: nvim_id,
        session_id,
        file_path,
        is_modified: false,
    })
}

/// Get Neovim buffer content
#[tauri::command]
pub async fn get_neovim_buffer(
    neovim_manager: State<'_, NeovimManager>,
    neovim_id: String,
) -> Result<Value> {
    let instances = neovim_manager
        .get_instance(&neovim_id)
        .map_err(|e| OrchflowError::EditorError {
            operation: "get_instance".to_string(),
            reason: e.message,
        })?;

    if let Some(instance) = instances.get(&neovim_id) {
        let buffer = instance
            .get_current_buffer()
            .map_err(|e| OrchflowError::EditorError {
                operation: "get_buffer".to_string(),
                reason: e.message,
            })?;
        Ok(serde_json::to_value(buffer).unwrap())
    } else {
        Err(OrchflowError::EditorError {
            operation: "get_buffer".to_string(),
            reason: "Neovim instance not found".to_string(),
        })
    }
}

/// Execute Neovim command
#[tauri::command]
pub async fn execute_neovim_command(
    neovim_manager: State<'_, NeovimManager>,
    neovim_id: String,
    command: String,
) -> Result<String> {
    let instances = neovim_manager
        .get_instance(&neovim_id)
        .map_err(|e| OrchflowError::EditorError {
            operation: "get_instance".to_string(),
            reason: e.message,
        })?;

    if let Some(instance) = instances.get(&neovim_id) {
        instance
            .execute_command(&command)
            .map_err(|e| OrchflowError::EditorError {
                operation: "execute_command".to_string(),
                reason: e.message,
            })
    } else {
        Err(OrchflowError::EditorError {
            operation: "execute_command".to_string(),
            reason: "Neovim instance not found".to_string(),
        })
    }
}

// ===== Data Types =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalOutput {
    pub pane_id: String,
    pub content: String,
    pub lines_returned: usize,
    pub has_more: bool,
    pub cursor_position: Option<CursorPosition>,
    pub follow: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CursorPosition {
    pub row: usize,
    pub column: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalStreamUpdate {
    pub stream_id: String,
    pub pane_id: String,
    pub new_lines: Vec<String>,
    pub line_start: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NeovimEditorInfo {
    pub pane_id: String,
    pub neovim_id: String,
    pub session_id: String,
    pub file_path: Option<String>,
    pub is_modified: bool,
}

// ===== Plugin Registry Management =====

static PLUGIN_REGISTRY: once_cell::sync::Lazy<RwLock<HashMap<String, PluginMetadata>>> =
    once_cell::sync::Lazy::new(|| RwLock::new(HashMap::new()));

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginMetadata {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub commands: Vec<PluginCommand>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginCommand {
    pub name: String,
    pub description: String,
    pub parameters: Vec<PluginParameter>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginParameter {
    pub name: String,
    pub type_name: String,
    pub required: bool,
    pub description: String,
}

/// Register a plugin's available commands
#[tauri::command]
pub async fn register_plugin_commands(
    plugin_id: String,
    metadata: PluginMetadata,
) -> Result<()> {
    let mut registry = PLUGIN_REGISTRY.write().await;
    registry.insert(plugin_id, metadata);
    Ok(())
}

/// Get available commands for a plugin
#[tauri::command]
pub async fn get_plugin_commands(
    plugin_id: String,
) -> Result<Vec<PluginCommand>> {
    let registry = PLUGIN_REGISTRY.read().await;
    let metadata = registry
        .get(&plugin_id)
        .ok_or_else(|| OrchflowError::PluginError {
            plugin_id: plugin_id.clone(),
            operation: "get_commands".to_string(),
            reason: "Plugin not registered".to_string(),
        })?;
    
    Ok(metadata.commands.clone())
}

/// List all registered plugins
#[tauri::command]
pub async fn list_registered_plugins() -> Result<Vec<PluginMetadata>> {
    let registry = PLUGIN_REGISTRY.read().await;
    Ok(registry.values().cloned().collect())
}