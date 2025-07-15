//! OrchFlow Terminal - Async terminal I/O streaming with PTY management
//!
//! This crate provides the core terminal orchestration functionality for OrchFlow,
//! enabling async terminal spawning, I/O streaming, and process management.

pub mod buffer;
pub mod ipc_trait;
pub mod protocol;
pub mod pty_manager;
pub mod state;

#[cfg(test)]
mod tests;

// Re-export main types
pub use buffer::{ScrollbackBuffer, ScrollbackLine};
pub use ipc_trait::{DirectChannel, IpcChannel};
pub use protocol::{ControlMessage, TerminalInput, TerminalMetadata, TerminalOutput};
pub use pty_manager::{PtyHandle, PtyManager};
pub use state::TerminalState;

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Extension trait for PtyHandle to provide simpler API
#[allow(async_fn_in_trait)]
pub trait PtyHandleExt {
    async fn write(&self, data: &[u8]) -> Result<(), Box<dyn std::error::Error>>;
    async fn kill(&self) -> Result<(), Box<dyn std::error::Error>>;
}

impl PtyHandleExt for PtyHandle {
    async fn write(&self, data: &[u8]) -> Result<(), Box<dyn std::error::Error>> {
        self.send_input(bytes::Bytes::from(data.to_vec()))
            .await
            .map_err(|e| e.into())
    }

    async fn kill(&self) -> Result<(), Box<dyn std::error::Error>> {
        self.shutdown().await.map_err(|e| e.into())
    }
}

/// Main terminal streaming coordinator
pub struct TerminalStreamManager {
    pty_manager: Arc<PtyManager>,
    ipc_channel: Arc<dyn IpcChannel>,
    terminals: Arc<RwLock<HashMap<String, TerminalState>>>,
    pty_handles: Arc<RwLock<HashMap<String, PtyHandle>>>,
    scrollback_buffers: Arc<RwLock<HashMap<String, ScrollbackBuffer>>>,
}

impl TerminalStreamManager {
    /// Create a new TerminalStreamManager with a specific IPC channel
    pub fn with_ipc_channel(ipc_channel: Arc<dyn IpcChannel>) -> Self {
        let pty_manager = Arc::new(PtyManager::new());

        Self {
            pty_manager,
            ipc_channel,
            terminals: Arc::new(RwLock::new(HashMap::new())),
            pty_handles: Arc::new(RwLock::new(HashMap::new())),
            scrollback_buffers: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Create a new terminal with streaming
    pub async fn create_terminal(
        &self,
        terminal_id: String,
        shell: Option<String>,
        rows: u16,
        cols: u16,
    ) -> Result<PtyHandle, Box<dyn std::error::Error>> {
        // Create PTY
        let pty_handle = self
            .pty_manager
            .create_pty(terminal_id.clone(), shell, rows, cols)
            .await?;

        // Initialize terminal state
        let terminal_state = TerminalState::new(terminal_id.clone(), rows, cols);
        self.terminals
            .write()
            .await
            .insert(terminal_id.clone(), terminal_state);

        // Store PTY handle
        self.pty_handles
            .write()
            .await
            .insert(terminal_id.clone(), pty_handle.clone());

        // Create scrollback buffer for this terminal
        let scrollback_buffer = ScrollbackBuffer::with_default_size();
        self.scrollback_buffers
            .write()
            .await
            .insert(terminal_id.clone(), scrollback_buffer);

        // Start streaming
        self.ipc_channel
            .start_streaming(terminal_id, pty_handle.clone())
            .await?;

        Ok(pty_handle)
    }

    /// Send input to terminal
    pub async fn send_input(
        &self,
        terminal_id: &str,
        input: TerminalInput,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let handles = self.pty_handles.read().await;
        let pty_handle = handles
            .get(terminal_id)
            .ok_or_else(|| format!("Terminal {terminal_id} not found"))?;

        match input {
            TerminalInput::Text(text) => {
                pty_handle.write(text.as_bytes()).await?;
            }
            TerminalInput::Binary(data) => {
                pty_handle.write(&data).await?;
            }
            TerminalInput::SpecialKey(key) => {
                // Handle special keys like arrows, etc.
                // For now, just send as text
                pty_handle.write(key.as_bytes()).await?;
            }
        }

        Ok(())
    }

    /// Send control message to terminal
    pub async fn send_control(
        &self,
        terminal_id: &str,
        control: ControlMessage,
    ) -> Result<(), Box<dyn std::error::Error>> {
        match control {
            ControlMessage::Resize { rows, cols } => {
                let handles = self.pty_handles.read().await;
                if let Some(pty_handle) = handles.get(terminal_id) {
                    pty_handle.resize(rows, cols).await?;

                    // Update terminal state
                    let mut terminals = self.terminals.write().await;
                    if let Some(state) = terminals.get_mut(terminal_id) {
                        state.resize(rows, cols);
                    }
                }
            }
            _ => {
                // Handle other control messages
            }
        }

        Ok(())
    }

    /// Kill a terminal
    pub async fn kill_terminal(&self, terminal_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        // Stop streaming first
        self.ipc_channel.stop_streaming(terminal_id).await?;

        // Kill the PTY
        if let Some(handle) = self.pty_handles.write().await.remove(terminal_id) {
            handle.kill().await?;
        }

        // Clean up state
        self.terminals.write().await.remove(terminal_id);
        self.scrollback_buffers.write().await.remove(terminal_id);

        Ok(())
    }

    /// List all active terminals
    pub async fn list_terminals(&self) -> Vec<String> {
        self.terminals.read().await.keys().cloned().collect()
    }
}
