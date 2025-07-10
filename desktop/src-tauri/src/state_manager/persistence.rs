// State persistence and storage management

use std::sync::Arc;
use crate::simple_state_store::SimpleStateStore;
use crate::error::{OrchflowError, Result};
use super::types::{SessionState, PaneState};

#[derive(Clone)]
pub struct PersistenceManager {
    store: Arc<SimpleStateStore>,
}

impl PersistenceManager {
    pub fn new(store: Arc<SimpleStateStore>) -> Self {
        Self { store }
    }
    
    /// Save a session to storage
    pub async fn save_session(&self, session: &SessionState) -> Result<()> {
        let session_data = serde_json::to_string(session)
            .map_err(|e| OrchflowError::internal_error("serialize_session", &e.to_string()))?;
        
        self.store.set(&format!("session:{}", session.id), &session_data)
            .await
            .map_err(|e| OrchflowError::internal_error("save_session", &e.to_string()))?;
        
        Ok(())
    }
    
    /// Load a session from storage
    pub async fn load_session(&self, session_id: &str) -> Result<Option<SessionState>> {
        let session_data = self.store.get(&format!("session:{}", session_id))
            .await
            .map_err(|e| OrchflowError::internal_error("load_session", &e.to_string()))?;
        
        match session_data {
            Some(data) => {
                let session: SessionState = serde_json::from_str(&data)
                    .map_err(|e| OrchflowError::internal_error("deserialize_session", &e.to_string()))?;
                Ok(Some(session))
            }
            None => Ok(None),
        }
    }
    
    /// Delete a session from storage
    pub async fn delete_session(&self, session_id: &str) -> Result<()> {
        self.store.delete(&format!("session:{}", session_id))
            .await
            .map_err(|e| OrchflowError::internal_error("delete_session", &e.to_string()))?;
        
        Ok(())
    }
    
    /// Save a pane to storage
    pub async fn save_pane(&self, pane: &PaneState) -> Result<()> {
        let pane_data = serde_json::to_string(pane)
            .map_err(|e| OrchflowError::internal_error("serialize_pane", &e.to_string()))?;
        
        self.store.set(&format!("pane:{}", pane.id), &pane_data)
            .await
            .map_err(|e| OrchflowError::internal_error("save_pane", &e.to_string()))?;
        
        Ok(())
    }
    
    /// Load a pane from storage
    pub async fn load_pane(&self, pane_id: &str) -> Result<Option<PaneState>> {
        let pane_data = self.store.get(&format!("pane:{}", pane_id))
            .await
            .map_err(|e| OrchflowError::internal_error("load_pane", &e.to_string()))?;
        
        match pane_data {
            Some(data) => {
                let pane: PaneState = serde_json::from_str(&data)
                    .map_err(|e| OrchflowError::internal_error("deserialize_pane", &e.to_string()))?;
                Ok(Some(pane))
            }
            None => Ok(None),
        }
    }
    
    /// Delete a pane from storage
    pub async fn delete_pane(&self, pane_id: &str) -> Result<()> {
        self.store.delete(&format!("pane:{}", pane_id))
            .await
            .map_err(|e| OrchflowError::internal_error("delete_pane", &e.to_string()))?;
        
        Ok(())
    }
    
    /// Load all sessions from storage
    pub async fn load_all_sessions(&self) -> Result<Vec<SessionState>> {
        let keys = self.store.keys_with_prefix("session:")
            .await
            .map_err(|e| OrchflowError::internal_error("load_session_keys", &e.to_string()))?;
        
        let mut sessions = Vec::new();
        
        for key in keys {
            if let Some(session_id) = key.strip_prefix("session:") {
                if let Some(session) = self.load_session(session_id).await? {
                    sessions.push(session);
                }
            }
        }
        
        Ok(sessions)
    }
    
    /// Load all panes from storage
    pub async fn load_all_panes(&self) -> Result<Vec<PaneState>> {
        let keys = self.store.keys_with_prefix("pane:")
            .await
            .map_err(|e| OrchflowError::internal_error("load_pane_keys", &e.to_string()))?;
        
        let mut panes = Vec::new();
        
        for key in keys {
            if let Some(pane_id) = key.strip_prefix("pane:") {
                if let Some(pane) = self.load_pane(pane_id).await? {
                    panes.push(pane);
                }
            }
        }
        
        Ok(panes)
    }
    
    /// Save a setting
    pub async fn save_setting(&self, key: &str, value: &str) -> Result<()> {
        self.store.set(&format!("setting:{}", key), value)
            .await
            .map_err(|e| OrchflowError::internal_error("save_setting", &e.to_string()))?;
        
        Ok(())
    }
    
    /// Load a setting
    pub async fn load_setting(&self, key: &str) -> Result<Option<String>> {
        self.store.get(&format!("setting:{}", key))
            .await
            .map_err(|e| OrchflowError::internal_error("load_setting", &e.to_string()))
    }
    
    /// Delete a setting
    pub async fn delete_setting(&self, key: &str) -> Result<()> {
        self.store.delete(&format!("setting:{}", key))
            .await
            .map_err(|e| OrchflowError::internal_error("delete_setting", &e.to_string()))?;
        
        Ok(())
    }
    
    /// Perform batch operations
    pub async fn batch_save_sessions(&self, sessions: &[SessionState]) -> Result<()> {
        for session in sessions {
            self.save_session(session).await?;
        }
        Ok(())
    }
    
    /// Perform batch operations for panes
    pub async fn batch_save_panes(&self, panes: &[PaneState]) -> Result<()> {
        for pane in panes {
            self.save_pane(pane).await?;
        }
        Ok(())
    }
    
    /// Clear all state data (for testing or reset)
    pub async fn clear_all_state(&self) -> Result<()> {
        // Get all state-related keys
        let session_keys = self.store.keys_with_prefix("session:")
            .await
            .map_err(|e| OrchflowError::internal_error("clear_sessions", &e.to_string()))?;
        
        let pane_keys = self.store.keys_with_prefix("pane:")
            .await
            .map_err(|e| OrchflowError::internal_error("clear_panes", &e.to_string()))?;
        
        // Delete all session and pane data
        for key in session_keys.into_iter().chain(pane_keys.into_iter()) {
            self.store.delete(&key)
                .await
                .map_err(|e| OrchflowError::internal_error("clear_state_key", &e.to_string()))?;
        }
        
        Ok(())
    }
}