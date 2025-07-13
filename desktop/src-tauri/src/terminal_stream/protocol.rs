// Terminal Stream Protocol
//
// Defines the message types for terminal communication between
// the Rust backend and frontend via IPC.

use serde::{Deserialize, Serialize};

/// Main terminal message wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum TerminalMessage {
    Input(TerminalInput),
    Output(TerminalOutput),
    Control(ControlMessage),
    Status(StatusMessage),
}

/// Input from frontend to terminal
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum TerminalInput {
    /// Regular text input
    Text(String),
    /// Binary data (base64 encoded in JSON)
    Binary(Vec<u8>),
    /// Special key sequences
    SpecialKey(String),
}

/// Output from terminal to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalOutput {
    /// The actual terminal output data (base64 encoded for binary safety)
    pub data: String,
    /// Timestamp of the output
    pub timestamp: chrono::DateTime<chrono::Utc>,
    /// Optional sequence number for ordering
    pub sequence: Option<u64>,
}

/// Control messages for terminal management
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "command", content = "params")]
pub enum ControlMessage {
    /// Resize the terminal
    Resize { rows: u16, cols: u16 },
    /// Change terminal mode
    ModeChange { mode: String },
    /// Terminal gained focus
    Focus,
    /// Terminal lost focus
    Blur,
}

/// Status messages from terminal
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status")]
pub enum StatusMessage {
    /// Terminal is ready
    Ready {
        terminal_id: String,
        rows: u16,
        cols: u16,
    },
    /// Process exited
    Exited {
        terminal_id: String,
        exit_code: Option<i32>,
    },
    /// Error occurred
    Error { terminal_id: String, error: String },
}

/// Terminal creation options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTerminalOptions {
    /// Terminal ID
    pub id: String,
    /// Shell to use (None for default)
    pub shell: Option<String>,
    /// Initial rows
    pub rows: u16,
    /// Initial columns
    pub cols: u16,
    /// Working directory
    pub cwd: Option<String>,
    /// Environment variables
    pub env: Option<std::collections::HashMap<String, String>>,
    /// Initial command to run
    pub command: Option<String>,
}

/// Batch input for performance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchInput {
    pub terminal_id: String,
    pub inputs: Vec<TerminalInput>,
}

/// Terminal metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalMetadata {
    pub id: String,
    pub title: String,
    pub shell: String,
    pub rows: u16,
    pub cols: u16,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub last_activity: chrono::DateTime<chrono::Utc>,
    pub process_id: Option<u32>,
}

impl TerminalInput {
    /// Create text input
    pub fn text(text: impl Into<String>) -> Self {
        Self::Text(text.into())
    }

    /// Create special key input
    pub fn key(key: impl Into<String>) -> Self {
        Self::SpecialKey(key.into())
    }

    /// Create paste input (handles large text efficiently)
    pub fn paste(text: impl Into<String>) -> Self {
        // For paste, we might want to send as binary to handle special chars
        let text = text.into();
        Self::Binary(text.as_bytes().to_vec())
    }
}
