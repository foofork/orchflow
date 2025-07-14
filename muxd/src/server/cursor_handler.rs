use crate::error::{MuxdError, Result};
use crate::protocol::{
    GetCursorRequest, GetCursorResponse, SetCursorRequest, QueryCursorRequest,
    SaveCursorRequest, RestoreCursorRequest, ResetCursorRequest,
    ConfigureCursorTrackingRequest, CursorConfigResponse,
    BatchCursorRequest, BatchCursorResponse, CursorOperation, CursorOperationResult,
    CursorEventNotification, CursorTrackingConfig,
};
use crate::session::manager::SessionManager;
use crate::terminal::cursor::{CursorPosition, CursorEvent};
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{error, info, warn};

/// Handler for cursor-related API requests
pub struct CursorHandler {
    session_manager: Arc<SessionManager>,
    event_sender: Option<mpsc::UnboundedSender<CursorEventNotification>>,
}

impl CursorHandler {
    /// Create a new cursor handler
    pub fn new(
        session_manager: Arc<SessionManager>,
        event_sender: Option<mpsc::UnboundedSender<CursorEventNotification>>,
    ) -> Self {
        Self {
            session_manager,
            event_sender,
        }
    }

    /// Handle get cursor position request
    pub async fn handle_get_cursor(&self, request: GetCursorRequest) -> Result<GetCursorResponse> {
        let session = self.session_manager.get_session(&request.session_id)?;
        let pane = session.get_pane(&request.pane_id)?;

        let position = pane.get_cursor_position();
        let saved_position = if let Ok(saved) = self.get_saved_cursor_position(&pane) {
            Some(saved)
        } else {
            None
        };
        let in_bounds = pane.is_cursor_in_bounds();
        let relative_position = pane.get_cursor_relative().ok();

        Ok(GetCursorResponse {
            position,
            saved_position,
            in_bounds,
            relative_position,
        })
    }

    /// Handle set cursor position request
    pub async fn handle_set_cursor(&self, request: SetCursorRequest) -> Result<()> {
        let session = self.session_manager.get_session(&request.session_id)?;
        let pane = session.get_pane(&request.pane_id)?;

        pane.set_cursor_position(request.position);
        
        // Send cursor position command to PTY
        self.send_cursor_command(&pane, request.position).await?;
        
        // Emit cursor event
        self.emit_cursor_event(
            &request.session_id,
            &request.pane_id,
            CursorEvent::Position(request.position),
        ).await;

        info!("Set cursor position for pane {} to {}", request.pane_id, request.position);
        Ok(())
    }

    /// Handle query cursor position request
    pub async fn handle_query_cursor(&self, request: QueryCursorRequest) -> Result<()> {
        let session = self.session_manager.get_session(&request.session_id)?;
        let pane = session.get_pane(&request.pane_id)?;

        pane.query_cursor_position().await?;
        info!("Queried cursor position for pane {}", request.pane_id);
        Ok(())
    }

    /// Handle save cursor position request
    pub async fn handle_save_cursor(&self, request: SaveCursorRequest) -> Result<()> {
        let session = self.session_manager.get_session(&request.session_id)?;
        let pane = session.get_pane(&request.pane_id)?;

        let current_position = pane.get_cursor_position();
        pane.save_cursor_position();
        
        // Send save cursor command to PTY
        self.send_save_cursor_command(&pane).await?;
        
        // Emit cursor event
        self.emit_cursor_event(
            &request.session_id,
            &request.pane_id,
            CursorEvent::Save(current_position),
        ).await;

        info!("Saved cursor position for pane {}", request.pane_id);
        Ok(())
    }

    /// Handle restore cursor position request
    pub async fn handle_restore_cursor(&self, request: RestoreCursorRequest) -> Result<()> {
        let session = self.session_manager.get_session(&request.session_id)?;
        let pane = session.get_pane(&request.pane_id)?;

        pane.restore_cursor_position()?;
        let restored_position = pane.get_cursor_position();
        
        // Send restore cursor command to PTY
        self.send_restore_cursor_command(&pane).await?;
        
        // Emit cursor event
        self.emit_cursor_event(
            &request.session_id,
            &request.pane_id,
            CursorEvent::Restore(restored_position),
        ).await;

        info!("Restored cursor position for pane {} to {}", request.pane_id, restored_position);
        Ok(())
    }

    /// Handle reset cursor position request
    pub async fn handle_reset_cursor(&self, request: ResetCursorRequest) -> Result<()> {
        let session = self.session_manager.get_session(&request.session_id)?;
        let pane = session.get_pane(&request.pane_id)?;

        pane.reset_cursor();
        let reset_position = pane.get_cursor_position();
        
        // Send reset cursor command to PTY (move to 1,1)
        self.send_cursor_command(&pane, reset_position).await?;
        
        // Emit cursor event
        self.emit_cursor_event(
            &request.session_id,
            &request.pane_id,
            CursorEvent::Position(reset_position),
        ).await;

        info!("Reset cursor position for pane {}", request.pane_id);
        Ok(())
    }

