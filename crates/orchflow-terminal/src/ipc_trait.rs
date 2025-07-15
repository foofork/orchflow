//! IPC abstraction layer for terminal communication
//!
//! This trait allows OrchFlow to work with any transport mechanism.

use crate::protocol::{ControlMessage, TerminalInput};
use crate::pty_manager::PtyHandle;
use async_trait::async_trait;

/// Trait for IPC communication channels
#[async_trait]
pub trait IpcChannel: Send + Sync {
    /// Start streaming terminal output
    async fn start_streaming(
        &self,
        terminal_id: String,
        pty_handle: PtyHandle,
    ) -> Result<(), Box<dyn std::error::Error>>;

    /// Send input to terminal
    async fn send_input(
        &self,
        terminal_id: &str,
        input: TerminalInput,
    ) -> Result<(), Box<dyn std::error::Error>>;

    /// Send control message
    async fn send_control(
        &self,
        terminal_id: &str,
        message: ControlMessage,
    ) -> Result<(), Box<dyn std::error::Error>>;

    /// Stop streaming
    async fn stop_streaming(&self, terminal_id: &str) -> Result<(), Box<dyn std::error::Error>>;
}

/// Direct in-process channel (no IPC overhead)
pub struct DirectChannel;

#[async_trait]
impl IpcChannel for DirectChannel {
    async fn start_streaming(
        &self,
        _terminal_id: String,
        _pty_handle: PtyHandle,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // In direct mode, the caller handles streaming
        Ok(())
    }

    async fn send_input(
        &self,
        _terminal_id: &str,
        _input: TerminalInput,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // In direct mode, input is handled directly
        Ok(())
    }

    async fn send_control(
        &self,
        _terminal_id: &str,
        _message: ControlMessage,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // In direct mode, control is handled directly
        Ok(())
    }

    async fn stop_streaming(&self, _terminal_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        // In direct mode, nothing to stop
        Ok(())
    }
}
