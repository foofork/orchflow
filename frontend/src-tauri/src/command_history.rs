use std::collections::VecDeque;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use crate::simple_state_store::SimpleStateStore;
use crate::error::{OrchflowError, Result};
use std::sync::Arc;
use tokio::sync::RwLock;

const MAX_HISTORY_SIZE: usize = 10000;
const MAX_COMMAND_LENGTH: usize = 4096;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandEntry {
    pub id: String,
    pub pane_id: String,
    pub session_id: String,
    pub command: String,
    pub timestamp: DateTime<Utc>,
    pub working_dir: Option<String>,
    pub exit_code: Option<i32>,
    pub duration_ms: Option<u64>,
    pub shell_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandStats {
    pub command: String,
    pub frequency: usize,
    pub last_used: DateTime<Utc>,
    pub average_duration_ms: Option<u64>,
    pub success_rate: f32,
}

pub struct CommandHistory {
    store: Arc<SimpleStateStore>,
    memory_cache: Arc<RwLock<VecDeque<CommandEntry>>>,
    stats_cache: Arc<RwLock<Vec<CommandStats>>>,
}

impl CommandHistory {
    pub fn new(store: Arc<SimpleStateStore>) -> Self {
        Self {
            store,
            memory_cache: Arc::new(RwLock::new(VecDeque::with_capacity(1000))),
            stats_cache: Arc::new(RwLock::new(Vec::new())),
        }
    }
    
    /// Add a command to history
    pub async fn add_command(&self, entry: CommandEntry) -> Result<()> {
        // Validate command
        if entry.command.len() > MAX_COMMAND_LENGTH {
            return Err(OrchflowError::ValidationError {
                field: "command".to_string(),
                reason: format!("Command too long (max {} chars)", MAX_COMMAND_LENGTH),
            });
        }
        
        // Add to memory cache
        {
            let mut cache = self.memory_cache.write().await;
            if cache.len() >= 1000 {
                cache.pop_front();
            }
            cache.push_back(entry.clone());
        }
        
        // Persist to database
        self.store.save_command_history(entry).await
            .map_err(|e| OrchflowError::DatabaseError { 
                operation: "save_command_history".to_string(),
                reason: e 
            })?;
        
        // Update stats cache
        self.update_stats_cache().await?;
        
        Ok(())
    }
    
    /// Search command history
    pub async fn search(
        &self,
        query: &str,
        pane_id: Option<&str>,
        session_id: Option<&str>,
        limit: usize,
    ) -> Result<Vec<CommandEntry>> {
        // First check memory cache for recent commands
        let cache = self.memory_cache.read().await;
        let mut results: Vec<CommandEntry> = cache
            .iter()
            .filter(|entry| {
                let matches_query = entry.command.contains(query);
                let matches_pane = pane_id.map_or(true, |id| entry.pane_id == id);
                let matches_session = session_id.map_or(true, |id| entry.session_id == id);
                matches_query && matches_pane && matches_session
            })
            .take(limit)
            .cloned()
            .collect();
        
        // If we need more results, query the database
        if results.len() < limit {
            let db_results = self.store
                .search_command_history(query, pane_id, session_id, limit - results.len())
                .await
                .map_err(|e| OrchflowError::DatabaseError { 
                operation: "search_command_history".to_string(),
                reason: e 
            })?;
            results.extend(db_results);
        }
        
        Ok(results)
    }
    
    /// Get command suggestions based on frecency (frequency + recency)
    pub async fn get_suggestions(
        &self,
        prefix: &str,
        _pane_id: Option<&str>,
        limit: usize,
    ) -> Result<Vec<String>> {
        let stats = self.stats_cache.read().await;
        
        // Calculate frecency score
        let now = Utc::now();
        let mut scored_commands: Vec<(String, f64)> = stats
            .iter()
            .filter(|stat| stat.command.starts_with(prefix))
            .map(|stat| {
                let recency_score = 1.0 / (1.0 + (now - stat.last_used).num_hours() as f64);
                let frequency_score = (stat.frequency as f64).log2() + 1.0;
                let success_bonus = stat.success_rate;
                let score = recency_score * frequency_score * (1.0 + success_bonus as f64);
                (stat.command.clone(), score)
            })
            .collect();
        
        // Sort by score descending
        scored_commands.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        
        Ok(scored_commands
            .into_iter()
            .take(limit)
            .map(|(cmd, _)| cmd)
            .collect())
    }
    
    /// Get command statistics
    pub async fn get_stats(&self, limit: usize) -> Result<Vec<CommandStats>> {
        let stats = self.stats_cache.read().await;
        Ok(stats.iter().take(limit).cloned().collect())
    }
    
    /// Update the stats cache from database
    async fn update_stats_cache(&self) -> Result<()> {
        let stats = self.store
            .get_command_stats(100)
            .await
            .map_err(|e| OrchflowError::DatabaseError { 
                operation: "get_command_stats".to_string(),
                reason: e 
            })?;
        
        let mut cache = self.stats_cache.write().await;
        *cache = stats;
        
        Ok(())
    }
    
    /// Clean up old history entries
    pub async fn cleanup_old_entries(&self, days_to_keep: i64) -> Result<usize> {
        let cutoff = Utc::now() - chrono::Duration::days(days_to_keep);
        
        let deleted = self.store
            .delete_old_command_history(cutoff)
            .await
            .map_err(|e| OrchflowError::DatabaseError { 
                operation: "delete_old_command_history".to_string(),
                reason: e 
            })?;
        
        // Clear memory cache of old entries
        let mut cache = self.memory_cache.write().await;
        cache.retain(|entry| entry.timestamp > cutoff);
        
        // Update stats
        self.update_stats_cache().await?;
        
        Ok(deleted)
    }
    
    /// Export command history to JSON
    pub async fn export_history(
        &self,
        pane_id: Option<&str>,
        session_id: Option<&str>,
    ) -> Result<String> {
        let entries = self.store
            .get_all_command_history(pane_id, session_id)
            .await
            .map_err(|e| OrchflowError::DatabaseError { 
                operation: "get_all_command_history".to_string(),
                reason: e 
            })?;
        
        serde_json::to_string_pretty(&entries)
            .map_err(|e| OrchflowError::ValidationError { 
                field: "json_data".to_string(),
                reason: e.to_string() 
            })
    }
    
    /// Import command history from JSON
    pub async fn import_history(&self, json_data: &str) -> Result<usize> {
        let entries: Vec<CommandEntry> = serde_json::from_str(json_data)
            .map_err(|e| OrchflowError::ValidationError { 
                field: "json_data".to_string(),
                reason: e.to_string() 
            })?;
        
        let mut imported = 0;
        for entry in entries {
            if self.add_command(entry).await.is_ok() {
                imported += 1;
            }
        }
        
        Ok(imported)
    }
}

// Extension trait for SimpleStateStore
impl SimpleStateStore {
    pub async fn save_command_history(&self, entry: CommandEntry) -> std::result::Result<(), String> {
        let conn = self.conn.lock().unwrap();
        
        conn.execute(
            "INSERT INTO command_history (id, pane_id, session_id, command, timestamp, working_dir, exit_code, duration_ms, shell_type)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            rusqlite::params![
                entry.id,
                entry.pane_id,
                entry.session_id,
                entry.command,
                entry.timestamp.naive_utc(),
                entry.working_dir,
                entry.exit_code,
                entry.duration_ms,
                entry.shell_type.as_ref().map(|s| format!("{:?}", s))
            ],
        ).map_err(|e| format!("Failed to save command history: {}", e))?;
        
        Ok(())
    }
    
    pub async fn search_command_history(
        &self,
        query: &str,
        pane_id: Option<&str>,
        session_id: Option<&str>,
        limit: usize,
    ) -> std::result::Result<Vec<CommandEntry>, String> {
        let conn = self.conn.lock().unwrap();
        
        let mut sql = String::from(
            "SELECT id, pane_id, session_id, command, timestamp, working_dir, exit_code, duration_ms, shell_type 
             FROM command_history 
             WHERE command LIKE ?1"
        );
        
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![
            Box::new(format!("%{}%", query))
        ];
        
        if let Some(pane) = pane_id {
            sql.push_str(" AND pane_id = ?2");
            params.push(Box::new(pane.to_string()));
        }
        
        if let Some(session) = session_id {
            let param_idx = params.len() + 1;
            sql.push_str(&format!(" AND session_id = ?{}", param_idx));
            params.push(Box::new(session.to_string()));
        }
        
        sql.push_str(" ORDER BY timestamp DESC LIMIT ?");
        params.push(Box::new(limit as i64));
        
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        
        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        
        let entries = stmt.query_map(&param_refs[..], |row| {
            Ok(CommandEntry {
                id: row.get(0)?,
                pane_id: row.get(1)?,
                session_id: row.get(2)?,
                command: row.get(3)?,
                timestamp: DateTime::from_naive_utc_and_offset(row.get(4)?, Utc),
                working_dir: row.get(5)?,
                exit_code: row.get(6)?,
                duration_ms: row.get(7)?,
                shell_type: row.get::<_, Option<String>>(8)?
                    .and_then(|s| serde_json::from_str(&format!("\"{}\"", s)).ok()),
            })
        }).map_err(|e| e.to_string())?;
        
        let mut results = Vec::new();
        for entry in entries {
            results.push(entry.map_err(|e| e.to_string())?);
        }
        
        Ok(results)
    }
    
    pub async fn get_command_stats(&self, limit: usize) -> std::result::Result<Vec<CommandStats>, String> {
        let conn = self.conn.lock().unwrap();
        
        let mut stmt = conn.prepare(
            "SELECT 
                command,
                COUNT(*) as frequency,
                MAX(timestamp) as last_used,
                AVG(duration_ms) as avg_duration,
                SUM(CASE WHEN exit_code = 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate
             FROM command_history
             GROUP BY command
             ORDER BY frequency DESC
             LIMIT ?1"
        ).map_err(|e| e.to_string())?;
        
        let stats = stmt.query_map(rusqlite::params![limit as i64], |row| {
            Ok(CommandStats {
                command: row.get(0)?,
                frequency: row.get(1)?,
                last_used: DateTime::from_naive_utc_and_offset(row.get(2)?, Utc),
                average_duration_ms: row.get(3)?,
                success_rate: row.get(4)?,
            })
        }).map_err(|e| e.to_string())?;
        
        let mut results = Vec::new();
        for stat in stats {
            results.push(stat.map_err(|e| e.to_string())?);
        }
        
        Ok(results)
    }
    
    pub async fn delete_old_command_history(&self, cutoff: DateTime<Utc>) -> std::result::Result<usize, String> {
        let conn = self.conn.lock().unwrap();
        
        let deleted = conn.execute(
            "DELETE FROM command_history WHERE timestamp < ?1",
            rusqlite::params![cutoff.naive_utc()],
        ).map_err(|e| format!("Failed to delete old command history: {}", e))?;
        
        Ok(deleted)
    }
    
    pub async fn get_all_command_history(
        &self,
        pane_id: Option<&str>,
        session_id: Option<&str>,
    ) -> std::result::Result<Vec<CommandEntry>, String> {
        let conn = self.conn.lock().unwrap();
        
        let mut sql = String::from(
            "SELECT id, pane_id, session_id, command, timestamp, working_dir, exit_code, duration_ms, shell_type 
             FROM command_history WHERE 1=1"
        );
        
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![];
        
        if let Some(pane) = pane_id {
            sql.push_str(" AND pane_id = ?1");
            params.push(Box::new(pane.to_string()));
        }
        
        if let Some(session) = session_id {
            let param_idx = params.len() + 1;
            sql.push_str(&format!(" AND session_id = ?{}", param_idx));
            params.push(Box::new(session.to_string()));
        }
        
        sql.push_str(" ORDER BY timestamp DESC");
        
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        
        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        
        let entries = stmt.query_map(&param_refs[..], |row| {
            Ok(CommandEntry {
                id: row.get(0)?,
                pane_id: row.get(1)?,
                session_id: row.get(2)?,
                command: row.get(3)?,
                timestamp: DateTime::from_naive_utc_and_offset(row.get(4)?, Utc),
                working_dir: row.get(5)?,
                exit_code: row.get(6)?,
                duration_ms: row.get(7)?,
                shell_type: row.get::<_, Option<String>>(8)?
                    .and_then(|s| serde_json::from_str(&format!("\"{}\"", s)).ok()),
            })
        }).map_err(|e| e.to_string())?;
        
        let mut results = Vec::new();
        for entry in entries {
            results.push(entry.map_err(|e| e.to_string())?);
        }
        
        Ok(results)
    }
}