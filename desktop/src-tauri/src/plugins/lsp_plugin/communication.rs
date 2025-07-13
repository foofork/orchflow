// LSP communication channels and message handling

use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{ChildStdin, ChildStdout};
use tokio::sync::{mpsc, Mutex};

pub struct LspCommunication {
    pub stdin_tx: mpsc::Sender<String>,
    pub request_id_counter: Arc<Mutex<i64>>,
    pub pending_requests: Arc<Mutex<HashMap<i64, mpsc::Sender<Result<Value, String>>>>>,
}

impl LspCommunication {
    pub fn new() -> Self {
        let (stdin_tx, _) = mpsc::channel(100);
        Self {
            stdin_tx,
            request_id_counter: Arc::new(Mutex::new(0i64)),
            pending_requests: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Set up communication channels for a language server process
    pub async fn setup_channels(
        stdin: ChildStdin,
        stdout: ChildStdout,
    ) -> (mpsc::Sender<String>, mpsc::Receiver<String>) {
        let (stdin_tx, mut stdin_rx) = mpsc::channel::<String>(100);
        let (stdout_tx, stdout_rx) = mpsc::channel::<String>(100);

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
        tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();

            while let Ok(Some(line)) = lines.next_line().await {
                if line.starts_with("Content-Length:") {
                    let length: usize = line
                        .trim_start_matches("Content-Length:")
                        .trim()
                        .parse()
                        .unwrap_or(0);

                    // Skip empty line
                    if let Ok(Some(_)) = lines.next_line().await {
                        // Read the JSON content
                        let mut content = Vec::new();
                        let mut bytes_read = 0;

                        while bytes_read < length {
                            if let Ok(Some(content_line)) = lines.next_line().await {
                                content.push(content_line);
                                bytes_read += content.last().unwrap().len() + 1;
                            // +1 for newline
                            } else {
                                break;
                            }
                        }

                        let json_content = content.join("\n");
                        if let Err(e) = stdout_tx.send(json_content).await {
                            eprintln!("Failed to send LSP message: {}", e);
                            break;
                        }
                    }
                }
            }
        });

        (stdin_tx, stdout_rx)
    }

    /// Generate next request ID
    pub async fn next_request_id(&self) -> i64 {
        let mut counter = self.request_id_counter.lock().await;
        *counter += 1;
        *counter
    }

    /// Send a request and return a receiver for the response
    pub async fn send_request(
        &self,
        method: &str,
        params: Value,
    ) -> Result<mpsc::Receiver<Result<Value, String>>, String> {
        let request_id = self.next_request_id().await;
        let (response_tx, response_rx) = mpsc::channel(1);

        // Store the response channel
        {
            let mut pending = self.pending_requests.lock().await;
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

        self.stdin_tx
            .send(request_str)
            .await
            .map_err(|e| format!("Failed to send request: {}", e))?;

        Ok(response_rx)
    }

    /// Send a notification (no response expected)
    pub async fn send_notification(&self, method: &str, params: Value) -> Result<(), String> {
        let notification = serde_json::json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params
        });

        let notification_str = serde_json::to_string(&notification)
            .map_err(|e| format!("Failed to serialize notification: {}", e))?;

        self.stdin_tx
            .send(notification_str)
            .await
            .map_err(|e| format!("Failed to send notification: {}", e))?;

        Ok(())
    }

    /// Handle incoming LSP messages
    pub async fn handle_message(&self, message: &str) -> Result<(), String> {
        let value: Value = serde_json::from_str(message)
            .map_err(|e| format!("Failed to parse LSP message: {}", e))?;

        if let Some(id) = value.get("id") {
            // This is a response to a request
            if let Some(id_num) = id.as_i64() {
                let mut pending = self.pending_requests.lock().await;
                if let Some(response_tx) = pending.remove(&id_num) {
                    let result = if let Some(error) = value.get("error") {
                        Err(error.to_string())
                    } else if let Some(result) = value.get("result") {
                        Ok(result.clone())
                    } else {
                        Ok(Value::Null)
                    };

                    let _ = response_tx.send(result).await;
                }
            }
        } else if let Some(method) = value.get("method") {
            // This is a notification from the server
            self.handle_notification(method.as_str().unwrap_or(""), &value)
                .await?;
        }

        Ok(())
    }

    /// Handle notifications from the language server
    async fn handle_notification(&self, method: &str, params: &Value) -> Result<(), String> {
        match method {
            "textDocument/publishDiagnostics" => {
                // Handle diagnostics
                println!("Received diagnostics: {}", params);
            }
            "window/logMessage" => {
                // Handle log messages
                if let Some(message) = params.get("message") {
                    println!("LSP Log: {}", message);
                }
            }
            _ => {
                println!("Unhandled LSP notification: {} - {}", method, params);
            }
        }
        Ok(())
    }
}
