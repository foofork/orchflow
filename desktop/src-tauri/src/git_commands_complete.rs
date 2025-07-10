// Complete Git command implementation for Tauri
// This includes both the existing read-only commands and the new write commands

use tauri::State;
use crate::manager::Manager;
use crate::error::{Result, OrchflowError};
use serde::{Serialize, Deserialize};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::process::Command;
use git2::{Repository, StatusOptions, Index, Signature, Oid, ObjectType};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatusResult {
    pub branch: String,
    pub is_detached: bool,
    pub upstream: Option<String>,
    pub ahead: usize,
    pub behind: usize,
    pub staged: Vec<GitFileStatus>,
    pub unstaged: Vec<GitFileStatus>,
    pub untracked: Vec<GitFileStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitFileStatus {
    pub path: String,
    pub status: String,
}

// ===== Existing read-only commands =====

/// Get git status for a specific file
#[tauri::command]
pub async fn get_file_git_status(
    path: String,
    manager: State<'_, Manager>,
) -> Result<Option<Value>> {
    if let Some(file_manager) = &manager.file_manager {
        let file_path = PathBuf::from(path);
        let status = file_manager.get_git_status(&file_path)?;
        Ok(status.map(|s| serde_json::to_value(s).unwrap()))
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "file_manager".to_string(),
            reason: "File manager not initialized".to_string(),
        })
    }
}

/// Get git status for all files in the repository
#[tauri::command]
pub async fn get_all_git_statuses(
    manager: State<'_, Manager>,
) -> Result<Value> {
    if let Some(file_manager) = &manager.file_manager {
        let statuses = file_manager.get_all_git_statuses()?;
        Ok(serde_json::to_value(statuses).unwrap())
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "file_manager".to_string(),
            reason: "File manager not initialized".to_string(),
        })
    }
}

/// Get current git branch information
#[tauri::command]
pub async fn get_git_branch_info(
    manager: State<'_, Manager>,
) -> Result<Option<Value>> {
    if let Some(file_manager) = &manager.file_manager {
        let branch_info = file_manager.get_git_branch_info()?;
        Ok(branch_info.map(|b| serde_json::to_value(b).unwrap()))
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "file_manager".to_string(),
            reason: "File manager not initialized".to_string(),
        })
    }
}

/// Check if repository has uncommitted changes
#[tauri::command]
pub async fn has_uncommitted_changes(
    manager: State<'_, Manager>,
) -> Result<bool> {
    if let Some(file_manager) = &manager.file_manager {
        file_manager.has_uncommitted_changes()
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "file_manager".to_string(),
            reason: "File manager not initialized".to_string(),
        })
    }
}

/// Check if git is available for the current repository
#[tauri::command]
pub fn has_git_integration(
    manager: State<'_, Manager>,
) -> Result<bool> {
    if let Some(file_manager) = &manager.file_manager {
        Ok(file_manager.has_git())
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "file_manager".to_string(),
            reason: "File manager not initialized".to_string(),
        })
    }
}

/// Check if a path is ignored by git
#[tauri::command]
pub fn is_git_ignored(
    path: String,
    manager: State<'_, Manager>,
) -> Result<bool> {
    if let Some(file_manager) = &manager.file_manager {
        let file_path = PathBuf::from(path);
        Ok(file_manager.is_git_ignored(&file_path))
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "file_manager".to_string(),
            reason: "File manager not initialized".to_string(),
        })
    }
}

// ===== New commands for GitPanel =====

