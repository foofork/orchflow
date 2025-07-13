// Comprehensive tests for OrchflowError error handling
// Tests error categorization, serialization, and error propagation

#[cfg(test)]
mod tests {
    use crate::error::{ErrorCategory, OrchflowError, Result};
    use std::path::PathBuf;

    #[test]
    fn test_error_categories() {
        // Test state management errors
        let session_error = OrchflowError::session_not_found("test-session");
        assert!(matches!(session_error.category(), ErrorCategory::State));

        let pane_error = OrchflowError::pane_not_found("test-pane");
        assert!(matches!(pane_error.category(), ErrorCategory::State));

        // Test backend errors
        let backend_error = OrchflowError::backend_error("tmux", "connection failed");
        assert!(matches!(backend_error.category(), ErrorCategory::Backend));

        let tmux_error = OrchflowError::tmux_error("new-session", "failed");
        assert!(matches!(tmux_error.category(), ErrorCategory::Backend));

        // Test file system errors
        let file_error = OrchflowError::file_error("read", PathBuf::from("/test"), "not found");
        assert!(matches!(file_error.category(), ErrorCategory::FileSystem));

        // Test validation errors
        let validation_error = OrchflowError::validation_error("input", "invalid format");
        assert!(matches!(
            validation_error.category(),
            ErrorCategory::Validation
        ));
    }

    #[test]
    fn test_error_serialization() {
        let error = OrchflowError::SessionNotFound {
            id: "test-session".to_string(),
        };

        // Test JSON serialization
        let json = serde_json::to_string(&error).unwrap();
        assert!(json.contains("SessionNotFound"));
        assert!(json.contains("test-session"));

        // Test deserialization
        let deserialized: OrchflowError = serde_json::from_str(&json).unwrap();
        if let OrchflowError::SessionNotFound { id } = deserialized {
            assert_eq!(id, "test-session");
        } else {
            panic!("Deserialized error type mismatch");
        }
    }

    #[test]
    fn test_error_display() {
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
        // Test session errors
        let session_error = OrchflowError::session_not_found("my-session");
        if let OrchflowError::SessionNotFound { id } = session_error {
            assert_eq!(id, "my-session");
        } else {
            panic!("Constructor created wrong error type");
        }

        // Test backend errors
        let backend_error = OrchflowError::backend_error("operation", "reason");
        if let OrchflowError::BackendError { operation, reason } = backend_error {
            assert_eq!(operation, "operation");
            assert_eq!(reason, "reason");
        } else {
            panic!("Constructor created wrong error type");
        }

        // Test command errors
        let cmd_error = OrchflowError::command_error("ls -la", "permission denied");
        if let OrchflowError::CommandError { command, reason } = cmd_error {
            assert_eq!(command, "ls -la");
            assert_eq!(reason, "permission denied");
        } else {
            panic!("Constructor created wrong error type");
        }
    }

    #[test]
    fn test_error_chaining() {
        // Test creating nested errors (common in error propagation)
        let root_cause = "Connection refused";
        let backend_error = OrchflowError::backend_error("connect", root_cause);
        let session_error = OrchflowError::InvalidSessionState {
            reason: format!("Cannot create session: {}", backend_error),
        };

        let error_string = session_error.to_string();
        assert!(error_string.contains("Invalid session state"));
        assert!(error_string.contains("Cannot create session"));
        assert!(error_string.contains("Backend operation failed"));
    }

    #[test]
    fn test_file_path_errors() {
        let path = PathBuf::from("/home/user/config.toml");
        let error = OrchflowError::FileOperationError {
            operation: "read".to_string(),
            path: path.clone(),
            reason: "Permission denied".to_string(),
        };

        let error_string = error.to_string();
        assert!(error_string.contains("File operation failed"));
        assert!(error_string.contains("read"));
        assert!(error_string.contains("/home/user/config.toml"));
        assert!(error_string.contains("Permission denied"));
    }

