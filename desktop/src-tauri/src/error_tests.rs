#[cfg(test)]
mod error_tests {
    use crate::error::*;
    use crate::error::context::*;
    use std::path::PathBuf;

    #[test]
    fn test_error_construction() {
        let err = OrchflowError::session_not_found("test-session");
        assert_eq!(err.to_string(), "Session not found: test-session");
        assert_eq!(err.category(), ErrorCategory::State);
    }

    #[test]
    fn test_backend_error() {
        let err = OrchflowError::backend_error("create_pane", "tmux not running");
        assert_eq!(err.to_string(), "Backend operation failed: create_pane - tmux not running");
        assert_eq!(err.category(), ErrorCategory::Backend);
    }

    #[test]
    fn test_layout_error() {
        let err = OrchflowError::layout_error("split_pane", "cannot split single pane");
        assert_eq!(err.category(), ErrorCategory::Layout);
        match err {
            OrchflowError::LayoutError { operation, reason } => {
                assert_eq!(operation, "split_pane");
                assert_eq!(reason, "cannot split single pane");
            }
            _ => panic!("Expected LayoutError"),
        }
    }

    #[test]
    fn test_error_variants() {
        let validation_err = OrchflowError::ValidationError {
            field: "test".to_string(),
            reason: "test validation".to_string(),
        };
        assert_eq!(validation_err.category(), ErrorCategory::Validation);

        let state_err = OrchflowError::StatePersistenceError {
            reason: "database corruption".to_string(),
        };
        assert_eq!(state_err.category(), ErrorCategory::State);

        let insufficient_err = OrchflowError::InsufficientResources {
            resource: "memory".to_string(),
            available: "100MB".to_string(),
            required: "1GB".to_string(),
        };
        assert_eq!(insufficient_err.category(), ErrorCategory::System);
    }

    #[test]
    fn test_error_categorization() {
        let state_err = OrchflowError::session_not_found("test");
        assert_eq!(state_err.category(), ErrorCategory::State);

        let backend_err = OrchflowError::tmux_error("ls", "command not found");
        assert_eq!(backend_err.category(), ErrorCategory::Backend);

        let file_err = OrchflowError::file_error("read", PathBuf::from("/tmp/test"), "not found");
        assert_eq!(file_err.category(), ErrorCategory::FileSystem);

        let plugin_err = OrchflowError::plugin_error("test-plugin", "init", "failed");
        assert_eq!(plugin_err.category(), ErrorCategory::Plugin);
    }

    #[test]
    fn test_timeout_errors() {
        let backend_timeout = OrchflowError::BackendTimeout {
            operation: "create_session".to_string(),
            timeout_ms: 5000,
        };
        assert_eq!(backend_timeout.category(), ErrorCategory::Backend);
        assert!(backend_timeout.to_string().contains("timeout"));

        let command_timeout = OrchflowError::CommandTimeout {
            command: "long_running_cmd".to_string(),
            timeout_ms: 3000,
        };
        assert_eq!(command_timeout.category(), ErrorCategory::Terminal);
    }

    #[test]
    fn test_error_conversion_from_io_error() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let orch_err: OrchflowError = io_err.into();
        
