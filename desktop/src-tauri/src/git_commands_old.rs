// Git-related Tauri commands

use tauri::State;
use crate::manager::Manager;
use crate::error::Result;
use serde_json::Value;
use std::path::PathBuf;

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