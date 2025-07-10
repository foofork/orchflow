use crate::error::{MuxdError, Result};
use crate::protocol::{PaneId, SessionId, PaneType};
use crate::protocol::types::PaneSize;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::fs;
use tracing::{debug, error, info};

/// Persisted state for the terminal manager
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedState {
    pub version: String,
    pub saved_at: DateTime<Utc>,
    pub sessions: Vec<PersistedSession>,
}

/// Persisted session state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedSession {
    pub id: SessionId,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub panes: Vec<PersistedPane>,
    pub active_pane_id: Option<PaneId>,
}

/// Persisted pane state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedPane {
    pub id: PaneId,
    pub pane_type: PaneType,
    pub size: PaneSize,
    pub title: Option<String>,
    pub working_dir: Option<String>,
    pub command: Option<String>,
    pub env: HashMap<String, String>,
    pub output_buffer: Vec<u8>,
    pub created_at: DateTime<Utc>,
}

/// State persistence manager
pub struct StatePersistence {
    state_dir: PathBuf,
}

impl StatePersistence {
    /// Create a new state persistence manager
    pub fn new(state_dir: PathBuf) -> Self {
        Self { state_dir }
    }
    
    /// Get the path for the state file
    fn state_file_path(&self) -> PathBuf {
        self.state_dir.join("muxd_state.json")
    }
    
    /// Get the path for a session backup
    fn session_backup_path(&self, session_id: &SessionId) -> PathBuf {
        self.state_dir.join(format!("session_{}.json", session_id.0))
    }
    
    /// Save the current state
    pub async fn save_state(&self, state: &PersistedState) -> Result<()> {
        // Ensure state directory exists
        fs::create_dir_all(&self.state_dir).await.map_err(|e| 
            MuxdError::IoError(format!("Failed to create state directory: {}", e))
        )?;
        
        let state_path = self.state_file_path();
        let temp_path = state_path.with_extension("tmp");
        
        // Serialize state
        let json = serde_json::to_string_pretty(state).map_err(|e| MuxdError::InvalidRequest {
            reason: format!("Failed to serialize state: {}", e),
        })?;
        
        // Write to temporary file first
        fs::write(&temp_path, json).await.map_err(|e| 
            MuxdError::IoError(format!("Failed to write state file: {}", e))
        )?;
        
        // Atomically rename to final path
        fs::rename(&temp_path, &state_path).await.map_err(|e| 
            MuxdError::IoError(format!("Failed to rename state file: {}", e))
        )?;
        
        info!("State saved to {:?}", state_path);
        Ok(())
    }
    
    /// Load the saved state
    pub async fn load_state(&self) -> Result<Option<PersistedState>> {
        let state_path = self.state_file_path();
        
        if !state_path.exists() {
            debug!("No state file found at {:?}", state_path);
            return Ok(None);
        }
        
        let json = fs::read_to_string(&state_path).await.map_err(|e| 
            MuxdError::IoError(format!("Failed to read state file: {}", e))
        )?;
        
        let state = serde_json::from_str(&json).map_err(|e| MuxdError::InvalidRequest {
            reason: format!("Failed to deserialize state: {}", e),
        })?;
        
        info!("State loaded from {:?}", state_path);
        Ok(Some(state))
    }
    
    /// Save a session backup
    pub async fn backup_session(&self, session: &PersistedSession) -> Result<()> {
        let backup_path = self.session_backup_path(&session.id);
        
        let json = serde_json::to_string_pretty(session).map_err(|e| MuxdError::InvalidRequest {
            reason: format!("Failed to serialize session: {}", e),
        })?;
        
        fs::write(&backup_path, json).await.map_err(|e| 
            MuxdError::IoError(format!("Failed to write session backup: {}", e))
        )?;
        
        debug!("Session {} backed up to {:?}", session.id.0, backup_path);
        Ok(())
    }
    
    /// Load a session backup
    pub async fn load_session_backup(&self, session_id: &SessionId) -> Result<Option<PersistedSession>> {
        let backup_path = self.session_backup_path(session_id);
        
        if !backup_path.exists() {
            return Ok(None);
        }
        
        let json = fs::read_to_string(&backup_path).await.map_err(|e| 
            MuxdError::IoError(format!("Failed to read session backup: {}", e))
        )?;
        
        let session = serde_json::from_str(&json).map_err(|e| MuxdError::InvalidRequest {
            reason: format!("Failed to deserialize session: {}", e),
        })?;
        
        Ok(Some(session))
    }
    
    /// Delete a session backup
    pub async fn delete_session_backup(&self, session_id: &SessionId) -> Result<()> {
        let backup_path = self.session_backup_path(session_id);
        
        if backup_path.exists() {
            fs::remove_file(&backup_path).await.map_err(|e| 
                MuxdError::IoError(format!("Failed to delete session backup: {}", e))
            )?;
            debug!("Session {} backup deleted", session_id.0);
        }
        
        Ok(())
    }
    
