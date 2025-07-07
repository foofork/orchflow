// Unified Error System for Orchflow
//
// This module provides a comprehensive error handling system that replaces
// String errors throughout the codebase with typed, structured errors.

use serde::{Deserialize, Serialize};
use thiserror::Error;

// ===== Core Application Errors =====

#[derive(Debug, Error, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "details")]
pub enum OrchflowError {
    // ===== State Management Errors =====
    #[error("Session not found: {id}")]
    SessionNotFound { id: String },
    
    #[error("Pane not found: {id}")]
    PaneNotFound { id: String },
    
    #[error("Layout not found for session: {session_id}")]
    LayoutNotFound { session_id: String },
    
    #[error("Invalid session state: {reason}")]
    InvalidSessionState { reason: String },
    
    #[error("State persistence failed: {reason}")]
    StatePersistenceError { reason: String },
    
    #[error("State synchronization failed: {reason}")]
    StateSyncError { reason: String },

    // ===== Backend/Mux Errors =====
    #[error("Backend operation failed: {operation} - {reason}")]
    BackendError { operation: String, reason: String },
    
    #[error("Tmux command failed: {command} - {stderr}")]
    TmuxError { command: String, stderr: String },
    
    #[error("Muxd connection failed: {reason}")]
    MuxdError { reason: String },
    
    #[error("Backend timeout: operation {operation} timed out after {timeout_ms}ms")]
    BackendTimeout { operation: String, timeout_ms: u64 },

    // ===== Layout Errors =====
    #[error("Layout operation failed: {operation} - {reason}")]
    LayoutError { operation: String, reason: String },
    
    #[error("Invalid pane split: {reason}")]
    InvalidPaneSplit { reason: String },
    
    #[error("Cannot close pane: {reason}")]
    PaneCloseError { reason: String },
    
    #[error("Pane resize failed: {reason}")]
    PaneResizeError { reason: String },

    // ===== Terminal/Command Errors =====
    #[error("Command execution failed: {command} - {reason}")]
    CommandError { command: String, reason: String },
    
    #[error("Terminal operation failed: {operation} - {reason}")]
    TerminalError { operation: String, reason: String },
    
    #[error("Command timeout: {command} timed out after {timeout_ms}ms")]
    CommandTimeout { command: String, timeout_ms: u64 },

    // ===== File System Errors =====
    #[error("File operation failed: {operation} on {path} - {reason}")]
    FileError { operation: String, path: String, reason: String },
    
    #[error("Directory not found: {path}")]
    DirectoryNotFound { path: String },
    
    #[error("Permission denied: {operation} on {resource}")]
    PermissionDenied { operation: String, resource: String },

    // ===== Search Errors =====
    #[error("Search operation failed: {operation} - {reason}")]
    SearchError { operation: String, reason: String },

    // ===== Plugin Errors =====
    #[error("Plugin error in {plugin_id}: {operation} - {reason}")]
    PluginError { plugin_id: String, operation: String, reason: String },
    
    #[error("Plugin not found: {plugin_id}")]
    PluginNotFound { plugin_id: String },
    
    #[error("Plugin initialization failed: {plugin_id} - {reason}")]
    PluginInitError { plugin_id: String, reason: String },
    
    #[error("Plugin error: {plugin_id} - {reason}")]
    Plugin { plugin_id: String, reason: String },

    // ===== Configuration Errors =====
    #[error("Configuration error: {key} - {reason}")]
    ConfigError { key: String, reason: String },
    
    #[error("Configuration error in {component}: {reason}")]
    ConfigurationError { component: String, reason: String },
    
    #[error("Invalid configuration value: {key} = {value} - {reason}")]
    InvalidConfigValue { key: String, value: String, reason: String },

    // ===== Database/Persistence Errors =====
    #[error("Database error: {operation} - {reason}")]
    DatabaseError { operation: String, reason: String },
    
    #[error("Migration error: {version} - {reason}")]
    MigrationError { version: String, reason: String },
    
