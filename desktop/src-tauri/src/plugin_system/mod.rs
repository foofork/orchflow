// Simplified plugin system for initial implementation
// This avoids complex dependencies like deno_core and wasmtime

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::error::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginMetadata {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: PluginAuthor,
    pub permissions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginAuthor {
    pub name: String,
    pub email: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum PluginState {
    Loaded,
    Unloaded,
    Error(String),
}

#[async_trait]
pub trait Plugin: Send + Sync {
    fn metadata(&self) -> &PluginMetadata;
    fn state(&self) -> PluginState;
    async fn activate(&mut self) -> Result<()>;
    async fn deactivate(&mut self) -> Result<()>;
    async fn handle_command(&self, command: &str, args: Value) -> Result<Value>;
}

// Simple built-in plugin implementation for testing
pub struct BuiltinPlugin {
    metadata: PluginMetadata,
    state: PluginState,
    commands: HashMap<String, Box<dyn Fn(Value) -> Result<Value> + Send + Sync>>,
}

impl BuiltinPlugin {
    pub fn new(metadata: PluginMetadata) -> Self {
        Self {
            metadata,
            state: PluginState::Unloaded,
            commands: HashMap::new(),
        }
    }

    pub fn register_command<F>(&mut self, name: &str, handler: F)
    where
        F: Fn(Value) -> Result<Value> + Send + Sync + 'static,
    {
        self.commands.insert(name.to_string(), Box::new(handler));
    }
}

#[async_trait]
impl Plugin for BuiltinPlugin {
    fn metadata(&self) -> &PluginMetadata {
        &self.metadata
    }

    fn state(&self) -> PluginState {
        self.state.clone()
    }

    async fn activate(&mut self) -> Result<()> {
        self.state = PluginState::Loaded;
        Ok(())
    }

    async fn deactivate(&mut self) -> Result<()> {
        self.state = PluginState::Unloaded;
        Ok(())
    }

    async fn handle_command(&self, command: &str, args: Value) -> Result<Value> {
        if let Some(handler) = self.commands.get(command) {
            handler(args)
        } else {
            Err(crate::error::OrchflowError::PluginError {
                plugin_id: self.metadata.id.clone(),
                operation: "handle_command".to_string(),
                reason: format!("Unknown command: {}", command),
            })
        }
    }
}

pub struct PluginManager {
    plugins: Arc<RwLock<HashMap<String, Box<dyn Plugin>>>>,
}

impl PluginManager {
    pub fn new() -> Self {
        Self {
            plugins: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn register_plugin(&self, plugin: Box<dyn Plugin>) -> Result<()> {
        let id = plugin.metadata().id.clone();
        self.plugins.write().await.insert(id, plugin);
        Ok(())
    }

    pub async fn load_plugin(&self, id: &str) -> Result<()> {
        if let Some(plugin) = self.plugins.write().await.get_mut(id) {
            plugin.activate().await?;
        }
        Ok(())
    }

    pub async fn unload_plugin(&self, id: &str) -> Result<()> {
        if let Some(plugin) = self.plugins.write().await.get_mut(id) {
            plugin.deactivate().await?;
        }
        Ok(())
    }

    pub async fn list_plugins(&self) -> Vec<PluginMetadata> {
        self.plugins
            .read()
            .await
            .values()
            .map(|p| p.metadata().clone())
            .collect()
    }

    pub async fn execute_command(
        &self,
        plugin_id: &str,
        command: &str,
        args: Value,
    ) -> Result<Value> {
        let plugins = self.plugins.read().await;
        if let Some(plugin) = plugins.get(plugin_id) {
            plugin.handle_command(command, args).await
        } else {
            Err(crate::error::OrchflowError::PluginNotFound {
                plugin_id: plugin_id.to_string(),
            })
        }
    }
}
