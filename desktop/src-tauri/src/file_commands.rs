use crate::error::Result;
use crate::file_manager::{FileNode, FileOperation};
use crate::manager::{Action, Manager};
use serde::{Deserialize, Serialize};
use tauri::State;

/// Get the file tree for a directory
#[tauri::command]
pub async fn get_file_tree(
    manager: State<'_, Manager>,
    path: Option<String>,
    max_depth: Option<usize>,
) -> Result<FileNode> {
    let error_path = path.clone().unwrap_or_else(|| ".".to_string());
    let action = Action::GetFileTree {
        path,
        max_depth: max_depth.map(|d| d as u32),
    };

    let result = manager.execute_action(action).await.map_err(|e| {
        crate::error::OrchflowError::FileOperationError {
            operation: "get_file_tree".to_string(),
            path: error_path.into(),
            reason: e.to_string(),
        }
    })?;

    serde_json::from_value(result).map_err(|e| crate::error::OrchflowError::ValidationError {
        field: "file_tree".to_string(),
        reason: e.to_string(),
    })
}

/// Create a new file
#[tauri::command]
pub async fn create_file(
    manager: State<'_, Manager>,
    path: String,
    content: Option<String>,
) -> Result<()> {
    let action = Action::CreateFile { path, content };

    manager.execute_action(action).await.map_err(|e| {
        crate::error::OrchflowError::FileOperationError {
            operation: "create_file".to_string(),
            path: "".into(),
            reason: e.to_string(),
        }
    })?;

    Ok(())
}

/// Create a new directory
#[tauri::command]
pub async fn create_directory(manager: State<'_, Manager>, path: String) -> Result<()> {
    let action = Action::CreateDirectory { path };

    manager.execute_action(action).await.map_err(|e| {
        crate::error::OrchflowError::FileOperationError {
            operation: "create_directory".to_string(),
            path: "".into(),
            reason: e.to_string(),
        }
    })?;

    Ok(())
}

/// Delete a file or directory
#[tauri::command]
pub async fn delete_path(manager: State<'_, Manager>, path: String, permanent: bool) -> Result<()> {
    let action = Action::DeletePath { path, permanent };

    manager.execute_action(action).await.map_err(|e| {
        crate::error::OrchflowError::FileOperationError {
            operation: "delete_path".to_string(),
            path: "".into(),
            reason: e.to_string(),
        }
    })?;

    Ok(())
}

/// Rename a file or directory
#[tauri::command]
pub async fn rename_path(
    manager: State<'_, Manager>,
    old_path: String,
    new_name: String,
) -> Result<RenameResult> {
    let action = Action::RenamePath {
        old_path: old_path.clone(),
        new_name,
    };

    let result = manager.execute_action(action).await.map_err(|e| {
        crate::error::OrchflowError::FileOperationError {
            operation: "rename_path".to_string(),
            path: old_path.into(),
            reason: e.to_string(),
        }
    })?;

    serde_json::from_value(result).map_err(|e| crate::error::OrchflowError::ValidationError {
        field: "rename_result".to_string(),
        reason: e.to_string(),
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RenameResult {
    pub old_path: String,
    pub new_path: String,
}

/// Move files to a new location
#[tauri::command]
pub async fn move_files(
    manager: State<'_, Manager>,
    files: Vec<String>,
    destination: String,
) -> Result<()> {
    let action = Action::MoveFiles { files, destination };

    manager.execute_action(action).await.map_err(|e| {
        crate::error::OrchflowError::FileOperationError {
            operation: "move_files".to_string(),
            path: "".into(),
            reason: e.to_string(),
        }
    })?;

    Ok(())
}

/// Copy files to a new location
#[tauri::command]
pub async fn copy_files(
    manager: State<'_, Manager>,
    files: Vec<String>,
    destination: String,
) -> Result<()> {
    let action = Action::CopyFiles { files, destination };

    manager.execute_action(action).await.map_err(|e| {
        crate::error::OrchflowError::FileOperationError {
            operation: "copy_files".to_string(),
            path: "".into(),
            reason: e.to_string(),
        }
    })?;

    Ok(())
}

/// Search for files matching a pattern
#[tauri::command]
pub async fn search_files(
    manager: State<'_, Manager>,
    pattern: String,
    path: Option<String>,
) -> Result<SearchResult> {
    let action = Action::SearchFiles {
        pattern: pattern.clone(),
        path,
    };

    let result = manager.execute_action(action).await.map_err(|e| {
        crate::error::OrchflowError::FileOperationError {
            operation: "search_files".to_string(),
            path: "".into(),
            reason: e.to_string(),
        }
    })?;

    serde_json::from_value(result).map_err(|e| crate::error::OrchflowError::ValidationError {
        field: "search_result".to_string(),
        reason: e.to_string(),
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub pattern: String,
    pub results: Vec<String>,
    pub count: usize,
}

/// Expand a directory in the file tree
#[tauri::command]
pub async fn expand_directory(manager: State<'_, Manager>, path: String) -> Result<Vec<FileNode>> {
    // Get file manager directly for this operation
    if let Some(file_manager) = &manager.file_manager {
        let children = file_manager
            .expand_directory(std::path::Path::new(&path))
            .await
            .map_err(|e| e)?;
        Ok(children)
    } else {
        Err(crate::error::OrchflowError::InternalError {
            context: "expand_directory".to_string(),
            reason: "File manager not initialized".to_string(),
        })
    }
}

/// Collapse a directory in the file tree
#[tauri::command]
pub async fn collapse_directory(manager: State<'_, Manager>, path: String) -> Result<()> {
    // Get file manager directly for this operation
    if let Some(file_manager) = &manager.file_manager {
        file_manager
            .collapse_directory(std::path::Path::new(&path))
            .await
            .map_err(|e| e)?;
        Ok(())
    } else {
        Err(crate::error::OrchflowError::InternalError {
            context: "collapse_directory".to_string(),
            reason: "File manager not initialized".to_string(),
        })
    }
}

/// Get file preview
#[tauri::command]
pub async fn get_file_preview(
    manager: State<'_, Manager>,
    path: String,
    max_lines: Option<usize>,
) -> Result<String> {
    // Get file manager directly for this operation
    if let Some(file_manager) = &manager.file_manager {
        let preview = file_manager
            .get_file_preview(std::path::Path::new(&path), max_lines.unwrap_or(50))
            .await
            .map_err(|e| e)?;
        Ok(preview)
    } else {
        Err(crate::error::OrchflowError::InternalError {
            context: "get_file_preview".to_string(),
            reason: "File manager not initialized".to_string(),
        })
    }
}

/// Get file operation history
#[tauri::command]
pub async fn get_file_operation_history(
    manager: State<'_, Manager>,
    limit: Option<usize>,
) -> Result<Vec<FileOperation>> {
    // Get file manager directly for this operation
    if let Some(file_manager) = &manager.file_manager {
        let history = file_manager
            .get_operation_history(limit.unwrap_or(50))
            .await;
        Ok(history)
    } else {
        Err(crate::error::OrchflowError::InternalError {
            context: "get_file_operation_history".to_string(),
            reason: "File manager not initialized".to_string(),
        })
    }
}

/// Undo last file operation
#[tauri::command]
pub async fn undo_file_operation(manager: State<'_, Manager>) -> Result<()> {
    // Get file manager directly for this operation
    if let Some(file_manager) = &manager.file_manager {
        file_manager.undo_last_operation().await.map_err(|e| e)?;
        Ok(())
    } else {
        Err(crate::error::OrchflowError::InternalError {
            context: "undo_file_operation".to_string(),
            reason: "File manager not initialized".to_string(),
        })
    }
}
