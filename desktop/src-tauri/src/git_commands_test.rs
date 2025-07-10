#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use std::fs;
    use git2::{Repository, Signature};

    /// Helper to create a test repository with some files
    fn setup_test_repo() -> (TempDir, PathBuf) {
        let temp_dir = TempDir::new().unwrap();
        let repo_path = temp_dir.path().to_path_buf();
        
        // Initialize git repository
        let repo = Repository::init(&repo_path).unwrap();
        
        // Create test files
        fs::write(repo_path.join("file1.txt"), "content1").unwrap();
        fs::write(repo_path.join("file2.rs"), "content2").unwrap();
        fs::create_dir(repo_path.join("src")).unwrap();
        fs::write(repo_path.join("src/main.rs"), "fn main() {}").unwrap();
        
        // Create .gitignore
        fs::write(repo_path.join(".gitignore"), "*.log\ntarget/\n.DS_Store").unwrap();
        
        // Create some ignored files
        fs::write(repo_path.join("debug.log"), "log content").unwrap();
        fs::create_dir(repo_path.join("target")).unwrap();
        fs::write(repo_path.join("target/debug"), "binary").unwrap();
        fs::write(repo_path.join(".DS_Store"), "macos file").unwrap();
        
        // Stage and commit initial files
        let mut index = repo.index().unwrap();
        index.add_path(Path::new("file1.txt")).unwrap();
        index.add_path(Path::new(".gitignore")).unwrap();
        index.write().unwrap();
        
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let sig = Signature::now("Test User", "test@example.com").unwrap();
        repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            "Initial commit",
            &tree,
            &[],
        ).unwrap();
        
        (temp_dir, repo_path)
    }

    #[test]
    fn test_is_git_ignored() {
        let (_temp_dir, repo_path) = setup_test_repo();
        
        // Test ignored files
        assert!(is_path_ignored(&repo_path, Path::new("debug.log")));
        assert!(is_path_ignored(&repo_path, Path::new("target/debug")));
        assert!(is_path_ignored(&repo_path, Path::new(".DS_Store")));
        assert!(is_path_ignored(&repo_path, Path::new("any.log")));
        
        // Test non-ignored files
        assert!(!is_path_ignored(&repo_path, Path::new("file1.txt")));
        assert!(!is_path_ignored(&repo_path, Path::new("file2.rs")));
        assert!(!is_path_ignored(&repo_path, Path::new("src/main.rs")));
    }

    #[test]
    fn test_get_file_status() {
        let (_temp_dir, repo_path) = setup_test_repo();
        let repo = Repository::open(&repo_path).unwrap();
        
        // Test committed file
        let status = get_file_git_status_sync(&repo, Path::new("file1.txt")).unwrap();
        assert_eq!(status, None); // Clean file has no status
        
        // Test untracked file
        let status = get_file_git_status_sync(&repo, Path::new("file2.rs")).unwrap();
        assert_eq!(status, Some(FileGitStatus::Untracked));
        
        // Modify a tracked file
        fs::write(repo_path.join("file1.txt"), "modified content").unwrap();
        let status = get_file_git_status_sync(&repo, Path::new("file1.txt")).unwrap();
        assert_eq!(status, Some(FileGitStatus::Modified));
    }

    #[test]
    fn test_has_uncommitted_changes() {
        let (_temp_dir, repo_path) = setup_test_repo();
        let repo = Repository::open(&repo_path).unwrap();
        
        // Should have uncommitted changes (untracked files)
        assert!(has_uncommitted_changes_sync(&repo));
        
        // Stage all files
        let mut index = repo.index().unwrap();
        index.add_path(Path::new("file2.rs")).unwrap();
        index.add_path(Path::new("src/main.rs")).unwrap();
        index.write().unwrap();
        
        // Still has uncommitted changes (staged but not committed)
        assert!(has_uncommitted_changes_sync(&repo));
        
        // Commit all changes
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let sig = Signature::now("Test User", "test@example.com").unwrap();
        let parent = repo.head().unwrap().peel_to_commit().unwrap();
        repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            "Commit all files",
            &tree,
            &[&parent],
        ).unwrap();
        
        // Now should have no uncommitted changes (ignoring ignored files)
        assert!(!has_uncommitted_changes_sync(&repo));
    }

    #[test]
    fn test_get_branch_info() {
        let (_temp_dir, repo_path) = setup_test_repo();
        let repo = Repository::open(&repo_path).unwrap();
        
        let branch_info = get_branch_info_sync(&repo).unwrap();
        
        // Default branch should be 'master' or 'main'
        assert!(branch_info.name == "master" || branch_info.name == "main");
        assert!(!branch_info.is_detached);
        assert_eq!(branch_info.upstream, None);
        assert_eq!(branch_info.ahead, 0);
        assert_eq!(branch_info.behind, 0);
    }

    #[test]
    fn test_get_all_statuses() {
        let (_temp_dir, repo_path) = setup_test_repo();
        let repo = Repository::open(&repo_path).unwrap();
        
        let statuses = get_all_git_statuses_sync(&repo).unwrap();
        
        // Should have untracked files
        assert_eq!(statuses.get("file2.rs"), Some(&FileGitStatus::Untracked));
        assert_eq!(statuses.get("src/main.rs"), Some(&FileGitStatus::Untracked));
        
        // Should include ignored files
        assert_eq!(statuses.get("debug.log"), Some(&FileGitStatus::Ignored));
        assert_eq!(statuses.get(".DS_Store"), Some(&FileGitStatus::Ignored));
        
        // Should not include clean files
        assert_eq!(statuses.get("file1.txt"), None);
    }

    #[test]
    fn test_nested_gitignore() {
        let (_temp_dir, repo_path) = setup_test_repo();
        
        // Create nested .gitignore
        let src_path = repo_path.join("src");
        fs::write(src_path.join(".gitignore"), "*.tmp").unwrap();
        fs::write(src_path.join("temp.tmp"), "temp file").unwrap();
        
        // File should be ignored by nested .gitignore
        assert!(is_path_ignored(&repo_path, Path::new("src/temp.tmp")));
    }

    #[test]
    fn test_gitignore_patterns() {
        let (_temp_dir, repo_path) = setup_test_repo();
        
        // Test various gitignore patterns
        fs::write(
            repo_path.join(".gitignore"),
            "# Comments should be ignored\n\
             *.log\n\
             !important.log\n\
             /root-only.txt\n\
             **/any-dir/*.tmp\n\
             dir/\n"
        ).unwrap();
        
        // Create test files
        fs::write(repo_path.join("test.log"), "log").unwrap();
        fs::write(repo_path.join("important.log"), "important").unwrap();
        fs::write(repo_path.join("root-only.txt"), "root").unwrap();
        fs::create_dir_all(repo_path.join("subdir")).unwrap();
        fs::write(repo_path.join("subdir/root-only.txt"), "not root").unwrap();
        fs::create_dir_all(repo_path.join("any/nested/any-dir")).unwrap();
        fs::write(repo_path.join("any/nested/any-dir/file.tmp"), "tmp").unwrap();
        
        // Test patterns
        assert!(is_path_ignored(&repo_path, Path::new("test.log")));
        assert!(!is_path_ignored(&repo_path, Path::new("important.log"))); // Negation
        assert!(is_path_ignored(&repo_path, Path::new("root-only.txt")));
        assert!(!is_path_ignored(&repo_path, Path::new("subdir/root-only.txt"))); // Only root
        assert!(is_path_ignored(&repo_path, Path::new("any/nested/any-dir/file.tmp")));
    }

    // Helper functions for synchronous testing
    fn is_path_ignored(repo_path: &Path, file_path: &Path) -> bool {
        let repo = Repository::open(repo_path).unwrap();
        repo.is_path_ignored(file_path).unwrap_or(false)
    }

    fn get_file_git_status_sync(repo: &Repository, path: &Path) -> Result<Option<FileGitStatus>> {
        let status = repo.status_file(path)?;
        
        let git_status = if status.contains(git2::Status::WT_NEW) {
            Some(FileGitStatus::Untracked)
        } else if status.contains(git2::Status::WT_MODIFIED) || status.contains(git2::Status::INDEX_MODIFIED) {
            Some(FileGitStatus::Modified)
        } else if status.contains(git2::Status::INDEX_NEW) {
            Some(FileGitStatus::Added)
        } else if status.contains(git2::Status::WT_DELETED) || status.contains(git2::Status::INDEX_DELETED) {
            Some(FileGitStatus::Deleted)
        } else if status.contains(git2::Status::IGNORED) {
            Some(FileGitStatus::Ignored)
        } else {
            None
        };
        
        Ok(git_status)
    }

    fn has_uncommitted_changes_sync(repo: &Repository) -> bool {
        let mut opts = StatusOptions::new();
        opts.include_untracked(true).include_ignored(false);
        
        repo.statuses(Some(&mut opts))
            .map(|s| !s.is_empty())
            .unwrap_or(false)
    }

    fn get_branch_info_sync(repo: &Repository) -> Result<BranchInfo> {
        let head = repo.head()?;
        let is_detached = repo.head_detached().unwrap_or(false);
        
        let name = if is_detached {
            head.target()
                .map(|oid| oid.to_string())
                .unwrap_or_else(|| "unknown".to_string())
        } else {
            head.shorthand()
                .unwrap_or("unknown")
                .to_string()
        };
        
        Ok(BranchInfo {
            name,
            is_detached,
            upstream: None,
            ahead: 0,
            behind: 0,
        })
    }

    fn get_all_git_statuses_sync(repo: &Repository) -> Result<HashMap<String, FileGitStatus>> {
        let mut result = HashMap::new();
        let mut opts = StatusOptions::new();
        opts.include_untracked(true).include_ignored(true);
        
        let statuses = repo.statuses(Some(&mut opts))?;
        
        for entry in statuses.iter() {
            if let Some(path) = entry.path() {
                let status = entry.status();
                let git_status = if status.contains(git2::Status::WT_NEW) {
                    FileGitStatus::Untracked
                } else if status.contains(git2::Status::WT_MODIFIED) || status.contains(git2::Status::INDEX_MODIFIED) {
                    FileGitStatus::Modified
                } else if status.contains(git2::Status::INDEX_NEW) {
                    FileGitStatus::Added
                } else if status.contains(git2::Status::WT_DELETED) || status.contains(git2::Status::INDEX_DELETED) {
                    FileGitStatus::Deleted
                } else if status.contains(git2::Status::IGNORED) {
                    FileGitStatus::Ignored
                } else {
                    continue;
                };
                
                result.insert(path.to_string(), git_status);
            }
        }
        
        Ok(result)
    }
}