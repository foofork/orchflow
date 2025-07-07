use tauri::State;
use serde::{Deserialize, Serialize};
use crate::orchestrator::{Orchestrator, Action, ShellType, PaneType};
use crate::error::{OrchflowError, Result};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalConfig {
    pub name: Option<String>,
    pub shell_type: Option<ShellType>,
    pub working_dir: Option<String>,
    pub environment: Option<HashMap<String, String>>,
    pub command: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalInfo {
    pub id: String,
    pub name: String,
    pub shell_type: Option<ShellType>,
    pub working_dir: Option<String>,
    pub session_id: String,
    pub is_active: bool,
}

/// Create a new terminal with advanced configuration
#[tauri::command]
pub async fn create_terminal(
    orchestrator: State<'_, Orchestrator>,
    session_id: String,
    config: TerminalConfig,
) -> Result<TerminalInfo> {
    // Create the terminal pane with configuration
    let action = Action::CreatePane {
        session_id: session_id.clone(),
        pane_type: PaneType::Terminal,
        command: config.command,
        shell_type: config.shell_type.clone(),
        name: config.name.clone(),
    };
    
    let result = orchestrator.execute_action(action).await
        .map_err(|e| OrchflowError::TerminalError { 
            operation: "create_terminal".to_string(),
            reason: e 
        })?;
    
    // Parse the result into our TerminalInfo structure
    let pane: crate::orchestrator::Pane = serde_json::from_value(result)
        .map_err(|e| OrchflowError::ValidationError { 
            field: "pane_result".to_string(),
            reason: format!("Failed to parse pane: {}", e) 
        })?;
    
    Ok(TerminalInfo {
        id: pane.id,
        name: pane.custom_name.unwrap_or(pane.title),
        shell_type: pane.shell_type,
        working_dir: pane.working_dir,
        session_id: pane.session_id,
        is_active: false, // TODO: Track active terminal
    })
}

/// Rename a terminal
#[tauri::command]
pub async fn rename_terminal(
    orchestrator: State<'_, Orchestrator>,
    terminal_id: String,
    new_name: String,
) -> Result<()> {
    let action = Action::RenamePane {
        pane_id: terminal_id,
        name: new_name,
    };
    
    orchestrator.execute_action(action).await
        .map_err(|e| OrchflowError::TerminalError { 
            operation: "rename_terminal".to_string(),
            reason: e 
        })?;
    
    Ok(())
}

/// Get list of available shells
#[tauri::command]
pub async fn get_available_shells() -> Result<Vec<ShellInfo>> {
    use tokio::process::Command;
    
    let mut shells = vec![];
    
    // Check common shells
    let shell_candidates = vec![
        ("bash", "Bash", "/bin/bash"),
        ("zsh", "Z Shell", "/bin/zsh"),
        ("fish", "Fish Shell", "/usr/local/bin/fish"),
        ("nu", "Nushell", "/usr/local/bin/nu"),
        ("sh", "Bourne Shell", "/bin/sh"),
    ];
    
    for (id, name, path) in shell_candidates {
        // Check if shell exists
        if let Ok(output) = Command::new(path)
            .arg("--version")
            .output()
            .await
        {
            if output.status.success() {
                let version = String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .next()
                    .unwrap_or("")
                    .to_string();
                    
                shells.push(ShellInfo {
                    id: id.to_string(),
                    name: name.to_string(),
                    path: path.to_string(),
                    version,
                    is_default: std::env::var("SHELL")
                        .map(|s| s == path)
                        .unwrap_or(false),
                });
            }
        }
    }
    
    Ok(shells)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub version: String,
    pub is_default: bool,
}

/// Get terminal groups (organized by project/feature)
#[tauri::command]
pub async fn get_terminal_groups(
    orchestrator: State<'_, Orchestrator>,
    session_id: String,
) -> Result<Vec<TerminalGroup>> {
    // Get all panes for the session
    let panes = orchestrator.state_manager.list_panes(&session_id).await;
    
    // Group terminal panes by working directory
    let mut groups: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();
    
    for pane in panes {
        if pane.pane_type == crate::state_manager::PaneType::Terminal {
            let group_key = pane.working_dir.clone().unwrap_or_else(|| "default".to_string());
            groups.entry(group_key).or_default().push(pane.id);
        }
    }
    
    // Convert to TerminalGroup structs
    let terminal_groups: Vec<TerminalGroup> = groups.into_iter().map(|(dir, terminal_ids)| {
        let name = if dir == "default" {
            "Default".to_string()
        } else {
            // Extract last directory name for display
            std::path::Path::new(&dir)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(&dir)
                .to_string()
        };
        
        TerminalGroup {
            id: dir.clone(),
            name,
            terminal_ids,
            color: "#89b4fa".to_string(), // Default color, could be randomized
        }
    }).collect();
    
    Ok(terminal_groups)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalGroup {
    pub id: String,
    pub name: String,
    pub terminal_ids: Vec<String>,
    pub color: String,
}

/// Create a terminal template (for common configurations)
#[tauri::command]
pub async fn save_terminal_template(
    orchestrator: State<'_, Orchestrator>,
    name: String,
    config: TerminalConfig,
) -> Result<()> {
    if name.is_empty() {
        return Err(OrchflowError::ValidationError { 
            field: "name".to_string(),
            reason: "Template name cannot be empty".to_string(),
        });
    }
    
    // Serialize the config to JSON
    let config_json = serde_json::to_string(&config)
        .map_err(|e| OrchflowError::ValidationError {
            field: "config".to_string(),
            reason: format!("Failed to serialize config: {}", e),
        })?;
    
    // Save to state store as a setting with template_ prefix
    orchestrator.state_manager.set_setting(
        &format!("template_{}", name), 
        &config_json
    ).await.map_err(|e| OrchflowError::DatabaseError {
        operation: "save_terminal_template".to_string(),
        reason: e.to_string(),
    })?;
    
    Ok(())
}

/// Search terminal output across all panes
#[tauri::command]
pub async fn search_terminal_output(
    orchestrator: State<'_, Orchestrator>,
    session_id: String,
    query: String,
    regex: bool,
) -> Result<Vec<SearchResult>> {
    // Use TerminalSearcher if available for more advanced searching
    if let Some(terminal_searcher) = &orchestrator.terminal_searcher {
        let options = crate::terminal_search::SearchOptions {
            regex,
            case_sensitive: true,
            whole_word: false,
            context_lines: 2,
        };
        
        let matches = terminal_searcher.search_all_panes(&session_id, &query, options).await
            .map_err(|e| crate::error::OrchflowError::SearchError {
                operation: "terminal_search".to_string(),
                reason: e.to_string(),
            })?;
        
        // Convert matches to SearchResult format
        let results: Vec<SearchResult> = matches.into_iter().map(|m| SearchResult {
            terminal_id: m.pane_id,
            terminal_name: m.pane_name,
            line_number: m.line_number,
            content: m.line_content,
            context_before: m.context_before,
            context_after: m.context_after,
        }).collect();
        
        return Ok(results);
    }
    
    // Fallback to basic search if TerminalSearcher not available
    let panes = orchestrator.state_manager.list_panes(&session_id).await;
    
    let mut all_results = Vec::new();
    
    // Search each terminal pane
    for pane in panes {
        if pane.pane_type != crate::state_manager::PaneType::Terminal {
            continue;
        }
        
        // Get terminal output using GetOutput action
        let result = orchestrator.execute_action(crate::orchestrator::Action::GetOutput {
            pane_id: pane.id.clone(),
            lines: Some(1000), // Get last 1000 lines
        }).await;
        
        match result {
            Ok(value) => {
                if let Some(output) = value.as_str() {
                    let results = if regex {
                        search_with_regex(output, &query, &pane.id, &pane.title)
                    } else {
                        search_simple(output, &query, &pane.id, &pane.title)
                    };
                    all_results.extend(results);
                }
            },
            Err(_) => {
                // Skip panes we can't capture
                continue;
            }
        }
    }
    
    Ok(all_results)
}

fn search_simple(output: &str, query: &str, terminal_id: &str, terminal_name: &str) -> Vec<SearchResult> {
    let mut results = Vec::new();
    let lines: Vec<&str> = output.lines().collect();
    
    for (i, line) in lines.iter().enumerate() {
        if line.contains(query) {
            let start = i.saturating_sub(2);
            let end = (i + 3).min(lines.len());
            
            results.push(SearchResult {
                terminal_id: terminal_id.to_string(),
                terminal_name: terminal_name.to_string(),
                line_number: i + 1,
                content: line.to_string(),
                context_before: lines[start..i].iter().map(|s| s.to_string()).collect(),
                context_after: lines[(i+1)..end].iter().map(|s| s.to_string()).collect(),
            });
        }
    }
    
    results
}

fn search_with_regex(output: &str, pattern: &str, terminal_id: &str, terminal_name: &str) -> Vec<SearchResult> {
    use regex::Regex;
    
    let Ok(re) = Regex::new(pattern) else {
        return vec![];
    };
    
    let mut results = Vec::new();
    let lines: Vec<&str> = output.lines().collect();
    
    for (i, line) in lines.iter().enumerate() {
        if re.is_match(line) {
            let start = i.saturating_sub(2);
            let end = (i + 3).min(lines.len());
            
            results.push(SearchResult {
                terminal_id: terminal_id.to_string(),
                terminal_name: terminal_name.to_string(),
                line_number: i + 1,
                content: line.to_string(),
                context_before: lines[start..i].iter().map(|s| s.to_string()).collect(),
                context_after: lines[(i+1)..end].iter().map(|s| s.to_string()).collect(),
            });
        }
    }
    
    results
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub terminal_id: String,
    pub terminal_name: String,
    pub line_number: usize,
    pub content: String,
    pub context_before: Vec<String>,
    pub context_after: Vec<String>,
}