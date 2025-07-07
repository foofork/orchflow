use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use tokio::fs;
use tokio::sync::RwLock;
use std::sync::Arc;
use chrono::{DateTime, Utc};
use crate::error::{OrchflowError, Result};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    pub path: PathBuf,
    pub name: String,
    pub node_type: FileNodeType,
    pub size: u64,
    pub modified: DateTime<Utc>,
    pub permissions: u32,
    pub children: Option<Vec<FileNode>>,
    pub is_expanded: bool,
    pub is_git_ignored: bool,
    pub git_status: Option<GitStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum FileNodeType {
    File,
    Directory,
    Symlink,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GitStatus {
    Untracked,
    Modified,
    Added,
    Deleted,
    Renamed,
    Copied,
    Unmerged,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileOperation {
    pub id: String,
    pub operation_type: FileOperationType,
    pub source: PathBuf,
    pub destination: Option<PathBuf>,
    pub timestamp: DateTime<Utc>,
    pub can_undo: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FileOperationType {
    Create,
    Delete,
    Move,
    Copy,
    Rename,
}

pub struct FileManager {
    root_path: PathBuf,
    file_tree_cache: Arc<RwLock<HashMap<PathBuf, FileNode>>>,
    expanded_dirs: Arc<RwLock<HashSet<PathBuf>>>,
    operation_history: Arc<RwLock<Vec<FileOperation>>>,
    gitignore_patterns: Arc<RwLock<Vec<String>>>,
    max_file_size: u64,
}

impl FileManager {
    pub fn new(root_path: PathBuf) -> Self {
        Self {
            root_path,
            file_tree_cache: Arc::new(RwLock::new(HashMap::new())),
            expanded_dirs: Arc::new(RwLock::new(HashSet::new())),
            operation_history: Arc::new(RwLock::new(Vec::new())),
            gitignore_patterns: Arc::new(RwLock::new(Vec::new())),
            max_file_size: 10 * 1024 * 1024, // 10MB default
        }
    }
    
    /// Build a complete file tree from the root path
    pub async fn build_file_tree(&self, max_depth: Option<usize>) -> Result<FileNode> {
        self.build_tree_recursive(&self.root_path, 0, max_depth).await
    }
    
    /// Build file tree recursively with depth limit
    async fn build_tree_recursive(
        &self,
        path: &Path,
        current_depth: usize,
        max_depth: Option<usize>,
    ) -> Result<FileNode> {
        // Check depth limit
        if let Some(max) = max_depth {
            if current_depth >= max {
                return self.create_node(path, false).await;
            }
        }
        
        let mut node = self.create_node(path, true).await?;
        
        // If it's a directory and should be expanded, load children
        if node.node_type == FileNodeType::Directory {
            let expanded = self.expanded_dirs.read().await;
            if expanded.contains(path) || current_depth == 0 {
                node.is_expanded = true;
                node.children = Some(self.load_children(path, current_depth, max_depth).await?);
            } else {
                node.children = Some(vec![]); // Empty but expandable
            }
        }
        
        // Cache the node
        self.file_tree_cache.write().await.insert(path.to_path_buf(), node.clone());
        
        Ok(node)
    }
    
    /// Create a file node from path
    async fn create_node(&self, path: &Path, check_git: bool) -> Result<FileNode> {
        let metadata = fs::metadata(path).await
            .map_err(|e| OrchflowError::FileError {
                operation: "read_metadata".to_string(),
                path: path.to_string_lossy().to_string(),
                reason: e.to_string(),
            })?;
        
        let node_type = if metadata.is_dir() {
            FileNodeType::Directory
        } else if metadata.is_symlink() {
            FileNodeType::Symlink
        } else {
            FileNodeType::File
        };
        
        let name = path.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        
        let modified = metadata.modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| DateTime::from_timestamp(d.as_secs() as i64, 0))
            .flatten()
            .unwrap_or_else(Utc::now);
        
        let mut node = FileNode {
            path: path.to_path_buf(),
            name,
            node_type,
            size: metadata.len(),
            modified,
            permissions: 0o755, // TODO: Get actual permissions
            children: None,
            is_expanded: false,
            is_git_ignored: false,
            git_status: None,
        };
        
        // Check git status if requested
        if check_git {
            node.is_git_ignored = self.is_git_ignored(path).await;
            node.git_status = self.get_git_status(path).await;
        }
        
        Ok(node)
    }
    
    /// Load children of a directory
    async fn load_children(
        &self,
        dir_path: &Path,
        current_depth: usize,
        max_depth: Option<usize>,
    ) -> Result<Vec<FileNode>> {
        let mut children = Vec::new();
        let mut entries = fs::read_dir(dir_path).await
            .map_err(|e| OrchflowError::FileError {
                operation: "read_directory".to_string(),
                path: dir_path.to_string_lossy().to_string(),
                reason: e.to_string(),
            })?;
        
        while let Some(entry) = entries.next_entry().await
            .map_err(|e| OrchflowError::FileError {
                operation: "read_entry".to_string(),
                path: dir_path.to_string_lossy().to_string(),
                reason: e.to_string(),
            })? {
            
            let child_path = entry.path();
            
            // Skip hidden files unless configured to show them
            if child_path.file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.starts_with('.'))
                .unwrap_or(false) {
                continue;
            }
            
            match self.build_tree_recursive(&child_path, current_depth + 1, max_depth).await {
                Ok(child) => children.push(child),
                Err(_) => continue, // Skip files we can't read
            }
        }
        
        // Sort: directories first, then alphabetically
        children.sort_by(|a, b| {
            match (&a.node_type, &b.node_type) {
                (FileNodeType::Directory, FileNodeType::Directory) => a.name.cmp(&b.name),
                (FileNodeType::Directory, _) => std::cmp::Ordering::Less,
                (_, FileNodeType::Directory) => std::cmp::Ordering::Greater,
                _ => a.name.cmp(&b.name),
            }
        });
        
        Ok(children)
    }
    
    /// Expand a directory in the tree
    pub async fn expand_directory(&self, path: &Path) -> Result<Vec<FileNode>> {
        self.expanded_dirs.write().await.insert(path.to_path_buf());
        self.load_children(path, 0, Some(1)).await
    }
    
    /// Collapse a directory in the tree
    pub async fn collapse_directory(&self, path: &Path) -> Result<()> {
        self.expanded_dirs.write().await.remove(path);
        
        // Update cache to mark as collapsed
        if let Some(mut node) = self.file_tree_cache.write().await.get_mut(path) {
            node.is_expanded = false;
            node.children = Some(vec![]);
        }
        
        Ok(())
    }
    
    /// Create a new file
    pub async fn create_file(&self, path: &Path, content: Option<&str>) -> Result<()> {
        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).await
                .map_err(|e| OrchflowError::FileError {
                    operation: "create_parent_dir".to_string(),
                    path: parent.to_string_lossy().to_string(),
                    reason: e.to_string(),
                })?;
        }
        
        // Write file
        fs::write(path, content.unwrap_or("")).await
            .map_err(|e| OrchflowError::FileError {
                operation: "create_file".to_string(),
                path: path.to_string_lossy().to_string(),
                reason: e.to_string(),
            })?;
        
        // Record operation
        self.record_operation(FileOperation {
            id: uuid::Uuid::new_v4().to_string(),
            operation_type: FileOperationType::Create,
            source: path.to_path_buf(),
            destination: None,
            timestamp: Utc::now(),
            can_undo: true,
        }).await;
        
        // Invalidate cache for parent
        if let Some(parent) = path.parent() {
            self.invalidate_cache(parent).await;
        }
        
        Ok(())
    }
    
    /// Create a new directory
    pub async fn create_directory(&self, path: &Path) -> Result<()> {
        fs::create_dir_all(path).await
            .map_err(|e| OrchflowError::FileError {
                operation: "create_directory".to_string(),
                path: path.to_string_lossy().to_string(),
                reason: e.to_string(),
            })?;
        
        self.record_operation(FileOperation {
            id: uuid::Uuid::new_v4().to_string(),
            operation_type: FileOperationType::Create,
            source: path.to_path_buf(),
            destination: None,
            timestamp: Utc::now(),
            can_undo: true,
        }).await;
        
        if let Some(parent) = path.parent() {
            self.invalidate_cache(parent).await;
        }
        
        Ok(())
    }
    
    /// Delete a file or directory (moves to trash)
    pub async fn delete(&self, path: &Path, permanent: bool) -> Result<()> {
        if !permanent {
            // TODO: Implement trash/recycle bin functionality
            // For now, just rename with .trash suffix
            let trash_path = path.with_extension(format!("{}.trash", 
                path.extension().unwrap_or_default().to_string_lossy()));
            
            fs::rename(path, &trash_path).await
                .map_err(|e| OrchflowError::FileError {
                    operation: "move_to_trash".to_string(),
                    path: path.to_string_lossy().to_string(),
                    reason: e.to_string(),
                })?;
        } else {
            // Permanent delete
            if path.is_dir() {
                fs::remove_dir_all(path).await
                    .map_err(|e| OrchflowError::FileError {
                        operation: "delete_directory".to_string(),
                        path: path.to_string_lossy().to_string(),
                        reason: e.to_string(),
                    })?;
            } else {
                fs::remove_file(path).await
                    .map_err(|e| OrchflowError::FileError {
                        operation: "delete_file".to_string(),
                        path: path.to_string_lossy().to_string(),
                        reason: e.to_string(),
                    })?;
            }
        }
        
        self.record_operation(FileOperation {
            id: uuid::Uuid::new_v4().to_string(),
            operation_type: FileOperationType::Delete,
            source: path.to_path_buf(),
            destination: None,
            timestamp: Utc::now(),
            can_undo: !permanent,
        }).await;
        
        if let Some(parent) = path.parent() {
            self.invalidate_cache(parent).await;
        }
        
        Ok(())
    }
    
    /// Rename a file or directory
    pub async fn rename(&self, old_path: &Path, new_name: &str) -> Result<()> {
        let new_path = old_path.parent()
            .ok_or_else(|| OrchflowError::FileError {
                operation: "rename".to_string(),
                path: old_path.to_string_lossy().to_string(),
                reason: "No parent directory".to_string(),
            })?
            .join(new_name);
        
        fs::rename(old_path, &new_path).await
            .map_err(|e| OrchflowError::FileError {
                operation: "rename".to_string(),
                path: old_path.to_string_lossy().to_string(),
                reason: e.to_string(),
            })?;
        
        self.record_operation(FileOperation {
            id: uuid::Uuid::new_v4().to_string(),
            operation_type: FileOperationType::Rename,
            source: old_path.to_path_buf(),
            destination: Some(new_path),
            timestamp: Utc::now(),
            can_undo: true,
        }).await;
        
        if let Some(parent) = old_path.parent() {
            self.invalidate_cache(parent).await;
        }
        
        Ok(())
    }
    
    /// Move files to a new location
    pub async fn move_files(&self, files: Vec<PathBuf>, destination: &Path) -> Result<()> {
        // Ensure destination exists and is a directory
        if !destination.is_dir() {
            return Err(OrchflowError::FileError {
                operation: "move_files".to_string(),
                path: destination.to_string_lossy().to_string(),
                reason: "Destination must be a directory".to_string(),
            });
        }
        
        for file_path in files {
            let file_name = file_path.file_name()
                .ok_or_else(|| OrchflowError::FileError {
                    operation: "move_file".to_string(),
                    path: file_path.to_string_lossy().to_string(),
                    reason: "Invalid file name".to_string(),
                })?;
            
            let new_path = destination.join(file_name);
            
            fs::rename(&file_path, &new_path).await
                .map_err(|e| OrchflowError::FileError {
                    operation: "move_file".to_string(),
                    path: file_path.to_string_lossy().to_string(),
                    reason: e.to_string(),
                })?;
            
            self.record_operation(FileOperation {
                id: uuid::Uuid::new_v4().to_string(),
                operation_type: FileOperationType::Move,
                source: file_path.clone(),
                destination: Some(new_path),
                timestamp: Utc::now(),
                can_undo: true,
            }).await;
            
            // Invalidate cache for both source and destination
            if let Some(parent) = file_path.parent() {
                self.invalidate_cache(parent).await;
            }
        }
        
        self.invalidate_cache(destination).await;
        Ok(())
    }
    
    /// Copy files to a new location
    pub async fn copy_files(&self, files: Vec<PathBuf>, destination: &Path) -> Result<()> {
        for file_path in files {
            let file_name = file_path.file_name()
                .ok_or_else(|| OrchflowError::FileError {
                    operation: "copy_file".to_string(),
                    path: file_path.to_string_lossy().to_string(),
                    reason: "Invalid file name".to_string(),
                })?;
            
            let new_path = destination.join(file_name);
            
            if file_path.is_dir() {
                self.copy_directory(&file_path, &new_path).await?;
            } else {
                fs::copy(&file_path, &new_path).await
                    .map_err(|e| OrchflowError::FileError {
                        operation: "copy_file".to_string(),
                        path: file_path.to_string_lossy().to_string(),
                        reason: e.to_string(),
                    })?;
            }
            
            self.record_operation(FileOperation {
                id: uuid::Uuid::new_v4().to_string(),
                operation_type: FileOperationType::Copy,
                source: file_path,
                destination: Some(new_path),
                timestamp: Utc::now(),
                can_undo: false,
            }).await;
        }
        
        self.invalidate_cache(destination).await;
        Ok(())
    }
    
    /// Copy directory recursively
    fn copy_directory<'a>(
        &'a self,
        src: &'a Path,
        dst: &'a Path,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<()>> + 'a>> {
        Box::pin(async move {
        fs::create_dir_all(dst).await
            .map_err(|e| OrchflowError::FileError {
                operation: "create_directory".to_string(),
                path: dst.to_string_lossy().to_string(),
                reason: e.to_string(),
            })?;
        
        let mut entries = fs::read_dir(src).await
            .map_err(|e| OrchflowError::FileError {
                operation: "read_directory".to_string(),
                path: src.to_string_lossy().to_string(),
                reason: e.to_string(),
            })?;
        
        while let Some(entry) = entries.next_entry().await
            .map_err(|e| OrchflowError::FileError {
                operation: "read_entry".to_string(),
                path: src.to_string_lossy().to_string(),
                reason: e.to_string(),
            })? {
            
            let entry_path = entry.path();
            let file_name = entry.file_name();
            let dst_path = dst.join(&file_name);
            
            if entry_path.is_dir() {
                self.copy_directory(&entry_path, &dst_path).await?;
            } else {
                fs::copy(&entry_path, &dst_path).await
                    .map_err(|e| OrchflowError::FileError {
                        operation: "copy_file".to_string(),
                        path: entry_path.to_string_lossy().to_string(),
                        reason: e.to_string(),
                    })?;
            }
        }
        
        Ok(())
        })
    }
    
    /// Get file content preview
    pub async fn get_file_preview(&self, path: &Path, max_lines: usize) -> Result<String> {
        // Check file size first
        let metadata = fs::metadata(path).await
            .map_err(|e| OrchflowError::FileError {
                operation: "read_metadata".to_string(),
                path: path.to_string_lossy().to_string(),
                reason: e.to_string(),
            })?;
        
        if metadata.len() > self.max_file_size {
            return Ok(format!("[File too large: {} bytes]", metadata.len()));
        }
        
        let content = fs::read_to_string(path).await
            .map_err(|e| OrchflowError::FileError {
                operation: "read_file".to_string(),
                path: path.to_string_lossy().to_string(),
                reason: e.to_string(),
            })?;
        
        let lines: Vec<&str> = content.lines().take(max_lines).collect();
        Ok(lines.join("\n"))
    }
    
    /// Search for files matching pattern
    pub async fn search_files(&self, pattern: &str, path: Option<&Path>) -> Result<Vec<PathBuf>> {
        let search_path = path.unwrap_or(&self.root_path);
        let mut results = Vec::new();
        
        self.search_recursive(search_path, pattern, &mut results).await?;
        Ok(results)
    }
    
    fn search_recursive<'a>(
        &'a self,
        dir: &'a Path,
        pattern: &'a str,
        results: &'a mut Vec<PathBuf>,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<()>> + 'a>> {
        Box::pin(async move {
        let mut entries = fs::read_dir(dir).await
            .map_err(|e| OrchflowError::FileError {
                operation: "read_directory".to_string(),
                path: dir.to_string_lossy().to_string(),
                reason: e.to_string(),
            })?;
        
        while let Some(entry) = entries.next_entry().await
            .map_err(|e| OrchflowError::FileError {
                operation: "read_entry".to_string(),
                path: dir.to_string_lossy().to_string(),
                reason: e.to_string(),
            })? {
            
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            
            // Check if name matches pattern
            if name.contains(pattern) {
                results.push(path.clone());
            }
            
            // Recurse into directories
            if path.is_dir() && !self.is_git_ignored(&path).await {
                let _ = self.search_recursive(&path, pattern, results).await;
            }
        }
        
        Ok(())
        })
    }
    
    /// Check if path is git ignored
    async fn is_git_ignored(&self, _path: &Path) -> bool {
        // TODO: Implement proper gitignore checking
        false
    }
    
    /// Get git status for a path
    async fn get_git_status(&self, _path: &Path) -> Option<GitStatus> {
        // TODO: Implement git status checking
        None
    }
    
    /// Record a file operation for undo history
    async fn record_operation(&self, operation: FileOperation) {
        let mut history = self.operation_history.write().await;
        history.push(operation);
        
        // Keep only last 100 operations
        if history.len() > 100 {
            let drain_count = history.len() - 100;
            history.drain(0..drain_count);
        }
    }
    
    /// Invalidate cache for a path
    async fn invalidate_cache(&self, path: &Path) {
        self.file_tree_cache.write().await.remove(path);
    }
    
    /// Get operation history
    pub async fn get_operation_history(&self, limit: usize) -> Vec<FileOperation> {
        let history = self.operation_history.read().await;
        history.iter()
            .rev()
            .take(limit)
            .cloned()
            .collect()
    }
    
    /// Undo last operation
    pub async fn undo_last_operation(&self) -> Result<()> {
        let operation = {
            let mut history = self.operation_history.write().await;
            history.pop()
        };
        
        if let Some(op) = operation {
            if !op.can_undo {
                return Err(OrchflowError::ValidationError {
                    field: "operation".to_string(),
                    reason: "Operation cannot be undone".to_string(),
                });
            }
            
            match op.operation_type {
                FileOperationType::Create => {
                    // Delete the created file/directory
                    self.delete(&op.source, true).await?;
                }
                FileOperationType::Delete => {
                    // Restore from trash
                    let trash_path = op.source.with_extension(format!("{}.trash", 
                        op.source.extension().unwrap_or_default().to_string_lossy()));
                    if trash_path.exists() {
                        fs::rename(&trash_path, &op.source).await
                            .map_err(|e| OrchflowError::FileError {
                                operation: "restore_from_trash".to_string(),
                                path: op.source.to_string_lossy().to_string(),
                                reason: e.to_string(),
                            })?;
                    }
                }
                FileOperationType::Move | FileOperationType::Rename => {
                    // Move back to original location
                    if let Some(dest) = op.destination {
                        fs::rename(&dest, &op.source).await
                            .map_err(|e| OrchflowError::FileError {
                                operation: "undo_move".to_string(),
                                path: dest.to_string_lossy().to_string(),
                                reason: e.to_string(),
                            })?;
                    }
                }
                _ => {
                    return Err(OrchflowError::ValidationError {
                        field: "operation_type".to_string(),
                        reason: format!("Cannot undo {:?} operation", op.operation_type),
                    });
                }
            }
        }
        
        Ok(())
    }
}