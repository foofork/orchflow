// Backend/mux operation error variants

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "details")]
pub enum BackendError {
    #[error("Backend operation failed: {operation} - {reason}")]
    OperationFailed { operation: String, reason: String },
    
    #[error("Tmux command failed: {command} - {stderr}")]
    TmuxError { command: String, stderr: String },
    
    #[error("Muxd connection failed: {reason}")]
    MuxdError { reason: String },
    
    #[error("Backend timeout: operation {operation} timed out after {timeout_ms}ms")]
    Timeout { operation: String, timeout_ms: u64 },
}

impl BackendError {
    /// Helper function to create backend operation error
    pub fn operation_failed(operation: &str, reason: &str) -> Self {
        Self::OperationFailed {
            operation: operation.to_string(),
            reason: reason.to_string(),
        }
    }
    
    /// Helper function to create tmux error
    pub fn tmux_error(command: &str, stderr: &str) -> Self {
        Self::TmuxError {
            command: command.to_string(),
            stderr: stderr.to_string(),
        }
    }
    
    /// Helper function to create timeout error
    pub fn timeout(operation: &str, timeout_ms: u64) -> Self {
        Self::Timeout {
            operation: operation.to_string(),
            timeout_ms,
        }
    }
}