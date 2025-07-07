use std::sync::Arc;
use regex::Regex;
use serde::{Deserialize, Serialize};
use crate::orchestrator::{Orchestrator, Action};
use crate::error::{OrchflowError, Result};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchMatch {
    pub pane_id: String,
    pub pane_name: String,
    pub line_number: usize,
    pub column: usize,
    pub match_text: String,
    pub line_content: String,
    pub context_before: Vec<String>,
    pub context_after: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchOptions {
    pub regex: bool,
    pub case_sensitive: bool,
    pub whole_word: bool,
    pub context_lines: usize,
}

impl Default for SearchOptions {
    fn default() -> Self {
        Self {
            regex: false,
            case_sensitive: true,
            whole_word: false,
            context_lines: 2,
        }
    }
}

pub struct TerminalSearcher {
    orchestrator: Arc<Orchestrator>,
}

impl TerminalSearcher {
    pub fn new(orchestrator: Arc<Orchestrator>) -> Self {
        Self { orchestrator }
    }
    
    /// Search across all terminal panes in a session
    pub async fn search_all_panes(
        &self,
        session_id: &str,
        query: &str,
        options: SearchOptions,
    ) -> Result<Vec<SearchMatch>> {
        // Get all panes in the session
        let state_manager = &self.orchestrator.state_manager;
        let session = state_manager.get_session(session_id).await
            .ok_or_else(|| OrchflowError::SessionNotFound { id: session_id.to_string() })?;
        
        let mut all_matches = Vec::new();
        
        // Search each pane
        for pane_id in &session.panes {
            if let Ok(matches) = self.search_pane(pane_id, query, &options).await {
                all_matches.extend(matches);
            }
        }
        
        Ok(all_matches)
    }
    
    /// Search within a specific pane
    pub async fn search_pane(
        &self,
        pane_id: &str,
        query: &str,
        options: &SearchOptions,
    ) -> Result<Vec<SearchMatch>> {
        // Get pane info
        let state_manager = &self.orchestrator.state_manager;
        let pane = state_manager.get_pane(pane_id).await
            .ok_or_else(|| OrchflowError::PaneNotFound { id: pane_id.to_string() })?;
        
        // Get pane output
        let action = Action::GetOutput {
            pane_id: pane_id.to_string(),
            lines: None, // Get all lines
        };
        
        let result = self.orchestrator.execute_action(action).await
            .map_err(|e| OrchflowError::BackendError { 
                operation: "capture_pane".to_string(),
                reason: e 
            })?;
        
        let output = result.get("output")
            .and_then(|v| v.as_str())
            .ok_or_else(|| OrchflowError::ValidationError { 
                field: "output".to_string(),
                reason: "No output field in response".to_string() 
            })?;
        
        // Perform the search
        let matches = self.search_text(output, query, options, pane_id, &pane.title)?;
        
        Ok(matches)
    }
    
    /// Search within text and return matches
    fn search_text(
        &self,
        text: &str,
        query: &str,
        options: &SearchOptions,
        pane_id: &str,
        pane_name: &str,
    ) -> Result<Vec<SearchMatch>> {
        let lines: Vec<&str> = text.lines().collect();
        let mut matches = Vec::new();
        
        // Build the search pattern
        let pattern = if options.regex {
            query.to_string()
        } else {
            regex::escape(query)
        };
        
        let pattern = if options.whole_word {
            format!(r"\b{}\b", pattern)
        } else {
            pattern
        };
        
        // Build regex with case sensitivity flag
        let re = if options.case_sensitive {
            Regex::new(&pattern)
        } else {
            Regex::new(&format!("(?i){}", pattern))
        }.map_err(|e| OrchflowError::ValidationError {
            field: "query".to_string(),
            reason: format!("Invalid regex: {}", e),
        })?;
        
        // Search each line
        for (line_idx, line) in lines.iter().enumerate() {
            // Find all matches in the line
            for mat in re.find_iter(line) {
                let start = mat.start();
                let end = mat.end();
                
                // Get context lines
                let context_start = line_idx.saturating_sub(options.context_lines);
                let context_end = (line_idx + options.context_lines + 1).min(lines.len());
                
                let context_before: Vec<String> = lines[context_start..line_idx]
                    .iter()
                    .map(|s| s.to_string())
                    .collect();
                    
                let context_after: Vec<String> = lines[(line_idx + 1)..context_end]
                    .iter()
                    .map(|s| s.to_string())
                    .collect();
                
                matches.push(SearchMatch {
                    pane_id: pane_id.to_string(),
                    pane_name: pane_name.to_string(),
                    line_number: line_idx + 1, // 1-indexed
                    column: start + 1, // 1-indexed
                    match_text: line[start..end].to_string(),
                    line_content: line.to_string(),
                    context_before,
                    context_after,
                });
            }
        }
        
        Ok(matches)
    }
    
    /// Highlight matches in text (for display purposes)
    pub fn highlight_matches(
        &self,
        text: &str,
        query: &str,
        options: &SearchOptions,
        highlight_start: &str,
        highlight_end: &str,
    ) -> Result<String> {
        // Build pattern
        let pattern = if options.regex {
            query.to_string()
        } else {
            regex::escape(query)
        };
        
        let pattern = if options.whole_word {
            format!(r"\b{}\b", pattern)
        } else {
            pattern
        };
        
        let re = Regex::new(&pattern)
            .map_err(|e| OrchflowError::ValidationError {
                field: "query".to_string(),
                reason: format!("Invalid regex: {}", e),
            })?;
        
        // Replace matches with highlighted version
        let result = re.replace_all(text, |caps: &regex::Captures| {
            format!("{}{}{}", highlight_start, &caps[0], highlight_end)
        });
        
        Ok(result.into_owned())
    }
}

/// Search history entry for saved searches
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchHistoryEntry {
    pub id: String,
    pub query: String,
    pub options: SearchOptions,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub result_count: usize,
}

/// Manage search history
pub struct SearchHistory {
    entries: Arc<tokio::sync::RwLock<Vec<SearchHistoryEntry>>>,
    max_size: usize,
}

impl SearchHistory {
    pub fn new(max_size: usize) -> Self {
        Self {
            entries: Arc::new(tokio::sync::RwLock::new(Vec::new())),
            max_size,
        }
    }
    
    pub async fn add_entry(&self, query: String, options: SearchOptions, result_count: usize) {
        let entry = SearchHistoryEntry {
            id: uuid::Uuid::new_v4().to_string(),
            query,
            options,
            timestamp: chrono::Utc::now(),
            result_count,
        };
        
        let mut entries = self.entries.write().await;
        entries.insert(0, entry);
        
        // Keep only max_size entries
        if entries.len() > self.max_size {
            entries.truncate(self.max_size);
        }
    }
    
    pub async fn get_entries(&self, limit: usize) -> Vec<SearchHistoryEntry> {
        let entries = self.entries.read().await;
        entries.iter().take(limit).cloned().collect()
    }
    
    pub async fn clear(&self) {
        let mut entries = self.entries.write().await;
        entries.clear();
    }
}