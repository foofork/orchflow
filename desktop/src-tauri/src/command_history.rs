use crate::error::{OrchflowError, Result};
use crate::simple_state_store::SimpleStateStore;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::RwLock;

const MAX_HISTORY_SIZE: usize = 10000;
const MAX_COMMAND_LENGTH: usize = 4096;

#[cfg(test)]
#[path = "command_history_tests.rs"]
mod tests;

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
                reason: format!("Command too long (max {MAX_COMMAND_LENGTH} chars)"),
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
        self.store
            .save_command_history(entry)
            .await
            .map_err(|e| OrchflowError::DatabaseError {
                operation: "save_command_history".to_string(),
                reason: e,
            })?;

        // Update stats cache
        self.update_stats_cache().await?;

        // Check total history size and prune if necessary
        self.enforce_history_size_limit().await?;

        Ok(())
    }

    /// Enforce the maximum history size by removing oldest entries
    async fn enforce_history_size_limit(&self) -> Result<()> {
        let keys = self.store
            .keys_with_prefix("command:")
            .await
            .map_err(|e| OrchflowError::DatabaseError {
                operation: "keys_with_prefix".to_string(),
                reason: e.to_string(),
            })?;

        if keys.len() > MAX_HISTORY_SIZE {
            // Get all entries to sort by timestamp
            let mut entries = Vec::new();
            for key in &keys {
                if let Ok(Some(data)) = self.store.get(key).await {
                    if let Ok(entry) = serde_json::from_str::<CommandEntry>(&data) {
                        entries.push((key.clone(), entry.timestamp));
                    }
                }
            }

            // Sort by timestamp (oldest first)
            entries.sort_by_key(|(_, timestamp)| *timestamp);

            // Delete oldest entries to stay within limit
            let entries_to_delete = entries.len() - MAX_HISTORY_SIZE;
            for (key, _) in entries.iter().take(entries_to_delete) {
                let _ = self.store.delete(key).await;
            }
        }

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
                let matches_pane = pane_id.is_none_or(|id| entry.pane_id == id);
                let matches_session = session_id.is_none_or(|id| entry.session_id == id);
                matches_query && matches_pane && matches_session
            })
            .take(limit)
            .cloned()
            .collect();

        // If we need more results, query the database
        if results.len() < limit {
            let db_results = self
                .store
                .search_command_history(query, pane_id, session_id, limit - results.len())
                .await
                .map_err(|e| OrchflowError::DatabaseError {
                    operation: "search_command_history".to_string(),
                    reason: e,
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
        let stats =
            self.store
                .get_command_stats(100)
                .await
                .map_err(|e| OrchflowError::DatabaseError {
                    operation: "get_command_stats".to_string(),
                    reason: e,
                })?;

        let mut cache = self.stats_cache.write().await;
        *cache = stats;

        Ok(())
    }

    /// Clean up old history entries
    pub async fn cleanup_old_entries(&self, days_to_keep: i64) -> Result<usize> {
        let cutoff = Utc::now() - chrono::Duration::days(days_to_keep);

        let deleted = self
            .store
            .delete_old_command_history(cutoff)
            .await
            .map_err(|e| OrchflowError::DatabaseError {
                operation: "delete_old_command_history".to_string(),
                reason: e,
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
        let entries = self
            .store
            .get_all_command_history(pane_id, session_id)
            .await
            .map_err(|e| OrchflowError::DatabaseError {
                operation: "get_all_command_history".to_string(),
                reason: e,
            })?;

        serde_json::to_string_pretty(&entries).map_err(|e| OrchflowError::ValidationError {
            field: "json_data".to_string(),
            reason: e.to_string(),
        })
    }

    /// Import command history from JSON
    pub async fn import_history(&self, json_data: &str) -> Result<usize> {
        let entries: Vec<CommandEntry> =
            serde_json::from_str(json_data).map_err(|e| OrchflowError::ValidationError {
                field: "json_data".to_string(),
                reason: e.to_string(),
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

// Extension trait for SimpleStateStore - TODO: Complete migration to new API
impl SimpleStateStore {
    pub async fn save_command_history(
        &self,
        entry: CommandEntry,
    ) -> std::result::Result<(), String> {
        let key = format!("command_history:{}", entry.id);
        let data = serde_json::to_string(&entry)
            .map_err(|e| format!("Failed to serialize command entry: {e}"))?;

        self.set(&key, &data)
            .await
            .map_err(|e| format!("Failed to save command history: {e}"))?;

        Ok(())
    }

    pub async fn search_command_history(
        &self,
        query: &str,
        pane_id: Option<&str>,
        session_id: Option<&str>,
        limit: usize,
    ) -> std::result::Result<Vec<CommandEntry>, String> {
        // Get all command history keys
        let keys = self
            .keys_with_prefix("command_history:")
            .await
            .map_err(|e| format!("Failed to get command history keys: {e}"))?;

        let mut results = Vec::new();
        let mut count = 0;

        // Search through stored command entries
        for key in keys {
            if count >= limit {
                break;
            }

            if let Ok(Some(data)) = self.get(&key).await {
                if let Ok(entry) = serde_json::from_str::<CommandEntry>(&data) {
                    // Filter by query, pane_id, and session_id
                    let matches_query = entry.command.contains(query);
                    let matches_pane = pane_id.is_none_or(|id| entry.pane_id == id);
                    let matches_session = session_id.is_none_or(|id| entry.session_id == id);

                    if matches_query && matches_pane && matches_session {
                        results.push(entry);
                        count += 1;
                    }
                }
            }
        }

        // Sort by timestamp descending
        results.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

        Ok(results)
    }

    pub async fn get_command_stats(
        &self,
        limit: usize,
    ) -> std::result::Result<Vec<CommandStats>, String> {
        // Get all command history entries
        let keys = self
            .keys_with_prefix("command_history:")
            .await
            .map_err(|e| format!("Failed to get command history keys: {e}"))?;

        let mut command_data: std::collections::HashMap<
            String,
            (usize, DateTime<Utc>, Vec<u64>, usize),
        > = std::collections::HashMap::new();

        // Collect data for each command
        for key in keys {
            if let Ok(Some(data)) = self.get(&key).await {
                if let Ok(entry) = serde_json::from_str::<CommandEntry>(&data) {
                    let (frequency, last_used, durations, successes) = command_data
                        .entry(entry.command.clone())
                        .or_insert((0, entry.timestamp, Vec::new(), 0));

                    *frequency += 1;
                    if entry.timestamp > *last_used {
                        *last_used = entry.timestamp;
                    }
                    if let Some(duration) = entry.duration_ms {
                        durations.push(duration);
                    }
                    if entry.exit_code == Some(0) {
                        *successes += 1;
                    }
                }
            }
        }

        // Convert to CommandStats and sort by frequency
        let mut stats: Vec<CommandStats> = command_data
            .into_iter()
            .map(|(command, (frequency, last_used, durations, successes))| {
                let average_duration_ms = if durations.is_empty() {
                    None
                } else {
                    Some(durations.iter().sum::<u64>() / durations.len() as u64)
                };
                let success_rate = if frequency > 0 {
                    (successes as f32 / frequency as f32) * 100.0
                } else {
                    0.0
                };

                CommandStats {
                    command,
                    frequency,
                    last_used,
                    average_duration_ms,
                    success_rate,
                }
            })
            .collect();

        stats.sort_by(|a, b| b.frequency.cmp(&a.frequency));
        stats.truncate(limit);

        Ok(stats)
    }

    pub async fn delete_old_command_history(
        &self,
        cutoff: DateTime<Utc>,
    ) -> std::result::Result<usize, String> {
        // Get all command history keys
        let keys = self
            .keys_with_prefix("command_history:")
            .await
            .map_err(|e| format!("Failed to get command history keys: {e}"))?;

        let mut deleted_count = 0;

        for key in keys {
            if let Ok(Some(data)) = self.get(&key).await {
                if let Ok(entry) = serde_json::from_str::<CommandEntry>(&data) {
                    if entry.timestamp < cutoff {
                        if self.delete(&key).await.is_ok() {
                            deleted_count += 1;
                        }
                    }
                }
            }
        }

        Ok(deleted_count)
    }

    pub async fn get_all_command_history(
        &self,
        pane_id: Option<&str>,
        session_id: Option<&str>,
    ) -> std::result::Result<Vec<CommandEntry>, String> {
        // Get all command history keys
        let keys = self
            .keys_with_prefix("command_history:")
            .await
            .map_err(|e| format!("Failed to get command history keys: {e}"))?;

        let mut results = Vec::new();

        for key in keys {
            if let Ok(Some(data)) = self.get(&key).await {
                if let Ok(entry) = serde_json::from_str::<CommandEntry>(&data) {
                    // Filter by pane_id and session_id if provided
                    let matches_pane = pane_id.is_none_or(|id| entry.pane_id == id);
                    let matches_session = session_id.is_none_or(|id| entry.session_id == id);

                    if matches_pane && matches_session {
                        results.push(entry);
                    }
                }
            }
        }

        // Sort by timestamp descending
        results.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

        Ok(results)
    }
}
