use crate::error::{MuxdError, Result};
use crate::protocol::{
    request::*, response::*, notification::*, 
    PaneId, SessionId, PaneType,
};
use crate::session::SessionManager;
use axum::extract::ws::Message;
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{debug, error};

/// Request handler for JSON-RPC messages
pub struct RequestHandler {
    session_manager: Arc<SessionManager>,
    output_tx: mpsc::UnboundedSender<Message>,
}

impl RequestHandler {
    /// Create a new request handler
    pub fn new(
        session_manager: Arc<SessionManager>,
        output_tx: mpsc::UnboundedSender<Message>,
    ) -> Self {
        Self {
            session_manager,
            output_tx,
        }
    }
    
    /// Handle a JSON-RPC message
    pub async fn handle_message(&self, msg: Value) -> Result<()> {
        // Check if it's a valid JSON-RPC 2.0 request
        if msg.get("jsonrpc") != Some(&json!("2.0")) {
            return self.send_error(None, -32600, "Invalid Request").await;
        }
        
        let id = msg.get("id").cloned();
        let method = msg
            .get("method")
            .and_then(|m| m.as_str())
            .ok_or_else(|| MuxdError::InvalidRequest {
                reason: "Missing method".to_string(),
            })?;
        
        let params = msg.get("params").cloned().unwrap_or(json!({}));
        
        debug!("Handling method: {}", method);
        
        // Route to appropriate handler
        let result = match method {
            "session.create" => self.handle_create_session(params).await,
            "session.list" => self.handle_list_sessions(params).await,
            "session.delete" => self.handle_delete_session(params).await,
            "pane.create" => self.handle_create_pane(params).await,
            "pane.write" => self.handle_write_pane(params).await,
            "pane.resize" => self.handle_resize_pane(params).await,
            "pane.read" => self.handle_read_pane(params).await,
            "pane.kill" => self.handle_kill_pane(params).await,
            "pane.info" => self.handle_get_pane_info(params).await,
            "pane.list" => self.handle_list_panes(params).await,
            "pane.update_title" => self.handle_update_pane_title(params).await,
            "pane.update_working_dir" => self.handle_update_pane_working_dir(params).await,
            "pane.search" => self.handle_search_pane(params).await,
            "state.save" => self.handle_save_state(params).await,
            "state.restore" => self.handle_restore_state(params).await,
            "server_status" => self.handle_server_status(params).await,
            "server_shutdown" => self.handle_server_shutdown(params).await,
            _ => {
                return self.send_error(id, -32601, "Method not found").await;
            }
        };
        
        // Send response
        match result {
            Ok(response) => self.send_result(id, response).await,
            Err(e) => {
                error!("Error handling {}: {}", method, e);
                self.send_error(id, e.error_code(), &e.to_string()).await
            }
        }
    }
    
    /// Send a successful result
    async fn send_result(&self, id: Option<Value>, result: Value) -> Result<()> {
        if let Some(id) = id {
            let response = json!({
                "jsonrpc": "2.0",
                "result": result,
                "id": id
            });
            
            self.output_tx
                .send(Message::Text(response.to_string()))
                .map_err(|_| MuxdError::ChannelClosed)?;
        }
        Ok(())
    }
    
    /// Send an error response
    async fn send_error(&self, id: Option<Value>, code: i32, message: &str) -> Result<()> {
        let response = json!({
            "jsonrpc": "2.0",
            "error": {
                "code": code,
                "message": message
            },
            "id": id
        });
        
        self.output_tx
            .send(Message::Text(response.to_string()))
            .map_err(|_| MuxdError::ChannelClosed)?;
        
        Ok(())
    }
    
    /// Send a notification
    pub async fn send_notification(&self, notification: NotificationType) -> Result<()> {
        let msg = json!({
            "jsonrpc": "2.0",
            "method": notification.method(),
            "params": notification
        });
        
        self.output_tx
            .send(Message::Text(msg.to_string()))
            .map_err(|_| MuxdError::ChannelClosed)?;
        
        Ok(())
    }
    
