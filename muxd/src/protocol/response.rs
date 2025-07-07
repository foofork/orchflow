use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use std::collections::HashMap;

/// Session creation response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSessionResponse {
    pub session_id: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
}

/// Session info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub session_id: String,
    pub name: String,
    pub pane_count: usize,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Session list response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListSessionsResponse {
    pub sessions: Vec<SessionInfo>,
}

/// Pane creation response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePaneResponse {
    pub pane_id: String,
    pub session_id: String,
    pub pane_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pid: Option<u32>,
}

/// Pane read response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadPaneResponse {
    pub data: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cursor: Option<CursorPosition>,
}

/// Cursor position
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct CursorPosition {
    pub row: u16,
    pub col: u16,
}

/// Generic success response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuccessResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

impl Default for SuccessResponse {
    fn default() -> Self {
        Self {
            success: true,
            message: None,
        }
    }
}

/// Pane info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaneInfo {
    pub pane_id: String,
    pub session_id: String,
    pub pane_type: String,
    pub rows: u16,
    pub cols: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pid: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub working_dir: Option<String>,
}

/// Get pane info response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetPaneInfoResponse {
    pub pane: PaneInfo,
}

/// List panes response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListPanesResponse {
    pub panes: Vec<PaneInfo>,
}

/// Version info response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionResponse {
    pub version: String,
    pub protocol_version: String,
    pub features: Vec<String>,
}