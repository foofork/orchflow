// File operations (create, delete, move, copy, rename)

use super::history::OperationHistory;
use super::tree::FileTreeCache;
use super::types::{FileOperation, FileOperationType};
use crate::error::{OrchflowError, Result};
use chrono::Utc;
use std::collections::VecDeque;
use std::path::{Path, PathBuf};
use tokio::fs;
use uuid::Uuid;

#[derive(Clone)]
pub struct FileOperations {
    history: OperationHistory,
    cache: FileTreeCache,
    project_root: PathBuf,
}

impl FileOperations {
    pub fn new(history: OperationHistory, cache: FileTreeCache, project_root: PathBuf) -> Self {
        Self {
            history,
            cache,
            project_root,
        }
    }

    /// Create a new file with optional content
    pub async fn create_file(&self, path: &Path, content: Option<&str>) -> Result<()> {
        // Ensure path is within project root
        if !path.starts_with(&self.project_root) {
            return Err(OrchflowError::FileOperationError {
                path: path.to_path_buf(),
                operation: "create file".to_string(),
                reason: "Path must be within project root".to_string(),
            });
        }

        // Create parent directory if it doesn't exist
        if let Some(parent) = path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent).await.map_err(|e| {
                    OrchflowError::FileOperationError {
                        path: parent.to_path_buf(),
                        operation: "create parent directory".to_string(),
                        reason: e.to_string(),
                    }
                })?;
            }
        }

        // Write file
        fs::write(path, content.unwrap_or("")).await.map_err(|e| {
            OrchflowError::FileOperationError {
                path: path.to_path_buf(),
                operation: "write file".to_string(),
                reason: e.to_string(),
            }
        })?;

        // Record operation
        self.history
            .record(FileOperation {
                id: Uuid::new_v4().to_string(),
                operation_type: FileOperationType::Create,
                source: path.to_path_buf(),
                destination: None,
                timestamp: Utc::now(),
                can_undo: true,
            })
            .await;

        // Invalidate cache
        self.cache.invalidate_path(path).await;

        Ok(())
    }

    /// Create a new directory
    pub async fn create_directory(&self, path: &Path) -> Result<()> {
        // Ensure path is within project root
        if !path.starts_with(&self.project_root) {
            return Err(OrchflowError::FileOperationError {
                path: path.to_path_buf(),
                operation: "create directory".to_string(),
                reason: "Path must be within project root".to_string(),
            });
        }

        fs::create_dir_all(path)
            .await
            .map_err(|e| OrchflowError::FileOperationError {
                path: path.to_path_buf(),
                operation: "create directory".to_string(),
                reason: e.to_string(),
            })?;

        // Record operation
        self.history
            .record(FileOperation {
                id: Uuid::new_v4().to_string(),
                operation_type: FileOperationType::Create,
                source: path.to_path_buf(),
                destination: None,
                timestamp: Utc::now(),
                can_undo: true,
            })
            .await;

        // Invalidate cache
        self.cache.invalidate_path(path).await;

        Ok(())
    }

    /// Delete a file or directory
    pub async fn delete(&self, path: &Path, permanent: bool) -> Result<()> {
        // Ensure path is within project root
        if !path.starts_with(&self.project_root) {
            return Err(OrchflowError::FileOperationError {
                path: path.to_path_buf(),
                operation: "delete".to_string(),
                reason: "Path must be within project root".to_string(),
            });
        }

        let metadata = fs::metadata(path)
            .await
            .map_err(|e| OrchflowError::FileOperationError {
                path: path.to_path_buf(),
                operation: "read metadata".to_string(),
                reason: e.to_string(),
            })?;

        if permanent {
            if metadata.is_dir() {
                fs::remove_dir_all(path)
                    .await
                    .map_err(|e| OrchflowError::FileOperationError {
                        path: path.to_path_buf(),
                        operation: "delete directory".to_string(),
                        reason: e.to_string(),
                    })?;
            } else {
                fs::remove_file(path)
                    .await
                    .map_err(|e| OrchflowError::FileOperationError {
                        path: path.to_path_buf(),
                        operation: "delete file".to_string(),
                        reason: e.to_string(),
                    })?;
            }
        } else {
            // Move to trash
            trash::delete(path).map_err(|e| OrchflowError::FileOperationError {
                path: path.to_path_buf(),
                operation: "move to trash".to_string(),
                reason: e.to_string(),
            })?;
        }

        // Record operation
        self.history
            .record(FileOperation {
                id: Uuid::new_v4().to_string(),
                operation_type: FileOperationType::Delete,
                source: path.to_path_buf(),
                destination: None,
                timestamp: Utc::now(),
                can_undo: !permanent,
            })
            .await;

        // Invalidate cache
        self.cache.invalidate_path(path).await;

        Ok(())
    }

    /// Rename a file or directory
    pub async fn rename(&self, old_path: &Path, new_name: &str) -> Result<()> {
        let new_path = old_path
            .parent()
            .ok_or_else(|| OrchflowError::FileOperationError {
                path: old_path.to_path_buf(),
                operation: "rename".to_string(),
                reason: "Invalid path".to_string(),
            })?
            .join(new_name);

        fs::rename(old_path, &new_path)
            .await
            .map_err(|e| OrchflowError::FileOperationError {
                path: old_path.to_path_buf(),
                operation: "rename".to_string(),
                reason: e.to_string(),
            })?;

        // Record operation
        self.history
            .record(FileOperation {
                id: Uuid::new_v4().to_string(),
                operation_type: FileOperationType::Rename,
                source: old_path.to_path_buf(),
                destination: Some(new_path.clone()),
                timestamp: Utc::now(),
                can_undo: true,
            })
            .await;

        // Invalidate cache
        self.cache.invalidate_path(old_path).await;
        self.cache.invalidate_path(&new_path).await;

        Ok(())
    }

    /// Move multiple files to a destination
    pub async fn move_files(&self, files: Vec<PathBuf>, destination: &Path) -> Result<()> {
        // Ensure destination is a directory
        if !destination.is_dir() {
            return Err(OrchflowError::FileOperationError {
                path: destination.to_path_buf(),
                operation: "move files".to_string(),
                reason: "Destination must be a directory".to_string(),
            });
        }

        for file in files {
            let file_name = file
                .file_name()
                .ok_or_else(|| OrchflowError::FileOperationError {
                    path: file.clone(),
                    operation: "move file".to_string(),
                    reason: "Invalid file name".to_string(),
                })?;

            let dest_path = destination.join(file_name);

            fs::rename(&file, &dest_path)
                .await
                .map_err(|e| OrchflowError::FileOperationError {
                    path: file.clone(),
                    operation: "move file".to_string(),
                    reason: e.to_string(),
                })?;

            // Record operation
            self.history
                .record(FileOperation {
                    id: Uuid::new_v4().to_string(),
                    operation_type: FileOperationType::Move,
                    source: file.clone(),
                    destination: Some(dest_path.clone()),
                    timestamp: Utc::now(),
                    can_undo: true,
                })
                .await;

            // Invalidate cache
            self.cache.invalidate_path(&file).await;
            self.cache.invalidate_path(&dest_path).await;
        }

        Ok(())
    }

    /// Copy multiple files to a destination
    pub async fn copy_files(&self, files: Vec<PathBuf>, destination: &Path) -> Result<()> {
        // Ensure destination is a directory
        if !destination.is_dir() {
            return Err(OrchflowError::FileOperationError {
                path: destination.to_path_buf(),
                operation: "copy files".to_string(),
                reason: "Destination must be a directory".to_string(),
            });
        }

        for file in files {
            let file_name = file
                .file_name()
                .ok_or_else(|| OrchflowError::FileOperationError {
                    path: file.clone(),
                    operation: "copy file".to_string(),
                    reason: "Invalid file name".to_string(),
                })?;

            let dest_path = destination.join(file_name);

            if file.is_dir() {
                self.copy_directory_iterative(&file, &dest_path).await?;
            } else {
                fs::copy(&file, &dest_path).await.map_err(|e| {
                    OrchflowError::FileOperationError {
                        path: file.clone(),
                        operation: "copy file".to_string(),
                        reason: e.to_string(),
                    }
                })?;
            }

            // Record operation
            self.history
                .record(FileOperation {
                    id: Uuid::new_v4().to_string(),
                    operation_type: FileOperationType::Copy,
                    source: file.clone(),
                    destination: Some(dest_path.clone()),
                    timestamp: Utc::now(),
                    can_undo: true,
                })
                .await;

            // Invalidate cache
            self.cache.invalidate_path(&dest_path).await;
        }

        Ok(())
    }

    /// Copy a directory recursively (iterative version)
    async fn copy_directory_iterative(&self, src: &Path, dst: &Path) -> Result<()> {
        // Create destination directory
        fs::create_dir_all(dst)
            .await
            .map_err(|e| OrchflowError::FileOperationError {
                path: dst.to_path_buf(),
                operation: "create directory".to_string(),
                reason: e.to_string(),
            })?;

        // Use a queue for iterative traversal
        let mut queue = VecDeque::new();
        queue.push_back((src.to_path_buf(), dst.to_path_buf()));

        while let Some((src_dir, dst_dir)) = queue.pop_front() {
            let mut entries =
                fs::read_dir(&src_dir)
                    .await
                    .map_err(|e| OrchflowError::FileOperationError {
                        path: src_dir.clone(),
                        operation: "read directory".to_string(),
                        reason: e.to_string(),
                    })?;

            while let Some(entry) =
                entries
                    .next_entry()
                    .await
                    .map_err(|e| OrchflowError::FileOperationError {
                        path: src_dir.clone(),
                        operation: "read entry".to_string(),
                        reason: e.to_string(),
                    })?
            {
                let src_path = entry.path();
                let file_name =
                    src_path
                        .file_name()
                        .ok_or_else(|| OrchflowError::FileOperationError {
                            path: src_path.clone(),
                            operation: "get file name".to_string(),
                            reason: "Invalid file name".to_string(),
                        })?;

                let dst_path = dst_dir.join(file_name);

                if src_path.is_dir() {
                    fs::create_dir(&dst_path).await.map_err(|e| {
                        OrchflowError::FileOperationError {
                            path: dst_path.clone(),
                            operation: "create directory".to_string(),
                            reason: e.to_string(),
                        }
                    })?;

                    queue.push_back((src_path, dst_path));
                } else {
                    fs::copy(&src_path, &dst_path).await.map_err(|e| {
                        OrchflowError::FileOperationError {
                            path: src_path.clone(),
                            operation: "copy file".to_string(),
                            reason: e.to_string(),
                        }
                    })?;
                }
            }
        }

        Ok(())
    }
}
