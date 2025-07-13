// Search operation handlers

use crate::manager::Manager;
use crate::project_search::SearchOptions;
use serde_json::Value;

pub async fn search_project(
    manager: &Manager,
    pattern: &str,
    options: Value,
) -> Result<Value, String> {
    let project_search = manager
        .project_search
        .as_ref()
        .ok_or_else(|| "Project search not initialized".to_string())?;

    // Parse search options
    let mut search_options = serde_json::from_value::<SearchOptions>(options).unwrap_or_default();
    search_options.pattern = pattern.to_string();

    // Perform search
    let results = project_search
        .search(search_options)
        .await
        .map_err(|e| e.to_string())?;

    // Convert results to JSON
    let result_items: Vec<Value> = results
        .into_iter()
        .map(|item| {
            serde_json::json!({
                "type": "result",
                "item": item
            })
        })
        .collect();

    Ok(serde_json::json!({
        "pattern": pattern,
        "results": result_items,
        "count": result_items.len()
    }))
}

pub async fn search_in_file(
    manager: &Manager,
    file_path: &str,
    pattern: &str,
) -> Result<Value, String> {
    let project_search = manager
        .project_search
        .as_ref()
        .ok_or_else(|| "Project search not initialized".to_string())?;

    // Create search options for single file
    let mut search_options = SearchOptions::default();
    search_options.pattern = pattern.to_string();
    search_options.include_patterns = vec![file_path.to_string()];

    // Perform search
    let results = project_search
        .search(search_options)
        .await
        .map_err(|e| e.to_string())?;

    // Extract matches for the specific file
    let file_results = results;

    Ok(serde_json::json!({
        "file": file_path,
        "pattern": pattern,
        "matches": file_results,
        "count": file_results.len()
    }))
}
