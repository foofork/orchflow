// State management data types

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use crate::layout::GridLayout;

// ===== Core State Types =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionState {
    pub id: String,
    pub name: String,
    pub panes: Vec<String>,
    pub active_pane: Option<String>,
    pub layout: Option<GridLayout>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaneState {
    pub id: String,
    pub session_id: String,
    pub backend_id: Option<String>, // tmux pane ID or muxd pane ID
    pub pane_type: PaneType,
    pub title: String,
    pub working_dir: Option<String>,
    pub command: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PaneType {
    Terminal,
    Editor,
    FileTree,
    Output,
    Custom(String),
}

// ===== State Events =====

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StateEvent {
    // Session events
    SessionCreated { session: SessionState },
    SessionUpdated { session: SessionState },
    SessionDeleted { session_id: String },
    
    // Pane events
    PaneCreated { pane: PaneState },
    PaneUpdated { pane: PaneState },
    PaneDeleted { pane_id: String },
    
    // Layout events
    LayoutUpdated { session_id: String, layout: GridLayout },
    LayoutReset { session_id: String },
}

impl std::fmt::Display for StateEvent {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StateEvent::SessionCreated { session } => write!(f, "SessionCreated({})", session.name),
            StateEvent::SessionUpdated { session } => write!(f, "SessionUpdated({})", session.name),
            StateEvent::SessionDeleted { session_id } => write!(f, "SessionDeleted({})", session_id),
            StateEvent::PaneCreated { pane } => write!(f, "PaneCreated({})", pane.id),
            StateEvent::PaneUpdated { pane } => write!(f, "PaneUpdated({})", pane.id),
            StateEvent::PaneDeleted { pane_id } => write!(f, "PaneDeleted({})", pane_id),
            StateEvent::LayoutUpdated { session_id, .. } => write!(f, "LayoutUpdated({})", session_id),
            StateEvent::LayoutReset { session_id } => write!(f, "LayoutReset({})", session_id),
        }
    }
}

impl SessionState {
    pub fn new(id: String, name: String) -> Self {
        let now = Utc::now();
        Self {
            id,
            name,
            panes: Vec::new(),
            active_pane: None,
            layout: None,
            created_at: now,
            updated_at: now,
        }
    }
    
    pub fn add_pane(&mut self, pane_id: String) {
        if !self.panes.contains(&pane_id) {
            self.panes.push(pane_id.clone());
            if self.active_pane.is_none() {
                self.active_pane = Some(pane_id);
            }
            self.updated_at = Utc::now();
        }
    }
    
    pub fn remove_pane(&mut self, pane_id: &str) {
        self.panes.retain(|id| id != pane_id);
        if self.active_pane.as_ref() == Some(&pane_id.to_string()) {
            self.active_pane = self.panes.first().cloned();
        }
        self.updated_at = Utc::now();
    }
    
    pub fn set_active_pane(&mut self, pane_id: String) {
        if self.panes.contains(&pane_id) {
            self.active_pane = Some(pane_id);
            self.updated_at = Utc::now();
        }
    }
    
    pub fn update_layout(&mut self, layout: GridLayout) {
        self.layout = Some(layout);
        self.updated_at = Utc::now();
    }
}

impl PaneState {
    pub fn new(
        id: String,
        session_id: String,
        pane_type: PaneType,
        backend_id: Option<String>,
    ) -> Self {
        Self {
            id,
            session_id,
            backend_id,
            pane_type,
            title: "New Pane".to_string(),
            working_dir: None,
            command: None,
            created_at: Utc::now(),
        }
    }
    
    pub fn set_title(&mut self, title: String) {
        self.title = title;
    }
    
    pub fn set_working_dir(&mut self, working_dir: Option<String>) {
        self.working_dir = working_dir;
    }
    
    pub fn set_command(&mut self, command: Option<String>) {
        self.command = command;
    }
}