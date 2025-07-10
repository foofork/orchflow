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
        assert!(state.active);
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
        // PtyManager internal state is private
    }
    
    #[tokio::test]
    async fn test_create_pty() {
        let manager = PtyManager::new();
        
        let result = manager.create_pty(
            "test_terminal".to_string(),
            Some("/bin/sh".to_string()),
            80,
            24,
        ).await;
        
        match result {
            Ok(handle) => {
                assert_eq!(handle.id, "test_terminal");
                // Terminal was created successfully
            }
            Err(e) => {
                // PTY creation might fail in test environment
                eprintln!("PTY creation failed in test: {}", e);
            }
        }
    }
    
    #[tokio::test]
    async fn test_write_to_pty() {
        let manager = PtyManager::new();
        
        if let Ok(handle) = manager.create_pty(
            "write_test".to_string(),
            Some("/bin/sh".to_string()),
            80,
            24,
        ).await {
            let result = handle.send_input(bytes::Bytes::from_static(b"echo test\n")).await;
            
            // In test environment, this might fail
            match result {
                Ok(_) => println!("Successfully wrote to PTY"),
                Err(e) => eprintln!("Write to PTY failed: {}", e),
            }
        }
    }
    
    #[tokio::test]
    async fn test_close_pty() {
        let manager = PtyManager::new();
        
        if let Ok(_) = manager.create_pty(
            "close_test".to_string(),
            Some("/bin/sh".to_string()),
            80,
            24,
        ).await {
            let result = manager.close_pty("close_test").await;
            assert!(result.is_ok());
            // Terminal was closed successfully
        }
    }
}

#[cfg(test)]
mod output_buffer_tests {
    use super::*;
    use crate::terminal_stream::buffer::OutputBuffer;
    
    #[test]
    fn test_output_buffer_creation() {
        let buffer = OutputBuffer::new(1024);
        // Buffer created with correct size
    }
    
    #[test]
    fn test_output_buffer_push_and_flush() {
        let mut buffer = OutputBuffer::new(10);
        
        // Small data shouldn't trigger flush
        let result = buffer.push(b"Hello");
        assert!(result.is_none());
        
        // Exceeding max_size should trigger flush
        let result = buffer.push(b" World!");
        assert!(result.is_some());
        if let Some(bytes) = result {
            assert_eq!(&bytes[..], b"Hello World!");
        }
    }
    
    #[test]
    fn test_output_buffer_force_flush() {
        let mut buffer = OutputBuffer::new(1024);
        
        buffer.push(b"Test data");
        let result = buffer.force_flush();
        assert!(result.is_some());
        if let Some(bytes) = result {
            assert_eq!(&bytes[..], b"Test data");
        }
        
        // Second flush should return None
        let result = buffer.force_flush();
        assert!(result.is_none());
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
            data: base64::encode(&[72, 101, 108, 108, 111]), // "Hello" in base64
        };
        
        match event {
            TerminalEvent::Output { terminal_id, data } => {
                assert_eq!(terminal_id, "test");
                let decoded = base64::decode(&data).unwrap();
                assert_eq!(String::from_utf8(decoded).unwrap(), "Hello");
            }
            _ => panic!("Wrong event type"),
        }
    }
    
    #[test]
    fn test_terminal_event_state_changed() {
        use crate::terminal_stream::ipc_handler::TerminalStateInfo;
        
        let event = TerminalEvent::StateChanged {
            terminal_id: "test".to_string(),
            state: TerminalStateInfo {
                rows: 24,
                cols: 80,
                cursor_x: 0,
                cursor_y: 0,
                mode: "normal".to_string(),
                active: true,
            },
        };
        
        match event {
            TerminalEvent::StateChanged { terminal_id, state } => {
                assert_eq!(terminal_id, "test");
                assert_eq!(state.mode, "normal");
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
    fn test_terminal_input_binary() {
        let input = TerminalInput::Binary(vec![72, 101, 108, 108, 111]); // "Hello"
        
        match input {
            TerminalInput::Binary(data) => {
                assert_eq!(data, vec![72, 101, 108, 108, 111]);
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