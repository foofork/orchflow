use crate::manager::actions::PaneType;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionState {
    pub id: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub pane_ids: Vec<String>,
    pub active_pane_id: Option<String>,
    pub layout: Option<serde_json::Value>,
    pub metadata: std::collections::HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaneState {
    pub id: String,
    pub session_id: String,
    pub pane_type: PaneType,
    pub title: Option<String>,
    pub command: Option<String>,
    pub shell_type: Option<String>,
    pub working_dir: Option<String>,
    pub backend_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub width: u32,
    pub height: u32,
    pub x: u32,
    pub y: u32,
    pub active: bool,
    pub metadata: std::collections::HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StateEvent {
    // Session events
    SessionCreated {
        session: SessionState,
    },
    SessionUpdated {
        session: SessionState,
    },
    SessionDeleted {
        session_id: String,
    },

    // Pane events
    PaneCreated {
        pane: PaneState,
    },
    PaneUpdated {
        pane: PaneState,
    },
    PaneDeleted {
        pane_id: String,
    },

    // Layout events
    LayoutChanged {
        session_id: String,
        layout: serde_json::Value,
    },

    // Settings events
    SettingsChanged {
        key: String,
        value: serde_json::Value,
    },
}
