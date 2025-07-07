// Database operation error variants

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "details")]
pub enum DatabaseError {
    #[error("Database error: {operation} - {reason}")]
    OperationError { operation: String, reason: String },
    
    #[error("Migration error: {version} - {reason}")]
    MigrationError { version: String, reason: String },
    
    #[error("Data corruption detected: {table} - {reason}")]
    DataCorruption { table: String, reason: String },
}

impl DatabaseError {
    /// Helper function to create database operation error
    pub fn operation_error(operation: &str, reason: &str) -> Self {
        Self::OperationError {
            operation: operation.to_string(),
            reason: reason.to_string(),
        }
    }
    
    /// Helper function to create migration error
    pub fn migration_error(version: &str, reason: &str) -> Self {
        Self::MigrationError {
            version: version.to_string(),
            reason: reason.to_string(),
        }
    }
    
    /// Helper function to create data corruption error
    pub fn data_corruption(table: &str, reason: &str) -> Self {
        Self::DataCorruption {
            table: table.to_string(),
            reason: reason.to_string(),
        }
    }
}