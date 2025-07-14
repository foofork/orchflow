// Manager module - Core infrastructure management for orchflow
//
// This module is organized into several submodules for clarity:
// - actions: Action enum and type definitions
// - execution: Action execution and processing
// - plugins: Plugin management functionality
// - events: Event system and dispatching
// - commands: Tauri command handlers
// - handlers: Individual action handlers by domain

pub mod actions;
pub mod commands;
pub mod events;
pub mod execution;
pub mod handlers;
pub mod plugins;

// Re-export commonly used types
pub use actions::{Action, PaneType, ShellType};
pub use commands::*;
pub use events::Event;
pub use plugins::{Plugin, PluginContext, PluginInfo, PluginMetadata}; // Re-export all Tauri commands

use crate::command_history::CommandHistory;
use crate::file_watcher::{AdvancedFileWatcher, FileWatchConfig};
use crate::mux_backend::MuxBackend;
use crate::project_search::ProjectSearch;
use crate::state_manager::{StateEvent, StateManager};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::AppHandle;
use tokio::sync::{broadcast, mpsc, RwLock};

// ===== The Manager =====

pub struct Manager {
    // Unified state management - SINGLE SOURCE OF TRUTH
    pub state_manager: StateManager,

    // Infrastructure
    pub mux_backend: Arc<Box<dyn MuxBackend>>,
    pub(crate) app_handle: AppHandle,

    // File management
    pub file_manager: Option<Arc<crate::file_manager::FileManager>>,
    pub file_watcher: Option<Arc<RwLock<AdvancedFileWatcher>>>,
    pub project_search: Option<Arc<ProjectSearch>>,
    pub command_history: Arc<CommandHistory>,
    pub terminal_searcher: Arc<RwLock<Option<Arc<crate::terminal_search::TerminalSearcher>>>>,

    // Plugin system
    pub(crate) plugins: Arc<RwLock<HashMap<String, Arc<tokio::sync::Mutex<Box<dyn Plugin>>>>>>,
    pub(crate) plugin_subscriptions: Arc<RwLock<HashMap<String, Vec<String>>>>,

    // Event system
    pub event_tx: broadcast::Sender<Event>,
    pub(crate) action_tx: mpsc::Sender<(Action, mpsc::Sender<Result<Value, String>>)>,
}

impl Manager {
    /// Create new manager with a MuxBackend
    pub fn new_with_backend(
        app_handle: AppHandle,
        mux_backend: Box<dyn MuxBackend>,
        store: Arc<crate::simple_state_store::SimpleStateStore>,
    ) -> Self {
        let (event_tx, _) = broadcast::channel(1024);
        let (action_tx, mut action_rx) = mpsc::channel(100);

        // Create state manager
        let state_manager = StateManager::new(store.clone());

        // Initialize file manager if project path exists
        let project_path = crate::app_dirs::AppDirs::new()
            .ok()
            .and_then(|dirs| dirs.data_dir())
            .and_then(|p| p.parent().map(|p| p.to_path_buf()));

        let file_manager = project_path
            .as_ref()
            .map(|path| Arc::new(crate::file_manager::FileManager::new(path.clone())));

        // Initialize file watcher with project path
        let file_watcher = if project_path.is_some() {
            match AdvancedFileWatcher::new(FileWatchConfig::default()) {
                Ok(watcher) => Some(Arc::new(RwLock::new(watcher))),
                Err(e) => {
                    eprintln!("Failed to create file watcher: {}", e);
                    None
                }
            }
        } else {
            None
        };

        // Initialize project search
        let project_search = project_path.map(|path| Arc::new(ProjectSearch::new(path)));

        // Initialize command history
        let command_history = Arc::new(CommandHistory::new(store.clone()));

        // Initialize as empty, will be set after manager is created
        let terminal_searcher = Arc::new(RwLock::new(None));

        let manager = Self {
            state_manager,
            mux_backend: Arc::new(mux_backend),
            app_handle,
            file_manager,
            file_watcher,
            project_search,
            command_history,
            terminal_searcher,
            plugins: Arc::new(RwLock::new(HashMap::new())),
            plugin_subscriptions: Arc::new(RwLock::new(HashMap::new())),
            event_tx,
            action_tx,
        };

        // Start action processor
        let orch = manager.clone();
        tokio::spawn(async move {
            while let Some((action, reply_tx)) = action_rx.recv().await {
                let result = orch.process_action(action).await;
                let _ = reply_tx.send(result).await;
            }
        });

        // Bridge state events to manager events
        let state_event_rx = manager.state_manager.subscribe();
        let orch = manager.clone();
        tokio::spawn(async move {
            let mut rx = state_event_rx;
            while let Ok(state_event) = rx.recv().await {
                orch.handle_state_event(state_event).await;
            }
        });

        // Start plugin event dispatcher
        let mut event_rx = manager.event_tx.subscribe();
        let orch = manager.clone();
        tokio::spawn(async move {
            while let Ok(event) = event_rx.recv().await {
                orch.dispatch_event_to_plugins(&event).await;
            }
        });

        // Trigger command history migration in background
        let store_clone = store.clone();
        tokio::spawn(async move {
            match store_clone.migrate_command_history_from_keyvalue().await {
                Ok(count) if count > 0 => {
                    tracing::info!("Successfully migrated {} command history entries", count);
                }
                Ok(_) => {
                    tracing::debug!("No command history entries to migrate");
                }
                Err(e) => {
                    tracing::error!("Failed to migrate command history: {}", e);
                }
            }
        });

        manager
    }

