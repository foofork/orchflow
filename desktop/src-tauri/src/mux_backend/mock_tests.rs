#[cfg(test)]
mod mock_backend_tests {
    use crate::mux_backend::{MockBackend, MuxBackend, MuxError, SplitType, PaneSize};
    
    #[tokio::test]
    async fn test_session_lifecycle() {
        let backend = MockBackend::new();
        
        // Create session
        let session_id = backend.create_session("test-session").await.unwrap();
        assert!(session_id.contains("test-session"));
        
        // List sessions
        let sessions = backend.list_sessions().await.unwrap();
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].name, "test-session");
        assert!(!sessions[0].attached);
        
        // Attach to session
        backend.attach_session(&session_id).await.unwrap();
        let sessions = backend.list_sessions().await.unwrap();
        assert!(sessions[0].attached);
        
        // Detach from session
        backend.detach_session(&session_id).await.unwrap();
        let sessions = backend.list_sessions().await.unwrap();
        assert!(!sessions[0].attached);
        
        // Kill session
        backend.kill_session(&session_id).await.unwrap();
        let sessions = backend.list_sessions().await.unwrap();
        assert_eq!(sessions.len(), 0);
    }
    
    #[tokio::test]
    async fn test_pane_lifecycle() {
        let backend = MockBackend::new();
        
        // Create session first
        let session_id = backend.create_session("test").await.unwrap();
        
        // Create panes
        let pane1 = backend.create_pane(&session_id, SplitType::None).await.unwrap();
        let pane2 = backend.create_pane(&session_id, SplitType::Horizontal).await.unwrap();
        let _pane3 = backend.create_pane(&session_id, SplitType::Vertical).await.unwrap();
        
        // List panes
        let panes = backend.list_panes(&session_id).await.unwrap();
        assert_eq!(panes.len(), 3);
        
        // Select pane
        backend.select_pane(&pane2).await.unwrap();
        let panes = backend.list_panes(&session_id).await.unwrap();
        assert!(panes.iter().find(|p| p.id == pane2).unwrap().active);
        assert!(!panes.iter().find(|p| p.id == pane1).unwrap().active);
        
        // Resize pane
        let new_size = PaneSize { width: 120, height: 40 };
        backend.resize_pane(&pane1, new_size).await.unwrap();
        let panes = backend.list_panes(&session_id).await.unwrap();
        let resized_pane = panes.iter().find(|p| p.id == pane1).unwrap();
        assert_eq!(resized_pane.size.width, 120);
        assert_eq!(resized_pane.size.height, 40);
        
        // Kill pane
        backend.kill_pane(&pane2).await.unwrap();
        let panes = backend.list_panes(&session_id).await.unwrap();
        assert_eq!(panes.len(), 2);
        
        // Clean up
        backend.kill_session(&session_id).await.unwrap();
    }
    
    #[tokio::test]
    async fn test_command_execution_and_capture() {
        let backend = MockBackend::new();
        
        let session_id = backend.create_session("cmd-test").await.unwrap();
        let pane_id = backend.create_pane(&session_id, SplitType::None).await.unwrap();
        
        // Test echo command
        backend.send_keys(&pane_id, "echo hello world").await.unwrap();
        let output = backend.capture_pane(&pane_id).await.unwrap();
        assert!(output.contains("$ echo hello world"));
        assert!(output.contains("hello world"));
        
        // Test pwd command
        backend.send_keys(&pane_id, "pwd").await.unwrap();
        let output = backend.capture_pane(&pane_id).await.unwrap();
        assert!(output.contains("$ pwd"));
        assert!(output.contains("/mock/working/directory"));
        
        // Test ls command
        backend.send_keys(&pane_id, "ls").await.unwrap();
        let output = backend.capture_pane(&pane_id).await.unwrap();
        assert!(output.contains("$ ls"));
        assert!(output.contains("file1.txt"));
        assert!(output.contains("directory/"));
        
        // Verify command history
        let history = backend.get_command_history().await;
        assert_eq!(history.len(), 3);
        assert_eq!(history[0].1, "echo hello world");
        assert_eq!(history[1].1, "pwd");
        assert_eq!(history[2].1, "ls");
        
        backend.kill_session(&session_id).await.unwrap();
    }
    
    #[tokio::test]
    async fn test_error_conditions() {
        let backend = MockBackend::new();
        
        // Test empty session name
        let result = backend.create_session("").await;
        assert!(matches!(result, Err(MuxError::InvalidState(_))));
        
        // Test duplicate session
        backend.create_session("dup").await.unwrap();
        let result = backend.create_session("dup").await;
        assert!(matches!(result, Err(MuxError::SessionCreationFailed(_))));
        
        // Test non-existent session
        let result = backend.create_pane("non-existent", SplitType::None).await;
        assert!(matches!(result, Err(MuxError::SessionNotFound(_))));
        
        // Test non-existent pane
        let result = backend.send_keys("non-existent-pane", "test").await;
        assert!(matches!(result, Err(MuxError::PaneNotFound(_))));
        
        // Test invalid resize
        let session_id = backend.create_session("resize-test").await.unwrap();
        let pane_id = backend.create_pane(&session_id, SplitType::None).await.unwrap();
        let result = backend.resize_pane(&pane_id, PaneSize { width: 0, height: 0 }).await;
        assert!(matches!(result, Err(MuxError::InvalidState(_))));
        
        backend.kill_session(&session_id).await.unwrap();
    }
    
    #[tokio::test]
    async fn test_fail_mode() {
        let backend = MockBackend::new();
        
        // Normal operation
        let session_id = backend.create_session("normal").await.unwrap();
        assert!(backend.list_sessions().await.is_ok());
        
        // Enable fail mode
        backend.set_fail_mode(true).await;
        
        // All operations should fail
        assert!(backend.create_session("fail").await.is_err());
        assert!(backend.list_sessions().await.is_err());
        assert!(backend.create_pane(&session_id, SplitType::None).await.is_err());
        assert!(backend.kill_session(&session_id).await.is_err());
        
        // Disable fail mode
        backend.set_fail_mode(false).await;
        
        // Operations should work again
        assert!(backend.list_sessions().await.is_ok());
        backend.kill_session(&session_id).await.unwrap();
    }
    
    #[tokio::test]
    async fn test_custom_output() {
        let backend = MockBackend::new();
        
        let session_id = backend.create_session("output-test").await.unwrap();
        let pane_id = backend.create_pane(&session_id, SplitType::None).await.unwrap();
        
        // Set custom output
        backend.set_pane_output(&pane_id, "Custom test output\nLine 2\nLine 3").await.unwrap();
        
        // Capture should return custom output
        let output = backend.capture_pane(&pane_id).await.unwrap();
        assert_eq!(output, "Custom test output\nLine 2\nLine 3");
        
        backend.kill_session(&session_id).await.unwrap();
    }
    
    #[tokio::test]
    async fn test_session_pane_cleanup() {
        let backend = MockBackend::new();
        
        // Create session with multiple panes
        let session_id = backend.create_session("cleanup-test").await.unwrap();
        let pane1 = backend.create_pane(&session_id, SplitType::None).await.unwrap();
        let pane2 = backend.create_pane(&session_id, SplitType::None).await.unwrap();
        let pane3 = backend.create_pane(&session_id, SplitType::None).await.unwrap();
        
        // Verify all panes exist
        let panes = backend.list_panes(&session_id).await.unwrap();
        assert_eq!(panes.len(), 3);
        
        // Kill session should remove all panes
        backend.kill_session(&session_id).await.unwrap();
        
        // Panes should no longer be accessible
        assert!(backend.send_keys(&pane1, "test").await.is_err());
        assert!(backend.send_keys(&pane2, "test").await.is_err());
        assert!(backend.send_keys(&pane3, "test").await.is_err());
    }
    
    #[tokio::test]
    async fn test_clear_functionality() {
        let backend = MockBackend::new();
        
        // Create some data
        backend.create_session("sess1").await.unwrap();
        backend.create_session("sess2").await.unwrap();
        let session_id = backend.create_session("sess3").await.unwrap();
        backend.create_pane(&session_id, SplitType::None).await.unwrap();
        
        // Verify data exists
        assert_eq!(backend.list_sessions().await.unwrap().len(), 3);
        assert_eq!(backend.list_panes(&session_id).await.unwrap().len(), 1);
        
        // Clear all data
        backend.clear().await;
        
        // Verify everything is cleared
        assert_eq!(backend.list_sessions().await.unwrap().len(), 0);
        assert!(backend.list_panes(&session_id).await.is_err());
    }
}