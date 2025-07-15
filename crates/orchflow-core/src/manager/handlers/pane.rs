use crate::error::Result;
use crate::manager::{Manager, PaneType, ShellType};
use crate::state::PaneState;
use chrono::Utc;
use orchflow_mux::backend::{PaneSize, SplitType};
use serde_json::Value;
use uuid::Uuid;

pub async fn create_pane(
    manager: &Manager,
    session_id: String,
    pane_type: PaneType,
    command: Option<String>,
    shell_type: Option<ShellType>,
    name: Option<String>,
) -> Result<Value> {
    // Verify session exists
    let _session = manager
        .state_manager
        .get_session(&session_id)
        .await
        .ok_or_else(|| {
            crate::error::OrchflowError::NotFound(format!("Session not found: {session_id}"))
        })?;

    // Create backend pane - use SplitType::None for new panes
    let backend_id = manager
        .mux_backend
        .create_pane(&session_id, SplitType::None)
        .await?;

    // Create pane state
    let pane = PaneState {
        id: Uuid::new_v4().to_string(),
        session_id: session_id.clone(),
        pane_type,
        title: name,
        command,
        shell_type: shell_type.map(|s| format!("{s:?}")),
        working_dir: None,
        backend_id: Some(backend_id),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        width: 80,
        height: 24,
        x: 0,
        y: 0,
        active: true,
        metadata: std::collections::HashMap::new(),
    };

    // Save to state manager
    let pane = manager.state_manager.create_pane(pane).await?;

    Ok(serde_json::to_value(&pane).unwrap())
}

pub async fn close_pane(manager: &Manager, pane_id: String) -> Result<Value> {
    // Get pane info
    let pane = manager
        .state_manager
        .get_pane(&pane_id)
        .await
        .ok_or_else(|| {
            crate::error::OrchflowError::NotFound(format!("Pane not found: {pane_id}"))
        })?;

    // Kill backend pane
    if let Some(backend_id) = &pane.backend_id {
        if let Err(e) = manager.mux_backend.kill_pane(backend_id).await {
            tracing::error!("Failed to kill backend pane: {}", e);
        }
    }

    // Delete from state manager
    manager.state_manager.delete_pane(&pane_id).await?;

    Ok(serde_json::json!({
        "status": "ok",
        "pane_id": pane_id
    }))
}

pub async fn resize_pane(
    manager: &Manager,
    pane_id: &str,
    width: u32,
    height: u32,
) -> Result<Value> {
    // Get pane
    let mut pane = manager
        .state_manager
        .get_pane(pane_id)
        .await
        .ok_or_else(|| {
            crate::error::OrchflowError::NotFound(format!("Pane not found: {pane_id}"))
        })?;

    // Resize backend pane
    if let Some(backend_id) = &pane.backend_id {
        let size = PaneSize { width, height };
        manager.mux_backend.resize_pane(backend_id, size).await?;
    }

    // Update state
    pane.width = width;
    pane.height = height;
    pane.updated_at = Utc::now();
    manager.state_manager.update_pane(pane).await?;

    // Emit event
    manager.emit_event(crate::manager::Event::PaneResized {
        pane_id: pane_id.to_string(),
        width,
        height,
    });

    Ok(serde_json::json!({
        "status": "ok",
        "pane_id": pane_id,
        "width": width,
        "height": height
    }))
}

pub async fn rename_pane(manager: &Manager, pane_id: &str, name: &str) -> Result<Value> {
    // Get pane
    let mut pane = manager
        .state_manager
        .get_pane(pane_id)
        .await
        .ok_or_else(|| {
            crate::error::OrchflowError::NotFound(format!("Pane not found: {pane_id}"))
        })?;

    // Update state
    pane.title = Some(name.to_string());
    pane.updated_at = Utc::now();
    manager.state_manager.update_pane(pane).await?;

    Ok(serde_json::json!({
        "status": "ok",
        "pane_id": pane_id,
        "new_name": name
    }))
}
