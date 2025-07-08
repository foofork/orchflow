// Git integration for file manager
use std::path::{Path, PathBuf};
use std::collections::HashMap;
use git2::{Repository, Status, StatusOptions};
use ignore::gitignore::{Gitignore, GitignoreBuilder};
use crate::error::{Result, OrchflowError};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum GitStatus {
    #[serde(rename = "untracked")]
    Untracked,
    #[serde(rename = "modified")]
    Modified,
    #[serde(rename = "added")]
    Added,
    #[serde(rename = "deleted")]
    Deleted,
    #[serde(rename = "renamed")]
    Renamed,
    #[serde(rename = "conflicted")]
    Conflicted,
    #[serde(rename = "ignored")]
    Ignored,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchInfo {
    pub name: String,
    pub is_detached: bool,
    pub upstream: Option<String>,
    pub ahead: usize,
    pub behind: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileGitStatus {
    pub path: PathBuf,
    pub status: GitStatus,
    pub staged: bool,
}

pub struct GitIntegration {
    repo: Repository,
    gitignore: Gitignore,
    root_path: PathBuf,
}

impl GitIntegration {
    /// Create a new GitIntegration for the given repository path
    pub fn new(repo_path: &Path) -> Result<Self> {
        // Open the repository
        let repo = Repository::open(repo_path)
            .map_err(|e| OrchflowError::FileOperationError {
                path: repo_path.to_path_buf(),
                operation: "open git repository".to_string(),
                reason: e.to_string(),
            })?;
        
        // Build gitignore matcher
        let gitignore = Self::build_gitignore_matcher(repo_path)?;
        
        Ok(Self {
            repo,
            gitignore,
            root_path: repo_path.to_path_buf(),
        })
    }
    
    /// Build a gitignore matcher from all .gitignore files in the repository
    fn build_gitignore_matcher(repo_path: &Path) -> Result<Gitignore> {
        let mut builder = GitignoreBuilder::new(repo_path);
        
        // Add .gitignore from repository root
        let root_gitignore = repo_path.join(".gitignore");
        if root_gitignore.exists() {
            builder.add(&root_gitignore);
        }
        
        // Add global gitignore if it exists
        if let Some(home) = dirs::home_dir() {
            let global_gitignore = home.join(".gitignore_global");
            if global_gitignore.exists() {
                builder.add(&global_gitignore);
            }
        }
        
        // Always ignore .git directory
        builder.add_line(None, ".git/").ok();
        
        builder.build()
            .map_err(|e| OrchflowError::FileOperationError {
                path: repo_path.to_path_buf(),
                operation: "build gitignore".to_string(),
                reason: e.to_string(),
            })
    }
    
    /// Check if a path should be ignored according to gitignore rules
    pub fn check_ignore(&self, path: &Path) -> bool {
        // Convert to relative path if absolute
        let relative_path = if path.is_absolute() {
            path.strip_prefix(&self.root_path).unwrap_or(path)
        } else {
            path
        };
        
        matches!(self.gitignore.matched(relative_path, path.is_dir()), ignore::Match::Ignore(..))
    }
    
    /// Get the git status for a single file
    pub fn get_file_status(&self, path: &Path) -> Result<Option<FileGitStatus>> {
        let relative_path = path.strip_prefix(&self.root_path)
            .map_err(|_| OrchflowError::FileOperationError {
                path: path.to_path_buf(),
                operation: "get relative path".to_string(),
                reason: "Path is not within repository".to_string(),
            })?;
        
        let mut opts = StatusOptions::new();
        opts.include_untracked(true)
            .include_ignored(false)
            .include_unmodified(false);
        
        let statuses = self.repo.statuses(Some(&mut opts))
            .map_err(|e| OrchflowError::FileOperationError {
                path: path.to_path_buf(),
                operation: "get git status".to_string(),
                reason: e.to_string(),
            })?;
        
        for entry in statuses.iter() {
            if let Some(entry_path) = entry.path() {
                if Path::new(entry_path) == relative_path {
                    let status = Self::convert_git_status(entry.status());
                    let staged = entry.status().contains(Status::INDEX_NEW) ||
                                entry.status().contains(Status::INDEX_MODIFIED) ||
                                entry.status().contains(Status::INDEX_DELETED);
                    
                    return Ok(Some(FileGitStatus {
                        path: path.to_path_buf(),
                        status,
                        staged,
                    }));
                }
            }
        }
        
        // Check if file is ignored
        if self.check_ignore(path) {
            return Ok(Some(FileGitStatus {
                path: path.to_path_buf(),
                status: GitStatus::Ignored,
                staged: false,
            }));
        }
        
        Ok(None)
    }
    
    /// Get git status for all files in the repository
    pub fn get_all_statuses(&self) -> Result<HashMap<PathBuf, FileGitStatus>> {
        let mut result = HashMap::new();
        
        let mut opts = StatusOptions::new();
        opts.include_untracked(true)
            .include_ignored(false)
            .include_unmodified(false);
        
        let statuses = self.repo.statuses(Some(&mut opts))
            .map_err(|e| OrchflowError::FileOperationError {
                path: self.root_path.clone(),
                operation: "get git statuses".to_string(),
                reason: e.to_string(),
            })?;
        
        for entry in statuses.iter() {
            if let Some(path_str) = entry.path() {
                let path = self.root_path.join(path_str);
                let status = Self::convert_git_status(entry.status());
                let staged = entry.status().contains(Status::INDEX_NEW) ||
                            entry.status().contains(Status::INDEX_MODIFIED) ||
                            entry.status().contains(Status::INDEX_DELETED);
                
                result.insert(path.clone(), FileGitStatus {
                    path,
                    status,
                    staged,
                });
            }
        }
        
        Ok(result)
    }
    
    /// Get current branch information
    pub fn get_branch_info(&self) -> Result<BranchInfo> {
        let head = self.repo.head()
            .map_err(|e| OrchflowError::FileOperationError {
                path: self.root_path.clone(),
                operation: "get git head".to_string(),
                reason: e.to_string(),
            })?;
        
        let is_detached = self.repo.head_detached()
            .map_err(|e| OrchflowError::FileOperationError {
                path: self.root_path.clone(),
                operation: "check head detached".to_string(),
                reason: e.to_string(),
            })?;
        
        let name = if is_detached {
            head.target()
                .map(|oid| oid.to_string())
                .unwrap_or_else(|| "unknown".to_string())
        } else {
            head.shorthand()
                .unwrap_or("unknown")
                .to_string()
        };
        
        // Get upstream branch info
        let (upstream, ahead, behind) = if let Ok(local_branch) = head.resolve() {
            if let Some(branch_name) = local_branch.name() {
                if let Ok(branch) = self.repo.find_branch(branch_name, git2::BranchType::Local) {
                    if let Ok(upstream) = branch.upstream() {
                        let upstream_name = upstream.name()
                            .ok()
                            .flatten()
                            .map(|s| s.to_string());
                        
                        // Calculate ahead/behind
                        let (ahead, behind) = if let (Some(local_oid), Some(upstream_oid)) = 
                            (local_branch.target(), upstream.get().target()) {
                            self.repo.graph_ahead_behind(local_oid, upstream_oid)
                                .unwrap_or((0, 0))
                        } else {
                            (0, 0)
                        };
                        
                        (upstream_name, ahead, behind)
                    } else {
                        (None, 0, 0)
                    }
                } else {
                    (None, 0, 0)
                }
            } else {
                (None, 0, 0)
            }
        } else {
            (None, 0, 0)
        };
        
        Ok(BranchInfo {
            name,
            is_detached,
            upstream,
            ahead,
            behind,
        })
    }
    
    /// Convert git2 status flags to our GitStatus enum
    fn convert_git_status(status: Status) -> GitStatus {
        if status.contains(Status::CONFLICTED) {
            GitStatus::Conflicted
        } else if status.contains(Status::WT_NEW) || status.contains(Status::INDEX_NEW) {
            GitStatus::Added
        } else if status.contains(Status::WT_DELETED) || status.contains(Status::INDEX_DELETED) {
            GitStatus::Deleted
        } else if status.contains(Status::WT_RENAMED) || status.contains(Status::INDEX_RENAMED) {
            GitStatus::Renamed
        } else if status.contains(Status::WT_MODIFIED) || status.contains(Status::INDEX_MODIFIED) {
            GitStatus::Modified
        } else if status.contains(Status::IGNORED) {
            GitStatus::Ignored
        } else {
            GitStatus::Untracked
        }
    }
    
    /// Check if the repository has uncommitted changes
    pub fn has_uncommitted_changes(&self) -> Result<bool> {
        let mut opts = StatusOptions::new();
        opts.include_untracked(false);
        
        let statuses = self.repo.statuses(Some(&mut opts))
            .map_err(|e| OrchflowError::FileOperationError {
                path: self.root_path.clone(),
                operation: "check uncommitted changes".to_string(),
                reason: e.to_string(),
            })?;
        
        Ok(!statuses.is_empty())
    }
    
    /// Get the repository root path
    pub fn get_root_path(&self) -> &Path {
        &self.root_path
    }
}

/// Load gitignore patterns from a repository (for compatibility)
pub async fn load_gitignore_patterns(repo_path: &Path) -> Vec<String> {
    let gitignore_path = repo_path.join(".gitignore");
    if gitignore_path.exists() {
        if let Ok(contents) = tokio::fs::read_to_string(&gitignore_path).await {
            contents
                .lines()
                .filter(|line| !line.trim().is_empty() && !line.trim().starts_with('#'))
                .map(|s| s.to_string())
                .collect()
        } else {
            Vec::new()
        }
    } else {
        Vec::new()
    }
}

/// Check if path matches gitignore patterns (for compatibility)
pub fn is_ignored(path: &Path, patterns: &[String]) -> bool {
    let path_str = path.to_string_lossy();
    patterns.iter().any(|pattern| {
        if pattern.ends_with('/') {
            path.is_dir() && path_str.contains(pattern.trim_end_matches('/'))
        } else {
            path_str.contains(pattern)
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use std::fs;
    
    #[test]
    fn test_gitignore_checking() {
        let temp_dir = TempDir::new().unwrap();
        let repo_path = temp_dir.path();
        
        // Initialize a git repo
        Repository::init(repo_path).unwrap();
        
        // Create .gitignore
        let gitignore_content = "*.log\ntarget/\n.DS_Store";
        fs::write(repo_path.join(".gitignore"), gitignore_content).unwrap();
        
        let git = GitIntegration::new(repo_path).unwrap();
        
        // Test ignored files
        assert!(git.check_ignore(&repo_path.join("test.log")));
        assert!(git.check_ignore(&repo_path.join("target")));
        assert!(git.check_ignore(&repo_path.join(".DS_Store")));
        
        // Test non-ignored files
        assert!(!git.check_ignore(&repo_path.join("main.rs")));
        assert!(!git.check_ignore(&repo_path.join("Cargo.toml")));
    }
    
    #[test]
    fn test_git_status_detection() {
        let temp_dir = TempDir::new().unwrap();
        let repo_path = temp_dir.path();
        
        // Initialize a git repo
        let repo = Repository::init(repo_path).unwrap();
        
        // Create a file
        let test_file = repo_path.join("test.txt");
        fs::write(&test_file, "initial content").unwrap();
        
        let git = GitIntegration::new(repo_path).unwrap();
        
        // Check untracked file
        let status = git.get_file_status(&test_file).unwrap();
        assert!(status.is_some());
        assert_eq!(status.unwrap().status, GitStatus::Untracked);
        
        // Stage and commit the file
        let mut index = repo.index().unwrap();
        index.add_path(Path::new("test.txt")).unwrap();
        index.write().unwrap();
        
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let sig = git2::Signature::now("Test", "test@example.com").unwrap();
        repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            "Initial commit",
            &tree,
            &[],
        ).unwrap();
        
        // Modify the file
        fs::write(&test_file, "modified content").unwrap();
        
        // Check modified status
        let status = git.get_file_status(&test_file).unwrap();
        assert!(status.is_some());
        assert_eq!(status.unwrap().status, GitStatus::Modified);
    }
}