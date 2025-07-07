// State management error variants

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "details")]
pub enum StateError {
    #[error("Session not found: {id}")]
    SessionNotFound { id: String },
    
    #[error("Pane not found: {id}")]
    PaneNotFound { id: String },
    
    #[error("Layout not found for session: {session_id}")]
    LayoutNotFound { session_id: String },
    
    #[error("Invalid session state: {reason}")]
    InvalidSessionState { reason: String },
    
    #[error("State persistence failed: {reason}")]
    StatePersistenceError { reason: String },
    
    #[error("State synchronization failed: {reason}")]
    StateSyncError { reason: String },
}

impl StateError {
    /// Helper function to create session not found error
    pub fn session_not_found(id: &str) -> Self {
        Self::SessionNotFound { id: id.to_string() }
    }
    
    /// Helper function to create pane not found error
    pub fn pane_not_found(id: &str) -> Self {
        Self::PaneNotFound { id: id.to_string() }
    }
    
    /// Helper function to create layout not found error
    pub fn layout_not_found(session_id: &str) -> Self {
        Self::LayoutNotFound { session_id: session_id.to_string() }
    }
}