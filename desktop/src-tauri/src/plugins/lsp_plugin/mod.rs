// LSP Plugin - Language Server Protocol integration

pub mod communication;
pub mod config;
pub mod handlers;
pub mod protocol;
pub mod server;
pub mod types;

use crate::manager::{Event, Plugin, PluginContext, PluginMetadata};
use async_trait::async_trait;
use handlers::LspHandlers;
use serde_json::Value;
use std::sync::Arc;
use types::DiagnosticsMap;

/// LSP Plugin - Language Server Protocol integration
pub struct LspPlugin {
    context: Option<PluginContext>,
    handlers: Option<LspHandlers>,
    diagnostics: DiagnosticsMap,
}

impl LspPlugin {
    pub fn new() -> Self {
        let diagnostics = Arc::new(tokio::sync::Mutex::new(std::collections::HashMap::new()));

        Self {
            context: None,
            handlers: None,
            diagnostics,
        }
    }
}

#[async_trait]
impl Plugin for LspPlugin {
    fn id(&self) -> &str {
        "lsp_plugin"
    }

    fn metadata(&self) -> PluginMetadata {
        PluginMetadata {
            name: "LSP Plugin".to_string(),
            version: "1.0.0".to_string(),
            author: "Orchflow Team".to_string(),
            description: "Language Server Protocol integration for advanced code editing features"
                .to_string(),
            capabilities: vec![
                "completion".to_string(),
                "hover".to_string(),
                "definition".to_string(),
                "references".to_string(),
                "formatting".to_string(),
                "diagnostics".to_string(),
                "rename".to_string(),
                "symbols".to_string(),
            ],
        }
    }

    async fn init(&mut self, context: PluginContext) -> Result<(), String> {
        println!("Initializing LSP Plugin");

        // Subscribe to file events
        context
            .subscribe(vec![
                "file_opened".to_string(),
                "file_saved".to_string(),
                "file_changed".to_string(),
            ])
            .await?;

        // Initialize handlers
        self.handlers = Some(LspHandlers::new(self.diagnostics.clone()));
        self.context = Some(context);

        println!("LSP Plugin initialized successfully");
        Ok(())
    }

    async fn handle_event(&mut self, event: &Event) -> Result<(), String> {
        if let Some(handlers) = &mut self.handlers {
            handlers.handle_event(event).await?;
        }
        Ok(())
    }

    async fn handle_request(&mut self, method: &str, params: Value) -> Result<Value, String> {
        match method {
            // LSP method forwarding
            method if method.starts_with("textDocument/") || method.starts_with("workspace/") => {
                if let Some(handlers) = &mut self.handlers {
                    handlers.handle_request(method, params).await
                } else {
                    Err("LSP handlers not initialized".to_string())
                }
            }

            // Plugin-specific methods
            "lsp/listServers" => {
                // Return list of running language servers
                if let Some(handlers) = &self.handlers {
                    let running_servers = handlers.server_manager.running_servers();
                    let server_info: Vec<serde_json::Value> = running_servers
                        .iter()
                        .filter_map(|language| {
                            handlers.server_manager.get_server(language).map(|server| {
                                serde_json::json!({
                                    "language": language,
                                    "name": server.config.name,
                                    "command": server.config.command,
                                    "initialized": server.initialized,
                                    "file_extensions": server.config.file_extensions
                                })
                            })
                        })
                        .collect();
                    
                    Ok(serde_json::json!({
                        "servers": server_info
                    }))
                } else {
                    Ok(serde_json::json!({
                        "servers": []
                    }))
                }
            }

            "lsp/getDiagnostics" => {
                let file_path = params
                    .get("file")
                    .and_then(|f| f.as_str())
                    .unwrap_or_default();

                let diagnostics = self.diagnostics.lock().await;
                let file_diagnostics = diagnostics.get(file_path).cloned().unwrap_or_default();

                Ok(serde_json::json!({
                    "file": file_path,
                    "diagnostics": file_diagnostics
                }))
            }

            _ => Err(format!("Unknown method: {}", method)),
        }
    }

    async fn shutdown(&mut self) -> Result<(), String> {
        println!("Shutting down LSP Plugin");

        if let Some(handlers) = &mut self.handlers {
            handlers.shutdown().await?;
        }

        println!("LSP Plugin shutdown complete");
        Ok(())
    }
}

impl Default for LspPlugin {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_lsp_plugin_creation() {
        let plugin = LspPlugin::new();
        assert_eq!(plugin.id(), "lsp_plugin");
        assert!(plugin.context.is_none());
        assert!(plugin.handlers.is_none());
    }

    #[tokio::test]
    async fn test_lsp_plugin_metadata() {
        let plugin = LspPlugin::new();
        let metadata = plugin.metadata();
        
        assert_eq!(metadata.name, "LSP Plugin");
        assert_eq!(metadata.version, "1.0.0");
        assert_eq!(metadata.author, "Orchflow Team");
        assert!(metadata.capabilities.contains(&"completion".to_string()));
        assert!(metadata.capabilities.contains(&"hover".to_string()));
        assert!(metadata.capabilities.contains(&"diagnostics".to_string()));
    }

    #[tokio::test]
    async fn test_handle_get_diagnostics_with_no_handlers() {
        let mut plugin = LspPlugin::new();
        
        let params = serde_json::json!({
            "file": "test.rs"
        });

        let result = plugin.handle_request("lsp/getDiagnostics", params).await;
        assert!(result.is_ok());
        
        let response = result.unwrap();
        assert_eq!(response["file"], "test.rs");
        assert!(response["diagnostics"].is_array());
    }

    #[tokio::test]
    async fn test_list_servers_with_no_handlers() {
        let mut plugin = LspPlugin::new();
        
        let result = plugin.handle_request("lsp/listServers", serde_json::json!({})).await;
        assert!(result.is_ok());
        
        let response = result.unwrap();
        assert!(response["servers"].is_array());
        assert_eq!(response["servers"].as_array().unwrap().len(), 0);
    }

    #[tokio::test]
    async fn test_unknown_method() {
        let mut plugin = LspPlugin::new();
        
        let result = plugin.handle_request("unknown/method", serde_json::json!({})).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Unknown method: unknown/method"));
    }

    #[tokio::test]
    async fn test_textdocument_method_without_handlers() {
        let mut plugin = LspPlugin::new();
        
        let params = serde_json::json!({
            "textDocument": {
                "uri": "file:///test.rs"
            }
        });

        let result = plugin.handle_request("textDocument/completion", params).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("LSP handlers not initialized"));
    }

    #[tokio::test]
    async fn test_workspace_method_without_handlers() {
        let mut plugin = LspPlugin::new();
        
        let params = serde_json::json!({
            "query": "symbol"
        });

        let result = plugin.handle_request("workspace/symbol", params).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("LSP handlers not initialized"));
    }

    #[tokio::test]
    async fn test_plugin_default() {
        let plugin = LspPlugin::default();
        assert_eq!(plugin.id(), "lsp_plugin");
    }
}
