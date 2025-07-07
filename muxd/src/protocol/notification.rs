use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use std::collections::HashMap;

/// Base notification type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum NotificationType {
    PaneOutput(PaneOutputNotification),
    PaneExit(PaneExitNotification),
    SessionChanged(SessionChangedNotification),
    PaneResized(PaneResizedNotification),
    Error(ErrorNotification),
}

/// Pane output notification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaneOutputNotification {
    pub pane_id: String,
    pub data: String,
    pub timestamp: DateTime<Utc>,
}

/// Pane exit notification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaneExitNotification {
    pub pane_id: String,
    pub exit_code: i32,
    pub timestamp: DateTime<Utc>,
}

/// Session changed notification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionChangedNotification {
    pub session_id: String,
    pub changes: SessionChanges,
}

/// Session changes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionChanges {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_pane: Option<String>,
    #[serde(flatten)]
    pub other: HashMap<String, serde_json::Value>,
}

/// Pane resized notification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaneResizedNotification {
    pub pane_id: String,
    pub rows: u16,
    pub cols: u16,
    pub timestamp: DateTime<Utc>,
}

/// Error notification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorNotification {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<HashMap<String, serde_json::Value>>,
    pub timestamp: DateTime<Utc>,
}

impl NotificationType {
    pub fn method(&self) -> &'static str {
        match self {
            NotificationType::PaneOutput(_) => "pane.output",
            NotificationType::PaneExit(_) => "pane.exit",
            NotificationType::SessionChanged(_) => "session.changed",
            NotificationType::PaneResized(_) => "pane.resized",
            NotificationType::Error(_) => "error",
        }
    }
}