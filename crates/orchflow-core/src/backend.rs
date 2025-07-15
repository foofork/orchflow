// Re-export MuxBackend and related types from orchflow-mux to avoid duplication
pub use orchflow_mux::backend::{MuxBackend, MuxError};

// For backward compatibility, re-export common types from orchflow-mux
pub use orchflow_mux::backend::Pane as PaneInfo;
pub use orchflow_mux::backend::Session as SessionInfo;

// Window info is specific to orchestration layer
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowInfo {
    pub id: String,
    pub name: String,
    pub panes: Vec<PaneInfo>,
}
