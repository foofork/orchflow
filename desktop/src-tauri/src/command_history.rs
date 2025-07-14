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

// Re-export CommandEntry from SimpleStateStore types
pub use crate::simple_state_store::CommandEntry;

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
                reason: e.to_string(),
            })?;

        // Update stats cache
        self.update_stats_cache().await?;

        // Check total history size and prune if necessary
        self.enforce_history_size_limit().await?;

        Ok(())
    }

    /// Enforce the maximum history size by removing oldest entries
    async fn enforce_history_size_limit(&self) -> Result<()> {
        let count = self.store
            .count_command_history()
            .await
            .map_err(|e| OrchflowError::DatabaseError {
                operation: "count_command_history".to_string(),
                reason: e.to_string(),
            })?;

        if count > MAX_HISTORY_SIZE {
            let entries_to_delete = count - MAX_HISTORY_SIZE;
            let ids = self.store
                .get_oldest_command_entries(entries_to_delete)
                .await
                .map_err(|e| OrchflowError::DatabaseError {
                    operation: "get_oldest_command_entries".to_string(),
                    reason: e.to_string(),
                })?;
            
            let _ = self.store
                .delete_command_entries_by_ids(&ids)
                .await
                .map_err(|e| OrchflowError::DatabaseError {
                    operation: "delete_command_entries_by_ids".to_string(),
                    reason: e.to_string(),
                })?;
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
                    reason: e.to_string(),
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
                    reason: e.to_string(),
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
                reason: e.to_string(),
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
                reason: e.to_string(),
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

