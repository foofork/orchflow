use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc, broadcast};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager};
use chrono::{DateTime, Utc};
use crate::mux_backend::{MuxBackend, create_mux_backend};
use crate::state_manager::{StateManager, StateEvent, PaneType as StatePaneType};
use crate::file_watcher::{FileWatchConfig, FileWatchEvent, AdvancedFileWatcher};
use crate::project_search::AdvancedSearch;
use crate::command_history::CommandHistory;
use uuid::Uuid;

// ===== Core Types =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub name: String,
    pub panes: Vec<String>,
    pub active_pane: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pane {
    pub id: String,
    pub session_id: String,
    pub pane_type: PaneType,
    pub tmux_id: Option<String>,
    pub title: String,
    pub working_dir: Option<String>,
    pub command: Option<String>,
    pub shell_type: Option<ShellType>,
    pub custom_name: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PaneType {
    Terminal,
    Editor,
    FileTree,
    Output,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ShellType {
    Bash,
    Zsh,
    Fish,
    Nushell,
    Sh,
    Custom(String),
}

impl ShellType {
    /// Get the command to launch this shell
    pub fn command(&self) -> &str {
        match self {
            ShellType::Bash => "bash",
            ShellType::Zsh => "zsh",
            ShellType::Fish => "fish",
            ShellType::Nushell => "nu",
            ShellType::Sh => "sh",
            ShellType::Custom(cmd) => cmd,
        }
    }
    
    /// Detect shell type from environment
    pub fn detect() -> Self {
        if let Ok(shell) = std::env::var("SHELL") {
            if shell.ends_with("/bash") {
                ShellType::Bash
            } else if shell.ends_with("/zsh") {
                ShellType::Zsh
            } else if shell.ends_with("/fish") {
                ShellType::Fish
            } else if shell.ends_with("/nu") {
                ShellType::Nushell
            } else if shell.ends_with("/sh") {
                ShellType::Sh
            } else {
                ShellType::Custom(shell)
            }
        } else {
            ShellType::Bash // Default fallback
        }
    }
}

// ===== Actions (What plugins can do) =====

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Action {
    // Terminal actions
    CreatePane { 
        session_id: String,
        pane_type: PaneType,
        command: Option<String>,
        shell_type: Option<ShellType>,
        name: Option<String>,
    },
    RunCommand { 
        pane_id: String, 
        command: String 
    },
    SendInput {
        pane_id: String,
        data: String
    },
    GetOutput { 
        pane_id: String, 
        lines: Option<usize> 
    },
    RenamePane {
        pane_id: String,
        name: String,
    },
    ClosePane { 
        pane_id: String 
    },
    ResizePane {
        pane_id: String,
        width: u32,
        height: u32,
    },
    
    // File actions
    OpenFile { 
        path: String, 
        pane_id: Option<String> 
    },
    SaveFile { 
        path: String, 
        content: String 
    },
    CreateFile {
        path: String,
        content: Option<String>,
    },
    CreateDirectory {
        path: String,
    },
    DeletePath {
        path: String,
        permanent: bool,
    },
    RenamePath {
        old_path: String,
        new_name: String,
    },
    MoveFiles {
        files: Vec<String>,
        destination: String,
    },
    CopyFiles {
        files: Vec<String>,
        destination: String,
    },
    GetFileTree {
        path: Option<String>,
        max_depth: Option<usize>,
    },
    SearchFiles {
        pattern: String,
        path: Option<String>,
    },
    
    // File watching actions
    StartFileWatcher {
        path: String,
        recursive: bool,
    },
    StopFileWatcher {
        path: String,
    },
    GetWatchedPaths,
    GetFileWatchEvents {
        limit: Option<usize>,
    },
    UpdateFileWatcherConfig {
        config: FileWatchConfig,
    },
    
    // Session actions
    CreateSession { 
        name: String 
    },
    SaveSession { 
        session_id: String 
    },
    RestoreSession { 
        session_id: String 
    },
    
    // Navigation
    FocusPane { 
        pane_id: String 
    },
    NextPane,
    PreviousPane,
    
    // Plugin management
    LoadPlugin { 
        id: String, 
        config: Value 
    },
    UnloadPlugin { 
        id: String 
    },
}

// ===== Events (What plugins can listen to) =====

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Event {
    // Lifecycle events
    OrchestratorStarted,
    OrchestratorStopping,
    
    // Session events
    SessionCreated { session: Session },
    SessionUpdated { session: Session },
    SessionDeleted { session_id: String },
    
    // Pane events
    PaneCreated { pane: Pane },
    PaneOutput { pane_id: String, data: String },
    PaneClosed { pane_id: String },
    PaneDestroyed { pane_id: String },
    PaneFocused { pane_id: String },
    PaneResized { pane_id: String, width: u32, height: u32 },
    
    // File events
    FileOpened { path: String, pane_id: String },
    FileSaved { path: String },
    FileChanged { path: String },
    
    // File watching events
    FileWatchStarted { path: String, recursive: bool },
    FileWatchStopped { path: String },
    FileWatchEvent { event: FileWatchEvent },
    
    // Command events
    CommandExecuted { pane_id: String, command: String },
    CommandCompleted { pane_id: String, exit_code: i32 },
    
    // Plugin events
    PluginLoaded { plugin_id: String },
    PluginUnloaded { plugin_id: String },
    PluginError { plugin_id: String, error: String },
}

// ===== Plugin API =====

#[async_trait::async_trait]
pub trait Plugin: Send + Sync {
    /// Unique identifier for this plugin
    fn id(&self) -> &str;
    
    /// Plugin metadata
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginMetadata {
    pub name: String,
    pub version: String,
    pub author: String,
    pub description: String,
    pub capabilities: Vec<String>,
}

#[derive(Clone)]
pub struct PluginContext {
    pub orchestrator: Arc<Orchestrator>,
    pub plugin_id: String,
}

impl PluginContext {
    /// Execute an action
    pub async fn execute(&self, action: Action) -> Result<Value, String> {
        self.orchestrator.execute_action(action).await
    }
    
    /// Subscribe to specific event types
    pub async fn subscribe(&self, events: Vec<String>) -> Result<(), String> {
        self.orchestrator.subscribe_plugin(&self.plugin_id, events).await
    }
}

// ===== The Orchestrator =====

pub struct Orchestrator {
    // Unified state management - SINGLE SOURCE OF TRUTH
    pub state_manager: StateManager,
    
    // Infrastructure
    pub mux_backend: Arc<Box<dyn MuxBackend>>,
    app_handle: AppHandle,
    
    // File management
    pub file_manager: Option<Arc<crate::file_manager::FileManager>>,
    pub file_watcher: Option<Arc<RwLock<AdvancedFileWatcher>>>,
    pub project_search: Option<Arc<AdvancedSearch>>,
    pub command_history: Arc<CommandHistory>,
    pub terminal_searcher: Arc<RwLock<Option<Arc<crate::terminal_search::TerminalSearcher>>>>,
    
    // Plugin system
    plugins: Arc<RwLock<HashMap<String, Arc<tokio::sync::Mutex<Box<dyn Plugin>>>>>>,
    plugin_subscriptions: Arc<RwLock<HashMap<String, Vec<String>>>>,
    
    // Event system
    pub event_tx: broadcast::Sender<Event>,
    action_tx: mpsc::Sender<(Action, mpsc::Sender<Result<Value, String>>)>,
}

impl Orchestrator {
    /// Create new orchestrator with a MuxBackend
    pub fn new_with_backend(
        app_handle: AppHandle,
        mux_backend: Box<dyn MuxBackend>,
        store: Arc<crate::simple_state_store::SimpleStateStore>,
    ) -> Self {
        let (event_tx, _) = broadcast::channel(1024);
        let (action_tx, mut action_rx) = mpsc::channel(100);
        
        // Create unified state manager
        let state_manager = StateManager::new(store.clone());
        
        // Initialize file manager with project root
        let file_manager = std::env::current_dir()
            .ok()
            .map(|path| Arc::new(crate::file_manager::FileManager::new(path)));
        
        // Initialize file watcher
        let file_watcher = AdvancedFileWatcher::new(
            FileWatchConfig::default()
        ).ok().map(|w| Arc::new(RwLock::new(w)));
        
        // Initialize project search
        let project_search = std::env::current_dir()
            .ok()
            .map(|path| Arc::new(AdvancedSearch::new(path)));
        
        // Initialize command history
        let command_history = Arc::new(CommandHistory::new(store.clone()));
        
        // Initialize as empty, will be set after orchestrator is created
        let terminal_searcher = Arc::new(RwLock::new(None));
        
        let orchestrator = Self {
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
        let orch = orchestrator.clone();
        tokio::spawn(async move {
            while let Some((action, reply_tx)) = action_rx.recv().await {
                let result = orch.process_action(action).await;
                let _ = reply_tx.send(result).await;
            }
        });
        
        // Bridge state events to orchestrator events
        let state_event_rx = orchestrator.state_manager.subscribe();
        let orch = orchestrator.clone();
        tokio::spawn(async move {
            let mut rx = state_event_rx;
            while let Ok(state_event) = rx.recv().await {
                orch.handle_state_event(state_event).await;
            }
        });
        
        // Start plugin event dispatcher
        let mut event_rx = orchestrator.event_tx.subscribe();
        let orch = orchestrator.clone();
        tokio::spawn(async move {
            while let Ok(event) = event_rx.recv().await {
                orch.dispatch_event_to_plugins(&event).await;
            }
        });
        
        orchestrator
    }
    
    /// Initialize terminal searcher after orchestrator is created
    pub async fn initialize_terminal_searcher(self: &Arc<Self>) {
        let terminal_searcher = Arc::new(crate::terminal_search::TerminalSearcher::new(self.clone()));
        let mut searcher_lock = self.terminal_searcher.write().await;
        *searcher_lock = Some(terminal_searcher);
    }
    
    /// Create new orchestrator (backward compatibility - uses default MuxBackend)
    pub fn new(
        app_handle: AppHandle,
        _tmux: Arc<crate::tmux::TmuxManager>, // Keep parameter for compatibility but don't use it
        store: Arc<crate::simple_state_store::SimpleStateStore>,
    ) -> Self {
        // Create default backend (will use tmux)
        let mux_backend = create_mux_backend();
        Self::new_with_backend(app_handle, mux_backend, store)
    }
    
    /// Execute an action and return the result
    pub async fn execute_action(&self, action: Action) -> Result<Value, String> {
        let (reply_tx, mut reply_rx) = mpsc::channel(1);
        self.action_tx.send((action, reply_tx)).await
            .map_err(|_| "Failed to send action")?;
        reply_rx.recv().await
            .ok_or_else(|| "No reply received".to_string())?
    }
    
    /// Process an action (internal)
    async fn process_action(&self, action: Action) -> Result<Value, String> {
        match action {
            Action::CreatePane { session_id, pane_type, command, shell_type, name } => {
                let pane = self.create_pane(&session_id, pane_type, command, shell_type, name).await?;
                Ok(serde_json::to_value(pane).unwrap())
            }
            
            Action::RunCommand { pane_id, command } => {
                self.run_command(&pane_id, &command).await?;
                Ok(serde_json::json!({ "status": "ok" }))
            }
            
            Action::SendInput { pane_id, data } => {
                self.send_input(&pane_id, &data).await?;
                Ok(serde_json::json!({ "status": "ok" }))
            }
            
            Action::GetOutput { pane_id, lines } => {
                let output = self.get_output(&pane_id, lines).await?;
                Ok(serde_json::json!({ "output": output }))
            }
            
            Action::RenamePane { pane_id, name } => {
                self.rename_pane(&pane_id, &name).await?;
                Ok(serde_json::json!({ "status": "ok" }))
            }
            
            Action::CreateSession { name } => {
                let session = self.create_session(name).await?;
                Ok(serde_json::to_value(session).unwrap())
            }
            
            Action::ClosePane { pane_id } => {
                self.close_pane(&pane_id).await?;
                Ok(serde_json::json!({ "status": "ok" }))
            }
            
            Action::ResizePane { pane_id, width, height } => {
                self.resize_pane(&pane_id, width, height).await?;
                Ok(serde_json::json!({ "status": "ok" }))
            }
            
            Action::LoadPlugin { id: _, config: _ } => {
                // Plugin loading would be implemented here
                Ok(serde_json::json!({ "status": "not_implemented" }))
            }
            
            // File management actions
            Action::CreateFile { path, content } => {
                self.handle_create_file(&path, content.as_deref()).await
            }
            
            Action::CreateDirectory { path } => {
                self.handle_create_directory(&path).await
            }
            
            Action::DeletePath { path, permanent } => {
                self.handle_delete_path(&path, permanent).await
            }
            
            Action::RenamePath { old_path, new_name } => {
                self.handle_rename_path(&old_path, &new_name).await
            }
            
            Action::MoveFiles { files, destination } => {
                self.handle_move_files(files, &destination).await
            }
            
            Action::CopyFiles { files, destination } => {
                self.handle_copy_files(files, &destination).await
            }
            
            Action::GetFileTree { path, max_depth } => {
                self.handle_get_file_tree(path.as_deref(), max_depth).await
            }
            
            Action::SearchFiles { pattern, path } => {
                self.handle_search_files(&pattern, path.as_deref()).await
            }
            
            // File watching actions
            Action::StartFileWatcher { path, recursive } => {
                self.handle_start_file_watcher(&path, recursive).await
            }
            
            Action::StopFileWatcher { path } => {
                self.handle_stop_file_watcher(&path).await
            }
            
            Action::GetWatchedPaths => {
                self.handle_get_watched_paths().await
            }
            
            Action::GetFileWatchEvents { limit } => {
                self.handle_get_file_watch_events(limit).await
            }
            
            Action::UpdateFileWatcherConfig { config } => {
                self.handle_update_file_watcher_config(config).await
            }
            
            // ... implement other actions ...
            _ => Err("Action not implemented".to_string()),
        }
    }
    
    /// Handle state events from StateManager and convert to orchestrator events
    async fn handle_state_event(&self, state_event: StateEvent) {
        let orchestrator_event = match state_event {
            StateEvent::SessionCreated { session } => {
                Event::SessionCreated { 
                    session: Session {
                        id: session.id,
                        name: session.name,
                        panes: session.panes,
                        active_pane: session.active_pane,
                        created_at: session.created_at,
                        updated_at: session.updated_at,
                    }
                }
            }
            StateEvent::SessionUpdated { session } => {
                Event::SessionUpdated { 
                    session: Session {
                        id: session.id,
                        name: session.name,
                        panes: session.panes,
                        active_pane: session.active_pane,
                        created_at: session.created_at,
                        updated_at: session.updated_at,
                    }
                }
            }
            StateEvent::SessionDeleted { session_id } => {
                Event::SessionDeleted { session_id }
            }
            StateEvent::PaneCreated { pane } => {
                Event::PaneCreated { 
                    pane: Pane {
                        id: pane.id,
                        session_id: pane.session_id,
                        pane_type: self.convert_pane_type(pane.pane_type),
                        tmux_id: pane.backend_id,
                        title: pane.title,
                        working_dir: pane.working_dir,
                        command: pane.command,
                        shell_type: None, // TODO: Store shell type in StateManager
                        custom_name: None, // TODO: Store custom name in StateManager
                        created_at: pane.created_at,
                    }
                }
            }
            StateEvent::PaneUpdated { pane } => {
                // Convert to generic PaneOutput event for now
                Event::PaneOutput { 
                    pane_id: pane.id,
                    data: format!("Pane updated: {}", pane.title)
                }
            }
            StateEvent::PaneDeleted { pane_id } => {
                Event::PaneClosed { pane_id }
            }
            StateEvent::LayoutUpdated { session_id: _, layout: _ } => {
                // No direct equivalent in orchestrator events
                return;
            }
            StateEvent::LayoutReset { session_id: _ } => {
                // No direct equivalent in orchestrator events
                return;
            }
        };
        
        self.emit_event(orchestrator_event);
    }
    
    /// Convert state manager PaneType to orchestrator PaneType
    fn convert_pane_type(&self, state_pane_type: StatePaneType) -> PaneType {
        match state_pane_type {
            StatePaneType::Terminal => PaneType::Terminal,
            StatePaneType::Editor => PaneType::Editor,
            StatePaneType::FileTree => PaneType::FileTree,
            StatePaneType::Output => PaneType::Output,
            StatePaneType::Custom(name) => PaneType::Custom(name),
        }
    }
    
    /// Emit an event to all interested parties
    pub fn emit_event(&self, event: Event) {
        // Emit to plugins
        let _ = self.event_tx.send(event.clone());
        
        // Emit to frontend via Tauri
        let _ = self.app_handle.emit_all("orchestrator-event", &event);
    }
    
    /// Subscribe a plugin to specific event types
    pub async fn subscribe_plugin(&self, plugin_id: &str, events: Vec<String>) -> Result<(), String> {
        let mut subs = self.plugin_subscriptions.write().await;
        subs.insert(plugin_id.to_string(), events);
        Ok(())
    }
    
    /// Load a plugin
    pub async fn load_plugin(&self, mut plugin: Box<dyn Plugin>) -> Result<(), String> {
        let plugin_id = plugin.id().to_string();
        let context = PluginContext {
            orchestrator: Arc::new(self.clone()),
            plugin_id: plugin_id.clone(),
        };
        
        // Initialize plugin
        plugin.init(context).await?;
        
        // Store plugin wrapped in Arc<Mutex>
        let mut plugins = self.plugins.write().await;
        plugins.insert(plugin_id.clone(), Arc::new(tokio::sync::Mutex::new(plugin)));
        
        // Emit event
        self.emit_event(Event::PluginLoaded { plugin_id });
        
        Ok(())
    }
    
    // ===== Core Orchestrator Methods =====
    
    async fn create_session(&self, name: String) -> Result<Session, String> {
        // Create the session in the backend
        let _backend_session_id = self.mux_backend.create_session(&name).await
            .map_err(|e| e.to_string())?;
        
        // Create session in unified state
        let state_session = self.state_manager.create_session(name).await?;
        
        // Convert to orchestrator Session type for return value
        let session = Session {
            id: state_session.id.clone(),
            name: state_session.name,
            panes: state_session.panes,
            active_pane: state_session.active_pane,
            created_at: state_session.created_at,
            updated_at: state_session.updated_at,
        };
        
        // Events are automatically emitted by StateManager and bridged to orchestrator events
        
        Ok(session)
    }
    
    async fn create_pane(
        &self,
        session_id: &str,
        pane_type: PaneType,
        command: Option<String>,
        shell_type: Option<ShellType>,
        name: Option<String>,
    ) -> Result<Pane, String> {
        // Create the pane in the backend
        let backend_pane_id = self.mux_backend.create_pane(
            session_id, 
            crate::mux_backend::SplitType::None
        ).await
        .map_err(|e| e.to_string())?;
        
        // Convert orchestrator PaneType to state manager PaneType
        let state_pane_type = match pane_type {
            PaneType::Terminal => StatePaneType::Terminal,
            PaneType::Editor => StatePaneType::Editor,
            PaneType::FileTree => StatePaneType::FileTree,
            PaneType::Output => StatePaneType::Output,
            PaneType::Custom(ref name) => StatePaneType::Custom(name.clone()),
        };
        
        // Create pane in unified state
        let state_pane = self.state_manager.create_pane(
            session_id.to_string(),
            state_pane_type,
            Some(backend_pane_id.clone())
        ).await?;
        
        // Determine the actual command to run
        let actual_command = if pane_type == PaneType::Terminal {
            // For terminal panes, use shell type or detect from environment
            let shell = shell_type.clone().unwrap_or_else(ShellType::detect);
            let shell_cmd = shell.command().to_string();
            
            // If there's a command, run it in the shell
            if let Some(cmd) = command {
                // Send the shell command first, then the user command
                self.mux_backend.send_keys(&backend_pane_id, &shell_cmd).await
                    .map_err(|e| e.to_string())?;
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                self.mux_backend.send_keys(&backend_pane_id, &cmd).await
                    .map_err(|e| e.to_string())?;
                Some(cmd)
            } else {
                // Just launch the shell
                self.mux_backend.send_keys(&backend_pane_id, &shell_cmd).await
                    .map_err(|e| e.to_string())?;
                Some(shell_cmd)
            }
        } else {
            // Non-terminal panes just run the command if provided
            if let Some(cmd) = &command {
                self.mux_backend.send_keys(&backend_pane_id, cmd).await
                    .map_err(|e| e.to_string())?;
            }
            command
        };
        
        // Update pane with metadata
        let mut updated_pane = state_pane.clone();
        
        // Set the title based on custom name or command
        updated_pane.title = if let Some(custom_name) = &name {
            custom_name.clone()
        } else if let Some(cmd) = &actual_command {
            format!("Terminal: {}", cmd)
        } else {
            match pane_type {
                PaneType::Terminal => "Terminal".to_string(),
                PaneType::Editor => "Editor".to_string(),
                PaneType::FileTree => "File Browser".to_string(),
                PaneType::Output => "Output".to_string(),
                PaneType::Custom(ref name) => name.clone(),
            }
        };
        
        updated_pane.command = actual_command;
        self.state_manager.update_pane(updated_pane.clone()).await?;
        
        // Convert to orchestrator Pane type for return value
        let pane = Pane {
            id: state_pane.id,
            session_id: state_pane.session_id,
            pane_type: self.convert_pane_type(state_pane.pane_type),
            tmux_id: state_pane.backend_id,
            title: updated_pane.title,
            working_dir: updated_pane.working_dir,
            command: updated_pane.command,
            shell_type: if matches!(pane_type, PaneType::Terminal) { shell_type } else { None },
            custom_name: name,
            created_at: state_pane.created_at,
        };
        
        // Events are automatically emitted by StateManager and bridged to orchestrator events
        
        Ok(pane)
    }
    
    async fn run_command(&self, pane_id: &str, command: &str) -> Result<(), String> {
        // Get the backend pane ID from unified state
        let pane = self.state_manager.get_pane(pane_id).await
            .ok_or("Pane not found")?;
        
        let start_time = Utc::now();
        
        if let Some(backend_id) = &pane.backend_id {
            self.mux_backend.send_keys(backend_id, command).await
                .map_err(|e| e.to_string())?;
        } else {
            return Err("Pane has no backend ID".to_string());
        }
        
        // Track command in history
        let entry = crate::command_history::CommandEntry {
            id: Uuid::new_v4().to_string(),
            pane_id: pane_id.to_string(),
            session_id: pane.session_id.clone(),
            command: command.to_string(),
            timestamp: start_time,
            working_dir: pane.working_dir.clone(),
            exit_code: None, // Will be updated when command completes
            duration_ms: None,
            shell_type: if pane.pane_type == StatePaneType::Terminal {
                Some("bash".to_string())
            } else {
                None
            },
        };
        
        // Save to command history
        if let Err(e) = self.command_history.add_command(entry).await {
            eprintln!("Failed to save command history: {}", e);
        }
        
        self.emit_event(Event::CommandExecuted {
            pane_id: pane_id.to_string(),
            command: command.to_string(),
        });
        Ok(())
    }
    
    async fn send_input(&self, pane_id: &str, data: &str) -> Result<(), String> {
        // Get the backend pane ID from unified state
        let pane = self.state_manager.get_pane(pane_id).await
            .ok_or("Pane not found")?;
        
        if let Some(backend_id) = &pane.backend_id {
            self.mux_backend.send_keys(backend_id, data).await
                .map_err(|e| e.to_string())?;
        } else {
            return Err("Pane has no backend ID".to_string());
        }
        
        Ok(())
    }
    
    async fn close_pane(&self, pane_id: &str) -> Result<(), String> {
        // Get the backend pane ID from unified state
        let pane = self.state_manager.get_pane(pane_id).await
            .ok_or("Pane not found")?;
        
        if let Some(backend_id) = &pane.backend_id {
            self.mux_backend.kill_pane(backend_id).await
                .map_err(|e| e.to_string())?;
        }
        
        // Remove from unified state (also handles session pane list update)
        self.state_manager.delete_pane(pane_id).await?;
        
        // Events are automatically emitted by StateManager and bridged to orchestrator events
        
        Ok(())
    }
    
    async fn resize_pane(&self, pane_id: &str, width: u32, height: u32) -> Result<(), String> {
        // Get the backend pane ID from unified state
        let pane = self.state_manager.get_pane(pane_id).await
            .ok_or("Pane not found")?;
        
        if let Some(backend_id) = &pane.backend_id {
            let size = crate::mux_backend::PaneSize { width, height };
            self.mux_backend.resize_pane(backend_id, size).await
                .map_err(|e| e.to_string())?;
        } else {
            return Err("Pane has no backend ID".to_string());
        }
        
        self.emit_event(Event::PaneResized {
            pane_id: pane_id.to_string(),
            width,
            height,
        });
        
        Ok(())
    }
    
    async fn get_output(&self, pane_id: &str, _lines: Option<usize>) -> Result<String, String> {
        // Get the backend pane ID from unified state
        let pane = self.state_manager.get_pane(pane_id).await
            .ok_or("Pane not found")?;
        
        if let Some(backend_id) = &pane.backend_id {
            self.mux_backend.capture_pane(backend_id).await
                .map_err(|e| e.to_string())
        } else {
            Err("Pane has no backend ID".to_string())
        }
    }
    
    async fn rename_pane(&self, pane_id: &str, name: &str) -> Result<(), String> {
        // Get the pane from unified state
        let mut pane = self.state_manager.get_pane(pane_id).await
            .ok_or("Pane not found")?;
        
        // Update the title
        pane.title = name.to_string();
        
        // Update in state manager
        self.state_manager.update_pane(pane).await?;
        
        // TODO: Emit a PaneRenamed event if needed
        
        Ok(())
    }
    
    // ===== File Management Actions =====
    
    async fn handle_create_file(&self, path: &str, content: Option<&str>) -> Result<Value, String> {
        let file_manager = self.file_manager.as_ref()
            .ok_or("File manager not initialized")?;
        
        file_manager.create_file(std::path::Path::new(path), content).await
            .map_err(|e| e.to_string())?;
        
        self.emit_event(Event::FileOpened {
            path: path.to_string(),
            pane_id: "".to_string(), // TODO: Track which pane opened the file
        });
        
        Ok(serde_json::json!({ "status": "ok", "path": path }))
    }
    
    async fn handle_create_directory(&self, path: &str) -> Result<Value, String> {
        let file_manager = self.file_manager.as_ref()
            .ok_or("File manager not initialized")?;
        
        file_manager.create_directory(std::path::Path::new(path)).await
            .map_err(|e| e.to_string())?;
        
        Ok(serde_json::json!({ "status": "ok", "path": path }))
    }
    
    async fn handle_delete_path(&self, path: &str, permanent: bool) -> Result<Value, String> {
        let file_manager = self.file_manager.as_ref()
            .ok_or("File manager not initialized")?;
        
        file_manager.delete(std::path::Path::new(path), permanent).await
            .map_err(|e| e.to_string())?;
        
        Ok(serde_json::json!({ "status": "ok", "deleted": path }))
    }
    
    async fn handle_rename_path(&self, old_path: &str, new_name: &str) -> Result<Value, String> {
        let file_manager = self.file_manager.as_ref()
            .ok_or("File manager not initialized")?;
        
        file_manager.rename(std::path::Path::new(old_path), new_name).await
            .map_err(|e| e.to_string())?;
        
        let new_path = std::path::Path::new(old_path)
            .parent()
            .map(|p| p.join(new_name))
            .ok_or("Invalid path")?;
        
        Ok(serde_json::json!({ 
            "status": "ok", 
            "old_path": old_path,
            "new_path": new_path.to_string_lossy()
        }))
    }
    
    async fn handle_move_files(&self, files: Vec<String>, destination: &str) -> Result<Value, String> {
        let file_manager = self.file_manager.as_ref()
            .ok_or("File manager not initialized")?;
        
        let paths: Vec<std::path::PathBuf> = files.into_iter()
            .map(std::path::PathBuf::from)
            .collect();
        
        file_manager.move_files(paths, std::path::Path::new(destination)).await
            .map_err(|e| e.to_string())?;
        
        Ok(serde_json::json!({ 
            "status": "ok", 
            "destination": destination 
        }))
    }
    
    async fn handle_copy_files(&self, files: Vec<String>, destination: &str) -> Result<Value, String> {
        let file_manager = self.file_manager.as_ref()
            .ok_or("File manager not initialized")?;
        
        let paths: Vec<std::path::PathBuf> = files.into_iter()
            .map(std::path::PathBuf::from)
            .collect();
        
        file_manager.copy_files(paths, std::path::Path::new(destination)).await
            .map_err(|e| e.to_string())?;
        
        Ok(serde_json::json!({ 
            "status": "ok", 
            "destination": destination 
        }))
    }
    
    async fn handle_get_file_tree(&self, path: Option<&str>, max_depth: Option<usize>) -> Result<Value, String> {
        let file_manager = self.file_manager.as_ref()
            .ok_or("File manager not initialized")?;
        
        // If path is provided, create a new file manager for that path
        let tree = if let Some(p) = path {
            let fm = crate::file_manager::FileManager::new(std::path::PathBuf::from(p));
            fm.build_file_tree(max_depth).await
                .map_err(|e| e.to_string())?
        } else {
            file_manager.build_file_tree(max_depth).await
                .map_err(|e| e.to_string())?
        };
        
        Ok(serde_json::to_value(tree).unwrap())
    }
    
    async fn handle_search_files(&self, pattern: &str, path: Option<&str>) -> Result<Value, String> {
        let file_manager = self.file_manager.as_ref()
            .ok_or("File manager not initialized")?;
        
        let results = file_manager.search_files(
            pattern, 
            path.map(std::path::Path::new)
        ).await
        .map_err(|e| e.to_string())?;
        
        let paths: Vec<String> = results.into_iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect();
        
        Ok(serde_json::json!({
            "pattern": pattern,
            "results": paths,
            "count": paths.len()
        }))
    }
    
    // ===== File Watching Methods =====
    
    async fn handle_start_file_watcher(&self, path: &str, recursive: bool) -> Result<Value, String> {
        let file_watcher = self.file_watcher.as_ref()
            .ok_or("File watcher not initialized")?;
        
        let mut watcher = file_watcher.write().await;
        watcher.watch_path(std::path::Path::new(path)).await
            .map_err(|e| e.to_string())?;
        
        self.emit_event(Event::FileWatchStarted {
            path: path.to_string(),
            recursive,
        });
        
        Ok(serde_json::json!({
            "status": "ok",
            "path": path,
            "recursive": recursive
        }))
    }
    
    async fn handle_stop_file_watcher(&self, path: &str) -> Result<Value, String> {
        let file_watcher = self.file_watcher.as_ref()
            .ok_or("File watcher not initialized")?;
        
        let mut watcher = file_watcher.write().await;
        watcher.watch_path(std::path::Path::new(path)).await
            .map_err(|e| e.to_string())?;
        
        self.emit_event(Event::FileWatchStopped {
            path: path.to_string(),
        });
        
        Ok(serde_json::json!({
            "status": "ok",
            "path": path
        }))
    }
    
    async fn handle_get_watched_paths(&self) -> Result<Value, String> {
        let file_watcher = self.file_watcher.as_ref()
            .ok_or("File watcher not initialized")?;
        
        let watcher = file_watcher.read().await;
        let paths: Vec<String> = watcher.get_buffered_events().await
            .into_iter()
            .flat_map(|e| e.paths)
            .map(|p| p.to_string_lossy().to_string())
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect();
        
        Ok(serde_json::json!({
            "paths": paths
        }))
    }
    
    async fn handle_get_file_watch_events(&self, limit: Option<usize>) -> Result<Value, String> {
        let file_watcher = self.file_watcher.as_ref()
            .ok_or("File watcher not initialized")?;
        
        let watcher = file_watcher.read().await;
        let events = watcher.process_events().await;
        
        let limited_events: Vec<_> = if let Some(limit) = limit {
            events.into_iter().take(limit).collect()
        } else {
            events
        };
        
        Ok(serde_json::to_value(limited_events).unwrap())
    }
    
    async fn handle_update_file_watcher_config(&self, config: FileWatchConfig) -> Result<Value, String> {
        let file_watcher = self.file_watcher.as_ref()
            .ok_or("File watcher not initialized")?;
        
        let mut watcher = file_watcher.write().await;
        watcher.update_config(config);
        
        Ok(serde_json::json!({
            "status": "ok"
        }))
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
    
    /// Dispatch an event to all plugins
    async fn dispatch_event_to_plugins(&self, event: &Event) {
        let plugins = self.plugins.read().await;
        let subscriptions = self.plugin_subscriptions.read().await;
        
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
                    
                    // Dispatch event in a separate task to avoid blocking
                    tokio::spawn(async move {
                        let mut plugin_guard = plugin_clone.lock().await;
                        if let Err(e) = plugin_guard.handle_event(&event_clone).await {
                            eprintln!("Plugin {} error handling event {}: {}", 
                                plugin_id_clone, event_type, e);
                        }
                    });
                }
            }
        }
    }
}

// Make it cloneable for Tauri state management
impl Clone for Orchestrator {
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

// ===== Tauri Commands =====

#[tauri::command]
pub async fn orchestrator_execute(
    orchestrator: tauri::State<'_, Orchestrator>,
    action: Action,
) -> Result<Value, String> {
    orchestrator.execute_action(action).await
}

#[tauri::command]
pub async fn orchestrator_subscribe(
    _orchestrator: tauri::State<'_, Orchestrator>,
    _events: Vec<String>,
) -> Result<(), String> {
    // Frontend subscription would be handled differently
    Ok(())
}