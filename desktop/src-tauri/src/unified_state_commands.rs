// Unified State Commands - Tauri commands that use the StateManager
//
// These commands replace the separate layout_commands.rs and state_commands.rs
// by providing a unified interface that works with the StateManager.

use crate::error::OrchflowError;
use crate::layout::*;
use crate::manager::{Action, Manager as OrchflowManager, PaneType as OrchPaneType};
use crate::state_manager::{PaneType, StateManager};
use serde_json::Value;
use tauri::{Manager, State};

// ===== Session Commands =====

#[tauri::command]
pub async fn create_session(
    name: String,
    state_manager: State<'_, StateManager>,
) -> Result<Value, String> {
    let session = state_manager
        .create_session(name)
        .await
        .map_err(|e| e.to_string())?;
    Ok(serde_json::to_value(session).unwrap())
}

// Removed - now using manager::get_session
// #[tauri::command]
// pub async fn get_session(session_id: String, state_manager: State<'_, StateManager>) -> Result<Value, String> {
//     let session = state_manager.get_session(&session_id).await
//         .ok_or_else(|| OrchflowError::session_not_found(&session_id).to_string())?;
//     Ok(serde_json::to_value(session).unwrap())
// }

#[tauri::command]
pub async fn list_sessions(state_manager: State<'_, StateManager>) -> Result<Value, String> {
    let sessions = state_manager.list_sessions().await;
    Ok(serde_json::to_value(sessions).unwrap())
}

#[tauri::command]
pub async fn delete_session(
    session_id: String,
    state_manager: State<'_, StateManager>,
) -> Result<(), String> {
    state_manager
        .delete_session(&session_id)
        .await
        .map_err(|e| e.to_string())
}

// ===== Pane Commands =====

#[tauri::command]
pub async fn create_pane(
    session_id: String,
    pane_type: String,
    state_manager: State<'_, StateManager>,
) -> Result<Value, String> {
    let pane_type = match pane_type.as_str() {
        "terminal" => PaneType::Terminal,
        "editor" => PaneType::Editor,
        "file_tree" => PaneType::FileTree,
        "output" => PaneType::Output,
        other => PaneType::Custom(other.to_string()),
    };

    let pane = state_manager
        .create_pane(session_id, pane_type, None)
        .await
        .map_err(|e| e.to_string())?;
    Ok(serde_json::to_value(pane).unwrap())
}

// Removed - now using manager::get_pane
// #[tauri::command]
// pub async fn get_pane(pane_id: String, state_manager: State<'_, StateManager>) -> Result<Value, String> {
//     let pane = state_manager.get_pane(&pane_id).await
//         .ok_or_else(|| OrchflowError::pane_not_found(&pane_id).to_string())?;
//     Ok(serde_json::to_value(pane).unwrap())
// }

#[tauri::command]
pub async fn list_panes(
    session_id: String,
    state_manager: State<'_, StateManager>,
) -> Result<Value, String> {
    let panes = state_manager.list_panes(&session_id).await;
    Ok(serde_json::to_value(panes).unwrap())
}

#[tauri::command]
pub async fn delete_pane(
    pane_id: String,
    state_manager: State<'_, StateManager>,
) -> Result<(), String> {
    state_manager
        .delete_pane(&pane_id)
        .await
        .map_err(|e| e.to_string())
}

// ===== Layout Commands =====

#[tauri::command]
pub async fn get_unified_layout(
    session_id: String,
    state_manager: State<'_, StateManager>,
) -> Result<GridLayout, String> {
    state_manager
        .get_layout(&session_id)
        .await
        .ok_or_else(|| OrchflowError::layout_not_found(&session_id).to_string())
}

