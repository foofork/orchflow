// Search Plugin - Intelligent file and content search functionality
//
// This plugin provides comprehensive search capabilities including:
// - Fast file content search with regex support
// - Text replacement across multiple files
// - Directory analysis and statistics
// - Glob pattern matching for file filtering

pub mod commands;
pub mod matcher;
pub mod replacer;
pub mod searcher;
pub mod types;
pub mod walker;

// Re-export main types for easy access
pub use commands::SearchCommands;
pub use types::ReplaceRequest;
pub use types::{FileSearchRequest, SearchOptions};

use crate::manager::{Event, Plugin, PluginContext, PluginMetadata};
use async_trait::async_trait;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct SearchPlugin {
    commands: SearchCommands,
    active_searches: Arc<Mutex<HashMap<String, bool>>>,
}

impl SearchPlugin {
    pub fn new() -> Self {
        Self {
            commands: SearchCommands,
            active_searches: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    async fn handle_file_search(&self, params: Value) -> Result<Value, String> {
        let request: FileSearchRequest =
            serde_json::from_value(params).map_err(|e| format!("Invalid search request: {}", e))?;

        let response = self.commands.execute_search(request).await?;

        serde_json::to_value(response)
            .map_err(|e| format!("Failed to serialize search response: {}", e))
    }

    async fn handle_text_replace(&self, params: Value) -> Result<Value, String> {
        let request: ReplaceRequest = serde_json::from_value(params)
            .map_err(|e| format!("Invalid replace request: {}", e))?;

        let response = self.commands.execute_replace(request).await?;

        serde_json::to_value(response)
            .map_err(|e| format!("Failed to serialize replace response: {}", e))
    }

    async fn handle_search_and_replace(&self, params: Value) -> Result<Value, String> {
        let search_request: FileSearchRequest =
            serde_json::from_value(params["search_request"].clone())
                .map_err(|e| format!("Invalid search request: {}", e))?;

        let replacement = params["replacement"]
            .as_str()
            .ok_or("Missing replacement text")?
            .to_string();

        let dry_run = params["dry_run"].as_bool().unwrap_or(true);

        let (search_response, replace_response) = self
            .commands
            .execute_search_and_replace(search_request, replacement, dry_run)
            .await?;

        Ok(json!({
            "search": search_response,
            "replace": replace_response
        }))
    }

    async fn handle_search_stats(&self, params: Value) -> Result<Value, String> {
        let root_path = params["root_path"]
            .as_str()
            .ok_or("Missing root_path parameter")?;

        self.commands.get_search_stats(root_path).await
    }

    async fn handle_validate_pattern(&self, params: Value) -> Result<Value, String> {
        let query = params["query"].as_str().ok_or("Missing query parameter")?;

        let options: SearchOptions = if let Some(opts) = params.get("options") {
            serde_json::from_value(opts.clone()).map_err(|e| format!("Invalid options: {}", e))?
        } else {
            SearchOptions::default()
        };

        match self.commands.validate_pattern(query, &options) {
            Ok(()) => Ok(json!({"valid": true})),
            Err(e) => Ok(json!({"valid": false, "error": e})),
        }
    }

    async fn handle_supported_extensions(&self, _params: Value) -> Result<Value, String> {
        let extensions = self.commands.get_supported_extensions();
        Ok(json!({"extensions": extensions}))
    }

    async fn handle_cancel_search(&self, params: Value) -> Result<Value, String> {
        let search_id = params["search_id"]
            .as_str()
            .ok_or("Missing search_id parameter")?;

        let mut searches = self.active_searches.lock().await;
        searches.insert(search_id.to_string(), false);

        Ok(json!({"cancelled": true}))
    }
}

#[async_trait]
impl Plugin for SearchPlugin {
    fn id(&self) -> &str {
        "search_plugin"
    }

    fn metadata(&self) -> PluginMetadata {
        PluginMetadata {
            name: "SearchPlugin".to_string(),
            version: "1.0.0".to_string(),
            author: "Orchflow Team".to_string(),
            description: "Advanced file and content search with replace functionality".to_string(),
            capabilities: vec![
                "file_search".to_string(),
                "text_replace".to_string(),
                "search_and_replace".to_string(),
                "search_stats".to_string(),
                "pattern_validation".to_string(),
                "extension_support".to_string(),
                "search_cancellation".to_string(),
            ],
        }
    }

    async fn init(&mut self, _context: PluginContext) -> Result<(), String> {
        println!("SearchPlugin initialized");
        Ok(())
    }

    async fn handle_event(&mut self, _event: &Event) -> Result<(), String> {
        // Handle relevant events like file changes, project switches, etc.
        Ok(())
    }

    async fn handle_request(&mut self, method: &str, params: Value) -> Result<Value, String> {
        match method {
            "file_search" => self.handle_file_search(params).await,
            "text_replace" => self.handle_text_replace(params).await,
            "search_and_replace" => self.handle_search_and_replace(params).await,
            "search_stats" => self.handle_search_stats(params).await,
            "validate_pattern" => self.handle_validate_pattern(params).await,
            "supported_extensions" => self.handle_supported_extensions(params).await,
            "cancel_search" => self.handle_cancel_search(params).await,
            _ => Err(format!("Unknown method: {}", method)),
        }
    }

    async fn shutdown(&mut self) -> Result<(), String> {
        // Cancel any active searches
        let mut searches = self.active_searches.lock().await;
        for (_, active) in searches.iter_mut() {
            *active = false;
        }
        searches.clear();

        println!("SearchPlugin shutdown");
        Ok(())
    }
}
