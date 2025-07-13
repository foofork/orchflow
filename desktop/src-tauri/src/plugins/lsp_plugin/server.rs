// Language server process management

use super::communication::LspCommunication;
use super::types::{LanguageServerConfig, LanguageServerProcess};
use serde_json::json;
use std::collections::HashMap;
use std::process::Stdio;
use tokio::process::Command;

pub struct ServerManager {
    servers: HashMap<String, LanguageServerProcess>,
    configs: HashMap<String, LanguageServerConfig>,
}

impl ServerManager {
    pub fn new(configs: HashMap<String, LanguageServerConfig>) -> Self {
        Self {
            servers: HashMap::new(),
            configs,
        }
    }

    /// Get the language server configurations
    pub fn get_configs(&self) -> &HashMap<String, LanguageServerConfig> {
        &self.configs
    }

    /// Start a language server for a specific language
    pub async fn start_server(&mut self, language: &str) -> Result<(), String> {
        if self.servers.contains_key(language) {
            return Ok(()); // Already running
        }

        let config = self
            .configs
            .get(language)
            .ok_or_else(|| format!("No configuration for language: {}", language))?
            .clone();

        println!("Starting language server: {} for {}", config.name, language);

        let mut cmd = Command::new(&config.command);
        cmd.args(&config.args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut process = cmd
            .spawn()
            .map_err(|e| format!("Failed to start {}: {}", config.name, e))?;

        // Set up LSP communication channels
        let stdin = process.stdin.take().ok_or("Failed to get stdin handle")?;
        let stdout = process.stdout.take().ok_or("Failed to get stdout handle")?;

        let (stdin_tx, _stdout_rx) = LspCommunication::setup_channels(stdin, stdout).await;

        let mut server_process = LanguageServerProcess::new(process, config, stdin_tx);

        // Initialize the server
        self.initialize_server(&mut server_process).await?;

        self.servers.insert(language.to_string(), server_process);

        Ok(())
    }

    /// Stop a language server
    pub async fn stop_server(&mut self, language: &str) -> Result<(), String> {
        if let Some(mut server) = self.servers.remove(language) {
            // Send shutdown request
            let shutdown_request = json!({
                "jsonrpc": "2.0",
                "id": 999,
                "method": "shutdown",
                "params": null
            });

            let request_str = serde_json::to_string(&shutdown_request)
                .map_err(|e| format!("Failed to serialize shutdown request: {}", e))?;

            if let Err(e) = server.stdin_tx.send(request_str).await {
                eprintln!("Failed to send shutdown request: {}", e);
            }

            // Send exit notification
            let exit_notification = json!({
                "jsonrpc": "2.0",
                "method": "exit"
            });

            let notification_str = serde_json::to_string(&exit_notification)
                .map_err(|e| format!("Failed to serialize exit notification: {}", e))?;

            if let Err(e) = server.stdin_tx.send(notification_str).await {
                eprintln!("Failed to send exit notification: {}", e);
            }

            // Kill the process if it doesn't exit gracefully
            if let Err(e) = server.process.kill().await {
                eprintln!("Failed to kill LSP process: {}", e);
            }

            println!("Stopped language server for {}", language);
        }

        Ok(())
    }

    /// Initialize a language server
    async fn initialize_server(&self, server: &mut LanguageServerProcess) -> Result<(), String> {
        let initialize_params = json!({
            "processId": std::process::id(),
            "rootPath": null,
            "rootUri": null,
            "capabilities": {
                "textDocument": {
                    "synchronization": {
                        "dynamicRegistration": false,
                        "willSave": false,
                        "willSaveWaitUntil": false,
                        "didSave": false
                    },
                    "completion": {
                        "dynamicRegistration": false,
                        "completionItem": {
                            "snippetSupport": false,
                            "commitCharactersSupport": false,
                            "documentationFormat": ["markdown", "plaintext"]
                        }
                    }
                }
            },
            "initializationOptions": server.config.initialization_options
        });

        let initialize_request = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": initialize_params
        });

        let request_str = serde_json::to_string(&initialize_request)
            .map_err(|e| format!("Failed to serialize initialize request: {}", e))?;

        server
            .stdin_tx
            .send(request_str)
            .await
            .map_err(|e| format!("Failed to send initialize request: {}", e))?;

        // Send initialized notification
        let initialized_notification = json!({
            "jsonrpc": "2.0",
            "method": "initialized",
            "params": {}
        });

        let notification_str = serde_json::to_string(&initialized_notification)
            .map_err(|e| format!("Failed to serialize initialized notification: {}", e))?;

        server
            .stdin_tx
            .send(notification_str)
            .await
            .map_err(|e| format!("Failed to send initialized notification: {}", e))?;

        server.initialized = true;
        println!("Initialized language server: {}", server.config.name);

        Ok(())
    }

    /// Get a reference to a running server
    pub fn get_server(&self, language: &str) -> Option<&LanguageServerProcess> {
        self.servers.get(language)
    }

    /// Get a mutable reference to a running server
    pub fn get_server_mut(&mut self, language: &str) -> Option<&mut LanguageServerProcess> {
        self.servers.get_mut(language)
    }

    /// Check if a server is running for a language
    pub fn is_server_running(&self, language: &str) -> bool {
        self.servers.contains_key(language)
    }

    /// Get all running server languages
    pub fn running_servers(&self) -> Vec<String> {
        self.servers.keys().cloned().collect()
    }

    /// Stop all running servers
    pub async fn stop_all_servers(&mut self) -> Result<(), String> {
        let languages: Vec<String> = self.servers.keys().cloned().collect();

        for language in languages {
            if let Err(e) = self.stop_server(&language).await {
                eprintln!("Failed to stop server for {}: {}", language, e);
            }
        }

        Ok(())
    }
}
