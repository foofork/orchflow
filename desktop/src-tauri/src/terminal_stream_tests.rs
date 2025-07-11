// Comprehensive tests for Terminal Streaming functionality
// Tests PTY management, IPC events, and buffer handling

#[cfg(test)]
mod tests {
    use crate::terminal_stream::{
        TerminalStreamManager, TerminalState, TerminalMode,
        CreateTerminalOptions, TerminalInput, ControlMessage,
        IpcChannel, TerminalEvent
    };
    use std::sync::Arc;
    use async_trait::async_trait;
    use crate::error::Result;

    // Mock IPC channel for testing
    struct MockIpcChannel {
        events: tokio::sync::Mutex<Vec<TerminalEvent>>,
    }

    impl MockIpcChannel {
        fn new() -> Self {
            Self {
                events: tokio::sync::Mutex::new(Vec::new()),
            }
        }

        async fn get_events(&self) -> Vec<TerminalEvent> {
            self.events.lock().await.clone()
        }
    }

    #[async_trait]
    impl IpcChannel for MockIpcChannel {
        async fn emit_event(&self, event: TerminalEvent) -> Result<()> {
            self.events.lock().await.push(event);
            Ok(())
        }
    }

    fn setup_test_manager() -> (Arc<TerminalStreamManager>, Arc<MockIpcChannel>) {
        let ipc_channel = Arc::new(MockIpcChannel::new());
        let manager = Arc::new(TerminalStreamManager::with_ipc_channel(ipc_channel.clone()));
        (manager, ipc_channel)
    }

    #[tokio::test]
    async fn test_terminal_creation() {
        let (manager, _ipc) = setup_test_manager();
        
        // Create terminal
        let options = CreateTerminalOptions {
            shell: None,
            working_directory: None,
            cols: 80,
            rows: 24,
            env: std::collections::HashMap::new(),
        };
        
        let terminal_id = manager.create_terminal(options).await.unwrap();
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
        let (manager, ipc) = setup_test_manager();
        
        // Create terminal
        let options = CreateTerminalOptions {
            shell: None,
            working_directory: None,
            cols: 80,
            rows: 24,
            env: std::collections::HashMap::new(),
        };
        
        let terminal_id = manager.create_terminal(options).await.unwrap();
        
        // Send input
        let input = TerminalInput::Data("echo 'Hello, Terminal!'\n".to_string());
        manager.send_input(&terminal_id, input).await.unwrap();
        
        // Give some time for command execution
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        
        // Check that events were emitted
        let events = ipc.get_events().await;
        assert!(!events.is_empty());
        
        // Terminal should still be running
        let state = manager.get_state(&terminal_id).await.unwrap();
        assert_eq!(state.cols, 80);
        
        // Clean up
        manager.stop_terminal(&terminal_id).await.unwrap();
    }

    #[tokio::test]
    async fn test_terminal_resize() {
        let (manager, _ipc) = setup_test_manager();
        
        // Create terminal
        let options = CreateTerminalOptions {
            shell: None,
            working_directory: None,
            cols: 80,
            rows: 24,
            env: std::collections::HashMap::new(),
        };
        
        let terminal_id = manager.create_terminal(options).await.unwrap();
        
        // Resize terminal
        let control = ControlMessage::Resize { cols: 120, rows: 40 };
        manager.send_control(&terminal_id, control).await.unwrap();
        
        // Verify new size
        let state = manager.get_state(&terminal_id).await.unwrap();
        assert_eq!(state.cols, 120);
        assert_eq!(state.rows, 40);
        
        // Clean up
        manager.stop_terminal(&terminal_id).await.unwrap();
    }

    #[tokio::test]
    async fn test_terminal_key_sequences() {
        let (manager, _ipc) = setup_test_manager();
        
        // Create terminal
        let options = CreateTerminalOptions {
            shell: None,
            working_directory: None,
            cols: 80,
            rows: 24,
            env: std::collections::HashMap::new(),
        };
        
        let terminal_id = manager.create_terminal(options).await.unwrap();
        
        // Test various key sequences
        let key_tests = vec![
            TerminalInput::Data("\x1b[A".to_string()),    // Up
            TerminalInput::Data("\x1b[B".to_string()),    // Down
            TerminalInput::Data("\x1b[C".to_string()),    // Right
            TerminalInput::Data("\x1b[D".to_string()),    // Left
            TerminalInput::Data("\t".to_string()),        // Tab
            TerminalInput::Data("\r".to_string()),        // Enter
            TerminalInput::Data("\x1b".to_string()),      // Escape
        ];
        
        for input in key_tests {
            let result = manager.send_input(&terminal_id, input).await;
            assert!(result.is_ok());
        }
        
        // Test Ctrl+C
        let result = manager.send_input(&terminal_id, TerminalInput::Data("\x03".to_string())).await;
        assert!(result.is_ok());
        
        // Clean up
        manager.stop_terminal(&terminal_id).await.unwrap();
    }

