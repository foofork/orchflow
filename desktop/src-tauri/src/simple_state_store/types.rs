// Database entity types and structures

use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Session {
    pub id: String,
    pub name: String,
    pub tmux_session: Option<String>,
    pub created_at: NaiveDateTime,
    pub last_active: NaiveDateTime,
    pub metadata: Option<String>, // JSON
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Pane {
    pub id: String,
    pub session_id: String,
    pub tmux_pane: Option<String>,
    pub pane_type: String,        // 'editor', 'terminal', 'repl'
    pub content: Option<String>,  // scrollback cache
    pub metadata: Option<String>, // JSON
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Layout {
    pub id: String,
    pub session_id: String,
    pub name: String,
    pub layout_data: String, // JSON of GridLayout
    pub is_active: bool,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Module {
    pub id: String,
    pub name: String,
    pub version: String,
    pub manifest: String, // JSON manifest
    pub installed_at: NaiveDateTime,
    pub enabled: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct KeyValue {
    pub key: String,
    pub value: String,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

// Helper structs for operations
#[derive(Debug)]
pub struct CreateSession {
    pub name: String,
    pub tmux_session: Option<String>,
    pub metadata: Option<String>,
}

#[derive(Debug)]
pub struct UpdateSession {
    pub name: Option<String>,
    pub tmux_session: Option<String>,
    pub metadata: Option<String>,
    pub last_active: Option<NaiveDateTime>,
}

#[derive(Debug)]
pub struct CreatePane {
    pub session_id: String,
    pub tmux_pane: Option<String>,
    pub pane_type: String,
    pub content: Option<String>,
    pub metadata: Option<String>,
}

#[derive(Debug)]
pub struct UpdatePane {
    pub tmux_pane: Option<String>,
    pub pane_type: Option<String>,
    pub content: Option<String>,
    pub metadata: Option<String>,
}

#[derive(Debug)]
pub struct CreateLayout {
    pub session_id: String,
    pub name: String,
    pub layout_data: String,
    pub is_active: bool,
}

#[derive(Debug)]
pub struct UpdateLayout {
    pub name: Option<String>,
    pub layout_data: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug)]
pub struct CreateModule {
    pub name: String,
    pub version: String,
    pub manifest: String,
    pub enabled: bool,
}

#[derive(Debug)]
pub struct UpdateModule {
    pub version: Option<String>,
    pub manifest: Option<String>,
    pub enabled: Option<bool>,
}
