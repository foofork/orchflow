// Command History Repository - Dedicated repository for command history management

use super::connection::ConnectionManager;
use super::types::CommandEntry;
use chrono::{DateTime, Utc};
use rusqlite::{params, Result as SqliteResult};

#[cfg(test)]
#[path = "command_history_migration_test.rs"]
mod migration_tests;

#[derive(Clone)]
pub struct CommandHistoryRepository {
    conn_manager: ConnectionManager,
}

impl CommandHistoryRepository {
    pub fn new(conn_manager: ConnectionManager) -> Self {
        Self { conn_manager }
    }

    /// Initialize command history schema
    pub fn initialize_schema(&self) -> SqliteResult<()> {
        self.conn_manager.with_connection(|conn| {
            conn.execute(
                "CREATE TABLE IF NOT EXISTS command_history (
                    id TEXT PRIMARY KEY,
                    pane_id TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    command TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    working_dir TEXT,
                    exit_code INTEGER,
                    duration_ms INTEGER,
                    shell_type TEXT,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
                    FOREIGN KEY (pane_id) REFERENCES panes(id) ON DELETE CASCADE
                )",
                [],
            )?;

            // Create indexes for efficient querying
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_command_history_session 
                 ON command_history(session_id)",
                [],
            )?;
            
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_command_history_pane 
                 ON command_history(pane_id)",
                [],
            )?;
            
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_command_history_timestamp 
                 ON command_history(timestamp DESC)",
                [],
            )?;
            
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_command_history_command 
                 ON command_history(command)",
                [],
            )?;

            Ok(())
        })
    }

    /// Save a command entry to history
    pub async fn save_command_entry(&self, entry: &CommandEntry) -> SqliteResult<()> {
        
        self.conn_manager.with_connection(|conn| {
            conn.execute(
                "INSERT INTO command_history 
                 (id, pane_id, session_id, command, timestamp, working_dir, 
                  exit_code, duration_ms, shell_type)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    entry.id,
                    entry.pane_id,
                    entry.session_id,
                    entry.command,
                    entry.timestamp.to_rfc3339(),
                    entry.working_dir,
                    entry.exit_code,
                    entry.duration_ms,
                    entry.shell_type,
                ],
            )?;
            Ok(())
        })
    }

    /// Search command history
    pub async fn search_commands(
        &self,
        query: &str,
        pane_id: Option<&str>,
        session_id: Option<&str>,
        limit: usize,
    ) -> SqliteResult<Vec<CommandEntry>> {
        self.conn_manager.with_connection(|conn| {
            let mut sql = String::from(
                "SELECT id, pane_id, session_id, command, timestamp, working_dir, 
                        exit_code, duration_ms, shell_type
                 FROM command_history WHERE 1=1"
            );
            let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
            
            if !query.is_empty() {
                sql.push_str(" AND command LIKE ?");
                params_vec.push(Box::new(format!("%{}%", query)));
            }
            
            if let Some(pane) = pane_id {
                sql.push_str(" AND pane_id = ?");
                params_vec.push(Box::new(pane.to_string()));
            }
            
            if let Some(session) = session_id {
                sql.push_str(" AND session_id = ?");
                params_vec.push(Box::new(session.to_string()));
            }
            
            sql.push_str(" ORDER BY timestamp DESC LIMIT ?");
            params_vec.push(Box::new(limit as i64));
            
            let mut stmt = conn.prepare(&sql)?;
            let params_refs: Vec<&dyn rusqlite::ToSql> = 
                params_vec.iter().map(|b| b.as_ref()).collect();
            
            let entries = stmt.query_map(&params_refs[..], |row| {
                Ok(CommandEntry {
                    id: row.get(0)?,
                    pane_id: row.get(1)?,
                    session_id: row.get(2)?,
                    command: row.get(3)?,
                    timestamp: DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
                        .map_err(|e| rusqlite::Error::FromSqlConversionFailure(
                            4, 
                            rusqlite::types::Type::Text,
                            Box::new(e)
                        ))?
                        .with_timezone(&Utc),
                    working_dir: row.get(5)?,
                    exit_code: row.get(6)?,
                    duration_ms: row.get(7)?,
                    shell_type: row.get(8)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
            
            Ok(entries)
        })
    }

    /// Get command statistics
    pub async fn get_command_stats(
        &self,
        limit: usize,
    ) -> SqliteResult<Vec<crate::command_history::CommandStats>> {
        self.conn_manager.with_connection(|conn| {
            let mut stmt = conn.prepare(
                "SELECT 
                    command,
                    COUNT(*) as frequency,
                    MAX(timestamp) as last_used,
                    AVG(CASE WHEN duration_ms IS NOT NULL THEN duration_ms END) as avg_duration,
                    SUM(CASE WHEN exit_code = 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate
                 FROM command_history
                 GROUP BY command
                 ORDER BY frequency DESC
                 LIMIT ?"
            )?;
            
            let stats = stmt.query_map(params![limit], |row| {
                let last_used_str: String = row.get(2)?;
                let last_used = DateTime::parse_from_rfc3339(&last_used_str)
                    .map_err(|e| rusqlite::Error::FromSqlConversionFailure(
                        2,
                        rusqlite::types::Type::Text,
                        Box::new(e)
                    ))?
                    .with_timezone(&Utc);
                    
                Ok(crate::command_history::CommandStats {
                    command: row.get(0)?,
                    frequency: row.get(1)?,
                    last_used,
                    average_duration_ms: row.get(3)?,
                    success_rate: row.get(4)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
            
            Ok(stats)
        })
    }

    /// Delete old command history entries
    pub async fn delete_old_entries(
        &self,
        cutoff: DateTime<Utc>,
    ) -> SqliteResult<usize> {
        self.conn_manager.with_connection(|conn| {
            let deleted = conn.execute(
                "DELETE FROM command_history WHERE timestamp < ?",
                params![cutoff.to_rfc3339()],
            )?;
            Ok(deleted)
        })
    }

    /// Get all command history entries
    pub async fn get_all_entries(
        &self,
        pane_id: Option<&str>,
        session_id: Option<&str>,
    ) -> SqliteResult<Vec<CommandEntry>> {
        self.conn_manager.with_connection(|conn| {
            let mut sql = String::from(
                "SELECT id, pane_id, session_id, command, timestamp, working_dir, 
                        exit_code, duration_ms, shell_type
                 FROM command_history WHERE 1=1"
            );
            let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
            
            if let Some(pane) = pane_id {
                sql.push_str(" AND pane_id = ?");
                params_vec.push(Box::new(pane.to_string()));
            }
            
            if let Some(session) = session_id {
                sql.push_str(" AND session_id = ?");
                params_vec.push(Box::new(session.to_string()));
            }
            
            sql.push_str(" ORDER BY timestamp DESC");
            
            let mut stmt = conn.prepare(&sql)?;
            let params_refs: Vec<&dyn rusqlite::ToSql> = 
                params_vec.iter().map(|b| b.as_ref()).collect();
            
            let entries = stmt.query_map(&params_refs[..], |row| {
                Ok(CommandEntry {
                    id: row.get(0)?,
                    pane_id: row.get(1)?,
                    session_id: row.get(2)?,
                    command: row.get(3)?,
                    timestamp: DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
                        .map_err(|e| rusqlite::Error::FromSqlConversionFailure(
                            4, 
                            rusqlite::types::Type::Text,
                            Box::new(e)
                        ))?
                        .with_timezone(&Utc),
                    working_dir: row.get(5)?,
                    exit_code: row.get(6)?,
                    duration_ms: row.get(7)?,
                    shell_type: row.get(8)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
            
            Ok(entries)
        })
    }

    /// Count total command history entries
    pub async fn count_entries(&self) -> SqliteResult<usize> {
        self.conn_manager.with_connection(|conn| {
            let count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM command_history",
                [],
                |row| row.get(0),
            )?;
            Ok(count as usize)
        })
    }

    /// Get oldest entries for cleanup
    pub async fn get_oldest_entries(&self, count: usize) -> SqliteResult<Vec<String>> {
        self.conn_manager.with_connection(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id FROM command_history 
                 ORDER BY timestamp ASC 
                 LIMIT ?"
            )?;
            
            let ids = stmt.query_map(params![count], |row| row.get(0))?
                .collect::<Result<Vec<String>, _>>()?;
            
            Ok(ids)
        })
    }

    /// Delete entries by IDs
    pub async fn delete_by_ids(&self, ids: &[String]) -> SqliteResult<usize> {
        if ids.is_empty() {
            return Ok(0);
        }
        
        self.conn_manager.with_connection(|conn| {
            let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
            let sql = format!("DELETE FROM command_history WHERE id IN ({})", placeholders);
            
            let params: Vec<&dyn rusqlite::ToSql> = ids.iter()
                .map(|id| id as &dyn rusqlite::ToSql)
                .collect();
            
            let deleted = conn.execute(&sql, &params[..])?;
            Ok(deleted)
        })
    }

    /// Check if an entry exists by ID
    pub async fn entry_exists(&self, id: &str) -> SqliteResult<bool> {
        self.conn_manager.with_connection(|conn| {
            let count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM command_history WHERE id = ?",
                params![id],
                |row| row.get(0),
            )?;
            Ok(count > 0)
        })
    }
}