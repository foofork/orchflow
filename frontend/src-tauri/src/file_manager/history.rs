// Operation history management for file manager

use std::sync::Arc;
use tokio::sync::RwLock;
use super::types::{FileOperation, FileOperationType};
use crate::error::Result;

#[derive(Clone)]
pub struct OperationHistory {
    history: Arc<RwLock<Vec<FileOperation>>>,
    max_history_size: usize,
}

impl OperationHistory {
    pub fn new(max_size: usize) -> Self {
        Self {
            history: Arc::new(RwLock::new(Vec::new())),
            max_history_size: max_size,
        }
    }
    
    /// Record a file operation in history
    pub async fn record(&self, operation: FileOperation) {
        let mut history = self.history.write().await;
        
        // Add to history
        history.push(operation);
        
        // Trim history if it exceeds max size
        if history.len() > self.max_history_size {
            history.remove(0);
        }
    }
    
    /// Get operation history with a limit
    pub async fn get_history(&self, limit: usize) -> Vec<FileOperation> {
        let history = self.history.read().await;
        let start = if history.len() > limit {
            history.len() - limit
        } else {
            0
        };
        
        history[start..].to_vec()
    }
    
    /// Get the last operation that can be undone
    pub async fn get_last_undoable(&self) -> Option<FileOperation> {
        let history = self.history.read().await;
        history.iter()
            .rev()
            .find(|op| op.can_undo)
            .cloned()
    }
    
    /// Clear all history
    pub async fn clear(&self) {
        let mut history = self.history.write().await;
        history.clear();
    }
}

/// Undo a file operation
pub async fn undo_operation(operation: &FileOperation) -> Result<()> {
    match operation.operation_type {
        FileOperationType::Create => {
            // Delete the created file
            tokio::fs::remove_file(&operation.source).await
                .map_err(|e| crate::error::OrchflowError::FileOperationError {
                    path: operation.source.clone(),
                    operation: "undo create".to_string(),
                    reason: e.to_string(),
                })?;
        }
        FileOperationType::Delete => {
            // Restore from trash if available
            // For now, we can't undo permanent deletes
            return Err(crate::error::OrchflowError::FileOperationError {
                path: operation.source.clone(),
                operation: "undo delete".to_string(),
                reason: "Cannot restore deleted files".to_string(),
            });
        }
        FileOperationType::Move | FileOperationType::Rename => {
            if let Some(destination) = &operation.destination {
                // Move back to original location
                tokio::fs::rename(destination, &operation.source).await
                    .map_err(|e| crate::error::OrchflowError::FileOperationError {
                        path: destination.clone(),
                        operation: "undo move".to_string(),
                        reason: e.to_string(),
                    })?;
            }
        }
        FileOperationType::Copy => {
            if let Some(destination) = &operation.destination {
                // Delete the copy
                if destination.is_dir() {
                    tokio::fs::remove_dir_all(destination).await
                        .map_err(|e| crate::error::OrchflowError::FileOperationError {
                            path: destination.clone(),
                            operation: "undo copy".to_string(),
                            reason: e.to_string(),
                        })?;
                } else {
                    tokio::fs::remove_file(destination).await
                        .map_err(|e| crate::error::OrchflowError::FileOperationError {
                            path: destination.clone(),
                            operation: "undo copy".to_string(),
                            reason: e.to_string(),
                        })?;
                }
            }
        }
    }
    
    Ok(())
}