use crate::error::{OrchflowError, Result};
use crate::plugin_system::{Plugin, PluginMetadata, PluginState, PluginManifest};
use crate::plugin_system::plugin::{BasePlugin, PluginRuntime};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

/// Plugin loader responsible for loading plugins from disk
pub struct PluginLoader {
    /// Plugin directory
    plugin_dir: PathBuf,
    /// Loaded plugins
    plugins: Arc<RwLock<Vec<Box<dyn Plugin>>>>,
}

impl PluginLoader {
    /// Create a new plugin loader
    pub fn new(plugin_dir: PathBuf) -> Self {
        Self {
            plugin_dir,
            plugins: Arc::new(RwLock::new(Vec::new())),
        }
    }
    
    /// Scan and load all plugins
    pub async fn scan_and_load(&self) -> Result<Vec<String>> {
        info!("Scanning for plugins in {:?}", self.plugin_dir);
        
        // Ensure plugin directory exists
        tokio::fs::create_dir_all(&self.plugin_dir).await?;
        
        let mut loaded_plugins = Vec::new();
        let mut entries = tokio::fs::read_dir(&self.plugin_dir).await?;
        
        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            
            // Skip if not a directory
            if !path.is_dir() {
                continue;
            }
            
            // Try to load plugin
            match self.load_plugin(&path).await {
                Ok(plugin_id) => {
                    loaded_plugins.push(plugin_id);
                }
                Err(e) => {
                    error!("Failed to load plugin from {:?}: {}", path, e);
                }
            }
        }
        
        info!("Loaded {} plugins", loaded_plugins.len());
        Ok(loaded_plugins)
    }
    
    /// Load a single plugin
    pub async fn load_plugin(&self, plugin_path: &Path) -> Result<String> {
        debug!("Loading plugin from {:?}", plugin_path);
        
        // Load manifest
        let manifest_path = plugin_path.join("plugin.json");
        let manifest = PluginManifest::from_file(&manifest_path)
            .await
            .map_err(|e| OrchflowError::Plugin {
                plugin_id: plugin_path.file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string(),
                reason: format!("Failed to load manifest: {}", e),
            })?;
        
        // Validate manifest
        manifest.validate()
            .map_err(|e| OrchflowError::Plugin {
                plugin_id: manifest.id.clone(),
                reason: e,
            })?;
        
        // Check compatibility
        let orchflow_version = semver::Version::parse(env!("CARGO_PKG_VERSION"))
            .unwrap_or(semver::Version::new(1, 0, 0));
        
        if !manifest.is_compatible(&orchflow_version) {
            return Err(OrchflowError::Plugin {
                plugin_id: manifest.id.clone(),
                reason: format!(
                    "Plugin requires Orchflow {}, but current version is {}",
                    manifest.engines.orchflow,
                    orchflow_version
                ),
            });
        }
        
        // Create plugin metadata
        let metadata = PluginMetadata {
            id: manifest.id.clone(),
            name: manifest.name.clone(),
            version: manifest.version.clone(),
            description: manifest.description.clone(),
            author: manifest.author.name.clone(),
            path: plugin_path.to_path_buf(),
            installed_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            state: PluginState::Installed,
            error: None,
        };
        
        // Load plugin based on type
        let main_path = plugin_path.join(&manifest.main);
        let plugin = self.load_plugin_runtime(metadata, &main_path, &manifest).await?;
        
        // Store plugin
        let plugin_id = manifest.id.clone();
        self.plugins.write().await.push(plugin);
        
        info!("Loaded plugin: {} v{}", manifest.name, manifest.version);
        Ok(plugin_id)
    }
    
    /// Load plugin runtime based on file type
    async fn load_plugin_runtime(
        &self,
        metadata: PluginMetadata,
        main_path: &Path,
        manifest: &PluginManifest,
    ) -> Result<Box<dyn Plugin>> {
        let extension = main_path.extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("");
        
        match extension {
            "js" | "mjs" => {
                self.load_javascript_plugin(metadata, main_path, manifest).await
            }
            "wasm" => {
                self.load_wasm_plugin(metadata, main_path, manifest).await
            }
            "so" | "dll" | "dylib" => {
                self.load_native_plugin(metadata, main_path, manifest).await
            }
            _ => {
                Err(OrchflowError::Plugin {
                    plugin_id: metadata.id.clone(),
                    reason: format!("Unsupported plugin type: {}", extension),
                })
            }
        }
    }
    
    /// Load JavaScript plugin
    async fn load_javascript_plugin(
        &self,
        metadata: PluginMetadata,
        main_path: &Path,
        manifest: &PluginManifest,
    ) -> Result<Box<dyn Plugin>> {
        // Read plugin code
        let code = tokio::fs::read_to_string(main_path).await?;
        
        // Create JavaScript runtime
        let runtime = JavaScriptRuntimeImpl::new(manifest.permissions.clone())?;
        
        // Create plugin instance
        let mut plugin = BasePlugin::new(
            metadata,
            PluginRuntime::JavaScript {
                isolate: Box::new(runtime),
            },
        );
        
        // Load plugin code
        plugin.execute(&code).await?;
        
        Ok(Box::new(plugin))
    }
    
    /// Load WebAssembly plugin
    async fn load_wasm_plugin(
        &self,
        metadata: PluginMetadata,
        main_path: &Path,
        manifest: &PluginManifest,
    ) -> Result<Box<dyn Plugin>> {
        // TODO: Implement WASM loading
        Err(OrchflowError::Plugin {
            plugin_id: metadata.id.clone(),
            reason: "WebAssembly plugins not yet supported".to_string(),
        })
    }
    
    /// Load native plugin
    async fn load_native_plugin(
        &self,
        metadata: PluginMetadata,
        main_path: &Path,
        manifest: &PluginManifest,
    ) -> Result<Box<dyn Plugin>> {
        // TODO: Implement native plugin loading
        Err(OrchflowError::Plugin {
            plugin_id: metadata.id.clone(),
            reason: "Native plugins not yet supported".to_string(),
        })
    }
    
    /// Get loaded plugins
    pub async fn get_plugins(&self) -> Vec<PluginInfo> {
        let plugins = self.plugins.read().await;
        plugins.iter().map(|p| {
            let metadata = p.metadata();
            PluginInfo {
                id: metadata.id.clone(),
                name: metadata.name.clone(),
                version: metadata.version.clone(),
                state: metadata.state,
                error: metadata.error.clone(),
            }
        }).collect()
    }
    
    /// Get plugin by ID
    pub async fn get_plugin(&self, plugin_id: &str) -> Option<Arc<dyn Plugin>> {
        let plugins = self.plugins.read().await;
        plugins.iter()
            .find(|p| p.metadata().id == plugin_id)
            .map(|p| Arc::from(p.as_ref()))
    }
}

