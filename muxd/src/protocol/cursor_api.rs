use crate::error::Result;
use crate::protocol::{PaneId, SessionId};
use crate::terminal::cursor::{CursorPosition, CursorEvent};
use serde::{Deserialize, Serialize};

/// Request to get cursor position
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCursorRequest {
    pub session_id: SessionId,
    pub pane_id: PaneId,
}

/// Response with cursor position
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCursorResponse {
    pub position: CursorPosition,
    pub saved_position: Option<CursorPosition>,
    pub in_bounds: bool,
    pub relative_position: Option<(f32, f32)>,
}

/// Request to set cursor position
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetCursorRequest {
    pub session_id: SessionId,
    pub pane_id: PaneId,
    pub position: CursorPosition,
}

/// Request to query cursor position from terminal
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryCursorRequest {
    pub session_id: SessionId,
    pub pane_id: PaneId,
}

/// Request to save cursor position
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveCursorRequest {
    pub session_id: SessionId,
    pub pane_id: PaneId,
}

/// Request to restore cursor position
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestoreCursorRequest {
    pub session_id: SessionId,
    pub pane_id: PaneId,
}

/// Request to reset cursor to default position
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResetCursorRequest {
    pub session_id: SessionId,
    pub pane_id: PaneId,
}

/// Cursor event notification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CursorEventNotification {
    pub session_id: SessionId,
    pub pane_id: PaneId,
    pub event: CursorEvent,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

/// Cursor tracking configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CursorTrackingConfig {
    /// Enable real-time cursor tracking
    pub enabled: bool,
    /// Send cursor events to clients
    pub send_events: bool,
    /// Query cursor position on pane focus
    pub query_on_focus: bool,
    /// Auto-save cursor position periodically
    pub auto_save_interval: Option<u64>, // seconds
}

impl Default for CursorTrackingConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            send_events: false,
            query_on_focus: true,
            auto_save_interval: Some(30), // 30 seconds
        }
    }
}

/// Request to configure cursor tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigureCursorTrackingRequest {
    pub session_id: SessionId,
    pub pane_id: Option<PaneId>, // None for session-wide config
    pub config: CursorTrackingConfig,
}

/// Response for configuration requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CursorConfigResponse {
    pub success: bool,
    pub message: String,
}

/// Batch cursor operation request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchCursorRequest {
    pub operations: Vec<CursorOperation>,
}

/// Individual cursor operation in a batch
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CursorOperation {
    Get(GetCursorRequest),
    Set(SetCursorRequest),
    Query(QueryCursorRequest),
    Save(SaveCursorRequest),
    Restore(RestoreCursorRequest),
    Reset(ResetCursorRequest),
}

/// Batch cursor operation response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchCursorResponse {
    pub results: Vec<CursorOperationResult>,
}

/// Result of a single cursor operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CursorOperationResult {
    Get(std::result::Result<GetCursorResponse, String>),
    Set(std::result::Result<(), String>),
    Query(std::result::Result<(), String>),
    Save(std::result::Result<(), String>),
    Restore(std::result::Result<(), String>),
    Reset(std::result::Result<(), String>),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cursor_tracking_config_default() {
        let config = CursorTrackingConfig::default();
        assert!(config.enabled);
        assert!(!config.send_events);
        assert!(config.query_on_focus);
        assert_eq!(config.auto_save_interval, Some(30));
    }

    #[test]
    fn test_get_cursor_request_serialization() {
        let request = GetCursorRequest {
            session_id: SessionId("test_session".to_string()),
            pane_id: PaneId("test_pane".to_string()),
        };

        let json = serde_json::to_string(&request).unwrap();
        let deserialized: GetCursorRequest = serde_json::from_str(&json).unwrap();
        
        assert_eq!(request.session_id.0, deserialized.session_id.0);
        assert_eq!(request.pane_id.0, deserialized.pane_id.0);
    }

    #[test]
    fn test_cursor_event_notification() {
        let notification = CursorEventNotification {
            session_id: SessionId("test_session".to_string()),
            pane_id: PaneId("test_pane".to_string()),
            event: CursorEvent::Position(CursorPosition::new(10, 20)),
            timestamp: chrono::Utc::now(),
        };

        let json = serde_json::to_string(&notification).unwrap();
        let deserialized: CursorEventNotification = serde_json::from_str(&json).unwrap();
        
        assert_eq!(notification.session_id.0, deserialized.session_id.0);
        assert_eq!(notification.pane_id.0, deserialized.pane_id.0);
    }

    #[test]
    fn test_batch_cursor_operations() {
        let batch = BatchCursorRequest {
            operations: vec![
                CursorOperation::Get(GetCursorRequest {
                    session_id: SessionId("test".to_string()),
                    pane_id: PaneId("pane1".to_string()),
                }),
                CursorOperation::Set(SetCursorRequest {
                    session_id: SessionId("test".to_string()),
                    pane_id: PaneId("pane1".to_string()),
                    position: CursorPosition::new(5, 10),
                }),
                CursorOperation::Save(SaveCursorRequest {
                    session_id: SessionId("test".to_string()),
                    pane_id: PaneId("pane1".to_string()),
                }),
            ],
        };

        assert_eq!(batch.operations.len(), 3);
        
        let json = serde_json::to_string(&batch).unwrap();
        let deserialized: BatchCursorRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.operations.len(), 3);
    }

    #[test]
    fn test_cursor_operation_result() {
        let result = CursorOperationResult::Get(Ok(GetCursorResponse {
            position: CursorPosition::new(1, 1),
            saved_position: None,
            in_bounds: true,
            relative_position: Some((0.1, 0.1)),
        }));

        let json = serde_json::to_string(&result).unwrap();
        let _deserialized: CursorOperationResult = serde_json::from_str(&json).unwrap();
    }
}