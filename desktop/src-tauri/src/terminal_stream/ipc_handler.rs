// IPC Handler for Terminal Streaming
//
// Uses Tauri's event system for efficient desktop IPC communication
// between the Rust backend and frontend for terminal I/O.

use bytes::Bytes;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::{mpsc, RwLock};

use super::protocol::{ControlMessage, TerminalInput};
use super::pty_manager::PtyHandle;

/// Events emitted to frontend
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "data")]
pub enum TerminalEvent {
    Output {
        terminal_id: String,
        data: String, // Base64 encoded for binary safety
    },
    Exit {
        terminal_id: String,
        code: Option<i32>,
    },
    Error {
        terminal_id: String,
        error: String,
    },
    StateChanged {
        terminal_id: String,
        state: TerminalStateInfo,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalStateInfo {
    pub rows: u16,
    pub cols: u16,
    pub cursor_x: u16,
    pub cursor_y: u16,
    pub mode: String,
    pub active: bool,
}

/// IPC event names
pub const TERMINAL_OUTPUT_EVENT: &str = "terminal:output";
pub const TERMINAL_EXIT_EVENT: &str = "terminal:exit";
pub const TERMINAL_ERROR_EVENT: &str = "terminal:error";
pub const TERMINAL_STATE_EVENT: &str = "terminal:state";

pub struct IpcHandler {
    app_handle: AppHandle,
    active_streams: Arc<RwLock<HashMap<String, StreamHandle>>>,
}

struct StreamHandle {
    pty_handle: super::pty_manager::PtyHandle,
    cancel_tx: mpsc::Sender<()>,
}

impl IpcHandler {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            active_streams: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Start streaming terminal output to frontend via IPC
    pub async fn start_streaming(
        &self,
        terminal_id: String,
        pty_handle: PtyHandle,
    ) -> Result<(), crate::error::OrchflowError> {
        let (cancel_tx, mut cancel_rx) = mpsc::channel::<()>(1);

        // Clone for move into task
        let app_handle = self.app_handle.clone();
        let terminal_id_clone = terminal_id.clone();
        let mut output_rx = pty_handle.output_tx.subscribe();

        // Spawn output streaming task
        tokio::spawn(async move {
            loop {
                tokio::select! {
                    // Handle output from PTY
                    output = output_rx.recv() => {
                        match output {
                            Ok(data) => {
                                // Convert bytes to base64 for safe transmission
                                let encoded = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &data);

                                let event = TerminalEvent::Output {
                                    terminal_id: terminal_id_clone.clone(),
                                    data: encoded,
                                };

                                // Emit to all windows
                                let _ = app_handle.emit(TERMINAL_OUTPUT_EVENT, &event);
                            }
                            Err(_) => break, // Channel closed
                        }
                    }

                    // Handle cancellation
                    _ = cancel_rx.recv() => {
                        break;
                    }
                }
            }

            // Emit exit event
            let _ = app_handle.emit(
                TERMINAL_EXIT_EVENT,
                &TerminalEvent::Exit {
                    terminal_id: terminal_id_clone,
                    code: None,
                },
            );
        });

        // Store stream handle
        let handle = StreamHandle {
            pty_handle: pty_handle.clone(),
            cancel_tx,
        };

        self.active_streams
            .write()
            .await
            .insert(terminal_id, handle);

        Ok(())
    }

    /// Send input from frontend to terminal
    pub async fn send_input(
        &self,
        terminal_id: &str,
        input: TerminalInput,
    ) -> Result<(), crate::error::OrchflowError> {
        let streams = self.active_streams.read().await;

        if let Some(handle) = streams.get(terminal_id) {
            let data = match input {
                TerminalInput::Text(text) => Bytes::from(text),
                TerminalInput::Binary(data) => Bytes::from(data),
                TerminalInput::SpecialKey(key) => {
                    // Convert special keys to escape sequences
                    let sequence = match key.as_str() {
                        "enter" => "\r",
                        "tab" => "\t",
                        "backspace" => "\x7f",
                        "escape" => "\x1b",
                        "up" => "\x1b[A",
                        "down" => "\x1b[B",
                        "right" => "\x1b[C",
                        "left" => "\x1b[D",
                        "home" => "\x1b[H",
                        "end" => "\x1b[F",
                        "pageup" => "\x1b[5~",
                        "pagedown" => "\x1b[6~",
                        "delete" => "\x1b[3~",
                        "insert" => "\x1b[2~",
                        _ => {
                            return Err(crate::error::OrchflowError::TerminalError {
                                operation: "send_input".to_string(),
                                reason: format!("Unknown special key: {}", key),
                            })
                        }
                    };
                    Bytes::from(sequence.to_string())
                }
            };

            handle.pty_handle.send_input(data).await.map_err(|e| {
                crate::error::OrchflowError::TerminalError {
                    operation: "send_input".to_string(),
                    reason: e,
                }
            })?;
        } else {
            return Err(crate::error::OrchflowError::TerminalError {
                operation: "send_input".to_string(),
                reason: format!("Terminal {} not found", terminal_id),
            });
        }

        Ok(())
    }

    /// Send control message to frontend
    pub async fn send_control(
        &self,
        terminal_id: &str,
        control: ControlMessage,
    ) -> Result<(), crate::error::OrchflowError> {
        match control {
            ControlMessage::Resize { rows, cols } => {
                // Emit resize event to frontend
                self.app_handle
                    .emit(
                        TERMINAL_STATE_EVENT,
                        &TerminalEvent::StateChanged {
                            terminal_id: terminal_id.to_string(),
                            state: TerminalStateInfo {
                                rows,
                                cols,
                                cursor_x: 0,
                                cursor_y: 0,
                                mode: "normal".to_string(),
                                active: true,
                            },
                        },
                    )
                    .map_err(|e| crate::error::OrchflowError::TerminalError {
                        operation: "send_control".to_string(),
                        reason: e.to_string(),
                    })?;
            }
            ControlMessage::ModeChange { mode } => {
                // Emit mode change event
                self.app_handle
                    .emit(
                        TERMINAL_STATE_EVENT,
                        &TerminalEvent::StateChanged {
                            terminal_id: terminal_id.to_string(),
                            state: TerminalStateInfo {
                                rows: 24, // Will be updated by frontend
                                cols: 80,
                                cursor_x: 0,
                                cursor_y: 0,
                                mode,
                                active: true,
                            },
                        },
                    )
                    .map_err(|e| crate::error::OrchflowError::TerminalError {
                        operation: "send_control".to_string(),
                        reason: e.to_string(),
                    })?;
            }
            ControlMessage::Focus => {
                // Handle focus event
            }
            ControlMessage::Blur => {
                // Handle blur event
            }
        }

        Ok(())
    }

    /// Stop streaming for a terminal
    pub async fn stop_streaming(
        &self,
        terminal_id: &str,
    ) -> Result<(), crate::error::OrchflowError> {
        if let Some(handle) = self.active_streams.write().await.remove(terminal_id) {
            // Send cancellation signal
            let _ = handle.cancel_tx.send(()).await;
        }

        Ok(())
    }

    /// Send error to frontend
    pub async fn send_error(
        &self,
        terminal_id: &str,
        error: String,
    ) -> Result<(), crate::error::OrchflowError> {
        self.app_handle
            .emit(
                TERMINAL_ERROR_EVENT,
                &TerminalEvent::Error {
                    terminal_id: terminal_id.to_string(),
                    error,
                },
            )
            .map_err(|e| crate::error::OrchflowError::TerminalError {
                operation: "send_error".to_string(),
                reason: e.to_string(),
            })?;

        Ok(())
    }
}
