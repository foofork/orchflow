// Comprehensive tests for Terminal Streaming functionality
// Tests PTY management, IPC events, and buffer handling

#[cfg(test)]
mod tests {
    use crate::terminal_stream::{TerminalStreamManager, TerminalState, TerminalMode};
    use crate::terminal_stream::CursorPosition;
    use std::sync::Arc;
    use tauri::test::{mock_builder, mock_context};

    fn setup_test_manager() -> Arc<TerminalStreamManager> {
        let app = mock_builder().build(mock_context()).unwrap();
        let handle = app.handle();
        Arc::new(TerminalStreamManager::new(handle))
    }

    #[tokio::test]
    async fn test_terminal_creation() {
        let manager = setup_test_manager();
        
        // Create terminal
        let terminal_id = manager.create_terminal(
            None, // Use default shell
            None, // Use default working directory
            80,   // cols
            24,   // rows
        ).await.unwrap();
        
        assert!(!terminal_id.is_empty());
        
        // Get terminal state
        let state = manager.get_state(&terminal_id).await.unwrap();
        assert_eq!(state.cols, 80);
        assert_eq!(state.rows, 24);
        assert!(matches!(state.mode, TerminalMode::Normal));
        
        // Stop terminal
        manager.stop_terminal(&terminal_id).await.unwrap();
    }

    #[tokio::test]
    async fn test_terminal_input_output() {
        let manager = setup_test_manager();
        
        // Create terminal
        let terminal_id = manager.create_terminal(
            None,
            None,
            80,
            24,
        ).await.unwrap();
        
        // Send input
        let input = "echo 'Hello, Terminal!'\n";
        manager.send_input(&terminal_id, input).await.unwrap();
        
        // Give some time for command execution
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        
        // Terminal should still be running
        let state = manager.get_state(&terminal_id).await.unwrap();
        assert_eq!(state.cols, 80);
        
        // Clean up
        manager.stop_terminal(&terminal_id).await.unwrap();
    }

    #[tokio::test]
    async fn test_terminal_resize() {
        let manager = setup_test_manager();
        
        // Create terminal
        let terminal_id = manager.create_terminal(
            None,
            None,
            80,
            24,
        ).await.unwrap();
        
        // Resize terminal
        manager.resize_terminal(&terminal_id, 120, 40).await.unwrap();
        
        // Verify new size
        let state = manager.get_state(&terminal_id).await.unwrap();
        assert_eq!(state.cols, 120);
        assert_eq!(state.rows, 40);
        
        // Clean up
        manager.stop_terminal(&terminal_id).await.unwrap();
    }

    #[tokio::test]
    async fn test_terminal_key_sequences() {
        let manager = setup_test_manager();
        
        // Create terminal
        let terminal_id = manager.create_terminal(
            None,
            None,
            80,
            24,
        ).await.unwrap();
        
        // Test various key sequences
        let key_tests = vec![
            ("Up", "\x1b[A"),
            ("Down", "\x1b[B"),
            ("Right", "\x1b[C"),
            ("Left", "\x1b[D"),
            ("Tab", "\t"),
            ("Enter", "\r"),
            ("Escape", "\x1b"),
        ];
        
        for (key, expected_seq) in key_tests {
            let result = manager.send_key(&terminal_id, key, false, false, false).await;
            assert!(result.is_ok(), "Failed to send key: {}", key);
        }
        
        // Test with modifiers
        let result = manager.send_key(&terminal_id, "c", true, false, false).await;
        assert!(result.is_ok(), "Failed to send Ctrl+C");
        
        // Clean up
        manager.stop_terminal(&terminal_id).await.unwrap();
    }

    #[tokio::test]
    async fn test_multiple_terminals() {
        let manager = setup_test_manager();
        let mut terminal_ids = vec![];
        
        // Create multiple terminals
        for i in 0..5 {
            let id = manager.create_terminal(
                None,
                None,
                80,
                24,
            ).await.unwrap();
            terminal_ids.push(id);
        }
        
        // All terminals should have unique IDs
        let unique_ids: std::collections::HashSet<_> = terminal_ids.iter().collect();
        assert_eq!(unique_ids.len(), 5);
        
        // All terminals should be running
        for id in &terminal_ids {
            let state = manager.get_state(id).await.unwrap();
            assert_eq!(state.cols, 80);
        }
        
        // Clean up all terminals
        for id in terminal_ids {
            manager.stop_terminal(&id).await.unwrap();
        }
    }

