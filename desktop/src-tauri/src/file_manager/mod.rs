// File manager module - organized file system operations

pub mod types;
pub mod git;
pub mod history;
pub mod tree;
pub mod operations;
pub mod utils;
pub mod trash;
#[cfg(test)]
mod tests;

// Re-export commonly used types
pub use types::{
    FileNode, FileOperation,
    FileEntry, FileEntryType, FileOperationResult
};
pub use git::{GitStatus, BranchInfo, FileGitStatus};

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use crate::error::Result;
use history::OperationHistory;
use tree::FileTreeCache;
use operations::FileOperations;
use trash::TrashManager;
use git::{GitIntegration};

pub struct FileManager {
    root_path: PathBuf,
    cache: FileTreeCache,
    history: OperationHistory,
    operations: FileOperations,
    trash_manager: TrashManager,
    git_integration: Option<Arc<Mutex<GitIntegration>>>,
    gitignore_patterns: Vec<String>,
    max_file_size: u64,
}

impl FileManager {
    pub fn new(root_path: PathBuf) -> Self {
        let cache = FileTreeCache::new();
        let history = OperationHistory::new(1000); // Keep last 1000 operations
        let operations = FileOperations::new(
            history.clone(),
            cache.clone(),
            root_path.clone()
        );
        
        // Get app data directory for trash metadata
        let app_data_dir = dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("orchflow");
        let trash_manager = TrashManager::new(app_data_dir);
        
        // Try to initialize git integration
        let git_integration = GitIntegration::new(&root_path)
            .ok()
            .map(|git| Arc::new(Mutex::new(git)));
        
        Self {
            root_path,
            cache: cache.clone(),
            history: history.clone(),
            operations,
            trash_manager,
            git_integration,
            gitignore_patterns: Vec::new(),
            max_file_size: 10 * 1024 * 1024, // 10MB default
        }
    }
    
    /// Initialize the file manager (load gitignore patterns, etc.)
    pub async fn init(&mut self) -> Result<()> {
        // If we have git integration, use it for gitignore patterns
        if let Some(ref git) = self.git_integration {
            // Git integration already loaded patterns
        } else {
            // Fall back to simple pattern loading
            self.gitignore_patterns = git::load_gitignore_patterns(&self.root_path).await;
        }
        Ok(())
    }
    
    // ===== Tree Operations =====
    
    /// Build a complete file tree from the root path
    pub async fn build_file_tree(&self, max_depth: Option<usize>) -> Result<FileNode> {
        self.cache.build_tree(&self.root_path, max_depth, &self.gitignore_patterns).await
    }
    
    /// Expand a directory in the tree
    pub async fn expand_directory(&self, path: &Path) -> Result<Vec<FileNode>> {
        self.cache.expand_directory(path, &self.gitignore_patterns).await
    }
    
    /// Collapse a directory in the tree
    pub async fn collapse_directory(&self, path: &Path) -> Result<()> {
        self.cache.collapse_directory(path).await
    }
    
    /// Get a file node from cache
    pub async fn get_file_node(&self, path: &Path) -> Option<FileNode> {
        self.cache.get_node(path).await
    }
    
    // ===== File Operations =====
    
    /// Create a new file
    pub async fn create_file(&self, path: &Path, content: &str) -> Result<()> {
        self.operations.create_file(path, Some(content)).await
    }
    
    /// Create a new directory
    pub async fn create_directory(&self, path: &Path) -> Result<()> {
        self.operations.create_directory(path).await
    }
    
    /// Delete a file or directory
    pub async fn delete_to_trash(&self, path: &Path) -> Result<()> {
        self.operations.delete(path, false).await
    }
    
    /// Delete permanently
    pub async fn delete_permanent(&self, path: &Path) -> Result<()> {
        self.operations.delete(path, true).await
    }
    
    /// Rename a file or directory
    pub async fn rename(&self, old_path: &Path, new_name: &str) -> Result<()> {
        self.operations.rename(old_path, new_name).await
    }
    
    /// Move files to a destination
    pub async fn move_file(&self, source: &str, destination: &str) -> Result<()> {
        let src = PathBuf::from(source);
        let dst = PathBuf::from(destination);
        self.operations.move_files(vec![src], &dst).await
    }
    
    /// Move multiple files
    pub async fn move_files(&self, files: Vec<PathBuf>, destination: &Path) -> Result<()> {
        self.operations.move_files(files, destination).await
    }
    
