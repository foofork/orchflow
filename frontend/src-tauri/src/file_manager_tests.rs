// Comprehensive tests for FileManager functionality
// Tests file operations, undo/redo, and error handling

#[cfg(test)]
mod tests {
    use crate::file_manager::{FileManager, FileOperation, FileTreeNode, FileOperationType};
    use crate::error::{OrchflowError, Result};
    use std::path::{Path, PathBuf};
    use std::fs;
    use tempfile::TempDir;

    struct TestEnvironment {
        temp_dir: TempDir,
        manager: FileManager,
    }

    impl TestEnvironment {
        fn new() -> Self {
            let temp_dir = TempDir::new().unwrap();
            let manager = FileManager::new();
            Self { temp_dir, manager }
        }

        fn path(&self, relative: &str) -> PathBuf {
            self.temp_dir.path().join(relative)
        }

        fn create_test_file(&self, name: &str, content: &str) -> PathBuf {
            let path = self.path(name);
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).unwrap();
            }
            fs::write(&path, content).unwrap();
            path
        }

        fn create_test_dir(&self, name: &str) -> PathBuf {
            let path = self.path(name);
            fs::create_dir_all(&path).unwrap();
            path
        }
    }

    #[tokio::test]
    async fn test_file_tree_listing() {
        let env = TestEnvironment::new();
        
        // Create test structure
        env.create_test_file("file1.txt", "content1");
        env.create_test_file("file2.txt", "content2");
        env.create_test_dir("subdir");
        env.create_test_file("subdir/file3.txt", "content3");
        env.create_test_file(".hidden", "hidden content");
        
        // Get file tree
        let tree = env.manager.get_file_tree(
            env.temp_dir.path(),
            Some(vec!["*.log".to_string()]),
            false, // Don't show hidden files
        ).await.unwrap();
        
        // Verify root
        assert!(tree.is_directory);
        assert_eq!(tree.children.len(), 3); // file1, file2, subdir (not .hidden)
        
        // Verify files exist
        let names: Vec<&str> = tree.children.iter().map(|n| n.name.as_str()).collect();
        assert!(names.contains(&"file1.txt"));
        assert!(names.contains(&"file2.txt"));
        assert!(names.contains(&"subdir"));
        assert!(!names.contains(&".hidden"));
        
        // Verify subdirectory
        let subdir = tree.children.iter().find(|n| n.name == "subdir").unwrap();
        assert!(subdir.is_directory);
        assert_eq!(subdir.children.len(), 1);
        assert_eq!(subdir.children[0].name, "file3.txt");
    }

    #[tokio::test]
    async fn test_file_creation() {
        let env = TestEnvironment::new();
        
        // Create file
        let file_path = env.path("new_file.txt");
        let content = "Hello, World!";
        env.manager.create_file(&file_path, content).await.unwrap();
        
        // Verify file exists
        assert!(file_path.exists());
        let read_content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(read_content, content);
        
        // Test creating file in non-existent directory
        let nested_path = env.path("new_dir/nested/file.txt");
        env.manager.create_file(&nested_path, "nested content").await.unwrap();
        assert!(nested_path.exists());
        
        // Test overwriting existing file (should fail)
        let result = env.manager.create_file(&file_path, "new content").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_directory_creation() {
        let env = TestEnvironment::new();
        
        // Create directory
        let dir_path = env.path("new_directory");
        env.manager.create_directory(&dir_path).await.unwrap();
        assert!(dir_path.exists());
        assert!(dir_path.is_dir());
        
        // Create nested directories
        let nested_path = env.path("parent/child/grandchild");
        env.manager.create_directory(&nested_path).await.unwrap();
        assert!(nested_path.exists());
        
        // Creating existing directory should be ok
        let result = env.manager.create_directory(&dir_path).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_file_deletion() {
        let env = TestEnvironment::new();
        
        // Create and delete file
        let file_path = env.create_test_file("to_delete.txt", "delete me");
        assert!(file_path.exists());
        
        env.manager.delete_path(&file_path).await.unwrap();
        assert!(!file_path.exists());
        
        // Delete non-existent file should fail
        let result = env.manager.delete_path(&file_path).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_directory_deletion() {
        let env = TestEnvironment::new();
        
        // Create directory with contents
        let dir_path = env.create_test_dir("to_delete");
        env.create_test_file("to_delete/file1.txt", "content");
        env.create_test_file("to_delete/file2.txt", "content");
        
        // Delete directory
        env.manager.delete_path(&dir_path).await.unwrap();
        assert!(!dir_path.exists());
    }

    #[tokio::test]
    async fn test_file_rename() {
        let env = TestEnvironment::new();
        
        // Create and rename file
        let old_path = env.create_test_file("old_name.txt", "content");
        let new_path = env.path("new_name.txt");
        
        env.manager.rename_path(&old_path, &new_path).await.unwrap();
        assert!(!old_path.exists());
        assert!(new_path.exists());
        
        let content = fs::read_to_string(&new_path).unwrap();
        assert_eq!(content, "content");
        
        // Rename to existing file should fail
        let existing = env.create_test_file("existing.txt", "exists");
        let result = env.manager.rename_path(&new_path, &existing).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_file_move() {
        let env = TestEnvironment::new();
        
        // Create source files and destination
        let file1 = env.create_test_file("file1.txt", "content1");
        let file2 = env.create_test_file("file2.txt", "content2");
        let dest_dir = env.create_test_dir("destination");
        
        // Move files
        env.manager.move_files(
            vec![file1.clone(), file2.clone()],
            dest_dir.clone(),
        ).await.unwrap();
        
        // Verify files moved
        assert!(!file1.exists());
        assert!(!file2.exists());
        assert!(dest_dir.join("file1.txt").exists());
        assert!(dest_dir.join("file2.txt").exists());
        
        // Verify content preserved
        let content1 = fs::read_to_string(dest_dir.join("file1.txt")).unwrap();
        assert_eq!(content1, "content1");
    }

    #[tokio::test]
    async fn test_file_copy() {
        let env = TestEnvironment::new();
        
        // Create source files and destination
        let file1 = env.create_test_file("source1.txt", "content1");
        let file2 = env.create_test_file("source2.txt", "content2");
        let dest_dir = env.create_test_dir("copies");
        
        // Copy files
        env.manager.copy_files(
            vec![file1.clone(), file2.clone()],
            dest_dir.clone(),
        ).await.unwrap();
        
        // Verify originals still exist
        assert!(file1.exists());
        assert!(file2.exists());
        
        // Verify copies exist
        assert!(dest_dir.join("source1.txt").exists());
        assert!(dest_dir.join("source2.txt").exists());
        
        // Verify content
        let original = fs::read_to_string(&file1).unwrap();
        let copy = fs::read_to_string(dest_dir.join("source1.txt")).unwrap();
        assert_eq!(original, copy);
    }

    #[tokio::test]
    async fn test_undo_redo_operations() {
        let env = TestEnvironment::new();
        
        // Create a file
        let file_path = env.path("undo_test.txt");
        env.manager.create_file(&file_path, "original").await.unwrap();
        
        // Rename it
        let new_path = env.path("renamed.txt");
        env.manager.rename_path(&file_path, &new_path).await.unwrap();
        assert!(!file_path.exists());
        assert!(new_path.exists());
        
        // Undo rename
        env.manager.undo_operation().await.unwrap();
        assert!(file_path.exists());
        assert!(!new_path.exists());
        
        // Redo rename
        env.manager.undo_operation().await.unwrap(); // This should redo
        assert!(!file_path.exists());
        assert!(new_path.exists());
    }

    #[tokio::test]
    async fn test_file_search() {
        let env = TestEnvironment::new();
        
        // Create test files
        env.create_test_file("doc1.txt", "Hello world");
        env.create_test_file("doc2.md", "Hello there");
        env.create_test_file("other.txt", "Goodbye");
        env.create_test_dir("subdir");
        env.create_test_file("subdir/doc3.txt", "Hello again");
        
        // Search for files containing "Hello"
        let results = env.manager.search_files(
            env.temp_dir.path(),
            "Hello",
            Some(vec!["*.txt".to_string(), "*.md".to_string()]),
            true, // case sensitive
        ).await.unwrap();
        
        assert_eq!(results.len(), 3);
        
        // Verify all results contain "Hello"
        for path in &results {
            let content = fs::read_to_string(path).unwrap();
            assert!(content.contains("Hello"));
        }
        
        // Case insensitive search
        let results = env.manager.search_files(
            env.temp_dir.path(),
            "hello",
            None,
            false, // case insensitive
        ).await.unwrap();
        
        assert_eq!(results.len(), 3);
    }

    #[tokio::test]
    async fn test_directory_expansion_state() {
        let env = TestEnvironment::new();
        
        // Create nested structure
        let dir1 = env.create_test_dir("expand1");
        let dir2 = env.create_test_dir("expand1/expand2");
        let dir3 = env.create_test_dir("expand1/expand2/expand3");
        
        // Expand directories
        env.manager.expand_directory(&dir1).await.unwrap();
        env.manager.expand_directory(&dir2).await.unwrap();
        
        // Collapse one
        env.manager.collapse_directory(&dir2).await.unwrap();
        
        // Get operation history to verify tracking
        let history = env.manager.get_operation_history(10).await.unwrap();
        assert!(!history.is_empty());
    }

    #[tokio::test]
    async fn test_file_preview() {
        let env = TestEnvironment::new();
        
        // Create files with different sizes
        let small_file = env.create_test_file("small.txt", "Small content");
        let large_content = "x".repeat(10000);
        let large_file = env.create_test_file("large.txt", &large_content);
        
        // Preview small file
        let preview = env.manager.get_file_preview(&small_file, 100).await.unwrap();
        assert_eq!(preview, "Small content");
        
        // Preview large file (should be truncated)
        let preview = env.manager.get_file_preview(&large_file, 100).await.unwrap();
        assert!(preview.len() <= 100);
        assert!(preview.starts_with("xxx"));
    }

    #[tokio::test]
    async fn test_error_handling() {
        let env = TestEnvironment::new();
        
        // Test operations on non-existent paths
        let fake_path = env.path("does_not_exist.txt");
        
        // Delete non-existent
        let result = env.manager.delete_path(&fake_path).await;
        assert!(result.is_err());
        
        // Rename non-existent
        let result = env.manager.rename_path(&fake_path, &env.path("new.txt")).await;
        assert!(result.is_err());
        
        // Preview non-existent
        let result = env.manager.get_file_preview(&fake_path, 100).await;
        assert!(result.is_err());
        
        // Test permission errors (if possible)
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            
            let readonly_file = env.create_test_file("readonly.txt", "content");
            let mut perms = fs::metadata(&readonly_file).unwrap().permissions();
            perms.set_mode(0o444); // Read-only
            fs::set_permissions(&readonly_file, perms).unwrap();
            
            // Try to delete read-only file
            let result = env.manager.delete_path(&readonly_file).await;
            // This might succeed on some systems, so we don't assert error
        }
    }
}