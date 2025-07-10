#[cfg(test)]
mod tmux_integration_tests {
    use crate::mux_backend::{MuxBackend, SplitType, PaneSize};
    use crate::mux_backend::tmux_backend::TmuxBackend;
    use std::process::Command;
    
    /// Check if tmux is available on the system
    fn tmux_available() -> bool {
        Command::new("tmux")
            .arg("-V")
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false)
    }
    
    /// Kill all test sessions before and after tests
    async fn cleanup_test_sessions() {
        if !tmux_available() {
            return;
        }
        
        // Kill any sessions that start with "test-"
        let _ = Command::new("tmux")
            .args(&["ls", "-F", "#{session_name}"])
            .output()
            .map(|output| {
                if output.status.success() {
                    let sessions = String::from_utf8_lossy(&output.stdout);
                    for session in sessions.lines() {
                        if session.starts_with("test-") {
                            let _ = Command::new("tmux")
                                .args(&["kill-session", "-t", session])
                                .output();
                        }
                    }
                }
            });
    }
    
    #[tokio::test]
    async fn test_tmux_session_lifecycle() {
        if !tmux_available() {
            eprintln!("Skipping test: tmux not available");
            return;
        }
        
        cleanup_test_sessions().await;
        let backend = TmuxBackend::new();
        
        // Create session
        let session_name = format!("test-session-{}", uuid::Uuid::new_v4());
        let session_id = backend.create_session(&session_name).await
            .expect("Failed to create session");
        assert_eq!(session_id, session_name);
        
        // List sessions
        let sessions = backend.list_sessions().await
            .expect("Failed to list sessions");
        assert!(sessions.iter().any(|s| s.name == session_name));
        
        // Kill session
        backend.kill_session(&session_id).await
            .expect("Failed to kill session");
        
        // Verify session is gone
        let sessions = backend.list_sessions().await
            .expect("Failed to list sessions after kill");
        assert!(!sessions.iter().any(|s| s.name == session_name));
        
        cleanup_test_sessions().await;
    }
    
    #[tokio::test]
    async fn test_tmux_pane_operations() {
        if !tmux_available() {
            eprintln!("Skipping test: tmux not available");
            return;
        }
        
        cleanup_test_sessions().await;
        let backend = TmuxBackend::new();
        
        // Create session
        let session_name = format!("test-pane-{}", uuid::Uuid::new_v4());
        let session_id = backend.create_session(&session_name).await
            .expect("Failed to create session");
        
        // Create pane
        let pane_id = backend.create_pane(&session_id, SplitType::None).await
            .expect("Failed to create pane");
        assert!(pane_id.starts_with("%"));
        
        // Send keys
        backend.send_keys(&pane_id, "echo 'Hello from tmux test'").await
            .expect("Failed to send keys");
        backend.send_keys(&pane_id, "Enter").await
            .expect("Failed to send Enter");
        
        // Wait a bit for command to execute
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        
        // Capture output
        let output = backend.capture_pane(&pane_id).await
            .expect("Failed to capture pane");
        assert!(output.contains("Hello from tmux test") || output.contains("echo"));
        
        // List panes
        let panes = backend.list_panes(&session_id).await
            .expect("Failed to list panes");
        assert!(panes.len() >= 1);
        assert!(panes.iter().any(|p| p.id == pane_id));
        
        // Resize pane
        let new_size = PaneSize { width: 100, height: 30 };
        backend.resize_pane(&pane_id, new_size).await
            .expect("Failed to resize pane");
        
        // Kill pane
        backend.kill_pane(&pane_id).await
            .expect("Failed to kill pane");
        
        // Clean up
        backend.kill_session(&session_id).await
            .expect("Failed to kill session");
        
        cleanup_test_sessions().await;
    }
    
    #[tokio::test]
    async fn test_tmux_multiple_panes() {
        if !tmux_available() {
            eprintln!("Skipping test: tmux not available");
            return;
        }
        
        cleanup_test_sessions().await;
        let backend = TmuxBackend::new();
        
        let session_name = format!("test-multi-{}", uuid::Uuid::new_v4());
        let session_id = backend.create_session(&session_name).await
            .expect("Failed to create session");
        
        // Create multiple panes
        let pane1 = backend.create_pane(&session_id, SplitType::None).await
            .expect("Failed to create pane 1");
        let pane2 = backend.create_pane(&session_id, SplitType::Horizontal).await
            .expect("Failed to create pane 2");
        let pane3 = backend.create_pane(&session_id, SplitType::Vertical).await
            .expect("Failed to create pane 3");
        
        // List panes
        let panes = backend.list_panes(&session_id).await
            .expect("Failed to list panes");
        assert!(panes.len() >= 3);
        
        // Select different panes
        backend.select_pane(&pane2).await
            .expect("Failed to select pane 2");
        
        // Send commands to different panes
        backend.send_keys(&pane1, "echo 'Pane 1'").await.unwrap();
        backend.send_keys(&pane2, "echo 'Pane 2'").await.unwrap();
        backend.send_keys(&pane3, "echo 'Pane 3'").await.unwrap();
        
        // Clean up
        backend.kill_session(&session_id).await
            .expect("Failed to kill session");
        
        cleanup_test_sessions().await;
    }
    
    #[tokio::test]
    async fn test_tmux_error_handling() {
        if !tmux_available() {
            eprintln!("Skipping test: tmux not available");
            return;
        }
        
        cleanup_test_sessions().await;
        let backend = TmuxBackend::new();
        
        // Try to create pane in non-existent session
        let result = backend.create_pane("non-existent-session", SplitType::None).await;
        assert!(result.is_err());
        
        // Try to send keys to non-existent pane
        let result = backend.send_keys("%999", "test").await;
        assert!(result.is_err());
        
        // Try to kill non-existent session
        let result = backend.kill_session("non-existent-session").await;
        assert!(result.is_err());
        
        // Try to resize non-existent pane
        let result = backend.resize_pane("%999", PaneSize { width: 80, height: 24 }).await;
        assert!(result.is_err());
        
        cleanup_test_sessions().await;
    }
    
    #[tokio::test]
    async fn test_tmux_session_attach_detach() {
        if !tmux_available() {
            eprintln!("Skipping test: tmux not available");
            return;
        }
        
        cleanup_test_sessions().await;
        let backend = TmuxBackend::new();
        
        let session_name = format!("test-attach-{}", uuid::Uuid::new_v4());
        let session_id = backend.create_session(&session_name).await
            .expect("Failed to create session");
        
        // Note: attach/detach in non-interactive mode might not work as expected
        // but we can test that the commands don't panic
        
        // Detach (should work even if not attached)
        let detach_result = backend.detach_session(&session_id).await;
        // This might fail if no clients attached, which is ok
        let _ = detach_result;
        
        // Clean up
        backend.kill_session(&session_id).await
            .expect("Failed to kill session");
        
        cleanup_test_sessions().await;
    }
    
    #[tokio::test]
    async fn test_tmux_concurrent_operations() {
        if !tmux_available() {
            eprintln!("Skipping test: tmux not available");
            return;
        }
        
        cleanup_test_sessions().await;
        let backend = TmuxBackend::new();
        
        // Create multiple sessions concurrently
        let mut handles = vec![];
        
        for i in 0..3 {
            let backend_clone = TmuxBackend::new();
            let handle = tokio::spawn(async move {
                let session_name = format!("test-concurrent-{}-{}", i, uuid::Uuid::new_v4());
                backend_clone.create_session(&session_name).await
            });
            handles.push(handle);
        }
        
        // Wait for all to complete
        let mut created_sessions = vec![];
        for handle in handles {
            if let Ok(Ok(session_id)) = handle.await {
                created_sessions.push(session_id);
            }
        }
        
        // Verify all sessions were created
        assert!(created_sessions.len() >= 2); // At least 2 should succeed
        
        // Clean up
        for session_id in created_sessions {
            let _ = backend.kill_session(&session_id).await;
        }
        
        cleanup_test_sessions().await;
    }
}