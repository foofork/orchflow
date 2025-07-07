#[cfg(test)]
mod error_tests {
    use crate::error::*;
    use crate::mux_backend::MuxError;

    #[test]
    fn test_error_construction() {
        let err = OrchflowError::session_not_found("test-session");
        assert_eq!(err.to_string(), "Session not found: test-session");
        assert_eq!(err.category(), ErrorCategory::State);
        assert_eq!(err.severity(), ErrorSeverity::Warning);
        assert!(err.is_recoverable());
        assert!(!err.retry_suggested());
    }

    #[test]
    fn test_backend_error() {
        let err = OrchflowError::backend_error("create_pane", "tmux not running");
        assert_eq!(err.to_string(), "Backend operation failed: create_pane - tmux not running");
        assert_eq!(err.category(), ErrorCategory::Backend);
        assert_eq!(err.severity(), ErrorSeverity::Error);
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
    fn test_error_severity_levels() {
        let info_err = OrchflowError::ValidationError {
            field: "test".to_string(),
            reason: "test validation".to_string(),
        };
        assert_eq!(info_err.severity(), ErrorSeverity::Warning);

        let critical_err = OrchflowError::StatePersistenceError {
            reason: "database corruption".to_string(),
        };
        assert_eq!(critical_err.severity(), ErrorSeverity::Critical);

        let fatal_err = OrchflowError::InsufficientResources {
            resource: "memory".to_string(),
            available: "100MB".to_string(),
            required: "1GB".to_string(),
        };
        assert_eq!(fatal_err.severity(), ErrorSeverity::Fatal);
    }

    #[test]
    fn test_error_categorization() {
        let state_err = OrchflowError::session_not_found("test");
        assert_eq!(state_err.category(), ErrorCategory::State);

        let backend_err = OrchflowError::tmux_error("ls", "command not found");
        assert_eq!(backend_err.category(), ErrorCategory::Backend);

        let file_err = OrchflowError::file_error("read", "/tmp/test", "not found");
        assert_eq!(file_err.category(), ErrorCategory::FileSystem);

        let plugin_err = OrchflowError::plugin_error("test-plugin", "init", "failed");
        assert_eq!(plugin_err.category(), ErrorCategory::Plugin);
    }

    #[test]
    fn test_recoverable_classification() {
        let recoverable_err = OrchflowError::session_not_found("test");
        assert!(recoverable_err.is_recoverable());

        let non_recoverable_err = OrchflowError::DataCorruption {
            table: "sessions".to_string(),
            reason: "checksum mismatch".to_string(),
        };
        assert!(!non_recoverable_err.is_recoverable());
    }

    #[test]
    fn test_retry_suggestion() {
        let retry_err = OrchflowError::BackendTimeout {
            operation: "create_session".to_string(),
            timeout_ms: 5000,
        };
        assert!(retry_err.retry_suggested());

        let no_retry_err = OrchflowError::ValidationError {
            field: "session_name".to_string(),
            reason: "invalid characters".to_string(),
        };
        assert!(!no_retry_err.retry_suggested());
    }

    #[test]
    fn test_contextual_error() {
        let base_err = OrchflowError::pane_not_found("test-pane");
        let contextual = base_err
            .with_context("split_pane", "LayoutManager")
            .with_session("test-session")
            .with_pane("test-pane");

        assert_eq!(contextual.error.to_string(), "Pane not found: test-pane");
        assert_eq!(contextual.context.operation, "split_pane");
        assert_eq!(contextual.context.component, "LayoutManager");
        assert_eq!(contextual.context.session_id, Some("test-session".to_string()));
        assert_eq!(contextual.context.pane_id, Some("test-pane".to_string()));
        assert_eq!(contextual.category, ErrorCategory::State);
        assert_eq!(contextual.severity, ErrorSeverity::Warning);
    }

    #[test]
    fn test_error_conversion_from_mux_error() {
        let mux_err = MuxError::session_not_found("test-session");
        let orch_err: OrchflowError = mux_err.into();
        
        match orch_err {
            OrchflowError::SessionNotFound { id } => {
                assert_eq!(id, "test-session");
            }
            _ => panic!("Expected SessionNotFound"),
        }
    }

    #[test]
    fn test_error_conversion_to_string() {
        let err = OrchflowError::backend_error("test_op", "test error");
        let error_string: String = err.into();
        assert_eq!(error_string, "Backend operation failed: test_op - test error");
    }

    #[test]
    fn test_standard_error_conversions() {
        // Test io::Error conversion
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let orch_err: OrchflowError = io_err.into();
        match orch_err {
            OrchflowError::FileError { operation, path, reason } => {
                assert_eq!(operation, "io_operation");
                assert_eq!(path, "unknown");
                assert!(reason.contains("file not found"));
            }
            _ => panic!("Expected FileError"),
        }

        // Test serde_json::Error conversion
        let json_err = serde_json::from_str::<i32>("invalid json").unwrap_err();
        let orch_err: OrchflowError = json_err.into();
        match orch_err {
            OrchflowError::ValidationError { field, reason: _ } => {
                assert_eq!(field, "json_data");
            }
            _ => panic!("Expected ValidationError"),
        }
    }

    #[test]
    fn test_user_message_generation() {
        let warning_err = OrchflowError::session_not_found("test")
            .with_context("get_session", "StateManager");
        let warning_msg = warning_err.to_user_message();
        assert_eq!(warning_msg, "Session not found: test");

        let error_err = OrchflowError::backend_error("connect", "connection refused")
            .with_context("connect_backend", "MuxBackend");
        let error_msg = error_err.to_user_message();
        assert!(error_msg.starts_with("Error: Backend operation failed"));
        assert!(error_msg.contains("Please try again") || error_msg.contains("Please check"));

        let critical_err = OrchflowError::DataCorruption {
            table: "sessions".to_string(),
            reason: "checksum failure".to_string(),
        }.with_context("load_state", "StateManager");
        let critical_msg = critical_err.to_user_message();
        assert!(critical_msg.starts_with("Critical Error"));
        assert!(critical_msg.contains("Please restart the application"));
    }

    #[test]
    fn test_error_category_names() {
        assert_eq!(ErrorCategory::State.name(), "STATE");
        assert_eq!(ErrorCategory::Backend.name(), "BACKEND");
        assert_eq!(ErrorCategory::Layout.name(), "LAYOUT");
        assert_eq!(ErrorCategory::Terminal.name(), "TERMINAL");
        assert_eq!(ErrorCategory::FileSystem.name(), "FILESYSTEM");
        assert_eq!(ErrorCategory::Plugin.name(), "PLUGIN");
        assert_eq!(ErrorCategory::Configuration.name(), "CONFIG");
        assert_eq!(ErrorCategory::Database.name(), "DATABASE");
        assert_eq!(ErrorCategory::Network.name(), "NETWORK");
        assert_eq!(ErrorCategory::Validation.name(), "VALIDATION");
        assert_eq!(ErrorCategory::System.name(), "SYSTEM");
        assert_eq!(ErrorCategory::Internal.name(), "INTERNAL");
    }

    #[test]
    fn test_error_severity_names() {
        assert_eq!(ErrorSeverity::Info.name(), "INFO");
        assert_eq!(ErrorSeverity::Warning.name(), "WARN");
        assert_eq!(ErrorSeverity::Error.name(), "ERROR");
        assert_eq!(ErrorSeverity::Critical.name(), "CRITICAL");
        assert_eq!(ErrorSeverity::Fatal.name(), "FATAL");
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
        assert!(timeout_err.retry_suggested());
        assert_eq!(timeout_err.severity(), ErrorSeverity::Error);

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
        
        let contextual = timeout_err
            .with_context("split_layout_pane", "LayoutManager")
            .with_session("main-session")
            .with_pane("pane-123");

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

        // Test user message
        let user_msg = contextual.to_user_message();
        assert!(user_msg.contains("timeout"));
        assert!(user_msg.contains("Please try again"));
    }
}