    // Handler implementations
    
    async fn handle_create_session(&self, params: Value) -> Result<Value> {
        let req: CreateSessionRequest = serde_json::from_value(params)?;
        let session_id = self.session_manager.create_session(req.name.clone())?;
        
        Ok(json!(CreateSessionResponse {
            session_id: session_id.to_string(),
            name: req.name,
            created_at: chrono::Utc::now(),
        }))
    }
    
    async fn handle_list_sessions(&self, _params: Value) -> Result<Value> {
        let sessions = self
            .session_manager
            .list_sessions()
            .into_iter()
            .map(|(id, name, pane_count, created_at, updated_at)| SessionInfo {
                session_id: id.to_string(),
                name,
                pane_count,
                created_at,
                updated_at,
            })
            .collect();
        
        Ok(json!(ListSessionsResponse { sessions }))
    }
    
    async fn handle_delete_session(&self, params: Value) -> Result<Value> {
        let req: DeleteSessionRequest = serde_json::from_value(params)?;
        let session_id = SessionId(req.session_id);
        
        self.session_manager.delete_session(&session_id)?;
        
        Ok(json!(SuccessResponse::default()))
    }
    
    async fn handle_create_pane(&self, params: Value) -> Result<Value> {
        let req: CreatePaneRequest = serde_json::from_value(params)?;
        let session_id = SessionId(req.session_id.clone());
        
        // Create output channel for this pane
        let (pane_tx, mut pane_rx) = mpsc::unbounded_channel();
        
        // Create pane
        let pane_type = match req.pane_type.as_str() {
            "terminal" => PaneType::Terminal,
            other => PaneType::Custom(other.to_string()),
        };
        
        let pane = self
            .session_manager
            .create_pane(&session_id, pane_type, pane_tx)?;
        
        // Start the pane
        let pid = pane
            .start(req.command, req.working_dir, req.env, req.size)
            .await?;
        
        // Forward pane output to client
        let output_tx = self.output_tx.clone();
        let pane_id = pane.id.clone();
        tokio::spawn(async move {
            while let Some(data) = pane_rx.recv().await {
                let notification = NotificationType::PaneOutput(PaneOutputNotification {
                    pane_id: pane_id.to_string(),
                    data: String::from_utf8_lossy(&data).to_string(),
                    timestamp: chrono::Utc::now(),
                });
                
                let msg = json!({
                    "jsonrpc": "2.0",
                    "method": notification.method(),
                    "params": notification
                });
                
                let _ = output_tx.send(Message::Text(msg.to_string()));
            }
        });
        
        Ok(json!(CreatePaneResponse {
            pane_id: pane.id.to_string(),
            session_id: req.session_id,
            pane_type: req.pane_type,
            pid: Some(pid),
        }))
    }
    
    async fn handle_write_pane(&self, params: Value) -> Result<Value> {
        let req: WritePaneRequest = serde_json::from_value(params)?;
        let pane_id = PaneId(req.pane_id);
        
        // Find pane across all sessions
        let (_session_id, pane) = self
            .session_manager
            .find_pane(&pane_id)
            .ok_or_else(|| MuxdError::PaneNotFound {
                pane_id: pane_id.to_string(),
            })?;
        
        pane.write(req.data.as_bytes())?;
        
        Ok(json!(SuccessResponse::default()))
    }
    
    async fn handle_resize_pane(&self, params: Value) -> Result<Value> {
        let req: ResizePaneRequest = serde_json::from_value(params)?;
        let pane_id = PaneId(req.pane_id);
        
        // Find pane across all sessions
        let (_session_id, pane) = self
            .session_manager
            .find_pane(&pane_id)
            .ok_or_else(|| MuxdError::PaneNotFound {
                pane_id: pane_id.to_string(),
            })?;
        
        pane.resize(req.size.rows, req.size.cols)?;
        
        // Send resize notification
        self.send_notification(NotificationType::PaneResized(PaneResizedNotification {
            pane_id: pane_id.to_string(),
            rows: req.size.rows,
            cols: req.size.cols,
            timestamp: chrono::Utc::now(),
        }))
        .await?;
        
        Ok(json!(SuccessResponse::default()))
    }
    
