//! IPC channel abstraction for terminal communication
//!
//! This allows OrchFlow to work with any transport mechanism.

use async_trait::async_trait;
use std::sync::Arc;

use crate::{error::TerminalError, protocol::TerminalOutput, pty::PtyHandle};

/// Trait for terminal I/O channels
/// 
/// Implement this trait to add support for new transport mechanisms
/// (WebSocket, gRPC, Unix sockets, etc.)
#[async_trait]
pub trait IpcChannel: Send + Sync {
    /// Send terminal output to the client
    async fn send_output(&self, terminal_id: String, output: TerminalOutput) -> Result<(), TerminalError>;
    
    /// Start streaming from a PTY handle
    async fn start_streaming(&self, terminal_id: String, pty_handle: PtyHandle) -> Result<(), TerminalError>;
    
    /// Stop streaming for a terminal
    async fn stop_streaming(&self, terminal_id: &str) -> Result<(), TerminalError>;
}

/// Direct in-process channel (no IPC overhead)
pub struct DirectChannel {
    output_handlers: Arc<tokio::sync::RwLock<Vec<Box<dyn Fn(String, TerminalOutput) + Send + Sync>>>>,
}

impl DirectChannel {
    pub fn new() -> Self {
        Self {
            output_handlers: Arc::new(tokio::sync::RwLock::new(Vec::new())),
        }
    }
    
    /// Register a handler for terminal output
    pub async fn on_output<F>(&self, handler: F)
    where
        F: Fn(String, TerminalOutput) + Send + Sync + 'static,
    {
        let mut handlers = self.output_handlers.write().await;
        handlers.push(Box::new(handler));
    }
}

#[async_trait]
impl IpcChannel for DirectChannel {
    async fn send_output(&self, terminal_id: String, output: TerminalOutput) -> Result<(), TerminalError> {
        let handlers = self.output_handlers.read().await;
        for handler in handlers.iter() {
            handler(terminal_id.clone(), output.clone());
        }
        Ok(())
    }
    
    async fn start_streaming(&self, terminal_id: String, mut pty_handle: PtyHandle) -> Result<(), TerminalError> {
        let channel = self.clone();
        
        tokio::spawn(async move {
            let mut buffer = vec![0u8; 4096];
            
            loop {
                match pty_handle.read(&mut buffer).await {
                    Ok(0) => break, // EOF
                    Ok(n) => {
                        let output = TerminalOutput::Data(buffer[..n].to_vec());
                        if let Err(e) = channel.send_output(terminal_id.clone(), output).await {
                            tracing::error!("Failed to send output: {}", e);
                            break;
                        }
                    }
                    Err(e) => {
                        tracing::error!("PTY read error: {}", e);
                        let _ = channel.send_output(
                            terminal_id.clone(), 
                            TerminalOutput::Error(e.to_string())
                        ).await;
                        break;
                    }
                }
            }
            
            // Send exit notification
            let _ = channel.send_output(terminal_id, TerminalOutput::Exit(0)).await;
        });
        
        Ok(())
    }
    
    async fn stop_streaming(&self, _terminal_id: &str) -> Result<(), TerminalError> {
        // Direct channel doesn't need to stop anything
        Ok(())
    }
}

impl Clone for DirectChannel {
    fn clone(&self) -> Self {
        Self {
            output_handlers: Arc::clone(&self.output_handlers),
        }
    }
}