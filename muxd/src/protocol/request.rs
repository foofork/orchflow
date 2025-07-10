use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::protocol::types::PaneSize;

/// Session creation request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSessionRequest {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub working_dir: Option<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
}

/// Session list request (empty params)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListSessionsRequest {}

/// Session deletion request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteSessionRequest {
    pub session_id: String,
}

/// Pane creation request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePaneRequest {
    pub session_id: String,
    #[serde(default = "default_pane_type")]
    pub pane_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub working_dir: Option<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<PaneSize>,
}

fn default_pane_type() -> String {
    "terminal".to_string()
}

/// Write data to pane request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WritePaneRequest {
    pub pane_id: String,
    pub data: String,
}

/// Resize pane request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResizePaneRequest {
    pub pane_id: String,
    pub size: PaneSize,
}

/// Read pane output request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadPaneRequest {
    pub pane_id: String,
    #[serde(default = "default_lines")]
    pub lines: usize,
    #[serde(default = "default_from")]
    pub from: ReadPosition,
}

fn default_lines() -> usize {
    100
}

fn default_from() -> ReadPosition {
    ReadPosition::End
}

/// Position to read from
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ReadPosition {
    Start,
    End,
    Cursor,
}

/// Kill pane request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KillPaneRequest {
    pub pane_id: String,
}

/// Set layout request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetLayoutRequest {
    pub session_id: String,
    pub layout: LayoutNode,
}

/// Layout node definition
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum LayoutNode {
    Pane { pane_id: String },
    Split {
        direction: SplitDirection,
        ratio: f32,
        children: Vec<LayoutNode>,
    },
}

/// Split direction
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SplitDirection {
    Horizontal,
    Vertical,
}

/// Subscribe to events request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscribeRequest {
    pub events: Vec<String>,
}

/// Unsubscribe from events request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnsubscribeRequest {
    pub events: Vec<String>,
}

/// Update pane title request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatePaneTitleRequest {
    pub pane_id: String,
    pub title: Option<String>,
}

/// Update pane working directory request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatePaneWorkingDirRequest {
    pub pane_id: String,
    pub working_dir: Option<String>,
}

/// Search pane output request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchPaneRequest {
    pub pane_id: String,
    pub query: String,
    #[serde(default)]
    pub case_sensitive: bool,
    #[serde(default)]
    pub regex: bool,
    #[serde(default = "default_max_results")]
    pub max_results: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start_line: Option<usize>,
}

fn default_max_results() -> usize {
    100
}

/// Save state request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveStateRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_ids: Option<Vec<String>>,
}

/// Restore state request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestoreStateRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_ids: Option<Vec<String>>,
    #[serde(default)]
    pub restart_commands: bool,
}