/// Get the complete git status for the repository
#[tauri::command]
pub async fn git_status(
    manager: State<'_, Manager>,
) -> Result<GitStatusResult> {
    let project_root = manager.project_root.clone()
        .ok_or_else(|| OrchflowError::ConfigurationError {
            component: "git".to_string(),
            reason: "No project root set".to_string(),
        })?;
    
    let repo = Repository::open(&project_root)
        .map_err(|e| OrchflowError::GitError {
            operation: "open repository".to_string(),
            details: e.to_string(),
        })?;
    
    // Get branch info
    let head = repo.head()
        .map_err(|e| OrchflowError::GitError {
            operation: "get head".to_string(),
            details: e.to_string(),
        })?;
    
    let is_detached = repo.head_detached()
        .unwrap_or(false);
    
    let branch = if is_detached {
        head.target()
            .map(|oid| oid.to_string())
            .unwrap_or_else(|| "unknown".to_string())
    } else {
        head.shorthand()
            .unwrap_or("unknown")
            .to_string()
    };
    
    // Get upstream info
    let (upstream, ahead, behind) = get_upstream_info(&repo, &head)?;
    
    // Get file statuses
    let (staged, unstaged, untracked) = get_file_statuses(&repo)?;
    
    Ok(GitStatusResult {
        branch,
        is_detached,
        upstream,
        ahead,
        behind,
        staged,
        unstaged,
        untracked,
    })
}

/// Get diff for a specific file
#[tauri::command]
pub async fn git_diff(
    path: String,
    staged: bool,
    manager: State<'_, Manager>,
) -> Result<String> {
    let project_root = manager.project_root.clone()
        .ok_or_else(|| OrchflowError::ConfigurationError {
            component: "git".to_string(),
            reason: "No project root set".to_string(),
        })?;
    
    let repo = Repository::open(&project_root)
        .map_err(|e| OrchflowError::GitError {
            operation: "open repository".to_string(),
            details: e.to_string(),
        })?;
    
    let diff = if staged {
        // Get diff between HEAD and index (staged changes)
        let head = repo.head()?.peel_to_tree()?;
        let index = repo.index()?;
        let index_tree = repo.find_tree(index.write_tree()?)?;
        repo.diff_tree_to_tree(Some(&head), Some(&index_tree), None)?
    } else {
        // Get diff between index and working directory (unstaged changes)
        repo.diff_index_to_workdir(None, None)?
    };
    
    let mut diff_text = String::new();
    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        let content = std::str::from_utf8(line.content()).unwrap_or("");
        let prefix = match line.origin() {
            '+' => "+",
            '-' => "-",
            ' ' => " ",
            _ => "",
        };
        diff_text.push_str(&format!("{}{}", prefix, content));
        true
    })?;
    
    Ok(diff_text)
}

/// Stage a file
#[tauri::command]
pub async fn git_stage(
    path: String,
    manager: State<'_, Manager>,
) -> Result<()> {
    let project_root = manager.project_root.clone()
        .ok_or_else(|| OrchflowError::ConfigurationError {
            component: "git".to_string(),
            reason: "No project root set".to_string(),
        })?;
    
    let repo = Repository::open(&project_root)
        .map_err(|e| OrchflowError::GitError {
            operation: "open repository".to_string(),
            details: e.to_string(),
        })?;
    
    let mut index = repo.index()?;
    let file_path = Path::new(&path);
    
    // Make path relative to repo root
    let relative_path = if file_path.is_absolute() {
        file_path.strip_prefix(&project_root)
            .map_err(|_| OrchflowError::GitError {
                operation: "stage file".to_string(),
                details: "Path is not within repository".to_string(),
            })?
    } else {
        file_path
    };
    
    index.add_path(relative_path)?;
    index.write()?;
    
    Ok(())
}

/// Unstage a file
#[tauri::command]
pub async fn git_unstage(
    path: String,
    manager: State<'_, Manager>,
) -> Result<()> {
    let project_root = manager.project_root.clone()
        .ok_or_else(|| OrchflowError::ConfigurationError {
            component: "git".to_string(),
            reason: "No project root set".to_string(),
        })?;
    
    let repo = Repository::open(&project_root)
        .map_err(|e| OrchflowError::GitError {
            operation: "open repository".to_string(),
            details: e.to_string(),
        })?;
    
    // Reset the file in the index to match HEAD
    let head = repo.head()?.peel_to_commit()?;
    let mut index = repo.index()?;
    let file_path = Path::new(&path);
    
    // Make path relative to repo root
    let relative_path = if file_path.is_absolute() {
        file_path.strip_prefix(&project_root)
            .map_err(|_| OrchflowError::GitError {
                operation: "unstage file".to_string(),
                details: "Path is not within repository".to_string(),
            })?
    } else {
        file_path
    };
    
    // Reset the file to HEAD state
    repo.reset_default(Some(&head.into_object()), &[relative_path])?;
    
    Ok(())
}

