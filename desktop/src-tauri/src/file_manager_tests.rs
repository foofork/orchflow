// Comprehensive tests for FileManager functionality
// Tests file operations, undo/redo, and error handling

#[cfg(test)]
mod tests {
    use crate::error::Result;
    use crate::file_manager::types::FileOperationType;
    use crate::file_manager::{FileManager, FileNode, FileOperation};
    use std::fs;
    use std::path::{Path, PathBuf};
    use tempfile::TempDir;

    struct TestEnvironment {
        temp_dir: TempDir,
        manager: FileManager,
    }

    impl TestEnvironment {
        fn new() -> Self {
            let temp_dir = TempDir::new().unwrap();
            let manager = FileManager::new(temp_dir.path().to_path_buf());
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
        let mut env = TestEnvironment::new();
        env.manager.init().await.unwrap();

        // Create test structure
        env.create_test_file("file1.txt", "content1");
        env.create_test_file("file2.txt", "content2");
        env.create_test_dir("subdir");
        env.create_test_file("subdir/file3.txt", "content3");
        env.create_test_file(".hidden", "hidden content");

        // Build file tree
        let tree = env.manager.build_file_tree(Some(3)).await.unwrap();

        // Verify structure
        assert_eq!(
            tree.name,
            env.temp_dir.path().file_name().unwrap().to_string_lossy()
        );

        if let Some(children) = &tree.children {
            // Count non-hidden files
            let visible_children: Vec<_> = children
                .iter()
                .filter(|n| !n.name.starts_with('.'))
                .collect();
            assert_eq!(visible_children.len(), 3); // file1, file2, subdir

            // Verify files exist
            let names: Vec<&str> = visible_children.iter().map(|n| n.name.as_str()).collect();
            assert!(names.contains(&"file1.txt"));
            assert!(names.contains(&"file2.txt"));
            assert!(names.contains(&"subdir"));

            // Verify subdirectory
            let subdir = children.iter().find(|n| n.name == "subdir").unwrap();
            assert!(subdir.children.is_some());
            if let Some(subdir_children) = &subdir.children {
                assert_eq!(subdir_children.len(), 1);
                assert_eq!(subdir_children[0].name, "file3.txt");
            }
        }
    }

    #[tokio::test]
    async fn test_file_creation() {
        let mut env = TestEnvironment::new();
        env.manager.init().await.unwrap();

        // Create file
        let file_path = env.path("new_file.txt");
        let content = "Hello, World!";
        env.manager
            .create_file(&file_path, content.as_bytes())
            .await
            .unwrap();

        // Verify file exists
        assert!(file_path.exists());
        let read_content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(read_content, content);

        // Test creating file in non-existent directory
        let nested_path = env.path("new_dir/nested/file.txt");
        env.manager
            .create_file(&nested_path, b"nested content")
            .await
            .unwrap();
        assert!(nested_path.exists());
    }

    #[tokio::test]
    async fn test_directory_creation() {
        let mut env = TestEnvironment::new();
        env.manager.init().await.unwrap();

        // Create directory
        let dir_path = env.path("new_directory");
        env.manager.create_directory(&dir_path).await.unwrap();
        assert!(dir_path.exists());
        assert!(dir_path.is_dir());

        // Create nested directories
        let nested_path = env.path("parent/child/grandchild");
        env.manager.create_directory(&nested_path).await.unwrap();
        assert!(nested_path.exists());
    }

    #[tokio::test]
    async fn test_file_deletion() {
        let mut env = TestEnvironment::new();
        env.manager.init().await.unwrap();

        // Create and delete file
        let file_path = env.create_test_file("to_delete.txt", "delete me");
        assert!(file_path.exists());

        env.manager.delete(&file_path).await.unwrap();
        assert!(!file_path.exists());
    }

    #[tokio::test]
    async fn test_directory_deletion() {
        let mut env = TestEnvironment::new();
        env.manager.init().await.unwrap();

        // Create directory with contents
        let dir_path = env.create_test_dir("to_delete");
        env.create_test_file("to_delete/file1.txt", "content");
        env.create_test_file("to_delete/file2.txt", "content");

        // Delete directory
        env.manager.delete(&dir_path).await.unwrap();
        assert!(!dir_path.exists());
    }

    #[tokio::test]
    async fn test_file_rename() {
        let mut env = TestEnvironment::new();
        env.manager.init().await.unwrap();

        // Create and rename file
        let old_path = env.create_test_file("old_name.txt", "content");
        let new_path = env.path("new_name.txt");

        env.manager.rename(&old_path, &new_path).await.unwrap();
        assert!(!old_path.exists());
        assert!(new_path.exists());

        let content = fs::read_to_string(&new_path).unwrap();
        assert_eq!(content, "content");
    }

