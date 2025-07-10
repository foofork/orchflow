use thiserror::Error;
use serde::{Deserialize, Serialize};

/// Main error type for muxd
#[derive(Error, Debug)]
pub enum MuxdError {
    #[error("Session not found: {session_id}")]
    SessionNotFound { session_id: String },
    
    #[error("Pane not found: {pane_id}")]
    PaneNotFound { pane_id: String },
    
    #[error("Permission denied: {reason}")]
    PermissionDenied { reason: String },
    
    #[error("Resource limit exceeded: {resource} (limit: {limit})")]
    ResourceLimit { resource: String, limit: usize },
    
    #[error("Invalid state: {reason}")]
    InvalidState { reason: String },
    
    #[error("Invalid request: {reason}")]
    InvalidRequest { reason: String },
    
    #[error("Method not found: {method}")]
    MethodNotFound { method: String },
    
    #[error("Invalid params: {reason}")]
    InvalidParams { reason: String },
    
    #[error("Auth error: {reason}")]
    AuthError { reason: String },
    
    #[error("Channel closed")]
    ChannelClosed,
    
    #[error("Server error: {message}")]
    ServerError { message: String },
    
    #[error("Connection error: {reason}")]
    ConnectionError { reason: String },
    
    #[error("IO error: {0}")]
    IoError(String),
    
    #[error("JSON error: {0}")]
    SerdeError(#[from] serde_json::Error),
}

/// JSON-RPC error codes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ErrorCode {
    // JSON-RPC 2.0 standard errors
    ParseError = -32700,
    InvalidRequest = -32600,
    MethodNotFound = -32601,
    InvalidParams = -32602,
    InternalError = -32603,
    
    // Custom muxd errors (1000-1999)
    SessionNotFound = 1001,
    PaneNotFound = 1002,
    PermissionDenied = 1003,
    ResourceLimit = 1004,
    InvalidState = 1005,
}

impl From<MuxdError> for ErrorCode {
    fn from(err: MuxdError) -> Self {
        match err {
            MuxdError::SessionNotFound { .. } => ErrorCode::SessionNotFound,
            MuxdError::PaneNotFound { .. } => ErrorCode::PaneNotFound,
            MuxdError::PermissionDenied { .. } => ErrorCode::PermissionDenied,
            MuxdError::ResourceLimit { .. } => ErrorCode::ResourceLimit,
            MuxdError::InvalidState { .. } => ErrorCode::InvalidState,
            _ => ErrorCode::InternalError,
        }
    }
}

pub type Result<T> = std::result::Result<T, MuxdError>;

impl MuxdError {
    /// Get the JSON-RPC error code for this error
    pub fn error_code(&self) -> i32 {
        match self {
            MuxdError::InvalidRequest { .. } => -32600,
            MuxdError::MethodNotFound { .. } => -32601,
            MuxdError::InvalidParams { .. } => -32602,
            MuxdError::SessionNotFound { .. } => -32001,
            MuxdError::PaneNotFound { .. } => -32002,
            MuxdError::ResourceLimit { .. } => -32003,
            MuxdError::InvalidState { .. } => -32004,
            MuxdError::AuthError { .. } => -32005,
            MuxdError::ChannelClosed => -32006,
            MuxdError::ServerError { .. } => -32007,
            MuxdError::ConnectionError { .. } => -32010,
            MuxdError::IoError(_) => -32008,
            MuxdError::SerdeError(_) => -32700, // Parse error
            MuxdError::PermissionDenied { .. } => -32009,
        }
    }
}