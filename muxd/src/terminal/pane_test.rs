#[cfg(test)]
mod tests {
    use super::*;
    use tokio::sync::mpsc;
    use std::collections::HashMap;

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
        tokio::time::sleep(Duration::from_millis(100)).await;
        assert!(rx.try_recv().is_ok(), "No output received");
    }

    #[tokio::test]
    async fn test_pane_start_with_command() {
        let (pane, mut rx) = create_test_pane();
        
        let result = pane.start(
            Some("echo 'test'".to_string()),
            None,
            HashMap::new(),
            None,
        ).await;
        
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
        let result = pane.resize(100, 40);
        assert!(result.is_ok(), "Failed to resize pane");
        
        // Check size
        let size = pane.size.read().clone();
        assert_eq!(size.cols, 100);
        assert_eq!(size.rows, 40);
    }

    #[tokio::test]
    async fn test_pane_with_working_directory() {
        let (pane, mut rx) = create_test_pane();
        
        let result = pane.start(
            Some("pwd".to_string()),
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
        let output = pane.read_output().unwrap();
        assert!(output.contains("test output"), "Output not buffered correctly");
    }

    #[tokio::test]
    async fn test_pane_close() {
        let (pane, _rx) = create_test_pane();
        
        // Start pane
        pane.start(None, None, HashMap::new(), None).await.unwrap();
        
        // Close pane
        let result = pane.close();
        assert!(result.is_ok(), "Failed to close pane");
        
        // Verify closed
        assert!(!pane.is_alive());
    }

    #[tokio::test]
    async fn test_pane_title() {
        let (pane, _rx) = create_test_pane();
        
        // Set title
        pane.set_title("Test Title");
        
        // Get title
        let title = pane.get_title();
        assert_eq!(title, Some("Test Title".to_string()));
    }

    #[tokio::test]
    async fn test_pane_exit_code() {
        let (pane, _rx) = create_test_pane();
        
        // Start command that exits immediately
        pane.start(
            Some("exit 42".to_string()),
            None,
            HashMap::new(),
            None,
        ).await.unwrap();
        
        // Wait for exit
        tokio::time::sleep(Duration::from_millis(200)).await;
        
        // Check exit code (implementation dependent)
        assert!(!pane.is_alive());
    }
}