    /// Copy a file
    pub async fn copy_file(&self, source: &str, destination: &str) -> Result<FileOperationResult> {
        let src = PathBuf::from(source);
        let dst = PathBuf::from(destination);
        
        // Check if destination exists
        if dst.exists() {
            return Ok(FileOperationResult::Conflict);
        }
        
        self.operations.copy_files(vec![src], dst.parent().unwrap_or(&dst)).await?;
        Ok(FileOperationResult::Success)
    }
    
    /// Copy multiple files
    pub async fn copy_files(&self, files: Vec<PathBuf>, destination: &Path) -> Result<()> {
        self.operations.copy_files(files, destination).await
    }
    
    // ===== Utility Operations =====
    
    /// Get a preview of a file
    pub async fn get_file_preview(&self, path: &Path, max_lines: usize) -> Result<String> {
        utils::get_file_preview(path, max_lines, self.max_file_size).await
    }
    
    /// Search for files
    pub async fn search_files(&self, pattern: &str, path: Option<&Path>) -> Result<Vec<PathBuf>> {
        let search_path = path.unwrap_or(&self.root_path);
        utils::search_files(pattern, search_path, &self.root_path).await
    }
    
    /// Read file content
    pub async fn read_file(&self, path: &str) -> Result<String> {
        let file_path = PathBuf::from(path);
        
        // Check if file is binary
        if utils::is_binary_file(&file_path) {
            return Err(crate::error::OrchflowError::FileOperationError {
                path: file_path,
                operation: "read file".to_string(),
                reason: "Cannot read binary file".to_string(),
            });
        }
        
        tokio::fs::read_to_string(&file_path).await
            .map_err(|e| crate::error::OrchflowError::FileOperationError {
                path: file_path,
                operation: "read file".to_string(),
                reason: e.to_string(),
            })
    }
    
    /// Save file content
    pub async fn save_file(&self, path: &str, content: &str) -> Result<()> {
        let file_path = PathBuf::from(path);
        
        // Ensure path is safe
        if !utils::is_safe_path(&file_path, &self.root_path) {
            return Err(crate::error::OrchflowError::FileOperationError {
                path: file_path,
                operation: "save file".to_string(),
                reason: "Path must be within project root".to_string(),
            });
        }
        
        tokio::fs::write(&file_path, content).await
            .map_err(|e| crate::error::OrchflowError::FileOperationError {
                path: file_path.clone(),
                operation: "save file".to_string(),
                reason: e.to_string(),
            })?;
        
        // Invalidate cache
        self.cache.invalidate_path(&file_path).await;
        
        Ok(())
    }
    
    /// List directory contents
    pub async fn list_directory(&self, path: &str) -> Result<Vec<FileEntry>> {
        let dir_path = PathBuf::from(path);
        let mut entries = Vec::new();
        
        let mut dir_entries = tokio::fs::read_dir(&dir_path).await
            .map_err(|e| crate::error::OrchflowError::FileOperationError {
                path: dir_path.clone(),
                operation: "list directory".to_string(),
                reason: e.to_string(),
            })?;
        
        while let Some(entry) = dir_entries.next_entry().await
            .map_err(|e| crate::error::OrchflowError::FileOperationError {
                path: dir_path.clone(),
                operation: "read entry".to_string(),
                reason: e.to_string(),
            })? {
            
            let path = entry.path();
            let metadata = entry.metadata().await
                .map_err(|e| crate::error::OrchflowError::FileOperationError {
                    path: path.clone(),
                    operation: "read metadata".to_string(),
                    reason: e.to_string(),
                })?;
            
            let file_type = if metadata.is_dir() {
                FileEntryType::Directory
            } else if metadata.is_symlink() {
                FileEntryType::Symlink
            } else {
                FileEntryType::File
            };
            
            entries.push(FileEntry {
                path: path.to_string_lossy().to_string(),
                name: path.file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default(),
                file_type,
                size: Some(metadata.len()),
                modified: metadata.modified().ok()
                    .map(|t| chrono::DateTime::<chrono::Utc>::from(t)),
                permissions: None, // TODO: Get actual permissions
            });
        }
        
        // Sort entries
        entries.sort_by(|a, b| {
            match (&a.file_type, &b.file_type) {
                (FileEntryType::Directory, FileEntryType::File) => std::cmp::Ordering::Less,
                (FileEntryType::File, FileEntryType::Directory) => std::cmp::Ordering::Greater,
                _ => a.name.cmp(&b.name),
            }
        });
        
        Ok(entries)
    }
    
    // ===== History Operations =====
    
    /// Get operation history
    pub async fn get_operation_history(&self, limit: usize) -> Vec<FileOperation> {
        self.history.get_history(limit).await
    }
    
