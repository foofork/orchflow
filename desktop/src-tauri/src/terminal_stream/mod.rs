// Terminal Streaming Infrastructure
//
// This module provides real-time terminal I/O streaming capabilities
// for orchflow's multi-terminal orchestration.

pub mod buffer;
pub mod ipc_handler;
pub mod ipc_trait;
pub mod protocol;
pub mod pty_manager;
#[cfg(test)]
mod simple_tests;
pub mod state;

pub use ipc_trait::{IpcChannel, TauriIpcChannel};
pub use protocol::{ControlMessage, TerminalInput, TerminalMetadata};
pub use pty_manager::{PtyHandle, PtyManager};
pub use state::TerminalState;

use std::sync::Arc;
use tokio::sync::RwLock;

/// Main terminal streaming coordinator
pub struct TerminalStreamManager {
    pty_manager: Arc<PtyManager>,
    ipc_channel: Arc<dyn IpcChannel>,
    terminals: Arc<RwLock<std::collections::HashMap<String, TerminalState>>>,
    pty_handles: Arc<RwLock<std::collections::HashMap<String, PtyHandle>>>,
}

impl TerminalStreamManager {
    /// Create a new TerminalStreamManager with a specific IPC channel
    pub fn with_ipc_channel(ipc_channel: Arc<dyn IpcChannel>) -> Self {
        let pty_manager = Arc::new(PtyManager::new());

        Self {
            pty_manager,
            ipc_channel,
            terminals: Arc::new(RwLock::new(std::collections::HashMap::new())),
            pty_handles: Arc::new(RwLock::new(std::collections::HashMap::new())),
        }
    }

    /// Create a new TerminalStreamManager with Tauri IPC (for production)
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        let ipc_channel = Arc::new(TauriIpcChannel::new(app_handle));
        Self::with_ipc_channel(ipc_channel)
    }

    /// Create a new terminal with streaming
    pub async fn create_terminal(
        &self,
        terminal_id: String,
        shell: Option<String>,
        rows: u16,
        cols: u16,
    ) -> Result<PtyHandle, crate::error::OrchflowError> {
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
    ) -> Result<(), crate::error::OrchflowError> {
        self.ipc_channel.send_input(terminal_id, input).await
    }

    /// Resize terminal
    pub async fn resize_terminal(
        &self,
        terminal_id: &str,
        rows: u16,
        cols: u16,
    ) -> Result<(), crate::error::OrchflowError> {
        // Update PTY size using stored handle
        if let Some(pty_handle) = self.pty_handles.read().await.get(terminal_id) {
            pty_handle.resize(rows, cols).await.map_err(|e| {
                crate::error::OrchflowError::TerminalError {
                    operation: "resize_terminal".to_string(),
                    reason: e,
                }
            })?;
        }

        // Update terminal state
        if let Some(terminals) = self.terminals.write().await.get_mut(terminal_id) {
            terminals.resize(rows, cols);
        }

        // Notify clients
        self.ipc_channel
            .send_control(terminal_id, ControlMessage::Resize { rows, cols })
            .await?;

        Ok(())
    }

    /// Get terminal state
    pub async fn get_terminal_state(&self, terminal_id: &str) -> Option<TerminalState> {
        self.terminals.read().await.get(terminal_id).cloned()
    }

    /// Stop terminal streaming
    pub async fn stop_terminal(
        &self,
        terminal_id: &str,
    ) -> Result<(), crate::error::OrchflowError> {
        self.ipc_channel.stop_streaming(terminal_id).await?;

        // Shutdown PTY
        if let Some(pty_handle) = self.pty_handles.write().await.remove(terminal_id) {
            let _ = pty_handle.shutdown().await;
        }

        self.pty_manager.close_pty(terminal_id).await?;
        self.terminals.write().await.remove(terminal_id);
        Ok(())
    }

    /// Get process information for a terminal
    pub async fn get_process_info(
        &self,
        terminal_id: &str,
    ) -> Result<crate::terminal_stream::pty_manager::ProcessInfo, crate::error::OrchflowError> {
        if let Some(pty_handle) = self.pty_handles.read().await.get(terminal_id) {
            pty_handle.get_process_info().await.map_err(|e| {
                crate::error::OrchflowError::TerminalError {
                    operation: "get_process_info".to_string(),
                    reason: e,
                }
            })
        } else {
            Err(crate::error::OrchflowError::TerminalError {
                operation: "get_process_info".to_string(),
                reason: format!("Terminal {} not found", terminal_id),
            })
        }
    }

    /// Get terminal health status
    pub async fn get_terminal_health(
        &self,
        terminal_id: &str,
    ) -> Result<TerminalHealth, crate::error::OrchflowError> {
        let process_info = self.get_process_info(terminal_id).await?;
        let state = self.get_terminal_state(terminal_id).await.ok_or_else(|| {
            crate::error::OrchflowError::TerminalError {
                operation: "get_terminal_health".to_string(),
                reason: format!("Terminal {} state not found", terminal_id),
            }
        })?;

        let health_status = match process_info.status {
            crate::terminal_stream::pty_manager::ProcessStatus::Running => HealthStatus::Healthy,
            crate::terminal_stream::pty_manager::ProcessStatus::Exited(code) => {
                if code == 0 {
                    HealthStatus::Stopped
                } else {
                    HealthStatus::Unhealthy(format!("Exited with code {}", code))
                }
            }
            crate::terminal_stream::pty_manager::ProcessStatus::Crashed => {
                HealthStatus::Unhealthy("Process crashed".to_string())
            }
        };

        Ok(TerminalHealth {
            terminal_id: terminal_id.to_string(),
            status: health_status,
            process_info,
            last_activity: state.last_activity,
            uptime_seconds: (chrono::Utc::now() - state.last_activity).num_seconds() as u64,
        })
    }

    /// Restart a terminal
    pub async fn restart_terminal(
        &self,
        terminal_id: &str,
    ) -> Result<(), crate::error::OrchflowError> {
        // Get current terminal info before stopping
        let terminal_state = self.get_terminal_state(terminal_id).await.ok_or_else(|| {
            crate::error::OrchflowError::TerminalError {
                operation: "restart_terminal".to_string(),
                reason: format!("Terminal {} not found", terminal_id),
            }
        })?;

        // Stop the terminal
        self.stop_terminal(terminal_id).await?;

        // Wait a moment for cleanup
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        // Recreate with same parameters
        self.create_terminal(
            terminal_id.to_string(),
            None, // Use default shell
            terminal_state.rows,
            terminal_state.cols,
        )
        .await?;

        Ok(())
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct TerminalHealth {
    pub terminal_id: String,
    pub status: HealthStatus,
    pub process_info: crate::terminal_stream::pty_manager::ProcessInfo,
    pub last_activity: chrono::DateTime<chrono::Utc>,
    pub uptime_seconds: u64,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(tag = "type", content = "message")]
pub enum HealthStatus {
    Healthy,
    Unhealthy(String),
    Stopped,
}

#[cfg(test)]
mod test_only;
#[cfg(test)]
mod testable_tests;
#[cfg(test)]
mod tests;
