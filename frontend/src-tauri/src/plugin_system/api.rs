use crate::error::Result;
use crate::manager::Orchestrator;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

/// Plugin API context provided to plugins
#[derive(Clone)]
pub struct PluginContext {
    /// Plugin ID
    pub plugin_id: String,
    /// Reference to the orchestrator
    pub orchestrator: Arc<RwLock<Orchestrator>>,
    /// Plugin-specific storage
    pub storage: Arc<RwLock<PluginStorage>>,
    /// API instance
    pub api: PluginApi,
}

/// Plugin API for interacting with Orchflow
#[derive(Clone)]
pub struct PluginApi {
    orchestrator: Arc<RwLock<Orchestrator>>,
}

impl PluginApi {
    /// Create a new plugin API instance
    pub fn new(orchestrator: Arc<RwLock<Orchestrator>>) -> Self {
        Self { orchestrator }
    }
    
    /// Window API namespace
    pub fn window(&self) -> WindowApi {
        WindowApi {
            orchestrator: self.manager.clone(),
        }
    }
    
    /// Commands API namespace
    pub fn commands(&self) -> CommandsApi {
        CommandsApi {
            orchestrator: self.manager.clone(),
        }
    }
    
    /// Workspace API namespace
    pub fn workspace(&self) -> WorkspaceApi {
        WorkspaceApi {
            orchestrator: self.manager.clone(),
        }
    }
    
    /// Terminal API namespace
    pub fn terminal(&self) -> TerminalApi {
        TerminalApi {
            orchestrator: self.manager.clone(),
        }
    }
}

/// Window API for UI operations
pub struct WindowApi {
    orchestrator: Arc<RwLock<Orchestrator>>,
}

impl WindowApi {
    /// Show information message
    pub async fn show_information_message(&self, message: &str) -> Result<()> {
        let manager = self.manager.read().await;
        orchestrator.emit_notification("info", message).await
    }
    
    /// Show warning message
    pub async fn show_warning_message(&self, message: &str) -> Result<()> {
        let manager = self.manager.read().await;
        orchestrator.emit_notification("warning", message).await
    }
    
    /// Show error message
    pub async fn show_error_message(&self, message: &str) -> Result<()> {
        let manager = self.manager.read().await;
        orchestrator.emit_notification("error", message).await
    }
    
    /// Show input box
    pub async fn show_input_box(&self, options: InputBoxOptions) -> Result<Option<String>> {
        let manager = self.manager.read().await;
        orchestrator.show_input_dialog(options).await
    }
    
    /// Create terminal
    pub async fn create_terminal(&self, options: TerminalOptions) -> Result<String> {
        let mut orchestrator = self.manager.write().await;
        orchestrator.create_terminal_with_options(options).await
    }
}

/// Commands API for command operations
pub struct CommandsApi {
    orchestrator: Arc<RwLock<Orchestrator>>,
}

impl CommandsApi {
    /// Register a command
    pub async fn register_command<F>(&self, command: &str, handler: F) -> Result<()>
    where
        F: Fn(Vec<serde_json::Value>) -> Result<serde_json::Value> + Send + Sync + 'static,
    {
        let mut orchestrator = self.manager.write().await;
        orchestrator.register_plugin_command(command, Box::new(handler))
    }
    
    /// Execute a command
    pub async fn execute_command(&self, command: &str, args: Vec<serde_json::Value>) -> Result<serde_json::Value> {
        let manager = self.manager.read().await;
        orchestrator.execute_command(command, args).await
    }
    
    /// Get all registered commands
    pub async fn get_commands(&self) -> Result<Vec<String>> {
        let manager = self.manager.read().await;
        Ok(orchestrator.get_registered_commands())
    }
}

/// Workspace API for file operations
pub struct WorkspaceApi {
    orchestrator: Arc<RwLock<Orchestrator>>,
}

impl WorkspaceApi {
    /// Get workspace root path
    pub async fn get_root_path(&self) -> Result<Option<String>> {
        let manager = self.manager.read().await;
        Ok(orchestrator.get_workspace_root())
    }
    
    /// Find files matching pattern
    pub async fn find_files(&self, pattern: &str, exclude: Option<&str>) -> Result<Vec<String>> {
        let manager = self.manager.read().await;
        orchestrator.find_files(pattern, exclude).await
    }
    
    /// Read file contents
    pub async fn read_file(&self, path: &str) -> Result<String> {
        let manager = self.manager.read().await;
        orchestrator.read_file(path).await
    }
    
    /// Write file contents
    pub async fn write_file(&self, path: &str, content: &str) -> Result<()> {
        let mut orchestrator = self.manager.write().await;
        orchestrator.write_file(path, content).await
    }
    
