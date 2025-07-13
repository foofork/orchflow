use super::{MuxBackend, MuxError, Pane, PaneSize, Session, SplitType};
use async_trait::async_trait;
use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::net::TcpStream;
use tokio::sync::{mpsc, Mutex, RwLock};
use tokio_tungstenite::{connect_async, MaybeTlsStream, WebSocketStream};
use tracing::{debug, error, info, warn};

type WsStream = WebSocketStream<MaybeTlsStream<TcpStream>>;

/// MuxdBackend connects to the muxd daemon
pub struct MuxdBackend {
    url: String,
    sessions: Arc<RwLock<HashMap<String, Session>>>,
    panes: Arc<RwLock<HashMap<String, Pane>>>,
    request_id: AtomicU64,
    pending_requests:
        Arc<Mutex<HashMap<u64, tokio::sync::oneshot::Sender<Result<Value, MuxError>>>>>,
    command_tx: mpsc::UnboundedSender<String>,
    event_tx: mpsc::UnboundedSender<Value>,
}

impl MuxdBackend {
    /// Create a new MuxdBackend
    pub async fn new(url: String) -> Result<Self, MuxError> {
        let (command_tx, mut command_rx) = mpsc::unbounded_channel();
        let (event_tx, mut event_rx) = mpsc::unbounded_channel();
        let pending_requests: Arc<
            Mutex<HashMap<u64, tokio::sync::oneshot::Sender<Result<Value, MuxError>>>>,
        > = Arc::new(Mutex::new(HashMap::new()));

        // Connect to muxd
        let (ws_stream, _) = connect_async(&url)
            .await
            .map_err(|e| MuxError::ConnectionError(format!("Failed to connect to muxd: {}", e)))?;

        let (mut write, mut read) = ws_stream.split();

        // Spawn write task
        let _write_task = tokio::spawn(async move {
            while let Some(msg) = command_rx.recv().await {
                if let Err(e) = write
                    .send(tokio_tungstenite::tungstenite::Message::Text(msg))
                    .await
                {
                    error!("Failed to send message: {}", e);
                    break;
                }
            }
        });

        // Spawn read task
        let event_tx_clone = event_tx.clone();
        let pending_requests_clone = pending_requests.clone();
        let _read_task = tokio::spawn(async move {
            while let Some(msg) = read.next().await {
                match msg {
                    Ok(tokio_tungstenite::tungstenite::Message::Text(text)) => {
                        if let Ok(json) = serde_json::from_str::<Value>(&text) {
                            // Check if it's a response or notification
                            if let Some(id) = json.get("id").and_then(|v| v.as_u64()) {
                                // Response to a request
                                if let Some(tx) = pending_requests_clone.lock().await.remove(&id) {
                                    if let Some(error) = json.get("error") {
                                        let _ = tx.send(Err(MuxError::Other(
                                            error
                                                .get("message")
                                                .and_then(|m| m.as_str())
                                                .unwrap_or("Unknown error")
                                                .to_string(),
                                        )));
                                    } else if let Some(result) = json.get("result") {
                                        let _ = tx.send(Ok(result.clone()));
                                    }
                                }
                            } else {
                                // Notification
                                let _ = event_tx_clone.send(json);
                            }
                        }
                    }
                    Ok(_) => {} // Ignore other message types
                    Err(e) => {
                        error!("WebSocket error: {}", e);
                        break;
                    }
                }
            }
        });

        let backend = Self {
            url,
            sessions: Arc::new(RwLock::new(HashMap::new())),
            panes: Arc::new(RwLock::new(HashMap::new())),
            event_tx,
            request_id: AtomicU64::new(1),
            pending_requests,
            command_tx,
        };

        // Start event handler
        let event_handler = backend.clone();
        tokio::spawn(async move {
            while let Some(event) = event_rx.recv().await {
                event_handler.handle_event(event).await;
            }
        });

        info!("Connected to muxd at {}", backend.url);
        Ok(backend)
    }