    #[error("Data corruption detected: {table} - {reason}")]
    DataCorruption { table: String, reason: String },

    // ===== Network/WebSocket Errors =====
    #[error("Network error: {operation} - {reason}")]
    NetworkError { operation: String, reason: String },
    
    #[error("WebSocket error: {reason}")]
    WebSocketError { reason: String },
    
    #[error("Connection timeout: {endpoint} - {timeout_ms}ms")]
    ConnectionTimeout { endpoint: String, timeout_ms: u64 },

    // ===== Validation Errors =====
    #[error("Validation failed: {field} - {reason}")]
    ValidationError { field: String, reason: String },
    
    #[error("Invalid input: {input} - {reason}")]
    InvalidInput { input: String, reason: String },
    
    #[error("Constraint violation: {constraint} - {reason}")]
    ConstraintViolation { constraint: String, reason: String },

    // ===== System/Resource Errors =====
    #[error("System resource error: {resource} - {reason}")]
    ResourceError { resource: String, reason: String },
    
    #[error("Memory allocation failed: {size} bytes - {reason}")]
    MemoryError { size: usize, reason: String },
    
    #[error("Insufficient resources: {resource} - {available}/{required}")]
    InsufficientResources { resource: String, available: String, required: String },

    // ===== Generic/Unknown Errors =====
    #[error("Internal error: {context} - {reason}")]
    InternalError { context: String, reason: String },
    
    #[error("Unknown error: {reason}")]
    Unknown { reason: String },
}

// ===== Error Categories =====

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ErrorCategory {
    State,
    Backend,
    Layout,
    Terminal,
    FileSystem,
    Plugin,
    Configuration,
    Database,
    Network,
    Validation,
    System,
    Internal,
}

// ===== Error Severity =====

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum ErrorSeverity {
    Info,
    Warning,
    Error,
    Critical,
    Fatal,
}

// ===== Error Context =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorContext {
    pub operation: String,
    pub component: String,
    pub session_id: Option<String>,
    pub pane_id: Option<String>,
    pub file_path: Option<String>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub stack_trace: Option<String>,
}

// ===== Enhanced Error with Context =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextualError {
    pub error: OrchflowError,
    pub category: ErrorCategory,
    pub severity: ErrorSeverity,
    pub context: ErrorContext,
    pub recoverable: bool,
    pub retry_suggested: bool,
}

impl OrchflowError {
    // ===== Convenience Constructors =====
    
    pub fn session_not_found(id: impl Into<String>) -> Self {
        OrchflowError::SessionNotFound { id: id.into() }
    }
    
    pub fn pane_not_found(id: impl Into<String>) -> Self {
        OrchflowError::PaneNotFound { id: id.into() }
    }
    
    pub fn layout_not_found(session_id: impl Into<String>) -> Self {
        OrchflowError::LayoutNotFound { session_id: session_id.into() }
    }
    
    pub fn backend_error(operation: impl Into<String>, reason: impl Into<String>) -> Self {
        OrchflowError::BackendError { 
            operation: operation.into(), 
            reason: reason.into() 
        }
    }
    
    pub fn tmux_error(command: impl Into<String>, stderr: impl Into<String>) -> Self {
        OrchflowError::TmuxError { 
            command: command.into(), 
            stderr: stderr.into() 
        }
    }
    
    pub fn layout_error(operation: impl Into<String>, reason: impl Into<String>) -> Self {
        OrchflowError::LayoutError { 
            operation: operation.into(), 
            reason: reason.into() 
        }
    }
    
    pub fn command_error(command: impl Into<String>, reason: impl Into<String>) -> Self {
        OrchflowError::CommandError { 
            command: command.into(), 
            reason: reason.into() 
        }
    }
    
    pub fn file_error(operation: impl Into<String>, path: impl Into<String>, reason: impl Into<String>) -> Self {
        OrchflowError::FileError { 
            operation: operation.into(), 
            path: path.into(), 
            reason: reason.into() 
        }
    }
    
