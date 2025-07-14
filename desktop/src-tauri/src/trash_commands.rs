// Trash-related Tauri commands

use crate::error::Result;
use crate::manager::Manager;
use serde_json::Value;
use std::path::PathBuf;
use tauri::State;

/// List all trashed items
#[tauri::command]
pub async fn list_trash(manager: State<'_, Manager>) -> Result<Vec<Value>> {
    if let Some(file_manager) = &manager.file_manager {
        let items = file_manager.list_trash().await;
        let json_items = items
            .into_iter()
            .map(|item| serde_json::to_value(item).unwrap())
            .collect();
        Ok(json_items)
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "file_manager".to_string(),
            reason: "File manager not initialized".to_string(),
        })
    }
}

/// Get trashed items from a specific directory
#[tauri::command]
pub async fn get_trash_from_directory(
    path: String,
    manager: State<'_, Manager>,
) -> Result<Vec<Value>> {
    if let Some(file_manager) = &manager.file_manager {
        let dir_path = PathBuf::from(path);
        let items = file_manager.get_trash_from_directory(&dir_path).await;
        let json_items = items
            .into_iter()
            .map(|item| serde_json::to_value(item).unwrap())
            .collect();
        Ok(json_items)
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "file_manager".to_string(),
            reason: "File manager not initialized".to_string(),
        })
    }
}

/// Search trash by name
#[tauri::command]
pub async fn search_trash(query: String, manager: State<'_, Manager>) -> Result<Vec<Value>> {
    if let Some(file_manager) = &manager.file_manager {
        let items = file_manager.search_trash(&query).await;
        let json_items = items
            .into_iter()
            .map(|item| serde_json::to_value(item).unwrap())
            .collect();
        Ok(json_items)
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "file_manager".to_string(),
            reason: "File manager not initialized".to_string(),
        })
    }
}

/// Get trash statistics
#[tauri::command]
pub async fn get_trash_stats(manager: State<'_, Manager>) -> Result<Value> {
    if let Some(file_manager) = &manager.file_manager {
        let stats = file_manager.get_trash_stats().await;
        Ok(serde_json::to_value(stats).unwrap())
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "file_manager".to_string(),
            reason: "File manager not initialized".to_string(),
        })
    }
}

/// Get recently trashed items
#[tauri::command]
pub async fn get_recent_trash(limit: usize, manager: State<'_, Manager>) -> Result<Vec<Value>> {
    if let Some(file_manager) = &manager.file_manager {
        let items = file_manager.get_recent_trash(limit).await;
        let json_items = items
            .into_iter()
            .map(|item| serde_json::to_value(item).unwrap())
            .collect();
        Ok(json_items)
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "file_manager".to_string(),
            reason: "File manager not initialized".to_string(),
        })
    }
}

/// Clean up old trash items (older than specified days)
#[tauri::command]
pub async fn cleanup_old_trash(days: i64, manager: State<'_, Manager>) -> Result<Vec<Value>> {
    if let Some(file_manager) = &manager.file_manager {
        let removed_items = file_manager.cleanup_old_trash(days).await?;
        let json_items = removed_items
            .into_iter()
            .map(|item| serde_json::to_value(item).unwrap())
            .collect();
        Ok(json_items)
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "file_manager".to_string(),
            reason: "File manager not initialized".to_string(),
        })
    }
}

/// Empty the trash
#[tauri::command]
pub async fn empty_trash(manager: State<'_, Manager>) -> Result<()> {
    if let Some(file_manager) = &manager.file_manager {
        file_manager.empty_trash().await
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "file_manager".to_string(),
            reason: "File manager not initialized".to_string(),
        })
    }
}

/// Get the platform-specific trash location
#[tauri::command]
pub fn get_trash_location() -> Option<String> {
    crate::file_manager::trash::get_trash_location().map(|path| path.to_string_lossy().to_string())
}

/// Restore a file from trash by ID
#[tauri::command]
pub async fn restore_file_from_trash(item_id: String, manager: State<'_, Manager>) -> Result<Value> {
    if let Some(file_manager) = &manager.file_manager {
        let restore_path = file_manager.restore_from_trash(&item_id).await?;
        Ok(serde_json::json!({
            "restored": true,
            "item_id": item_id,
            "restore_path": restore_path.to_string_lossy().to_string()
        }))
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "file_manager".to_string(),
            reason: "File manager not initialized".to_string(),
        })
    }
}

/// Find a trashed item by ID
#[tauri::command]
pub async fn find_trashed_item(item_id: String, manager: State<'_, Manager>) -> Result<Option<Value>> {
    if let Some(file_manager) = &manager.file_manager {
        let item = file_manager.find_trashed_item(&item_id).await;
        Ok(item.map(|i| serde_json::to_value(i).unwrap()))
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "file_manager".to_string(),
            reason: "File manager not initialized".to_string(),
        })
    }
}

/// Restore multiple files from trash
#[tauri::command]
pub async fn restore_multiple_files_from_trash(
    item_ids: Vec<String>, 
    manager: State<'_, Manager>
) -> Result<Vec<Value>> {
    if let Some(file_manager) = &manager.file_manager {
        let results = file_manager.restore_multiple_from_trash(item_ids).await?;
        
        let json_results = results
            .into_iter()
            .map(|(item_id, result)| {
                match result {
                    Ok(restore_path) => serde_json::json!({
                        "item_id": item_id,
                        "success": true,
                        "restore_path": restore_path.to_string_lossy().to_string()
                    }),
                    Err(error) => serde_json::json!({
                        "item_id": item_id,
                        "success": false,
                        "error": error.to_string()
                    })
                }
            })
            .collect();
            
        Ok(json_results)
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "file_manager".to_string(),
            reason: "File manager not initialized".to_string(),
        })
    }
}
