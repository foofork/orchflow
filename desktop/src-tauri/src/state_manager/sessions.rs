// Session CRUD operations

use super::events::EventManager;
use super::persistence::PersistenceManager;
use super::types::{SessionState, StateEvent};
use crate::error::{OrchflowError, Result};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

pub struct SessionManager {
    sessions: Arc<RwLock<HashMap<String, SessionState>>>,
    events: EventManager,
    persistence: PersistenceManager,
    dirty_sessions: Arc<RwLock<HashMap<String, bool>>>,
}

impl SessionManager {
    pub fn new(events: EventManager, persistence: PersistenceManager) -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            events,
            persistence,
            dirty_sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Create a new session
    pub async fn create_session(&self, name: String) -> Result<SessionState> {
        let session_id = Uuid::new_v4().to_string();
        let session = SessionState::new(session_id, name);

        // Validate session
        self.validate_session(&session).await?;

        // Store in memory
        {
            let mut sessions = self.sessions.write().await;
            sessions.insert(session.id.clone(), session.clone());
        }

        // Mark as dirty for persistence
        self.mark_dirty(&session.id).await;

        // Emit event
        self.events.emit(StateEvent::SessionCreated {
            session: session.clone(),
        });

        // Persist to storage
        self.persistence.save_session(&session).await?;

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

    /// Update an existing session
    pub async fn update_session(&self, session: SessionState) -> Result<()> {
        // Validate session
        self.validate_session(&session).await?;

        // Check if session exists
        {
            let sessions = self.sessions.read().await;
            if !sessions.contains_key(&session.id) {
                return Err(OrchflowError::session_not_found(&session.id));
            }
        }

        // Update in memory
        {
            let mut sessions = self.sessions.write().await;
            sessions.insert(session.id.clone(), session.clone());
        }

        // Mark as dirty
        self.mark_dirty(&session.id).await;

        // Emit event
        self.events.emit(StateEvent::SessionUpdated {
            session: session.clone(),
        });

        // Persist to storage
        self.persistence.save_session(&session).await?;

        Ok(())
    }

    /// Delete a session
    pub async fn delete_session(&self, session_id: &str) -> Result<()> {
        // Check if session exists and get it
        let session = {
            let sessions = self.sessions.read().await;
            sessions.get(session_id).cloned()
        };

        let _session = session.ok_or_else(|| OrchflowError::session_not_found(session_id))?;

        // Remove from memory
        {
            let mut sessions = self.sessions.write().await;
            sessions.remove(session_id);
        }

        // Clean up dirty tracking
        {
            let mut dirty = self.dirty_sessions.write().await;
            dirty.remove(session_id);
        }

        // Emit event
        self.events.emit(StateEvent::SessionDeleted {
            session_id: session_id.to_string(),
        });

        // Remove from storage
        self.persistence.delete_session(session_id).await?;

        Ok(())
    }

    /// Add a pane to a session
    pub async fn add_pane_to_session(&self, session_id: &str, pane_id: &str) -> Result<()> {
        let mut session = self
            .get_session(session_id)
            .await
            .ok_or_else(|| OrchflowError::session_not_found(session_id))?;

        session.add_pane(pane_id.to_string());
        self.update_session(session).await
    }

    /// Remove a pane from a session
    pub async fn remove_pane_from_session(&self, session_id: &str, pane_id: &str) -> Result<()> {
        let mut session = self
            .get_session(session_id)
            .await
            .ok_or_else(|| OrchflowError::session_not_found(session_id))?;

        session.remove_pane(pane_id);
        self.update_session(session).await
    }

    /// Set the active pane for a session
    pub async fn set_active_pane(&self, session_id: &str, pane_id: &str) -> Result<()> {
        let mut session = self
            .get_session(session_id)
            .await
            .ok_or_else(|| OrchflowError::session_not_found(session_id))?;

        session.set_active_pane(pane_id.to_string());
        self.update_session(session).await
    }

    /// Get sessions that contain a specific pane
    pub async fn get_sessions_with_pane(&self, pane_id: &str) -> Vec<SessionState> {
        let sessions = self.sessions.read().await;
        sessions
            .values()
            .filter(|session| session.panes.contains(&pane_id.to_string()))
            .cloned()
            .collect()
    }

    /// Validate a session
    async fn validate_session(&self, session: &SessionState) -> Result<()> {
        if session.id.is_empty() {
            return Err(OrchflowError::validation_error(
                "session_id",
                "Session ID cannot be empty",
            ));
        }

        if session.name.is_empty() {
            return Err(OrchflowError::validation_error(
                "session_name",
                "Session name cannot be empty",
            ));
        }

        // Validate that active_pane is in the panes list
        if let Some(active_pane) = &session.active_pane {
            if !session.panes.contains(active_pane) {
                return Err(OrchflowError::validation_error(
                    "active_pane",
                    "Active pane must be in the session's pane list",
                ));
            }
        }

        Ok(())
    }

    /// Mark a session as dirty for persistence
    async fn mark_dirty(&self, session_id: &str) {
        let mut dirty = self.dirty_sessions.write().await;
        dirty.insert(session_id.to_string(), true);
    }

    /// Get dirty sessions
    pub async fn get_dirty_sessions(&self) -> Vec<String> {
        let dirty = self.dirty_sessions.read().await;
        dirty.keys().cloned().collect()
    }

    /// Clear dirty status for a session
    pub async fn clear_dirty(&self, session_id: &str) {
        let mut dirty = self.dirty_sessions.write().await;
        dirty.remove(session_id);
    }

    /// Persist all dirty sessions
    pub async fn persist_dirty_sessions(&self) -> Result<()> {
        let dirty_ids = self.get_dirty_sessions().await;

        for session_id in dirty_ids {
            if let Some(session) = self.get_session(&session_id).await {
                self.persistence.save_session(&session).await?;
                self.clear_dirty(&session_id).await;
            }
        }

        Ok(())
    }
}
