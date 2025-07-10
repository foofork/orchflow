#[cfg(test)]
mod tests {
    use crate::file_manager::{FileManager, FileEntryType, FileOperationResult};
    use tempfile::TempDir;
    use tokio::fs;
    use std::path::Path;
    
    async fn create_test_manager() -> (FileManager, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let manager = FileManager::new(temp_dir.path().to_path_buf());
        (manager, temp_dir)
    }
    
    async fn create_test_file(dir: &Path, name: &str, content: &str) -> std::path::PathBuf {
        let path = dir.join(name);
        fs::write(&path, content).await.unwrap();
        path
    }
    
    async fn create_test_dir(dir: &Path, name: &str) -> std::path::PathBuf {
        let path = dir.join(name);
        fs::create_dir(&path).await.unwrap();
        path
    }
    
    #[tokio::test]
    async fn test_list_directory() {
        let (manager, temp_dir) = create_test_manager().await;
        
        // Create test files and directories
        create_test_file(temp_dir.path(), "file1.txt", "content1").await;
        create_test_file(temp_dir.path(), "file2.txt", "content2").await;
        create_test_dir(temp_dir.path(), "subdir").await;
        
        // List directory
        let entries = manager.list_directory(temp_dir.path().to_str().unwrap()).await.unwrap();
        
        assert_eq!(entries.len(), 3);
        assert!(entries.iter().any(|e| e.name == "file1.txt" && e.file_type == FileEntryType::File));
        assert!(entries.iter().any(|e| e.name == "file2.txt" && e.file_type == FileEntryType::File));
        assert!(entries.iter().any(|e| e.name == "subdir" && e.file_type == FileEntryType::Directory));
    }
    
    #[tokio::test]
    async fn test_create_file() {
        let (manager, temp_dir) = create_test_manager().await;
        
        let file_path = temp_dir.path().join("new_file.txt");
        let result = manager.create_file(&file_path, "Hello, world!").await;
        
        assert!(result.is_ok());
        
        // Verify file exists and has correct content
        let content = fs::read_to_string(&file_path).await.unwrap();
        assert_eq!(content, "Hello, world!");
    }
    
    #[tokio::test]
    async fn test_create_directory() {
        let (manager, temp_dir) = create_test_manager().await;
        
        let dir_path = temp_dir.path().join("new_dir");
        let result = manager.create_directory(&dir_path).await;
        
        assert!(result.is_ok());
        assert!(dir_path.exists());
        assert!(dir_path.is_dir());
    }
    
    #[tokio::test]
    async fn test_rename() {
        let (manager, temp_dir) = create_test_manager().await;
        
        // Create a file
        let old_path = create_test_file(temp_dir.path(), "old_name.txt", "content").await;
        
        // Rename it
        let result = manager.rename(&old_path, "new_name.txt").await;
        
        assert!(result.is_ok());
        
        // Verify
        let new_path = temp_dir.path().join("new_name.txt");
        assert!(!old_path.exists());
        assert!(new_path.exists());
        
        let content = fs::read_to_string(&new_path).await.unwrap();
        assert_eq!(content, "content");
    }
    
    #[tokio::test]
    async fn test_copy_files() {
        let (manager, temp_dir) = create_test_manager().await;
        
        // Create source files
        let src_dir = create_test_dir(temp_dir.path(), "src").await;
        let file1 = create_test_file(&src_dir, "file1.txt", "content1").await;
        let file2 = create_test_file(&src_dir, "file2.txt", "content2").await;
        
        // Create destination
        let dest_dir = create_test_dir(temp_dir.path(), "dest").await;
        
        // Copy files
        let result = manager.copy_files(vec![file1.clone(), file2.clone()], &dest_dir).await;
        
        assert!(result.is_ok());
        
        // Verify copies
        let dest_file1 = dest_dir.join("file1.txt");
        let dest_file2 = dest_dir.join("file2.txt");
        
        assert!(dest_file1.exists());
        assert!(dest_file2.exists());
        
        // Original files should still exist
        assert!(file1.exists());
        assert!(file2.exists());
        
        // Content should match
        let content1 = fs::read_to_string(&dest_file1).await.unwrap();
        assert_eq!(content1, "content1");
    }
    
    #[tokio::test]
    async fn test_move_files() {
        let (manager, temp_dir) = create_test_manager().await;
        
        // Create source files
        let src_dir = create_test_dir(temp_dir.path(), "src").await;
        let file1 = create_test_file(&src_dir, "file1.txt", "content1").await;
        
        // Create destination
        let dest_dir = create_test_dir(temp_dir.path(), "dest").await;
        
        // Move file
        let result = manager.move_files(vec![file1.clone()], &dest_dir).await;
        
        assert!(result.is_ok());
        
        // Verify move
        let dest_file = dest_dir.join("file1.txt");
        assert!(dest_file.exists());
        assert!(!file1.exists()); // Original should be gone
        
        let content = fs::read_to_string(&dest_file).await.unwrap();
        assert_eq!(content, "content1");
    }
    
    #[tokio::test]
    async fn test_delete_permanent() {
        let (manager, temp_dir) = create_test_manager().await;
        
        let file_path = create_test_file(temp_dir.path(), "delete_me.txt", "content").await;
        
        let result = manager.delete_permanent(&file_path).await;
        
        assert!(result.is_ok());
        assert!(!file_path.exists());
    }
    
    #[tokio::test]
    async fn test_get_file_info() {
        let (manager, temp_dir) = create_test_manager().await;
        
        let file_path = create_test_file(temp_dir.path(), "info.txt", "test content").await;
        
        let content = manager.read_file(file_path.to_str().unwrap()).await.unwrap();
        
        assert_eq!(content, "test content");
    }
    
    #[tokio::test]
    async fn test_search() {
        let (manager, temp_dir) = create_test_manager().await;
        
        // Create test structure
        let src_dir = create_test_dir(temp_dir.path(), "src").await;
        create_test_file(&src_dir, "main.rs", "fn main() {}").await;
        create_test_file(&src_dir, "lib.rs", "pub fn test() {}").await;
        create_test_file(temp_dir.path(), "README.md", "# Test Project").await;
        create_test_file(temp_dir.path(), "Cargo.toml", "[package]").await;
        
        // Search for .rs files
        let results = manager.search_files("*.rs", Some(temp_dir.path())).await.unwrap();
        
        assert_eq!(results.len(), 2);
        assert!(results.iter().any(|p| p.to_string_lossy().ends_with("main.rs")));
        assert!(results.iter().any(|p| p.to_string_lossy().ends_with("lib.rs")));
    }
    
    
    #[tokio::test]
    async fn test_build_file_tree() {
        let (manager, temp_dir) = create_test_manager().await;
        
        // Create tree structure
        let src = create_test_dir(temp_dir.path(), "src").await;
        create_test_file(&src, "main.rs", "").await;
        let tests = create_test_dir(&src, "tests").await;
        create_test_file(&tests, "test.rs", "").await;
        
        let tree = manager.build_file_tree(Some(3)).await.unwrap();
        
        // Verify structure has children
        assert!(tree.children.is_some());
        assert!(!tree.children.as_ref().unwrap().is_empty());
    }
}