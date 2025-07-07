use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::process::Stdio;
use tokio::process::{Child, Command};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader, AsyncWrite, AsyncRead};
use tokio::sync::{mpsc, Mutex};
use std::sync::Arc;
use tower_lsp::{LspService, Server};
use lsp_types::*;
use crate::orchestrator::{Plugin, PluginMetadata, PluginContext, Event, Action};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct LanguageServerConfig {
    name: String,
    command: String,
    args: Vec<String>,
    file_extensions: Vec<String>,
    root_markers: Vec<String>,
    initialization_options: Option<Value>,
}

struct LanguageServerProcess {
    process: Child,
    config: LanguageServerConfig,
    initialized: bool,
    request_id: Arc<Mutex<i64>>,
    pending_requests: Arc<Mutex<HashMap<i64, mpsc::Sender<Result<Value, String>>>>>,
    stdin_tx: mpsc::Sender<String>,
}

/// LSP Plugin - Language Server Protocol integration
pub struct LspPlugin {
    context: Option<PluginContext>,
    servers: HashMap<String, LanguageServerProcess>,
    server_configs: HashMap<String, LanguageServerConfig>,
    file_to_server: HashMap<String, String>,
    diagnostics: Arc<Mutex<HashMap<String, Vec<Diagnostic>>>>,
}

impl LspPlugin {
    pub fn new() -> Self {
        let mut server_configs = HashMap::new();
        
        // Rust Analyzer
        server_configs.insert("rust".to_string(), LanguageServerConfig {
            name: "rust-analyzer".to_string(),
            command: "rust-analyzer".to_string(),
            args: vec![],
            file_extensions: vec!["rs".to_string()],
            root_markers: vec!["Cargo.toml".to_string()],
            initialization_options: Some(json!({
                "cargo": {
                    "buildScripts": {
                        "enable": true
                    }
                },
                "procMacro": {
                    "enable": true
                }
            })),
        });
        
        // TypeScript Language Server
        server_configs.insert("typescript".to_string(), LanguageServerConfig {
            name: "typescript-language-server".to_string(),
            command: "typescript-language-server".to_string(),
            args: vec!["--stdio".to_string()],
            file_extensions: vec!["ts".to_string(), "tsx".to_string(), "js".to_string(), "jsx".to_string()],
            root_markers: vec!["package.json".to_string(), "tsconfig.json".to_string()],
            initialization_options: None,
        });
        
        // Python Language Server (Pylsp)
        server_configs.insert("python".to_string(), LanguageServerConfig {
            name: "pylsp".to_string(),
            command: "pylsp".to_string(),
            args: vec![],
            file_extensions: vec!["py".to_string()],
            root_markers: vec!["setup.py".to_string(), "pyproject.toml".to_string(), "requirements.txt".to_string()],
            initialization_options: None,
        });
        
        // Go Language Server
        server_configs.insert("go".to_string(), LanguageServerConfig {
            name: "gopls".to_string(),
            command: "gopls".to_string(),
            args: vec![],
            file_extensions: vec!["go".to_string()],
            root_markers: vec!["go.mod".to_string()],
            initialization_options: None,
        });
        
        Self {
            context: None,
            servers: HashMap::new(),
            server_configs,
            file_to_server: HashMap::new(),
            diagnostics: Arc::new(Mutex::new(HashMap::new())),
        }
    }
    
