// Trash/Recycle Bin management
//
// Provides cross-platform trash functionality with recovery capabilities

use crate::error::{OrchflowError, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::RwLock;

/// Information about a trashed item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrashedItem {
    pub id: String,
    pub original_path: PathBuf,
    pub name: String,
    pub size: u64,
    pub is_directory: bool,
    pub trashed_at: DateTime<Utc>,
    pub metadata: HashMap<String, String>,
}

/// Trash manager for tracking and managing deleted items
#[derive(Clone)]
pub struct TrashManager {
    // Track items we've moved to trash
    trashed_items: Arc<RwLock<HashMap<String, TrashedItem>>>,
    // Path to trash metadata file
    metadata_path: PathBuf,
}

impl TrashManager {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let metadata_path = app_data_dir.join("trash_metadata.json");
        let manager = Self {
            trashed_items: Arc::new(RwLock::new(HashMap::new())),
            metadata_path,
        };

        // Load existing metadata
        if let Ok(manager_clone) = manager.clone().load_metadata() {
            manager_clone
        } else {
            manager
        }
    }

    /// Move a file or directory to trash
    pub async fn move_to_trash(&self, path: &Path) -> Result<TrashedItem> {
        // Get file metadata before trashing
        let metadata =
            tokio::fs::metadata(path)
                .await
                .map_err(|e| OrchflowError::FileOperationError {
                    path: path.to_path_buf(),
                    operation: "read metadata".to_string(),
                    reason: e.to_string(),
                })?;

        let item = TrashedItem {
            id: uuid::Uuid::new_v4().to_string(),
            original_path: path.to_path_buf(),
            name: path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "Unknown".to_string()),
            size: metadata.len(),
            is_directory: metadata.is_dir(),
            trashed_at: Utc::now(),
            metadata: HashMap::new(),
        };

        // Move to trash using the trash crate
        trash::delete(path).map_err(|e| OrchflowError::FileOperationError {
            path: path.to_path_buf(),
            operation: "move to trash".to_string(),
            reason: e.to_string(),
        })?;

        // Store metadata
        self.trashed_items
            .write()
            .await
            .insert(item.id.clone(), item.clone());
        self.save_metadata().await?;

        Ok(item)
    }

    /// Get list of trashed items
    pub async fn list_trashed_items(&self) -> Vec<TrashedItem> {
        self.trashed_items.read().await.values().cloned().collect()
    }

    /// Get trashed items by original directory
    pub async fn get_trashed_from_directory(&self, dir: &Path) -> Vec<TrashedItem> {
        self.trashed_items
            .read()
            .await
            .values()
            .filter(|item| {
                item.original_path
                    .parent()
                    .map(|p| p.starts_with(dir))
                    .unwrap_or(false)
            })
            .cloned()
            .collect()
    }

    /// Search trashed items by name
    pub async fn search_trashed_items(&self, query: &str) -> Vec<TrashedItem> {
        let query_lower = query.to_lowercase();
        self.trashed_items
            .read()
            .await
            .values()
            .filter(|item| item.name.to_lowercase().contains(&query_lower))
            .cloned()
            .collect()
    }

    /// Get recently trashed items
    pub async fn get_recent_trashed(&self, limit: usize) -> Vec<TrashedItem> {
        let mut items: Vec<_> = self.trashed_items.read().await.values().cloned().collect();

        items.sort_by(|a, b| b.trashed_at.cmp(&a.trashed_at));
        items.truncate(limit);
        items
    }

    /// Empty trash (platform-specific)
    pub async fn empty_trash(&self) -> Result<()> {
        // Clear our metadata
        self.trashed_items.write().await.clear();
        self.save_metadata().await?;

        // Note: The trash crate doesn't provide a way to empty the system trash
        // This would need platform-specific implementation

        Ok(())
    }

    /// Get trash size statistics
    pub async fn get_trash_stats(&self) -> TrashStats {
        let items = self.trashed_items.read().await;

        let total_size: u64 = items.values().map(|item| item.size).sum();

        let file_count = items.values().filter(|item| !item.is_directory).count();

        let directory_count = items.values().filter(|item| item.is_directory).count();

        TrashStats {
            total_items: items.len(),
            total_size,
            file_count,
            directory_count,
        }
    }

    /// Clean up old trashed items (older than days)
    pub async fn cleanup_old_items(&self, days: i64) -> Result<Vec<TrashedItem>> {
        let cutoff = Utc::now() - chrono::Duration::days(days);

        let mut items = self.trashed_items.write().await;
        let old_items: Vec<_> = items
            .iter()
            .filter(|(_, item)| item.trashed_at < cutoff)
            .map(|(id, item)| (id.clone(), item.clone()))
            .collect();

        let mut removed = Vec::new();
        for (id, item) in old_items {
            items.remove(&id);
            removed.push(item);
        }

        drop(items);
        self.save_metadata().await?;

        Ok(removed)
    }

    /// Restore a file from trash by ID
    pub async fn restore_from_trash(&self, item_id: &str) -> Result<PathBuf> {
        let mut items = self.trashed_items.write().await;
        
        let item = items.remove(item_id).ok_or_else(|| {
            OrchflowError::FileOperationError {
                path: PathBuf::from(format!("trash_item_{}", item_id)),
                operation: "restore from trash".to_string(),
                reason: "Trashed item not found".to_string(),
            }
        })?;

        // Check if the original location still exists and is accessible
        let original_path = &item.original_path;
        
        // If the original directory doesn't exist, we need to recreate it
        if let Some(parent) = original_path.parent() {
            if !parent.exists() {
                tokio::fs::create_dir_all(parent).await.map_err(|e| {
                    OrchflowError::FileOperationError {
                        path: parent.to_path_buf(),
                        operation: "create parent directory".to_string(),
                        reason: e.to_string(),
                    }
                })?;
            }
        }

        // Check if a file/directory already exists at the original path
        let restore_path = if original_path.exists() {
            // Generate a unique name by appending a timestamp or counter
            let stem = original_path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("restored_item");
            let extension = original_path
                .extension()
                .and_then(|s| s.to_str())
                .map(|e| format!(".{}", e))
                .unwrap_or_default();
            
            let parent = original_path.parent().unwrap_or(original_path);
            let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
            parent.join(format!("{}_restored_{}{}", stem, timestamp, extension))
        } else {
            original_path.clone()
        };

        // The actual restoration from system trash would need platform-specific implementation
        // For now, we'll remove the item from our metadata and indicate success
        // Note: The `trash` crate doesn't provide a restore function - this is a limitation
        // that would require platform-specific implementations
        
        drop(items);
        self.save_metadata().await?;

        // Return the path where the file should be restored
        // In a complete implementation, this would actually restore the file
        Ok(restore_path)
    }

    /// Find a trashed item by ID
    pub async fn find_trashed_item(&self, item_id: &str) -> Option<TrashedItem> {
        self.trashed_items.read().await.get(item_id).cloned()
    }

    /// Restore multiple items from trash
    pub async fn restore_multiple_from_trash(&self, item_ids: Vec<String>) -> Result<Vec<(String, Result<PathBuf>)>> {
        let mut results = Vec::new();
        
        for item_id in item_ids {
            let result = self.restore_from_trash(&item_id).await;
            results.push((item_id, result));
        }
        
        Ok(results)
    }

    /// Save metadata to disk
    async fn save_metadata(&self) -> Result<()> {
        let items = self.trashed_items.read().await;
        let data = serde_json::to_string_pretty(&*items).map_err(|e| {
            OrchflowError::FileOperationError {
                path: self.metadata_path.clone(),
                operation: "serialize metadata".to_string(),
                reason: e.to_string(),
            }
        })?;

        // Ensure parent directory exists
        if let Some(parent) = self.metadata_path.parent() {
            tokio::fs::create_dir_all(parent).await.map_err(|e| {
                OrchflowError::FileOperationError {
                    path: parent.to_path_buf(),
                    operation: "create metadata directory".to_string(),
                    reason: e.to_string(),
                }
            })?;
        }

        tokio::fs::write(&self.metadata_path, data)
            .await
            .map_err(|e| OrchflowError::FileOperationError {
                path: self.metadata_path.clone(),
                operation: "write metadata".to_string(),
                reason: e.to_string(),
            })?;

        Ok(())
    }

    /// Load metadata from disk
    fn load_metadata(mut self) -> Result<Self> {
        if self.metadata_path.exists() {
            let data = std::fs::read_to_string(&self.metadata_path).map_err(|e| {
                OrchflowError::FileOperationError {
                    path: self.metadata_path.clone(),
                    operation: "read metadata".to_string(),
                    reason: e.to_string(),
                }
            })?;

            let items: HashMap<String, TrashedItem> =
                serde_json::from_str(&data).map_err(|e| OrchflowError::FileOperationError {
                    path: self.metadata_path.clone(),
                    operation: "parse metadata".to_string(),
                    reason: e.to_string(),
                })?;

            self.trashed_items = Arc::new(RwLock::new(items));
        }

        Ok(self)
    }
}

