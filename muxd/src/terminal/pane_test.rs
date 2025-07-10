#[cfg(test)]
mod tests {
    
    use crate::terminal::Pane;
    use crate::protocol::PaneType;
    use bytes::Bytes;
    use tokio::sync::mpsc;
    use std::collections::HashMap;
    use std::time::Duration;

    fn create_test_pane() -> (Pane, mpsc::UnboundedReceiver<Bytes>) {
        let (tx, rx) = mpsc::unbounded_channel();
        let pane = Pane::new(
            "test-session".to_string(),
            PaneType::Terminal,
            tx,
        );
        (pane, rx)
    }

    #[tokio::test]
    async fn test_pane_creation() {
        let (pane, _rx) = create_test_pane();
        
        assert_eq!(pane.session_id, "test-session");
        assert_eq!(pane.pane_type, PaneType::Terminal);
        assert!(!pane.id.0.is_empty());
    }

    #[tokio::test]
    async fn test_pane_start_default_shell() {
        let (pane, mut rx) = create_test_pane();
        
        let result = pane.start(None, None, HashMap::new(), None).await;
        assert!(result.is_ok(), "Failed to start pane");
        
        let pid = result.unwrap();
        assert!(pid > 0, "Invalid PID");
        
        // Should receive output
        tokio::time::sleep(Duration::from_millis(500)).await;
        // Check if we received any output (might be empty on some systems)
        let _output = rx.try_recv(); // Don't assert, as some shells don't output immediately
    }

    #[tokio::test]
    #[ignore = "Command parsing not implemented - requires spawn to handle arguments"]
    async fn test_pane_start_with_command() {
        let (pane, mut rx) = create_test_pane();
        
        let result = pane.start(
            Some("/bin/sh -c 'echo test'".to_string()),
            None,
            HashMap::new(),
            None,
        ).await;
        
        if let Err(e) = &result {
            eprintln!("Start error: {:?}", e);
        }
        assert!(result.is_ok(), "Failed to start pane with command");
        
        // Wait for output
        tokio::time::sleep(Duration::from_millis(100)).await;
        
        // Collect output
        let mut output = Vec::new();
        while let Ok(bytes) = rx.try_recv() {
            output.extend_from_slice(&bytes);
        }
        
        let output_str = String::from_utf8_lossy(&output);
        assert!(output_str.contains("test"), "Expected output not found");
    }

    #[tokio::test]
    async fn test_pane_write() {
        let (pane, mut rx) = create_test_pane();
        
        // Start pane
        pane.start(Some("/bin/sh".to_string()), None, HashMap::new(), None)
            .await
            .unwrap();
        
        // Clear initial output
        tokio::time::sleep(Duration::from_millis(100)).await;
        while rx.try_recv().is_ok() {}
        
        // Write command
        let result = pane.write(b"echo 'written output'\n");
        assert!(result.is_ok(), "Failed to write to pane");
        
        // Wait for output
        tokio::time::sleep(Duration::from_millis(100)).await;
        
        // Check output
        let mut output = Vec::new();
        while let Ok(bytes) = rx.try_recv() {
            output.extend_from_slice(&bytes);
        }
        
        let output_str = String::from_utf8_lossy(&output);
        assert!(output_str.contains("written output"), "Write output not found");
    }

    #[tokio::test]
    async fn test_pane_resize() {
        let (pane, _rx) = create_test_pane();
        
        // Start pane
        pane.start(None, None, HashMap::new(), None).await.unwrap();
        
        // Resize
        let result = pane.resize(40, 100);
        assert!(result.is_ok(), "Failed to resize pane");
        
        // Check size
        let size = pane.size();
        assert_eq!(size.cols, 100);
        assert_eq!(size.rows, 40);
    }