    /// Watch file changes
    pub async fn watch_files(&self, pattern: &str) -> Result<()> {
        let mut orchestrator = self.manager.write().await;
        orchestrator.watch_pattern(pattern).await
    }
}

/// Terminal API for terminal operations
pub struct TerminalApi {
    orchestrator: Arc<RwLock<Orchestrator>>,
}

impl TerminalApi {
    /// Send text to terminal
    pub async fn send_text(&self, terminal_id: &str, text: &str, add_newline: bool) -> Result<()> {
        let mut orchestrator = self.manager.write().await;
        let text = if add_newline {
            format!("{}\n", text)
        } else {
            text.to_string()
        };
        orchestrator.send_to_terminal(terminal_id, &text).await
    }
    
    /// Read terminal output
    pub async fn read_output(&self, terminal_id: &str, lines: usize) -> Result<String> {
        let manager = self.manager.read().await;
        orchestrator.read_terminal_output(terminal_id, lines).await
    }
    
    /// Get active terminal ID
    pub async fn get_active_terminal(&self) -> Result<Option<String>> {
        let manager = self.manager.read().await;
        Ok(orchestrator.get_active_terminal())
    }
    
    /// List all terminals
    pub async fn list_terminals(&self) -> Result<Vec<TerminalInfo>> {
        let manager = self.manager.read().await;
        orchestrator.list_terminals().await
    }
}

/// Plugin storage for persisting data
pub struct PluginStorage {
    plugin_id: String,
    data: std::collections::HashMap<String, serde_json::Value>,
}

impl PluginStorage {
    /// Create new storage for plugin
    pub fn new(plugin_id: String) -> Self {
        Self {
            plugin_id,
            data: std::collections::HashMap::new(),
        }
    }
    
    /// Get value from storage
    pub fn get(&self, key: &str) -> Option<&serde_json::Value> {
        self.data.get(key)
    }
    
    /// Set value in storage
    pub fn set(&mut self, key: String, value: serde_json::Value) {
        self.data.insert(key, value);
    }
    
    /// Remove value from storage
    pub fn remove(&mut self, key: &str) -> Option<serde_json::Value> {
        self.data.remove(key)
    }
    
    /// Clear all storage
    pub fn clear(&mut self) {
        self.data.clear();
    }
    
    /// Save storage to disk
    pub async fn save(&self) -> Result<()> {
        let storage_path = dirs::data_dir()
            .ok_or_else(|| crate::error::OrchflowError::FileOperationError {
                operation: "get_data_dir".to_string(),
                path: "".into(),
                reason: "Could not determine data directory".to_string(),
            })?
            .join("orchflow")
            .join("plugins")
            .join(&self.plugin_id)
            .join("storage.json");
        
        tokio::fs::create_dir_all(storage_path.parent().unwrap()).await?;
        
        let content = serde_json::to_string_pretty(&self.data)?;
        tokio::fs::write(storage_path, content).await?;
        
        Ok(())
    }
    
    /// Load storage from disk
    pub async fn load(&mut self) -> Result<()> {
        let storage_path = dirs::data_dir()
            .ok_or_else(|| crate::error::OrchflowError::FileOperationError {
                operation: "get_data_dir".to_string(),
                path: "".into(),
                reason: "Could not determine data directory".to_string(),
            })?
            .join("orchflow")
            .join("plugins")
            .join(&self.plugin_id)
            .join("storage.json");
        
        if storage_path.exists() {
            let content = tokio::fs::read_to_string(storage_path).await?;
            self.data = serde_json::from_str(&content)?;
        }
        
        Ok(())
    }
}

/// Input box options
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InputBoxOptions {
    /// The prompt to display
    pub prompt: String,
    /// The placeholder text
    #[serde(skip_serializing_if = "Option::is_none")]
    pub placeholder: Option<String>,
    /// The default value
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
    /// Whether the input should be a password
    #[serde(default)]
    pub password: bool,
    /// Validation pattern
    #[serde(skip_serializing_if = "Option::is_none")]
    pub validation_pattern: Option<String>,
}

/// Terminal creation options
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalOptions {
    /// Terminal name
    pub name: String,
    /// Working directory
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    /// Environment variables
    #[serde(default)]
    pub env: std::collections::HashMap<String, String>,
    /// Shell to use
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shell: Option<String>,
}

/// Terminal information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalInfo {
    /// Terminal ID
    pub id: String,
    /// Terminal name
    pub name: String,
    /// Process ID
    pub pid: Option<u32>,
    /// Is active
    pub active: bool,
}