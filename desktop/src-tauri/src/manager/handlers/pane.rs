// Pane management handlers

use crate::manager::{Event, Manager, PaneType, ShellType};
use crate::state_manager::PaneType as StatePaneType;
use serde_json::Value;

pub async fn create_pane(
    manager: &Manager,
    session_id: String,
    pane_type: PaneType,
    command: Option<String>,
    _shell_type: Option<ShellType>,
    _name: Option<String>,
) -> Result<Value, String> {
    // Determine the command to run
    let final_command = match pane_type {
        PaneType::Editor => {
            // For editor panes, use nvim
            Some("nvim".to_string())
        }
        _ => command,
    };

    // Create pane in backend (default to no split)
    let pane_id = manager
        .mux_backend
        .create_pane(&session_id, crate::mux_backend::SplitType::None)
        .await
        .map_err(|e| e.to_string())?;

    // If there's a command, send it to the pane
    if let Some(cmd) = final_command {
        manager
            .mux_backend
            .send_keys(&pane_id, &cmd)
            .await
            .map_err(|e| e.to_string())?;
        manager
            .mux_backend
            .send_keys(&pane_id, "\n")
            .await
            .map_err(|e| e.to_string())?;
    }

    // Convert pane type for state manager
    let state_pane_type = match &pane_type {
        PaneType::Terminal => StatePaneType::Terminal,
        PaneType::Editor => StatePaneType::Editor,
        PaneType::FileTree => StatePaneType::FileTree,
        PaneType::Output => StatePaneType::Output,
        PaneType::Custom(s) => StatePaneType::Custom(s.clone()),
    };

    // Store in state manager - create_pane takes session_id, pane_type, and backend_id
    let _pane_state = manager
        .state_manager
        .create_pane(session_id.clone(), state_pane_type, Some(pane_id.clone()))
        .await
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "id": pane_id,
        "type": pane_type,
        "session_id": session_id
    }))
}

pub async fn close_pane(manager: &Manager, pane_id: String) -> Result<Value, String> {
    // Emit pane closing event
    manager.emit_event(Event::PaneClosed {
        pane_id: pane_id.clone(),
    });

    // Kill pane in backend
    manager
        .mux_backend
        .kill_pane(&pane_id)
        .await
        .map_err(|e| e.to_string())?;

    // Remove from state manager
    manager
        .state_manager
        .delete_pane(&pane_id)
        .await
        .map_err(|e| e.to_string())?;

    // Emit pane destroyed event
    manager.emit_event(Event::PaneDestroyed {
        pane_id: pane_id.clone(),
    });

    Ok(serde_json::json!({ "closed": true }))
}

pub async fn resize_pane(
    manager: &Manager,
    pane_id: &str,
    width: u32,
    height: u32,
) -> Result<Value, String> {
    // Resize in backend
    manager
        .mux_backend
        .resize_pane(pane_id, crate::mux_backend::PaneSize { width, height })
        .await
        .map_err(|e| e.to_string())?;

    // Emit resize event
    manager.emit_event(Event::PaneResized {
        pane_id: pane_id.to_string(),
        width,
        height,
    });

    Ok(serde_json::json!({
        "resized": true,
        "width": width,
        "height": height
    }))
}
