#[cfg(test)]
mod tests {
    use super::*;
    use crate::terminal_stream::{
        TerminalStreamManager, TerminalInput, CreateTerminalOptions,
        TerminalMode, CursorPosition,
    };
    use tokio::time::{sleep, Duration};
    
    #[tokio::test]
    async fn test_create_terminal() {
        let manager = TerminalStreamManager::new();
        
        let options = CreateTerminalOptions {
            shell: None,
            cwd: None,
            env: None,
            rows: 24,
            cols: 80,
        };
        
        let terminal_id = manager.create_terminal(options).await.unwrap();
        assert!(!terminal_id.is_empty());
        
        // Verify terminal exists
        let exists = manager.has_terminal(&terminal_id).await;
        assert!(exists);
    }
    
    #[tokio::test]
    async fn test_terminal_input_output() {
        let manager = TerminalStreamManager::new();
        
        let options = CreateTerminalOptions {
            shell: Some("sh".to_string()),
            cwd: None,
            env: None,
            rows: 24,
            cols: 80,
        };
        
        let terminal_id = manager.create_terminal(options).await.unwrap();
        
        // Send echo command
        let input = TerminalInput {
            data: "echo 'Hello, World!'\n".to_string(),
        };
        
        manager.send_input(&terminal_id, input).await.unwrap();
        
        // Give it time to process
        sleep(Duration::from_millis(100)).await;
        
        // Check buffer contains output
        let buffer = manager.get_buffer(&terminal_id).await.unwrap();
        assert!(buffer.contains("Hello, World!"));
    }
    
    #[tokio::test]
    async fn test_terminal_resize() {
        let manager = TerminalStreamManager::new();
        
        let options = CreateTerminalOptions {
            shell: None,
            cwd: None,
            env: None,
            rows: 24,
            cols: 80,
        };
        
        let terminal_id = manager.create_terminal(options).await.unwrap();
        
        // Resize terminal
        manager.resize_terminal(&terminal_id, 30, 100).await.unwrap();
        
        // Verify state updated
        let state = manager.get_terminal_state(&terminal_id).await.unwrap();
        assert_eq!(state.rows, 30);
        assert_eq!(state.cols, 100);
    }
    
    #[tokio::test]
    async fn test_terminal_close() {
        let manager = TerminalStreamManager::new();
        
        let options = CreateTerminalOptions {
            shell: None,
            cwd: None,
            env: None,
            rows: 24,
            cols: 80,
        };
        
        let terminal_id = manager.create_terminal(options).await.unwrap();
        
        // Close terminal
        manager.close_terminal(&terminal_id).await.unwrap();
        
        // Verify terminal removed
        let exists = manager.has_terminal(&terminal_id).await;
        assert!(!exists);
    }
    
    #[tokio::test]
    async fn test_multiple_terminals() {
        let manager = TerminalStreamManager::new();
        
        let options = CreateTerminalOptions {
            shell: None,
            cwd: None,
            env: None,
            rows: 24,
            cols: 80,
        };
        
        // Create multiple terminals
        let id1 = manager.create_terminal(options.clone()).await.unwrap();
        let id2 = manager.create_terminal(options.clone()).await.unwrap();
        let id3 = manager.create_terminal(options).await.unwrap();
        
        // Verify all exist
        assert!(manager.has_terminal(&id1).await);
        assert!(manager.has_terminal(&id2).await);
        assert!(manager.has_terminal(&id3).await);
        
        // List all terminals
        let terminals = manager.list_terminals().await;
        assert_eq!(terminals.len(), 3);
        assert!(terminals.contains(&id1));
        assert!(terminals.contains(&id2));
        assert!(terminals.contains(&id3));
    }
    
    #[tokio::test]
    async fn test_terminal_mode_change() {
        let manager = TerminalStreamManager::new();
        
        let options = CreateTerminalOptions {
            shell: None,
            cwd: None,
            env: None,
            rows: 24,
            cols: 80,
        };
        
        let terminal_id = manager.create_terminal(options).await.unwrap();
        
        // Change mode
        manager.set_terminal_mode(&terminal_id, TerminalMode::Insert).await.unwrap();
        
        let state = manager.get_terminal_state(&terminal_id).await.unwrap();
        assert_eq!(state.mode, TerminalMode::Insert);
    }
    
    #[tokio::test]
    async fn test_scrollback_buffer() {
        let manager = TerminalStreamManager::new();
        
        let options = CreateTerminalOptions {
            shell: Some("sh".to_string()),
            cwd: None,
            env: None,
            rows: 24,
            cols: 80,
        };
        
        let terminal_id = manager.create_terminal(options).await.unwrap();
        
        // Send multiple commands to fill buffer
        for i in 0..10 {
            let input = TerminalInput {
                data: format!("echo 'Line {}'\n", i),
            };
            manager.send_input(&terminal_id, input).await.unwrap();
            sleep(Duration::from_millis(50)).await;
        }
        
        // Check buffer contains all lines
        let buffer = manager.get_buffer(&terminal_id).await.unwrap();
        for i in 0..10 {
            assert!(buffer.contains(&format!("Line {}", i)));
        }
    }
    
    #[tokio::test]
    async fn test_process_info() {
        let manager = TerminalStreamManager::new();
        
        let options = CreateTerminalOptions {
            shell: Some("sh".to_string()),
            cwd: None,
            env: None,
            rows: 24,
            cols: 80,
        };
        
        let terminal_id = manager.create_terminal(options).await.unwrap();
        
        // Get process info
        let info = manager.get_terminal_process_info(&terminal_id).await.unwrap();
        assert!(info.pid > 0);
        assert_eq!(info.status, crate::terminal_stream::ProcessStatus::Running);
        assert!(!info.command.is_empty());
    }
    
    #[tokio::test]
    async fn test_terminal_health_check() {
        let manager = TerminalStreamManager::new();
        
        let options = CreateTerminalOptions {
            shell: None,
            cwd: None,
            env: None,
            rows: 24,
            cols: 80,
        };
        
        let terminal_id = manager.create_terminal(options).await.unwrap();
        
        // Check health
        let health = manager.check_terminal_health(&terminal_id).await.unwrap();
        assert!(health.is_healthy);
        assert!(health.uptime_seconds >= 0.0);
    }
    
    #[tokio::test]
    async fn test_broadcast_input() {
        let manager = TerminalStreamManager::new();
        
        let options = CreateTerminalOptions {
            shell: Some("sh".to_string()),
            cwd: None,
            env: None,
            rows: 24,
            cols: 80,
        };
        
        // Create multiple terminals
        let id1 = manager.create_terminal(options.clone()).await.unwrap();
        let id2 = manager.create_terminal(options).await.unwrap();
        
        // Broadcast input
        let input = TerminalInput {
            data: "echo 'Broadcast message'\n".to_string(),
        };
        
        manager.broadcast_input(vec![id1.clone(), id2.clone()], input).await.unwrap();
        
        // Give time to process
        sleep(Duration::from_millis(100)).await;
        
        // Check both buffers contain the message
        let buffer1 = manager.get_buffer(&id1).await.unwrap();
        let buffer2 = manager.get_buffer(&id2).await.unwrap();
        
        assert!(buffer1.contains("Broadcast message"));
        assert!(buffer2.contains("Broadcast message"));
    }
}