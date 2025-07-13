use crate::layout::*;
use crate::manager::{Action, Manager as OrchflowManager, PaneType, ShellType};
use crate::AppState;
use tauri::Manager;
use tauri::State;

#[tauri::command]
pub async fn create_layout(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<GridLayout, String> {
    let layout = GridLayout::new(session_id.clone());
    let mut layouts = state.layouts.lock().unwrap();
    layouts.insert(session_id, layout.clone());
    Ok(layout)
}

#[tauri::command]
pub async fn get_layout(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<GridLayout, String> {
    let layouts = state.layouts.lock().unwrap();
    layouts
        .get(&session_id)
        .cloned()
        .ok_or_else(|| "Layout not found".to_string())
}

#[tauri::command]
pub async fn split_layout_pane(
    session_id: String,
    pane_id: String,
    horizontal: bool,
    percent: Option<u8>,
    command: Option<String>,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(String, String), String> {
    // Get the layout and perform split
    let (child1_id, child2_id, _tmux_pane_id) = {
        let mut layouts = state.layouts.lock().unwrap();
        let layout = layouts
            .get_mut(&session_id)
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
        let tmux_pane_id = layout
            .panes
            .get(&child1_id)
            .and_then(|p| p.pane_id.as_ref())
            .ok_or_else(|| "No tmux pane found".to_string())?
            .clone();

        (child1_id, child2_id, tmux_pane_id)
    }; // Release the lock here

    // Create actual pane split through manager
    let manager: State<OrchflowManager> = app_handle.state();

    let create_action = Action::CreatePane {
        session_id: session_id.clone(),
        pane_type: PaneType::Terminal,
        command,
        shell_type: Some(ShellType::detect()),
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
    {
        let mut layouts = state.layouts.lock().unwrap();
        if let Some(layout) = layouts.get_mut(&session_id) {
            if let Some(child2) = layout.panes.get_mut(&child2_id) {
                child2.pane_id = Some(new_pane_id);
            }
        }
    } // Release the lock here too

    Ok((child1_id, child2_id))
}

#[tauri::command]
pub async fn close_layout_pane(
    session_id: String,
    pane_id: String,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    // Get the backend pane ID before closing
    let backend_pane_id = {
        let layouts = state.layouts.lock().unwrap();
        let layout = layouts
            .get(&session_id)
            .ok_or_else(|| "Layout not found".to_string())?;

        layout
            .panes
            .get(&pane_id)
            .and_then(|pane| pane.pane_id.clone())
    };

    // Kill the backend pane through orchestrator if it exists
    if let Some(backend_pane_id) = backend_pane_id {
        let manager: State<OrchflowManager> = app_handle.state();
        let close_action = Action::ClosePane {
            pane_id: backend_pane_id,
        };
        manager
            .execute_action(close_action)
            .await
            .map_err(|e| format!("Failed to close pane: {}", e))?;
    }

    // Close in the layout
    {
        let mut layouts = state.layouts.lock().unwrap();
        let layout = layouts
            .get_mut(&session_id)
            .ok_or_else(|| "Layout not found".to_string())?;
        layout.close_pane(&pane_id).map_err(|e| e.to_string())?
    }

    Ok(())
}

#[tauri::command]
pub async fn resize_layout_pane(
    session_id: String,
    pane_id: String,
    new_percent: u8,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    // Resize in the layout and get the new bounds
    let (backend_pane_id, width, height) = {
        let mut layouts = state.layouts.lock().unwrap();
        let layout = layouts
            .get_mut(&session_id)
            .ok_or_else(|| "Layout not found".to_string())?;

        // Resize in the layout
        layout
            .resize_pane(&pane_id, new_percent)
            .map_err(|e| e.to_string())?;

        // Get the backend pane info
        layout
            .panes
            .get(&pane_id)
            .and_then(|pane| {
                pane.pane_id.as_ref().map(|id| {
                    (
                        id.clone(),
                        pane.bounds.width as u32,
                        pane.bounds.height as u32,
                    )
                })
            })
            .ok_or_else(|| "No backend pane found for resize".to_string())?
    };

    // Apply resize to backend pane
    let manager: State<OrchflowManager> = app_handle.state();
    let resize_action = Action::ResizePane {
        pane_id: backend_pane_id,
        width,
        height,
    };
    manager
        .execute_action(resize_action)
        .await
        .map_err(|e| format!("Failed to resize backend pane: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn get_layout_leaf_panes(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<PaneLayout>, String> {
    let layouts = state.layouts.lock().unwrap();
    let layout = layouts
        .get(&session_id)
        .ok_or_else(|| "Layout not found".to_string())?;

    Ok(layout.get_leaf_panes().into_iter().cloned().collect())
}
