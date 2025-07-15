//! # OrchFlow Core
//!
//! A transport-agnostic orchestration engine for managing terminal sessions,
//! panes, and plugins with an event-driven architecture.
//!
//! ## Architecture
//!
//! The core is designed to be independent of any specific UI framework or
//! transport mechanism. It provides:
//!
//! - **Manager**: The main orchestration engine that coordinates all operations
//! - **State Management**: Persistent state management with event notifications
//! - **Plugin System**: Extensible plugin architecture for custom functionality
//! - **Backend Abstraction**: Support for different terminal multiplexers (tmux, etc.)
//! - **Event System**: Reactive event-driven architecture for real-time updates
//!
//! ## Usage Example
//!
//! ```rust,no_run
//! use orchflow_core::{Manager, storage::MemoryStore, state::StateManager};
//! use std::sync::Arc;
//!
//! # async fn example() -> Result<(), Box<dyn std::error::Error>> {
//! // Create a storage backend
//! let store = Arc::new(MemoryStore::new());
//!
//! // Create state manager
//! let state_manager = StateManager::new(store);
//!
//! // Create a backend (implement the MuxBackend trait)
//! // let backend = Arc::new(MyBackend::new());
//!
//! // Create the manager
//! // let manager = Manager::new(backend, state_manager);
//!
//! // Execute actions
//! // let result = manager.execute_action(Action::CreateSession {
//! //     name: "main".to_string(),
//! // }).await?;
//! # Ok(())
//! # }
//! ```

pub mod backend;
pub mod error;
pub mod manager;
pub mod state;
pub mod storage;

// Re-export main types
pub use backend::{MuxBackend, PaneInfo, SessionInfo, WindowInfo};
pub use error::{OrchflowError, Result};
pub use manager::{
    Action, CommandHistory, Event, FileManager, Manager, ManagerBuilder, PaneType, Plugin,
    PluginContext, PluginInfo, PluginMetadata, SearchProvider, ShellType,
};
pub use state::{PaneState, SessionState, StateEvent, StateManager};
pub use storage::{MemoryStore, StateStore};

#[cfg(test)]
mod tests;
