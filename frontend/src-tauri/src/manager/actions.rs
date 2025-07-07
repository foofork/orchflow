// Action definitions for the Manager

use serde::{Deserialize, Serialize};
use serde_json::Value;

// ===== Action Types =====

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Action {
    // Session management
    CreateSession { 
        name: String 
    },
    DeleteSession { 
        session_id: String 
    },
    SaveSession {
        session_id: String,
        name: Option<String>,
    },
    
    // Pane management
    CreatePane {
        session_id: String,
        pane_type: PaneType,
        command: Option<String>,
        shell_type: Option<ShellType>,
        name: Option<String>,
    },
    ClosePane { 
        pane_id: String 
    },
    ResizePane { 
        pane_id: String, 
        width: u32, 
        height: u32 
    },
    RenamePane {
        pane_id: String,
        name: String,
    },
    
    // File management
    CreateFile { 
        path: String, 
        content: Option<String> 
    },
    OpenFile { 
        path: String 
    },
    CreateDirectory { 
        path: String 
    },
    DeletePath { 
        path: String, 
        permanent: bool 
    },
    RenamePath { 
        old_path: String, 
        new_name: String 
    },
    CopyPath { 
        source: String, 
        destination: String 
    },
    MovePath { 
        source: String, 
        destination: String 
    },
    MoveFiles {
        files: Vec<String>,
        destination: String,
    },
    CopyFiles {
        files: Vec<String>,
        destination: String,
    },
    GetFileTree {
        path: Option<String>,
        max_depth: Option<u32>,
    },
    SearchFiles {
        pattern: String,
        path: Option<String>,
    },
    
    // Search
    SearchProject { 
        pattern: String, 
        options: Value 
    },
    SearchInFile { 
        file_path: String, 
        pattern: String 
    },
    
    // Terminal operations
    SendKeys { 
        pane_id: String, 
        keys: String 
    },
    RunCommand { 
        pane_id: String, 
        command: String 
    },
    GetPaneOutput { 
        pane_id: String, 
        lines: Option<u32> 
    },
    
    // Plugin management
    LoadPlugin { 
        id: String, 
        config: Value 
    },
    UnloadPlugin { 
        id: String 
    },
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ShellType {
    Bash,
    Zsh,
    Fish,
    PowerShell,
    Cmd,
    Custom(String),
}

impl ShellType {
    pub fn detect() -> Self {
        if cfg!(target_os = "windows") {
            ShellType::PowerShell
        } else {
            // Try to detect from SHELL env var
            match std::env::var("SHELL") {
                Ok(shell) if shell.contains("zsh") => ShellType::Zsh,
                Ok(shell) if shell.contains("bash") => ShellType::Bash,
                Ok(shell) if shell.contains("fish") => ShellType::Fish,
                _ => ShellType::Bash, // Default fallback
            }
        }
    }
}