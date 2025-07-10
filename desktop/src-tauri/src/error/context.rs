// Error context and metadata

use serde::{Deserialize, Serialize};

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

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum ErrorSeverity {
    Info,
    Warning,
    Error,
    Critical,
    Fatal,
}

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextualError {
    pub error: super::OrchflowError,
    pub category: ErrorCategory,
    pub severity: ErrorSeverity,
    pub context: ErrorContext,
    pub recoverable: bool,
    pub retry_suggested: bool,
}

impl ErrorContext {
    pub fn new(operation: &str, component: &str) -> Self {
        Self {
            operation: operation.to_string(),
            component: component.to_string(),
            session_id: None,
            pane_id: None,
            file_path: None,
            timestamp: chrono::Utc::now(),
            stack_trace: None,
        }
    }
    
    pub fn with_session_id(mut self, session_id: &str) -> Self {
        self.session_id = Some(session_id.to_string());
        self
    }
    
    pub fn with_pane_id(mut self, pane_id: &str) -> Self {
        self.pane_id = Some(pane_id.to_string());
        self
    }
    
    pub fn with_file_path(mut self, file_path: &str) -> Self {
        self.file_path = Some(file_path.to_string());
        self
    }
}

impl ContextualError {
    pub fn new(
        error: super::OrchflowError,
        category: ErrorCategory,
        severity: ErrorSeverity,
        context: ErrorContext,
    ) -> Self {
        Self {
            error,
            category,
            severity,
            context,
            recoverable: false,
            retry_suggested: false,
        }
    }
    
    pub fn recoverable(mut self) -> Self {
        self.recoverable = true;
        self
    }
    
    pub fn with_retry(mut self) -> Self {
        self.retry_suggested = true;
        self
    }
}