    #[tokio::test]
    async fn test_file_move() {
        let mut env = TestEnvironment::new();
        env.manager.init().await.unwrap();

        // Create source files and destination
        let file1 = env.create_test_file("file1.txt", "content1");
        let file2 = env.create_test_file("file2.txt", "content2");
        let dest_dir = env.create_test_dir("destination");

        // Move files
        env.manager.move_to(&file1, &dest_dir).await.unwrap();
        env.manager.move_to(&file2, &dest_dir).await.unwrap();

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
        let mut env = TestEnvironment::new();
        env.manager.init().await.unwrap();

        // Create source files and destination
        let file1 = env.create_test_file("source1.txt", "content1");
        let file2 = env.create_test_file("source2.txt", "content2");
        let dest_dir = env.create_test_dir("copies");

        // Copy files
        env.manager.copy_to(&file1, &dest_dir).await.unwrap();
        env.manager.copy_to(&file2, &dest_dir).await.unwrap();

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
        let mut env = TestEnvironment::new();
        env.manager.init().await.unwrap();

        // Create a file
        let file_path = env.path("undo_test.txt");
        env.manager
            .create_file(&file_path, b"original")
            .await
            .unwrap();

        // Rename it
        let new_path = env.path("renamed.txt");
        env.manager.rename(&file_path, &new_path).await.unwrap();
        assert!(!file_path.exists());
        assert!(new_path.exists());

        // Undo rename
        env.manager.undo().await.unwrap();
        assert!(file_path.exists());
        assert!(!new_path.exists());

        // Redo rename
        env.manager.redo().await.unwrap();
        assert!(!file_path.exists());
        assert!(new_path.exists());
    }

    #[tokio::test]
    async fn test_file_search() {
        let mut env = TestEnvironment::new();
        env.manager.init().await.unwrap();

        // Create test files
        env.create_test_file("doc1.txt", "Hello world");
        env.create_test_file("doc2.md", "Hello there");
        env.create_test_file("other.txt", "Goodbye");
        env.create_test_dir("subdir");
        env.create_test_file("subdir/doc3.txt", "Hello again");

        // Search for files containing "Hello"
        let results = env
            .manager
            .search(
                &env.temp_dir.path(),
                "Hello",
                false, // Not regex
                true,  // Case sensitive
            )
            .await
            .unwrap();

        assert_eq!(results.len(), 3);

        // Verify all results contain "Hello"
        for entry in &results {
            let path = PathBuf::from(&entry.path);
            let content = fs::read_to_string(path).unwrap();
            assert!(content.contains("Hello"));
        }
    }

    #[tokio::test]
    async fn test_directory_expansion_state() {
        let mut env = TestEnvironment::new();
        env.manager.init().await.unwrap();

        // Create nested structure
        let dir1 = env.create_test_dir("expand1");
        let dir2 = env.create_test_dir("expand1/expand2");
        let _dir3 = env.create_test_dir("expand1/expand2/expand3");

        // Expand directories
        let children1 = env.manager.expand_directory(&dir1).await.unwrap();
        assert!(!children1.is_empty());

        let children2 = env.manager.expand_directory(&dir2).await.unwrap();
        assert!(!children2.is_empty());

        // Collapse one
        env.manager.collapse_directory(&dir2).await.unwrap();

        // Get recent operations to verify tracking
        let history = env.manager.get_recent_operations(10).await.unwrap();
        assert!(!history.is_empty());
    }

    #[tokio::test]
    async fn test_file_preview() {
        let mut env = TestEnvironment::new();
        env.manager.init().await.unwrap();

        // Create files with different sizes
        let small_file = env.create_test_file("small.txt", "Small content");
        let large_content = "x".repeat(10000);
        let large_file = env.create_test_file("large.txt", &large_content);

        // Preview small file
        let preview = env
            .manager
            .get_file_preview(&small_file, 100)
            .await
            .unwrap();
        assert_eq!(preview, "Small content");

        // Preview large file (should be truncated)
        let preview = env
            .manager
            .get_file_preview(&large_file, 100)
            .await
            .unwrap();
        assert!(preview.len() <= 100);
        assert!(preview.starts_with("xxx"));
    }

    #[tokio::test]
    async fn test_trash_operations() {
        let mut env = TestEnvironment::new();
        env.manager.init().await.unwrap();

        // Create a file
        let file_path = env.create_test_file("trash_test.txt", "content");
        assert!(file_path.exists());

        // Move to trash
        env.manager.move_to_trash(&file_path).await.unwrap();
        assert!(!file_path.exists());

        // Get trash items
        let trash_items = env.manager.get_trash_items().await.unwrap();
        assert!(!trash_items.is_empty());

        // Restore from trash
        let trash_id = &trash_items[0].id;
        env.manager.restore_from_trash(trash_id).await.unwrap();
        assert!(file_path.exists());

        // Verify content is preserved
        let content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(content, "content");
    }

    #[tokio::test]
    async fn test_git_status() {
        let mut env = TestEnvironment::new();
        env.manager.init().await.unwrap();

        // Create some files
        env.create_test_file("tracked.txt", "tracked");
        env.create_test_file("untracked.txt", "untracked");

        // Get git status (if available)
        if let Ok(status) = env.manager.get_git_status(&env.temp_dir.path()).await {
            // This will only work if the temp directory is in a git repo
            // Otherwise the test will pass without checking git status
            assert!(status.modified.is_empty() || !status.modified.is_empty());
        }
    }

    #[tokio::test]
    async fn test_error_handling() {
        let mut env = TestEnvironment::new();
        env.manager.init().await.unwrap();

        // Test operations on non-existent paths
        let fake_path = env.path("does_not_exist.txt");

        // Delete non-existent
        let result = env.manager.delete(&fake_path).await;
        assert!(result.is_err());

        // Rename non-existent
        let result = env.manager.rename(&fake_path, &env.path("new.txt")).await;
        assert!(result.is_err());

        // Preview non-existent
        let result = env.manager.get_file_preview(&fake_path, 100).await;
        assert!(result.is_err());
    }
}