    /// Initialize terminal searcher after manager is created
    pub async fn initialize_terminal_searcher(self: &Arc<Self>) {
        let terminal_searcher =
            Arc::new(crate::terminal_search::TerminalSearcher::new(self.clone()));
        let mut searcher_lock = self.terminal_searcher.write().await;
        *searcher_lock = Some(terminal_searcher);
    }

    /// Execute an action
    pub async fn execute_action(&self, action: Action) -> Result<Value, String> {
        execution::execute_action(self, action).await
    }

    // Internal action processor
    pub(crate) async fn process_action(&self, action: Action) -> Result<Value, String> {
        execution::process_action(self, action).await
    }

    /// Subscribe a plugin to specific event types
    pub async fn subscribe_plugin(
        &self,
        plugin_id: &str,
        events: Vec<String>,
    ) -> Result<(), String> {
        let mut subscriptions = self.plugin_subscriptions.write().await;
        subscriptions.insert(plugin_id.to_string(), events);
        Ok(())
    }

    /// Emit an event
    pub fn emit_event(&self, event: Event) {
        let _ = self.event_tx.send(event);
    }

    // Handle state events from StateManager
    async fn handle_state_event(&self, event: StateEvent) {
        use events::Event;

        match event {
            StateEvent::SessionCreated { session } => {
                self.emit_event(Event::SessionCreated { session });
            }
            StateEvent::SessionUpdated { session } => {
                self.emit_event(Event::SessionUpdated { session });
            }
            StateEvent::SessionDeleted { session_id } => {
                self.emit_event(Event::SessionDeleted { session_id });
            }
            StateEvent::PaneCreated { pane } => {
                self.emit_event(Event::PaneCreated { pane });
            }
            _ => {} // Handle other state events as needed
        }
    }

    /// Dispatch an event to all plugins
    async fn dispatch_event_to_plugins(&self, event: &Event) {
        plugins::dispatch_event_to_plugins(self, event).await;
    }
}

// Make it cloneable for Tauri state management
impl Clone for Manager {
    fn clone(&self) -> Self {
        Self {
            state_manager: self.state_manager.clone(),
            mux_backend: self.mux_backend.clone(),
            app_handle: self.app_handle.clone(),
            file_manager: self.file_manager.clone(),
            file_watcher: self.file_watcher.clone(),
            project_search: self.project_search.clone(),
            command_history: self.command_history.clone(),
            terminal_searcher: self.terminal_searcher.clone(),
            plugins: self.plugins.clone(),
            plugin_subscriptions: self.plugin_subscriptions.clone(),
            event_tx: self.event_tx.clone(),
            action_tx: self.action_tx.clone(),
        }
    }
}
