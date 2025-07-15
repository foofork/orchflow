#[cfg(test)]
mod unit_tests {
    use crate::{DirectChannel, TerminalInput, TerminalState, TerminalStreamManager};
    use std::sync::Arc;

    #[tokio::test]
    async fn test_terminal_state_creation() {
        let state = TerminalState::new("test_id".to_string(), 24, 80);
        assert_eq!(state.id, "test_id");
        assert_eq!(state.rows, 24);
        assert_eq!(state.cols, 80);
        assert!(state.active);
    }

    #[tokio::test]
    async fn test_terminal_state_resize() {
        let mut state = TerminalState::new("test_id".to_string(), 24, 80);
        state.resize(30, 100);
        assert_eq!(state.rows, 30);
        assert_eq!(state.cols, 100);
    }

    #[tokio::test]
    async fn test_terminal_stream_manager_creation() {
        let channel = Arc::new(DirectChannel);
        let manager = TerminalStreamManager::with_ipc_channel(channel.clone());

        // Test that we can create a terminal
        let result = manager
            .create_terminal("test_terminal".to_string(), None, 80, 24)
            .await;

        assert!(result.is_ok());

        // Check that the terminal is listed
        let terminals = manager.list_terminals().await;
        assert!(terminals.contains(&"test_terminal".to_string()));
    }

    #[tokio::test]
    async fn test_terminal_input_output() {
        let channel = Arc::new(DirectChannel);
        let manager = TerminalStreamManager::with_ipc_channel(channel.clone());

        // Create terminal
        let terminal_id = "test_terminal".to_string();
        manager
            .create_terminal(terminal_id.clone(), None, 80, 24)
            .await
            .unwrap();

        // Send input
        let input = TerminalInput::Text("echo test\n".to_string());
        let result = manager.send_input(&terminal_id, input).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_terminal_kill() {
        let channel = Arc::new(DirectChannel);
        let manager = TerminalStreamManager::with_ipc_channel(channel.clone());

        // Create terminal
        let terminal_id = "test_terminal".to_string();
        manager
            .create_terminal(terminal_id.clone(), None, 80, 24)
            .await
            .unwrap();

        // Kill terminal
        let result = manager.kill_terminal(&terminal_id).await;
        assert!(result.is_ok());

        // Check that the terminal is no longer listed
        let terminals = manager.list_terminals().await;
        assert!(!terminals.contains(&terminal_id));
    }
}