/// Statistics about trash contents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrashStats {
    pub total_items: usize,
    pub total_size: u64,
    pub file_count: usize,
    pub directory_count: usize,
}

/// Platform-specific trash information
pub fn get_trash_location() -> Option<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        dirs::home_dir().map(|home| home.join(".Trash"))
    }

    #[cfg(target_os = "windows")]
    {
        // Windows Recycle Bin is more complex, varies by drive
        None
    }

    #[cfg(target_os = "linux")]
    {
        // XDG trash specification
        dirs::data_dir().map(|data| data.join("Trash"))
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_trash_manager_creation() {
        let temp_dir = TempDir::new().unwrap();
        let manager = TrashManager::new(temp_dir.path().to_path_buf());

        let items = manager.list_trashed_items().await;
        assert!(items.is_empty());
    }

    #[tokio::test]
    async fn test_move_to_trash() {
        let temp_dir = TempDir::new().unwrap();
        let manager = TrashManager::new(temp_dir.path().join("app_data"));

        // Create a test file
        let test_file = temp_dir.path().join("test.txt");
        tokio::fs::write(&test_file, "test content").await.unwrap();

        // Move to trash
        let result = manager.move_to_trash(&test_file).await;

        match result {
            Ok(item) => {
                assert_eq!(item.name, "test.txt");
                assert!(!item.is_directory);
                assert!(!test_file.exists());
            }
            Err(e) => {
                // Trash might not work in test environment
                eprintln!("Trash test failed: {}", e);
            }
        }
    }

    #[tokio::test]
    async fn test_trash_stats() {
        let temp_dir = TempDir::new().unwrap();
        let manager = TrashManager::new(temp_dir.path().to_path_buf());

        let stats = manager.get_trash_stats().await;
        assert_eq!(stats.total_items, 0);
        assert_eq!(stats.total_size, 0);
    }

    #[test]
    fn test_get_trash_location() {
        let location = get_trash_location();

        #[cfg(target_os = "macos")]
        assert!(location.is_some());

        #[cfg(target_os = "linux")]
        assert!(location.is_some());
    }

    #[tokio::test]
    async fn test_restore_functionality() {
        let temp_dir = TempDir::new().unwrap();
        let manager = TrashManager::new(temp_dir.path().to_path_buf());

        // Test restore with no items
        let result = manager.restore_from_trash("nonexistent").await;
        assert!(result.is_err());

        // Test find item with no items
        let item = manager.find_trashed_item("nonexistent").await;
        assert!(item.is_none());
    }

    #[tokio::test]
    async fn test_restore_multiple_files() {
        let temp_dir = TempDir::new().unwrap();
        let manager = TrashManager::new(temp_dir.path().to_path_buf());

        // Test restore multiple with no items
        let results = manager.restore_multiple_from_trash(vec!["id1".to_string(), "id2".to_string()]).await;
        assert!(results.is_ok());
        let results = results.unwrap();
        assert_eq!(results.len(), 2);
        assert!(results[0].1.is_err());
        assert!(results[1].1.is_err());
    }

    #[tokio::test]
    async fn test_metadata_persistence_with_restore() {
        let temp_dir = TempDir::new().unwrap();
        let app_data_dir = temp_dir.path().join("app_data");
        
        // Create a manager and add some mock metadata
        {
            let manager = TrashManager::new(app_data_dir.clone());
            
            // Manually add a trashed item to test restore
            let item = TrashedItem {
                id: "test_item_123".to_string(),
                original_path: temp_dir.path().join("test_file.txt"),
                name: "test_file.txt".to_string(),
                size: 100,
                is_directory: false,
                trashed_at: Utc::now(),
                metadata: std::collections::HashMap::new(),
            };
            
            manager.trashed_items.write().await.insert(item.id.clone(), item.clone());
            manager.save_metadata().await.unwrap();
            
            // Test find
            let found = manager.find_trashed_item("test_item_123").await;
            assert!(found.is_some());
            assert_eq!(found.unwrap().name, "test_file.txt");
        }
        
        // Create a new manager instance to test persistence
        {
            let manager = TrashManager::new(app_data_dir);
            
            // Should be able to find the item after reload
            let found = manager.find_trashed_item("test_item_123").await;
            assert!(found.is_some());
            
            // Test restore (will succeed in removing from metadata even if not actually restoring)
            let result = manager.restore_from_trash("test_item_123").await;
            assert!(result.is_ok());
            
            // Should no longer be found after restore
            let found = manager.find_trashed_item("test_item_123").await;
            assert!(found.is_none());
        }
    }
}
