// Pane CRUD operations

use super::events::EventManager;
use super::persistence::PersistenceManager;
use super::types::{PaneState, PaneType, StateEvent};
use crate::error::{OrchflowError, Result};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

pub struct PaneManager {
    panes: Arc<RwLock<HashMap<String, PaneState>>>,
    events: EventManager,
    persistence: PersistenceManager,
    dirty_panes: Arc<RwLock<HashMap<String, bool>>>,
}

impl PaneManager {
    pub fn new(events: EventManager, persistence: PersistenceManager) -> Self {
        Self {
            panes: Arc::new(RwLock::new(HashMap::new())),
            events,
            persistence,
            dirty_panes: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Create a new pane
    pub async fn create_pane(
        &self,
        session_id: String,
        pane_type: PaneType,
        backend_id: Option<String>,
    ) -> Result<PaneState> {
        let pane_id = Uuid::new_v4().to_string();
        let pane = PaneState::new(pane_id, session_id, pane_type, backend_id);

        // Validate pane
        self.validate_pane(&pane).await?;

        // Store in memory
        {
            let mut panes = self.panes.write().await;
            panes.insert(pane.id.clone(), pane.clone());
        }

        // Mark as dirty
        self.mark_dirty(&pane.id).await;

        // Emit event
        self.events
            .emit(StateEvent::PaneCreated { pane: pane.clone() });

        // Persist to storage
        self.persistence.save_pane(&pane).await?;

        Ok(pane)
    }

    /// Get a pane by ID
    pub async fn get_pane(&self, pane_id: &str) -> Option<PaneState> {
        let panes = self.panes.read().await;
        panes.get(pane_id).cloned()
    }

    /// List panes for a specific session
    pub async fn list_panes(&self, session_id: &str) -> Vec<PaneState> {
        let panes = self.panes.read().await;
        panes
            .values()
            .filter(|pane| pane.session_id == session_id)
            .cloned()
            .collect()
    }

    /// List all panes
    pub async fn list_all_panes(&self) -> Vec<PaneState> {
        let panes = self.panes.read().await;
        panes.values().cloned().collect()
    }

    /// Update an existing pane
    pub async fn update_pane(&self, pane: PaneState) -> Result<()> {
        // Validate pane
        self.validate_pane(&pane).await?;

        // Check if pane exists
        {
            let panes = self.panes.read().await;
            if !panes.contains_key(&pane.id) {
                return Err(OrchflowError::pane_not_found(&pane.id));
            }
        }

        // Update in memory
        {
            let mut panes = self.panes.write().await;
            panes.insert(pane.id.clone(), pane.clone());
        }

        // Mark as dirty
        self.mark_dirty(&pane.id).await;

        // Emit event
        self.events
            .emit(StateEvent::PaneUpdated { pane: pane.clone() });

        // Persist to storage
        self.persistence.save_pane(&pane).await?;

        Ok(())
    }

    /// Delete a pane
    pub async fn delete_pane(&self, pane_id: &str) -> Result<()> {
        // Check if pane exists
        let pane = {
            let panes = self.panes.read().await;
            panes.get(pane_id).cloned()
        };

        let _pane = pane.ok_or_else(|| OrchflowError::pane_not_found(pane_id))?;

        // Remove from memory
        {
            let mut panes = self.panes.write().await;
            panes.remove(pane_id);
        }

        // Clean up dirty tracking
        {
            let mut dirty = self.dirty_panes.write().await;
            dirty.remove(pane_id);
        }

        // Emit event
        self.events.emit(StateEvent::PaneDeleted {
            pane_id: pane_id.to_string(),
        });

        // Remove from storage
        self.persistence.delete_pane(pane_id).await?;

        Ok(())
    }

    /// Update pane title
    pub async fn update_pane_title(&self, pane_id: &str, title: String) -> Result<()> {
        let mut pane = self
            .get_pane(pane_id)
            .await
            .ok_or_else(|| OrchflowError::pane_not_found(pane_id))?;

        pane.set_title(title);
        self.update_pane(pane).await
    }

    /// Update pane working directory
    pub async fn update_pane_working_dir(
        &self,
        pane_id: &str,
        working_dir: Option<String>,
    ) -> Result<()> {
        let mut pane = self
            .get_pane(pane_id)
            .await
            .ok_or_else(|| OrchflowError::pane_not_found(pane_id))?;

        pane.set_working_dir(working_dir);
        self.update_pane(pane).await
    }

    /// Update pane command
    pub async fn update_pane_command(&self, pane_id: &str, command: Option<String>) -> Result<()> {
        let mut pane = self
            .get_pane(pane_id)
            .await
            .ok_or_else(|| OrchflowError::pane_not_found(pane_id))?;

        pane.set_command(command);
        self.update_pane(pane).await
    }

    /// Get panes by type
    pub async fn get_panes_by_type(&self, pane_type: &PaneType) -> Vec<PaneState> {
        let panes = self.panes.read().await;
        panes
            .values()
            .filter(|pane| &pane.pane_type == pane_type)
            .cloned()
            .collect()
    }

    /// Get panes by backend ID
    pub async fn get_panes_by_backend_id(&self, backend_id: &str) -> Vec<PaneState> {
        let panes = self.panes.read().await;
        panes
            .values()
            .filter(|pane| pane.backend_id.as_ref() == Some(&backend_id.to_string()))
            .cloned()
            .collect()
    }

    /// Find pane by backend ID
    pub async fn find_pane_by_backend_id(&self, backend_id: &str) -> Option<PaneState> {
        let panes = self.panes.read().await;
        panes
            .values()
            .find(|pane| pane.backend_id.as_ref() == Some(&backend_id.to_string()))
            .cloned()
    }

    /// Validate a pane
    async fn validate_pane(&self, pane: &PaneState) -> Result<()> {
        if pane.id.is_empty() {
            return Err(OrchflowError::validation_error(
                "pane_id",
                "Pane ID cannot be empty",
            ));
        }

        if pane.session_id.is_empty() {
            return Err(OrchflowError::validation_error(
                "session_id",
                "Session ID cannot be empty",
            ));
        }

        if pane.title.is_empty() {
            return Err(OrchflowError::validation_error(
                "pane_title",
                "Pane title cannot be empty",
            ));
        }

        Ok(())
    }

    /// Mark a pane as dirty for persistence
    async fn mark_dirty(&self, pane_id: &str) {
        let mut dirty = self.dirty_panes.write().await;
        dirty.insert(pane_id.to_string(), true);
    }

    /// Get dirty panes
    pub async fn get_dirty_panes(&self) -> Vec<String> {
        let dirty = self.dirty_panes.read().await;
        dirty.keys().cloned().collect()
    }

    /// Clear dirty status for a pane
    pub async fn clear_dirty(&self, pane_id: &str) {
        let mut dirty = self.dirty_panes.write().await;
        dirty.remove(pane_id);
    }

    /// Persist all dirty panes
    pub async fn persist_dirty_panes(&self) -> Result<()> {
        let dirty_ids = self.get_dirty_panes().await;

        for pane_id in dirty_ids {
            if let Some(pane) = self.get_pane(&pane_id).await {
                self.persistence.save_pane(&pane).await?;
                self.clear_dirty(&pane_id).await;
            }
        }

        Ok(())
    }

    /// Delete all panes for a session
    pub async fn delete_panes_for_session(&self, session_id: &str) -> Result<()> {
        let pane_ids: Vec<String> = {
            let panes = self.panes.read().await;
            panes
                .values()
                .filter(|pane| pane.session_id == session_id)
                .map(|pane| pane.id.clone())
                .collect()
        };

        for pane_id in pane_ids {
            self.delete_pane(&pane_id).await?;
        }

        Ok(())
    }
}
