// Simple State Store - SQLite-based persistence layer
//
// This module provides a comprehensive data access layer for orchflow's state management.
// It handles sessions, panes, layouts, modules, and key-value storage with full CRUD operations.

pub mod types;
pub mod connection;
pub mod sessions;
pub mod panes;
pub mod layouts;
pub mod modules;
pub mod keyvalue;

// Re-export main types for easy access
pub use types::*;
pub use connection::{ConnectionManager, DatabaseStats};
pub use sessions::SessionRepository;
pub use panes::PaneRepository;
pub use layouts::LayoutRepository;
pub use modules::ModuleRepository;
pub use keyvalue::KeyValueRepository;

use rusqlite::Result as SqliteResult;
use std::path::Path;

/// Main SimpleStateStore struct that provides unified access to all repositories
pub struct SimpleStateStore {
    conn_manager: ConnectionManager,
    sessions: SessionRepository,
    panes: PaneRepository,
    layouts: LayoutRepository,
    modules: ModuleRepository,
    keyvalue: KeyValueRepository,
}

impl SimpleStateStore {
    /// Create a new state store with in-memory database
    pub fn new() -> SqliteResult<Self> {
        let conn_manager = ConnectionManager::new()?;
        conn_manager.initialize_schema()?;
        conn_manager.enable_foreign_keys()?;
        conn_manager.optimize_settings()?;
        
        let sessions = SessionRepository::new(conn_manager.clone());
        let panes = PaneRepository::new(conn_manager.clone());
        let layouts = LayoutRepository::new(conn_manager.clone());
        let modules = ModuleRepository::new(conn_manager.clone());
        let keyvalue = KeyValueRepository::new(conn_manager.clone());
        
        Ok(Self {
            conn_manager,
            sessions,
            panes,
            layouts,
            modules,
            keyvalue,
        })
    }
    
    /// Create a new state store with file-based database
    pub fn new_with_file<P: AsRef<Path>>(path: P) -> SqliteResult<Self> {
        let conn_manager = ConnectionManager::new_with_file(path)?;
        conn_manager.initialize_schema()?;
        conn_manager.enable_foreign_keys()?;
        conn_manager.enable_wal_mode()?;
        conn_manager.optimize_settings()?;
        
        let sessions = SessionRepository::new(conn_manager.clone());
        let panes = PaneRepository::new(conn_manager.clone());
        let layouts = LayoutRepository::new(conn_manager.clone());
        let modules = ModuleRepository::new(conn_manager.clone());
        let keyvalue = KeyValueRepository::new(conn_manager.clone());
        
        Ok(Self {
            conn_manager,
            sessions,
            panes,
            layouts,
            modules,
            keyvalue,
        })
    }
    
    // ===== Session Operations =====
    
    /// Create a new session
    pub async fn create_session(&self, create_session: CreateSession) -> SqliteResult<Session> {
        self.sessions.create_session(create_session).await
    }
    
    /// Get a session by ID
    pub async fn get_session(&self, session_id: &str) -> SqliteResult<Option<Session>> {
        self.sessions.get_session(session_id).await
    }
    
    /// List all sessions
    pub async fn list_sessions(&self) -> SqliteResult<Vec<Session>> {
        self.sessions.list_sessions().await
    }
    
    /// Update a session
    pub async fn update_session(&self, session_id: &str, update_session: UpdateSession) -> SqliteResult<Option<Session>> {
        self.sessions.update_session(session_id, update_session).await
    }
    
    /// Delete a session
    pub async fn delete_session(&self, session_id: &str) -> SqliteResult<bool> {
        self.sessions.delete_session(session_id).await
    }
    
    // ===== Pane Operations =====
    
    /// Create a new pane
    pub async fn create_pane(&self, create_pane: CreatePane) -> SqliteResult<Pane> {
        self.panes.create_pane(create_pane).await
    }
    
    /// Get a pane by ID
    pub async fn get_pane(&self, pane_id: &str) -> SqliteResult<Option<Pane>> {
        self.panes.get_pane(pane_id).await
    }
    
    /// Get panes by session
    pub async fn get_panes_by_session(&self, session_id: &str) -> SqliteResult<Vec<Pane>> {
        self.panes.get_panes_by_session(session_id).await
    }
    
    /// Update a pane
    pub async fn update_pane(&self, pane_id: &str, update_pane: UpdatePane) -> SqliteResult<Option<Pane>> {
        self.panes.update_pane(pane_id, update_pane).await
    }
    
    /// Delete a pane
    pub async fn delete_pane(&self, pane_id: &str) -> SqliteResult<bool> {
        self.panes.delete_pane(pane_id).await
    }
    
    // ===== Layout Operations =====
    
    /// Create a new layout
    pub async fn create_layout(&self, create_layout: CreateLayout) -> SqliteResult<Layout> {
        self.layouts.create_layout(create_layout).await
    }
    
    /// Get a layout by ID
    pub async fn get_layout(&self, layout_id: &str) -> SqliteResult<Option<Layout>> {
        self.layouts.get_layout(layout_id).await
    }
    
    /// Get layouts by session
    pub async fn get_layouts_by_session(&self, session_id: &str) -> SqliteResult<Vec<Layout>> {
        self.layouts.get_layouts_by_session(session_id).await
    }
    
    /// Get active layout for session
    pub async fn get_active_layout(&self, session_id: &str) -> SqliteResult<Option<Layout>> {
        self.layouts.get_active_layout(session_id).await
    }
    
    /// Update a layout
    pub async fn update_layout(&self, layout_id: &str, update_layout: UpdateLayout) -> SqliteResult<Option<Layout>> {
        self.layouts.update_layout(layout_id, update_layout).await
    }
    
