// Terminal operation error variants

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "details")]
pub enum TerminalError {
    #[error("Command execution failed: {command} - {reason}")]
    CommandError { command: String, reason: String },

    #[error("Terminal operation failed: {operation} - {reason}")]
    OperationFailed { operation: String, reason: String },

    #[error("Command timeout: {command} timed out after {timeout_ms}ms")]
    CommandTimeout { command: String, timeout_ms: u64 },
}

impl TerminalError {
    /// Helper function to create command error
    pub fn command_failed(command: &str, reason: &str) -> Self {
        Self::CommandError {
            command: command.to_string(),
            reason: reason.to_string(),
        }
    }

    /// Helper function to create operation error
    pub fn operation_failed(operation: &str, reason: &str) -> Self {
        Self::OperationFailed {
            operation: operation.to_string(),
            reason: reason.to_string(),
        }
    }

    /// Helper function to create command timeout error
    pub fn command_timeout(command: &str, timeout_ms: u64) -> Self {
        Self::CommandTimeout {
            command: command.to_string(),
            timeout_ms,
        }
    }
}
