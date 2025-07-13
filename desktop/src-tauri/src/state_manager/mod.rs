// Unified State Manager - Single source of truth for all application state
//
// This replaces the duplication between AppState (which only held layouts)
// and Orchestrator state (sessions, panes). It provides a unified interface
// for state management with persistence, events, and consistency guarantees.

pub mod events;
pub mod layouts;
pub mod panes;
pub mod persistence;
pub mod sessions;
pub mod settings;
pub mod types;

#[cfg(test)]
#[path = "mod_tests.rs"]
mod tests;

// Re-export commonly used types
pub use events::EventManager;
pub use types::{PaneState, PaneType, SessionState, StateEvent};

use crate::error::{OrchflowError, Result};
use crate::layout::GridLayout;
use crate::simple_state_store::SimpleStateStore;
use std::sync::Arc;
use tokio::sync::broadcast;

use layouts::LayoutManager;
use panes::PaneManager;
use persistence::PersistenceManager;
use sessions::SessionManager;
use settings::SettingsManager;

// ===== Main State Manager =====

pub struct StateManager {
    // Module managers
    persistence: PersistenceManager,
    events: EventManager,
    sessions: SessionManager,
    panes: PaneManager,
    layouts: LayoutManager,
    settings: SettingsManager,
}

impl StateManager {
    /// Create a new state manager
    pub fn new(store: Arc<SimpleStateStore>) -> Self {
        // Create shared components
        let persistence = PersistenceManager::new(store);
        let events = EventManager::new();

        // Create module managers
        let sessions = SessionManager::new(events.clone(), persistence.clone());
        let panes = PaneManager::new(events.clone(), persistence.clone());
        let layouts = LayoutManager::new(events.clone());
        let settings = SettingsManager::new(persistence.clone());

        Self {
            persistence,
            events,
            sessions,
            panes,
            layouts,
            settings,
        }
    }

    /// Subscribe to state events
    pub fn subscribe(&self) -> broadcast::Receiver<StateEvent> {
        self.events.subscribe()
    }

    // ===== Session Management =====

    /// Create a new session
    pub async fn create_session(&self, name: String) -> Result<SessionState> {
        self.sessions.create_session(name).await
    }

    /// Get a session by ID
    pub async fn get_session(&self, session_id: &str) -> Option<SessionState> {
        self.sessions.get_session(session_id).await
    }

    /// List all sessions
    pub async fn list_sessions(&self) -> Vec<SessionState> {
        self.sessions.list_sessions().await
    }

    /// Update an existing session
    pub async fn update_session(&self, session: SessionState) -> Result<()> {
        self.sessions.update_session(session).await
    }

    /// Delete a session
    pub async fn delete_session(&self, session_id: &str) -> Result<()> {
        // Delete all panes in the session first
        self.panes.delete_panes_for_session(session_id).await?;

        // Then delete the session
        self.sessions.delete_session(session_id).await
    }

    /// Set the active pane for a session
    pub async fn set_active_pane(&self, session_id: &str, pane_id: &str) -> Result<()> {
        self.sessions.set_active_pane(session_id, pane_id).await
    }

    // ===== Pane Management =====

    /// Create a new pane
    pub async fn create_pane(
        &self,
        session_id: String,
        pane_type: PaneType,
        backend_id: Option<String>,
    ) -> Result<PaneState> {
        // Create the pane
        let pane = self
            .panes
            .create_pane(session_id.clone(), pane_type, backend_id)
            .await?;

        // Add pane to session
        self.sessions
            .add_pane_to_session(&session_id, &pane.id)
            .await?;

        Ok(pane)
    }

    /// Get a pane by ID
    pub async fn get_pane(&self, pane_id: &str) -> Option<PaneState> {
        self.panes.get_pane(pane_id).await
    }

    /// List panes for a session
    pub async fn list_panes(&self, session_id: &str) -> Vec<PaneState> {
        self.panes.list_panes(session_id).await
    }

    /// Update an existing pane
    pub async fn update_pane(&self, pane: PaneState) -> Result<()> {
        self.panes.update_pane(pane).await
    }

    /// Delete a pane
    pub async fn delete_pane(&self, pane_id: &str) -> Result<()> {
        // Get the pane to find its session
        let pane = self
            .panes
            .get_pane(pane_id)
            .await
            .ok_or_else(|| OrchflowError::pane_not_found(pane_id))?;

        // Remove pane from session
        self.sessions
            .remove_pane_from_session(&pane.session_id, pane_id)
            .await?;

        // Delete the pane
        self.panes.delete_pane(pane_id).await
    }

