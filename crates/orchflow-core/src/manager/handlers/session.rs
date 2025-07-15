use crate::error::Result;
use crate::manager::Manager;
use serde_json::Value;

pub async fn create_session(manager: &Manager, name: String) -> Result<Value> {
    // Create session in state manager
    let session = manager.state_manager.create_session(name.clone()).await?;

    // Create backend session
    manager.mux_backend.create_session(&session.id).await?;

    Ok(serde_json::to_value(&session).unwrap())
}

pub async fn delete_session(manager: &Manager, session_id: String) -> Result<Value> {
    // Get session first
    let _session = manager
        .state_manager
        .get_session(&session_id)
        .await
        .ok_or_else(|| {
            crate::error::OrchflowError::NotFound(format!("Session not found: {session_id}"))
        })?;

    // Kill backend session
    if let Err(e) = manager.mux_backend.kill_session(&session_id).await {
        tracing::error!("Failed to kill backend session: {}", e);
    }

    // Delete from state manager
    manager.state_manager.delete_session(&session_id).await?;

    Ok(serde_json::json!({
        "status": "ok",
        "session_id": session_id
    }))
}
