// Working tests that demonstrate our testing infrastructure
// This file contains tests that compile and run successfully

#[cfg(test)]
mod tests {
    use crate::error::{ErrorCategory, OrchflowError};

    #[test]
    fn test_error_construction_basic() {
        // Test session not found error
        let error = OrchflowError::session_not_found("test-session-123");
        match error {
            OrchflowError::SessionNotFound { id } => {
                assert_eq!(id, "test-session-123");
            }
            _ => panic!("Wrong error type"),
        }
    }

    #[test]
    fn test_error_categories() {
        // State errors
        let state_error = OrchflowError::SessionNotFound {
            id: "test".to_string(),
        };
        assert!(matches!(state_error.category(), ErrorCategory::State));

        // Backend errors
        let backend_error = OrchflowError::BackendError {
            operation: "test_op".to_string(),
            reason: "test_reason".to_string(),
        };
        assert!(matches!(backend_error.category(), ErrorCategory::Backend));

        // File system errors
        let fs_error = OrchflowError::DirectoryNotFound {
            path: "/test/path".to_string(),
        };
        assert!(matches!(fs_error.category(), ErrorCategory::FileSystem));

        // Validation errors
        let validation_error = OrchflowError::ValidationError {
            field: "email".to_string(),
            reason: "invalid format".to_string(),
        };
        assert!(matches!(
            validation_error.category(),
            ErrorCategory::Validation
        ));
    }

    #[test]
    fn test_error_display_messages() {
        let error = OrchflowError::BackendError {
            operation: "create_session".to_string(),
            reason: "tmux not running".to_string(),
        };

        let error_string = error.to_string();
        assert!(error_string.contains("Backend operation failed"));
        assert!(error_string.contains("create_session"));
        assert!(error_string.contains("tmux not running"));
    }

    #[test]
    fn test_convenience_constructors() {
        // Session not found
        let error1 = OrchflowError::session_not_found("my-session");
        assert!(matches!(error1, OrchflowError::SessionNotFound { .. }));

        // Backend error
        let error2 = OrchflowError::backend_error("connect", "refused");
        assert!(matches!(error2, OrchflowError::BackendError { .. }));

        // Command error
        let error3 = OrchflowError::command_error("ls", "not found");
        assert!(matches!(error3, OrchflowError::CommandError { .. }));

        // Plugin error
        let error4 = OrchflowError::plugin_error("git", "pull", "no remote");
        assert!(matches!(error4, OrchflowError::PluginError { .. }));
    }

    #[test]
    fn test_error_serialization() {
        let error = OrchflowError::SessionNotFound {
            id: "test-123".to_string(),
        };

        // Serialize to JSON
        let json = serde_json::to_string(&error).unwrap();
        assert!(json.contains("SessionNotFound"));
        assert!(json.contains("test-123"));

        // Deserialize back
        let deserialized: OrchflowError = serde_json::from_str(&json).unwrap();
        match deserialized {
            OrchflowError::SessionNotFound { id } => {
                assert_eq!(id, "test-123");
            }
            _ => panic!("Wrong error type after deserialization"),
        }
    }

    #[test]
    fn test_database_errors() {
        let error = OrchflowError::DatabaseError {
            operation: "insert".to_string(),
            reason: "constraint violation".to_string(),
        };

        assert!(matches!(error.category(), ErrorCategory::Database));
        let display = error.to_string();
        assert!(display.contains("Database error"));
    }

    #[test]
    fn test_result_type_alias() {
        use crate::error::Result;

        fn success_function() -> Result<String> {
            Ok("success".to_string())
        }

        fn error_function() -> Result<String> {
            Err(OrchflowError::internal_error("test", "error"))
        }

        assert!(success_function().is_ok());
        assert!(error_function().is_err());
    }
}

#[cfg(test)]
mod integration_tests {
    use crate::simple_state_store::{CreateSession, SimpleStateStore};
    use std::sync::Arc;

    #[tokio::test]
    async fn test_simple_state_store_basic() {
        let store = Arc::new(SimpleStateStore::new().unwrap());

        // Test key-value operations
        let result = store.set("test_key", "test_value").await;
        assert!(result.is_ok());

        let value = store.get("test_key").await.unwrap();
        assert_eq!(value, Some("test_value".to_string()));

        // Test non-existent key
        let missing = store.get("missing_key").await.unwrap();
        assert_eq!(missing, None);
    }

    #[tokio::test]
    async fn test_session_creation() {
        let store = Arc::new(SimpleStateStore::new().unwrap());

        let create_session = CreateSession {
            name: "Test Session".to_string(),
            tmux_session: None,
            metadata: Some("test".to_string()),
        };

        let session = store.create_session(create_session).await.unwrap();
        assert_eq!(session.name, "Test Session");

        // Retrieve the session
        let retrieved = store.get_session(&session.id).await.unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().name, "Test Session");
    }
}
