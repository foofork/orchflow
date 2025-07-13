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
    /// Activation events from manifest
    pub activation_events: Vec<String>,
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
            PluginRuntime::WebAssembly { module } => {
                // For WASM, "execution" means calling the main or _start export
                // Try to call _start export if it exists (standard WASM entry point)
                let result = module.call("_start", &[]);
                match result {
                    Ok(_) => Ok(serde_json::Value::Null), // WASM _start doesn't return values
                    Err(_) => {
                        // If _start doesn't exist, try "main"
                        let result = module.call("main", &[]);
                        match result {
                            Ok(_) => Ok(serde_json::Value::Null),
                            Err(_) => {
                                // No standard entry point found, that's okay for some WASM modules
                                Ok(serde_json::json!({"status": "loaded", "message": "WASM module loaded successfully"}))
                            }
                        }
                    }
                }
            }
            PluginRuntime::Native { library } => {
                // For native plugins, "execution" means calling the main or start function
                // Try to call the main entry point
                let result = library.call("main", serde_json::Value::Null);
                match result {
                    Ok(value) => Ok(value),
                    Err(_) => {
                        // If main doesn't exist, try calling start
                        let result = library.call("start", serde_json::Value::Null);
                        match result {
                            Ok(value) => Ok(value),
                            Err(_) => {
                                // No standard entry point found, that's okay for some native plugins
                                Ok(serde_json::json!({"status": "loaded", "message": "Native plugin loaded successfully"}))
                            }
                        }
                    }
                }
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
            PluginRuntime::WebAssembly { module } => {
                // Convert JSON args to WASM values
                // For now, we support basic types (i32, i64, f32, f64)
                let wasm_args = self.json_to_wasm_args(&args)?;
                
                // Call the WASM function
                let results = module.call(name, &wasm_args)?;
                
                // Convert WASM results back to JSON
                self.wasm_results_to_json(results)
            }
            PluginRuntime::Native { library } => {
                library.call(name, args)
            }
        }
    }
    
    /// Convert JSON values to WASM values
    fn json_to_wasm_args(&self, args: &serde_json::Value) -> Result<Vec<wasmtime::Val>> {
        let mut wasm_args = Vec::new();
        
        match args {
            serde_json::Value::Array(arr) => {
                for arg in arr {
                    wasm_args.push(self.json_value_to_wasm(arg)?);
                }
            }
            _ => {
                wasm_args.push(self.json_value_to_wasm(args)?);
            }
        }
        
        Ok(wasm_args)
    }
    
    /// Convert a single JSON value to a WASM value
    fn json_value_to_wasm(&self, value: &serde_json::Value) -> Result<wasmtime::Val> {
        match value {
            serde_json::Value::Number(n) => {
                if let Some(i) = n.as_i64() {
                    if i >= i32::MIN as i64 && i <= i32::MAX as i64 {
                        Ok(wasmtime::Val::I32(i as i32))
                    } else {
                        Ok(wasmtime::Val::I64(i))
                    }
                } else if let Some(f) = n.as_f64() {
                    Ok(wasmtime::Val::F64(f))
                } else {
                    Err(OrchflowError::Plugin {
                        plugin_id: self.metadata.id.clone(),
                        reason: "Invalid number format for WASM".to_string(),
                    })
                }
            }
            serde_json::Value::Bool(b) => Ok(wasmtime::Val::I32(if *b { 1 } else { 0 })),
            _ => Err(OrchflowError::Plugin {
                plugin_id: self.metadata.id.clone(),
                reason: "Unsupported argument type for WASM (only numbers and booleans are supported)".to_string(),
            }),
        }
    }
    
    /// Convert WASM results back to JSON
    fn wasm_results_to_json(&self, results: Vec<wasmtime::Val>) -> Result<serde_json::Value> {
        if results.is_empty() {
            return Ok(serde_json::Value::Null);
        }
        
        if results.len() == 1 {
            return self.wasm_value_to_json(&results[0]);
        }
        
        // Multiple results as array
        let mut json_results = Vec::new();
        for result in results {
            json_results.push(self.wasm_value_to_json(&result)?);
        }
        
        Ok(serde_json::Value::Array(json_results))
    }
    
    /// Convert a single WASM value to JSON
    fn wasm_value_to_json(&self, value: &wasmtime::Val) -> Result<serde_json::Value> {
        match value {
            wasmtime::Val::I32(i) => Ok(serde_json::Value::Number((*i).into())),
            wasmtime::Val::I64(i) => Ok(serde_json::Value::Number((*i).into())),
            wasmtime::Val::F32(f) => {
                if let Some(n) = serde_json::Number::from_f64(*f as f64) {
                    Ok(serde_json::Value::Number(n))
                } else {
                    Ok(serde_json::Value::Null)
                }
            }
            wasmtime::Val::F64(f) => {
                if let Some(n) = serde_json::Number::from_f64(*f) {
                    Ok(serde_json::Value::Number(n))
                } else {
                    Ok(serde_json::Value::Null)
                }
            }
            _ => Err(OrchflowError::Plugin {
                plugin_id: self.metadata.id.clone(),
                reason: "Unsupported WASM return type".to_string(),
            }),
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
        // Load capabilities from plugin metadata or try to query the plugin directly
        let mut capabilities = PluginCapabilities::default();
        
        // Check metadata path for manifest if it exists
        if let Some(parent_dir) = self.metadata.path.parent() {
            let manifest_path = parent_dir.join("plugin.json");
            
            // Try to load manifest synchronously for capabilities
            if let Ok(content) = std::fs::read_to_string(&manifest_path) {
                if let Ok(manifest) = serde_json::from_str::<serde_json::Value>(&content) {
                    // Parse capabilities from manifest contributions
                    if let Some(contributes) = manifest.get("contributes") {
                        // Language providers indicate hover, completions, definitions, etc.
                        if let Some(languages) = contributes.get("languages") {
                            if languages.is_array() && !languages.as_array().unwrap().is_empty() {
                                capabilities.hover = true;
                                capabilities.completions = true;
                                capabilities.definitions = true;
                                capabilities.references = true;
                                capabilities.symbols = true;
                                capabilities.diagnostics = true;
                            }
                        }
                        
                        // Commands indicate code actions
                        if let Some(commands) = contributes.get("commands") {
                            if commands.is_array() && !commands.as_array().unwrap().is_empty() {
                                capabilities.code_actions = true;
                            }
                        }
                        
                        // Check for specific capability declarations
                        if let Some(caps) = contributes.get("capabilities") {
                            if let Some(caps_obj) = caps.as_object() {
                                capabilities.completions = caps_obj.get("completions").and_then(|v| v.as_bool()).unwrap_or(capabilities.completions);
                                capabilities.hover = caps_obj.get("hover").and_then(|v| v.as_bool()).unwrap_or(capabilities.hover);
                                capabilities.definitions = caps_obj.get("definitions").and_then(|v| v.as_bool()).unwrap_or(capabilities.definitions);
                                capabilities.references = caps_obj.get("references").and_then(|v| v.as_bool()).unwrap_or(capabilities.references);
                                capabilities.code_actions = caps_obj.get("codeActions").and_then(|v| v.as_bool()).unwrap_or(capabilities.code_actions);
                                capabilities.formatting = caps_obj.get("formatting").and_then(|v| v.as_bool()).unwrap_or(capabilities.formatting);
                                capabilities.symbols = caps_obj.get("symbols").and_then(|v| v.as_bool()).unwrap_or(capabilities.symbols);
                                capabilities.diagnostics = caps_obj.get("diagnostics").and_then(|v| v.as_bool()).unwrap_or(capabilities.diagnostics);
                                
                                // Parse custom capabilities
                                if let Some(custom) = caps_obj.get("custom") {
                                    if let Some(custom_array) = custom.as_array() {
                                        capabilities.custom = custom_array.iter()
                                            .filter_map(|v| v.as_str())
                                            .map(|s| s.to_string())
                                            .collect();
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        capabilities
    }
}