/// Stage all files
#[tauri::command]
pub async fn git_stage_all(
    manager: State<'_, Manager>,
) -> Result<()> {
    let project_root = manager.project_root.clone()
        .ok_or_else(|| OrchflowError::ConfigurationError {
            component: "git".to_string(),
            reason: "No project root set".to_string(),
        })?;
    
    let repo = Repository::open(&project_root)
        .map_err(|e| OrchflowError::GitError {
            operation: "open repository".to_string(),
            details: e.to_string(),
        })?;
    
    let mut index = repo.index()?;
    
    // Add all files (equivalent to git add -A)
    index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)?;
    index.update_all(["*"].iter(), None)?;
    index.write()?;
    
    Ok(())
}

/// Unstage all files
#[tauri::command]
pub async fn git_unstage_all(
    manager: State<'_, Manager>,
) -> Result<()> {
    let project_root = manager.project_root.clone()
        .ok_or_else(|| OrchflowError::ConfigurationError {
            component: "git".to_string(),
            reason: "No project root set".to_string(),
        })?;
    
    let repo = Repository::open(&project_root)
        .map_err(|e| OrchflowError::GitError {
            operation: "open repository".to_string(),
            details: e.to_string(),
        })?;
    
    // Reset the entire index to match HEAD
    let head = repo.head()?.peel_to_commit()?;
    repo.reset(&head.into_object(), git2::ResetType::Mixed, None)?;
    
    Ok(())
}

/// Commit staged changes
#[tauri::command]
pub async fn git_commit(
    message: String,
    manager: State<'_, Manager>,
) -> Result<()> {
    let project_root = manager.project_root.clone()
        .ok_or_else(|| OrchflowError::ConfigurationError {
            component: "git".to_string(),
            reason: "No project root set".to_string(),
        })?;
    
    let repo = Repository::open(&project_root)
        .map_err(|e| OrchflowError::GitError {
            operation: "open repository".to_string(),
            details: e.to_string(),
        })?;
    
    // Get the default signature
    let sig = repo.signature()
        .or_else(|_| {
            // Fallback to default signature if not configured
            Signature::now("orchflow", "orchflow@example.com")
        })
        .map_err(|e| OrchflowError::GitError {
            operation: "get signature".to_string(),
            details: e.to_string(),
        })?;
    
    // Write the index as a tree
    let mut index = repo.index()?;
    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;
    
    // Get parent commit
    let parent_commit = repo.head()?.peel_to_commit()?;
    
    // Create the commit
    repo.commit(
        Some("HEAD"),
        &sig,
        &sig,
        &message,
        &tree,
        &[&parent_commit],
    )?;
    
    Ok(())
}

/// Push to remote
#[tauri::command]
pub async fn git_push(
    manager: State<'_, Manager>,
) -> Result<()> {
    let project_root = manager.project_root.clone()
        .ok_or_else(|| OrchflowError::ConfigurationError {
            component: "git".to_string(),
            reason: "No project root set".to_string(),
        })?;
    
    // Use git command for push as libgit2 doesn't have good push support
    let output = Command::new("git")
        .current_dir(&project_root)
        .args(&["push"])
        .output()
        .map_err(|e| OrchflowError::GitError {
            operation: "push".to_string(),
            details: e.to_string(),
        })?;
    
    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(OrchflowError::GitError {
            operation: "push".to_string(),
            details: error_msg.to_string(),
        });
    }
    
    Ok(())
}

