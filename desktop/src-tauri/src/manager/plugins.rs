// Plugin management for the Manager

use super::{Event, Manager};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

// ===== Plugin Trait =====

#[async_trait]
pub trait Plugin: Send + Sync {
    /// Get the plugin's unique ID
    fn id(&self) -> &str;

    /// Get the plugin's metadata
    fn metadata(&self) -> PluginMetadata;

    /// Initialize the plugin
    async fn init(&mut self, context: PluginContext) -> Result<(), String>;

    /// Handle an event
    async fn handle_event(&mut self, event: &Event) -> Result<(), String>;

    /// Handle a custom JSON-RPC request
    async fn handle_request(&mut self, method: &str, _params: Value) -> Result<Value, String> {
        Err(format!("Unknown method: {}", method))
    }

    /// Shutdown the plugin
    async fn shutdown(&mut self) -> Result<(), String>;
}

// ===== Plugin Types =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginMetadata {
    pub name: String,
    pub version: String,
    pub author: String,
    pub description: String,
    pub capabilities: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    pub description: String,
    pub capabilities: Vec<String>,
    pub loaded: bool,
}

#[derive(Clone)]
pub struct PluginContext {
    pub manager: Arc<Manager>,
    pub plugin_id: String,
}

impl PluginContext {
    /// Execute an action
    pub async fn execute(&self, action: super::Action) -> Result<Value, String> {
        self.manager.execute_action(action).await
    }

    /// Subscribe to specific event types
    pub async fn subscribe(&self, events: Vec<String>) -> Result<(), String> {
        self.manager.subscribe_plugin(&self.plugin_id, events).await
    }
}

// ===== Plugin Management Methods =====

impl Manager {
    /// Load a plugin
    pub async fn load_plugin(&self, mut plugin: Box<dyn Plugin>) -> Result<(), String> {
        let plugin_id = plugin.id().to_string();
        let context = PluginContext {
            manager: Arc::new(self.clone()),
            plugin_id: plugin_id.clone(),
        };

        // Initialize plugin
        plugin.init(context).await?;

        // Store plugin
        let mut plugins = self.plugins.write().await;
        plugins.insert(plugin_id.clone(), Arc::new(tokio::sync::Mutex::new(plugin)));

        // Emit event
        self.emit_event(Event::PluginLoaded { id: plugin_id });

        Ok(())
    }

    /// Process file watch events and emit them
    pub async fn process_file_watch_events(&self) {
        if let Some(file_watcher) = &self.file_watcher {
            let watcher = file_watcher.read().await;
            let events = watcher.process_events().await;

            for event in events {
                self.emit_event(Event::FileWatchEvent { event });
            }
        }
    }
}

/// Dispatch an event to all plugins
pub(super) async fn dispatch_event_to_plugins(manager: &Manager, event: &Event) {
    let plugins = manager.plugins.read().await;
    let subscriptions = manager.plugin_subscriptions.read().await;

    // Get event type as string for subscription matching
    let event_type = match event {
        Event::OrchestratorStarted => "orchestrator_started",
        Event::OrchestratorStopping => "orchestrator_stopping",
        Event::SessionCreated { .. } => "session_created",
        Event::SessionUpdated { .. } => "session_updated",
        Event::SessionDeleted { .. } => "session_deleted",
        Event::PaneCreated { .. } => "pane_created",
        Event::PaneOutput { .. } => "pane_output",
        Event::PaneClosed { .. } => "pane_closed",
        Event::PaneDestroyed { .. } => "pane_destroyed",
        Event::PaneFocused { .. } => "pane_focused",
        Event::PaneResized { .. } => "pane_resized",
        Event::FileOpened { .. } => "file_opened",
        Event::FileSaved { .. } => "file_saved",
        Event::FileChanged { .. } => "file_changed",
        Event::FileWatchStarted { .. } => "file_watch_started",
        Event::FileWatchStopped { .. } => "file_watch_stopped",
        Event::FileWatchEvent { .. } => "file_watch_event",
        Event::CommandExecuted { .. } => "command_executed",
        Event::CommandCompleted { .. } => "command_completed",
        Event::PluginLoaded { .. } => "plugin_loaded",
        Event::PluginUnloaded { .. } => "plugin_unloaded",
        Event::PluginError { .. } => "plugin_error",
        Event::Custom { event_type, .. } => event_type.as_str(),
        Event::FileRead { .. } => "file_read",
    };

    // Dispatch to subscribed plugins
    for (plugin_id, plugin) in plugins.iter() {
        // Check if plugin is subscribed to this event type
        if let Some(events) = subscriptions.get(plugin_id) {
            if events.contains(&event_type.to_string()) || events.contains(&"*".to_string()) {
                // Clone the plugin reference to avoid holding the lock
                let plugin_id_clone = plugin_id.clone();
                let plugin_clone = Arc::clone(plugin);
                let event_clone = event.clone();
                let event_type_clone = event_type.to_string();

                // Dispatch event in a separate task to avoid blocking
                tokio::spawn(async move {
                    let mut plugin_guard = plugin_clone.lock().await;
                    if let Err(e) = plugin_guard.handle_event(&event_clone).await {
                        eprintln!(
                            "Plugin {} error handling event {}: {}",
                            plugin_id_clone, event_type_clone, e
                        );
                    }
                });
            }
        }
    }
}
