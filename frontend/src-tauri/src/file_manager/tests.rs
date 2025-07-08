#[cfg(test)]
mod tests {
    use tempfile::TempDir;
    use tokio::fs;
    use crate::file_manager::{FileManager, FileEntryType, FileOperationResult};
    use crate::error::Result;
    
    async fn create_test_structure(dir: &TempDir) -> Result<()> {
        // Create directory structure
        let src = dir.path().join("src");
        let tests = dir.path().join("tests");
        let docs = dir.path().join("docs");
        
        fs::create_dir(&src).await?;
        fs::create_dir(&tests).await?;
        fs::create_dir(&docs).await?;
        
        // Create files
        fs::write(src.join("main.rs"), "fn main() {}\n").await?;
        fs::write(src.join("lib.rs"), "pub mod utils;\n").await?;
        fs::write(tests.join("test.rs"), "#[test]\nfn test() {}\n").await?;
        fs::write(docs.join("README.md"), "# Documentation\n").await?;
        fs::write(dir.path().join(".gitignore"), "target/\n").await?;
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_file_manager_init() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        let mut file_manager = FileManager::new(temp_dir.path().to_path_buf());
        
        file_manager.init().await?;
        
        // Should initialize without errors
        Ok(())
    }
    
    #[tokio::test]
    async fn test_build_file_tree() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        create_test_structure(&temp_dir).await?;
        
        let mut file_manager = FileManager::new(temp_dir.path().to_path_buf());
        file_manager.init().await?;
        
        let tree = file_manager.build_file_tree(None).await?;
        
        assert_eq!(tree.name, temp_dir.path().file_name().unwrap().to_str().unwrap());
        assert!(tree.is_directory);
        assert!(tree.children.is_some());
        
        let children = tree.children.unwrap();
        assert!(children.len() >= 3); // At least src, tests, docs
        
        // Check for specific directories
        let has_src = children.iter().any(|n| n.name == "src");
        let has_tests = children.iter().any(|n| n.name == "tests");
        let has_docs = children.iter().any(|n| n.name == "docs");
        
        assert!(has_src);
        assert!(has_tests);
        assert!(has_docs);
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_build_file_tree_max_depth() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        create_test_structure(&temp_dir).await?;
        
        // Create deeper structure
        let deep = temp_dir.path().join("src/deep/deeper/deepest");
        fs::create_dir_all(&deep).await?;
        fs::write(deep.join("file.txt"), "deep file").await?;
        
        let mut file_manager = FileManager::new(temp_dir.path().to_path_buf());
        file_manager.init().await?;
        
        // Build tree with max depth
        let tree = file_manager.build_file_tree(Some(2)).await?;
        
        // Should only go 2 levels deep
        let src = tree.children.as_ref().unwrap()
            .iter().find(|n| n.name == "src").unwrap();
        
        assert!(src.children.is_some());
        
        let deep_dir = src.children.as_ref().unwrap()
            .iter().find(|n| n.name == "deep");
        
        // Should have deep but not deeper
        assert!(deep_dir.is_some());
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_expand_collapse_directory() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        create_test_structure(&temp_dir).await?;
        
        let mut file_manager = FileManager::new(temp_dir.path().to_path_buf());
        file_manager.init().await?;
        
        let src_path = temp_dir.path().join("src");
        
        // Expand directory
        let children = file_manager.expand_directory(&src_path).await?;
        
        assert!(children.len() >= 2); // main.rs and lib.rs
        assert!(children.iter().any(|n| n.name == "main.rs"));
        assert!(children.iter().any(|n| n.name == "lib.rs"));
        
        // Collapse directory
        file_manager.collapse_directory(&src_path).await?;
        
