// Network operation error variants

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "details")]
pub enum NetworkError {
    #[error("Network error: {operation} - {reason}")]
    OperationError { operation: String, reason: String },
    
    #[error("WebSocket error: {reason}")]
    WebSocketError { reason: String },
    
    #[error("Connection timeout: {endpoint} - {timeout_ms}ms")]
    ConnectionTimeout { endpoint: String, timeout_ms: u64 },
}

impl NetworkError {
    /// Helper function to create network operation error
    pub fn operation_error(operation: &str, reason: &str) -> Self {
        Self::OperationError {
            operation: operation.to_string(),
            reason: reason.to_string(),
        }
    }
    
    /// Helper function to create WebSocket error
    pub fn websocket_error(reason: &str) -> Self {
        Self::WebSocketError { reason: reason.to_string() }
    }
    
    /// Helper function to create connection timeout error
    pub fn connection_timeout(endpoint: &str, timeout_ms: u64) -> Self {
        Self::ConnectionTimeout {
            endpoint: endpoint.to_string(),
            timeout_ms,
        }
    }
}