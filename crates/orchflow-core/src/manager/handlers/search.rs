use crate::error::Result;
use crate::manager::Manager;
use serde_json::Value;

pub async fn search_project(manager: &Manager, pattern: &str, options: Value) -> Result<Value> {
    if let Some(search_provider) = &manager.search_provider {
        search_provider.search_project(pattern, options).await
    } else {
        // Fallback implementation
        Ok(serde_json::json!({
            "status": "ok",
            "pattern": pattern,
            "results": [],
            "message": "Search provider not available"
        }))
    }
}

pub async fn search_in_file(manager: &Manager, file_path: &str, pattern: &str) -> Result<Value> {
    if let Some(search_provider) = &manager.search_provider {
        search_provider.search_in_file(file_path, pattern).await
    } else {
        // Fallback implementation
        Ok(serde_json::json!({
            "status": "ok",
            "file_path": file_path,
            "pattern": pattern,
            "results": [],
            "message": "Search provider not available"
        }))
    }
}