    pub fn plugin_error(plugin_id: impl Into<String>, operation: impl Into<String>, reason: impl Into<String>) -> Self {
        OrchflowError::PluginError { 
            plugin_id: plugin_id.into(), 
            operation: operation.into(), 
            reason: reason.into() 
        }
    }
    
    pub fn validation_error(field: impl Into<String>, reason: impl Into<String>) -> Self {
        OrchflowError::ValidationError { 
            field: field.into(), 
            reason: reason.into() 
        }
    }
    
    pub fn internal_error(context: impl Into<String>, reason: impl Into<String>) -> Self {
        OrchflowError::InternalError { 
            context: context.into(), 
            reason: reason.into() 
        }
    }
    
    // ===== Error Classification =====
    
    pub fn category(&self) -> ErrorCategory {
        match self {
            OrchflowError::SessionNotFound { .. } |
            OrchflowError::PaneNotFound { .. } |
            OrchflowError::LayoutNotFound { .. } |
            OrchflowError::InvalidSessionState { .. } |
            OrchflowError::StatePersistenceError { .. } |
            OrchflowError::StateSyncError { .. } => ErrorCategory::State,
            
            OrchflowError::BackendError { .. } |
            OrchflowError::TmuxError { .. } |
            OrchflowError::MuxdError { .. } |
            OrchflowError::BackendTimeout { .. } => ErrorCategory::Backend,
            
            OrchflowError::LayoutError { .. } |
            OrchflowError::InvalidPaneSplit { .. } |
            OrchflowError::PaneCloseError { .. } |
            OrchflowError::PaneResizeError { .. } => ErrorCategory::Layout,
            
            OrchflowError::CommandError { .. } |
            OrchflowError::TerminalError { .. } |
            OrchflowError::CommandTimeout { .. } => ErrorCategory::Terminal,
            
            OrchflowError::FileError { .. } |
            OrchflowError::DirectoryNotFound { .. } |
            OrchflowError::PermissionDenied { .. } => ErrorCategory::FileSystem,

            OrchflowError::SearchError { .. } => ErrorCategory::FileSystem,
            
            OrchflowError::PluginError { .. } |
            OrchflowError::PluginNotFound { .. } |
            OrchflowError::PluginInitError { .. } |
            OrchflowError::Plugin { .. } => ErrorCategory::Plugin,
            
            OrchflowError::ConfigError { .. } |
            OrchflowError::ConfigurationError { .. } |
            OrchflowError::InvalidConfigValue { .. } => ErrorCategory::Configuration,
            
            OrchflowError::DatabaseError { .. } |
            OrchflowError::MigrationError { .. } |
            OrchflowError::DataCorruption { .. } => ErrorCategory::Database,
            
            OrchflowError::NetworkError { .. } |
            OrchflowError::WebSocketError { .. } |
            OrchflowError::ConnectionTimeout { .. } => ErrorCategory::Network,
            
            OrchflowError::ValidationError { .. } |
            OrchflowError::InvalidInput { .. } |
            OrchflowError::ConstraintViolation { .. } => ErrorCategory::Validation,
            
            OrchflowError::ResourceError { .. } |
            OrchflowError::MemoryError { .. } |
            OrchflowError::InsufficientResources { .. } => ErrorCategory::System,
            
            OrchflowError::InternalError { .. } |
            OrchflowError::Unknown { .. } => ErrorCategory::Internal,
        }
    }
    
