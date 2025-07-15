pub mod types;

pub use types::{PaneState, SessionState, StateEvent};

use crate::error::Result;
use crate::storage::StateStore;
use chrono::Utc;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use uuid::Uuid;

pub struct StateManager {
    store: Arc<dyn StateStore>,
    event_tx: broadcast::Sender<StateEvent>,

    // In-memory caches
    sessions: Arc<RwLock<HashMap<String, SessionState>>>,
    panes: Arc<RwLock<HashMap<String, PaneState>>>,
}

impl StateManager {
    pub fn new(store: Arc<dyn StateStore>) -> Self {
        let (event_tx, _) = broadcast::channel(1024);

        Self {
            store,
            event_tx,
            sessions: Arc::new(RwLock::new(HashMap::new())),
            panes: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Subscribe to state events
    pub fn subscribe(&self) -> broadcast::Receiver<StateEvent> {
        self.event_tx.subscribe()
    }

    // Session management

    pub async fn create_session(&self, name: String) -> Result<SessionState> {
        let session = SessionState {
            id: Uuid::new_v4().to_string(),
            name,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            pane_ids: Vec::new(),
            active_pane_id: None,
            layout: None,
            metadata: HashMap::new(),
        };

        // Save to store
        let key = format!("session:{}", session.id);
        self.store
            .set(
                &key,
                serde_json::to_value(&session)
                    .map_err(crate::error::OrchflowError::Serialization)?,
            )
            .await
            .map_err(crate::error::OrchflowError::State)?;

        // Update cache
        let mut sessions = self.sessions.write().await;
        sessions.insert(session.id.clone(), session.clone());

        // Emit event
        let _ = self.event_tx.send(StateEvent::SessionCreated {
            session: session.clone(),
        });

        Ok(session)
    }

    pub async fn get_session(&self, session_id: &str) -> Option<SessionState> {
        let sessions = self.sessions.read().await;
        sessions.get(session_id).cloned()
    }

    pub async fn list_sessions(&self) -> Vec<SessionState> {
        let sessions = self.sessions.read().await;
        sessions.values().cloned().collect()
    }

    pub async fn update_session(&self, session: SessionState) -> Result<()> {
        // Save to store
        let key = format!("session:{}", session.id);
        self.store
            .set(
                &key,
                serde_json::to_value(&session)
                    .map_err(crate::error::OrchflowError::Serialization)?,
            )
            .await
            .map_err(crate::error::OrchflowError::State)?;

        // Update cache
        let mut sessions = self.sessions.write().await;
        sessions.insert(session.id.clone(), session.clone());

        // Emit event
        let _ = self.event_tx.send(StateEvent::SessionUpdated { session });

        Ok(())
    }

    pub async fn delete_session(&self, session_id: &str) -> Result<()> {
        // Delete from store
        let key = format!("session:{session_id}");
        self.store
            .delete(&key)
            .await
            .map_err(crate::error::OrchflowError::State)?;

        // Remove from cache
        let mut sessions = self.sessions.write().await;
        sessions.remove(session_id);

        // Emit event
        let _ = self.event_tx.send(StateEvent::SessionDeleted {
            session_id: session_id.to_string(),
        });

        Ok(())
    }

    // Pane management

    pub async fn create_pane(&self, pane: PaneState) -> Result<PaneState> {
        // Save to store
        let key = format!("pane:{}", pane.id);
        self.store
            .set(
                &key,
                serde_json::to_value(&pane).map_err(crate::error::OrchflowError::Serialization)?,
            )
            .await
            .map_err(crate::error::OrchflowError::State)?;

        // Update cache
        let mut panes = self.panes.write().await;
        panes.insert(pane.id.clone(), pane.clone());

        // Update session
        if let Some(mut session) = self.get_session(&pane.session_id).await {
            session.pane_ids.push(pane.id.clone());
            session.updated_at = Utc::now();
            let _ = self.update_session(session).await;
        }

        // Emit event
        let _ = self
            .event_tx
            .send(StateEvent::PaneCreated { pane: pane.clone() });

        Ok(pane)
    }

    pub async fn get_pane(&self, pane_id: &str) -> Option<PaneState> {
        let panes = self.panes.read().await;
        panes.get(pane_id).cloned()
    }

    pub async fn update_pane(&self, pane: PaneState) -> Result<()> {
        // Save to store
        let key = format!("pane:{}", pane.id);
        self.store
            .set(
                &key,
                serde_json::to_value(&pane).map_err(crate::error::OrchflowError::Serialization)?,
            )
            .await
            .map_err(crate::error::OrchflowError::State)?;

        // Update cache
        let mut panes = self.panes.write().await;
        panes.insert(pane.id.clone(), pane.clone());

        // Emit event
        let _ = self.event_tx.send(StateEvent::PaneUpdated { pane });

        Ok(())
    }

    pub async fn delete_pane(&self, pane_id: &str) -> Result<()> {
        // Get pane to find session
        let pane = {
            let panes = self.panes.read().await;
            panes.get(pane_id).cloned()
        };

        if let Some(pane) = pane {
            // Delete from store
            let key = format!("pane:{pane_id}");
            self.store
                .delete(&key)
                .await
                .map_err(crate::error::OrchflowError::State)?;

            // Remove from cache
            let mut panes = self.panes.write().await;
            panes.remove(pane_id);

            // Update session
            if let Some(mut session) = self.get_session(&pane.session_id).await {
                session.pane_ids.retain(|id| id != pane_id);
                session.updated_at = Utc::now();
                let _ = self.update_session(session).await;
            }

            // Emit event
            let _ = self.event_tx.send(StateEvent::PaneDeleted {
                pane_id: pane_id.to_string(),
            });
        }

        Ok(())
    }

    pub async fn delete_panes_for_session(&self, session_id: &str) -> Result<()> {
        let pane_ids: Vec<String> = {
            let panes = self.panes.read().await;
            panes
                .values()
                .filter(|p| p.session_id == session_id)
                .map(|p| p.id.clone())
                .collect()
        };

        for pane_id in pane_ids {
            let _ = self.delete_pane(&pane_id).await;
        }

        Ok(())
    }

    /// Load state from storage on startup
    pub async fn load_from_storage(&self) -> Result<()> {
        // Load sessions
        let session_keys = self
            .store
            .list_keys(Some("session:"))
            .await
            .map_err(crate::error::OrchflowError::State)?;

        for key in session_keys {
            if let Ok(Some(value)) = self.store.get(&key).await {
                if let Ok(session) = serde_json::from_value::<SessionState>(value) {
                    let mut sessions = self.sessions.write().await;
                    sessions.insert(session.id.clone(), session);
                }
            }
        }

        // Load panes
        let pane_keys = self
            .store
            .list_keys(Some("pane:"))
            .await
            .map_err(crate::error::OrchflowError::State)?;

        for key in pane_keys {
            if let Ok(Some(value)) = self.store.get(&key).await {
                if let Ok(pane) = serde_json::from_value::<PaneState>(value) {
                    let mut panes = self.panes.write().await;
                    panes.insert(pane.id.clone(), pane);
                }
            }
        }

        Ok(())
    }
}

impl Clone for StateManager {
    fn clone(&self) -> Self {
        Self {
            store: self.store.clone(),
            event_tx: self.event_tx.clone(),
            sessions: self.sessions.clone(),
            panes: self.panes.clone(),
        }
    }
}
