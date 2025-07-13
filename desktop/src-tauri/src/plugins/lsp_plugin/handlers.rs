// Event and request handlers for LSP plugin

use super::config;
use super::protocol::LspProtocol;
use super::server::ServerManager;
use super::types::DiagnosticsMap;
use crate::manager::Event;
use serde_json::Value;

pub struct LspHandlers {
    pub server_manager: ServerManager,
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
            "diagnostics/get" => self.handle_get_diagnostics_request(params).await,
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
            .ok_or("No language server associated with file")?
            .clone();

        let server = self
            .server_manager
            .get_server_mut(&language)
            .ok_or("Language server not running")?;

        // Generate request ID
        let mut request_id_lock = server.request_id.lock().await;
        *request_id_lock += 1;
        let request_id = *request_id_lock;
        drop(request_id_lock);

        // Create response channel
        let (response_tx, mut response_rx) = tokio::sync::mpsc::channel(1);
        
        // Store the response channel
        {
            let mut pending = server.pending_requests.lock().await;
            pending.insert(request_id, response_tx);
        }

        // Construct the LSP request
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
            "params": params
        });

        // Send the request
        let request_str = serde_json::to_string(&request)
            .map_err(|e| format!("Failed to serialize request: {}", e))?;

        server
            .stdin_tx
            .send(request_str)
            .await
            .map_err(|e| format!("Failed to send request: {}", e))?;

        // Wait for response with timeout
        match tokio::time::timeout(std::time::Duration::from_secs(30), response_rx.recv()).await {
            Ok(Some(Ok(result))) => Ok(result),
            Ok(Some(Err(error))) => Err(format!("LSP error: {}", error)),
            Ok(None) => Err("Response channel closed".to_string()),
            Err(_) => Err("Request timeout".to_string()),
        }
    }

    /// Handle get diagnostics request
    async fn handle_get_diagnostics_request(&self, params: Value) -> Result<Value, String> {

        let file_path = params
            .get("file")
            .and_then(|f| f.as_str())
            .ok_or("No file path provided")?;

        let diagnostics = self.diagnostics.lock().await;
        let file_diagnostics = diagnostics.get(file_path).cloned().unwrap_or_default();

        // Convert diagnostics to JSON
        let diagnostics_json: Vec<serde_json::Value> = file_diagnostics
            .iter()
            .map(|d| serde_json::to_value(d).unwrap_or_default())
            .collect();

        Ok(serde_json::json!({
            "file": file_path,
            "diagnostics": diagnostics_json
        }))
    }

    /// Get all diagnostics for all files
    pub async fn get_all_diagnostics(&self) -> std::collections::HashMap<String, Vec<lsp_types::Diagnostic>> {
        self.diagnostics.lock().await.clone()
    }

    /// Get diagnostics for a specific file
    pub async fn get_file_diagnostics(&self, file_path: &str) -> Option<Vec<lsp_types::Diagnostic>> {
        self.diagnostics.lock().await.get(file_path).cloned()
    }

    /// Clear diagnostics for a specific file
    pub async fn clear_file_diagnostics(&self, file_path: &str) {
        self.diagnostics.lock().await.remove(file_path);
    }

    /// Get diagnostic count for a file
    pub async fn get_diagnostic_count(&self, file_path: &str) -> usize {
        self.diagnostics
            .lock()
            .await
            .get(file_path)
            .map(|d| d.len())
            .unwrap_or(0)
    }

    /// Get error count for a file
    pub async fn get_error_count(&self, file_path: &str) -> usize {
        use lsp_types::DiagnosticSeverity;
        
        self.diagnostics
            .lock()
            .await
            .get(file_path)
            .map(|diagnostics| {
                diagnostics
                    .iter()
                    .filter(|d| {
                        d.severity == Some(DiagnosticSeverity::ERROR)
                    })
                    .count()
            })
            .unwrap_or(0)
    }

    /// Get warning count for a file
    pub async fn get_warning_count(&self, file_path: &str) -> usize {
        use lsp_types::DiagnosticSeverity;
        
        self.diagnostics
            .lock()
            .await
            .get(file_path)
            .map(|diagnostics| {
                diagnostics
                    .iter()
                    .filter(|d| {
                        d.severity == Some(DiagnosticSeverity::WARNING)
                    })
                    .count()
            })
            .unwrap_or(0)
    }

    /// Shutdown all language servers
    pub async fn shutdown(&mut self) -> Result<(), String> {
        self.server_manager.stop_all_servers().await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use lsp_types::{Diagnostic, DiagnosticSeverity, Position, Range};
    use std::collections::HashMap;
    use std::sync::Arc;
    use tokio::sync::Mutex;

    fn create_test_diagnostic(severity: DiagnosticSeverity, message: &str) -> Diagnostic {
        Diagnostic {
            range: Range {
                start: Position { line: 0, character: 0 },
                end: Position { line: 0, character: 10 },
            },
            severity: Some(severity),
            code: None,
            code_description: None,
            source: Some("test".to_string()),
            message: message.to_string(),
            related_information: None,
            tags: None,
            data: None,
        }
    }

    #[tokio::test]
    async fn test_get_file_diagnostics() {
        let mut diagnostics_map = HashMap::new();
        diagnostics_map.insert(
            "test.rs".to_string(),
            vec![
                create_test_diagnostic(DiagnosticSeverity::ERROR, "Test error"),
                create_test_diagnostic(DiagnosticSeverity::WARNING, "Test warning"),
            ],
        );

        let diagnostics = Arc::new(Mutex::new(diagnostics_map));
        let handlers = LspHandlers::new(diagnostics);

        let file_diagnostics = handlers.get_file_diagnostics("test.rs").await;
        assert!(file_diagnostics.is_some());
        assert_eq!(file_diagnostics.unwrap().len(), 2);

        let nonexistent = handlers.get_file_diagnostics("nonexistent.rs").await;
        assert!(nonexistent.is_none());
    }

    #[tokio::test]
    async fn test_diagnostic_counts() {
        let mut diagnostics_map = HashMap::new();
        diagnostics_map.insert(
            "test.rs".to_string(),
            vec![
                create_test_diagnostic(DiagnosticSeverity::ERROR, "Error 1"),
                create_test_diagnostic(DiagnosticSeverity::ERROR, "Error 2"),
                create_test_diagnostic(DiagnosticSeverity::WARNING, "Warning 1"),
                create_test_diagnostic(DiagnosticSeverity::WARNING, "Warning 2"),
                create_test_diagnostic(DiagnosticSeverity::WARNING, "Warning 3"),
            ],
        );

        let diagnostics = Arc::new(Mutex::new(diagnostics_map));
        let handlers = LspHandlers::new(diagnostics);

        assert_eq!(handlers.get_diagnostic_count("test.rs").await, 5);
        assert_eq!(handlers.get_error_count("test.rs").await, 2);
        assert_eq!(handlers.get_warning_count("test.rs").await, 3);

        // Test nonexistent file
        assert_eq!(handlers.get_diagnostic_count("nonexistent.rs").await, 0);
        assert_eq!(handlers.get_error_count("nonexistent.rs").await, 0);
        assert_eq!(handlers.get_warning_count("nonexistent.rs").await, 0);
    }

    #[tokio::test]
    async fn test_clear_file_diagnostics() {
        let mut diagnostics_map = HashMap::new();
        diagnostics_map.insert(
            "test.rs".to_string(),
            vec![create_test_diagnostic(DiagnosticSeverity::ERROR, "Test error")],
        );

        let diagnostics = Arc::new(Mutex::new(diagnostics_map));
        let handlers = LspHandlers::new(diagnostics);

        assert_eq!(handlers.get_diagnostic_count("test.rs").await, 1);

        handlers.clear_file_diagnostics("test.rs").await;
        assert_eq!(handlers.get_diagnostic_count("test.rs").await, 0);
    }

    #[tokio::test]
    async fn test_get_all_diagnostics() {
        let mut diagnostics_map = HashMap::new();
        diagnostics_map.insert(
            "test1.rs".to_string(),
            vec![create_test_diagnostic(DiagnosticSeverity::ERROR, "Error in file 1")],
        );
        diagnostics_map.insert(
            "test2.rs".to_string(),
            vec![create_test_diagnostic(DiagnosticSeverity::WARNING, "Warning in file 2")],
        );

        let diagnostics = Arc::new(Mutex::new(diagnostics_map));
        let handlers = LspHandlers::new(diagnostics);

        let all_diagnostics = handlers.get_all_diagnostics().await;
        assert_eq!(all_diagnostics.len(), 2);
        assert!(all_diagnostics.contains_key("test1.rs"));
        assert!(all_diagnostics.contains_key("test2.rs"));
    }

    #[tokio::test]
    async fn test_handle_request_unsupported_method() {
        let diagnostics = Arc::new(Mutex::new(HashMap::new()));
        let mut handlers = LspHandlers::new(diagnostics);

        let result = handlers
            .handle_request("unsupported/method", serde_json::json!({}))
            .await;

        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .contains("Unsupported LSP method: unsupported/method"));
    }

    #[tokio::test]
    async fn test_handle_get_diagnostics_request() {
        let mut diagnostics_map = HashMap::new();
        diagnostics_map.insert(
            "test.rs".to_string(),
            vec![create_test_diagnostic(DiagnosticSeverity::ERROR, "Test error")],
        );

        let diagnostics = Arc::new(Mutex::new(diagnostics_map));
        let handlers = LspHandlers::new(diagnostics);

        let params = serde_json::json!({
            "file": "test.rs"
        });

        let result = handlers.handle_get_diagnostics_request(params).await;
        assert!(result.is_ok());

        let response = result.unwrap();
        assert_eq!(response["file"], "test.rs");
        assert!(response["diagnostics"].is_array());
        assert_eq!(response["diagnostics"].as_array().unwrap().len(), 1);
    }

    #[tokio::test]
    async fn test_handle_get_diagnostics_request_no_file() {
        let diagnostics = Arc::new(Mutex::new(HashMap::new()));
        let handlers = LspHandlers::new(diagnostics);

        let params = serde_json::json!({});

        let result = handlers.handle_get_diagnostics_request(params).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("No file path provided"));
    }

    #[tokio::test]
    async fn test_handle_get_diagnostics_request_nonexistent_file() {
        let diagnostics = Arc::new(Mutex::new(HashMap::new()));
        let handlers = LspHandlers::new(diagnostics);

        let params = serde_json::json!({
            "file": "nonexistent.rs"
        });

        let result = handlers.handle_get_diagnostics_request(params).await;
        assert!(result.is_ok());

        let response = result.unwrap();
        assert_eq!(response["file"], "nonexistent.rs");
        assert!(response["diagnostics"].is_array());
        assert_eq!(response["diagnostics"].as_array().unwrap().len(), 0);
    }

    #[tokio::test]
    async fn test_forward_lsp_request_no_uri() {
        let diagnostics = Arc::new(Mutex::new(HashMap::new()));
        let mut handlers = LspHandlers::new(diagnostics);

        let params = serde_json::json!({});

        let result = handlers
            .forward_lsp_request("textDocument/completion", params)
            .await;

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("No URI found in request"));
    }

    #[tokio::test]
    async fn test_forward_lsp_request_no_language_server() {
        let diagnostics = Arc::new(Mutex::new(HashMap::new()));
        let mut handlers = LspHandlers::new(diagnostics);

        let params = serde_json::json!({
            "textDocument": {
                "uri": "file:///test.rs"
            }
        });

        let result = handlers
            .forward_lsp_request("textDocument/completion", params)
            .await;

        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .contains("No language server associated with file"));
    }
}