/// Plugin information
#[derive(Debug, Clone, serde::Serialize)]
pub struct PluginInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub state: PluginState,
    pub error: Option<String>,
}

/// JavaScript runtime implementation using Deno Core
struct JavaScriptRuntimeImpl {
    runtime: deno_core::JsRuntime,
    permissions: Vec<crate::plugin_system::manifest::PluginPermission>,
}

impl JavaScriptRuntimeImpl {
    fn new(permissions: Vec<crate::plugin_system::manifest::PluginPermission>) -> Result<Self> {
        use deno_core::{JsRuntime, RuntimeOptions};
        
        let runtime = JsRuntime::new(RuntimeOptions {
            ..Default::default()
        });
        
        Ok(Self {
            runtime,
            permissions,
        })
    }
}

impl crate::plugin_system::plugin::JavaScriptRuntime for JavaScriptRuntimeImpl {
    fn eval(&mut self, code: &str) -> Result<serde_json::Value> {
        // Execute code in V8 isolate
        let result = self.runtime.execute_script("<plugin>", code)
            .map_err(|e| OrchflowError::Plugin {
                plugin_id: "unknown".to_string(),
                reason: format!("JavaScript execution error: {}", e),
            })?;
        
        // Convert result to JSON
        let scope = &mut self.runtime.handle_scope();
        let local = deno_core::v8::Local::new(scope, result);
        let json_string = deno_core::serde_v8::to_v8(scope, "null")
            .map_err(|e| OrchflowError::Plugin {
                plugin_id: "unknown".to_string(),
                reason: format!("Failed to serialize result: {}", e),
            })?;
        
        Ok(serde_json::Value::Null)
    }
    
    fn call_function(&mut self, name: &str, args: &[serde_json::Value]) -> Result<serde_json::Value> {
        // Serialize arguments
        let args_json = serde_json::to_string(args)?;
        
        // Call function
        let code = format!(
            "JSON.stringify({}({}))",
            name,
            args.iter()
                .map(|arg| serde_json::to_string(arg).unwrap_or_else(|_| "null".to_string()))
                .collect::<Vec<_>>()
                .join(",")
        );
        
        self.eval(&code)
    }
}

// Mock implementations for testing
#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_plugin_loader_creation() {
        let loader = PluginLoader::new(PathBuf::from("/tmp/plugins"));
        assert_eq!(loader.get_plugins().await.len(), 0);
    }
}