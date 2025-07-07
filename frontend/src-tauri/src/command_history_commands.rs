use tauri::State;
use crate::orchestrator::Orchestrator;
use crate::command_history::{CommandEntry, CommandStats};
use crate::error::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SearchOptions {
    query: Option<String>,
    pane_id: Option<String>,
    session_id: Option<String>,
    limit: usize,
    sort_by_recent: bool,
}

/// Search command history
#[tauri::command]
pub async fn search_command_history(
    orchestrator: State<'_, Orchestrator>,
    query: Option<String>,
    pane_id: Option<String>,
    session_id: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<CommandEntry>> {
    let options = SearchOptions {
        query,
        pane_id,
        session_id,
        limit: limit.unwrap_or(100),
        sort_by_recent: true,
    };
    
    orchestrator.command_history.search(
        &options.query.unwrap_or_default(),
        options.pane_id.as_deref(),
        options.session_id.as_deref(),
        options.limit,
    ).await
    .map_err(|e| crate::error::OrchflowError::DatabaseError {
        operation: "search_command_history".to_string(),
        reason: e.to_string(),
    })
}

/// Get command statistics
#[tauri::command]
pub async fn get_command_stats(
    orchestrator: State<'_, Orchestrator>,
    limit: usize,
) -> Result<Vec<CommandStats>> {
    orchestrator.command_history.get_stats(limit).await
        .map_err(|e| crate::error::OrchflowError::DatabaseError {
            operation: "get_command_stats".to_string(),
            reason: e.to_string(),
        })
}

/// Get command suggestions based on history and context
#[tauri::command]
pub async fn get_command_suggestions(
    orchestrator: State<'_, Orchestrator>,
    prefix: String,
    pane_id: Option<String>,
    working_dir: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<String>> {
    orchestrator.command_history.get_suggestions(
        &prefix,
        pane_id.as_deref(),
        limit.unwrap_or(10),
    ).await
    .map_err(|e| crate::error::OrchflowError::DatabaseError {
        operation: "get_command_suggestions".to_string(),
        reason: e.to_string(),
    })
}

/// Clean up old command history entries
#[tauri::command]
pub async fn cleanup_command_history(
    orchestrator: State<'_, Orchestrator>,
    days_to_keep: i64,
) -> Result<usize> {
    orchestrator.command_history.cleanup_old_entries(days_to_keep).await
        .map_err(|e| crate::error::OrchflowError::DatabaseError {
            operation: "cleanup_command_history".to_string(),
            reason: e.to_string(),
        })
}

/// Export command history as JSON
#[tauri::command]
pub async fn export_command_history(
    orchestrator: State<'_, Orchestrator>,
    session_id: Option<String>,
) -> Result<String> {
    orchestrator.command_history.export_history(None, session_id.as_deref()).await
        .map_err(|e| crate::error::OrchflowError::DatabaseError {
            operation: "export_command_history".to_string(),
            reason: e.to_string(),
        })
}

/// Import command history from JSON
#[tauri::command]
pub async fn import_command_history(
    orchestrator: State<'_, Orchestrator>,
    json_data: String,
) -> Result<usize> {
    orchestrator.command_history.import_history(&json_data).await
        .map_err(|e| crate::error::OrchflowError::DatabaseError {
            operation: "import_command_history".to_string(),
            reason: e.to_string(),
        })
}