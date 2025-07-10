// Terminal State Management
//
// Tracks the state of each terminal including cursor position,
// mode, and other terminal-specific information.

use serde::{Serialize, Deserialize};
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalState {
    pub id: String,
    pub rows: u16,
    pub cols: u16,
    pub cursor: CursorPosition,
    pub mode: TerminalMode,
    pub title: String,
    pub working_dir: Option<String>,
    pub process_info: Option<ProcessInfo>,
    pub active: bool,
    pub last_activity: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
pub struct CursorPosition {
    pub x: u16,
    pub y: u16,
    pub visible: bool,
    pub blinking: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TerminalMode {
    Normal,
    Insert,
    Visual,
    Command,
    Search,
    Raw,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub command: String,
    pub cpu_usage: f32,
    pub memory_usage: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSelection {
    pub start: CursorPosition,
    pub end: CursorPosition,
    pub mode: SelectionMode,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SelectionMode {
    Character,
    Word,
    Line,
    Block,
}

impl TerminalState {
    pub fn new(id: String, rows: u16, cols: u16) -> Self {
        Self {
            id,
            rows,
            cols,
            cursor: CursorPosition::default(),
            mode: TerminalMode::Normal,
            title: "Terminal".to_string(),
            working_dir: None,
            process_info: None,
            active: true,
            last_activity: chrono::Utc::now(),
        }
    }
    
    /// Update cursor position
    pub fn set_cursor(&mut self, x: u16, y: u16) {
        self.cursor.x = x.min(self.cols - 1);
        self.cursor.y = y.min(self.rows - 1);
        self.update_activity();
    }
    
    /// Move cursor relatively
    pub fn move_cursor(&mut self, dx: i16, dy: i16) {
        let new_x = (self.cursor.x as i16 + dx).max(0).min(self.cols as i16 - 1) as u16;
        let new_y = (self.cursor.y as i16 + dy).max(0).min(self.rows as i16 - 1) as u16;
        self.set_cursor(new_x, new_y);
    }
    
    /// Resize terminal
    pub fn resize(&mut self, rows: u16, cols: u16) {
        self.rows = rows;
        self.cols = cols;
        // Adjust cursor if needed
        if self.cursor.x >= cols {
            self.cursor.x = cols - 1;
        }
        if self.cursor.y >= rows {
            self.cursor.y = rows - 1;
        }
        self.update_activity();
    }
    
    /// Change terminal mode
    pub fn set_mode(&mut self, mode: TerminalMode) {
        self.mode = mode;
        self.update_activity();
    }
    
    /// Update last activity timestamp
    pub fn update_activity(&mut self) {
        self.last_activity = chrono::Utc::now();
    }
    
    /// Set terminal title
    pub fn set_title(&mut self, title: String) {
        self.title = title;
    }
    
    /// Update process info
    pub fn update_process_info(&mut self, info: ProcessInfo) {
        self.process_info = Some(info);
        self.update_activity();
    }
}

/// Terminal state manager for multiple terminals
pub struct TerminalStateManager {
    states: Arc<RwLock<std::collections::HashMap<String, TerminalState>>>,
}

impl TerminalStateManager {
    pub fn new() -> Self {
        Self {
            states: Arc::new(RwLock::new(std::collections::HashMap::new())),
        }
    }
    
    /// Add a new terminal state
    pub async fn add_terminal(&self, state: TerminalState) {
        self.states.write().await.insert(state.id.clone(), state);
    }
    
    /// Get terminal state
    pub async fn get_terminal(&self, id: &str) -> Option<TerminalState> {
        self.states.read().await.get(id).cloned()
    }
    
    /// Update terminal state
    pub async fn update_terminal<F>(&self, id: &str, updater: F) -> Result<(), String>
    where
        F: FnOnce(&mut TerminalState),
    {
        let mut states = self.states.write().await;
        if let Some(state) = states.get_mut(id) {
            updater(state);
            Ok(())
        } else {
            Err(format!("Terminal {} not found", id))
        }
    }
    
    /// Remove terminal state
    pub async fn remove_terminal(&self, id: &str) -> Option<TerminalState> {
        self.states.write().await.remove(id)
    }
    
    /// Get all terminal states
    pub async fn get_all_terminals(&self) -> Vec<TerminalState> {
        self.states.read().await.values().cloned().collect()
    }
    
    /// Get active terminal count
    pub async fn active_count(&self) -> usize {
        self.states.read().await.values().filter(|s| s.active).count()
    }
}

impl Default for TerminalMode {
    fn default() -> Self {
        Self::Normal
    }
}