/// Pull from remote
#[tauri::command]
pub async fn git_pull(
    manager: State<'_, Manager>,
) -> Result<()> {
    let project_root = manager.project_root.clone()
        .ok_or_else(|| OrchflowError::ConfigurationError {
            component: "git".to_string(),
            reason: "No project root set".to_string(),
        })?;
    
    // Use git command for pull as libgit2 doesn't have good pull support
    let output = Command::new("git")
        .current_dir(&project_root)
        .args(&["pull"])
        .output()
        .map_err(|e| OrchflowError::GitError {
            operation: "pull".to_string(),
            details: e.to_string(),
        })?;
    
    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(OrchflowError::GitError {
            operation: "pull".to_string(),
            details: error_msg.to_string(),
        });
    }
    
    Ok(())
}

// Helper functions

fn get_upstream_info(repo: &Repository, head: &git2::Reference) -> Result<(Option<String>, usize, usize)> {
    if let Ok(local_branch) = head.resolve() {
        if let Some(branch_name) = local_branch.name() {
            if let Ok(branch) = repo.find_branch(branch_name, git2::BranchType::Local) {
                if let Ok(upstream) = branch.upstream() {
                    let upstream_name = upstream.name()
                        .ok()
                        .flatten()
                        .map(|s| s.to_string());
                    
                    // Calculate ahead/behind
                    let (ahead, behind) = if let (Some(local_oid), Some(upstream_oid)) = 
                        (local_branch.target(), upstream.get().target()) {
                        repo.graph_ahead_behind(local_oid, upstream_oid)
                            .unwrap_or((0, 0))
                    } else {
                        (0, 0)
                    };
                    
                    return Ok((upstream_name, ahead, behind));
                }
            }
        }
    }
    Ok((None, 0, 0))
}

fn get_file_statuses(repo: &Repository) -> Result<(Vec<GitFileStatus>, Vec<GitFileStatus>, Vec<GitFileStatus>)> {
    let mut staged = Vec::new();
    let mut unstaged = Vec::new();
    let mut untracked = Vec::new();
    
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .include_ignored(false);
    
    let statuses = repo.statuses(Some(&mut opts))?;
    
    for entry in statuses.iter() {
        if let Some(path) = entry.path() {
            let status = entry.status();
            
            // Staged changes
            if status.contains(git2::Status::INDEX_NEW) {
                staged.push(GitFileStatus {
                    path: path.to_string(),
                    status: "added".to_string(),
                });
            } else if status.contains(git2::Status::INDEX_MODIFIED) {
                staged.push(GitFileStatus {
                    path: path.to_string(),
                    status: "modified".to_string(),
                });
            } else if status.contains(git2::Status::INDEX_DELETED) {
                staged.push(GitFileStatus {
                    path: path.to_string(),
                    status: "deleted".to_string(),
                });
            } else if status.contains(git2::Status::INDEX_RENAMED) {
                staged.push(GitFileStatus {
                    path: path.to_string(),
                    status: "renamed".to_string(),
                });
            }
            
            // Unstaged changes
            if status.contains(git2::Status::WT_MODIFIED) {
                unstaged.push(GitFileStatus {
                    path: path.to_string(),
                    status: "modified".to_string(),
                });
            } else if status.contains(git2::Status::WT_DELETED) {
                unstaged.push(GitFileStatus {
                    path: path.to_string(),
                    status: "deleted".to_string(),
                });
            } else if status.contains(git2::Status::WT_RENAMED) {
                unstaged.push(GitFileStatus {
                    path: path.to_string(),
                    status: "renamed".to_string(),
                });
            }
            
            // Untracked files
            if status.contains(git2::Status::WT_NEW) && !status.contains(git2::Status::INDEX_NEW) {
                untracked.push(GitFileStatus {
                    path: path.to_string(),
                    status: "untracked".to_string(),
                });
            }
        }
    }
    
    Ok((staged, unstaged, untracked))
}