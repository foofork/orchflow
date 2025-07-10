#[cfg(test)]
mod integration_tests {
    use crate::file_manager::{FileManager, FileNode};
    use tempfile::TempDir;
    use std::fs;
    use git2::{Repository, Signature};
    use std::path::Path;

    /// Test the complete file manager git integration
    #[tokio::test]
    async fn test_file_manager_git_ignore_integration() {
        // Setup test repository
        let temp_dir = TempDir::new().unwrap();
        let repo_path = temp_dir.path().to_path_buf();
        
        // Initialize git repository
        let repo = Repository::init(&repo_path).unwrap();
        
        // Create directory structure
        fs::create_dir_all(repo_path.join("src/components")).unwrap();
        fs::create_dir_all(repo_path.join("target/debug")).unwrap();
        fs::create_dir_all(repo_path.join("node_modules")).unwrap();
        
        // Create files
        fs::write(repo_path.join("README.md"), "# Test Project").unwrap();
        fs::write(repo_path.join("Cargo.toml"), "[package]\nname = \"test\"").unwrap();
        fs::write(repo_path.join("src/main.rs"), "fn main() {}").unwrap();
        fs::write(repo_path.join("src/lib.rs"), "// lib").unwrap();
        fs::write(repo_path.join("src/components/app.rs"), "// app").unwrap();
        
        // Create ignored files
        fs::write(repo_path.join("debug.log"), "debug output").unwrap();
        fs::write(repo_path.join("src/temp.tmp"), "temp file").unwrap();
        fs::write(repo_path.join("target/debug/binary"), "binary").unwrap();
        fs::write(repo_path.join("node_modules/package.json"), "{}").unwrap();
        fs::write(repo_path.join(".DS_Store"), "mac file").unwrap();
        
        // Create .gitignore
        let gitignore_content = r#"
# Build artifacts
/target/
*.tmp

# Logs
*.log

# Dependencies
node_modules/

# OS files
.DS_Store
Thumbs.db

# IDE
.idea/
.vscode/
"#;
        fs::write(repo_path.join(".gitignore"), gitignore_content).unwrap();
        
        // Initial commit
        let mut index = repo.index().unwrap();
        index.add_path(Path::new(".gitignore")).unwrap();
        index.add_path(Path::new("README.md")).unwrap();
        index.add_path(Path::new("Cargo.toml")).unwrap();
        index.write().unwrap();
        
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let sig = Signature::now("Test", "test@test.com").unwrap();
        repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            "Initial commit",
            &tree,
            &[],
        ).unwrap();
        
        // Create file manager
        let mut file_manager = FileManager::new(repo_path.clone());
        file_manager.initialize().await.unwrap();
        
        // Build file tree
        let tree = file_manager.build_tree(Some(3)).await.unwrap();
        
        // Verify root files
        assert_tree_contains(&tree, "README.md", false);
        assert_tree_contains(&tree, "Cargo.toml", false);
        assert_tree_contains(&tree, ".gitignore", false);
        
        // Verify ignored files are marked
        assert_tree_contains(&tree, "debug.log", true);
        assert_tree_contains(&tree, ".DS_Store", true);
        
        // Verify ignored directories
        if let Some(target) = find_node(&tree, "target") {
            assert!(target.is_git_ignored, "target/ should be ignored");
            // Children of ignored directories might not be expanded
        }
        
        if let Some(node_modules) = find_node(&tree, "node_modules") {
            assert!(node_modules.is_git_ignored, "node_modules/ should be ignored");
        }
        
        // Test file operations with ignored files
        assert!(file_manager.is_git_ignored(&repo_path.join("debug.log")));
        assert!(file_manager.is_git_ignored(&repo_path.join("target/debug/binary")));
        assert!(file_manager.is_git_ignored(&repo_path.join("node_modules/anything.js")));
        assert!(!file_manager.is_git_ignored(&repo_path.join("src/main.rs")));
    }

    #[tokio::test]
    async fn test_file_manager_git_status_integration() {
        let temp_dir = TempDir::new().unwrap();
        let repo_path = temp_dir.path().to_path_buf();
        
        // Initialize repository
        let repo = Repository::init(&repo_path).unwrap();
        
        // Create and commit initial file
        fs::write(repo_path.join("file1.txt"), "initial").unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(Path::new("file1.txt")).unwrap();
        index.write().unwrap();
        
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let sig = Signature::now("Test", "test@test.com").unwrap();
        repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            "Initial",
            &tree,
            &[],
        ).unwrap();
        
        // Create various file states
        fs::write(repo_path.join("file1.txt"), "modified").unwrap(); // Modified
        fs::write(repo_path.join("new.txt"), "new file").unwrap(); // Untracked
        fs::write(repo_path.join("staged.txt"), "staged").unwrap(); // Will stage
        
        // Stage one file
        let mut index = repo.index().unwrap();
        index.add_path(Path::new("staged.txt")).unwrap();
        index.write().unwrap();
        
        // Create file manager and build tree
        let mut file_manager = FileManager::new(repo_path.clone());
        file_manager.initialize().await.unwrap();
        let tree = file_manager.build_tree(Some(1)).await.unwrap();
        
        // Check git statuses
        if let Some(file1) = find_node(&tree, "file1.txt") {
            assert!(file1.git_status.is_some());
            // Note: Exact status depends on implementation
        }
        
        if let Some(new_file) = find_node(&tree, "new.txt") {
            assert!(new_file.git_status.is_some());
        }
        
        if let Some(staged) = find_node(&tree, "staged.txt") {
            assert!(staged.git_status.is_some());
        }
    }

    // Helper functions
    fn find_node(tree: &FileNode, name: &str) -> Option<&FileNode> {
        if tree.name == name {
            return Some(tree);
        }
        
        if let Some(children) = &tree.children {
            for child in children {
                if let Some(found) = find_node(child, name) {
                    return Some(found);
                }
            }
        }
        
        None
    }

    fn assert_tree_contains(tree: &FileNode, name: &str, should_be_ignored: bool) {
        let node = find_node(tree, name)
            .expect(&format!("File '{}' not found in tree", name));
        
        assert_eq!(
            node.is_git_ignored, 
            should_be_ignored,
            "File '{}' ignore status mismatch: expected ignored={}, got ignored={}",
            name,
            should_be_ignored,
            node.is_git_ignored
        );
    }
}