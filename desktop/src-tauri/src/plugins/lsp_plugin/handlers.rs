// Event and request handlers for LSP plugin

use super::config;
use super::protocol::LspProtocol;
use super::server::ServerManager;
use super::types::DiagnosticsMap;
use crate::manager::Event;
use serde_json::Value;

pub struct LspHandlers {
    server_manager: ServerManager,
    file_to_server: std::collections::HashMap<String, String>,
    diagnostics: DiagnosticsMap,
}

impl LspHandlers {
    pub fn new(diagnostics: DiagnosticsMap) -> Self {
        let configs = config::default_server_configs();
        Self {
            server_manager: ServerManager::new(configs),
            file_to_server: std::collections::HashMap::new(),
            diagnostics,
        }
    }

    /// Handle file-related events
    pub async fn handle_event(&mut self, event: &Event) -> Result<(), String> {
        match event {
            Event::FileOpened { path, .. } => {
                self.handle_file_opened(path).await?;
            }
            Event::FileSaved { path } => {
                self.handle_file_saved(path).await?;
            }
            Event::FileChanged { path } => {
                self.handle_file_changed(path).await?;
            }
            _ => {
                // Ignore other events
            }
        }
        Ok(())
    }

    /// Handle LSP method requests
    pub async fn handle_request(&mut self, method: &str, params: Value) -> Result<Value, String> {
        match method {
            "textDocument/completion" => self.handle_completion_request(params).await,
            "textDocument/hover" => self.handle_hover_request(params).await,
            "textDocument/definition" => self.handle_definition_request(params).await,
            "textDocument/references" => self.handle_references_request(params).await,
            "textDocument/formatting" => self.handle_formatting_request(params).await,
            "textDocument/rename" => self.handle_rename_request(params).await,
            "workspace/symbol" => self.handle_workspace_symbol_request(params).await,
            "textDocument/documentSymbol" => self.handle_document_symbol_request(params).await,
            _ => Err(format!("Unsupported LSP method: {}", method)),
        }
    }

    /// Handle file opened event
    async fn handle_file_opened(&mut self, path: &str) -> Result<(), String> {
        if let Some(language) =
            config::get_language_for_file(path, self.server_manager.get_configs())
        {
            // Start language server if not running
            if !self.server_manager.is_server_running(&language) {
                self.server_manager.start_server(&language).await?;
            }

            // Track which server handles this file
            self.file_to_server
                .insert(path.to_string(), language.clone());

            // Send didOpen notification
            if let Some(server) = self.server_manager.get_server(&language) {
                let uri = LspProtocol::path_to_uri(path);
                let text = tokio::fs::read_to_string(path).await.unwrap_or_default();

                let params = LspProtocol::did_open_text_document(&uri, &language, &text);

                let notification = serde_json::json!({
                    "jsonrpc": "2.0",
                    "method": "textDocument/didOpen",
                    "params": params
                });

                let notification_str = serde_json::to_string(&notification)
                    .map_err(|e| format!("Failed to serialize didOpen: {}", e))?;

                server
                    .stdin_tx
                    .send(notification_str)
                    .await
                    .map_err(|e| format!("Failed to send didOpen: {}", e))?;
            }
        }

        Ok(())
    }

    /// Handle file saved event
    async fn handle_file_saved(&mut self, path: &str) -> Result<(), String> {
        if let Some(language) = self.file_to_server.get(path) {
            if let Some(server) = self.server_manager.get_server(language) {
                let uri = LspProtocol::path_to_uri(path);
                let text = tokio::fs::read_to_string(path).await.ok();

                let params = LspProtocol::did_save_text_document(&uri, text.as_deref());

                let notification = serde_json::json!({
                    "jsonrpc": "2.0",
                    "method": "textDocument/didSave",
                    "params": params
                });

                let notification_str = serde_json::to_string(&notification)
                    .map_err(|e| format!("Failed to serialize didSave: {}", e))?;

                server
                    .stdin_tx
                    .send(notification_str)
                    .await
                    .map_err(|e| format!("Failed to send didSave: {}", e))?;
            }
        }

        Ok(())
    }

    /// Handle file changed event
    async fn handle_file_changed(&mut self, path: &str) -> Result<(), String> {
        if let Some(language) = self.file_to_server.get(path) {
            if let Some(server) = self.server_manager.get_server(language) {
                let uri = LspProtocol::path_to_uri(path);
                let text = tokio::fs::read_to_string(path).await.unwrap_or_default();

                let params = LspProtocol::did_change_text_document(&uri, 1, &text);

                let notification = serde_json::json!({
                    "jsonrpc": "2.0",
                    "method": "textDocument/didChange",
                    "params": params
                });

                let notification_str = serde_json::to_string(&notification)
                    .map_err(|e| format!("Failed to serialize didChange: {}", e))?;

                server
                    .stdin_tx
                    .send(notification_str)
                    .await
                    .map_err(|e| format!("Failed to send didChange: {}", e))?;
            }
        }

        Ok(())
    }

    // LSP request handlers
    async fn handle_completion_request(&mut self, params: Value) -> Result<Value, String> {
        // Forward to appropriate language server
        self.forward_lsp_request("textDocument/completion", params)
            .await
    }

    async fn handle_hover_request(&mut self, params: Value) -> Result<Value, String> {
        self.forward_lsp_request("textDocument/hover", params).await
    }

    async fn handle_definition_request(&mut self, params: Value) -> Result<Value, String> {
        self.forward_lsp_request("textDocument/definition", params)
            .await
    }

    async fn handle_references_request(&mut self, params: Value) -> Result<Value, String> {
        self.forward_lsp_request("textDocument/references", params)
            .await
    }

    async fn handle_formatting_request(&mut self, params: Value) -> Result<Value, String> {
        self.forward_lsp_request("textDocument/formatting", params)
            .await
    }

    async fn handle_rename_request(&mut self, params: Value) -> Result<Value, String> {
        self.forward_lsp_request("textDocument/rename", params)
            .await
    }

    async fn handle_workspace_symbol_request(&mut self, params: Value) -> Result<Value, String> {
        self.forward_lsp_request("workspace/symbol", params).await
    }

    async fn handle_document_symbol_request(&mut self, params: Value) -> Result<Value, String> {
        self.forward_lsp_request("textDocument/documentSymbol", params)
            .await
    }

    /// Forward an LSP request to the appropriate language server
    async fn forward_lsp_request(&mut self, method: &str, params: Value) -> Result<Value, String> {
        // Extract URI from params to determine which server to use
        let uri = params
            .get("textDocument")
            .and_then(|doc| doc.get("uri"))
            .and_then(|uri| uri.as_str())
            .ok_or("No URI found in request")?;

        let path = LspProtocol::uri_to_path(uri).ok_or("Invalid URI format")?;

        let language = self
            .file_to_server
            .get(&path)
            .ok_or("No language server associated with file")?;

        let server = self
            .server_manager
            .get_server(language)
            .ok_or("Language server not running")?;

        // TODO: Actually send request and wait for response
        // For now, return a placeholder
        Ok(serde_json::json!({
            "error": "LSP request forwarding not fully implemented"
        }))
    }

    /// Shutdown all language servers
    pub async fn shutdown(&mut self) -> Result<(), String> {
        self.server_manager.stop_all_servers().await
    }
}
