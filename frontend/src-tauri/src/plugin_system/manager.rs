use crate::error::{OrchflowError, Result};
use crate::manager::Orchestrator;
use crate::plugin_system::{
    Plugin, PluginApi, PluginContext, PluginLoader, PluginManifest, PluginState,
    api::PluginStorage,
};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

/// Plugin manager responsible for plugin lifecycle
pub struct PluginManager {
    /// Plugin loader
    loader: PluginLoader,
    /// Active plugins
    plugins: Arc<RwLock<HashMap<String, Arc<RwLock<Box<dyn Plugin>>>>>>,
    /// Plugin contexts
    contexts: Arc<RwLock<HashMap<String, PluginContext>>>,
    /// Orchestrator reference
    orchestrator: Arc<RwLock<Orchestrator>>,
    /// Plugin directory
    plugin_dir: PathBuf,
    /// Event subscriptions
    event_subscriptions: Arc<RwLock<HashMap<String, Vec<String>>>>,
}

impl PluginManager {
    /// Create a new plugin manager
    pub fn new(orchestrator: Arc<RwLock<Orchestrator>>, plugin_dir: PathBuf) -> Self {
        let loader = PluginLoader::new(plugin_dir.clone());
        
        Self {
            loader,
            plugins: Arc::new(RwLock::new(HashMap::new())),
            contexts: Arc::new(RwLock::new(HashMap::new())),
            orchestrator,
            plugin_dir,
            event_subscriptions: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    /// Initialize plugin system
    pub async fn initialize(&self) -> Result<()> {
        info!("Initializing plugin system");
        
        // Ensure plugin directory exists
        tokio::fs::create_dir_all(&self.plugin_dir).await?;
        
        // Load all plugins
        let plugin_ids = self.loader.scan_and_load().await?;
        
        // Activate plugins with onStartup activation event
        for plugin_id in plugin_ids {
            if self.should_auto_activate(&plugin_id).await {
                if let Err(e) = self.activate_plugin(&plugin_id).await {
                    error!("Failed to activate plugin {}: {}", plugin_id, e);
                }
            }
        }
        
        Ok(())
    }
    
    /// Check if plugin should be auto-activated
    async fn should_auto_activate(&self, plugin_id: &str) -> bool {
        // TODO: Check manifest for activation events
        false
    }
    
    /// Install a plugin from path
    pub async fn install_plugin(&self, plugin_path: &Path) -> Result<String> {
        info!("Installing plugin from {:?}", plugin_path);
        
        // Load manifest to get plugin ID
        let manifest_path = plugin_path.join("plugin.json");
        let manifest = PluginManifest::from_file(&manifest_path).await?;
        
        // Check if plugin is already installed
        if self.plugins.read().await.contains_key(&manifest.id) {
            return Err(OrchflowError::Plugin {
                plugin_id: manifest.id.clone(),
                reason: "Plugin already installed".to_string(),
            });
        }
        
        // Copy plugin to plugin directory
        let dest_path = self.plugin_dir.join(&manifest.id);
        self.copy_dir_recursive(plugin_path, &dest_path).await?;
        
        // Load the plugin
        let plugin_id = self.loader.load_plugin(&dest_path).await?;
        
        info!("Installed plugin: {}", plugin_id);
        Ok(plugin_id)
    }
    
    /// Uninstall a plugin
    pub async fn uninstall_plugin(&self, plugin_id: &str) -> Result<()> {
        info!("Uninstalling plugin: {}", plugin_id);
        
        // Deactivate if active
        if let Some(plugin) = self.plugins.read().await.get(plugin_id) {
            let plugin_lock = plugin.read().await;
            if plugin_lock.metadata().state == PluginState::Active {
                drop(plugin_lock);
                self.deactivate_plugin(plugin_id).await?;
            }
        }
        
        // Remove from memory
        self.plugins.write().await.remove(plugin_id);
        self.contexts.write().await.remove(plugin_id);
        
        // Remove from disk
        let plugin_path = self.plugin_dir.join(plugin_id);
        if plugin_path.exists() {
            tokio::fs::remove_dir_all(plugin_path).await?;
        }
        
        info!("Uninstalled plugin: {}", plugin_id);
        Ok(())
    }
    
    /// Activate a plugin
    pub async fn activate_plugin(&self, plugin_id: &str) -> Result<()> {
        info!("Activating plugin: {}", plugin_id);
        
        // Get plugin from loader
        let plugin = self.loader.get_plugin(plugin_id).await
            .ok_or_else(|| OrchflowError::Plugin {
                plugin_id: plugin_id.to_string(),
                reason: "Plugin not found".to_string(),
            })?;
        
        // Create plugin context
        let mut storage = PluginStorage::new(plugin_id.to_string());
        storage.load().await?;
        
        let context = PluginContext {
            plugin_id: plugin_id.to_string(),
            orchestrator: self.manager.clone(),
            storage: Arc::new(RwLock::new(storage)),
            api: PluginApi::new(self.manager.clone()),
        };
        
        // Store context
        self.contexts.write().await.insert(plugin_id.to_string(), context.clone());
        
        // Activate plugin
        let plugin_rw = Arc::new(RwLock::new(plugin));
        plugin_rw.write().await.activate().await?;
        
        // Store activated plugin
        self.plugins.write().await.insert(plugin_id.to_string(), plugin_rw);
        
        info!("Activated plugin: {}", plugin_id);
        Ok(())
    }
    
    /// Deactivate a plugin
    pub async fn deactivate_plugin(&self, plugin_id: &str) -> Result<()> {
        info!("Deactivating plugin: {}", plugin_id);
        
        let plugin = self.plugins.read().await
            .get(plugin_id)
            .cloned()
            .ok_or_else(|| OrchflowError::Plugin {
                plugin_id: plugin_id.to_string(),
                reason: "Plugin not active".to_string(),
            })?;
        
        // Deactivate plugin
        plugin.write().await.deactivate().await?;
        
        // Save storage
        if let Some(context) = self.contexts.read().await.get(plugin_id) {
            context.storage.write().await.save().await?;
        }
        
        // Remove from active plugins
        self.plugins.write().await.remove(plugin_id);
        self.contexts.write().await.remove(plugin_id);
        
        // Remove event subscriptions
        self.event_subscriptions.write().await.remove(plugin_id);
        
        info!("Deactivated plugin: {}", plugin_id);
        Ok(())
    }
    
    /// Get plugin info
    pub async fn get_plugin_info(&self, plugin_id: &str) -> Result<PluginInfo> {
        let plugins = self.plugins.read().await;
        let plugin = plugins.get(plugin_id)
            .ok_or_else(|| OrchflowError::Plugin {
                plugin_id: plugin_id.to_string(),
                reason: "Plugin not found".to_string(),
            })?;
        
        let plugin_lock = plugin.read().await;
        let metadata = plugin_lock.metadata();
        
        Ok(PluginInfo {
            id: metadata.id.clone(),
            name: metadata.name.clone(),
            version: metadata.version.clone(),
            description: metadata.description.clone(),
            author: metadata.author.clone(),
            state: metadata.state,
            error: metadata.error.clone(),
        })
    }
    
    /// List all plugins
    pub async fn list_plugins(&self) -> Vec<PluginInfo> {
        let mut all_plugins = Vec::new();
        
        // Get loaded plugins from loader
        let loaded = self.loader.get_plugins().await;
        for info in loaded {
            all_plugins.push(PluginInfo {
                id: info.id,
                name: info.name,
                version: info.version,
                description: String::new(),
                author: String::new(),
                state: info.state,
                error: info.error,
            });
        }
        
        // Override with active plugin info
        let active_plugins = self.plugins.read().await;
        for (id, plugin) in active_plugins.iter() {
            let plugin_lock = plugin.read().await;
            let metadata = plugin_lock.metadata();
            
            // Find and update in list
            if let Some(info) = all_plugins.iter_mut().find(|p| p.id == *id) {
                info.name = metadata.name.clone();
                info.version = metadata.version.clone();
                info.description = metadata.description.clone();
                info.author = metadata.author.clone();
                info.state = metadata.state;
                info.error = metadata.error.clone();
            }
        }
        
        all_plugins
    }
    
    /// Execute plugin command
    pub async fn execute_command(
        &self,
        plugin_id: &str,
        command: &str,
        args: serde_json::Value,
    ) -> Result<serde_json::Value> {
        let plugins = self.plugins.read().await;
        let plugin = plugins.get(plugin_id)
            .ok_or_else(|| OrchflowError::Plugin {
                plugin_id: plugin_id.to_string(),
                reason: "Plugin not found".to_string(),
            })?;
        
        let plugin_lock = plugin.read().await;
        plugin_lock.handle_command(command, args).await
    }
    
    /// Handle activation event
    pub async fn handle_activation_event(&self, event: &str) -> Result<()> {
        debug!("Handling activation event: {}", event);
        
        // Get all plugins that subscribe to this event
        let plugins_to_activate = self.get_plugins_for_event(event).await;
        
        for plugin_id in plugins_to_activate {
            if !self.plugins.read().await.contains_key(&plugin_id) {
                if let Err(e) = self.activate_plugin(&plugin_id).await {
                    error!("Failed to activate plugin {} for event {}: {}", plugin_id, event, e);
                }
            }
        }
        
        Ok(())
    }
    
    /// Get plugins that should be activated for an event
    async fn get_plugins_for_event(&self, event: &str) -> Vec<String> {
        // TODO: Check plugin manifests for activation events
        Vec::new()
    }
    
    /// Subscribe plugin to events
    pub async fn subscribe_to_events(&self, plugin_id: &str, events: Vec<String>) -> Result<()> {
        let mut subscriptions = self.event_subscriptions.write().await;
        subscriptions.insert(plugin_id.to_string(), events);
        Ok(())
    }
    
    /// Emit event to plugins
    pub async fn emit_event(&self, event: &str, data: serde_json::Value) -> Result<()> {
        let subscriptions = self.event_subscriptions.read().await;
        let plugins = self.plugins.read().await;
        
        for (plugin_id, events) in subscriptions.iter() {
            if events.contains(&event.to_string()) {
                if let Some(plugin) = plugins.get(plugin_id) {
                    let plugin_lock = plugin.read().await;
                    if let Err(e) = plugin_lock.handle_command("onEvent", serde_json::json!({
                        "event": event,
                        "data": data
                    })).await {
                        error!("Plugin {} failed to handle event {}: {}", plugin_id, event, e);
                    }
                }
            }
        }
        
        Ok(())
    }
    
    /// Copy directory recursively
    async fn copy_dir_recursive(&self, src: &Path, dst: &Path) -> Result<()> {
        tokio::fs::create_dir_all(dst).await?;
        
        let mut entries = tokio::fs::read_dir(src).await?;
        while let Some(entry) = entries.next_entry().await? {
            let src_path = entry.path();
            let dst_path = dst.join(entry.file_name());
            
            if src_path.is_dir() {
                self.copy_dir_recursive(&src_path, &dst_path).await?;
            } else {
                tokio::fs::copy(&src_path, &dst_path).await?;
            }
        }
        
        Ok(())
    }
}

/// Plugin information
#[derive(Debug, Clone, serde::Serialize)]
pub struct PluginInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub state: PluginState,
    pub error: Option<String>,
}

/// Plugin event
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PluginEvent {
    pub event_type: String,
    pub plugin_id: String,
    pub data: serde_json::Value,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}