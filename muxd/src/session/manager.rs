use crate::error::{MuxdError, Result};
use crate::protocol::{SessionId, PaneId, PaneType};
use crate::terminal::Pane;
use crate::state::{StatePersistence, PersistedState, PersistedSession, PersistedPane};
use chrono::{DateTime, Utc};
use parking_lot::RwLock;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{debug, info, warn};

/// Session information
#[derive(Debug, Clone)]
pub struct Session {
    pub id: SessionId,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub panes: HashMap<PaneId, Arc<Pane>>,
    pub active_pane: Option<PaneId>,
}

/// Session manager for handling multiple sessions
pub struct SessionManager {
    sessions: Arc<RwLock<HashMap<SessionId, Arc<RwLock<Session>>>>>,
    max_sessions: usize,
    max_panes_per_session: usize,
    state_persistence: Option<Arc<StatePersistence>>,
}

impl SessionManager {
    /// Create a new session manager
    pub fn new(max_sessions: usize, max_panes_per_session: usize) -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            max_sessions,
            max_panes_per_session,
            state_persistence: None,
        }
    }
    
    /// Create a new session manager with state persistence
    pub fn with_persistence(
        max_sessions: usize,
        max_panes_per_session: usize,
        state_persistence: Arc<StatePersistence>,
    ) -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            max_sessions,
            max_panes_per_session,
            state_persistence: Some(state_persistence),
        }
    }
    
    /// Create a new session
    pub fn create_session(&self, name: String) -> Result<SessionId> {
        let sessions = self.sessions.read();
        
        if sessions.len() >= self.max_sessions {
            return Err(MuxdError::ResourceLimit {
                resource: "sessions".to_string(),
                limit: self.max_sessions,
            });
        }
        
        drop(sessions); // Release read lock
        
        let session_id = SessionId::new();
        let now = Utc::now();
        
        let session = Session {
            id: session_id.clone(),
            name,
            created_at: now,
            updated_at: now,
            panes: HashMap::new(),
            active_pane: None,
        };
        
        self.sessions.write().insert(
            session_id.clone(),
            Arc::new(RwLock::new(session)),
        );
        
        info!("Created session {}", session_id);
        Ok(session_id)
    }
    
    /// Get a session by ID
    pub fn get_session(&self, session_id: &SessionId) -> Option<Arc<RwLock<Session>>> {
        self.sessions.read().get(session_id).cloned()
    }
    
    /// List all sessions
    pub fn list_sessions(&self) -> Vec<(SessionId, String, usize, DateTime<Utc>, DateTime<Utc>)> {
        self.sessions
            .read()
            .iter()
            .map(|(id, session)| {
                let session = session.read();
                (
                    id.clone(),
                    session.name.clone(),
                    session.panes.len(),
                    session.created_at,
                    session.updated_at,
                )
            })
            .collect()
    }
    
    /// Delete a session
    pub fn delete_session(&self, session_id: &SessionId) -> Result<()> {
        let mut sessions = self.sessions.write();
        
        if let Some(session_arc) = sessions.remove(session_id) {
            let session = session_arc.read();
            
            // Kill all panes
            for pane in session.panes.values() {
                if let Err(e) = pane.kill() {
                    warn!("Failed to kill pane {}: {}", pane.id, e);
                }
            }
            
            info!("Deleted session {}", session_id);
            Ok(())
        } else {
            Err(MuxdError::SessionNotFound {
                session_id: session_id.to_string(),
            })
        }
    }
    
    /// Create a new pane in a session
    pub fn create_pane(
        &self,
        session_id: &SessionId,
        pane_type: PaneType,
        output_tx: mpsc::UnboundedSender<bytes::Bytes>,
    ) -> Result<Arc<Pane>> {
        let session_arc = self
            .get_session(session_id)
            .ok_or_else(|| MuxdError::SessionNotFound {
                session_id: session_id.to_string(),
            })?;
        
        let mut session = session_arc.write();
        
        if session.panes.len() >= self.max_panes_per_session {
            return Err(MuxdError::ResourceLimit {
                resource: "panes per session".to_string(),
                limit: self.max_panes_per_session,
            });
        }
        
        let pane = Arc::new(Pane::new(
            session_id.to_string(),
            pane_type,
            output_tx,
        ));
        
        let pane_id = pane.id.clone();
        session.panes.insert(pane_id.clone(), pane.clone());
        
        // Set as active pane if first one
        if session.panes.len() == 1 {
            session.active_pane = Some(pane_id.clone());
        }
        
        session.updated_at = Utc::now();
        
        info!("Created pane {} in session {}", pane_id, session_id);
        Ok(pane)
    }
    
    /// Get a pane by ID
    pub fn get_pane(&self, session_id: &SessionId, pane_id: &PaneId) -> Result<Arc<Pane>> {
        let session_arc = self
            .get_session(session_id)
            .ok_or_else(|| MuxdError::SessionNotFound {
                session_id: session_id.to_string(),
            })?;
        
        let session = session_arc.read();
        
        session
            .panes
            .get(pane_id)
            .cloned()
            .ok_or_else(|| MuxdError::PaneNotFound {
                pane_id: pane_id.to_string(),
            })
    }
    
    /// Find a pane across all sessions
    pub fn find_pane(&self, pane_id: &PaneId) -> Option<(SessionId, Arc<Pane>)> {
        for (session_id, session_arc) in self.sessions.read().iter() {
            let session = session_arc.read();
            if let Some(pane) = session.panes.get(pane_id) {
                return Some((session_id.clone(), pane.clone()));
            }
        }
        None
    }
    
    /// Kill a pane
    pub fn kill_pane(&self, session_id: &SessionId, pane_id: &PaneId) -> Result<()> {
        let session_arc = self
            .get_session(session_id)
            .ok_or_else(|| MuxdError::SessionNotFound {
                session_id: session_id.to_string(),
            })?;
        
        let mut session = session_arc.write();
        
        if let Some(pane) = session.panes.remove(pane_id) {
            pane.kill()?;
            
            // Update active pane if needed
            if session.active_pane.as_ref() == Some(pane_id) {
                session.active_pane = session.panes.keys().next().cloned();
            }
            
            session.updated_at = Utc::now();
            
            info!("Killed pane {} in session {}", pane_id, session_id);
            Ok(())
        } else {
            Err(MuxdError::PaneNotFound {
                pane_id: pane_id.to_string(),
            })
        }
    }
    
    /// List panes in a session
    pub fn list_panes(&self, session_id: &SessionId) -> Result<Vec<Arc<Pane>>> {
        let session_arc = self
            .get_session(session_id)
            .ok_or_else(|| MuxdError::SessionNotFound {
                session_id: session_id.to_string(),
            })?;
        
        let session = session_arc.read();
        Ok(session.panes.values().cloned().collect())
    }
    
    /// Set active pane
    pub fn set_active_pane(&self, session_id: &SessionId, pane_id: &PaneId) -> Result<()> {
        let session_arc = self
            .get_session(session_id)
            .ok_or_else(|| MuxdError::SessionNotFound {
                session_id: session_id.to_string(),
            })?;
        
        let mut session = session_arc.write();
        
        if session.panes.contains_key(pane_id) {
            session.active_pane = Some(pane_id.clone());
            session.updated_at = Utc::now();
            Ok(())
        } else {
            Err(MuxdError::PaneNotFound {
                pane_id: pane_id.to_string(),
            })
        }
    }
    
    /// Get max sessions limit
    pub fn max_sessions(&self) -> usize {
        self.max_sessions
    }
    
    /// Get max panes per session limit
    pub fn max_panes_per_session(&self) -> usize {
        self.max_panes_per_session
    }
    
    /// Clean up dead panes
    pub fn cleanup_dead_panes(&self) {
        let sessions = self.sessions.read();
        
        for session_arc in sessions.values() {
            let mut session = session_arc.write();
            let dead_panes: Vec<PaneId> = session
                .panes
                .iter()
                .filter(|(_, pane)| !pane.is_alive())
                .map(|(id, _)| id.clone())
                .collect();
            
            for pane_id in dead_panes {
                debug!("Removing dead pane {}", pane_id);
                session.panes.remove(&pane_id);
                
                if session.active_pane.as_ref() == Some(&pane_id) {
                    session.active_pane = session.panes.keys().next().cloned();
                }
            }
            
            if !session.panes.is_empty() {
                session.updated_at = Utc::now();
            }
        }
    }
    
    /// Save the current state to disk
    pub async fn save_state(&self, session_ids: Option<Vec<String>>) -> Result<Vec<String>> {
        let persistence = self.state_persistence.as_ref()
            .ok_or_else(|| MuxdError::InvalidState {
                reason: "State persistence not configured".to_string(),
            })?;
        
        // Collect data while holding the lock
        let (persisted_sessions, saved_ids) = {
            let sessions = self.sessions.read();
            let mut persisted_sessions = Vec::new();
            let mut saved_ids = Vec::new();
            
            for (session_id, session_arc) in sessions.iter() {
                // Filter by session IDs if provided
                if let Some(ref ids) = session_ids {
                    if !ids.contains(&session_id.0) {
                        continue;
                    }
                }
                
                let session = session_arc.read();
                let mut persisted_panes = Vec::new();
                
                for (pane_id, pane) in &session.panes {
                    let size = pane.size();
                    persisted_panes.push(PersistedPane {
                        id: pane_id.clone(),
                        pane_type: pane.pane_type.clone(),
                        size,
                        title: pane.title(),
                        working_dir: pane.working_dir(),
                        command: None, // TODO: Store original command if needed
                        env: HashMap::new(), // TODO: Store environment if needed
                        output_buffer: pane.read_output(1000).into_bytes(), // Save last 1000 lines
                        created_at: pane.created_at,
                    });
                }
                
                persisted_sessions.push(PersistedSession {
                    id: session_id.clone(),
                    name: session.name.clone(),
                    created_at: session.created_at,
                    updated_at: session.updated_at,
                    panes: persisted_panes,
                    active_pane_id: session.active_pane.clone(),
                });
                
                saved_ids.push(session_id.0.clone());
            }
            
            (persisted_sessions, saved_ids)
        }; // Lock is released here
        
        let state = PersistedState {
            version: env!("CARGO_PKG_VERSION").to_string(),
            saved_at: Utc::now(),
            sessions: persisted_sessions,
        };
        
        persistence.save_state(&state).await?;
        
        Ok(saved_ids)
    }
    
    /// Restore state from disk
    pub async fn restore_state(
        &self,
        session_ids: Option<Vec<String>>,
        restart_commands: bool,
    ) -> Result<(Vec<(SessionId, String)>, Vec<(String, String)>)> {
        let persistence = self.state_persistence.as_ref()
            .ok_or_else(|| MuxdError::InvalidState {
                reason: "State persistence not configured".to_string(),
            })?;
        
        let state = persistence.load_state().await?
            .ok_or_else(|| MuxdError::InvalidState {
                reason: "No persisted state found".to_string(),
            })?;
        
        let mut restored = Vec::new();
        let mut failed = Vec::new();
        
        for persisted_session in state.sessions {
            // Filter by session IDs if provided
            if let Some(ref ids) = session_ids {
                if !ids.contains(&persisted_session.id.0) {
                    continue;
                }
            }
            
            // Try to create session
            match self.create_session(persisted_session.name.clone()) {
                Ok(new_session_id) => {
                    // Get the new session
                    let sessions = self.sessions.read();
                    if let Some(session_arc) = sessions.get(&new_session_id) {
                        let mut session = session_arc.write();
                        
                        // Restore metadata
                        session.created_at = persisted_session.created_at;
                        session.updated_at = persisted_session.updated_at;
                        
                        // TODO: Restore panes if restart_commands is true
                        // This would require creating new panes and restarting their commands
                        
                        drop(session);
                        drop(sessions);
                        
                        restored.push((new_session_id, persisted_session.name));
                    }
                }
                Err(e) => {
                    failed.push((persisted_session.id.0, e.to_string()));
                }
            }
        }
        
        Ok((restored, failed))
    }
}
#[cfg(test)]
#[path = "manager_test.rs"]
mod manager_test;