    /// Undo the last operation
    pub async fn undo_last_operation(&self) -> Result<()> {
        if let Some(operation) = self.history.get_last_undoable().await {
            history::undo_operation(&operation).await?;
            
            // Invalidate cache for affected paths
            self.cache.invalidate_path(&operation.source).await;
            if let Some(dest) = &operation.destination {
                self.cache.invalidate_path(dest).await;
            }
        }
        Ok(())
    }
    
    // ===== Trash Operations =====
    
    /// Move file/directory to trash with metadata tracking
    pub async fn move_to_trash(&self, path: &Path) -> Result<trash::TrashedItem> {
        let item = self.trash_manager.move_to_trash(path).await?;
        
        // Invalidate cache
        self.cache.invalidate_path(path).await;
        
        Ok(item)
    }
    
    /// List all trashed items
    pub async fn list_trash(&self) -> Vec<trash::TrashedItem> {
        self.trash_manager.list_trashed_items().await
    }
    
    /// Get trashed items from a specific directory
    pub async fn get_trash_from_directory(&self, dir: &Path) -> Vec<trash::TrashedItem> {
        self.trash_manager.get_trashed_from_directory(dir).await
    }
    
    /// Search trash by name
    pub async fn search_trash(&self, query: &str) -> Vec<trash::TrashedItem> {
        self.trash_manager.search_trashed_items(query).await
    }
    
    /// Get trash statistics
    pub async fn get_trash_stats(&self) -> trash::TrashStats {
        self.trash_manager.get_trash_stats().await
    }
    
    /// Get recently trashed items
    pub async fn get_recent_trash(&self, limit: usize) -> Vec<trash::TrashedItem> {
        self.trash_manager.get_recent_trashed(limit).await
    }
    
    /// Clean up old trash items
    pub async fn cleanup_old_trash(&self, days: i64) -> Result<Vec<trash::TrashedItem>> {
        self.trash_manager.cleanup_old_items(days).await
    }
    
    /// Empty trash (platform-specific)
    pub async fn empty_trash(&self) -> Result<()> {
        self.trash_manager.empty_trash().await
    }
    
    // ===== Git Operations =====
    
    /// Check if a path is ignored by git
    pub fn is_git_ignored(&self, path: &Path) -> bool {
        if let Some(ref git) = self.git_integration {
            git.lock().unwrap().check_ignore(path)
        } else {
            // Fall back to simple pattern matching
            git::is_ignored(path, &self.gitignore_patterns)
        }
    }
    
    /// Get git status for a file
    pub fn get_git_status(&self, path: &Path) -> Result<Option<FileGitStatus>> {
        if let Some(ref git) = self.git_integration {
            git.lock().unwrap().get_file_status(path)
        } else {
            Ok(None)
        }
    }
    
    /// Get git status for all files
    pub fn get_all_git_statuses(&self) -> Result<std::collections::HashMap<PathBuf, FileGitStatus>> {
        if let Some(ref git) = self.git_integration {
            git.lock().unwrap().get_all_statuses()
        } else {
            Ok(std::collections::HashMap::new())
        }
    }
    
    /// Get current git branch info
    pub fn get_git_branch_info(&self) -> Result<Option<BranchInfo>> {
        if let Some(ref git) = self.git_integration {
            Ok(Some(git.lock().unwrap().get_branch_info()?))
        } else {
            Ok(None)
        }
    }
    
    /// Check if repository has uncommitted changes
    pub fn has_uncommitted_changes(&self) -> Result<bool> {
        if let Some(ref git) = self.git_integration {
            git.lock().unwrap().has_uncommitted_changes()
        } else {
            Ok(false)
        }
    }
    
    /// Check if git is available for this repository
    pub fn has_git(&self) -> bool {
        self.git_integration.is_some()
    }
}

// Make FileManager cloneable by wrapping internals in Arc
impl Clone for FileManager {
    fn clone(&self) -> Self {
        // Note: GitIntegration is not cloneable, so we need to recreate it
        let git_integration = if self.git_integration.is_some() {
            GitIntegration::new(&self.root_path)
                .ok()
                .map(|git| Arc::new(Mutex::new(git)))
        } else {
            None
        };
        
        Self {
            root_path: self.root_path.clone(),
            cache: self.cache.clone(),
            history: self.history.clone(),
            operations: self.operations.clone(),
            trash_manager: self.trash_manager.clone(),
            git_integration,
            gitignore_patterns: self.gitignore_patterns.clone(),
            max_file_size: self.max_file_size,
        }
    }
}