use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tokio::fs;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModuleManifest {
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub entry_point: String, // Main script file
    pub module_type: ModuleType,
    pub dependencies: Vec<ModuleDependency>,
    pub permissions: Vec<Permission>,
    pub config_schema: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum ModuleType {
    Agent,    // Provides new agent types
    Command,  // Adds commands
    Layout,   // Custom layouts
    Theme,    // UI themes
    Language, // Language support
    Tool,     // Development tools
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModuleDependency {
    pub name: String,
    pub version: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Permission {
    FileSystem, // Access to file system
    Network,    // Network requests
    Process,    // Spawn processes
    Terminal,   // Terminal access
    Editor,     // Editor control
    State,      // State store access
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleConfig {
    pub enabled: bool,
    pub settings: HashMap<String, serde_json::Value>,
}

#[derive(Debug)]
pub struct LoadedModule {
    pub manifest: ModuleManifest,
    #[cfg_attr(not(feature = "dev-unused"), allow(dead_code))]
    pub path: PathBuf,
    pub config: ModuleConfig,
    pub instance: Option<Box<dyn Module>>,
}

#[async_trait]
pub trait Module: Send + Sync + std::fmt::Debug {
    /// Initialize the module
    #[cfg_attr(not(feature = "dev-unused"), allow(dead_code))]
    async fn init(&mut self) -> Result<(), String>;

    /// Execute a command provided by this module
    async fn execute(&self, command: &str, args: Vec<String>) -> Result<String, String>;

    /// Get available commands
    #[cfg_attr(not(feature = "dev-unused"), allow(dead_code))]
    fn get_commands(&self) -> Vec<String>;

    /// Cleanup when module is unloaded
    #[cfg_attr(not(feature = "dev-unused"), allow(dead_code))]
    async fn cleanup(&mut self) -> Result<(), String>;
}

pub struct ModuleLoader {
    modules_dir: PathBuf,
    loaded_modules: HashMap<String, LoadedModule>,
    state_store: std::sync::Arc<crate::simple_state_store::SimpleStateStore>,
}

impl ModuleLoader {
    pub fn new(
        modules_dir: PathBuf,
        state_store: std::sync::Arc<crate::simple_state_store::SimpleStateStore>,
    ) -> Self {
        Self {
            modules_dir,
            loaded_modules: HashMap::new(),
            state_store,
        }
    }

    /// Scan modules directory and load all modules
    pub async fn scan_modules(&mut self) -> Result<Vec<String>, String> {
        // Ensure modules directory exists
        fs::create_dir_all(&self.modules_dir)
            .await
            .map_err(|e| format!("Failed to create modules directory: {}", e))?;

        let mut loaded = Vec::new();

        // Read directory entries
        let mut entries = fs::read_dir(&self.modules_dir)
            .await
            .map_err(|e| format!("Failed to read modules directory: {}", e))?;

        while let Some(entry) = entries
            .next_entry()
            .await
            .map_err(|e| format!("Failed to read directory entry: {}", e))?
        {
            let path = entry.path();
            if path.is_dir() {
                // Try to load module from this directory
                match self.load_module_from_dir(&path).await {
                    Ok(name) => loaded.push(name),
                    Err(e) => eprintln!("Failed to load module from {:?}: {}", path, e),
                }
            }
        }

        Ok(loaded)
    }

    /// Load a module from a directory
    async fn load_module_from_dir(&mut self, dir: &Path) -> Result<String, String> {
        // Read manifest
        let manifest_path = dir.join("manifest.json");
        let manifest_content = fs::read_to_string(&manifest_path)
            .await
            .map_err(|e| format!("Failed to read manifest: {}", e))?;

        let manifest: ModuleManifest = serde_json::from_str(&manifest_content)
            .map_err(|e| format!("Failed to parse manifest: {}", e))?;

        // Check if module is already in database
        let db_module = self
            .state_store
            .list_modules()
            .await
            .map_err(|e| e.to_string())?
            .into_iter()
            .find(|m| m.name == manifest.name);

        // Load or create config
        let config = if let Some(db_module) = db_module {
            // Parse stored config
            serde_json::from_str(&db_module.manifest).unwrap_or_else(|_| ModuleConfig {
                enabled: true,
                settings: HashMap::new(),
            })
        } else {
            // Create default config
            ModuleConfig {
                enabled: true,
                settings: HashMap::new(),
            }
        };

        // Create loaded module
        let loaded_module = LoadedModule {
            manifest: manifest.clone(),
            path: dir.to_path_buf(),
            config,
            instance: None, // Will be initialized on demand
        };

        // Store in memory
        let name = manifest.name.clone();
        self.loaded_modules.insert(name.clone(), loaded_module);

        // Update database
        self.state_store
            .install_module(crate::simple_state_store::CreateModule {
                name: manifest.name.clone(),
                version: manifest.version.clone(),
                manifest: serde_json::to_string(&manifest).unwrap(),
                enabled: true,
            })
            .await
            .map_err(|e| e.to_string())?;

        Ok(name)
    }

    /// Get a loaded module by name
    pub fn get_module(&self, name: &str) -> Option<&LoadedModule> {
        self.loaded_modules.get(name)
    }

    /// List all loaded modules
    pub fn list_modules(&self) -> Vec<&LoadedModule> {
        self.loaded_modules.values().collect()
    }

    /// Enable or disable a module
    pub async fn set_module_enabled(&mut self, name: &str, enabled: bool) -> Result<(), String> {
        if let Some(module) = self.loaded_modules.get_mut(name) {
            module.config.enabled = enabled;

            // Update in database
            let config_json = serde_json::to_string(&module.config).map_err(|e| e.to_string())?;

            self.state_store
                .set_setting(&format!("module.{}.config", name), &config_json)
                .await
                .map_err(|e| e.to_string())?;

            Ok(())
        } else {
            Err("Module not found".to_string())
        }
    }

    /// Execute a module command
    pub async fn execute_command(
        &self,
        module_name: &str,
        command: &str,
        args: Vec<String>,
    ) -> Result<String, String> {
        let module = self
            .get_module(module_name)
            .ok_or_else(|| "Module not found".to_string())?;

        if !module.config.enabled {
            return Err("Module is disabled".to_string());
        }

        if let Some(instance) = &module.instance {
            instance.execute(command, args).await
        } else {
            Err("Module not initialized".to_string())
        }
    }
}

// Example module implementation for JavaScript modules
#[derive(Debug)]
#[cfg_attr(not(feature = "dev-unused"), allow(dead_code))]
pub struct JavaScriptModule {
    manifest: ModuleManifest,
    script_path: PathBuf,
}

#[async_trait]
impl Module for JavaScriptModule {
    async fn init(&mut self) -> Result<(), String> {
        // Initialize JavaScript runtime (could use deno_core or similar)
        Ok(())
    }

    async fn execute(&self, command: &str, args: Vec<String>) -> Result<String, String> {
        // Execute JavaScript function
        // This would integrate with a JS runtime
        Ok(format!("Executed {} with args {:?}", command, args))
    }

    fn get_commands(&self) -> Vec<String> {
        // Return commands exported by the module
        vec![]
    }

    async fn cleanup(&mut self) -> Result<(), String> {
        Ok(())
    }
}

// Tauri commands for module management
#[tauri::command]
pub async fn module_scan(
    loader: tauri::State<'_, std::sync::Arc<tokio::sync::Mutex<ModuleLoader>>>,
) -> Result<Vec<String>, String> {
    let mut loader = loader.lock().await;
    loader.scan_modules().await
}

#[tauri::command]
pub async fn module_list(
    loader: tauri::State<'_, std::sync::Arc<tokio::sync::Mutex<ModuleLoader>>>,
) -> Result<Vec<ModuleManifest>, String> {
    let loader = loader.lock().await;
    Ok(loader
        .list_modules()
        .into_iter()
        .map(|m| m.manifest.clone())
        .collect())
}

#[tauri::command]
pub async fn module_enable(
    name: String,
    enabled: bool,
    loader: tauri::State<'_, std::sync::Arc<tokio::sync::Mutex<ModuleLoader>>>,
) -> Result<(), String> {
    let mut loader = loader.lock().await;
    loader.set_module_enabled(&name, enabled).await
}

#[tauri::command]
pub async fn module_execute(
    module_name: String,
    command: String,
    args: Vec<String>,
    loader: tauri::State<'_, std::sync::Arc<tokio::sync::Mutex<ModuleLoader>>>,
) -> Result<String, String> {
    let loader = loader.lock().await;
    loader.execute_command(&module_name, &command, args).await
}
