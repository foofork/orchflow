// LSP Plugin - Language Server Protocol integration

pub mod types;
pub mod config;
pub mod server;
pub mod protocol;
pub mod communication;
pub mod handlers;

use async_trait::async_trait;
use serde_json::Value;
use std::sync::Arc;
use crate::manager::{Plugin, PluginMetadata, PluginContext, Event};
use handlers::LspHandlers;
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
            description: "Language Server Protocol integration for advanced code editing features".to_string(),
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
        context.subscribe(vec![
            "file_opened".to_string(),
            "file_saved".to_string(),
            "file_changed".to_string(),
        ]).await?;
        
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
                Ok(serde_json::json!({
                    "servers": [] // TODO: Get from handlers
                }))
            }
            
            "lsp/getDiagnostics" => {
                let file_path = params.get("file")
                    .and_then(|f| f.as_str())
                    .unwrap_or_default();
                
                let diagnostics = self.diagnostics.lock().await;
                let file_diagnostics = diagnostics.get(file_path).cloned().unwrap_or_default();
                
                Ok(serde_json::json!({
                    "file": file_path,
                    "diagnostics": file_diagnostics
                }))
            }
            
            _ => Err(format!("Unknown method: {}", method))
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