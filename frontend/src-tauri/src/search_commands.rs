use tauri::State;
use serde::{Deserialize, Serialize};
use crate::orchestrator::Orchestrator;
use crate::error::Result;
use crate::project_search::{SearchOptions, FileSearchResult, ReplaceResult};

/// Perform a project-wide search
#[tauri::command]
pub async fn search_project(
    orchestrator: State<'_, Orchestrator>,
    options: SearchOptions,
) -> Result<SearchResults> {
    if let Some(project_search) = &orchestrator.project_search {
        let results = project_search.search_with_history(options).await
            .map_err(|e| crate::error::OrchflowError::SearchError {
                operation: "project_search".to_string(),
                reason: e.to_string(),
            })?;
            
        let total_matches = results.iter().map(|r| r.total_matches).sum();
        let max_results = 1000; // Could be configurable
        let truncated = results.len() >= max_results;
        
        Ok(SearchResults {
            results,
            total_matches,
            truncated,
        })
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "project_search".to_string(),
            reason: "Project search not initialized".to_string(),
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResults {
    pub results: Vec<FileSearchResult>,
    pub total_matches: usize,
    pub truncated: bool,
}

/// Perform a simple text search
#[tauri::command]
pub async fn search_text(
    orchestrator: State<'_, Orchestrator>,
    pattern: String,
    case_sensitive: bool,
) -> Result<SearchResults> {
    if let Some(project_search) = &orchestrator.project_search {
        let options = SearchOptions {
            pattern,
            case_sensitive,
            ..Default::default()
        };
        
        let results = project_search.search_with_history(options).await
            .map_err(|e| crate::error::OrchflowError::SearchError {
                operation: "text_search".to_string(),
                reason: e.to_string(),
            })?;
            
        let total_matches = results.iter().map(|r| r.total_matches).sum();
        let max_results = 1000;
        let truncated = results.len() >= max_results;
        
        Ok(SearchResults {
            results,
            total_matches,
            truncated,
        })
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "project_search".to_string(),
            reason: "Project search not initialized".to_string(),
        })
    }
}

/// Search and replace in files
#[tauri::command]
pub async fn replace_in_files(
    orchestrator: State<'_, Orchestrator>,
    search_options: SearchOptions,
    replacement: String,
    dry_run: bool,
) -> Result<Vec<ReplaceResult>> {
    if let Some(project_search) = &orchestrator.project_search {
        let results = project_search.replace_in_files(search_options, &replacement, dry_run).await
            .map_err(|e| crate::error::OrchflowError::SearchError {
                operation: "replace_in_files".to_string(),
                reason: e.to_string(),
            })?;
        Ok(results)
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "project_search".to_string(),
            reason: "Project search not initialized".to_string(),
        })
    }
}

/// Get search history
#[tauri::command]
pub async fn get_search_history(
    orchestrator: State<'_, Orchestrator>,
    limit: Option<usize>,
) -> Result<Vec<String>> {
    if let Some(project_search) = &orchestrator.project_search {
        let history = project_search.get_history(limit.unwrap_or(50)).await;
        Ok(history)
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "project_search".to_string(),
            reason: "Project search not initialized".to_string(),
        })
    }
}

/// Save a search
#[tauri::command]
pub async fn save_search(
    orchestrator: State<'_, Orchestrator>,
    name: String,
    options: SearchOptions,
) -> Result<()> {
    if let Some(project_search) = &orchestrator.project_search {
        project_search.save_search(name, options).await;
        Ok(())
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "project_search".to_string(),
            reason: "Project search not initialized".to_string(),
        })
    }
}

/// Load a saved search
#[tauri::command]
pub async fn load_saved_search(
    orchestrator: State<'_, Orchestrator>,
    name: String,
) -> Result<Option<SearchOptions>> {
    if let Some(project_search) = &orchestrator.project_search {
        let options = project_search.load_search(&name).await;
        Ok(options)
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "project_search".to_string(),
            reason: "Project search not initialized".to_string(),
        })
    }
}

/// Get list of saved searches
#[tauri::command]
pub async fn get_saved_searches(
    orchestrator: State<'_, Orchestrator>,
) -> Result<Vec<SavedSearch>> {
    if let Some(_project_search) = &orchestrator.project_search {
        // The AdvancedSearch doesn't expose a get_all_saved_searches method
        // We'll need to add this or work around it for now
        // For now, return empty list - this could be enhanced later
        Ok(vec![])
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "project_search".to_string(),
            reason: "Project search not initialized".to_string(),
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SavedSearch {
    pub name: String,
    pub options: SearchOptions,
}

/// Clear search cache
#[tauri::command]
pub async fn clear_search_cache(
    orchestrator: State<'_, Orchestrator>,
) -> Result<()> {
    if let Some(project_search) = &orchestrator.project_search {
        project_search.clear_cache().await;
        Ok(())
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "project_search".to_string(),
            reason: "Project search not initialized".to_string(),
        })
    }
}

/// Advanced search with syntax highlighting
#[derive(Debug, Serialize, Deserialize)]
pub struct HighlightedMatch {
    pub line_number: u64,
    pub line_html: String,
    pub context_before_html: Vec<String>,
    pub context_after_html: Vec<String>,
}

/// Get highlighted search results
#[tauri::command]
pub async fn search_with_highlights(
    _orchestrator: State<'_, Orchestrator>,
    _options: SearchOptions,
) -> Result<Vec<HighlightedSearchResult>> {
    // TODO: Implement syntax highlighting for search results
    Ok(vec![])
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HighlightedSearchResult {
    pub path: String,
    pub language: String,
    pub matches: Vec<HighlightedMatch>,
}