use crate::state::{PaneState, SessionState};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Event {
    // System events
    OrchestratorStarted,
    OrchestratorStopping,

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
    PaneOutput {
        pane_id: String,
        output: String,
    },
    PaneClosed {
        pane_id: String,
    },
    PaneDestroyed {
        pane_id: String,
    },
    PaneFocused {
        pane_id: String,
    },
    PaneResized {
        pane_id: String,
        width: u32,
        height: u32,
    },

    // File events
    FileOpened {
        path: String,
        pane_id: String,
    },
    FileSaved {
        path: String,
    },
    FileChanged {
        path: String,
    },
    FileWatchStarted {
        path: String,
        recursive: bool,
    },
    FileWatchStopped {
        path: String,
    },
    FileWatchEvent {
        path: String,
        kind: FileWatchEventKind,
    },

    // Command events
    CommandExecuted {
        pane_id: String,
        command: String,
    },
    CommandCompleted {
        pane_id: String,
        exit_code: i32,
    },

    // Plugin events
    PluginLoaded {
        id: String,
    },
    PluginUnloaded {
        id: String,
    },
    PluginError {
        id: String,
        error: String,
    },

    // Custom events
    Custom {
        event_type: String,
        data: serde_json::Value,
    },

    // File read event
    FileRead {
        path: String,
        size: usize,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FileWatchEventKind {
    Created,
    Modified,
    Deleted,
    Renamed { from: String, to: String },
}