    pub fn severity(&self) -> ErrorSeverity {
        match self {
            OrchflowError::SessionNotFound { .. } |
            OrchflowError::PaneNotFound { .. } |
            OrchflowError::LayoutNotFound { .. } |
            OrchflowError::PluginNotFound { .. } |
            OrchflowError::DirectoryNotFound { .. } => ErrorSeverity::Warning,
            
            OrchflowError::ValidationError { .. } |
            OrchflowError::InvalidInput { .. } |
            OrchflowError::InvalidConfigValue { .. } |
            OrchflowError::InvalidPaneSplit { .. } => ErrorSeverity::Warning,
            
            OrchflowError::CommandTimeout { .. } |
            OrchflowError::BackendTimeout { .. } |
            OrchflowError::ConnectionTimeout { .. } => ErrorSeverity::Error,
            
            OrchflowError::StatePersistenceError { .. } |
            OrchflowError::DatabaseError { .. } |
            OrchflowError::DataCorruption { .. } |
            OrchflowError::MemoryError { .. } => ErrorSeverity::Critical,
            
            OrchflowError::InsufficientResources { .. } |
            OrchflowError::MigrationError { .. } => ErrorSeverity::Fatal,
            
            _ => ErrorSeverity::Error,
        }
    }
    
    pub fn is_recoverable(&self) -> bool {
        match self {
            OrchflowError::SessionNotFound { .. } |
            OrchflowError::PaneNotFound { .. } |
            OrchflowError::LayoutNotFound { .. } |
            OrchflowError::ValidationError { .. } |
            OrchflowError::InvalidInput { .. } |
            OrchflowError::CommandTimeout { .. } |
            OrchflowError::BackendTimeout { .. } |
            OrchflowError::ConnectionTimeout { .. } => true,
            
            OrchflowError::DataCorruption { .. } |
            OrchflowError::MemoryError { .. } |
            OrchflowError::InsufficientResources { .. } |
            OrchflowError::MigrationError { .. } => false,
            
            _ => true,
        }
    }
    
    pub fn retry_suggested(&self) -> bool {
        match self {
            OrchflowError::CommandTimeout { .. } |
            OrchflowError::BackendTimeout { .. } |
            OrchflowError::ConnectionTimeout { .. } |
            OrchflowError::NetworkError { .. } |
            OrchflowError::StatePersistenceError { .. } => true,
            
            OrchflowError::ValidationError { .. } |
            OrchflowError::InvalidInput { .. } |
            OrchflowError::SessionNotFound { .. } |
            OrchflowError::PaneNotFound { .. } |
            OrchflowError::DataCorruption { .. } => false,
            
            _ => false,
        }
    }
    
    // ===== Context Creation =====
    
    pub fn with_context(
        self,
        operation: impl Into<String>,
        component: impl Into<String>,
    ) -> ContextualError {
        ContextualError {
            category: self.category(),
            severity: self.severity(),
            recoverable: self.is_recoverable(),
            retry_suggested: self.retry_suggested(),
            context: ErrorContext {
                operation: operation.into(),
                component: component.into(),
                session_id: None,
                pane_id: None,
                file_path: None,
                timestamp: chrono::Utc::now(),
                stack_trace: None,
            },
            error: self,
        }
    }
}

impl ContextualError {
    pub fn with_session(mut self, session_id: impl Into<String>) -> Self {
        self.context.session_id = Some(session_id.into());
        self
    }
    
    pub fn with_pane(mut self, pane_id: impl Into<String>) -> Self {
        self.context.pane_id = Some(pane_id.into());
        self
    }
    
    pub fn with_file(mut self, file_path: impl Into<String>) -> Self {
        self.context.file_path = Some(file_path.into());
        self
    }
    
    pub fn with_stack_trace(mut self, stack_trace: impl Into<String>) -> Self {
        self.context.stack_trace = Some(stack_trace.into());
        self
    }
}

// ===== Conversion Traits =====

impl From<std::io::Error> for OrchflowError {
    fn from(err: std::io::Error) -> Self {
        OrchflowError::FileError {
            operation: "io_operation".to_string(),
            path: "unknown".to_string(),
            reason: err.to_string(),
        }
    }
}

impl From<rusqlite::Error> for OrchflowError {
    fn from(err: rusqlite::Error) -> Self {
        OrchflowError::DatabaseError {
            operation: "database_operation".to_string(),
            reason: err.to_string(),
        }
    }
}