        // Should not error
        Ok(())
    }
    
    #[tokio::test]
    async fn test_create_file() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        let file_manager = FileManager::new(temp_dir.path().to_path_buf());
        
        let file_path = temp_dir.path().join("test.txt");
        
        file_manager.create_file(&file_path, "Hello, world!").await?;
        
        // Verify file exists
        assert!(file_path.exists());
        
        // Verify content
        let content = fs::read_to_string(&file_path).await?;
        assert_eq!(content, "Hello, world!");
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_create_directory() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        let file_manager = FileManager::new(temp_dir.path().to_path_buf());
        
        let dir_path = temp_dir.path().join("new_dir");
        
        file_manager.create_directory(&dir_path).await?;
        
        // Verify directory exists
        assert!(dir_path.exists());
        assert!(dir_path.is_dir());
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_delete_to_trash() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        let file_manager = FileManager::new(temp_dir.path().to_path_buf());
        
        let file_path = temp_dir.path().join("delete_me.txt");
        fs::write(&file_path, "delete me").await?;
        
        file_manager.delete_to_trash(&file_path).await?;
        
        // File should be gone (moved to trash)
        assert!(!file_path.exists());
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_rename_file() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        let file_manager = FileManager::new(temp_dir.path().to_path_buf());
        
        let old_path = temp_dir.path().join("old_name.txt");
        fs::write(&old_path, "content").await?;
        
        file_manager.rename(&old_path, "new_name.txt").await?;
        
        let new_path = temp_dir.path().join("new_name.txt");
        
        // Old file should be gone
        assert!(!old_path.exists());
        
        // New file should exist
        assert!(new_path.exists());
        
        // Content should be preserved
        let content = fs::read_to_string(&new_path).await?;
        assert_eq!(content, "content");
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_move_file() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        let file_manager = FileManager::new(temp_dir.path().to_path_buf());
        
        // Create source and destination directories
        let src_dir = temp_dir.path().join("src");
        let dst_dir = temp_dir.path().join("dst");
        fs::create_dir(&src_dir).await?;
        fs::create_dir(&dst_dir).await?;
        
        let file_path = src_dir.join("file.txt");
        fs::write(&file_path, "content").await?;
        
        file_manager.move_file(
            file_path.to_str().unwrap(),
            dst_dir.join("file.txt").to_str().unwrap()
        ).await?;
        
        // File should be moved
        assert!(!file_path.exists());
        assert!(dst_dir.join("file.txt").exists());
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_move_multiple_files() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        let file_manager = FileManager::new(temp_dir.path().to_path_buf());
        
        let dst_dir = temp_dir.path().join("destination");
        fs::create_dir(&dst_dir).await?;
        
        // Create multiple files
        let file1 = temp_dir.path().join("file1.txt");
        let file2 = temp_dir.path().join("file2.txt");
        fs::write(&file1, "content1").await?;
        fs::write(&file2, "content2").await?;
        
        file_manager.move_files(vec![file1.clone(), file2.clone()], &dst_dir).await?;
        
        // Files should be moved
        assert!(!file1.exists());
        assert!(!file2.exists());
        assert!(dst_dir.join("file1.txt").exists());
        assert!(dst_dir.join("file2.txt").exists());
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_copy_file() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        let file_manager = FileManager::new(temp_dir.path().to_path_buf());
        
        let src_file = temp_dir.path().join("source.txt");
        let dst_file = temp_dir.path().join("copy.txt");
        fs::write(&src_file, "content").await?;
        
        let result = file_manager.copy_file(
            src_file.to_str().unwrap(),
            dst_file.to_str().unwrap()
        ).await?;
        
        assert_eq!(result, FileOperationResult::Success);
        
        // Both files should exist
        assert!(src_file.exists());
        assert!(dst_file.exists());
        
        // Content should match
        let src_content = fs::read_to_string(&src_file).await?;
        let dst_content = fs::read_to_string(&dst_file).await?;
        assert_eq!(src_content, dst_content);
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_copy_file_conflict() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        let file_manager = FileManager::new(temp_dir.path().to_path_buf());
        
        let src_file = temp_dir.path().join("source.txt");
        let dst_file = temp_dir.path().join("existing.txt");
        fs::write(&src_file, "source content").await?;
        fs::write(&dst_file, "existing content").await?;
        
        let result = file_manager.copy_file(
            src_file.to_str().unwrap(),
            dst_file.to_str().unwrap()
        ).await?;
        
        assert_eq!(result, FileOperationResult::Conflict);
        
        // Existing file should not be overwritten
        let content = fs::read_to_string(&dst_file).await?;
        assert_eq!(content, "existing content");
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_get_file_preview() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        let file_manager = FileManager::new(temp_dir.path().to_path_buf());
        
        let file_path = temp_dir.path().join("preview.txt");
        let content = (0..20).map(|i| format!("Line {}", i)).collect::<Vec<_>>().join("\n");
        fs::write(&file_path, &content).await?;
        
        let preview = file_manager.get_file_preview(&file_path, 5).await?;
        
        // Should only show first 5 lines
        let lines: Vec<&str> = preview.lines().collect();
        assert_eq!(lines.len(), 5);
        assert!(lines[0].contains("Line 0"));
        assert!(lines[4].contains("Line 4"));
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_search_files() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        create_test_structure(&temp_dir).await?;
        
        let file_manager = FileManager::new(temp_dir.path().to_path_buf());
        
        // Search for .rs files
        let results = file_manager.search_files("*.rs", None).await?;
        
        assert!(results.len() >= 3); // main.rs, lib.rs, test.rs
        
        // All results should be .rs files
        for path in &results {
            assert_eq!(path.extension().unwrap(), "rs");
        }
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_list_directory() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        create_test_structure(&temp_dir).await?;
        
        let file_manager = FileManager::new(temp_dir.path().to_path_buf());
        
        let entries = file_manager.list_directory(temp_dir.path().to_str().unwrap()).await?;
        
        // Should have directories first, then files
        let first_dir_idx = entries.iter().position(|e| e.file_type == FileEntryType::Directory);
        let first_file_idx = entries.iter().position(|e| e.file_type == FileEntryType::File);
        
        if let (Some(dir_idx), Some(file_idx)) = (first_dir_idx, first_file_idx) {
            assert!(dir_idx < file_idx);
        }
        
        // Check specific entries
        let has_src = entries.iter().any(|e| e.name == "src" && e.file_type == FileEntryType::Directory);
        assert!(has_src);
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_read_save_file() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        let file_manager = FileManager::new(temp_dir.path().to_path_buf());
        
        let file_path = temp_dir.path().join("test.txt");
        let file_path_str = file_path.to_str().unwrap();
        
        // Save file
        file_manager.save_file(file_path_str, "Hello, world!").await?;
        
        // Read file
        let content = file_manager.read_file(file_path_str).await?;
        assert_eq!(content, "Hello, world!");
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_read_binary_file_error() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        let file_manager = FileManager::new(temp_dir.path().to_path_buf());
        
        let file_path = temp_dir.path().join("binary.dat");
        fs::write(&file_path, vec![0xFF, 0xFE, 0x00, 0x01]).await?;
        
        let result = file_manager.read_file(file_path.to_str().unwrap()).await;
        
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Cannot read binary file"));
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_operation_history() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        let file_manager = FileManager::new(temp_dir.path().to_path_buf());
        
        // Perform some operations
        let file1 = temp_dir.path().join("file1.txt");
        let file2 = temp_dir.path().join("file2.txt");
        
        file_manager.create_file(&file1, "content1").await?;
        file_manager.create_file(&file2, "content2").await?;
        file_manager.delete_to_trash(&file1).await?;
        
        let history = file_manager.get_operation_history(10).await;
        
        assert!(history.len() >= 3);
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_undo_operation() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        let file_manager = FileManager::new(temp_dir.path().to_path_buf());
        
        let file_path = temp_dir.path().join("undo_test.txt");
        file_manager.create_file(&file_path, "content").await?;
        
        // Delete file
        file_manager.delete_to_trash(&file_path).await?;
        assert!(!file_path.exists());
        
        // Undo deletion
        file_manager.undo_last_operation().await?;
        
        // File should be restored
        assert!(file_path.exists());
        let content = fs::read_to_string(&file_path).await?;
        assert_eq!(content, "content");
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_gitignore_patterns() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        
        // Create .gitignore
        fs::write(
            temp_dir.path().join(".gitignore"),
            "target/\n*.log\nnode_modules/\n"
        ).await?;
        
        // Create ignored directory
        let target_dir = temp_dir.path().join("target");
        fs::create_dir(&target_dir).await?;
        fs::write(target_dir.join("ignored.txt"), "ignored").await?;
        
        // Create normal file
        fs::write(temp_dir.path().join("normal.txt"), "normal").await?;
        
        let mut file_manager = FileManager::new(temp_dir.path().to_path_buf());
        file_manager.init().await?;
        
        let tree = file_manager.build_file_tree(None).await?;
        
        // Should not include ignored patterns
        let children = tree.children.unwrap();
        let has_target = children.iter().any(|n| n.name == "target");
        let has_normal = children.iter().any(|n| n.name == "normal.txt");
        
        assert!(!has_target); // Should be ignored
        assert!(has_normal);  // Should be included
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_safe_path_validation() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        let file_manager = FileManager::new(temp_dir.path().to_path_buf());
        
        // Try to save file outside root
        let outside_path = "/tmp/outside.txt";
        let result = file_manager.save_file(outside_path, "content").await;
        
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Path must be within project root"));
        
        Ok(())
    }
}

#[cfg(all(test, not(target_os = "windows")))]
mod unix_tests {
    use super::*;
    
    #[tokio::test]
    async fn test_symlink_handling() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        let file_manager = FileManager::new(temp_dir.path().to_path_buf());
        
        // Create target file
        let target = temp_dir.path().join("target.txt");
        fs::write(&target, "target content").await?;
        
        // Create symlink
        let link = temp_dir.path().join("link.txt");
        std::os::unix::fs::symlink(&target, &link)?;
        
        let entries = file_manager.list_directory(temp_dir.path().to_str().unwrap()).await?;
        
        // Should detect symlink
        let link_entry = entries.iter().find(|e| e.name == "link.txt");
        assert!(link_entry.is_some());
        assert_eq!(link_entry.unwrap().file_type, FileEntryType::Symlink);
        
        Ok(())
    }
}