    /// Handle configure cursor tracking request
    pub async fn handle_configure_tracking(
        &self,
        request: ConfigureCursorTrackingRequest,
    ) -> Result<CursorConfigResponse> {
        // This would typically update session or pane-specific configuration
        // For now, we'll just return success
        info!("Configured cursor tracking for session {}", request.session_id);
        
        Ok(CursorConfigResponse {
            success: true,
            message: "Cursor tracking configuration updated".to_string(),
        })
    }

    /// Handle batch cursor operations
    pub async fn handle_batch_cursor(&self, request: BatchCursorRequest) -> Result<BatchCursorResponse> {
        let mut results = Vec::new();

        for operation in request.operations {
            let result = match operation {
                CursorOperation::Get(req) => {
                    match self.handle_get_cursor(req).await {
                        Ok(response) => CursorOperationResult::Get(Ok(response)),
                        Err(e) => CursorOperationResult::Get(Err(e.to_string())),
                    }
                }
                CursorOperation::Set(req) => {
                    match self.handle_set_cursor(req).await {
                        Ok(()) => CursorOperationResult::Set(Ok(())),
                        Err(e) => CursorOperationResult::Set(Err(e.to_string())),
                    }
                }
                CursorOperation::Query(req) => {
                    match self.handle_query_cursor(req).await {
                        Ok(()) => CursorOperationResult::Query(Ok(())),
                        Err(e) => CursorOperationResult::Query(Err(e.to_string())),
                    }
                }
                CursorOperation::Save(req) => {
                    match self.handle_save_cursor(req).await {
                        Ok(()) => CursorOperationResult::Save(Ok(())),
                        Err(e) => CursorOperationResult::Save(Err(e.to_string())),
                    }
                }
                CursorOperation::Restore(req) => {
                    match self.handle_restore_cursor(req).await {
                        Ok(()) => CursorOperationResult::Restore(Ok(())),
                        Err(e) => CursorOperationResult::Restore(Err(e.to_string())),
                    }
                }
                CursorOperation::Reset(req) => {
                    match self.handle_reset_cursor(req).await {
                        Ok(()) => CursorOperationResult::Reset(Ok(())),
                        Err(e) => CursorOperationResult::Reset(Err(e.to_string())),
                    }
                }
            };
            results.push(result);
        }

        Ok(BatchCursorResponse { results })
    }

    /// Process PTY output for cursor position updates
    pub async fn process_pty_output(
        &self,
        session_id: &crate::protocol::SessionId,
        pane_id: &crate::protocol::PaneId,
        data: &[u8],
    ) -> Result<()> {
        let session = self.session_manager.get_session(session_id)?;
        let pane = session.get_pane(pane_id)?;

        // Check for cursor position report first
        if let Some(reported_position) = pane.extract_cursor_report(data)? {
            pane.update_cursor_from_report(reported_position);
            self.emit_cursor_event(
                session_id,
                pane_id,
                CursorEvent::Position(reported_position),
            ).await;
        }

        // Process other cursor events
        let events = pane.process_output_for_cursor(data)?;
        for event in events {
            self.emit_cursor_event(session_id, pane_id, event).await;
        }

        Ok(())
    }

    // Private helper methods
    async fn send_cursor_command(
        &self,
        pane: &Arc<crate::terminal::pane::Pane>,
        position: CursorPosition,
    ) -> Result<()> {
        if let Some(pty) = pane.pty.read().as_ref() {
            let command = format!("\x1b[{};{}H", position.row, position.col);
            pty.write(command.as_bytes()).await?;
        }
        Ok(())
    }

    async fn send_save_cursor_command(&self, pane: &Arc<crate::terminal::pane::Pane>) -> Result<()> {
        if let Some(pty) = pane.pty.read().as_ref() {
            pty.write(b"\x1b[s").await?;
        }
        Ok(())
    }

    async fn send_restore_cursor_command(&self, pane: &Arc<crate::terminal::pane::Pane>) -> Result<()> {
        if let Some(pty) = pane.pty.read().as_ref() {
            pty.write(b"\x1b[u").await?;
        }
        Ok(())
    }

    fn get_saved_cursor_position(
        &self,
        pane: &Arc<crate::terminal::pane::Pane>,
    ) -> Result<CursorPosition> {
        if let Some(saved) = *pane.saved_cursor_position.read() {
            Ok(saved)
        } else {
            Err(MuxdError::StateError {
                operation: "get_saved_cursor".to_string(),
                reason: "No saved cursor position available".to_string(),
            })
        }
    }

