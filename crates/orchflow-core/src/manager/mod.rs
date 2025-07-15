pub mod actions;
pub mod events;
pub mod execution;
pub mod handlers;
pub mod plugins;

pub use actions::{Action, PaneType, ShellType};
pub use events::Event;
pub use plugins::{Plugin, PluginContext, PluginInfo, PluginMetadata};

use crate::backend::MuxBackend;
use crate::error::Result;
use crate::state::StateManager;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, mpsc, RwLock};

// Type alias for complex plugin storage
pub type PluginMap = HashMap<String, Arc<tokio::sync::Mutex<Box<dyn Plugin>>>>;

/// Builder for Manager with optional services
pub struct ManagerBuilder {
    mux_backend: Arc<dyn MuxBackend>,
    state_manager: StateManager,
    file_manager: Option<Arc<dyn FileManager>>,
    search_provider: Option<Arc<dyn SearchProvider>>,
    command_history: Option<Arc<dyn CommandHistory>>,
}

impl ManagerBuilder {
    /// Create a new builder
    pub fn new(mux_backend: Arc<dyn MuxBackend>, state_manager: StateManager) -> Self {
        Self {
            mux_backend,
            state_manager,
            file_manager: None,
            search_provider: None,
            command_history: None,
        }
    }

    /// Set file manager
    pub fn with_file_manager(mut self, file_manager: Arc<dyn FileManager>) -> Self {
        self.file_manager = Some(file_manager);
        self
    }

    /// Set search provider
    pub fn with_search_provider(mut self, search_provider: Arc<dyn SearchProvider>) -> Self {
        self.search_provider = Some(search_provider);
        self
    }

    /// Set command history
    pub fn with_command_history(mut self, command_history: Arc<dyn CommandHistory>) -> Self {
        self.command_history = Some(command_history);
        self
    }

    /// Build the Manager and start background tasks
    pub fn build(self) -> Manager {
        let (event_tx, _) = broadcast::channel(1024);
        let (action_tx, mut action_rx) = mpsc::channel(100);

        let manager = Manager {
            state_manager: self.state_manager,
            mux_backend: self.mux_backend,
            plugins: Arc::new(RwLock::new(HashMap::new())),
            plugin_subscriptions: Arc::new(RwLock::new(HashMap::new())),
            event_tx: event_tx.clone(),
            action_tx: action_tx.clone(),
            file_manager: self.file_manager,
            search_provider: self.search_provider,
            command_history: self.command_history,
        };

        // Start action processor
        let manager_clone = manager.clone();
        tokio::spawn(async move {
            while let Some((action, reply_tx)) = action_rx.recv().await {
                let result = manager_clone.process_action(action).await;
                let _ = reply_tx.send(result).await;
            }
        });

        // Bridge state events to manager events
        let state_event_rx = manager.state_manager.subscribe();
        let manager_clone = manager.clone();
        tokio::spawn(async move {
            let mut rx = state_event_rx;
            while let Ok(state_event) = rx.recv().await {
                manager_clone.handle_state_event(state_event).await;
            }
        });

        // Start plugin event dispatcher
        let mut event_rx = event_tx.subscribe();
        let manager_clone = manager.clone();
        tokio::spawn(async move {
            while let Ok(event) = event_rx.recv().await {
                manager_clone.dispatch_event_to_plugins(&event).await;
            }
        });

        manager
    }
}

/// Core Manager - Transport-agnostic orchestration engine
pub struct Manager {
    // Unified state management
    pub state_manager: StateManager,

    // Backend infrastructure
    pub mux_backend: Arc<dyn MuxBackend>,

    // Plugin system
    pub(crate) plugins: Arc<RwLock<PluginMap>>,
    pub(crate) plugin_subscriptions: Arc<RwLock<HashMap<String, Vec<String>>>>,

    // Event system
    pub event_tx: broadcast::Sender<Event>,
    pub(crate) action_tx: mpsc::Sender<(Action, mpsc::Sender<Result<Value>>)>,

    // Optional services (injected via traits)
    pub file_manager: Option<Arc<dyn FileManager>>,
    pub search_provider: Option<Arc<dyn SearchProvider>>,
    pub command_history: Option<Arc<dyn CommandHistory>>,
}

/// Trait for file management operations
#[async_trait::async_trait]
pub trait FileManager: Send + Sync {
    async fn create_file(&self, path: &str, content: Option<&str>) -> Result<()>;
    async fn read_file(&self, path: &str) -> Result<String>;
    async fn delete_file(&self, path: &str) -> Result<()>;
    async fn rename_file(&self, old_path: &str, new_path: &str) -> Result<()>;
    async fn copy_file(&self, source: &str, destination: &str) -> Result<()>;
    async fn move_file(&self, source: &str, destination: &str) -> Result<()>;
    async fn create_directory(&self, path: &str) -> Result<()>;
    async fn list_directory(&self, path: &str) -> Result<Vec<String>>;
}

