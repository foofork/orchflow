// Layout management operations

use super::connection::ConnectionManager;
use super::types::{CreateLayout, Layout, UpdateLayout};
use chrono::Utc;
use rusqlite::{params, OptionalExtension, Result as SqliteResult};
use uuid::Uuid;

pub struct LayoutRepository {
    conn_manager: ConnectionManager,
}

impl LayoutRepository {
    pub fn new(conn_manager: ConnectionManager) -> Self {
        Self { conn_manager }
    }

    /// Create a new layout
    pub async fn create_layout(&self, create_layout: CreateLayout) -> SqliteResult<Layout> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().naive_utc();

        let conn = self.conn_manager.conn.lock().unwrap();

        // If this layout is active, deactivate others in the same session
        if create_layout.is_active {
            conn.execute(
                "UPDATE layouts SET is_active = 0 WHERE session_id = ?1",
                params![create_layout.session_id],
            )?;
        }

        conn.execute(
            "INSERT INTO layouts (id, session_id, name, layout_data, is_active, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                id,
                create_layout.session_id,
                create_layout.name,
                create_layout.layout_data,
                create_layout.is_active,
                now,
                now
            ],
        )?;

        Ok(Layout {
            id,
            session_id: create_layout.session_id,
            name: create_layout.name,
            layout_data: create_layout.layout_data,
            is_active: create_layout.is_active,
            created_at: now,
            updated_at: now,
        })
    }

    /// Get a layout by ID
    pub async fn get_layout(&self, layout_id: &str) -> SqliteResult<Option<Layout>> {
        let conn = self.conn_manager.conn.lock().unwrap();
        conn.query_row(
            "SELECT id, session_id, name, layout_data, is_active, created_at, updated_at
             FROM layouts WHERE id = ?1",
            params![layout_id],
            |row| {
                Ok(Layout {
                    id: row.get(0)?,
                    session_id: row.get(1)?,
                    name: row.get(2)?,
                    layout_data: row.get(3)?,
                    is_active: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            },
        )
        .optional()
    }

    /// Get layouts by session ID
    pub async fn get_layouts_by_session(&self, session_id: &str) -> SqliteResult<Vec<Layout>> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, session_id, name, layout_data, is_active, created_at, updated_at
             FROM layouts WHERE session_id = ?1 ORDER BY created_at",
        )?;

        let layout_iter = stmt.query_map(params![session_id], |row| {
            Ok(Layout {
                id: row.get(0)?,
                session_id: row.get(1)?,
                name: row.get(2)?,
                layout_data: row.get(3)?,
                is_active: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?;

        let mut layouts = Vec::new();
        for layout in layout_iter {
            layouts.push(layout?);
        }

        Ok(layouts)
    }

    /// Get active layout for session
    pub async fn get_active_layout(&self, session_id: &str) -> SqliteResult<Option<Layout>> {
        let conn = self.conn_manager.conn.lock().unwrap();
        conn.query_row(
            "SELECT id, session_id, name, layout_data, is_active, created_at, updated_at
             FROM layouts WHERE session_id = ?1 AND is_active = 1",
            params![session_id],
            |row| {
                Ok(Layout {
                    id: row.get(0)?,
                    session_id: row.get(1)?,
                    name: row.get(2)?,
                    layout_data: row.get(3)?,
                    is_active: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            },
        )
        .optional()
    }

    /// Update a layout
    pub async fn update_layout(
        &self,
        layout_id: &str,
        update_layout: UpdateLayout,
    ) -> SqliteResult<Option<Layout>> {
        let conn = self.conn_manager.conn.lock().unwrap();

        // Build dynamic update query
        let mut set_clauses = Vec::new();
        let mut param_values = Vec::new();

        if let Some(name) = &update_layout.name {
            set_clauses.push("name = ?");
            param_values.push(name.clone());
        }

        if let Some(layout_data) = &update_layout.layout_data {
            set_clauses.push("layout_data = ?");
            param_values.push(layout_data.clone());
        }

        if let Some(is_active) = update_layout.is_active {
            set_clauses.push("is_active = ?");
            param_values.push(if is_active {
                "1".to_string()
            } else {
                "0".to_string()
            });

            // If setting this layout as active, deactivate others in the same session
            if is_active {
                // First get the session_id for this layout
                if let Ok(Some(current_layout)) = self.get_layout(layout_id).await {
                    conn.execute(
                        "UPDATE layouts SET is_active = 0 WHERE session_id = ?1 AND id != ?2",
                        params![current_layout.session_id, layout_id],
                    )?;
                }
            }
        }

        // Always update the updated_at timestamp
        let now = Utc::now().naive_utc();
        set_clauses.push("updated_at = ?");
        let now_str = now.format("%Y-%m-%d %H:%M:%S%.f").to_string();
        param_values.push(now_str);

        if set_clauses.is_empty() {
            return self.get_layout(layout_id).await;
        }

        param_values.push(layout_id.to_string());

        let query = format!("UPDATE layouts SET {} WHERE id = ?", set_clauses.join(", "));

        // Convert to parameter array for rusqlite
        let params: Vec<&dyn rusqlite::ToSql> = param_values
            .iter()
            .map(|v| v as &dyn rusqlite::ToSql)
            .collect();
        let rows_affected = conn.execute(&query, &params[..])?;

        if rows_affected > 0 {
            self.get_layout(layout_id).await
        } else {
            Ok(None)
        }
    }

    /// Delete a layout
    pub async fn delete_layout(&self, layout_id: &str) -> SqliteResult<bool> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let rows_affected =
            conn.execute("DELETE FROM layouts WHERE id = ?1", params![layout_id])?;

        Ok(rows_affected > 0)
    }

    /// Delete all layouts for a session
    pub async fn delete_layouts_by_session(&self, session_id: &str) -> SqliteResult<usize> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let rows_affected = conn.execute(
            "DELETE FROM layouts WHERE session_id = ?1",
            params![session_id],
        )?;

        Ok(rows_affected)
    }

    /// Set layout as active (deactivates others in the same session)
    pub async fn set_active_layout(&self, layout_id: &str) -> SqliteResult<bool> {
        let conn = self.conn_manager.conn.lock().unwrap();

        // Get the layout to find its session
        let layout = self.get_layout(layout_id).await?;
        if let Some(layout) = layout {
            // Deactivate all layouts in the session
            conn.execute(
                "UPDATE layouts SET is_active = 0 WHERE session_id = ?1",
                params![layout.session_id],
            )?;

            // Activate the specified layout
            let rows_affected = conn.execute(
                "UPDATE layouts SET is_active = 1, updated_at = ?1 WHERE id = ?2",
                params![Utc::now().naive_utc(), layout_id],
            )?;

            Ok(rows_affected > 0)
        } else {
            Ok(false)
        }
    }

    /// Deactivate all layouts for a session
    pub async fn deactivate_all_layouts(&self, session_id: &str) -> SqliteResult<usize> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let rows_affected = conn.execute(
            "UPDATE layouts SET is_active = 0, updated_at = ?1 WHERE session_id = ?2",
            params![Utc::now().naive_utc(), session_id],
        )?;

        Ok(rows_affected)
    }

    /// Get layout by name within a session
    pub async fn get_layout_by_name(
        &self,
        session_id: &str,
        name: &str,
    ) -> SqliteResult<Option<Layout>> {
        let conn = self.conn_manager.conn.lock().unwrap();
        conn.query_row(
            "SELECT id, session_id, name, layout_data, is_active, created_at, updated_at
             FROM layouts WHERE session_id = ?1 AND name = ?2",
            params![session_id, name],
            |row| {
                Ok(Layout {
                    id: row.get(0)?,
                    session_id: row.get(1)?,
                    name: row.get(2)?,
                    layout_data: row.get(3)?,
                    is_active: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            },
        )
        .optional()
    }

    /// Check if layout exists
    pub async fn layout_exists(&self, layout_id: &str) -> SqliteResult<bool> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM layouts WHERE id = ?1",
            params![layout_id],
            |row| row.get(0),
        )?;

        Ok(count > 0)
    }

    /// Check if layout name is available in session
    pub async fn is_name_available(&self, session_id: &str, name: &str) -> SqliteResult<bool> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM layouts WHERE session_id = ?1 AND name = ?2",
            params![session_id, name],
            |row| row.get(0),
        )?;

        Ok(count == 0)
    }

    /// Get layout count for session
    pub async fn get_layout_count(&self, session_id: &str) -> SqliteResult<usize> {
        let conn = self.conn_manager.conn.lock().unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM layouts WHERE session_id = ?1",
            params![session_id],
            |row| row.get(0),
        )?;

        Ok(count as usize)
    }
}

impl Clone for LayoutRepository {
    fn clone(&self) -> Self {
        Self {
            conn_manager: self.conn_manager.clone(),
        }
    }
}
