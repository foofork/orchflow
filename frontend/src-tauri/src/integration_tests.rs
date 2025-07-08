// Integration tests for core orchflow functionality
// These tests validate end-to-end workflows and critical paths

#[cfg(test)]
mod integration_tests {
    use crate::simple_state_store::SimpleStateStore;
    use crate::error::OrchflowError;
    use std::sync::Arc;
    use uuid::Uuid;

    async fn setup_test_environment() -> Arc<SimpleStateStore> {
        Arc::new(SimpleStateStore::new().expect("Failed to create test store"))
    }

    #[tokio::test]
    async fn test_basic_state_store_operations() {
        let store = setup_test_environment().await;
        
        // Test basic key-value operations
        let key = "test_key";
        let value = "test_value";
        
        // Set a value
        let result = store.set(key, value).await;
        assert!(result.is_ok(), "Failed to set value: {:?}", result);
        
        // Get the value
        let retrieved = store.get(key).await;
        assert!(retrieved.is_ok(), "Failed to get value: {:?}", retrieved);
        assert_eq!(retrieved.unwrap(), Some(value.to_string()));
        
        // Test non-existent key
        let missing = store.get("nonexistent").await;
        assert!(missing.is_ok());
        assert_eq!(missing.unwrap(), None);
    }

    #[tokio::test]
    async fn test_session_lifecycle() {
        let store = setup_test_environment().await;
        let session_id = Uuid::new_v4().to_string();
        
        // Create session
        let create_session = crate::simple_state_store::CreateSession {
            name: "Test Session".to_string(),
            tmux_session: None,
            metadata: Some("test metadata".to_string()),
        };
        
        let session = store.create_session(create_session).await;
        assert!(session.is_ok(), "Failed to create session: {:?}", session);
        
        let session = session.unwrap();
        assert_eq!(session.name, "Test Session");
        
        // Get session
        let retrieved = store.get_session(&session.id).await;
        assert!(retrieved.is_ok());
        assert!(retrieved.unwrap().is_some());
        
        // List sessions
        let sessions = store.list_sessions().await;
        assert!(sessions.is_ok());
        assert!(!sessions.unwrap().is_empty());
        
        // Delete session
        let deleted = store.delete_session(&session.id).await;
        assert!(deleted.is_ok());
        assert!(deleted.unwrap());
    }

    #[tokio::test]
    async fn test_error_handling() {
        // Test OrchflowError creation and categorization
        let session_error = OrchflowError::session_not_found("missing-session");
        assert!(matches!(session_error.category(), crate::error::ErrorCategory::State));
        
        let backend_error = OrchflowError::backend_error("tmux", "connection failed");
        assert!(matches!(backend_error.category(), crate::error::ErrorCategory::Backend));
        
        // Test error serialization
        let json = serde_json::to_string(&session_error);
        assert!(json.is_ok());
        
        let deserialized: Result<OrchflowError, _> = serde_json::from_str(&json.unwrap());
        assert!(deserialized.is_ok());
    }

    #[tokio::test]
    async fn test_concurrent_operations() {
        let store = setup_test_environment().await;
        let mut handles = vec![];
        
        // Create multiple sessions concurrently
        for i in 0..5 {
            let store = store.clone();
            let handle = tokio::spawn(async move {
                let create_session = crate::simple_state_store::CreateSession {
                    name: format!("Concurrent Session {}", i),
                    tmux_session: None,
                    metadata: None,
                };
                store.create_session(create_session).await
            });
            handles.push(handle);
        }
        
        // Wait for all operations
        let mut success_count = 0;
        for handle in handles {
            let result = handle.await;
            assert!(result.is_ok());
            if result.unwrap().is_ok() {
                success_count += 1;
            }
        }
        
        assert_eq!(success_count, 5, "Not all concurrent operations succeeded");
        
        // Verify all sessions were created
        let sessions = store.list_sessions().await.unwrap();
        assert!(sessions.len() >= 5);
    }

    #[tokio::test]
    async fn test_data_persistence() {
        // This test verifies that data survives across store instances
        let temp_db = format!("/tmp/test_orchflow_{}.db", Uuid::new_v4());
        
        let session_id = {
            // Create store and add data
            let store = SimpleStateStore::new_with_file(&temp_db).unwrap();
            
            let create_session = crate::simple_state_store::CreateSession {
                name: "Persistent Session".to_string(),
                tmux_session: None,
                metadata: None,
            };
            
            let session = store.create_session(create_session).await.unwrap();
            session.id
        };
        
        // Create new store instance and verify data exists
        let store2 = SimpleStateStore::new_with_file(&temp_db).unwrap();
        let retrieved = store2.get_session(&session_id).await.unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().name, "Persistent Session");
        
        // Cleanup
        std::fs::remove_file(&temp_db).ok();
    }

    #[tokio::test]
    async fn test_performance_benchmarks() {
        let store = setup_test_environment().await;
        let start_time = std::time::Instant::now();
        
        // Perform batch operations
        let mut handles = vec![];
        for i in 0..100 {
            let store = store.clone();
            let handle = tokio::spawn(async move {
                let key = format!("perf_test_{}", i);
                let value = format!("value_{}", i);
                store.set(&key, &value).await
            });
            handles.push(handle);
        }
        
        // Wait for completion
        for handle in handles {
            let result = handle.await.unwrap();
            assert!(result.is_ok());
        }
        
        let duration = start_time.elapsed();
        println!("100 concurrent operations took: {:?}", duration);
        
        // Performance assertion - should complete in reasonable time
        assert!(duration.as_millis() < 1000, "Operations took too long: {:?}", duration);
    }
}

#[cfg(test)]
mod unit_tests {
    use crate::error::{OrchflowError, ErrorCategory};
    
    #[test]
    fn test_error_construction() {
        let error = OrchflowError::session_not_found("test");
        if let OrchflowError::SessionNotFound { id } = error {
            assert_eq!(id, "test");
        } else {
            panic!("Wrong error type constructed");
        }
    }
    
    #[test]
    fn test_error_categorization() {
        // State errors
        assert!(matches!(
            OrchflowError::session_not_found("test").category(),
            ErrorCategory::State
        ));
        
        // Backend errors
        assert!(matches!(
            OrchflowError::backend_error("op", "reason").category(),
            ErrorCategory::Backend
        ));
        
        // File system errors
        assert!(matches!(
            OrchflowError::DirectoryNotFound { path: "test".to_string() }.category(),
            ErrorCategory::FileSystem
        ));
    }
    
    #[test]
    fn test_error_display() {
        let error = OrchflowError::BackendError {
            operation: "test_op".to_string(),
            reason: "test_reason".to_string(),
        };
        
        let display = error.to_string();
        assert!(display.contains("Backend operation failed"));
        assert!(display.contains("test_op"));
        assert!(display.contains("test_reason"));
    }
}