    /// Delete a layout
    pub async fn delete_layout(&self, layout_id: &str) -> SqliteResult<bool> {
        self.layouts.delete_layout(layout_id).await
    }
    
    // ===== Module Operations =====
    
    /// Install a new module
    pub async fn install_module(&self, create_module: CreateModule) -> SqliteResult<Module> {
        self.modules.install_module(create_module).await
    }
    
    /// Get a module by ID
    pub async fn get_module(&self, module_id: &str) -> SqliteResult<Option<Module>> {
        self.modules.get_module(module_id).await
    }
    
    /// List all modules
    pub async fn list_modules(&self) -> SqliteResult<Vec<Module>> {
        self.modules.list_modules().await
    }
    
    /// List enabled modules
    pub async fn list_enabled_modules(&self) -> SqliteResult<Vec<Module>> {
        self.modules.list_enabled_modules().await
    }
    
    /// Update a module
    pub async fn update_module(&self, module_id: &str, update_module: UpdateModule) -> SqliteResult<Option<Module>> {
        self.modules.update_module(module_id, update_module).await
    }
    
    /// Uninstall a module
    pub async fn uninstall_module(&self, module_id: &str) -> SqliteResult<bool> {
        self.modules.uninstall_module(module_id).await
    }
    
    /// Uninstall a module by name
    pub async fn uninstall_module_by_name(&self, name: &str) -> SqliteResult<bool> {
        self.modules.uninstall_module_by_name(name).await
    }
    
    // ===== Key-Value Operations =====
    
    /// Set a key-value pair
    pub async fn set(&self, key: &str, value: &str) -> SqliteResult<()> {
        self.keyvalue.set(key, value).await
    }
    
    /// Get a value by key
    pub async fn get(&self, key: &str) -> SqliteResult<Option<String>> {
        self.keyvalue.get(key).await
    }
    
    /// Delete a key-value pair
    pub async fn delete(&self, key: &str) -> SqliteResult<bool> {
        self.keyvalue.delete(key).await
    }
    
    /// List keys with a prefix
    pub async fn keys_with_prefix(&self, prefix: &str) -> SqliteResult<Vec<String>> {
        self.keyvalue.keys_with_prefix(prefix).await
    }
    
    /// List key-value pairs with a prefix
    pub async fn list_with_prefix(&self, prefix: &str) -> SqliteResult<Vec<KeyValue>> {
        self.keyvalue.list_with_prefix(prefix).await
    }
    
    /// Set a setting (alias for set)
    pub async fn set_setting(&self, key: &str, value: &str) -> SqliteResult<()> {
        self.set(key, value).await
    }
    
    /// Get a setting (alias for get)
    pub async fn get_setting(&self, key: &str) -> SqliteResult<Option<String>> {
        self.get(key).await
    }
    
    // ===== Database Management =====
    
    /// Get database statistics
    pub fn get_stats(&self) -> SqliteResult<DatabaseStats> {
        self.conn_manager.get_stats()
    }
    
    /// Run database vacuum
    pub fn vacuum(&self) -> SqliteResult<()> {
        self.conn_manager.vacuum()
    }
    
    /// Check database integrity
    pub fn check_integrity(&self) -> SqliteResult<bool> {
        self.conn_manager.check_integrity()
    }
    
    // ===== Convenience Methods =====
    
    /// Create a session with its first pane
    pub async fn create_session_with_pane(
        &self,
        session_name: String,
        pane_type: String,
        tmux_session: Option<String>,
        tmux_pane: Option<String>,
    ) -> SqliteResult<(Session, Pane)> {
        // Create session
        let session = self.create_session(CreateSession {
            name: session_name,
            tmux_session,
            metadata: None,
        }).await?;
        
        // Create pane
        let pane = self.create_pane(CreatePane {
            session_id: session.id.clone(),
            tmux_pane,
            pane_type,
            content: None,
            metadata: None,
        }).await?;
        
        Ok((session, pane))
    }
    
    /// Get session with its panes and active layout
    pub async fn get_session_details(&self, session_id: &str) -> SqliteResult<Option<SessionDetails>> {
        let session = match self.get_session(session_id).await? {
            Some(s) => s,
            None => return Ok(None),
        };
        
        let panes = self.get_panes_by_session(session_id).await?;
        let active_layout = self.get_active_layout(session_id).await?;
        let all_layouts = self.get_layouts_by_session(session_id).await?;
        
        Ok(Some(SessionDetails {
            session,
            panes,
            active_layout,
            all_layouts,
        }))
    }
    
    /// Delete session and all related data
    pub async fn delete_session_completely(&self, session_id: &str) -> SqliteResult<bool> {
        // Delete layouts first (due to foreign key constraints)
        let _ = self.layouts.delete_layouts_by_session(session_id).await?;
        
        // Delete panes
        let _ = self.panes.delete_panes_by_session(session_id).await?;
        
        // Delete session
        self.delete_session(session_id).await
    }
}

// Helper struct for session details
#[derive(Debug, Clone)]
pub struct SessionDetails {
    pub session: Session,
    pub panes: Vec<Pane>,
    pub active_layout: Option<Layout>,
    pub all_layouts: Vec<Layout>,
}

impl Clone for SimpleStateStore {
    fn clone(&self) -> Self {
        Self {
            conn_manager: self.conn_manager.clone(),
            sessions: self.sessions.clone(),
            panes: self.panes.clone(),
            layouts: self.layouts.clone(),
            modules: self.modules.clone(),
            keyvalue: self.keyvalue.clone(),
        }
    }
}