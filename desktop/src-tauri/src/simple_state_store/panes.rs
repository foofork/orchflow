// Pane management operations

use super::connection::ConnectionManager;
use super::types::{CreatePane, Pane, UpdatePane};
use chrono::Utc;
use rusqlite::{params, OptionalExtension, Result as SqliteResult};
use uuid::Uuid;

pub struct PaneRepository {
    conn_manager: ConnectionManager,
}

impl PaneRepository {
    pub fn new(conn_manager: ConnectionManager) -> Self {
        Self { conn_manager }
    }

    /// Create a new pane
    pub async fn create_pane(&self, create_pane: CreatePane) -> SqliteResult<Pane> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().naive_utc();

        let conn = self.conn_manager.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO panes (id, session_id, tmux_pane, pane_type, content, metadata, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                id,
                create_pane.session_id,
                create_pane.tmux_pane,
                create_pane.pane_type,
                create_pane.content,
                create_pane.metadata,
                now
            ],
        )?;

        Ok(Pane {
            id,
            session_id: create_pane.session_id,
            tmux_pane: create_pane.tmux_pane,
            pane_type: create_pane.pane_type,
            content: create_pane.content,
            metadata: create_pane.metadata,
            created_at: now,
        })
    }

    /// Get a pane by ID
    pub async fn get_pane(&self, pane_id: &str) -> SqliteResult<Option<Pane>> {
        let conn = self.conn_manager.conn.lock().unwrap();
        conn.query_row(
            "SELECT id, session_id, tmux_pane, pane_type, content, metadata, created_at
             FROM panes WHERE id = ?1",
            params![pane_id],
            |row| {
                Ok(Pane {
                    id: row.get(0)?,
                    session_id: row.get(1)?,
                    tmux_pane: row.get(2)?,
                    pane_type: row.get(3)?,
                    content: row.get(4)?,
                    metadata: row.get(5)?,
                    created_at: row.get(6)?,
                })
            },
        )
        .optional()
    }

    /// Get panes by session ID
    pub async fn get_panes_by_session(&self, session_id: &str) -> SqliteResult<Vec<Pane>> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, session_id, tmux_pane, pane_type, content, metadata, created_at
             FROM panes WHERE session_id = ?1 ORDER BY created_at",
        )?;

        let pane_iter = stmt.query_map(params![session_id], |row| {
            Ok(Pane {
                id: row.get(0)?,
                session_id: row.get(1)?,
                tmux_pane: row.get(2)?,
                pane_type: row.get(3)?,
                content: row.get(4)?,
                metadata: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;

        let mut panes = Vec::new();
        for pane in pane_iter {
            panes.push(pane?);
        }

        Ok(panes)
    }

    /// Get pane by tmux pane ID
    pub async fn get_pane_by_tmux(&self, tmux_pane: &str) -> SqliteResult<Option<Pane>> {
        let conn = self.conn_manager.conn.lock().unwrap();
        conn.query_row(
            "SELECT id, session_id, tmux_pane, pane_type, content, metadata, created_at
             FROM panes WHERE tmux_pane = ?1",
            params![tmux_pane],
            |row| {
                Ok(Pane {
                    id: row.get(0)?,
                    session_id: row.get(1)?,
                    tmux_pane: row.get(2)?,
                    pane_type: row.get(3)?,
                    content: row.get(4)?,
                    metadata: row.get(5)?,
                    created_at: row.get(6)?,
                })
            },
        )
        .optional()
    }

    /// Update a pane
    pub async fn update_pane(
        &self,
        pane_id: &str,
        update_pane: UpdatePane,
    ) -> SqliteResult<Option<Pane>> {
        let conn = self.conn_manager.conn.lock().unwrap();

        // Build dynamic update query
        let mut set_clauses = Vec::new();
        let mut param_values = Vec::new();

        if let Some(tmux_pane) = &update_pane.tmux_pane {
            set_clauses.push("tmux_pane = ?");
            param_values.push(tmux_pane.clone());
        }

        if let Some(pane_type) = &update_pane.pane_type {
            set_clauses.push("pane_type = ?");
            param_values.push(pane_type.clone());
        }

        if let Some(content) = &update_pane.content {
            set_clauses.push("content = ?");
            param_values.push(content.clone());
        }

        if let Some(metadata) = &update_pane.metadata {
            set_clauses.push("metadata = ?");
            param_values.push(metadata.clone());
        }

        if set_clauses.is_empty() {
            return self.get_pane(pane_id).await;
        }

        param_values.push(pane_id.to_string());

        let query = format!("UPDATE panes SET {} WHERE id = ?", set_clauses.join(", "));

        // Convert to parameter array for rusqlite
        let params: Vec<&dyn rusqlite::ToSql> = param_values
            .iter()
            .map(|v| v as &dyn rusqlite::ToSql)
            .collect();
        let rows_affected = conn.execute(&query, &params[..])?;

        if rows_affected > 0 {
            self.get_pane(pane_id).await
        } else {
            Ok(None)
        }
    }

    /// Delete a pane
    pub async fn delete_pane(&self, pane_id: &str) -> SqliteResult<bool> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let rows_affected = conn.execute("DELETE FROM panes WHERE id = ?1", params![pane_id])?;

        Ok(rows_affected > 0)
    }

    /// Delete all panes for a session
    pub async fn delete_panes_by_session(&self, session_id: &str) -> SqliteResult<usize> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let rows_affected = conn.execute(
            "DELETE FROM panes WHERE session_id = ?1",
            params![session_id],
        )?;

        Ok(rows_affected)
    }

    /// List all panes
    pub async fn list_all_panes(&self) -> SqliteResult<Vec<Pane>> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, session_id, tmux_pane, pane_type, content, metadata, created_at
             FROM panes ORDER BY created_at",
        )?;

        let pane_iter = stmt.query_map([], |row| {
            Ok(Pane {
                id: row.get(0)?,
                session_id: row.get(1)?,
                tmux_pane: row.get(2)?,
                pane_type: row.get(3)?,
                content: row.get(4)?,
                metadata: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;

        let mut panes = Vec::new();
        for pane in pane_iter {
            panes.push(pane?);
        }

        Ok(panes)
    }

    /// Get panes by type
    pub async fn get_panes_by_type(&self, pane_type: &str) -> SqliteResult<Vec<Pane>> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, session_id, tmux_pane, pane_type, content, metadata, created_at
             FROM panes WHERE pane_type = ?1 ORDER BY created_at",
        )?;

        let pane_iter = stmt.query_map(params![pane_type], |row| {
            Ok(Pane {
                id: row.get(0)?,
                session_id: row.get(1)?,
                tmux_pane: row.get(2)?,
                pane_type: row.get(3)?,
                content: row.get(4)?,
                metadata: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;

        let mut panes = Vec::new();
        for pane in pane_iter {
            panes.push(pane?);
        }

        Ok(panes)
    }

    /// Update pane content (for caching scrollback)
    pub async fn update_pane_content(&self, pane_id: &str, content: &str) -> SqliteResult<bool> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let rows_affected = conn.execute(
            "UPDATE panes SET content = ?1 WHERE id = ?2",
            params![content, pane_id],
        )?;

        Ok(rows_affected > 0)
    }

    /// Check if pane exists
    pub async fn pane_exists(&self, pane_id: &str) -> SqliteResult<bool> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM panes WHERE id = ?1",
            params![pane_id],
            |row| row.get(0),
        )?;

        Ok(count > 0)
    }

    /// Get pane count for session
    pub async fn get_pane_count(&self, session_id: &str) -> SqliteResult<usize> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM panes WHERE session_id = ?1",
            params![session_id],
            |row| row.get(0),
        )?;

        Ok(count as usize)
    }

    /// Get panes with content (for search/analysis)
    pub async fn get_panes_with_content(&self) -> SqliteResult<Vec<Pane>> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, session_id, tmux_pane, pane_type, content, metadata, created_at
             FROM panes WHERE content IS NOT NULL AND content != '' ORDER BY created_at",
        )?;

        let pane_iter = stmt.query_map([], |row| {
            Ok(Pane {
                id: row.get(0)?,
                session_id: row.get(1)?,
                tmux_pane: row.get(2)?,
                pane_type: row.get(3)?,
                content: row.get(4)?,
                metadata: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;

        let mut panes = Vec::new();
        for pane in pane_iter {
            panes.push(pane?);
        }

        Ok(panes)
    }
}

impl Clone for PaneRepository {
    fn clone(&self) -> Self {
        Self {
            conn_manager: self.conn_manager.clone(),
        }
    }
}