    /// Clean up old state files
    pub async fn cleanup_old_states(&self, keep_days: i64) -> Result<()> {
        let cutoff = Utc::now() - chrono::Duration::days(keep_days);
        
        let mut entries = fs::read_dir(&self.state_dir).await.map_err(|e| 
            MuxdError::IoError(format!("Failed to read state directory: {}", e))
        )?;
        
        while let Some(entry) = entries.next_entry().await.map_err(|e| 
            MuxdError::IoError(format!("Failed to read directory entry: {}", e))
        )? {
            let path = entry.path();
            
            // Only process JSON files
            if path.extension() != Some(std::ffi::OsStr::new("json")) {
                continue;
            }
            
            // Check file modification time
            let metadata = entry.metadata().await.map_err(|e| 
                MuxdError::IoError(format!("Failed to read file metadata: {}", e))
            )?;
            
            if let Ok(modified) = metadata.modified() {
                if let Ok(duration) = modified.elapsed() {
                    let file_age = chrono::Duration::from_std(duration).unwrap_or_default();
                    let file_time = Utc::now() - file_age;
                    
                    if file_time < cutoff {
                        if let Err(e) = fs::remove_file(&path).await {
                            error!("Failed to delete old state file {:?}: {}", path, e);
                        } else {
                            debug!("Deleted old state file {:?}", path);
                        }
                    }
                }
            }
        }
        
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[tokio::test]
    async fn test_save_and_load_state() {
        let temp_dir = TempDir::new().unwrap();
        let persistence = StatePersistence::new(temp_dir.path().to_path_buf());
        
        let state = PersistedState {
            version: "1.0.0".to_string(),
            saved_at: Utc::now(),
            sessions: vec![
                PersistedSession {
                    id: SessionId::new(),
                    name: "test-session".to_string(),
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                    panes: vec![
                        PersistedPane {
                            id: PaneId::new(),
                            pane_type: PaneType::Terminal,
                            size: PaneSize::default(),
                            title: Some("Test Pane".to_string()),
                            working_dir: Some("/tmp".to_string()),
                            command: None,
                            env: HashMap::new(),
                            output_buffer: b"test output".to_vec(),
                            created_at: Utc::now(),
                        }
                    ],
                    active_pane_id: None,
                }
            ],
        };
        
        // Save state
        persistence.save_state(&state).await.unwrap();
        
        // Load state
        let loaded = persistence.load_state().await.unwrap();
        assert!(loaded.is_some());
        
        let loaded_state = loaded.unwrap();
        assert_eq!(loaded_state.version, "1.0.0");
        assert_eq!(loaded_state.sessions.len(), 1);
        assert_eq!(loaded_state.sessions[0].name, "test-session");
        assert_eq!(loaded_state.sessions[0].panes.len(), 1);
        assert_eq!(loaded_state.sessions[0].panes[0].title, Some("Test Pane".to_string()));
    }
    
    #[tokio::test]
    async fn test_session_backup() {
        let temp_dir = TempDir::new().unwrap();
        let persistence = StatePersistence::new(temp_dir.path().to_path_buf());
        
        let session = PersistedSession {
            id: SessionId::new(),
            name: "backup-test".to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            panes: vec![],
            active_pane_id: None,
        };
        
        let session_id = session.id.clone();
        
        // Backup session
        persistence.backup_session(&session).await.unwrap();
        
        // Load backup
        let loaded = persistence.load_session_backup(&session_id).await.unwrap();
        assert!(loaded.is_some());
        
        let loaded_session = loaded.unwrap();
        assert_eq!(loaded_session.name, "backup-test");
        
        // Delete backup
        persistence.delete_session_backup(&session_id).await.unwrap();
        
        // Verify deleted
        let deleted = persistence.load_session_backup(&session_id).await.unwrap();
        assert!(deleted.is_none());
    }
    
    #[tokio::test]
    async fn test_cleanup_old_states() {
        let temp_dir = TempDir::new().unwrap();
        let persistence = StatePersistence::new(temp_dir.path().to_path_buf());
        
        // Create an old state file
        let old_state = PersistedState {
            version: "1.0.0".to_string(),
            saved_at: Utc::now() - chrono::Duration::days(10),
            sessions: vec![],
        };
        
        persistence.save_state(&old_state).await.unwrap();
        
        // Create a recent state
        let recent_state = PersistedState {
            version: "1.0.0".to_string(),
            saved_at: Utc::now(),
            sessions: vec![],
        };
        
        persistence.save_state(&recent_state).await.unwrap();
        
        // Clean up states older than 5 days
        persistence.cleanup_old_states(5).await.unwrap();
        
        // Recent state should still exist
        let loaded = persistence.load_state().await.unwrap();
        assert!(loaded.is_some());
    }
}