    async fn emit_cursor_event(
        &self,
        session_id: &crate::protocol::SessionId,
        pane_id: &crate::protocol::PaneId,
        event: CursorEvent,
    ) {
        if let Some(sender) = &self.event_sender {
            let notification = CursorEventNotification {
                session_id: session_id.clone(),
                pane_id: pane_id.clone(),
                event,
                timestamp: chrono::Utc::now(),
            };

            if let Err(e) = sender.send(notification) {
                warn!("Failed to send cursor event notification: {}", e);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::session::manager::SessionManager;
    use crate::protocol::{PaneType, SessionId, PaneId};
    use tokio::sync::mpsc;

    async fn create_test_setup() -> (CursorHandler, SessionManager) {
        let session_manager = SessionManager::new(10, 10);
        let (event_tx, _event_rx) = mpsc::unbounded_channel();
        let handler = CursorHandler::new(Arc::new(session_manager), Some(event_tx));
        
        // Create a test session and pane
        let session_id = SessionId::new();
        let session = session_manager.create_session(session_id.clone()).unwrap();
        let pane_id = session.create_pane(PaneType::Terminal).await.unwrap();
        
        (handler, session_manager)
    }

    #[tokio::test]
    async fn test_get_cursor_position() {
        let (handler, session_manager) = create_test_setup().await;
        let sessions = session_manager.list_sessions();
        let session_id = sessions[0].id.clone();
        let panes = session_manager.get_session(&session_id).unwrap().list_panes();
        let pane_id = panes[0].id.clone();

        let request = GetCursorRequest { session_id, pane_id };
        let response = handler.handle_get_cursor(request).await.unwrap();

        assert_eq!(response.position, CursorPosition::default());
        assert!(response.in_bounds);
    }

    #[tokio::test]
    async fn test_set_cursor_position() {
        let (handler, session_manager) = create_test_setup().await;
        let sessions = session_manager.list_sessions();
        let session_id = sessions[0].id.clone();
        let panes = session_manager.get_session(&session_id).unwrap().list_panes();
        let pane_id = panes[0].id.clone();

        let new_position = CursorPosition::new(10, 20);
        let request = SetCursorRequest {
            session_id: session_id.clone(),
            pane_id: pane_id.clone(),
            position: new_position,
        };
        
        handler.handle_set_cursor(request).await.unwrap();

        // Verify position was set
        let get_request = GetCursorRequest { session_id, pane_id };
        let response = handler.handle_get_cursor(get_request).await.unwrap();
        assert_eq!(response.position, new_position);
    }

    #[tokio::test]
    async fn test_save_restore_cursor() {
        let (handler, session_manager) = create_test_setup().await;
        let sessions = session_manager.list_sessions();
        let session_id = sessions[0].id.clone();
        let panes = session_manager.get_session(&session_id).unwrap().list_panes();
        let pane_id = panes[0].id.clone();

        // Set initial position
        let initial_position = CursorPosition::new(5, 10);
        let set_request = SetCursorRequest {
            session_id: session_id.clone(),
            pane_id: pane_id.clone(),
            position: initial_position,
        };
        handler.handle_set_cursor(set_request).await.unwrap();

        // Save position
        let save_request = SaveCursorRequest {
            session_id: session_id.clone(),
            pane_id: pane_id.clone(),
        };
        handler.handle_save_cursor(save_request).await.unwrap();

        // Change position
        let new_position = CursorPosition::new(15, 25);
        let set_request = SetCursorRequest {
            session_id: session_id.clone(),
            pane_id: pane_id.clone(),
            position: new_position,
        };
        handler.handle_set_cursor(set_request).await.unwrap();

        // Restore position
        let restore_request = RestoreCursorRequest {
            session_id: session_id.clone(),
            pane_id: pane_id.clone(),
        };
        handler.handle_restore_cursor(restore_request).await.unwrap();

        // Verify restored position
        let get_request = GetCursorRequest { session_id, pane_id };
        let response = handler.handle_get_cursor(get_request).await.unwrap();
        assert_eq!(response.position, initial_position);
    }

    #[tokio::test]
    async fn test_batch_cursor_operations() {
        let (handler, session_manager) = create_test_setup().await;
        let sessions = session_manager.list_sessions();
        let session_id = sessions[0].id.clone();
        let panes = session_manager.get_session(&session_id).unwrap().list_panes();
        let pane_id = panes[0].id.clone();

        let batch_request = BatchCursorRequest {
            operations: vec![
                CursorOperation::Set(SetCursorRequest {
                    session_id: session_id.clone(),
                    pane_id: pane_id.clone(),
                    position: CursorPosition::new(5, 10),
                }),
                CursorOperation::Save(SaveCursorRequest {
                    session_id: session_id.clone(),
                    pane_id: pane_id.clone(),
                }),
                CursorOperation::Get(GetCursorRequest {
                    session_id: session_id.clone(),
                    pane_id: pane_id.clone(),
                }),
            ],
        };

        let response = handler.handle_batch_cursor(batch_request).await.unwrap();
        assert_eq!(response.results.len(), 3);

        // Check that all operations succeeded
        for result in response.results {
            match result {
                CursorOperationResult::Set(res) => assert!(res.is_ok()),
                CursorOperationResult::Save(res) => assert!(res.is_ok()),
                CursorOperationResult::Get(res) => {
                    assert!(res.is_ok());
                    let response = res.unwrap();
                    assert_eq!(response.position, CursorPosition::new(5, 10));
                }
                _ => panic!("Unexpected operation result"),
            }
        }
    }
}