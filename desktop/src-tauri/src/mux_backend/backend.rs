use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use crate::error::OrchflowError;

/// Error types for multiplexer operations
#[derive(Debug, thiserror::Error)]
pub enum MuxError {
    #[error("Session creation failed: {0}")]
    SessionCreationFailed(String),
    
    #[error("Session not found: {0}")]
    SessionNotFound(String),
    
    #[error("Pane not found: {0}")]
    PaneNotFound(String),
    
    #[error("Command execution failed: {0}")]
    CommandFailed(String),
    
    #[error("Backend not available: {0}")]
    BackendUnavailable(String),
    
    #[error("Operation not supported by backend: {0}")]
    NotSupported(String),
    
    #[error("Invalid state: {0}")]
    InvalidState(String),
    
    #[error("Connection error: {0}")]
    ConnectionError(String),
    
    #[error("Parse error: {0}")]
    ParseError(String),
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    
    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
    
    #[error("Other error: {0}")]
    Other(String),
}

impl MuxError {
    /// Helper to create errors with context
    pub fn with_context<S: Into<String>>(self, context: S) -> Self {
        match self {
            MuxError::Other(msg) => MuxError::Other(format!("{}: {}", context.into(), msg)),
            _ => self,
        }
    }
    
    /// Create a session creation failed error
    pub fn session_creation_failed<S: Into<String>>(msg: S) -> Self {
        MuxError::SessionCreationFailed(msg.into())
    }
    
    /// Create a session not found error
    pub fn session_not_found<S: Into<String>>(session_id: S) -> Self {
        MuxError::SessionNotFound(session_id.into())
    }
    
    /// Create a pane not found error
    pub fn pane_not_found<S: Into<String>>(pane_id: S) -> Self {
        MuxError::PaneNotFound(pane_id.into())
    }
    
    /// Create a command failed error
    pub fn command_failed<S: Into<String>>(msg: S) -> Self {
        MuxError::CommandFailed(msg.into())
    }
    
    /// Create a backend unavailable error
    pub fn backend_unavailable<S: Into<String>>(msg: S) -> Self {
        MuxError::BackendUnavailable(msg.into())
    }
    
    /// Create a not supported error
    pub fn not_supported<S: Into<String>>(operation: S) -> Self {
        MuxError::NotSupported(operation.into())
    }
    
    /// Create an invalid state error
    pub fn invalid_state<S: Into<String>>(msg: S) -> Self {
        MuxError::InvalidState(msg.into())
    }
    
    /// Create a connection error
    pub fn connection_error<S: Into<String>>(msg: S) -> Self {
        MuxError::ConnectionError(msg.into())
    }
    
    /// Create a parse error
    pub fn parse_error<S: Into<String>>(msg: S) -> Self {
        MuxError::ParseError(msg.into())
    }
    
    /// Create an other error
    pub fn other<S: Into<String>>(msg: S) -> Self {
        MuxError::Other(msg.into())
    }
}

// ===== Bridge to Unified Error System =====

impl From<MuxError> for OrchflowError {
    fn from(err: MuxError) -> Self {
        match err {
            MuxError::SessionCreationFailed(msg) => OrchflowError::BackendError {
                operation: "create_session".to_string(),
                reason: msg,
            },
            MuxError::SessionNotFound(id) => OrchflowError::SessionNotFound { id },
            MuxError::PaneNotFound(id) => OrchflowError::PaneNotFound { id },
            MuxError::CommandFailed(msg) => OrchflowError::CommandError {
                command: "mux_command".to_string(),
                reason: msg,
            },
            MuxError::BackendUnavailable(msg) => OrchflowError::BackendError {
                operation: "backend_check".to_string(),
                reason: format!("Backend unavailable: {}", msg),
            },
            MuxError::NotSupported(operation) => OrchflowError::BackendError {
                operation: operation.clone(),
                reason: format!("Operation not supported: {}", operation),
            },
            MuxError::InvalidState(msg) => OrchflowError::BackendError {
                operation: "state_validation".to_string(),
                reason: format!("Invalid state: {}", msg),
            },
            MuxError::ConnectionError(msg) => OrchflowError::NetworkError {
                operation: "mux_connection".to_string(),
                reason: msg,
            },
            MuxError::ParseError(msg) => OrchflowError::ValidationError {
                field: "mux_response".to_string(),
                reason: format!("Parse error: {}", msg),
            },
            MuxError::IoError(io_err) => OrchflowError::FileError {
                reason: format!("Mux I/O error: {}", io_err),
            },
            MuxError::SerializationError(serde_err) => OrchflowError::ValidationError {
                field: "mux_data".to_string(),
                reason: serde_err.to_string(),
            },
            MuxError::Other(msg) => OrchflowError::BackendError {
                operation: "unknown".to_string(),
                reason: msg,
            },
        }
    }
}