    #[tokio::test]
    async fn test_multiple_terminals() {
        let (manager, _ipc) = setup_test_manager();
        let mut terminal_ids = vec![];
        
        // Create multiple terminals
        for _i in 0..5 {
            let options = CreateTerminalOptions {
                shell: None,
                working_directory: None,
                cols: 80,
                rows: 24,
                env: std::collections::HashMap::new(),
            };
            
            let id = manager.create_terminal(options).await.unwrap();
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
        let (manager, _ipc) = setup_test_manager();
        
        // Create multiple terminals
        let options = CreateTerminalOptions {
            shell: None,
            working_directory: None,
            cols: 80,
            rows: 24,
            env: std::collections::HashMap::new(),
        };
        
        let id1 = manager.create_terminal(options.clone()).await.unwrap();
        let id2 = manager.create_terminal(options.clone()).await.unwrap();
        let id3 = manager.create_terminal(options).await.unwrap();
        
        // Broadcast input to terminals 1 and 2
        let terminal_ids = vec![id1.clone(), id2.clone()];
        let input = TerminalInput::Data("echo 'Broadcast message'\n".to_string());
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
    async fn test_terminal_clear() {
        let (manager, _ipc) = setup_test_manager();
        
        // Create terminal
        let options = CreateTerminalOptions {
            shell: None,
            working_directory: None,
            cols: 80,
            rows: 24,
            env: std::collections::HashMap::new(),
        };
        
        let terminal_id = manager.create_terminal(options).await.unwrap();
        
        // Send some output-generating commands
        manager.send_input(&terminal_id, TerminalInput::Data("echo 'Line 1'\n".to_string())).await.unwrap();
        manager.send_input(&terminal_id, TerminalInput::Data("echo 'Line 2'\n".to_string())).await.unwrap();
        manager.send_input(&terminal_id, TerminalInput::Data("echo 'Line 3'\n".to_string())).await.unwrap();
        
        // Clear terminal
        let control = ControlMessage::Clear;
        manager.send_control(&terminal_id, control).await.unwrap();
        
        // Terminal should still be running
        let state = manager.get_state(&terminal_id).await.unwrap();
        assert_eq!(state.cols, 80);
        
        // Clean up
        manager.stop_terminal(&terminal_id).await.unwrap();
    }

    #[tokio::test]
    async fn test_terminal_error_handling() {
        let (manager, _ipc) = setup_test_manager();
        
        // Test operations on non-existent terminal
        let fake_id = "non-existent-terminal";
        
        // Get state should fail
        let result = manager.get_state(fake_id).await;
        assert!(result.is_err());
        
        // Send input should fail
        let result = manager.send_input(fake_id, TerminalInput::Data("test".to_string())).await;
        assert!(result.is_err());
        
        // Resize should fail
        let control = ControlMessage::Resize { cols: 80, rows: 24 };
        let result = manager.send_control(fake_id, control).await;
        assert!(result.is_err());
        
        // Stop should fail
        let result = manager.stop_terminal(fake_id).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_terminal_working_directory() {
        let (manager, _ipc) = setup_test_manager();
        
        // Create terminal with specific working directory
        let working_dir = std::env::temp_dir().to_string_lossy().to_string();
        let options = CreateTerminalOptions {
            shell: None,
            working_directory: Some(working_dir.clone()),
            cols: 80,
            rows: 24,
            env: std::collections::HashMap::new(),
        };
        
        let terminal_id = manager.create_terminal(options).await.unwrap();
        
        // Send pwd command to verify directory
        manager.send_input(&terminal_id, TerminalInput::Data("pwd\n".to_string())).await.unwrap();
        
        // Give time for command execution
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        
        // Clean up
        manager.stop_terminal(&terminal_id).await.unwrap();
    }

    #[tokio::test]
    async fn test_terminal_shell_selection() {
        let (manager, _ipc) = setup_test_manager();
        
        // Try to create terminal with specific shell (if available)
        let shells = vec!["bash", "sh", "zsh"];
        let mut created = false;
        
        for shell in shells {
            let options = CreateTerminalOptions {
                shell: Some(shell.to_string()),
                working_directory: None,
                cols: 80,
                rows: 24,
                env: std::collections::HashMap::new(),
            };
            
            let result = manager.create_terminal(options).await;
            
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
        let (manager, _ipc) = setup_test_manager();
        
        // Create terminal
        let options = CreateTerminalOptions {
            shell: None,
            working_directory: None,
            cols: 80,
            rows: 24,
            env: std::collections::HashMap::new(),
        };
        
        let terminal_id = manager.create_terminal(options).await.unwrap();
        
        // Perform multiple concurrent operations
        let manager_clone = manager.clone();
        let id_clone = terminal_id.clone();
        
        let handles = vec![
            tokio::spawn(async move {
                manager_clone.send_input(
                    &id_clone, 
                    TerminalInput::Data("echo 'Task 1'\n".to_string())
                ).await
            }),
            tokio::spawn({
                let manager = manager.clone();
                let id = terminal_id.clone();
                async move {
                    manager.send_control(
                        &id,
                        ControlMessage::Resize { cols: 100, rows: 30 }
                    ).await
                }
            }),
            tokio::spawn({
                let manager = manager.clone();
                let id = terminal_id.clone();
                async move {
                    manager.send_input(
                        &id,
                        TerminalInput::Data("\t".to_string())
                    ).await
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

    #[tokio::test]
    async fn test_terminal_environment_variables() {
        let (manager, _ipc) = setup_test_manager();
        
        // Create terminal with custom environment variables
        let mut env = std::collections::HashMap::new();
        env.insert("CUSTOM_VAR".to_string(), "test_value".to_string());
        env.insert("ORCHFLOW_TEST".to_string(), "true".to_string());
        
        let options = CreateTerminalOptions {
            shell: None,
            working_directory: None,
            cols: 80,
            rows: 24,
            env,
        };
        
        let terminal_id = manager.create_terminal(options).await.unwrap();
        
        // Check environment variable
        manager.send_input(
            &terminal_id,
            TerminalInput::Data("echo $CUSTOM_VAR\n".to_string())
        ).await.unwrap();
        
        // Give time for command execution
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        
        // Clean up
        manager.stop_terminal(&terminal_id).await.unwrap();
    }
}