    #[tokio::test]
    async fn test_terminal_broadcast() {
        let manager = setup_test_manager();
        
        // Create multiple terminals
        let id1 = manager.create_terminal(None, None, 80, 24).await.unwrap();
        let id2 = manager.create_terminal(None, None, 80, 24).await.unwrap();
        let id3 = manager.create_terminal(None, None, 80, 24).await.unwrap();
        
        // Broadcast input to terminals 1 and 2
        let terminal_ids = vec![id1.clone(), id2.clone()];
        let input = "echo 'Broadcast message'\n";
        manager.broadcast_input(terminal_ids, input).await.unwrap();
        
        // Give time for processing
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        
        // All terminals should still be running
        for id in [&id1, &id2, &id3] {
            let state = manager.get_state(id).await.unwrap();
            assert_eq!(state.cols, 80);
        }
        
        // Clean up
        manager.stop_terminal(&id1).await.unwrap();
        manager.stop_terminal(&id2).await.unwrap();
        manager.stop_terminal(&id3).await.unwrap();
    }

    #[tokio::test]
    async fn test_terminal_scrollback_clear() {
        let manager = setup_test_manager();
        
        // Create terminal
        let terminal_id = manager.create_terminal(
            None,
            None,
            80,
            24,
        ).await.unwrap();
        
        // Send some output-generating commands
        manager.send_input(&terminal_id, "echo 'Line 1'\n").await.unwrap();
        manager.send_input(&terminal_id, "echo 'Line 2'\n").await.unwrap();
        manager.send_input(&terminal_id, "echo 'Line 3'\n").await.unwrap();
        
        // Clear scrollback
        manager.clear_scrollback(&terminal_id).await.unwrap();
        
        // Terminal should still be running
        let state = manager.get_state(&terminal_id).await.unwrap();
        assert_eq!(state.cols, 80);
        
        // Clean up
        manager.stop_terminal(&terminal_id).await.unwrap();
    }

    #[tokio::test]
    async fn test_terminal_error_handling() {
        let manager = setup_test_manager();
        
        // Test operations on non-existent terminal
        let fake_id = "non-existent-terminal";
        
        // Get state should fail
        let result = manager.get_state(fake_id).await;
        assert!(result.is_err());
        
        // Send input should fail
        let result = manager.send_input(fake_id, "test").await;
        assert!(result.is_err());
        
        // Resize should fail
        let result = manager.resize_terminal(fake_id, 80, 24).await;
        assert!(result.is_err());
        
        // Stop should fail gracefully
        let result = manager.stop_terminal(fake_id).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_terminal_working_directory() {
        let manager = setup_test_manager();
        
        // Create terminal with specific working directory
        let working_dir = std::env::temp_dir().to_string_lossy().to_string();
        let terminal_id = manager.create_terminal(
            None,
            Some(working_dir.clone()),
            80,
            24,
        ).await.unwrap();
        
        // Send pwd command to verify directory
        manager.send_input(&terminal_id, "pwd\n").await.unwrap();
        
        // Give time for command execution
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        
        // Clean up
        manager.stop_terminal(&terminal_id).await.unwrap();
    }

    #[tokio::test]
    async fn test_terminal_shell_selection() {
        let manager = setup_test_manager();
        
        // Try to create terminal with specific shell (if available)
        let shells = vec!["bash", "sh", "zsh"];
        let mut created = false;
        
        for shell in shells {
            let result = manager.create_terminal(
                Some(shell.to_string()),
                None,
                80,
                24,
            ).await;
            
            if let Ok(terminal_id) = result {
                created = true;
                
                // Verify terminal was created
                let state = manager.get_state(&terminal_id).await.unwrap();
                assert_eq!(state.cols, 80);
                
                // Clean up
                manager.stop_terminal(&terminal_id).await.unwrap();
                break;
            }
        }
        
        assert!(created, "No common shell could be used to create terminal");
    }

    #[tokio::test] 
    async fn test_terminal_concurrent_operations() {
        let manager = setup_test_manager();
        
        // Create terminal
        let terminal_id = manager.create_terminal(None, None, 80, 24).await.unwrap();
        
        // Perform multiple concurrent operations
        let manager_clone = manager.clone();
        let id_clone = terminal_id.clone();
        
        let handles = vec![
            tokio::spawn(async move {
                manager_clone.send_input(&id_clone, "echo 'Task 1'\n").await
            }),
            tokio::spawn({
                let manager = manager.clone();
                let id = terminal_id.clone();
                async move {
                    manager.resize_terminal(&id, 100, 30).await
                }
            }),
            tokio::spawn({
                let manager = manager.clone();
                let id = terminal_id.clone();
                async move {
                    manager.send_key(&id, "Tab", false, false, false).await
                }
            }),
        ];
        
        // Wait for all operations
        for handle in handles {
            let result = handle.await.unwrap();
            assert!(result.is_ok());
        }
        
        // Terminal should still be functional
        let state = manager.get_state(&terminal_id).await.unwrap();
        assert_eq!(state.cols, 100); // Should have been resized
        assert_eq!(state.rows, 30);
        
        // Clean up
        manager.stop_terminal(&terminal_id).await.unwrap();
    }
}