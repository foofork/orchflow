// Session management operations

use rusqlite::{params, OptionalExtension, Result as SqliteResult};
use chrono::{Utc, NaiveDateTime};
use uuid::Uuid;
use super::types::{Session, CreateSession, UpdateSession};
use super::connection::ConnectionManager;

pub struct SessionRepository {
    conn_manager: ConnectionManager,
}

impl SessionRepository {
    pub fn new(conn_manager: ConnectionManager) -> Self {
        Self { conn_manager }
    }
    
    /// Create a new session
    pub async fn create_session(&self, create_session: CreateSession) -> SqliteResult<Session> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().naive_utc();
        
        let conn = self.conn_manager.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO sessions (id, name, tmux_session, created_at, last_active, metadata)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                id,
                create_session.name,
                create_session.tmux_session,
                now,
                now,
                create_session.metadata
            ],
        )?;
        
        Ok(Session {
            id,
            name: create_session.name,
            tmux_session: create_session.tmux_session,
            created_at: now,
            last_active: now,
            metadata: create_session.metadata,
        })
    }
    
    /// Get a session by ID
    pub async fn get_session(&self, session_id: &str) -> SqliteResult<Option<Session>> {
        let conn = self.conn_manager.conn.lock().unwrap();
        conn.query_row(
            "SELECT id, name, tmux_session, created_at, last_active, metadata
             FROM sessions WHERE id = ?1",
            params![session_id],
            |row| {
                Ok(Session {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    tmux_session: row.get(2)?,
                    created_at: row.get(3)?,
                    last_active: row.get(4)?,
                    metadata: row.get(5)?,
                })
            },
        ).optional()
    }
    
    /// Get a session by name
    pub async fn get_session_by_name(&self, name: &str) -> SqliteResult<Option<Session>> {
        let conn = self.conn_manager.conn.lock().unwrap();
        conn.query_row(
            "SELECT id, name, tmux_session, created_at, last_active, metadata
             FROM sessions WHERE name = ?1",
            params![name],
            |row| {
                Ok(Session {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    tmux_session: row.get(2)?,
                    created_at: row.get(3)?,
                    last_active: row.get(4)?,
                    metadata: row.get(5)?,
                })
            },
        ).optional()
    }
    
    /// List all sessions
    pub async fn list_sessions(&self) -> SqliteResult<Vec<Session>> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, tmux_session, created_at, last_active, metadata
             FROM sessions ORDER BY last_active DESC"
        )?;
        
        let session_iter = stmt.query_map([], |row| {
            Ok(Session {
                id: row.get(0)?,
                name: row.get(1)?,
                tmux_session: row.get(2)?,
                created_at: row.get(3)?,
                last_active: row.get(4)?,
                metadata: row.get(5)?,
            })
        })?;
        
        let mut sessions = Vec::new();
        for session in session_iter {
            sessions.push(session?);
        }
        
        Ok(sessions)
    }
    
    /// Update a session
    pub async fn update_session(&self, session_id: &str, update_session: UpdateSession) -> SqliteResult<Option<Session>> {
        let conn = self.conn_manager.conn.lock().unwrap();
        
        // Build dynamic update query
        let mut set_clauses = Vec::new();
        let mut param_values = Vec::new();
        
        if let Some(name) = &update_session.name {
            set_clauses.push("name = ?");
            param_values.push(name.clone());
        }
        
        if let Some(tmux_session) = &update_session.tmux_session {
            set_clauses.push("tmux_session = ?");
            param_values.push(tmux_session.clone());
        }
        
        if let Some(metadata) = &update_session.metadata {
            set_clauses.push("metadata = ?");
            param_values.push(metadata.clone());
        }
        
        if let Some(last_active) = update_session.last_active {
            set_clauses.push("last_active = ?");
            param_values.push(last_active.format("%Y-%m-%d %H:%M:%S%.f").to_string());
        }
        
        if set_clauses.is_empty() {
            return self.get_session(session_id).await;
        }
        
        param_values.push(session_id.to_string());
        
        let query = format!(
            "UPDATE sessions SET {} WHERE id = ?",
            set_clauses.join(", ")
        );
        
        // Convert to parameter array for rusqlite
        let params: Vec<&dyn rusqlite::ToSql> = param_values.iter().map(|v| v as &dyn rusqlite::ToSql).collect();
        let rows_affected = conn.execute(&query, &params[..])?;
        
        if rows_affected > 0 {
            self.get_session(session_id).await
        } else {
            Ok(None)
        }
    }
    
    /// Delete a session
    pub async fn delete_session(&self, session_id: &str) -> SqliteResult<bool> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let rows_affected = conn.execute(
            "DELETE FROM sessions WHERE id = ?1",
            params![session_id],
        )?;
        
        Ok(rows_affected > 0)
    }
    
    /// Update session last active time
    pub async fn touch_session(&self, session_id: &str) -> SqliteResult<bool> {
        let now = Utc::now().naive_utc();
        let conn = self.conn_manager.conn.lock().unwrap();
        
        let rows_affected = conn.execute(
            "UPDATE sessions SET last_active = ?1 WHERE id = ?2",
            params![now, session_id],
        )?;
        
        Ok(rows_affected > 0)
    }
    
    /// Get sessions by tmux session
    pub async fn get_sessions_by_tmux(&self, tmux_session: &str) -> SqliteResult<Vec<Session>> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, tmux_session, created_at, last_active, metadata
             FROM sessions WHERE tmux_session = ?1"
        )?;
        
        let session_iter = stmt.query_map(params![tmux_session], |row| {
            Ok(Session {
                id: row.get(0)?,
                name: row.get(1)?,
                tmux_session: row.get(2)?,
                created_at: row.get(3)?,
                last_active: row.get(4)?,
                metadata: row.get(5)?,
            })
        })?;
        
        let mut sessions = Vec::new();
        for session in session_iter {
            sessions.push(session?);
        }
        
        Ok(sessions)
    }
    
    /// Get recently active sessions
    pub async fn get_recent_sessions(&self, limit: usize) -> SqliteResult<Vec<Session>> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, tmux_session, created_at, last_active, metadata
             FROM sessions ORDER BY last_active DESC LIMIT ?1"
        )?;
        
        let session_iter = stmt.query_map(params![limit], |row| {
            Ok(Session {
                id: row.get(0)?,
                name: row.get(1)?,
                tmux_session: row.get(2)?,
                created_at: row.get(3)?,
                last_active: row.get(4)?,
                metadata: row.get(5)?,
            })
        })?;
        
        let mut sessions = Vec::new();
        for session in session_iter {
            sessions.push(session?);
        }
        
        Ok(sessions)
    }
    
    /// Check if session exists
    pub async fn session_exists(&self, session_id: &str) -> SqliteResult<bool> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM sessions WHERE id = ?1",
            params![session_id],
            |row| row.get(0),
        )?;
        
        Ok(count > 0)
    }
    
    /// Check if session name is available
    pub async fn is_name_available(&self, name: &str) -> SqliteResult<bool> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM sessions WHERE name = ?1",
            params![name],
            |row| row.get(0),
        )?;
        
        Ok(count == 0)
    }
}

impl Clone for SessionRepository {
    fn clone(&self) -> Self {
        Self {
            conn_manager: self.conn_manager.clone(),
        }
    }
}