    async fn handle_read_pane(&self, params: Value) -> Result<Value> {
        let req: ReadPaneRequest = serde_json::from_value(params)?;
        let pane_id = PaneId(req.pane_id);
        
        // Find pane across all sessions
        let (_session_id, pane) = self
            .session_manager
            .find_pane(&pane_id)
            .ok_or_else(|| MuxdError::PaneNotFound {
                pane_id: pane_id.to_string(),
            })?;
        
        let data = pane.read_output(req.lines);
        
        Ok(json!(ReadPaneResponse {
            data,
            cursor: None, // TODO: Implement cursor tracking
        }))
    }
    
    async fn handle_kill_pane(&self, params: Value) -> Result<Value> {
        let req: KillPaneRequest = serde_json::from_value(params)?;
        let pane_id = PaneId(req.pane_id);
        
        // Find pane across all sessions
        let (session_id, _pane) = self
            .session_manager
            .find_pane(&pane_id)
            .ok_or_else(|| MuxdError::PaneNotFound {
                pane_id: pane_id.to_string(),
            })?;
        
        self.session_manager.kill_pane(&session_id, &pane_id)?;
        
        Ok(json!(SuccessResponse::default()))
    }
    
    async fn handle_get_pane_info(&self, params: Value) -> Result<Value> {
        let pane_id = PaneId(
            params
                .get("pane_id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| MuxdError::InvalidRequest {
                    reason: "Missing pane_id".to_string(),
                })?
                .to_string(),
        );
        
        // Find pane across all sessions
        let (session_id, pane) = self
            .session_manager
            .find_pane(&pane_id)
            .ok_or_else(|| MuxdError::PaneNotFound {
                pane_id: pane_id.to_string(),
            })?;
        
        let size = pane.size();
        