        match orch_err {
            OrchflowError::FileError { reason } => {
                assert!(reason.contains("file not found"));
            }
            _ => panic!("Expected FileError"),
        }
    }

    #[test]
    fn test_contextual_error() {
        let base_err = OrchflowError::pane_not_found("test-pane");
        let context = ErrorContext::new("split_pane", "LayoutManager")
            .with_session_id("test-session")
            .with_pane_id("test-pane");
        
        let contextual = ContextualError::new(
            base_err.clone(),
            ErrorCategory::State,
            ErrorSeverity::Warning,
            context,
        ).recoverable().with_retry();

        assert_eq!(contextual.error.to_string(), "Pane not found: test-pane");
        assert_eq!(contextual.context.operation, "split_pane");
        assert_eq!(contextual.context.component, "LayoutManager");
        assert_eq!(contextual.context.session_id, Some("test-session".to_string()));
        assert_eq!(contextual.context.pane_id, Some("test-pane".to_string()));
        assert_eq!(contextual.category, ErrorCategory::State);
        assert_eq!(contextual.severity, ErrorSeverity::Warning);
        assert!(contextual.recoverable);
        assert!(contextual.retry_suggested);
    }

    #[test]
    fn test_error_category_names() {
        assert_eq!(format!("{:?}", ErrorCategory::State), "State");
        assert_eq!(format!("{:?}", ErrorCategory::Backend), "Backend");
        assert_eq!(format!("{:?}", ErrorCategory::Layout), "Layout");
        assert_eq!(format!("{:?}", ErrorCategory::Terminal), "Terminal");
        assert_eq!(format!("{:?}", ErrorCategory::FileSystem), "FileSystem");
        assert_eq!(format!("{:?}", ErrorCategory::Plugin), "Plugin");
        assert_eq!(format!("{:?}", ErrorCategory::Configuration), "Configuration");
        assert_eq!(format!("{:?}", ErrorCategory::Database), "Database");
        assert_eq!(format!("{:?}", ErrorCategory::Network), "Network");
        assert_eq!(format!("{:?}", ErrorCategory::Validation), "Validation");
        assert_eq!(format!("{:?}", ErrorCategory::System), "System");
        assert_eq!(format!("{:?}", ErrorCategory::Internal), "Internal");
    }

    #[test]
    fn test_error_severity_ordering() {
        assert!(ErrorSeverity::Info < ErrorSeverity::Warning);
        assert!(ErrorSeverity::Warning < ErrorSeverity::Error);
        assert!(ErrorSeverity::Error < ErrorSeverity::Critical);
        assert!(ErrorSeverity::Critical < ErrorSeverity::Fatal);
    }

    #[test]
    fn test_specialized_error_constructors() {
        // Test timeout errors
        let timeout_err = OrchflowError::BackendTimeout {
            operation: "create_session".to_string(),
            timeout_ms: 5000,
        };
        assert_eq!(timeout_err.category(), ErrorCategory::Backend);

        // Test permission errors
        let perm_err = OrchflowError::PermissionDenied {
            operation: "write".to_string(),
            resource: "/etc/config".to_string(),
        };
        assert_eq!(perm_err.category(), ErrorCategory::FileSystem);

        // Test constraint violations
        let constraint_err = OrchflowError::ConstraintViolation {
            constraint: "unique_session_name".to_string(),
            reason: "session already exists".to_string(),
        };
        assert_eq!(constraint_err.category(), ErrorCategory::Validation);
    }

    #[test]
    fn test_complex_error_scenarios() {
        // Simulate a complex error scenario: layout operation fails due to backend timeout
        let timeout_err = OrchflowError::BackendTimeout {
            operation: "split_pane".to_string(),
            timeout_ms: 5000,
        };
        
        let context = ErrorContext::new("split_layout_pane", "LayoutManager")
            .with_session_id("main-session")
            .with_pane_id("pane-123");
        
        let contextual = ContextualError::new(
            timeout_err,
            ErrorCategory::Backend,
            ErrorSeverity::Error,
            context,
        ).recoverable().with_retry();

        // Verify error properties
        assert_eq!(contextual.category, ErrorCategory::Backend);
        assert_eq!(contextual.severity, ErrorSeverity::Error);
        assert!(contextual.retry_suggested);
        assert!(contextual.recoverable);

        // Verify context
        assert_eq!(contextual.context.operation, "split_layout_pane");
        assert_eq!(contextual.context.component, "LayoutManager");
        assert_eq!(contextual.context.session_id, Some("main-session".to_string()));
        assert_eq!(contextual.context.pane_id, Some("pane-123".to_string()));
    }

    #[test]
    fn test_file_operation_errors() {
        let file_err = OrchflowError::FileOperationError {
            operation: "read".to_string(),
            path: PathBuf::from("/test/file.txt"),
            reason: "permission denied".to_string(),
        };
        assert_eq!(file_err.category(), ErrorCategory::FileSystem);
        assert!(file_err.to_string().contains("read"));
        assert!(file_err.to_string().contains("/test/file.txt"));
        assert!(file_err.to_string().contains("permission denied"));
    }

    #[test]
    fn test_module_errors() {
        let module_not_found = OrchflowError::module_not_found("test-module");
        assert_eq!(module_not_found.category(), ErrorCategory::Plugin);
        
        let module_err = OrchflowError::module_error("test-module", "load", "invalid format");
        assert_eq!(module_err.category(), ErrorCategory::Plugin);
        match module_err {
            OrchflowError::ModuleError { module_name, operation, reason } => {
                assert_eq!(module_name, "test-module");
                assert_eq!(operation, "load");
                assert_eq!(reason, "invalid format");
            }
            _ => panic!("Expected ModuleError"),
        }
    }

    #[test]
    fn test_git_errors() {
        let git_err = OrchflowError::GitError {
            operation: "commit".to_string(),
            details: "no changes staged".to_string(),
        };
        assert!(git_err.to_string().contains("Git operation failed"));
        assert!(git_err.to_string().contains("commit"));
        assert!(git_err.to_string().contains("no changes staged"));
    }

    #[test]
    fn test_network_errors() {
        let network_err = OrchflowError::NetworkError {
            operation: "connect".to_string(),
            endpoint: "localhost:8080".to_string(),
            reason: "connection refused".to_string(),
        };
        assert_eq!(network_err.category(), ErrorCategory::Network);

        let ws_err = OrchflowError::WebSocketError {
            reason: "handshake failed".to_string(),
        };
        assert_eq!(ws_err.category(), ErrorCategory::Network);

        let conn_timeout = OrchflowError::ConnectionTimeout {
            endpoint: "api.example.com".to_string(),
            timeout_ms: 30000,
        };
        assert_eq!(conn_timeout.category(), ErrorCategory::Network);
    }

    #[test]
    fn test_database_errors() {
        let db_err = OrchflowError::DatabaseError {
            operation: "query".to_string(),
            reason: "syntax error".to_string(),
        };
        assert_eq!(db_err.category(), ErrorCategory::Database);

        let migration_err = OrchflowError::MigrationError {
            version: 5,
            reason: "schema conflict".to_string(),
        };
        assert_eq!(migration_err.category(), ErrorCategory::Database);

        let corruption_err = OrchflowError::DataCorruption {
            table: "sessions".to_string(),
            reason: "checksum mismatch".to_string(),
        };
        assert_eq!(corruption_err.category(), ErrorCategory::Database);
    }
}