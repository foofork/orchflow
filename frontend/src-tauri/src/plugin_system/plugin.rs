use crate::error::{OrchflowError, Result};
use std::path::PathBuf;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Plugin state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PluginState {
    /// Plugin is installed but not loaded
    Installed,
    /// Plugin is loaded but not activated
    Loaded,
    /// Plugin is active and running
    Active,
    /// Plugin is being deactivated
    Deactivating,
    /// Plugin is disabled
    Disabled,
    /// Plugin encountered an error
    Error,
}

/// Plugin metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginMetadata {
    /// Plugin ID from manifest
    pub id: String,
    /// Plugin name
    pub name: String,
    /// Plugin version
    pub version: String,
    /// Plugin description
    pub description: String,
    /// Plugin author
    pub author: String,
    /// Installation path
    pub path: PathBuf,
    /// Installation date
    pub installed_at: DateTime<Utc>,
    /// Last updated date
    pub updated_at: DateTime<Utc>,
    /// Current state
    pub state: PluginState,
    /// Error message if in error state
    pub error: Option<String>,
}

/// Plugin trait that all plugins must implement
#[async_trait::async_trait]
pub trait Plugin: Send + Sync {
    /// Get plugin metadata
    fn metadata(&self) -> &PluginMetadata;
    
    /// Called when plugin is loaded
    async fn load(&mut self) -> Result<()>;
    
    /// Called when plugin is activated
    async fn activate(&mut self) -> Result<()>;
    
    /// Called when plugin is deactivated
    async fn deactivate(&mut self) -> Result<()>;
    
    /// Called when plugin is unloaded
    async fn unload(&mut self) -> Result<()>;
    
    /// Handle plugin command
    async fn handle_command(&self, command: &str, args: serde_json::Value) -> Result<serde_json::Value>;
    
    /// Get plugin capabilities
    fn capabilities(&self) -> PluginCapabilities;
}

/// Plugin capabilities
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PluginCapabilities {
    /// Can provide completions
    pub completions: bool,
    /// Can provide hover information
    pub hover: bool,
    /// Can provide definitions
    pub definitions: bool,
    /// Can provide references
    pub references: bool,
    /// Can provide code actions
    pub code_actions: bool,
    /// Can provide formatting
    pub formatting: bool,
    /// Can provide symbols
    pub symbols: bool,
    /// Can provide diagnostics
    pub diagnostics: bool,
    /// Custom capabilities
    pub custom: Vec<String>,
}

/// Base plugin implementation
pub struct BasePlugin {
    metadata: PluginMetadata,
    runtime: PluginRuntime,
}

/// Plugin runtime environment
pub enum PluginRuntime {
    /// JavaScript/TypeScript plugin running in V8
    JavaScript {
        isolate: Box<dyn JavaScriptRuntime>,
    },
    /// WebAssembly plugin
    WebAssembly {
        module: Box<dyn WasmModule>,
    },
    /// Native Rust plugin
    Native {
        library: Box<dyn NativeLibrary>,
    },
}

/// JavaScript runtime trait
pub trait JavaScriptRuntime: Send + Sync {
    fn eval(&mut self, code: &str) -> Result<serde_json::Value>;
    fn call_function(&mut self, name: &str, args: &[serde_json::Value]) -> Result<serde_json::Value>;
}

/// WebAssembly module trait
pub trait WasmModule: Send + Sync {
    fn call(&mut self, export: &str, args: &[wasmtime::Val]) -> Result<Vec<wasmtime::Val>>;
}

/// Native library trait
pub trait NativeLibrary: Send + Sync {
    fn call(&self, function: &str, args: serde_json::Value) -> Result<serde_json::Value>;
}

impl BasePlugin {
    /// Create a new plugin
    pub fn new(metadata: PluginMetadata, runtime: PluginRuntime) -> Self {
        Self { metadata, runtime }
    }
    
    /// Execute plugin code
    pub async fn execute(&mut self, code: &str) -> Result<serde_json::Value> {
        match &mut self.runtime {
            PluginRuntime::JavaScript { isolate } => {
                isolate.eval(code)
            }
            PluginRuntime::WebAssembly { .. } => {
                Err(OrchflowError::Plugin {
                    plugin_id: self.metadata.id.clone(),
                    reason: "WebAssembly execution not implemented".to_string(),
                })
            }
            PluginRuntime::Native { .. } => {
                Err(OrchflowError::Plugin {
                    plugin_id: self.metadata.id.clone(),
                    reason: "Native execution not implemented".to_string(),
                })
            }
        }
    }
    
    /// Call a plugin function
    pub async fn call_function(&mut self, name: &str, args: serde_json::Value) -> Result<serde_json::Value> {
        match &mut self.runtime {
            PluginRuntime::JavaScript { isolate } => {
                let args_array = if args.is_array() {
                    args.as_array().unwrap().clone()
                } else {
                    vec![args]
                };
                isolate.call_function(name, &args_array)
            }
            PluginRuntime::WebAssembly { .. } => {
                Err(OrchflowError::Plugin {
                    plugin_id: self.metadata.id.clone(),
                    reason: "WebAssembly function calls not implemented".to_string(),
                })
            }
            PluginRuntime::Native { library } => {
                library.call(name, args)
            }
        }
    }
}

#[async_trait::async_trait]
impl Plugin for BasePlugin {
    fn metadata(&self) -> &PluginMetadata {
        &self.metadata
    }
    
    async fn load(&mut self) -> Result<()> {
        self.metadata.state = PluginState::Loaded;
        Ok(())
    }
    
    async fn activate(&mut self) -> Result<()> {
        // Call plugin's activate function
        self.call_function("activate", serde_json::json!({})).await?;
        self.metadata.state = PluginState::Active;
        Ok(())
    }
    
    async fn deactivate(&mut self) -> Result<()> {
        self.metadata.state = PluginState::Deactivating;
        // Call plugin's deactivate function
        self.call_function("deactivate", serde_json::json!({})).await?;
        self.metadata.state = PluginState::Loaded;
        Ok(())
    }
    
    async fn unload(&mut self) -> Result<()> {
        if self.metadata.state == PluginState::Active {
            self.deactivate().await?;
        }
        self.metadata.state = PluginState::Installed;
        Ok(())
    }
    
    async fn handle_command(&self, command: &str, args: serde_json::Value) -> Result<serde_json::Value> {
        match &self.runtime {
            PluginRuntime::JavaScript { isolate } => {
                // Call command handler in plugin
                let mut isolate = isolate;
                isolate.call_function("handleCommand", &[
                    serde_json::Value::String(command.to_string()),
                    args,
                ])
            }
            PluginRuntime::Native { library } => {
                library.call("handle_command", serde_json::json!({
                    "command": command,
                    "args": args
                }))
            }
            _ => Err(OrchflowError::Plugin {
                plugin_id: self.metadata.id.clone(),
                reason: "Command handling not supported for this plugin type".to_string(),
            })
        }
    }
    
    fn capabilities(&self) -> PluginCapabilities {
        // TODO: Load capabilities from manifest or plugin
        PluginCapabilities::default()
    }
}