    #[test]
    fn test_timeout_errors() {
        let timeout_error = OrchflowError::BackendTimeout {
            operation: "create_session".to_string(),
            timeout_ms: 5000,
        };

        let error_string = timeout_error.to_string();
        assert!(error_string.contains("Backend timeout"));
        assert!(error_string.contains("create_session"));
        assert!(error_string.contains("5000ms"));
    }

    #[test]
    fn test_plugin_errors() {
        let plugin_error =
            OrchflowError::plugin_error("git-plugin", "checkout", "branch not found");

        if let OrchflowError::PluginError {
            ref plugin_id,
            ref operation,
            ref reason,
        } = plugin_error
        {
            assert_eq!(plugin_id, "git-plugin");
            assert_eq!(operation, "checkout");
            assert_eq!(reason, "branch not found");
        } else {
            panic!("Constructor created wrong error type");
        }

        assert!(matches!(plugin_error.category(), ErrorCategory::Plugin));
    }

    #[test]
    fn test_database_errors() {
        let db_error = OrchflowError::DatabaseError {
            operation: "insert_session".to_string(),
            reason: "constraint violation".to_string(),
        };

        assert!(matches!(db_error.category(), ErrorCategory::Database));

        let error_string = db_error.to_string();
        assert!(error_string.contains("Database error"));
        assert!(error_string.contains("insert_session"));
        assert!(error_string.contains("constraint violation"));
    }

    #[test]
    fn test_network_errors() {
        let network_error = OrchflowError::ConnectionTimeout {
            endpoint: "ws://localhost:7777".to_string(),
            timeout_ms: 10000,
        };

        assert!(matches!(network_error.category(), ErrorCategory::Network));

        let error_string = network_error.to_string();
        assert!(error_string.contains("Connection timeout"));
        assert!(error_string.contains("ws://localhost:7777"));
        assert!(error_string.contains("10000ms"));
    }

    #[test]
    fn test_result_type_alias() {
        // Test that our Result<T> type alias works correctly
        fn test_function() -> Result<String> {
            Ok("success".to_string())
        }

        fn error_function() -> Result<String> {
            Err(OrchflowError::internal_error("test", "forced error"))
        }

        assert!(test_function().is_ok());
        assert!(error_function().is_err());

        let error = error_function().unwrap_err();
        assert!(matches!(error.category(), ErrorCategory::System));
    }

    #[test]
    fn test_error_context_integration() {
        // Test error with additional context
        let error = OrchflowError::ValidationError {
            field: "session_name".to_string(),
            reason: "cannot be empty".to_string(),
        };

        // Simulate adding context (would be done by ContextualError in practice)
        let error_with_context = OrchflowError::InternalError {
            context: "session_creation".to_string(),
            reason: format!("Validation failed: {}", error),
        };

        let error_string = error_with_context.to_string();
        assert!(error_string.contains("Internal error"));
        assert!(error_string.contains("session_creation"));
        assert!(error_string.contains("Validation failed"));
    }

    #[test]
    fn test_memory_and_resource_errors() {
        let memory_error = OrchflowError::MemoryError {
            size: 1024 * 1024 * 100, // 100MB
            reason: "out of memory".to_string(),
        };

        let resource_error = OrchflowError::InsufficientResources {
            resource: "file_descriptors".to_string(),
            available: "1024".to_string(),
            required: "2048".to_string(),
        };

        assert!(matches!(memory_error.category(), ErrorCategory::System));
        assert!(matches!(resource_error.category(), ErrorCategory::System));

        let memory_string = memory_error.to_string();
        assert!(memory_string.contains("Memory allocation failed"));
        assert!(memory_string.contains("104857600 bytes"));

        let resource_string = resource_error.to_string();
        assert!(resource_string.contains("Insufficient resources"));
        assert!(resource_string.contains("1024/2048"));
    }

    #[test]
    fn test_error_equality() {
        let error1 = OrchflowError::SessionNotFound {
            id: "test".to_string(),
        };
        let error2 = OrchflowError::SessionNotFound {
            id: "test".to_string(),
        };
        let error3 = OrchflowError::SessionNotFound {
            id: "different".to_string(),
        };

        assert_eq!(error1, error2);
        assert_ne!(error1, error3);
    }
}
