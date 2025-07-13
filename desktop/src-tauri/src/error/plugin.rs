// Plugin system error variants

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "details")]
pub enum PluginError {
    #[error("Plugin error in {plugin_id}: {operation} - {reason}")]
    OperationError {
        plugin_id: String,
        operation: String,
        reason: String,
    },

    #[error("Plugin not found: {plugin_id}")]
    PluginNotFound { plugin_id: String },

    #[error("Plugin initialization failed: {plugin_id} - {reason}")]
    InitializationFailed { plugin_id: String, reason: String },

    #[error("Plugin error: {plugin_id} - {reason}")]
    GenericError { plugin_id: String, reason: String },
}

impl PluginError {
    /// Helper function to create plugin operation error
    pub fn operation_error(plugin_id: &str, operation: &str, reason: &str) -> Self {
        Self::OperationError {
            plugin_id: plugin_id.to_string(),
            operation: operation.to_string(),
            reason: reason.to_string(),
        }
    }

    /// Helper function to create plugin not found error
    pub fn not_found(plugin_id: &str) -> Self {
        Self::PluginNotFound {
            plugin_id: plugin_id.to_string(),
        }
    }

    /// Helper function to create initialization error
    pub fn initialization_failed(plugin_id: &str, reason: &str) -> Self {
        Self::InitializationFailed {
            plugin_id: plugin_id.to_string(),
            reason: reason.to_string(),
        }
    }

    /// Helper function to create generic plugin error
    pub fn generic_error(plugin_id: &str, reason: &str) -> Self {
        Self::GenericError {
            plugin_id: plugin_id.to_string(),
            reason: reason.to_string(),
        }
    }
}
