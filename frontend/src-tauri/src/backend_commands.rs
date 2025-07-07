// Backend-specific commands for managing tmux/muxd sessions
use tauri::State;
use crate::manager::Manager;
use crate::error::Result;
use serde::{Deserialize, Serialize};

/// List all backend sessions (tmux/muxd sessions)
#[tauri::command]
pub async fn list_backend_sessions(
    manager: State<'_, Manager>,
) -> Result<Vec<BackendSession>> {
    let sessions = manager.mux_backend.list_sessions().await
        .map_err(|e| crate::error::OrchflowError::BackendError {
            operation: "list_sessions".to_string(),
            reason: e.to_string(),
        })?;
    
    // Convert to frontend-friendly format
    let backend_sessions: Vec<BackendSession> = sessions.into_iter().map(|s| BackendSession {
        id: s.id,
        name: s.name,
        created_at: s.created_at.to_rfc3339(),
        window_count: s.window_count,
        attached: s.attached,
    }).collect();
    
    Ok(backend_sessions)
}

/// Attach to a backend session
#[tauri::command]
pub async fn attach_backend_session(
    manager: State<'_, Manager>,
    session_id: String,
) -> Result<()> {
    manager.mux_backend.attach_session(&session_id).await
        .map_err(|e| crate::error::OrchflowError::BackendError {
            operation: "attach_session".to_string(),
            reason: e.to_string(),
        })?;
    
    Ok(())
}

/// Detach from a backend session
#[tauri::command]
pub async fn detach_backend_session(
    manager: State<'_, Manager>,
    session_id: String,
) -> Result<()> {
    manager.mux_backend.detach_session(&session_id).await
        .map_err(|e| crate::error::OrchflowError::BackendError {
            operation: "detach_session".to_string(),
            reason: e.to_string(),
        })?;
    
    Ok(())
}

/// Kill a backend session
#[tauri::command]
pub async fn kill_backend_session(
    manager: State<'_, Manager>,
    session_id: String,
) -> Result<()> {
    manager.mux_backend.kill_session(&session_id).await
        .map_err(|e| crate::error::OrchflowError::BackendError {
            operation: "kill_session".to_string(),
            reason: e.to_string(),
        })?;
    
    Ok(())
}

/// List all panes in a backend session
#[tauri::command]
pub async fn list_backend_panes(
    manager: State<'_, Manager>,
    session_id: String,
) -> Result<Vec<BackendPane>> {
    let panes = manager.mux_backend.list_panes(&session_id).await
        .map_err(|e| crate::error::OrchflowError::BackendError {
            operation: "list_panes".to_string(),
            reason: e.to_string(),
        })?;
    
    // Convert to frontend-friendly format
    let backend_panes: Vec<BackendPane> = panes.into_iter().map(|p| BackendPane {
        id: p.id,
        session_id: p.session_id,
        index: p.index,
        title: p.title,
        active: p.active,
        width: p.size.width,
        height: p.size.height,
    }).collect();
    
    Ok(backend_panes)
}

/// Sync backend sessions with orchflow state
#[tauri::command]
pub async fn sync_backend_sessions(
    manager: State<'_, Manager>,
) -> Result<SyncResult> {
    // Get backend sessions
    let backend_sessions = manager.mux_backend.list_sessions().await
        .map_err(|e| crate::error::OrchflowError::BackendError {
            operation: "list_sessions".to_string(),
            reason: e.to_string(),
        })?;
    
    // Get orchflow sessions
    let orchflow_sessions = manager.state_manager.list_sessions().await;
    
    let mut orphaned_backend = Vec::new();
    let mut missing_backend = Vec::new();
    
    // Find backend sessions not in orchflow
    for backend_session in &backend_sessions {
        if !orchflow_sessions.iter().any(|s| s.name == backend_session.name) {
            orphaned_backend.push(backend_session.name.clone());
        }
    }
    
    // Find orchflow sessions not in backend
    for orchflow_session in &orchflow_sessions {
        if !backend_sessions.iter().any(|s| s.name == orchflow_session.name) {
            missing_backend.push(orchflow_session.name.clone());
        }
    }
    
    Ok(SyncResult {
        backend_count: backend_sessions.len(),
        orchflow_count: orchflow_sessions.len(),
        orphaned_backend,
        missing_backend,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendSession {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub window_count: usize,
    pub attached: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendPane {
    pub id: String,
    pub session_id: String,
    pub index: u32,
    pub title: String,
    pub active: bool,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    pub backend_count: usize,
    pub orchflow_count: usize,
    pub orphaned_backend: Vec<String>,
    pub missing_backend: Vec<String>,
}