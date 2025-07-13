// IPC abstraction layer for testability
//
// This trait allows us to abstract away the Tauri-specific IPC implementation
// and provide mock implementations for testing.

use super::ipc_handler::TerminalEvent;
use super::protocol::{ControlMessage, TerminalInput};
use super::pty_manager::PtyHandle;
use async_trait::async_trait;

/// Trait for IPC communication
#[async_trait]
pub trait IpcChannel: Send + Sync {
    /// Start streaming terminal output
    async fn start_streaming(
        &self,
        terminal_id: String,
        pty_handle: PtyHandle,
    ) -> Result<(), crate::error::OrchflowError>;

    /// Send input to terminal
    async fn send_input(
        &self,
        terminal_id: &str,
        input: TerminalInput,
    ) -> Result<(), crate::error::OrchflowError>;

    /// Send control message
    async fn send_control(
        &self,
        terminal_id: &str,
        message: ControlMessage,
    ) -> Result<(), crate::error::OrchflowError>;

    /// Stop streaming
    async fn stop_streaming(&self, terminal_id: &str) -> Result<(), crate::error::OrchflowError>;

    /// Emit event (for testing)
    async fn emit_event(&self, event: TerminalEvent) -> Result<(), crate::error::OrchflowError>;
}

/// Tauri IPC implementation wrapper
pub struct TauriIpcChannel {
    inner: std::sync::Arc<super::ipc_handler::IpcHandler>,
}

impl TauriIpcChannel {
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        Self {
            inner: std::sync::Arc::new(super::ipc_handler::IpcHandler::new(app_handle)),
        }
    }
}

#[async_trait]
impl IpcChannel for TauriIpcChannel {
    async fn start_streaming(
        &self,
        terminal_id: String,
        pty_handle: PtyHandle,
    ) -> Result<(), crate::error::OrchflowError> {
        self.inner.start_streaming(terminal_id, pty_handle).await
    }

    async fn send_input(
        &self,
        terminal_id: &str,
        input: TerminalInput,
    ) -> Result<(), crate::error::OrchflowError> {
        self.inner.send_input(terminal_id, input).await
    }

    async fn send_control(
        &self,
        terminal_id: &str,
        message: ControlMessage,
    ) -> Result<(), crate::error::OrchflowError> {
        self.inner.send_control(terminal_id, message).await
    }

    async fn stop_streaming(&self, terminal_id: &str) -> Result<(), crate::error::OrchflowError> {
        self.inner.stop_streaming(terminal_id).await
    }

    async fn emit_event(&self, _event: TerminalEvent) -> Result<(), crate::error::OrchflowError> {
        // Not directly exposed by IpcHandler, but we don't need it for real usage
        Ok(())
    }
}

#[cfg(test)]
pub mod mock {
    use super::*;
    use std::collections::HashMap;
    use tokio::sync::{mpsc, Mutex};

    /// Mock IPC channel for testing
    pub struct MockIpcChannel {
        pub events: std::sync::Arc<Mutex<Vec<TerminalEvent>>>,
        pub active_streams: std::sync::Arc<Mutex<HashMap<String, PtyHandle>>>,
        pub stop_tx: mpsc::Sender<String>,
        pub stop_rx: std::sync::Arc<Mutex<mpsc::Receiver<String>>>,
    }

    impl MockIpcChannel {
        pub fn new() -> Self {
            let (stop_tx, stop_rx) = mpsc::channel(10);
            Self {
                events: std::sync::Arc::new(Mutex::new(Vec::new())),
                active_streams: std::sync::Arc::new(Mutex::new(HashMap::new())),
                stop_tx,
                stop_rx: std::sync::Arc::new(Mutex::new(stop_rx)),
            }
        }

        pub async fn get_events(&self) -> Vec<TerminalEvent> {
            self.events.lock().await.clone()
        }

        pub async fn clear_events(&self) {
            self.events.lock().await.clear();
        }
    }

    #[async_trait]
    impl IpcChannel for MockIpcChannel {
        async fn start_streaming(
            &self,
            terminal_id: String,
            pty_handle: PtyHandle,
        ) -> Result<(), crate::error::OrchflowError> {
            self.active_streams
                .lock()
                .await
                .insert(terminal_id, pty_handle);
            Ok(())
        }

        async fn send_input(
            &self,
            terminal_id: &str,
            input: TerminalInput,
        ) -> Result<(), crate::error::OrchflowError> {
            // In tests, we can verify inputs were sent by checking the PTY handle
            if let Some(handle) = self.active_streams.lock().await.get(terminal_id) {
                let data = match input {
                    TerminalInput::Text(text) => bytes::Bytes::from(text),
                    TerminalInput::Binary(data) => bytes::Bytes::from(data),
                    TerminalInput::SpecialKey(key) => {
                        let sequence = match key.as_str() {
                            "enter" => "\r",
                            "tab" => "\t",
                            "escape" => "\x1b",
                            "backspace" => "\x7f",
                            _ => "",
                        };
                        bytes::Bytes::from(sequence.to_string())
                    }
                };
                handle.send_input(data).await.map_err(|e| {
                    crate::error::OrchflowError::TerminalError {
                        operation: "send_input".to_string(),
                        reason: e,
                    }
                })?;
            }
            Ok(())
        }

        async fn send_control(
            &self,
            _terminal_id: &str,
            _message: ControlMessage,
        ) -> Result<(), crate::error::OrchflowError> {
            // Mock implementation - just record the control message
            Ok(())
        }

        async fn stop_streaming(
            &self,
            terminal_id: &str,
        ) -> Result<(), crate::error::OrchflowError> {
            self.active_streams.lock().await.remove(terminal_id);
            let _ = self.stop_tx.send(terminal_id.to_string()).await;
            Ok(())
        }

        async fn emit_event(
            &self,
            event: TerminalEvent,
        ) -> Result<(), crate::error::OrchflowError> {
            self.events.lock().await.push(event);
            Ok(())
        }
    }
}
