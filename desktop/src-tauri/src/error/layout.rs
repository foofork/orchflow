// Layout operation error variants

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "details")]
pub enum LayoutError {
    #[error("Layout operation failed: {operation} - {reason}")]
    OperationFailed { operation: String, reason: String },

    #[error("Invalid pane split: {reason}")]
    InvalidPaneSplit { reason: String },

    #[error("Cannot close pane: {reason}")]
    PaneCloseError { reason: String },

    #[error("Pane resize failed: {reason}")]
    PaneResizeError { reason: String },
}

impl LayoutError {
    /// Helper function to create layout operation error
    pub fn operation_failed(operation: &str, reason: &str) -> Self {
        Self::OperationFailed {
            operation: operation.to_string(),
            reason: reason.to_string(),
        }
    }

    /// Helper function to create invalid split error
    pub fn invalid_split(reason: &str) -> Self {
        Self::InvalidPaneSplit {
            reason: reason.to_string(),
        }
    }
}
