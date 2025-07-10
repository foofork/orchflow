// Trash-related Tauri commands

use tauri::State;
use crate::manager::Manager;
use crate::error::Result;
use serde_json::Value;
use std::path::PathBuf;

/// List all trashed items
#[tauri::command]
pub async fn list_trash(
    manager: State<'_, Manager>,
) -> Result<Vec<Value>> {
    if let Some(file_manager) = &manager.file_manager {
        let items = file_manager.list_trash().await;
        let json_items = items.into_iter()
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
        let json_items = items.into_iter()
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
pub async fn search_trash(
    query: String,
    manager: State<'_, Manager>,
) -> Result<Vec<Value>> {
    if let Some(file_manager) = &manager.file_manager {
        let items = file_manager.search_trash(&query).await;
        let json_items = items.into_iter()
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
pub async fn get_trash_stats(
    manager: State<'_, Manager>,
) -> Result<Value> {
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
pub async fn get_recent_trash(
    limit: usize,
    manager: State<'_, Manager>,
) -> Result<Vec<Value>> {
    if let Some(file_manager) = &manager.file_manager {
        let items = file_manager.get_recent_trash(limit).await;
        let json_items = items.into_iter()
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
pub async fn cleanup_old_trash(
    days: i64,
    manager: State<'_, Manager>,
) -> Result<Vec<Value>> {
    if let Some(file_manager) = &manager.file_manager {
        let removed_items = file_manager.cleanup_old_trash(days).await?;
        let json_items = removed_items.into_iter()
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
pub async fn empty_trash(
    manager: State<'_, Manager>,
) -> Result<()> {
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
    crate::file_manager::trash::get_trash_location()
        .map(|path| path.to_string_lossy().to_string())
}