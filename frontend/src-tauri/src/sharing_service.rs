// Basic sharing service for orchflow
// Provides functionality to share terminal sessions, configs, etc.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SharedSession {
    pub id: String,
    pub name: String,
    pub config: String, // JSON configuration
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone)]
pub struct SharingService {
    shared_sessions: Arc<Mutex<HashMap<String, SharedSession>>>,
}

impl SharingService {
    pub fn new() -> Self {
        Self {
            shared_sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }
    
    pub fn share_session(&self, session: SharedSession) -> Result<String, String> {
        let mut sessions = self.shared_sessions.lock()
            .map_err(|e| format!("Failed to lock shared sessions: {}", e))?;
        
        let id = session.id.clone();
        sessions.insert(id.clone(), session);
        
        Ok(id)
    }
    
    pub fn get_shared_session(&self, id: &str) -> Option<SharedSession> {
        let sessions = self.shared_sessions.lock().ok()?;
        sessions.get(id).cloned()
    }
    
    pub fn list_shared_sessions(&self) -> Vec<SharedSession> {
        let sessions = self.shared_sessions.lock()
            .unwrap_or_else(|_| panic!("Failed to lock shared sessions"));
        sessions.values().cloned().collect()
    }
}

impl Default for SharingService {
    fn default() -> Self {
        Self::new()
    }
}