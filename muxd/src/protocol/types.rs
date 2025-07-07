use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Pane size specification
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct PaneSize {
    pub rows: u16,
    pub cols: u16,
}

impl Default for PaneSize {
    fn default() -> Self {
        Self { rows: 24, cols: 80 }
    }
}

/// Session ID type
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct SessionId(pub String);

impl SessionId {
    pub fn new() -> Self {
        Self(format!("sess_{}", Uuid::new_v4().to_string().replace("-", "")))
    }
}

impl std::fmt::Display for SessionId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Pane ID type
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct PaneId(pub String);

impl PaneId {
    pub fn new() -> Self {
        Self(format!("pane_{}", Uuid::new_v4().to_string().replace("-", "")))
    }
}

impl std::fmt::Display for PaneId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Pane type enumeration
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PaneType {
    Terminal,
    Custom(String),
}

impl Default for PaneType {
    fn default() -> Self {
        PaneType::Terminal
    }
}

/// Authentication token
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthToken {
    pub token: String,
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Configuration for muxd
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MuxdConfig {
    /// WebSocket port
    pub port: u16,
    
    /// Unix socket path (if enabled)
    pub unix_socket: Option<String>,
    
    /// Maximum sessions per client
    pub max_sessions: usize,
    
    /// Maximum panes per session
    pub max_panes_per_session: usize,
    
    /// Output buffer size per pane (in bytes)
    pub output_buffer_size: usize,
    
    /// Enable authentication
    pub auth_enabled: bool,
    
    /// Log level
    pub log_level: String,
    
    /// Persistence directory
    pub data_dir: String,
}