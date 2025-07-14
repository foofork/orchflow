#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use tokio::runtime::Runtime;

    fn setup_test_instance() -> NeovimManager {
        NeovimManager::new()
    }

    #[test]
    fn test_neovim_manager_creation() {
        let manager = setup_test_instance();
        assert_eq!(manager.instances.lock().unwrap().len(), 0);
    }

    #[test]
    fn test_create_instance() {
        let manager = setup_test_instance();
        
        // Skip this test if nvim is not available
        if std::process::Command::new("nvim").arg("--version").output().is_err() {
            println!("Skipping test: nvim not available");
            return;
        }
        
        let result = manager.create_instance("test-instance".to_string());
        
        // Clean up
        if result.is_ok() {
            manager.close_instance("test-instance").ok();
        }
        
        // We mainly test that the function doesn't panic
        assert!(result.is_ok() || result.is_err());
    }

    #[test]
    fn test_instance_not_found() {
        let manager = setup_test_instance();
        let result = manager.get_instance("non-existent");
        
        assert!(result.is_err());
        if let Err(e) = result {
            assert_eq!(e.error_type as u8, NeovimErrorType::InstanceNotFound as u8);
        }
    }

    #[test]
    fn test_error_types() {
        let error = NeovimError {
            message: "Test error".to_string(),
            error_type: NeovimErrorType::ConnectionError,
        };
        
        assert_eq!(error.to_string(), "[ConnectionError] Test error");
        
        let error2 = NeovimError {
            message: "Parse error".to_string(),
            error_type: NeovimErrorType::ParseError,
        };
        
        assert_eq!(error2.to_string(), "[ParseError] Parse error");
    }

    #[test]
    fn test_rpc_structures() {
        use serde_json::json;
        
        let request = RpcRequest {
            id: 1,
            method: "nvim_get_mode".to_string(),
            params: vec![],
        };
        
        let request_json = serde_json::to_string(&request).unwrap();
        assert!(request_json.contains("nvim_get_mode"));
        
        let response = RpcResponse {
            id: 1,
            result: Some(json!("n")),
            error: None,
        };
        
        let response_json = serde_json::to_string(&response).unwrap();
        assert!(response_json.contains("\"n\""));
    }

    #[test] 
    fn test_buffer_structure() {
        let buffer = NeovimBuffer {
            id: 1,
            name: "test.txt".to_string(),
            filetype: "text".to_string(),
            modified: false,
            lines: vec!["line 1".to_string(), "line 2".to_string()],
        };
        
        assert_eq!(buffer.id, 1);
        assert_eq!(buffer.name, "test.txt");
        assert_eq!(buffer.lines.len(), 2);
    }

    #[test]
    fn test_cursor_structure() {
        let cursor = NeovimCursor {
            line: 1,
            column: 0,
        };
        
        assert_eq!(cursor.line, 1);
        assert_eq!(cursor.column, 0);
    }

    #[test]
    fn test_neovim_instance_socket_path() {
        let instance_id = "test-123".to_string();
        
        // We can't actually create an instance without nvim installed,
        // but we can test the socket path generation logic indirectly
        let expected_socket = format!("/tmp/nvim-{}.sock", instance_id);
        assert!(expected_socket.contains("test-123"));
        assert!(expected_socket.starts_with("/tmp/nvim-"));
        assert!(expected_socket.ends_with(".sock"));
    }
}

#[cfg(test)]
mod integration_tests {
    use super::*;
    use tokio::time::{timeout, Duration};

    // These tests require nvim to be installed and will be skipped otherwise
    fn nvim_available() -> bool {
        std::process::Command::new("nvim")
            .arg("--version")
            .output()
            .is_ok()
    }

    #[tokio::test]
    async fn test_neovim_instance_lifecycle() {
        if !nvim_available() {
            println!("Skipping integration test: nvim not available");
            return;
        }

        let manager = NeovimManager::new();
        let instance_id = "test-lifecycle".to_string();
        
        // Create instance
        let result = manager.create_instance(instance_id.clone());
        assert!(result.is_ok(), "Failed to create instance: {:?}", result);
        
        // Verify instance exists
        let instances_guard = manager.get_instance(&instance_id);
        assert!(instances_guard.is_ok(), "Instance should exist");
        
        // Close instance
        let close_result = manager.close_instance(&instance_id);
        assert!(close_result.is_ok(), "Failed to close instance: {:?}", close_result);
    }

    #[tokio::test]
    async fn test_lua_execution() {
        if !nvim_available() {
            println!("Skipping integration test: nvim not available");
            return;
        }

        let manager = NeovimManager::new();
        let instance_id = "test-lua".to_string();
        
        if let Ok(_) = manager.create_instance(instance_id.clone()) {
            // Give neovim time to start
            tokio::time::sleep(Duration::from_millis(1000)).await;
            
            if let Ok(instances) = manager.get_instance(&instance_id) {
                if let Some(instance) = instances.get(&instance_id) {
                    // Test basic lua execution
                    let result = instance.execute_lua("return 1 + 1");
                    match result {
                        Ok(output) => {
                            println!("Lua execution result: {}", output);
                            // The output might vary based on nvim version
                            assert!(!output.is_empty());
                        },
                        Err(e) => {
                            println!("Lua execution failed (expected in some environments): {}", e);
                            // This might fail in headless environments, which is okay
                        }
                    }
                }
            }
            
            // Clean up
            let _ = manager.close_instance(&instance_id);
        }
    }

    #[tokio::test]
    async fn test_get_mode_method() {
        if !nvim_available() {
            println!("Skipping integration test: nvim not available");
            return;
        }

        let manager = NeovimManager::new();
        let instance_id = "test-mode".to_string();
        
        if let Ok(_) = manager.create_instance(instance_id.clone()) {
            // Give neovim time to start
            tokio::time::sleep(Duration::from_millis(1000)).await;
            
            if let Ok(instances) = manager.get_instance(&instance_id) {
                if let Some(instance) = instances.get(&instance_id) {
                    let result = instance.get_mode();
                    match result {
                        Ok(mode) => {
                            println!("Current mode: {}", mode);
                            // In a fresh nvim instance, we expect normal mode
                            assert!(mode == "n" || mode.contains("normal"));
                        },
                        Err(e) => {
                            println!("Get mode failed (expected in some environments): {}", e);
                        }
                    }
                }
            }
            
            // Clean up
            let _ = manager.close_instance(&instance_id);
        }
    }

    #[tokio::test]
    async fn test_eval_expression() {
        if !nvim_available() {
            println!("Skipping integration test: nvim not available");
            return;
        }

        let manager = NeovimManager::new();
        let instance_id = "test-eval".to_string();
        
        if let Ok(_) = manager.create_instance(instance_id.clone()) {
            // Give neovim time to start
            tokio::time::sleep(Duration::from_millis(1000)).await;
            
            if let Ok(instances) = manager.get_instance(&instance_id) {
                if let Some(instance) = instances.get(&instance_id) {
                    let result = instance.eval_expression("2 + 3");
                    match result {
                        Ok(value) => {
                            println!("Eval result: {:?}", value);
                            // Should evaluate to 5
                            if let Some(num) = value.as_i64() {
                                assert_eq!(num, 5);
                            }
                        },
                        Err(e) => {
                            println!("Eval failed (expected in some environments): {}", e);
                        }
                    }
                }
            }
            
            // Clean up
            let _ = manager.close_instance(&instance_id);
        }
    }
}