// File tree building and caching

use std::collections::{HashMap, HashSet, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc};
use crate::error::{OrchflowError, Result};
use super::types::{FileNode, FileNodeType};
use super::git;

#[derive(Clone)]
pub struct FileTreeCache {
    cache: Arc<RwLock<HashMap<PathBuf, FileNode>>>,
    expanded_dirs: Arc<RwLock<HashSet<PathBuf>>>,
}

impl FileTreeCache {
    pub fn new() -> Self {
        Self {
            cache: Arc::new(RwLock::new(HashMap::new())),
            expanded_dirs: Arc::new(RwLock::new(HashSet::new())),
        }
    }
    
    /// Build a complete file tree from the root path (iterative version)
    pub async fn build_tree(
        &self,
        root_path: &Path,
        max_depth: Option<usize>,
        gitignore_patterns: &[String],
    ) -> Result<FileNode> {
        let root = self.create_node(root_path, true, gitignore_patterns).await?;
        
        if root.node_type != FileNodeType::Directory {
            return Ok(root);
        }
        
        // Use a queue for breadth-first traversal
        let mut queue = VecDeque::new();
        queue.push_back((root_path.to_path_buf(), 0));
        
        let mut nodes: HashMap<PathBuf, FileNode> = HashMap::new();
        nodes.insert(root_path.to_path_buf(), root);
        
        while let Some((dir_path, depth)) = queue.pop_front() {
            if let Some(max_d) = max_depth {
                if depth >= max_d {
                    continue;
                }
            }
            
            match self.load_children_simple(&dir_path, gitignore_patterns).await {
                Ok(child_paths) => {
                    let mut children = Vec::new();
                    
                    for child_path in child_paths {
                        match self.create_node(&child_path, false, gitignore_patterns).await {
                            Ok(child_node) => {
                                if child_node.node_type == FileNodeType::Directory {
                                    queue.push_back((child_path.clone(), depth + 1));
                                }
                                children.push(child_node.clone());
                                nodes.insert(child_path, child_node);
                            }
                            Err(_) => continue,
                        }
                    }
                    
                    if let Some(parent_node) = nodes.get_mut(&dir_path) {
                        parent_node.children = Some(children);
                    }
                }
                Err(_) => continue,
            }
        }
        
        // Update cache
        let mut cache = self.cache.write().await;
        cache.extend(nodes.clone());
        
        Ok(nodes.get(root_path).cloned().unwrap())
    }
    
    /// Load children of a directory
    async fn load_children_simple(&self, dir_path: &Path, gitignore_patterns: &[String]) -> Result<Vec<PathBuf>> {
        let mut children = Vec::new();
        let mut entries = tokio::fs::read_dir(dir_path).await
            .map_err(|e| OrchflowError::FileOperationError {
                path: dir_path.to_path_buf(),
                operation: "read directory".to_string(),
                reason: e.to_string(),
            })?;
        
        while let Some(entry) = entries.next_entry().await.map_err(|e| {
            OrchflowError::FileOperationError {
                path: dir_path.to_path_buf(),
                operation: "read entry".to_string(),
                reason: e.to_string(),
            }
        })? {
            let path = entry.path();
            
            // Skip hidden files and gitignored files
            if let Some(name) = path.file_name() {
                let name_str = name.to_string_lossy();
                if name_str.starts_with('.') && name_str != ".gitignore" {
                    continue;
                }
            }
            
            if git::matches_gitignore_pattern(&path, gitignore_patterns) {
                continue;
            }
            
            children.push(path);
        }
        
        // Sort children: directories first, then alphabetically
        children.sort_by(|a, b| {
            let a_is_dir = a.is_dir();
            let b_is_dir = b.is_dir();
            
            match (a_is_dir, b_is_dir) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.file_name().cmp(&b.file_name()),
            }
        });
        
        Ok(children)
    }
    
    /// Create a file node from a path
    async fn create_node(&self, path: &Path, check_git: bool, gitignore_patterns: &[String]) -> Result<FileNode> {
        let metadata = tokio::fs::metadata(path).await
            .map_err(|e| OrchflowError::FileOperationError {
                path: path.to_path_buf(),
                operation: "read metadata".to_string(),
                reason: e.to_string(),
            })?;
        
        let node_type = if metadata.is_dir() {
            FileNodeType::Directory
        } else if metadata.is_symlink() {
            FileNodeType::Symlink
        } else {
            FileNodeType::File
        };
        
        let modified = metadata.modified()
            .map(|t| DateTime::<Utc>::from(t))
            .unwrap_or_else(|_| Utc::now());
        
        let is_git_ignored = if check_git {
            git::is_git_ignored(path).await || git::matches_gitignore_pattern(path, gitignore_patterns)
        } else {
            false
        };
        
        let git_status = if check_git && !is_git_ignored {
            git::get_git_status(path).await
        } else {
            None
        };
        
        Ok(FileNode {
            path: path.to_path_buf(),
            name: path.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| path.to_string_lossy().to_string()),
            node_type,
            size: metadata.len(),
            modified,
            permissions: 0o644, // TODO: Get actual permissions
            children: None,
            is_expanded: false,
            is_git_ignored,
            git_status,
        })
    }
    
    /// Expand a directory in the tree
    pub async fn expand_directory(&self, path: &Path, gitignore_patterns: &[String]) -> Result<Vec<FileNode>> {
        let children = self.load_children_simple(path, gitignore_patterns).await?;
        let mut child_nodes = Vec::new();
        
        for child_path in children {
            let node = self.create_node(&child_path, true, gitignore_patterns).await?;
            child_nodes.push(node.clone());
            
            // Update cache
            let mut cache = self.cache.write().await;
            cache.insert(child_path, node);
        }
        
        // Mark directory as expanded
        let mut expanded = self.expanded_dirs.write().await;
        expanded.insert(path.to_path_buf());
        
        // Update parent node in cache
        if let Some(parent) = self.cache.write().await.get_mut(path) {
            parent.is_expanded = true;
            parent.children = Some(child_nodes.clone());
        }
        
        Ok(child_nodes)
    }
    
    /// Collapse a directory in the tree
    pub async fn collapse_directory(&self, path: &Path) -> Result<()> {
        let mut expanded = self.expanded_dirs.write().await;
        expanded.remove(path);
        
        // Update node in cache
        if let Some(node) = self.cache.write().await.get_mut(path) {
            node.is_expanded = false;
        }
        
        Ok(())
    }
    
    /// Invalidate cache for a path and its parents
    pub async fn invalidate_path(&self, path: &Path) {
        let mut cache = self.cache.write().await;
        cache.remove(path);
        
        // Also invalidate parent directories
        let mut current = path.to_path_buf();
        while let Some(parent) = current.parent() {
            if let Some(parent_node) = cache.get_mut(parent) {
                parent_node.children = None;
            }
            current = parent.to_path_buf();
        }
    }
    
    /// Get a node from cache
    pub async fn get_node(&self, path: &Path) -> Option<FileNode> {
        let cache = self.cache.read().await;
        cache.get(path).cloned()
    }
    
    /// Check if a directory is expanded
    pub async fn is_expanded(&self, path: &Path) -> bool {
        let expanded = self.expanded_dirs.read().await;
        expanded.contains(path)
    }
}