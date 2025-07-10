// System resource error variants

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "details")]
pub enum SystemError {
    #[error("System resource error: {resource} - {reason}")]
    ResourceError { resource: String, reason: String },
    
    #[error("Memory allocation failed: {size} bytes - {reason}")]
    MemoryError { size: usize, reason: String },
    
    #[error("Insufficient resources: {resource} - {available}/{required}")]
    InsufficientResources { resource: String, available: String, required: String },
    
    #[error("Internal error: {context} - {reason}")]
    InternalError { context: String, reason: String },
    
    #[error("Unknown error: {reason}")]
    Unknown { reason: String },
}

impl SystemError {
    /// Helper function to create resource error
    pub fn resource_error(resource: &str, reason: &str) -> Self {
        Self::ResourceError {
            resource: resource.to_string(),
            reason: reason.to_string(),
        }
    }
    
    /// Helper function to create memory error
    pub fn memory_error(size: usize, reason: &str) -> Self {
        Self::MemoryError {
            size,
            reason: reason.to_string(),
        }
    }
    
    /// Helper function to create insufficient resources error
    pub fn insufficient_resources(resource: &str, available: &str, required: &str) -> Self {
        Self::InsufficientResources {
            resource: resource.to_string(),
            available: available.to_string(),
            required: required.to_string(),
        }
    }
    
    /// Helper function to create internal error
    pub fn internal_error(context: &str, reason: &str) -> Self {
        Self::InternalError {
            context: context.to_string(),
            reason: reason.to_string(),
        }
    }
    
    /// Helper function to create unknown error
    pub fn unknown(reason: &str) -> Self {
        Self::Unknown { reason: reason.to_string() }
    }
}