/// Represents a terminal multiplexer session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub window_count: usize,
    pub attached: bool,
}

/// Represents a pane within a session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pane {
    pub id: String,
    pub session_id: String,
    pub index: u32,
    pub title: String,
    pub active: bool,
    pub size: PaneSize,
}

/// Pane dimensions
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct PaneSize {
    pub width: u32,
    pub height: u32,
}

/// How to split a pane
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum SplitType {
    Horizontal,
    Vertical,
    None,
}

/// The core trait that all multiplexer backends must implement
#[async_trait]
pub trait MuxBackend: Send + Sync {
    /// Create a new session with the given name
    async fn create_session(&self, name: &str) -> Result<String, MuxError>;
    
    /// Create a new pane in the specified session
    async fn create_pane(&self, session_id: &str, split: SplitType) -> Result<String, MuxError>;
    
    /// Send keystrokes to a specific pane
    async fn send_keys(&self, pane_id: &str, keys: &str) -> Result<(), MuxError>;
    
    /// Capture the current contents of a pane
    async fn capture_pane(&self, pane_id: &str) -> Result<String, MuxError>;
    
    /// List all sessions
    async fn list_sessions(&self) -> Result<Vec<Session>, MuxError>;
    
    /// Kill a session and all its panes
    async fn kill_session(&self, session_id: &str) -> Result<(), MuxError>;
    
    /// Kill a specific pane
    async fn kill_pane(&self, pane_id: &str) -> Result<(), MuxError>;
    
    /// Resize a pane
    async fn resize_pane(&self, pane_id: &str, size: PaneSize) -> Result<(), MuxError>;
    
    /// Select (focus) a pane
    async fn select_pane(&self, pane_id: &str) -> Result<(), MuxError>;
    
    /// List all panes in a session
    async fn list_panes(&self, session_id: &str) -> Result<Vec<Pane>, MuxError>;
    
    /// Attach to a session
    async fn attach_session(&self, session_id: &str) -> Result<(), MuxError>;
    
    /// Detach from a session
    async fn detach_session(&self, session_id: &str) -> Result<(), MuxError>;
}

/// Optional extended capabilities that some backends may support
#[async_trait]
pub trait MuxBackendExt: MuxBackend {
    /// Set resource limits for a pane (muxd only)
    async fn set_resource_limits(&self, _pane_id: &str, _limits: ResourceLimits) -> Result<(), MuxError> {
        Err(MuxError::NotSupported("Resource limits not supported by this backend".to_string()))
    }
    
    /// Subscribe to pane events (muxd only)
    async fn subscribe_events(&self, _pane_id: &str) -> Result<EventStream, MuxError> {
        Err(MuxError::NotSupported("Event subscription not supported by this backend".to_string()))
    }
    
    /// Get performance metrics for a pane (muxd only)
    async fn get_metrics(&self, _pane_id: &str) -> Result<PaneMetrics, MuxError> {
        Err(MuxError::NotSupported("Metrics not supported by this backend".to_string()))
    }
}

/// Resource limits for a pane (muxd feature)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLimits {
    pub cpu_percent: Option<f32>,
    pub memory_mb: Option<u64>,
    pub io_bandwidth_mb: Option<u64>,
}

/// Event stream for real-time pane updates (muxd feature)
pub type EventStream = tokio::sync::mpsc::Receiver<PaneEvent>;

/// Events that can occur in a pane
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PaneEvent {
    Output(String),
    Resize(PaneSize),
    Exit(i32),
    Error(String),
}

/// Performance metrics for a pane (muxd feature)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaneMetrics {
    pub cpu_usage: f32,
    pub memory_usage_mb: u64,
    pub io_read_bytes: u64,
    pub io_write_bytes: u64,
}