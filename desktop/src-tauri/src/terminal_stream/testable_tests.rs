// Tests for TerminalStreamManager using mock IPC
//
// These tests demonstrate that TerminalStreamManager is now testable
// without requiring Tauri's AppHandle.

#[cfg(test)]
mod tests {
    use super::super::ipc_trait::mock::MockIpcChannel;
    use super::super::*;
    use std::sync::Arc;

    /// Create a test terminal stream manager with mock IPC
    fn create_test_manager() -> (TerminalStreamManager, Arc<MockIpcChannel>) {
        let mock_channel = Arc::new(MockIpcChannel::new());
        let manager = TerminalStreamManager::with_ipc_channel(mock_channel.clone());
        (manager, mock_channel)
    }

    #[tokio::test]
    async fn test_create_terminal_with_mock() {
        let (manager, mock_channel) = create_test_manager();

        let terminal_id = "test-term-1".to_string();
        let result = manager
            .create_terminal(terminal_id.clone(), None, 24, 80)
            .await;

        assert!(result.is_ok());

        // Verify terminal was created
        let state = manager.get_terminal_state(&terminal_id).await;
        assert!(state.is_some());

        let state = state.unwrap();
        assert_eq!(state.rows, 24);
        assert_eq!(state.cols, 80);

        // Verify streaming was started
        let streams = mock_channel.active_streams.lock().await;
        assert!(streams.contains_key(&terminal_id));
    }

    #[tokio::test]
    async fn test_send_input_with_mock() {
        let (manager, mock_channel) = create_test_manager();

        let terminal_id = "test-term-2".to_string();
        let _ = manager
            .create_terminal(terminal_id.clone(), None, 24, 80)
            .await
            .unwrap();

        // Send text input
        let result = manager
            .send_input(&terminal_id, TerminalInput::Text("hello world".to_string()))
            .await;

        assert!(result.is_ok());

        // Send special key
        let result = manager
            .send_input(&terminal_id, TerminalInput::SpecialKey("enter".to_string()))
            .await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_resize_terminal_with_mock() {
        let (manager, _mock_channel) = create_test_manager();

        let terminal_id = "test-term-3".to_string();
        let _ = manager
            .create_terminal(terminal_id.clone(), None, 24, 80)
            .await
            .unwrap();

        // Resize terminal
        let result = manager.resize_terminal(&terminal_id, 30, 100).await;
        assert!(result.is_ok());

        // Verify size was updated
        let state = manager.get_terminal_state(&terminal_id).await.unwrap();
        assert_eq!(state.rows, 30);
        assert_eq!(state.cols, 100);
    }

    #[tokio::test]
    async fn test_stop_terminal_with_mock() {
        let (manager, mock_channel) = create_test_manager();

        let terminal_id = "test-term-4".to_string();
        let _ = manager
            .create_terminal(terminal_id.clone(), None, 24, 80)
            .await
            .unwrap();

        // Stop terminal
        let result = manager.stop_terminal(&terminal_id).await;
        assert!(result.is_ok());

        // Verify terminal was removed
        let state = manager.get_terminal_state(&terminal_id).await;
        assert!(state.is_none());

        // Verify streaming was stopped
        let streams = mock_channel.active_streams.lock().await;
        assert!(!streams.contains_key(&terminal_id));

        // Verify stop was called
        let mut stop_rx = mock_channel.stop_rx.lock().await;
        let stopped_id = stop_rx.recv().await;
        assert_eq!(stopped_id, Some(terminal_id));
    }

    #[tokio::test]
    async fn test_restart_terminal_with_mock() {
        let (manager, _mock_channel) = create_test_manager();

        let terminal_id = "test-term-5".to_string();
        let _ = manager
            .create_terminal(terminal_id.clone(), None, 24, 80)
            .await
            .unwrap();

        // Get process info before restart
        let info_before = manager.get_process_info(&terminal_id).await;
        assert!(info_before.is_ok());

        // Restart terminal
        let result = manager.restart_terminal(&terminal_id).await;
        assert!(result.is_ok());

        // Verify terminal still exists
        let state = manager.get_terminal_state(&terminal_id).await;
        assert!(state.is_some());

        // Process should have a new PID (in real scenario)
        let info_after = manager.get_process_info(&terminal_id).await;
        assert!(info_after.is_ok());
    }

    #[tokio::test]
    async fn test_terminal_health_with_mock() {
        let (manager, _mock_channel) = create_test_manager();

        let terminal_id = "test-term-6".to_string();
        let _ = manager
            .create_terminal(terminal_id.clone(), None, 24, 80)
            .await
            .unwrap();

        // Check health
        let health = manager.get_terminal_health(&terminal_id).await;
        assert!(health.is_ok());

        let health = health.unwrap();
        assert_eq!(health.terminal_id, terminal_id);
        match health.status {
            HealthStatus::Healthy => {}
            _ => panic!("Expected healthy status"),
        }
    }

    #[tokio::test]
    async fn test_multiple_terminals_with_mock() {
        let (manager, mock_channel) = create_test_manager();

        // Create multiple terminals
        let ids = vec!["term1", "term2", "term3"];
        for id in &ids {
            let result = manager.create_terminal(id.to_string(), None, 24, 80).await;
            assert!(result.is_ok());
        }

        // Verify all were created
        let streams = mock_channel.active_streams.lock().await;
        assert_eq!(streams.len(), 3);

        // Stop one terminal
        let _ = manager.stop_terminal("term2").await;
        drop(streams);

        // Verify only that one was removed
        let streams = mock_channel.active_streams.lock().await;
        assert_eq!(streams.len(), 2);
        assert!(streams.contains_key("term1"));
        assert!(!streams.contains_key("term2"));
        assert!(streams.contains_key("term3"));
    }
}