#[tauri::command]
pub async fn update_layout(
    session_id: String,
    layout: GridLayout,
    state_manager: State<'_, StateManager>,
) -> Result<(), String> {
    state_manager
        .update_layout(&session_id, layout)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn split_unified_layout_pane(
    session_id: String,
    pane_id: String,
    horizontal: bool,
    percent: Option<u8>,
    command: Option<String>,
    state_manager: State<'_, StateManager>,
    app_handle: tauri::AppHandle,
) -> Result<(String, String), String> {
    // Get the current layout
    let mut layout = state_manager
        .get_layout(&session_id)
        .await
        .ok_or_else(|| "Layout not found".to_string())?;

    // Split in the layout
    let split_type = if horizontal {
        SplitType::Horizontal
    } else {
        SplitType::Vertical
    };
    let (child1_id, child2_id) = layout
        .split_pane(&pane_id, split_type, percent.unwrap_or(50))
        .map_err(|e| e.to_string())?;

    // Get the tmux pane ID from the first child (which inherited the original pane)
    let _backend_pane_id = layout
        .panes
        .get(&child1_id)
        .and_then(|p| p.pane_id.as_ref())
        .ok_or_else(|| "No backend pane found".to_string())?
        .clone();

    // Create actual pane split through orchestrator
    let manager: State<OrchflowManager> = app_handle.state();

    let create_action = Action::CreatePane {
        session_id: session_id.clone(),
        pane_type: OrchPaneType::Terminal,
        command,
        shell_type: Some(crate::manager::ShellType::detect()),
        name: Some("Terminal".to_string()),
    };

    let result = manager
        .execute_action(create_action)
        .await
        .map_err(|e| format!("Failed to create pane: {}", e))?;

    // Extract the new pane ID from the result
    let new_pane_id = result
        .as_object()
        .and_then(|obj| obj.get("id"))
        .and_then(|id| id.as_str())
        .ok_or("Failed to get new pane ID from orchestrator")?;
    let new_pane_id = new_pane_id.to_string();

    // Update the second child with the new backend pane ID
    if let Some(child2) = layout.panes.get_mut(&child2_id) {
        child2.pane_id = Some(new_pane_id);
    }

    // Update the layout in state
    state_manager
        .update_layout(&session_id, layout)
        .await
        .map_err(|e| e.to_string())?;

    Ok((child1_id, child2_id))
}

#[tauri::command]
pub async fn close_unified_layout_pane(
    session_id: String,
    pane_id: String,
    state_manager: State<'_, StateManager>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    // Get the current layout
    let mut layout = state_manager
        .get_layout(&session_id)
        .await
        .ok_or_else(|| "Layout not found".to_string())?;

    // Get the tmux pane ID before closing
    if let Some(pane) = layout.panes.get(&pane_id) {
        if let Some(backend_pane_id) = &pane.pane_id {
            // Kill the backend pane through orchestrator
            let manager: State<OrchflowManager> = app_handle.state();
            let close_action = Action::ClosePane {
                pane_id: backend_pane_id.clone(),
            };
            manager
                .execute_action(close_action)
                .await
                .map_err(|e| format!("Failed to close pane: {}", e))?;
        }
    }

    // Close in the layout
    layout.close_pane(&pane_id).map_err(|e| e.to_string())?;

    // Update the layout in state
    state_manager
        .update_layout(&session_id, layout)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn resize_unified_layout_pane(
    session_id: String,
    pane_id: String,
    new_percent: u8,
    state_manager: State<'_, StateManager>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    // Get the current layout
    let mut layout = state_manager
        .get_layout(&session_id)
        .await
        .ok_or_else(|| "Layout not found".to_string())?;

    // Resize in the layout
    layout
        .resize_pane(&pane_id, new_percent)
        .map_err(|e| e.to_string())?;

    // Apply resize to backend panes based on new layout bounds
    if let Some(pane) = layout.panes.get(&pane_id) {
        if let Some(backend_pane_id) = &pane.pane_id {
            let manager: State<OrchflowManager> = app_handle.state();
            let resize_action = Action::ResizePane {
                pane_id: backend_pane_id.clone(),
                width: pane.bounds.width as u32,
                height: pane.bounds.height as u32,
            };
            manager
                .execute_action(resize_action)
                .await
                .map_err(|e| format!("Failed to resize backend pane: {}", e))?;
        }
    }

    // Update the layout in state
    state_manager
        .update_layout(&session_id, layout)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_unified_layout_leaf_panes(
    session_id: String,
    state_manager: State<'_, StateManager>,
) -> Result<Vec<PaneLayout>, String> {
    let layout = state_manager
        .get_layout(&session_id)
        .await
        .ok_or_else(|| "Layout not found".to_string())?;

    Ok(layout.get_leaf_panes().into_iter().cloned().collect())
}

// ===== Settings Commands =====

#[tauri::command]
pub async fn set_setting(
    key: String,
    value: String,
    state_manager: State<'_, StateManager>,
) -> Result<(), String> {
    state_manager
        .set_setting(&key, &value)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_setting(
    key: String,
    state_manager: State<'_, StateManager>,
) -> Result<Option<String>, String> {
    state_manager
        .get_setting(&key)
        .await
        .map_err(|e| e.to_string())
}

// ===== Module Commands =====

// TODO: Module functions need to be implemented through ModuleSystem, not StateManager
/*
#[tauri::command]
pub async fn install_module(
    name: String,
    version: String,
    manifest: Value,
    state_manager: State<'_, StateManager>
) -> Result<Value, String> {
    let manifest_json = serde_json::to_string(&manifest)
        .map_err(|e| e.to_string())?;

    let module = state_manager.install_module(name, version, manifest_json).await
        .map_err(|e| e.to_string())?;
    Ok(serde_json::to_value(module).unwrap())
}
*/

// TODO: Module functions need to be implemented through ModuleSystem, not StateManager
/*
#[tauri::command]
pub async fn list_modules(state_manager: State<'_, StateManager>) -> Result<Value, String> {
    let modules = state_manager.list_modules().await
        .map_err(|e| e.to_string())?;
    Ok(serde_json::to_value(modules).unwrap())
}
*/
