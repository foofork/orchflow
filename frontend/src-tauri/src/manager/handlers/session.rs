// Session management handlers

use serde_json::Value;
use crate::manager::Manager;

pub async fn create_session(manager: &Manager, name: String) -> Result<Value, String> {
    // Create session through state manager
    let session = manager.state_manager.create_session(name).await
        .map_err(|e| e.to_string())?;
    
    Ok(serde_json::json!({
        "id": session.id,
        "name": session.name
    }))
}

pub async fn delete_session(manager: &Manager, session_id: String) -> Result<Value, String> {
    // Get all panes in session
    let panes = manager.state_manager.list_panes(&session_id).await;
    
    // Delete each pane
    for pane in panes {
        manager.mux_backend.kill_pane(&pane.id).await
            .map_err(|e| e.to_string())?;
        manager.state_manager.delete_pane(&pane.id).await
            .map_err(|e| e.to_string())?;
    }
    
    // Delete session
    manager.state_manager.delete_session(&session_id).await
        .map_err(|e| e.to_string())?;
    
    Ok(serde_json::json!({ "deleted": true }))
}