        Ok(json!(GetPaneInfoResponse {
            pane: PaneInfo {
                pane_id: pane.id.to_string(),
                session_id: session_id.to_string(),
                pane_type: match &pane.pane_type {
                    PaneType::Terminal => "terminal".to_string(),
                    PaneType::Custom(s) => s.clone(),
                },
                rows: size.rows,
                cols: size.cols,
                pid: pane.pid(),
                title: pane.title(),
                working_dir: pane.working_dir()
            },
        }))
    }
    
    async fn handle_list_panes(&self, params: Value) -> Result<Value> {
        let session_id = SessionId(
            params
                .get("session_id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| MuxdError::InvalidRequest {
                    reason: "Missing session_id".to_string(),
                })?
                .to_string(),
        );
        
        let panes = self
            .session_manager
            .list_panes(&session_id)?
            .into_iter()
            .map(|pane| {
                let size = pane.size();
                PaneInfo {
                    pane_id: pane.id.to_string(),
                    session_id: session_id.to_string(),
                    pane_type: match &pane.pane_type {
                        PaneType::Terminal => "terminal".to_string(),
                        PaneType::Custom(s) => s.clone(),
                    },
                    rows: size.rows,
                    cols: size.cols,
                    pid: pane.pid(),
                    title: pane.title(),
                    working_dir: pane.working_dir(),
                }
            })
            .collect();
        
        Ok(json!(ListPanesResponse { panes }))
    }
    
    async fn handle_update_pane_title(&self, params: Value) -> Result<Value> {
        let req: UpdatePaneTitleRequest = serde_json::from_value(params)?;
        let pane_id = PaneId(req.pane_id);
        
        // Find pane across all sessions
        let (_session_id, pane) = self
            .session_manager
            .find_pane(&pane_id)
            .ok_or_else(|| MuxdError::PaneNotFound {
                pane_id: pane_id.to_string(),
            })?;
        
        pane.set_title(req.title);
        
        Ok(json!(SuccessResponse::default()))
    }
    
    async fn handle_update_pane_working_dir(&self, params: Value) -> Result<Value> {
        let req: UpdatePaneWorkingDirRequest = serde_json::from_value(params)?;
        let pane_id = PaneId(req.pane_id);
        
        // Find pane across all sessions
        let (_session_id, pane) = self
            .session_manager
            .find_pane(&pane_id)
            .ok_or_else(|| MuxdError::PaneNotFound {
                pane_id: pane_id.to_string(),
            })?;
        
        pane.set_working_dir(req.working_dir);
        
        Ok(json!(SuccessResponse::default()))
    }
    
    async fn handle_search_pane(&self, params: Value) -> Result<Value> {
        let req: SearchPaneRequest = serde_json::from_value(params)?;
        let pane_id = PaneId(req.pane_id);
        
        // Find pane across all sessions
        let (_session_id, pane) = self
            .session_manager
            .find_pane(&pane_id)
            .ok_or_else(|| MuxdError::PaneNotFound {
                pane_id: pane_id.to_string(),
            })?;
        
        // Perform search
        let (matches, total_matches, truncated) = pane.search_output(
            &req.query,
            req.case_sensitive,
            req.regex,
            req.max_results,
            req.start_line,
        )?;
        
        // Convert matches to response format
        let search_matches = matches
            .into_iter()
            .map(|(line_number, line_content, match_start, match_end)| SearchMatch {
                line_number,
                line_content,
                match_start,
                match_end,
            })
            .collect();
        
        Ok(json!(SearchPaneResponse {
            matches: search_matches,
            total_matches,
            truncated,
        }))
    }
    
    async fn handle_server_status(&self, _params: Value) -> Result<Value> {
        let sessions = self.session_manager.list_sessions();
        let mut total_panes = 0;
        
        for (_session_id, _, pane_count, _, _) in &sessions {
            total_panes += pane_count;
        }
        
        Ok(json!({
            "running": true,
            "version": env!("CARGO_PKG_VERSION"),
            "sessions": sessions.len(),
            "total_panes": total_panes,
            "uptime_seconds": 0, // TODO: Track server start time
            "config": {
                "max_sessions": self.session_manager.max_sessions(),
                "max_panes_per_session": self.session_manager.max_panes_per_session(),
            }
        }))
    }
    
    async fn handle_server_shutdown(&self, _params: Value) -> Result<Value> {
        // Send shutdown signal through the output channel
        // The server will handle this as a special message
        let shutdown_msg = json!({
            "jsonrpc": "2.0",
            "method": "_internal_shutdown",
            "params": {}
        });
        
        let _ = self.output_tx.send(Message::Text(shutdown_msg.to_string()));
        
        Ok(json!({
            "status": "shutting_down"
        }))
    }
    
    async fn handle_save_state(&self, params: Value) -> Result<Value> {
        let req: SaveStateRequest = serde_json::from_value(params)?;
        
        let saved_ids = self.session_manager.save_state(req.session_ids).await?;
        
        Ok(json!(SaveStateResponse {
            saved_sessions: saved_ids,
            state_file: "muxd_state.json".to_string(),
        }))
    }
    
    async fn handle_restore_state(&self, params: Value) -> Result<Value> {
        let req: RestoreStateRequest = serde_json::from_value(params)?;
        
        let (restored, failed) = self.session_manager
            .restore_state(req.session_ids, req.restart_commands)
            .await?;
        
        let restored_sessions = restored
            .into_iter()
            .map(|(id, name)| SessionInfo {
                session_id: id.to_string(),
                name,
                pane_count: 0,
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            })
            .collect();
        
        let failed_sessions = failed
            .into_iter()
            .map(|(id, reason)| FailedRestore {
                session_id: id,
                reason,
            })
            .collect();
        
        Ok(json!(RestoreStateResponse {
            restored_sessions,
            failed_sessions,
        }))
    }
}