/// Trait for search operations
#[async_trait::async_trait]
pub trait SearchProvider: Send + Sync {
    async fn search_project(&self, pattern: &str, options: Value) -> Result<Value>;
    async fn search_in_file(&self, file_path: &str, pattern: &str) -> Result<Value>;
}

/// Trait for command history
#[async_trait::async_trait]
pub trait CommandHistory: Send + Sync {
    async fn add_command(&self, session_id: &str, command: &str) -> Result<()>;
    async fn get_history(&self, session_id: &str, limit: usize) -> Result<Vec<String>>;
    async fn search_history(&self, pattern: &str) -> Result<Vec<String>>;
}

impl Manager {
    /// Create new manager with a MuxBackend and StateManager
    /// For advanced configuration, use ManagerBuilder instead
    pub fn new(mux_backend: Arc<dyn MuxBackend>, state_manager: StateManager) -> Self {
        ManagerBuilder::new(mux_backend, state_manager).build()
    }

    /// Create a builder for advanced configuration
    pub fn builder(
        mux_backend: Arc<dyn MuxBackend>,
        state_manager: StateManager,
    ) -> ManagerBuilder {
        ManagerBuilder::new(mux_backend, state_manager)
    }

    /// Get a reference to the file manager if available
    pub fn file_manager(&self) -> Option<&Arc<dyn FileManager>> {
        self.file_manager.as_ref()
    }

    /// Get a reference to the search provider if available
    pub fn search_provider(&self) -> Option<&Arc<dyn SearchProvider>> {
        self.search_provider.as_ref()
    }

    /// Get a reference to the command history if available
    pub fn command_history(&self) -> Option<&Arc<dyn CommandHistory>> {
        self.command_history.as_ref()
    }

    /// Execute an action
    pub async fn execute_action(&self, action: Action) -> Result<Value> {
        execution::execute_action(self, action).await
    }

    // Internal action processor
    pub(crate) async fn process_action(&self, action: Action) -> Result<Value> {
        execution::process_action(self, action).await
    }

    /// Subscribe a plugin to specific event types
    pub async fn subscribe_plugin(&self, plugin_id: &str, events: Vec<String>) -> Result<()> {
        let mut subscriptions = self.plugin_subscriptions.write().await;
        subscriptions.insert(plugin_id.to_string(), events);
        Ok(())
    }

    /// Emit an event
    pub fn emit_event(&self, event: Event) {
        let _ = self.event_tx.send(event);
    }

    /// Load a plugin
    pub async fn load_plugin(&self, mut plugin: Box<dyn Plugin>) -> Result<()> {
        let plugin_id = plugin.id().to_string();
        let context = PluginContext {
            manager: Arc::new(self.clone()),
            plugin_id: plugin_id.clone(),
        };

        // Initialize plugin
        plugin
            .init(context)
            .await
            .map_err(crate::error::OrchflowError::Plugin)?;

        // Store plugin
        let mut plugins = self.plugins.write().await;
        plugins.insert(plugin_id.clone(), Arc::new(tokio::sync::Mutex::new(plugin)));

        // Emit event
        self.emit_event(Event::PluginLoaded { id: plugin_id });

        Ok(())
    }

    /// Unload a plugin
    pub async fn unload_plugin(&self, plugin_id: &str) -> Result<()> {
        let mut plugins = self.plugins.write().await;
        if let Some(plugin) = plugins.remove(plugin_id) {
            // Shutdown the plugin
            let mut plugin_lock = plugin.lock().await;
            plugin_lock
                .shutdown()
                .await
                .map_err(crate::error::OrchflowError::Plugin)?;

            // Remove plugin subscriptions
            let mut subscriptions = self.plugin_subscriptions.write().await;
            subscriptions.remove(plugin_id);

            self.emit_event(Event::PluginUnloaded {
                id: plugin_id.to_string(),
            });
            Ok(())
        } else {
            Err(crate::error::OrchflowError::NotFound(format!(
                "Plugin not loaded: {plugin_id}"
            )))
        }
    }

    // Handle state events from StateManager
    async fn handle_state_event(&self, event: crate::state::StateEvent) {
        use crate::state::StateEvent;

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

// Make it cloneable for shared ownership
impl Clone for Manager {
    fn clone(&self) -> Self {
        Self {
            state_manager: self.state_manager.clone(),
            mux_backend: self.mux_backend.clone(),
            plugins: self.plugins.clone(),
            plugin_subscriptions: self.plugin_subscriptions.clone(),
            event_tx: self.event_tx.clone(),
            action_tx: self.action_tx.clone(),
            file_manager: self.file_manager.clone(),
            search_provider: self.search_provider.clone(),
            command_history: self.command_history.clone(),
        }
    }
}
