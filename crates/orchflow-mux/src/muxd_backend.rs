//! Muxd backend implementation - a modern terminal multiplexer daemon

use crate::backend::{MuxBackend, MuxError, Pane, PaneSize, Session, SplitType};
use async_trait::async_trait;
use chrono::Utc;
use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio_tungstenite::connect_async;
use tracing::{debug, info};

/// MuxdBackend connects to the muxd daemon via WebSocket
pub struct MuxdBackend {
    url: String,
    sessions: Arc<RwLock<HashMap<String, Session>>>,
    panes: Arc<RwLock<HashMap<String, Pane>>>,
}

impl MuxdBackend {
    pub fn new(url: String) -> Self {
        Self {
            url,
            sessions: Arc::new(RwLock::new(HashMap::new())),
            panes: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Connect to muxd and send a command
    async fn send_command(&self, command: Value) -> Result<Value, MuxError> {
        let (mut ws, _) = connect_async(&self.url)
            .await
            .map_err(|e| MuxError::ConnectionError(format!("Failed to connect to muxd: {e}")))?;

        // Send command
        ws.send(tokio_tungstenite::tungstenite::Message::Text(
            command.to_string().into(),
        ))
        .await
        .map_err(|e| MuxError::ConnectionError(format!("Failed to send command: {e}")))?;

        // Wait for response
        if let Some(Ok(msg)) = ws.next().await {
            match msg {
                tokio_tungstenite::tungstenite::Message::Text(text) => serde_json::from_str(&text)
                    .map_err(|e| MuxError::ParseError(format!("Invalid response: {e}"))),
                _ => Err(MuxError::ParseError("Expected text response".to_string())),
            }
        } else {
            Err(MuxError::ConnectionError(
                "No response from muxd".to_string(),
            ))
        }
    }
}

#[async_trait]
impl MuxBackend for MuxdBackend {
    async fn create_session(&self, name: &str) -> Result<String, MuxError> {
        info!("Creating muxd session: {}", name);

        let command = json!({
            "type": "create_session",
            "name": name
        });

        let response = self.send_command(command).await?;

        if let Some(session_id) = response.get("session_id").and_then(|v| v.as_str()) {
            let session = Session {
                id: session_id.to_string(),
                name: name.to_string(),
                created_at: Utc::now(),
                window_count: 1,
                attached: false,
            };

            self.sessions
                .write()
                .await
                .insert(session_id.to_string(), session);
            Ok(session_id.to_string())
        } else {
            Err(MuxError::ParseError(
                "Invalid create_session response".to_string(),
            ))
        }
    }

    async fn create_pane(&self, session_id: &str, split: SplitType) -> Result<String, MuxError> {
        debug!(
            "Creating pane in muxd session: {} with split: {:?}",
            session_id, split
        );

        let command = json!({
            "type": "create_pane",
            "session_id": session_id,
            "split": match split {
                SplitType::Horizontal => "horizontal",
                SplitType::Vertical => "vertical",
                SplitType::None => "none",
            }
        });

        let response = self.send_command(command).await?;

        if let Some(pane_id) = response.get("pane_id").and_then(|v| v.as_str()) {
            let pane = Pane {
                id: pane_id.to_string(),
                session_id: session_id.to_string(),
                index: 0,
                title: String::new(),
                active: true,
                size: PaneSize {
                    width: 80,
                    height: 24,
                },
            };

            self.panes.write().await.insert(pane_id.to_string(), pane);
            Ok(pane_id.to_string())
        } else {
            Err(MuxError::ParseError(
                "Invalid create_pane response".to_string(),
            ))
        }
    }

    async fn send_keys(&self, pane_id: &str, keys: &str) -> Result<(), MuxError> {
        debug!("Sending keys to muxd pane {}: {}", pane_id, keys);

        let command = json!({
            "type": "send_keys",
            "pane_id": pane_id,
            "keys": keys
        });

        self.send_command(command).await?;
        Ok(())
    }

    async fn capture_pane(&self, pane_id: &str) -> Result<String, MuxError> {
        debug!("Capturing muxd pane: {}", pane_id);

        let command = json!({
            "type": "capture_pane",
            "pane_id": pane_id
        });

        let response = self.send_command(command).await?;

        response
            .get("content")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| MuxError::ParseError("Invalid capture_pane response".to_string()))
    }

    async fn list_sessions(&self) -> Result<Vec<Session>, MuxError> {
        debug!("Listing muxd sessions");

        let command = json!({
            "type": "list_sessions"
        });

        let response = self.send_command(command).await?;

        if let Some(sessions_data) = response.get("sessions").and_then(|v| v.as_array()) {
            let sessions = sessions_data
                .iter()
                .filter_map(|v| {
                    let id = v.get("id")?.as_str()?;
                    let name = v.get("name")?.as_str()?;
                    Some(Session {
                        id: id.to_string(),
                        name: name.to_string(),
                        created_at: Utc::now(),
                        window_count: v.get("window_count").and_then(|v| v.as_u64()).unwrap_or(0)
                            as usize,
                        attached: v.get("attached").and_then(|v| v.as_bool()).unwrap_or(false),
                    })
                })
                .collect();
            Ok(sessions)
        } else {
            Err(MuxError::ParseError(
                "Invalid list_sessions response".to_string(),
            ))
        }
    }

    async fn kill_session(&self, session_id: &str) -> Result<(), MuxError> {
        info!("Killing muxd session: {}", session_id);

        let command = json!({
            "type": "kill_session",
            "session_id": session_id
        });

        self.send_command(command).await?;
        self.sessions.write().await.remove(session_id);
        Ok(())
    }

    async fn kill_pane(&self, pane_id: &str) -> Result<(), MuxError> {
        debug!("Killing muxd pane: {}", pane_id);

        let command = json!({
            "type": "kill_pane",
            "pane_id": pane_id
        });

        self.send_command(command).await?;
        self.panes.write().await.remove(pane_id);
        Ok(())
    }

    async fn resize_pane(&self, pane_id: &str, size: PaneSize) -> Result<(), MuxError> {
        debug!(
            "Resizing muxd pane {} to {}x{}",
            pane_id, size.width, size.height
        );

        let command = json!({
            "type": "resize_pane",
            "pane_id": pane_id,
            "width": size.width,
            "height": size.height
        });

        self.send_command(command).await?;

        if let Some(pane) = self.panes.write().await.get_mut(pane_id) {
            pane.size = size;
        }

        Ok(())
    }

    async fn select_pane(&self, pane_id: &str) -> Result<(), MuxError> {
        debug!("Selecting muxd pane: {}", pane_id);

        let command = json!({
            "type": "select_pane",
            "pane_id": pane_id
        });

        self.send_command(command).await?;
        Ok(())
    }

    async fn list_panes(&self, session_id: &str) -> Result<Vec<Pane>, MuxError> {
        debug!("Listing panes for muxd session: {}", session_id);

        let command = json!({
            "type": "list_panes",
            "session_id": session_id
        });

        let response = self.send_command(command).await?;

        if let Some(panes_data) = response.get("panes").and_then(|v| v.as_array()) {
            let panes = panes_data
                .iter()
                .filter_map(|v| {
                    let id = v.get("id")?.as_str()?;
                    let index = v.get("index")?.as_u64()? as u32;
                    Some(Pane {
                        id: id.to_string(),
                        session_id: session_id.to_string(),
                        index,
                        title: v
                            .get("title")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string(),
                        active: v.get("active").and_then(|v| v.as_bool()).unwrap_or(false),
                        size: PaneSize {
                            width: v.get("width").and_then(|v| v.as_u64()).unwrap_or(80) as u32,
                            height: v.get("height").and_then(|v| v.as_u64()).unwrap_or(24) as u32,
                        },
                    })
                })
                .collect();
            Ok(panes)
        } else {
            Err(MuxError::ParseError(
                "Invalid list_panes response".to_string(),
            ))
        }
    }

    async fn attach_session(&self, session_id: &str) -> Result<(), MuxError> {
        info!("Attaching to muxd session: {}", session_id);

        let command = json!({
            "type": "attach_session",
            "session_id": session_id
        });

        self.send_command(command).await?;

        if let Some(session) = self.sessions.write().await.get_mut(session_id) {
            session.attached = true;
        }

        Ok(())
    }

    async fn detach_session(&self, session_id: &str) -> Result<(), MuxError> {
        info!("Detaching from muxd session: {}", session_id);

        let command = json!({
            "type": "detach_session",
            "session_id": session_id
        });

        self.send_command(command).await?;

        if let Some(session) = self.sessions.write().await.get_mut(session_id) {
            session.attached = false;
        }

        Ok(())
    }
}