    /// Find pane by backend ID
    pub async fn find_pane_by_backend_id(&self, backend_id: &str) -> Option<PaneState> {
        self.panes.find_pane_by_backend_id(backend_id).await
    }

    // ===== Layout Management =====

    /// Update layout for a session
    pub async fn update_layout(&self, session_id: &str, layout: GridLayout) -> Result<()> {
        let mut session = self
            .sessions
            .get_session(session_id)
            .await
            .ok_or_else(|| OrchflowError::session_not_found(session_id))?;

        // Update the layout
        self.layouts.update_layout(&mut session, layout).await?;

        // Save the updated session
        self.sessions.update_session(session).await
    }

    /// Get layout for a session
    pub async fn get_layout(&self, session_id: &str) -> Option<GridLayout> {
        let session = self.sessions.get_session(session_id).await?;
        session.layout
    }

    /// Reset layout for a session
    pub async fn reset_layout(&self, session_id: &str) -> Result<()> {
        let mut session = self
            .sessions
            .get_session(session_id)
            .await
            .ok_or_else(|| OrchflowError::session_not_found(session_id))?;

        // Reset the layout
        self.layouts.reset_layout(&mut session).await?;

        // Save the updated session
        self.sessions.update_session(session).await
    }

    // ===== Settings Management =====

    /// Set a setting
    pub async fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        self.settings.set_setting(key, value).await
    }

    /// Get a setting
    pub async fn get_setting(&self, key: &str) -> Result<Option<String>> {
        self.settings.get_setting(key).await
    }

    /// Delete a setting
    pub async fn delete_setting(&self, key: &str) -> Result<()> {
        self.settings.delete_setting(key).await
    }

    // ===== Persistence Management =====

    /// Persist all dirty state
    pub async fn persist_all(&self) -> Result<()> {
        self.sessions.persist_dirty_sessions().await?;
        self.panes.persist_dirty_panes().await?;
        Ok(())
    }

    /// Alias for persist_all (for backward compatibility)
    pub async fn save_all(&self) -> Result<()> {
        self.persist_all().await
    }

    /// Load all state from storage
    pub async fn load_all(&self) -> Result<()> {
        // Load sessions
        let stored_sessions = self.persistence.load_all_sessions().await?;
        for session in stored_sessions {
            self.sessions.update_session(session).await?;
        }

        // Load panes
        let stored_panes = self.persistence.load_all_panes().await?;
        for pane in stored_panes {
            self.panes.update_pane(pane).await?;
        }

        Ok(())
    }

    // ===== Convenience Methods =====

    /// Create a session with a single pane
    pub async fn create_session_with_pane(
        &self,
        session_name: String,
        pane_type: PaneType,
        backend_id: Option<String>,
    ) -> Result<(SessionState, PaneState)> {
        // Create session
        let session = self.create_session(session_name).await?;

        // Create pane
        let pane = self
            .create_pane(session.id.clone(), pane_type, backend_id)
            .await?;

        // Create a simple layout for the single pane
        let layout = self.layouts.create_single_pane_layout(&pane.id);
        self.update_layout(&session.id, layout).await?;

        // Get updated session
        let updated_session = self
            .get_session(&session.id)
            .await
            .ok_or_else(|| OrchflowError::session_not_found(&session.id))?;

        Ok((updated_session, pane))
    }

    /// Get session statistics
    pub async fn get_session_stats(&self, session_id: &str) -> Option<SessionStats> {
        let session = self.get_session(session_id).await?;
        let panes = self.list_panes(session_id).await;

        Some(SessionStats {
            session_id: session_id.to_string(),
            session_name: session.name,
            pane_count: panes.len(),
            has_layout: session.layout.is_some(),
            active_pane: session.active_pane,
            created_at: session.created_at,
            updated_at: session.updated_at,
        })
    }
}

// Make StateManager cloneable for easier use in async contexts
impl Clone for StateManager {
    fn clone(&self) -> Self {
        Self {
            persistence: self.persistence.clone(),
            events: self.events.clone(),
            sessions: SessionManager::new(self.events.clone(), self.persistence.clone()),
            panes: PaneManager::new(self.events.clone(), self.persistence.clone()),
            layouts: LayoutManager::new(self.events.clone()),
            settings: SettingsManager::new(self.persistence.clone()),
        }
    }
}

// ===== Supporting Types =====

#[derive(Debug, Clone)]
pub struct SessionStats {
    pub session_id: String,
    pub session_name: String,
    pub pane_count: usize,
    pub has_layout: bool,
    pub active_pane: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}
