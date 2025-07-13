// Unified Error System for Orchflow
//
// This module provides a comprehensive error handling system that replaces
// String errors throughout the codebase with typed, structured errors.

pub mod backend;
pub mod config;
pub mod context;
pub mod database;
pub mod filesystem;
pub mod layout;
pub mod network;
pub mod plugin;
pub mod state;
pub mod system;
pub mod terminal;
pub mod validation;

// Re-export commonly used types
pub use context::ErrorCategory;

use serde::{Deserialize, Serialize};
use std::io;
use std::path::PathBuf;
use thiserror::Error;

// ===== Main Application Error Enum =====

#[derive(Debug, Error, Clone, Serialize, Deserialize, PartialEq)]
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
    FileOperationError {
        operation: String,
        path: PathBuf,
        reason: String,
    },

    #[error("File error: {reason}")]
    FileError { reason: String },

    #[error("Directory not found: {path}")]
    DirectoryNotFound { path: String },

    #[error("Permission denied: {operation} on {resource}")]
    PermissionDenied { operation: String, resource: String },

    // ===== Search Errors =====
    #[error("Search operation failed: {operation} - {reason}")]
    SearchError { operation: String, reason: String },

    // ===== Plugin Errors =====
    #[error("Plugin error in {plugin_id}: {operation} - {reason}")]
    PluginError {
        plugin_id: String,
        operation: String,
        reason: String,
    },

    #[error("Plugin not found: {plugin_id}")]
    PluginNotFound { plugin_id: String },

    #[error("Plugin initialization failed: {plugin_id} - {reason}")]
    PluginInitError { plugin_id: String, reason: String },

    // ===== Module Errors =====
    #[error("Module not found: {name}")]
    ModuleNotFound { name: String },

    #[error("Module error in {module_name}: {operation} - {reason}")]
    ModuleError {
        module_name: String,
        operation: String,
        reason: String,
    },

    #[error("Module initialization failed: {module_name} - {reason}")]
    ModuleInitError { module_name: String, reason: String },

    // ===== Configuration Errors =====
    #[error("Configuration error: {key} - {reason}")]
    ConfigError { key: String, reason: String },

    #[error("Configuration error in {component}: {reason}")]
    ConfigurationError { component: String, reason: String },

    #[error("Invalid configuration value: {key} = {value} - {reason}")]
    InvalidConfigValue {
        key: String,
        value: String,
        reason: String,
    },

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

    // ===== Git Errors =====
    #[error("Git operation failed: {operation} - {details}")]
    GitError { operation: String, details: String },

    // ===== System/Resource Errors =====
    #[error("System resource error: {resource} - {reason}")]
    ResourceError { resource: String, reason: String },

    #[error("Memory allocation failed: {size} bytes - {reason}")]
    MemoryError { size: usize, reason: String },

    #[error("Insufficient resources: {resource} - {available}/{required}")]
    InsufficientResources {
        resource: String,
        available: String,
        required: String,
    },

    // ===== Generic/Unknown Errors =====
    #[error("Internal error: {context} - {reason}")]
    InternalError { context: String, reason: String },

    #[error("Unknown error: {reason}")]
    Unknown { reason: String },
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
        OrchflowError::LayoutNotFound {
            session_id: session_id.into(),
        }
    }

    pub fn backend_error(operation: impl Into<String>, reason: impl Into<String>) -> Self {
        OrchflowError::BackendError {
            operation: operation.into(),
            reason: reason.into(),
        }
    }

    pub fn tmux_error(command: impl Into<String>, stderr: impl Into<String>) -> Self {
        OrchflowError::TmuxError {
            command: command.into(),
            stderr: stderr.into(),
        }
    }

    pub fn layout_error(operation: impl Into<String>, reason: impl Into<String>) -> Self {
        OrchflowError::LayoutError {
            operation: operation.into(),
            reason: reason.into(),
        }
    }

    pub fn command_error(command: impl Into<String>, reason: impl Into<String>) -> Self {
        OrchflowError::CommandError {
            command: command.into(),
            reason: reason.into(),
        }
    }

    pub fn file_error(
        operation: impl Into<String>,
        path: PathBuf,
        reason: impl Into<String>,
    ) -> Self {
        OrchflowError::FileOperationError {
            operation: operation.into(),
            path,
            reason: reason.into(),
        }
    }

    pub fn plugin_error(
        plugin_id: impl Into<String>,
        operation: impl Into<String>,
        reason: impl Into<String>,
    ) -> Self {
        OrchflowError::PluginError {
            plugin_id: plugin_id.into(),
            operation: operation.into(),
            reason: reason.into(),
        }
    }

    pub fn validation_error(field: impl Into<String>, reason: impl Into<String>) -> Self {
        OrchflowError::ValidationError {
            field: field.into(),
            reason: reason.into(),
        }
    }

    pub fn internal_error(context: impl Into<String>, reason: impl Into<String>) -> Self {
        OrchflowError::InternalError {
            context: context.into(),
            reason: reason.into(),
        }
    }

    pub fn module_not_found(name: impl Into<String>) -> Self {
        OrchflowError::ModuleNotFound { name: name.into() }
    }

    pub fn module_error(
        module_name: impl Into<String>,
        operation: impl Into<String>,
        reason: impl Into<String>,
    ) -> Self {
        OrchflowError::ModuleError {
            module_name: module_name.into(),
            operation: operation.into(),
            reason: reason.into(),
        }
    }

    /// Get the error category
    pub fn category(&self) -> ErrorCategory {
        match self {
            OrchflowError::SessionNotFound { .. }
            | OrchflowError::PaneNotFound { .. }
            | OrchflowError::LayoutNotFound { .. }
            | OrchflowError::InvalidSessionState { .. }
            | OrchflowError::StatePersistenceError { .. }
            | OrchflowError::StateSyncError { .. } => ErrorCategory::State,

            OrchflowError::BackendError { .. }
            | OrchflowError::TmuxError { .. }
            | OrchflowError::MuxdError { .. }
            | OrchflowError::BackendTimeout { .. } => ErrorCategory::Backend,

            OrchflowError::LayoutError { .. }
            | OrchflowError::InvalidPaneSplit { .. }
            | OrchflowError::PaneCloseError { .. }
            | OrchflowError::PaneResizeError { .. } => ErrorCategory::Layout,

            OrchflowError::CommandError { .. }
            | OrchflowError::TerminalError { .. }
            | OrchflowError::CommandTimeout { .. } => ErrorCategory::Terminal,

            OrchflowError::FileOperationError { .. }
            | OrchflowError::FileError { .. }
            | OrchflowError::DirectoryNotFound { .. }
            | OrchflowError::PermissionDenied { .. }
            | OrchflowError::SearchError { .. }
            | OrchflowError::GitError { .. } => ErrorCategory::FileSystem,

            OrchflowError::PluginError { .. }
            | OrchflowError::PluginNotFound { .. }
            | OrchflowError::PluginInitError { .. } => ErrorCategory::Plugin,

            OrchflowError::ModuleError { .. }
            | OrchflowError::ModuleNotFound { .. }
            | OrchflowError::ModuleInitError { .. } => ErrorCategory::Plugin,

            OrchflowError::ConfigError { .. }
            | OrchflowError::ConfigurationError { .. }
            | OrchflowError::InvalidConfigValue { .. } => ErrorCategory::Configuration,

            OrchflowError::DatabaseError { .. }
            | OrchflowError::MigrationError { .. }
            | OrchflowError::DataCorruption { .. } => ErrorCategory::Database,

            OrchflowError::NetworkError { .. }
            | OrchflowError::WebSocketError { .. }
            | OrchflowError::ConnectionTimeout { .. } => ErrorCategory::Network,

            OrchflowError::ValidationError { .. }
            | OrchflowError::InvalidInput { .. }
            | OrchflowError::ConstraintViolation { .. } => ErrorCategory::Validation,

            OrchflowError::ResourceError { .. }
            | OrchflowError::MemoryError { .. }
            | OrchflowError::InsufficientResources { .. }
            | OrchflowError::InternalError { .. }
            | OrchflowError::Unknown { .. } => ErrorCategory::System,
        }
    }
}

// ===== Result Type Alias =====
pub type Result<T> = std::result::Result<T, OrchflowError>;

// ===== Conversions =====
impl From<io::Error> for OrchflowError {
    fn from(err: io::Error) -> Self {
        OrchflowError::FileError {
            reason: err.to_string(),
        }
    }
}

impl From<serde_json::Error> for OrchflowError {
    fn from(err: serde_json::Error) -> Self {
        OrchflowError::InternalError {
            context: "JSON serialization".to_string(),
            reason: err.to_string(),
        }
    }
}

impl From<reqwest::Error> for OrchflowError {
    fn from(err: reqwest::Error) -> Self {
        OrchflowError::NetworkError {
            operation: "HTTP request".to_string(),
            reason: err.to_string(),
        }
    }
}

impl From<rusqlite::Error> for OrchflowError {
    fn from(err: rusqlite::Error) -> Self {
        OrchflowError::DatabaseError {
            operation: "SQL operation".to_string(),
            reason: err.to_string(),
        }
    }
}
