// File system operation error variants

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use thiserror::Error;

#[derive(Debug, Error, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "details")]
pub enum FileSystemError {
    #[error("File operation failed: {operation} on {path} - {reason}")]
    FileOperationError { operation: String, path: PathBuf, reason: String },
    
    #[error("Directory not found: {path}")]
    DirectoryNotFound { path: String },
    
    #[error("Permission denied: {operation} on {resource}")]
    PermissionDenied { operation: String, resource: String },
    
    #[error("Search operation failed: {operation} - {reason}")]
    SearchError { operation: String, reason: String },
}

impl FileSystemError {
    /// Helper function to create file operation error
    pub fn file_operation_error(operation: &str, path: PathBuf, reason: &str) -> Self {
        Self::FileOperationError {
            operation: operation.to_string(),
            path,
            reason: reason.to_string(),
        }
    }
    
    /// Helper function to create directory not found error
    pub fn directory_not_found(path: &str) -> Self {
        Self::DirectoryNotFound { path: path.to_string() }
    }
    
    /// Helper function to create permission denied error
    pub fn permission_denied(operation: &str, resource: &str) -> Self {
        Self::PermissionDenied {
            operation: operation.to_string(),
            resource: resource.to_string(),
        }
    }
    
    /// Helper function to create search error
    pub fn search_error(operation: &str, reason: &str) -> Self {
        Self::SearchError {
            operation: operation.to_string(),
            reason: reason.to_string(),
        }
    }
}