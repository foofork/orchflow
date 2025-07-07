// Unified State Manager - Single source of truth for all application state
//
// This replaces the duplication between AppState (which only held layouts) 
// and Orchestrator state (sessions, panes). It provides a unified interface
// for state management with persistence, events, and consistency guarantees.

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, broadcast};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use crate::layout::GridLayout;
use crate::simple_state_store::SimpleStateStore;
use crate::error::{OrchflowError, Result};

// ===== Core State Types =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionState {
    pub id: String,
    pub name: String,
    pub panes: Vec<String>,
    pub active_pane: Option<String>,
    pub layout: Option<GridLayout>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaneState {
    pub id: String,
    pub session_id: String,
    pub backend_id: Option<String>, // tmux pane ID or muxd pane ID
    pub pane_type: PaneType,
    pub title: String,
    pub working_dir: Option<String>,
    pub command: Option<String>,
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

// ===== State Events =====

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StateEvent {
    // Session events
    SessionCreated { session: SessionState },
    SessionUpdated { session: SessionState },
    SessionDeleted { session_id: String },
    
    // Pane events
    PaneCreated { pane: PaneState },
    PaneUpdated { pane: PaneState },
    PaneDeleted { pane_id: String },
    
    // Layout events
    LayoutUpdated { session_id: String, layout: GridLayout },
    LayoutReset { session_id: String },
}

// ===== State Manager =====

pub struct StateManager {
    // Core state
    sessions: Arc<RwLock<HashMap<String, SessionState>>>,
    panes: Arc<RwLock<HashMap<String, PaneState>>>,
    
    // Persistence
    store: Arc<SimpleStateStore>,
    
    // Event system
    event_tx: broadcast::Sender<StateEvent>,
    
    // State validation
    dirty_sessions: Arc<RwLock<HashMap<String, bool>>>,
    dirty_panes: Arc<RwLock<HashMap<String, bool>>>,
}

impl StateManager {
    /// Create a new state manager
    pub fn new(store: Arc<SimpleStateStore>) -> Self {
        let (event_tx, _) = broadcast::channel(1024);
        
        let manager = Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            panes: Arc::new(RwLock::new(HashMap::new())),
            store,
            event_tx,
            dirty_sessions: Arc::new(RwLock::new(HashMap::new())),
            dirty_panes: Arc::new(RwLock::new(HashMap::new())),
        };
        
        // Start auto-persistence task
        manager.start_auto_persist();
        
        manager
    }
    
    /// Subscribe to state events
    pub fn subscribe(&self) -> broadcast::Receiver<StateEvent> {
        self.event_tx.subscribe()
    }
    
    // ===== Session Management =====
    
    /// Create a new session
    pub async fn create_session(&self, name: String) -> Result<SessionState> {
        let session_id = Uuid::new_v4().to_string();
        let session = SessionState {
            id: session_id.clone(),
            name,
            panes: Vec::new(),
            active_pane: None,
            layout: Some(GridLayout::new(session_id)), // Default layout with actual session ID
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        
        // Add to state
        {
            let mut sessions = self.sessions.write().await;
            sessions.insert(session.id.clone(), session.clone());
        }
        
        // Mark as dirty for persistence
        self.mark_session_dirty(&session.id).await;
        
        // Emit event
        let _ = self.event_tx.send(StateEvent::SessionCreated { 
            session: session.clone() 
        });
        
        Ok(session)
    }
    
    /// Get a session by ID
    pub async fn get_session(&self, session_id: &str) -> Option<SessionState> {
        let sessions = self.sessions.read().await;
        sessions.get(session_id).cloned()
    }
    
    /// List all sessions
    pub async fn list_sessions(&self) -> Vec<SessionState> {
        let sessions = self.sessions.read().await;
        sessions.values().cloned().collect()
    }
    
    /// Update a session
    pub async fn update_session(&self, session: SessionState) -> Result<()> {
        let session_id = session.id.clone();
        
        {
            let mut sessions = self.sessions.write().await;
            let mut updated_session = session;
            updated_session.updated_at = Utc::now();
            sessions.insert(session_id.clone(), updated_session.clone());
            
            // Emit event
            let _ = self.event_tx.send(StateEvent::SessionUpdated { 
                session: updated_session 
            });
        }
        
        self.mark_session_dirty(&session_id).await;
        Ok(())
    }
    
    /// Delete a session
    pub async fn delete_session(&self, session_id: &str) -> Result<()> {
        // Remove from state
        {
            let mut sessions = self.sessions.write().await;
            sessions.remove(session_id);
        }
        
        // Remove associated panes
        {
            let mut panes = self.panes.write().await;
            panes.retain(|_, pane| pane.session_id != session_id);
        }
        
        // Clean up dirty tracking
        {
            let mut dirty = self.dirty_sessions.write().await;
            dirty.remove(session_id);
        }
        
        // Persist deletion to database
        if let Err(e) = self.store.delete_session(session_id).await {
            eprintln!("Failed to delete session from database: {}", e);
            // Note: We continue even if database deletion fails
            // The session is removed from memory state
        }
        
        // Emit event
        let _ = self.event_tx.send(StateEvent::SessionDeleted { 
            session_id: session_id.to_string() 
        });
        
        Ok(())
    }
    
    // ===== Pane Management =====
    
    /// Create a new pane
    pub async fn create_pane(&self, session_id: String, pane_type: PaneType, backend_id: Option<String>) -> Result<PaneState> {
        let pane = PaneState {
            id: Uuid::new_v4().to_string(),
            session_id: session_id.clone(),
            backend_id,
            pane_type,
            title: "New Pane".to_string(),
            working_dir: None,
            command: None,
            created_at: Utc::now(),
        };
        
        // Add to state
        {
            let mut panes = self.panes.write().await;
            panes.insert(pane.id.clone(), pane.clone());
        }
        
        // Update session pane list
        {
            let mut sessions = self.sessions.write().await;
            if let Some(session) = sessions.get_mut(&session_id) {
                session.panes.push(pane.id.clone());
                if session.active_pane.is_none() {
                    session.active_pane = Some(pane.id.clone());
                }
                session.updated_at = Utc::now();
            }
        }
        
        // Mark as dirty
        self.mark_pane_dirty(&pane.id).await;
        self.mark_session_dirty(&session_id).await;
        
        // Emit event
        let _ = self.event_tx.send(StateEvent::PaneCreated { 
            pane: pane.clone() 
        });
        
        Ok(pane)
    }
    
    /// Get a pane by ID
    pub async fn get_pane(&self, pane_id: &str) -> Option<PaneState> {
        let panes = self.panes.read().await;
        panes.get(pane_id).cloned()
    }
    
    /// List panes for a session
    pub async fn list_panes(&self, session_id: &str) -> Vec<PaneState> {
        let panes = self.panes.read().await;
        panes.values()
            .filter(|pane| pane.session_id == session_id)
            .cloned()
            .collect()
    }
    
    /// Update a pane
    pub async fn update_pane(&self, pane: PaneState) -> Result<()> {
        let pane_id = pane.id.clone();
        
        {
            let mut panes = self.panes.write().await;
            panes.insert(pane_id.clone(), pane.clone());
        }
        
        self.mark_pane_dirty(&pane_id).await;
        
        // Emit event
        let _ = self.event_tx.send(StateEvent::PaneUpdated { 
            pane 
        });
        
        Ok(())
    }
    
    /// Delete a pane
    pub async fn delete_pane(&self, pane_id: &str) -> Result<()> {
        let session_id = {
            let panes = self.panes.read().await;
            panes.get(pane_id).map(|p| p.session_id.clone())
        };
        
        // Remove from state
        {
            let mut panes = self.panes.write().await;
            panes.remove(pane_id);
        }
        
        // Update session pane list
        if let Some(session_id) = &session_id {
            let mut sessions = self.sessions.write().await;
            if let Some(session) = sessions.get_mut(session_id) {
                session.panes.retain(|id| id != pane_id);
                if session.active_pane.as_ref() == Some(&pane_id.to_string()) {
                    session.active_pane = session.panes.first().cloned();
                }
                session.updated_at = Utc::now();
            }
        }
        
        // Clean up dirty tracking
        {
            let mut dirty = self.dirty_panes.write().await;
            dirty.remove(pane_id);
        }
        
        // Persist deletion to database
        if let Err(e) = self.store.delete_pane(pane_id).await {
            eprintln!("Failed to delete pane from database: {}", e);
        }
        
        // Mark session dirty and emit events
        if let Some(session_id) = session_id {
            self.mark_session_dirty(&session_id).await;
        }
        
        let _ = self.event_tx.send(StateEvent::PaneDeleted { 
            pane_id: pane_id.to_string() 
        });
        
        Ok(())
    }
    
    // ===== Layout Management =====
    
    /// Update session layout
    pub async fn update_layout(&self, session_id: &str, layout: GridLayout) -> Result<()> {
        {
            let mut sessions = self.sessions.write().await;
            if let Some(session) = sessions.get_mut(session_id) {
                session.layout = Some(layout.clone());
                session.updated_at = Utc::now();
            } else {
                return Err(OrchflowError::session_not_found(session_id));
            }
        }
        
        self.mark_session_dirty(session_id).await;
        
        // Emit event
        let _ = self.event_tx.send(StateEvent::LayoutUpdated { 
            session_id: session_id.to_string(),
            layout 
        });
        
        Ok(())
    }
    
    /// Get session layout
    pub async fn get_layout(&self, session_id: &str) -> Option<GridLayout> {
        let sessions = self.sessions.read().await;
        sessions.get(session_id)?.layout.clone()
    }
    
    // ===== Persistence =====
    
    /// Start auto-persistence background task
    fn start_auto_persist(&self) {
        let sessions = Arc::clone(&self.sessions);
        let panes = Arc::clone(&self.panes);
        let store = Arc::clone(&self.store);
        let dirty_sessions = Arc::clone(&self.dirty_sessions);
        let dirty_panes = Arc::clone(&self.dirty_panes);
        
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(5));
            
            loop {
                interval.tick().await;
                
                // Persist dirty sessions
                let dirty_session_ids: Vec<String> = {
                    let dirty = dirty_sessions.read().await;
                    dirty.keys().cloned().collect()
                };
                
                for session_id in dirty_session_ids {
                    if let Some(session) = {
                        let sessions = sessions.read().await;
                        sessions.get(&session_id).cloned()
                    } {
                        if let Err(e) = store.save_session(&session).await {
                            eprintln!("Failed to persist session {}: {}", session_id, e);
                        } else {
                            let mut dirty = dirty_sessions.write().await;
                            dirty.remove(&session_id);
                        }
                    }
                }
                
                // Persist dirty panes
                let dirty_pane_ids: Vec<String> = {
                    let dirty = dirty_panes.read().await;
                    dirty.keys().cloned().collect()
                };
                
                for pane_id in dirty_pane_ids {
                    if let Some(pane) = {
                        let panes = panes.read().await;
                        panes.get(&pane_id).cloned()
                    } {
                        if let Err(e) = store.save_pane(&pane).await {
                            eprintln!("Failed to persist pane {}: {}", pane_id, e);
                        } else {
                            let mut dirty = dirty_panes.write().await;
                            dirty.remove(&pane_id);
                        }
                    }
                }
            }
        });
    }
    
    /// Mark session as dirty for persistence
    async fn mark_session_dirty(&self, session_id: &str) {
        let mut dirty = self.dirty_sessions.write().await;
        dirty.insert(session_id.to_string(), true);
    }
    
    /// Mark pane as dirty for persistence
    async fn mark_pane_dirty(&self, pane_id: &str) {
        let mut dirty = self.dirty_panes.write().await;
        dirty.insert(pane_id.to_string(), true);
    }
    
    /// Force persist all state immediately
    pub async fn persist_all(&self) -> Result<()> {
        // Persist all sessions
        {
            let sessions = self.sessions.read().await;
            for session in sessions.values() {
                self.store.save_session(session).await
                    .map_err(|e| OrchflowError::StatePersistenceError {
                        reason: format!("Failed to persist session {}: {}", session.id, e)
                    })?;
            }
        }
        
        // Persist all panes
        {
            let panes = self.panes.read().await;
            for pane in panes.values() {
                self.store.save_pane(pane).await
                    .map_err(|e| OrchflowError::StatePersistenceError {
                        reason: format!("Failed to persist pane {}: {}", pane.id, e)
                    })?;
            }
        }
        
        // Clear dirty tracking
        {
            let mut dirty = self.dirty_sessions.write().await;
            dirty.clear();
        }
        {
            let mut dirty = self.dirty_panes.write().await;
            dirty.clear();
        }
        
        Ok(())
    }
    
    // ===== Settings Management =====
    
    /// Set a setting value
    pub async fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        self.store.set_setting(key, value)
            .map_err(|e| OrchflowError::StatePersistenceError {
                reason: format!("Failed to set setting {}: {}", key, e)
            })
    }
    
    /// Get a setting value
    pub async fn get_setting(&self, key: &str) -> Result<Option<String>> {
        self.store.get_setting(key)
            .map_err(|e| OrchflowError::StatePersistenceError {
                reason: format!("Failed to get setting {}: {}", key, e)
            })
    }
    
    // ===== Module Management =====
    
    /// Install a module
    pub async fn install_module(&self, name: String, version: String, manifest: String) -> Result<crate::simple_state_store::Module> {
        self.store.install_module(name, version, manifest).await
            .map_err(|e| OrchflowError::StatePersistenceError {
                reason: format!("Failed to install module: {}", e)
            })
    }
    
    /// List all modules
    pub async fn list_modules(&self) -> Result<Vec<crate::simple_state_store::Module>> {
        self.store.list_modules().await
            .map_err(|e| OrchflowError::StatePersistenceError {
                reason: format!("Failed to list modules: {}", e)
            })
    }

    /// Load state from persistence
    pub async fn load_from_store(&self) -> Result<()> {
        // Load sessions
        let sessions = self.store.list_sessions_for_state_manager().await
            .map_err(|e| OrchflowError::StatePersistenceError {
                reason: format!("Failed to load sessions: {}", e)
            })?;
        
        {
            let mut state_sessions = self.sessions.write().await;
            for session in sessions {
                state_sessions.insert(session.id.clone(), session);
            }
        }
        
        // Load panes
        let panes = self.store.list_panes_for_state_manager().await
            .map_err(|e| OrchflowError::StatePersistenceError {
                reason: format!("Failed to load panes: {}", e)
            })?;
        
        {
            let mut state_panes = self.panes.write().await;
            for pane in panes {
                state_panes.insert(pane.id.clone(), pane);
            }
        }
        
        Ok(())
    }
}

impl Clone for StateManager {
    fn clone(&self) -> Self {
        Self {
            sessions: Arc::clone(&self.sessions),
            panes: Arc::clone(&self.panes),
            store: Arc::clone(&self.store),
            event_tx: self.event_tx.clone(),
            dirty_sessions: Arc::clone(&self.dirty_sessions),
            dirty_panes: Arc::clone(&self.dirty_panes),
        }
    }
}