    /// Send a JSON-RPC request and wait for response
    async fn request(&self, method: &str, params: Value) -> Result<Value, MuxError> {
        let id = self.request_id.fetch_add(1, Ordering::SeqCst);
        let request = json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params
        });

        let (tx, rx) = tokio::sync::oneshot::channel();
        self.pending_requests.lock().await.insert(id, tx);

        // Send request
        self.command_tx
            .send(request.to_string())
            .map_err(|_| MuxError::ConnectionError("WebSocket channel closed".to_string()))?;

        // Wait for response with timeout
        match tokio::time::timeout(std::time::Duration::from_secs(30), rx).await {
            Ok(Ok(result)) => result,
            Ok(Err(_)) => Err(MuxError::Other("Request cancelled".to_string())),
            Err(_) => {
                self.pending_requests.lock().await.remove(&id);
                Err(MuxError::Other("Request timeout".to_string()))
            }
        }
    }

    /// Handle events from muxd
    async fn handle_event(&self, event: Value) {
        debug!("Received event: {:?}", event);

        match event.get("method").and_then(|m| m.as_str()) {
            Some("pane.output") => {
                if let Some(params) = event.get("params") {
                    let pane_id = params.get("pane_id").and_then(|v| v.as_str());
                    let data = params.get("data").and_then(|v| v.as_str());

                    if let (Some(pane_id), Some(data)) = (pane_id, data) {
                        // TODO: Forward output to UI
                        debug!("Pane {} output: {}", pane_id, data);
                    }
                }
            }
            Some("pane.exit") => {
                if let Some(params) = event.get("params") {
                    let pane_id = params.get("pane_id").and_then(|v| v.as_str());
                    let exit_code = params.get("exit_code").and_then(|v| v.as_i64());

                    if let Some(pane_id) = pane_id {
                        info!("Pane {} exited with code {:?}", pane_id, exit_code);
                        self.panes.write().await.remove(pane_id);
                    }
                }
            }
            _ => {
                debug!("Unhandled event: {:?}", event);
            }
        }
    }
}

// Implement Clone manually due to Arc fields
impl Clone for MuxdBackend {
    fn clone(&self) -> Self {
        Self {
            url: self.url.clone(),
            sessions: self.sessions.clone(),
            panes: self.panes.clone(),
            event_tx: self.event_tx.clone(),
            request_id: AtomicU64::new(self.request_id.load(Ordering::SeqCst)),
            pending_requests: self.pending_requests.clone(),
            command_tx: self.command_tx.clone(),
        }
    }
}

#[async_trait]
impl MuxBackend for MuxdBackend {
    async fn create_session(&self, name: &str) -> Result<String, MuxError> {
        let response = self
            .request(
                "session.create",
                json!({
                    "name": name
                }),
            )
            .await?;

        let session_id = response
            .get("session_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| MuxError::ParseError("Invalid response".to_string()))?
            .to_string();

        let session = Session {
            id: session_id.clone(),
            name: name.to_string(),
            created_at: chrono::Utc::now(),
            window_count: 0,
            attached: false,
        };

        self.sessions
            .write()
            .await
            .insert(session_id.clone(), session);
        Ok(session_id)
    }

    async fn create_pane(&self, session_id: &str, split: SplitType) -> Result<String, MuxError> {
        let params = json!({
            "session_id": session_id,
            "pane_type": "terminal"
        });

        // muxd doesn't support splits directly, it creates standalone panes
        if matches!(split, SplitType::Horizontal | SplitType::Vertical) {
            warn!("muxd doesn't support pane splitting, creating standalone pane");
        }

        let response = self.request("pane.create", params).await?;

        let pane_id = response
            .get("pane_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| MuxError::ParseError("Invalid response".to_string()))?
            .to_string();

        let pane = Pane {
            id: pane_id.clone(),
            session_id: session_id.to_string(),
            index: 0, // muxd doesn't provide index
            title: String::new(),
            active: false,
            size: PaneSize {
                width: 80,
                height: 24,
            },
        };

        self.panes.write().await.insert(pane_id.clone(), pane);
        Ok(pane_id)
    }

    async fn send_keys(&self, pane_id: &str, keys: &str) -> Result<(), MuxError> {
        self.request(
            "pane.write",
            json!({
                "pane_id": pane_id,
                "data": keys
            }),
        )
        .await?;

        Ok(())
    }

    async fn capture_pane(&self, pane_id: &str) -> Result<String, MuxError> {
        let response = self
            .request(
                "pane.read",
                json!({
                    "pane_id": pane_id,
                    "lines": 1000
                }),
            )
            .await?;

        response
            .get("data")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| MuxError::ParseError("Invalid response".to_string()))
    }

    async fn list_sessions(&self) -> Result<Vec<Session>, MuxError> {
        let response = self.request("session.list", json!({})).await?;

        let sessions = response
            .get("sessions")
            .and_then(|v| v.as_array())
            .ok_or_else(|| MuxError::ParseError("Invalid response".to_string()))?;

        let mut result = Vec::new();
        for session_data in sessions {
            if let (Some(id), Some(name)) = (
                session_data.get("session_id").and_then(|v| v.as_str()),
                session_data.get("name").and_then(|v| v.as_str()),
            ) {
                let session = Session {
                    id: id.to_string(),
                    name: name.to_string(),
                    created_at: chrono::Utc::now(), // TODO: Parse from response
                    window_count: session_data
                        .get("pane_count")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0) as usize,
                    attached: false,
                };
                result.push(session);
            }
        }

        // Update cache
        let mut sessions_cache = self.sessions.write().await;
        sessions_cache.clear();
        for session in &result {
            sessions_cache.insert(session.id.clone(), session.clone());
        }

        Ok(result)
    }