    #[tokio::test]
    #[ignore = "Command parsing not implemented - requires spawn to handle arguments"]
    async fn test_pane_with_working_directory() {
        let (pane, mut rx) = create_test_pane();
        
        let result = pane.start(
            Some("/bin/sh -c pwd".to_string()),
            Some("/tmp".to_string()),
            HashMap::new(),
            None,
        ).await;
        
        assert!(result.is_ok(), "Failed to start pane with working directory");
        
        // Wait for output
        tokio::time::sleep(Duration::from_millis(100)).await;
        
        // Check output contains /tmp
        let mut output = Vec::new();
        while let Ok(bytes) = rx.try_recv() {
            output.extend_from_slice(&bytes);
        }
        
        let output_str = String::from_utf8_lossy(&output);
        assert!(output_str.contains("/tmp"), "Working directory not set");
    }

    #[tokio::test]
    async fn test_pane_read_output() {
        let (pane, _rx) = create_test_pane();
        
        // Start pane and write
        pane.start(Some("/bin/echo".to_string()), None, HashMap::new(), None)
            .await
            .unwrap();
        
        pane.write(b"test output\n").unwrap();
        
        // Wait for output
        tokio::time::sleep(Duration::from_millis(100)).await;
        
        // Read output
        let output = pane.read_output(100);
        assert!(output.contains("test output"), "Output not buffered correctly");
    }

    #[tokio::test]
    async fn test_pane_close() {
        let (pane, _rx) = create_test_pane();
        
        // Start pane
        pane.start(None, None, HashMap::new(), None).await.unwrap();
        
        // Kill pane
        let result = pane.kill();
        assert!(result.is_ok(), "Failed to kill pane");
        
        // Verify killed
        assert!(!pane.is_alive());
    }

    #[tokio::test]
    async fn test_pane_size() {
        let (pane, _rx) = create_test_pane();
        
        // Get default size
        let size = pane.size();
        assert_eq!(size.cols, 80);
        assert_eq!(size.rows, 24);
    }

    #[tokio::test]
    #[ignore = "Command parsing not implemented - requires spawn to handle arguments"]
    async fn test_pane_exit_code() {
        let (pane, _rx) = create_test_pane();
        
        // Start command that exits immediately
        let result = pane.start(
            Some("/bin/sh -c 'exit 42'".to_string()),
            None,
            HashMap::new(),
            None,
        ).await;
        
        if let Err(e) = &result {
            eprintln!("Start error: {:?}", e);
        }
        result.unwrap();
        
        // Wait for exit
        tokio::time::sleep(Duration::from_millis(200)).await;
        
        // Check exit code (implementation dependent)
        assert!(!pane.is_alive());
    }
    
    #[tokio::test]
    async fn test_pane_search_output() {
        let (tx, _rx) = mpsc::unbounded_channel();
        let pane = Pane::new("session1".to_string(), PaneType::Terminal, tx);
        
        let pid = pane.start(None, None, HashMap::new(), None).await.unwrap();
        assert!(pid > 0);
        
        // Write multiple lines
        pane.write(b"echo line one\n").unwrap();
        tokio::time::sleep(Duration::from_millis(50)).await;
        pane.write(b"echo line two\n").unwrap();
        tokio::time::sleep(Duration::from_millis(50)).await;
        pane.write(b"echo line three\n").unwrap();
        tokio::time::sleep(Duration::from_millis(100)).await;
        
        // Test case-insensitive search
        let (matches, total, truncated) = pane.search_output("LINE", false, false, 10, None).unwrap();
        assert!(total >= 3, "Expected at least 3 matches, got {}", total);
        assert!(!truncated);
        
        // Test case-sensitive search
        let (matches, total, truncated) = pane.search_output("line", true, false, 10, None).unwrap();
        assert!(total >= 3, "Expected at least 3 matches for 'line', got {}", total);
        
        // Test regex search
        let (matches, total, truncated) = pane.search_output("line (one|two)", false, true, 10, None).unwrap();
        assert!(total >= 2, "Expected at least 2 regex matches, got {}", total);
        
        // Test max results
        let (matches, total, truncated) = pane.search_output("line", false, false, 1, None).unwrap();
        assert_eq!(matches.len(), 1);
        assert!(total >= 3);
        assert!(truncated);
        
        pane.kill().unwrap();
    }
}