    /// Start a language server for a specific language
    async fn start_language_server(&mut self, language: &str) -> Result<(), String> {
        if self.servers.contains_key(language) {
            return Ok(()); // Already running
        }
        
        let config = self.server_configs.get(language)
            .ok_or_else(|| format!("No configuration for language: {}", language))?
            .clone();
        
        println!("Starting language server: {} for {}", config.name, language);
        
        let mut cmd = Command::new(&config.command);
        cmd.args(&config.args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        
        let mut process = cmd.spawn()
            .map_err(|e| format!("Failed to start {}: {}", config.name, e))?;
        
        // Set up LSP communication channels
        let stdin = process.stdin.take()
            .ok_or("Failed to get stdin handle")?;
        let stdout = process.stdout.take()
            .ok_or("Failed to get stdout handle")?;
        
        // Create channels for communication
        let (stdin_tx, mut stdin_rx) = mpsc::channel::<String>(100);
        let request_id = Arc::new(Mutex::new(0i64));
        let pending_requests: Arc<Mutex<HashMap<i64, mpsc::Sender<Result<Value, String>>>>> = Arc::new(Mutex::new(HashMap::new()));
        
        // Spawn stdin writer task
        tokio::spawn(async move {
            let mut stdin = stdin;
            while let Some(msg) = stdin_rx.recv().await {
                let content = format!("Content-Length: {}\r\n\r\n{}", msg.len(), msg);
                if let Err(e) = stdin.write_all(content.as_bytes()).await {
                    eprintln!("Failed to write to LSP stdin: {}", e);
                    break;
                }
                if let Err(e) = stdin.flush().await {
                    eprintln!("Failed to flush LSP stdin: {}", e);
                    break;
                }
            }
        });
        
        // Spawn stdout reader task
        let pending_requests_clone = pending_requests.clone();
        let diagnostics_clone = self.diagnostics.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout);
            let mut buffer = String::new();
            
            loop {
                buffer.clear();
                
                // Read headers
                let mut content_length = 0;
                loop {
                    let mut line = String::new();
                    if reader.read_line(&mut line).await.is_err() {
                        return;
                    }
                    
                    if line.trim().is_empty() {
                        break;
                    }
                    
                    if let Some(length) = line.strip_prefix("Content-Length: ") {
                        content_length = length.trim().parse().unwrap_or(0);
                    }
                }
                
                // Read content
                if content_length > 0 {
                    let mut content = vec![0u8; content_length];
                    use tokio::io::AsyncReadExt;
                    if reader.read_exact(&mut content).await.is_err() {
                        return;
                    }
                    
                    if let Ok(content_str) = String::from_utf8(content) {
                        if let Ok(msg) = serde_json::from_str::<Value>(&content_str) {
                            // Handle response or notification
                            if let Some(id) = msg.get("id").and_then(|v| v.as_i64()) {
                                // This is a response
                                if let Some(tx) = pending_requests_clone.lock().await.remove(&id) {
                                    if let Some(error) = msg.get("error") {
                                        let _ = tx.send(Err(format!("LSP error: {:?}", error))).await;
                                    } else if let Some(result) = msg.get("result") {
                                        let _ = tx.send(Ok(result.clone())).await;
                                    }
                                }
                            } else {
                                // This is a notification
                                if let Some(method) = msg.get("method").and_then(|v| v.as_str()) {
                                    match method {
                                        "textDocument/publishDiagnostics" => {
                                            if let Some(params) = msg.get("params") {
                                                if let Some(uri) = params.get("uri").and_then(|v| v.as_str()) {
                                                    if let Some(diagnostics) = params.get("diagnostics").and_then(|v| v.as_array()) {
                                                        let mut diag_list = Vec::new();
                                                        for diag in diagnostics {
                                                            if let Ok(diagnostic) = serde_json::from_value::<Diagnostic>(diag.clone()) {
                                                                diag_list.push(diagnostic);
                                                            }
                                                        }
                                                        diagnostics_clone.lock().await.insert(uri.to_string(), diag_list);
                                                    }
                                                }
                                            }
                                        }
                                        _ => {
                                            // Other notifications can be handled here
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
        
        let mut server_process = LanguageServerProcess {
            process,
            config,
            initialized: false,
            request_id,
            pending_requests,
            stdin_tx,
        };
        
        // Initialize the server
        self.initialize_server(&mut server_process).await?;
        
        self.servers.insert(language.to_string(), server_process);
        
        Ok(())
    }
    
    /// Stop a language server
    async fn stop_language_server(&mut self, language: &str) -> Result<(), String> {
        if let Some(mut server) = self.servers.remove(language) {
            server.process.kill().await
                .map_err(|e| format!("Failed to stop language server: {}", e))?;
        }
        Ok(())
    }
    
    /// Send an LSP request and wait for response
    async fn send_lsp_request(
        &self, 
        server: &LanguageServerProcess,
        method: &str,
        params: Value
    ) -> Result<Value, String> {
        let id = {
            let mut request_id = server.request_id.lock().await;
            *request_id += 1;
            *request_id
        };
        
        let request = json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params
        });
        
        let (tx, mut rx) = mpsc::channel(1);
        server.pending_requests.lock().await.insert(id, tx);
        
        // Send request
        server.stdin_tx.send(request.to_string()).await
            .map_err(|_| "Failed to send request to LSP server")?;
        
        // Wait for response with timeout
        match tokio::time::timeout(std::time::Duration::from_secs(30), rx.recv()).await {
            Ok(Some(result)) => result,
            Ok(None) => Err("LSP request cancelled".to_string()),
            Err(_) => {
                server.pending_requests.lock().await.remove(&id);
                Err("LSP request timeout".to_string())
            }
        }
    }
    
    /// Initialize the language server
    async fn initialize_server(&self, server: &mut LanguageServerProcess) -> Result<(), String> {
        let root_uri = format!("file://{}", std::env::current_dir()
            .map_err(|e| e.to_string())?
            .display());
        
        let init_params = json!({
            "processId": std::process::id(),
            "rootUri": root_uri,
            "capabilities": {
                "textDocument": {
                    "completion": {
                        "completionItem": {
                            "snippetSupport": true,
                            "documentationFormat": ["markdown", "plaintext"]
                        }
                    },
                    "hover": {
                        "contentFormat": ["markdown", "plaintext"]
                    },
                    "definition": {
                        "linkSupport": true
                    },
                    "references": {},
                    "documentHighlight": {},
                    "documentSymbol": {
                        "hierarchicalDocumentSymbolSupport": true
                    },
                    "formatting": {},
                    "rangeFormatting": {},
                    "rename": {
                        "prepareSupport": true
                    },
                    "publishDiagnostics": {
                        "relatedInformation": true
                    }
                }
            },
            "initializationOptions": server.config.initialization_options.clone()
        });
        
        self.send_lsp_request(server, "initialize", init_params).await?;
        
        // Send initialized notification
        let notification = json!({
            "jsonrpc": "2.0",
            "method": "initialized",
            "params": {}
        });
        
        server.stdin_tx.send(notification.to_string()).await
            .map_err(|_| "Failed to send initialized notification")?;
        
        server.initialized = true;
        Ok(())
    }
    
    /// Get the language for a file based on extension
    fn get_language_for_file(&self, file_path: &str) -> Option<String> {
        let extension = std::path::Path::new(file_path)
            .extension()?
            .to_str()?;
        
        for (language, config) in &self.server_configs {
            if config.file_extensions.contains(&extension.to_string()) {
                return Some(language.clone());
            }
        }
        
        None
    }
    
    /// Forward an LSP request to the appropriate language server
    async fn forward_lsp_request(&mut self, method: &str, params: Value) -> Result<Value, String> {
        let file_path = params.get("textDocument")
            .and_then(|doc| doc.get("uri"))
            .and_then(|uri| uri.as_str())
            .ok_or("Missing textDocument.uri in request")?;
        
        let language = self.get_language_for_file(file_path)
            .ok_or("No language server for file type")?;
        
        // Ensure server is started
        self.start_language_server(&language).await?;
        
        // Get the server
        let server = self.servers.get(&language)
            .ok_or("Language server not running")?;
        
        // Forward the request to the LSP server
        self.send_lsp_request(server, method, params).await
    }
}

#[async_trait]
impl Plugin for LspPlugin {
    fn id(&self) -> &str {
        "lsp"
    }
    
    fn metadata(&self) -> PluginMetadata {
        PluginMetadata {
            name: "Language Server Protocol".to_string(),
            version: "0.1.0".to_string(),
            author: "Orchflow Team".to_string(),
            description: "LSP integration for code intelligence".to_string(),
            capabilities: vec![
                "lsp.completion".to_string(),
                "lsp.hover".to_string(),
                "lsp.definition".to_string(),
                "lsp.references".to_string(),
                "lsp.diagnostics".to_string(),
                "lsp.formatting".to_string(),
            ],
        }
    }
    
    async fn init(&mut self, context: PluginContext) -> Result<(), String> {
        context.subscribe(vec![
            "file_opened".to_string(),
            "file_closed".to_string(),
            "file_changed".to_string(),
            "file_saved".to_string(),
        ]).await?;
        
        self.context = Some(context);
        
        // Check for available language servers
        for (language, config) in &self.server_configs {
            if let Ok(output) = Command::new("which")
                .arg(&config.command)
                .output()
                .await
            {
                if output.status.success() {
                    println!("Language server available: {} ({})", config.name, language);
                } else {
                    println!("Language server not found: {} - Install {} for {} support", 
                        config.command, config.name, language);
                }
            }
        }
        
        Ok(())
    }
    
    async fn handle_event(&mut self, event: &Event) -> Result<(), String> {
        match event {
            Event::FileOpened { path, pane_id: _ } => {
                if let Some(language) = self.get_language_for_file(path) {
                    self.start_language_server(&language).await?;
                    self.file_to_server.insert(path.to_string(), language);
                }
            }
            Event::FileSaved { path } => {
                if let Some(language) = self.file_to_server.get(path) {
                    if let Some(server) = self.servers.get(language) {
                        let notification = json!({
                            "jsonrpc": "2.0",
                            "method": "textDocument/didSave",
                            "params": {
                                "textDocument": {
                                    "uri": format!("file://{}", path)
                                }
                            }
                        });
                        let _ = server.stdin_tx.send(notification.to_string()).await;
                    }
                }
            }
            Event::FileChanged { path } => {
                if let Some(language) = self.file_to_server.get(path) {
                    if let Some(server) = self.servers.get(language) {
                        // Read file content for didChange notification
                        if let Ok(content) = tokio::fs::read_to_string(path).await {
                            let notification = json!({
                                "jsonrpc": "2.0",
                                "method": "textDocument/didChange",
                                "params": {
                                    "textDocument": {
                                        "uri": format!("file://{}", path),
                                        "version": chrono::Utc::now().timestamp()
                                    },
                                    "contentChanges": [{
                                        "text": content
                                    }]
                                }
                            });
                            let _ = server.stdin_tx.send(notification.to_string()).await;
                        }
                    }
                }
            }
            _ => {}
        }
        Ok(())
    }
    
    async fn handle_request(&mut self, method: &str, params: Value) -> Result<Value, String> {
        match method {
            "lsp.initialize" => {
                // Initialize all configured language servers
                let mut results = HashMap::new();
                for (language, _) in self.server_configs.clone() {
                    match self.start_language_server(&language).await {
                        Ok(_) => results.insert(language, "started".to_string()),
                        Err(e) => results.insert(language, format!("error: {}", e)),
                    };
                }
                Ok(json!({ "servers": results }))
            }
            
            "lsp.shutdown" => {
                // Shutdown all language servers
                let languages: Vec<_> = self.servers.keys().cloned().collect();
                for language in languages {
                    self.stop_language_server(&language).await?;
                }
                Ok(json!({ "status": "ok" }))
            }
            
            "lsp.listServers" => {
                let servers: Vec<_> = self.servers.keys()
                    .map(|lang| json!({
                        "language": lang,
                        "status": "running",
                        "name": self.server_configs[lang].name.clone()
                    }))
                    .collect();
                Ok(json!({ "servers": servers }))
            }
            
            "lsp.capabilities" => {
                // Return supported LSP capabilities
                Ok(json!({
                    "textDocumentSync": 2, // Incremental
                    "completionProvider": {
                        "resolveProvider": true,
                        "triggerCharacters": [".", ":", ">"]
                    },
                    "hoverProvider": true,
                    "definitionProvider": true,
                    "referencesProvider": true,
                    "documentSymbolProvider": true,
                    "workspaceSymbolProvider": true,
                    "codeActionProvider": true,
                    "documentFormattingProvider": true,
                    "renameProvider": true,
                    "foldingRangeProvider": true,
                    "diagnosticProvider": {
                        "interFileDependencies": true,
                        "workspaceDiagnostics": true
                    }
                }))
            }
            
            // Forward LSP requests
            method if method.starts_with("textDocument/") => {
                self.forward_lsp_request(method, params).await
            }
            
            method if method.starts_with("workspace/") => {
                self.forward_lsp_request(method, params).await
            }
            
            _ => Err(format!("Unknown method: {}", method))
        }
    }
    
    async fn shutdown(&mut self) -> Result<(), String> {
        // Shutdown all language servers
        let languages: Vec<_> = self.servers.keys().cloned().collect();
        for language in languages {
            self.stop_language_server(&language).await?;
        }
        Ok(())
    }
}