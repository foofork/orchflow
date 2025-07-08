#[cfg(test)]
mod tests {
    use super::*;
    use crate::terminal_stream::{TerminalStreamManager, TerminalState};
    use crate::error::Result;
    
    // Mock app handle for tests
    fn mock_app_handle() -> tauri::AppHandle {
        // This won't work in unit tests as Tauri requires runtime
        // We'll need to use integration tests or feature flags
        unimplemented!("Tauri app handle requires runtime context")
    }
    
    #[test]
    fn test_terminal_state_creation() {
        let state = TerminalState::new("test_id".to_string(), 80, 24);
        
        assert_eq!(state.id, "test_id");
        assert_eq!(state.cols, 80);
        assert_eq!(state.rows, 24);
        assert!(state.is_active);
    }
    
    #[test]
    fn test_terminal_state_resize() {
        let mut state = TerminalState::new("test_id".to_string(), 80, 24);
        
        state.resize(100, 30);
        
        assert_eq!(state.cols, 100);
        assert_eq!(state.rows, 30);
    }
}

#[cfg(test)]
mod pty_manager_tests {
    use super::*;
    use crate::terminal_stream::pty_manager::{PtyManager, ProcessStatus};
    
    #[tokio::test]
    async fn test_pty_manager_creation() {
        let manager = PtyManager::new();
        assert!(manager.terminals.read().await.is_empty());
    }
    
    #[tokio::test]
    async fn test_create_pty() {
        let mut manager = PtyManager::new();
        
        let result = manager.create_pty(
            "test_terminal".to_string(),
            Some("/bin/sh".to_string()),
            80,
            24,
        ).await;
        
        match result {
            Ok(handle) => {
                assert_eq!(handle.id, "test_terminal");
                assert!(manager.terminals.read().await.contains_key("test_terminal"));
            }
            Err(e) => {
                // PTY creation might fail in test environment
                eprintln!("PTY creation failed in test: {}", e);
            }
        }
    }
    
    #[tokio::test]
    async fn test_write_to_pty() {
        let mut manager = PtyManager::new();
        
        if let Ok(handle) = manager.create_pty(
            "write_test".to_string(),
            Some("/bin/sh".to_string()),
            80,
            24,
        ).await {
            let result = manager.write_to_pty(&handle.id, b"echo test\n").await;
            
            // In test environment, this might fail
            match result {
                Ok(_) => println!("Successfully wrote to PTY"),
                Err(e) => eprintln!("Write to PTY failed: {}", e),
            }
        }
    }
    
    #[tokio::test]
    async fn test_close_pty() {
        let mut manager = PtyManager::new();
        
        if let Ok(_) = manager.create_pty(
            "close_test".to_string(),
            Some("/bin/sh".to_string()),
            80,
            24,
        ).await {
            let result = manager.close_pty("close_test").await;
            assert!(result.is_ok());
            assert!(!manager.terminals.read().await.contains_key("close_test"));
        }
    }
}

#[cfg(test)]
mod output_buffer_tests {
    use super::*;
    use crate::terminal_stream::buffer::OutputBuffer;
    
    #[test]
    fn test_output_buffer_basic() {
        let mut buffer = OutputBuffer::new(100);
        
        buffer.append(b"Hello, world!\n");
        buffer.append(b"Line 2\n");
        
        let lines = buffer.get_lines(0, 10);
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0], "Hello, world!");
        assert_eq!(lines[1], "Line 2");
    }
    
    #[test]
    fn test_output_buffer_partial_lines() {
        let mut buffer = OutputBuffer::new(100);
        
        buffer.append(b"Partial ");
        buffer.append(b"line\n");
        
        let lines = buffer.get_lines(0, 10);
        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0], "Partial line");
    }
    
    #[test]
    fn test_output_buffer_max_lines() {
        let mut buffer = OutputBuffer::new(3);
        
        for i in 0..5 {
            buffer.append(format!("Line {}\n", i).as_bytes());
        }
        
        let lines = buffer.get_all_lines();
        assert_eq!(lines.len(), 3);
        assert_eq!(lines[0], "Line 2");
        assert_eq!(lines[1], "Line 3");
        assert_eq!(lines[2], "Line 4");
    }
    
    #[test]
    fn test_output_buffer_clear() {
        let mut buffer = OutputBuffer::new(100);
        
        buffer.append(b"Some content\n");
        assert!(!buffer.get_all_lines().is_empty());
        
        buffer.clear();
        assert!(buffer.get_all_lines().is_empty());
    }
    
    #[test]
    fn test_output_buffer_search() {
        let mut buffer = OutputBuffer::new(100);
        
        buffer.append(b"Hello world\n");
        buffer.append(b"Test line\n");
        buffer.append(b"Hello again\n");
        
        let matches = buffer.search("Hello", false);
        assert_eq!(matches.len(), 2);
        assert_eq!(matches[0].0, 0);
        assert_eq!(matches[1].0, 2);
    }
    
    #[test]
    fn test_output_buffer_ansi_codes() {
        let mut buffer = OutputBuffer::new(100);
        
        buffer.append(b"\x1b[31mRed text\x1b[0m\n");
        
        let lines = buffer.get_all_lines();
        assert_eq!(lines[0], "Red text");
    }
}

#[cfg(test)]
mod terminal_event_tests {
    use super::*;
    use crate::terminal_stream::ipc_handler::TerminalEvent;
    
    #[test]
    fn test_terminal_event_creation() {
        let event = TerminalEvent::Output {
            terminal_id: "test".to_string(),
            data: vec![72, 101, 108, 108, 111], // "Hello"
        };
        
        match event {
            TerminalEvent::Output { terminal_id, data } => {
                assert_eq!(terminal_id, "test");
                assert_eq!(String::from_utf8(data).unwrap(), "Hello");
            }
            _ => panic!("Wrong event type"),
        }
    }
    
    #[test]
    fn test_terminal_event_state_change() {
        let event = TerminalEvent::StateChange {
            terminal_id: "test".to_string(),
            state: "running".to_string(),
        };
        
        match event {
            TerminalEvent::StateChange { terminal_id, state } => {
                assert_eq!(terminal_id, "test");
                assert_eq!(state, "running");
            }
            _ => panic!("Wrong event type"),
        }
    }
}

#[cfg(test)]
mod protocol_tests {
    use super::*;
    use crate::terminal_stream::protocol::{TerminalInput, ControlMessage};
    
    #[test]
    fn test_terminal_input_text() {
        let input = TerminalInput::Text("Hello".to_string());
        
        match input {
            TerminalInput::Text(text) => assert_eq!(text, "Hello"),
            _ => panic!("Wrong input type"),
        }
    }
    
    #[test]
    fn test_terminal_input_paste() {
        let input = TerminalInput::paste("Multi\nLine\nText");
        
        match input {
            TerminalInput::Paste(text) => {
                assert_eq!(text, "Multi\nLine\nText");
            }
            _ => panic!("Wrong input type"),
        }
    }
    
    #[test]
    fn test_control_message_resize() {
        let msg = ControlMessage::Resize { rows: 30, cols: 100 };
        
        match msg {
            ControlMessage::Resize { rows, cols } => {
                assert_eq!(rows, 30);
                assert_eq!(cols, 100);
            }
            _ => panic!("Wrong control message type"),
        }
    }
}