    async fn kill_session(&self, session_id: &str) -> Result<(), MuxError> {
        self.request(
            "session.delete",
            json!({
                "session_id": session_id
            }),
        )
        .await?;

        self.sessions.write().await.remove(session_id);
        Ok(())
    }

    async fn kill_pane(&self, pane_id: &str) -> Result<(), MuxError> {
        self.request(
            "pane.kill",
            json!({
                "pane_id": pane_id
            }),
        )
        .await?;

        self.panes.write().await.remove(pane_id);
        Ok(())
    }

    async fn resize_pane(&self, pane_id: &str, size: PaneSize) -> Result<(), MuxError> {
        self.request(
            "pane.resize",
            json!({
                "pane_id": pane_id,
                "size": {
                    "rows": size.height,
                    "cols": size.width
                }
            }),
        )
        .await?;

        if let Some(pane) = self.panes.write().await.get_mut(pane_id) {
            pane.size = size;
        }

        Ok(())
    }

    async fn select_pane(&self, pane_id: &str) -> Result<(), MuxError> {
        // muxd doesn't have a concept of selecting panes
        // We track it locally
        let panes = self.panes.read().await;
        if let Some(pane) = panes.get(pane_id) {
            let session_id = pane.session_id.clone();
            drop(panes);

            let mut panes = self.panes.write().await;
            for (id, pane) in panes.iter_mut() {
                if pane.session_id == session_id {
                    pane.active = id == pane_id;
                }
            }
            Ok(())
        } else {
            Err(MuxError::PaneNotFound(pane_id.to_string()))
        }
    }

    async fn list_panes(&self, session_id: &str) -> Result<Vec<Pane>, MuxError> {
        let response = self
            .request(
                "pane.list",
                json!({
                    "session_id": session_id
                }),
            )
            .await?;

        let panes = response
            .get("panes")
            .and_then(|v| v.as_array())
            .ok_or_else(|| MuxError::ParseError("Invalid response".to_string()))?;

        let mut result = Vec::new();
        for (index, pane_data) in panes.iter().enumerate() {
            if let Some(id) = pane_data.get("pane_id").and_then(|v| v.as_str()) {
                let pane = Pane {
                    id: id.to_string(),
                    session_id: session_id.to_string(),
                    index: index as u32,
                    title: pane_data
                        .get("title")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    active: false,
                    size: PaneSize {
                        width: pane_data.get("cols").and_then(|v| v.as_u64()).unwrap_or(80) as u32,
                        height: pane_data.get("rows").and_then(|v| v.as_u64()).unwrap_or(24) as u32,
                    },
                };
                result.push(pane);
            }
        }

        Ok(result)
    }

    async fn attach_session(&self, session_id: &str) -> Result<(), MuxError> {
        // muxd doesn't have a concept of attaching/detaching
        // We track it locally
        if let Some(session) = self.sessions.write().await.get_mut(session_id) {
            session.attached = true;
            Ok(())
        } else {
            Err(MuxError::SessionNotFound(session_id.to_string()))
        }
    }

    async fn detach_session(&self, session_id: &str) -> Result<(), MuxError> {
        // muxd doesn't have a concept of attaching/detaching
        // We track it locally
        if let Some(session) = self.sessions.write().await.get_mut(session_id) {
            session.attached = false;
            Ok(())
        } else {
            Err(MuxError::SessionNotFound(session_id.to_string()))
        }
    }
}