impl From<serde_json::Error> for OrchflowError {
    fn from(err: serde_json::Error) -> Self {
        OrchflowError::ValidationError {
            field: "json_data".to_string(),
            reason: err.to_string(),
        }
    }
}

impl From<tokio::time::error::Elapsed> for OrchflowError {
    fn from(_: tokio::time::error::Elapsed) -> Self {
        OrchflowError::BackendTimeout {
            operation: "async_operation".to_string(),
            timeout_ms: 0, // Will be filled in by caller
        }
    }
}

impl From<OrchflowError> for String {
    fn from(err: OrchflowError) -> Self {
        err.to_string()
    }
}

// ===== Result Type Alias =====

pub type Result<T> = std::result::Result<T, OrchflowError>;
pub type ContextualResult<T> = std::result::Result<T, ContextualError>;

// ===== Error Reporting Utilities =====

impl ContextualError {
    pub fn log_error(&self) {
        match self.severity {
            ErrorSeverity::Info => log::info!("{}", self.format_log_message()),
            ErrorSeverity::Warning => log::warn!("{}", self.format_log_message()),
            ErrorSeverity::Error => log::error!("{}", self.format_log_message()),
            ErrorSeverity::Critical => log::error!("CRITICAL: {}", self.format_log_message()),
            ErrorSeverity::Fatal => log::error!("FATAL: {}", self.format_log_message()),
        }
    }
    
    fn format_log_message(&self) -> String {
        format!(
            "[{}:{}] {} in {} - {} {}{}{}",
            self.category.name(),
            self.severity.name(),
            self.error,
            self.context.component,
            self.context.operation,
            self.context.session_id.as_ref().map(|s| format!(" (session: {})", s)).unwrap_or_default(),
            self.context.pane_id.as_ref().map(|p| format!(" (pane: {})", p)).unwrap_or_default(),
            self.context.file_path.as_ref().map(|f| format!(" (file: {})", f)).unwrap_or_default(),
        )
    }
    
    pub fn to_user_message(&self) -> String {
        match self.severity {
            ErrorSeverity::Info | ErrorSeverity::Warning => {
                format!("{}", self.error)
            }
            ErrorSeverity::Error => {
                format!("Error: {}. {}", self.error, self.recovery_suggestion())
            }
            ErrorSeverity::Critical => {
                format!("Critical Error: {}. Please restart the application.", self.error)
            }
            ErrorSeverity::Fatal => {
                format!("Fatal Error: {}. The application must be restarted.", self.error)
            }
        }
    }
    
    fn recovery_suggestion(&self) -> String {
        if self.retry_suggested {
            "Please try again."
        } else if self.recoverable {
            "Please check your input and try again."
        } else {
            "Please contact support if this issue persists."
        }.to_string()
    }
}

impl ErrorCategory {
    pub fn name(&self) -> &'static str {
        match self {
            ErrorCategory::State => "STATE",
            ErrorCategory::Backend => "BACKEND",
            ErrorCategory::Layout => "LAYOUT",
            ErrorCategory::Terminal => "TERMINAL",
            ErrorCategory::FileSystem => "FILESYSTEM",
            ErrorCategory::Plugin => "PLUGIN",
            ErrorCategory::Configuration => "CONFIG",
            ErrorCategory::Database => "DATABASE",
            ErrorCategory::Network => "NETWORK",
            ErrorCategory::Validation => "VALIDATION",
            ErrorCategory::System => "SYSTEM",
            ErrorCategory::Internal => "INTERNAL",
        }
    }
}

impl ErrorSeverity {
    pub fn name(&self) -> &'static str {
        match self {
            ErrorSeverity::Info => "INFO",
            ErrorSeverity::Warning => "WARN",
            ErrorSeverity::Error => "ERROR",
            ErrorSeverity::Critical => "CRITICAL",
            ErrorSeverity::Fatal => "FATAL",
        }
    }
}