use tauri::State;
use serde::{Deserialize, Serialize};
use crate::orchestrator::{Orchestrator, Action};
use crate::error::Result;
use crate::file_manager::{FileNode, FileOperation};

/// Get the file tree for a directory
#[tauri::command]
pub async fn get_file_tree(
    orchestrator: State<'_, Orchestrator>,
    path: Option<String>,
    max_depth: Option<usize>,
) -> Result<FileNode> {
    let error_path = path.clone().unwrap_or_else(|| ".".to_string());
    let action = Action::GetFileTree { path, max_depth };
    
    let result = orchestrator.execute_action(action).await
        .map_err(|e| crate::error::OrchflowError::FileError {
            operation: "get_file_tree".to_string(),
            path: error_path,
            reason: e,
        })?;
    
    serde_json::from_value(result)
        .map_err(|e| crate::error::OrchflowError::ValidationError {
            field: "file_tree".to_string(),
            reason: e.to_string(),
        })
}

/// Create a new file
#[tauri::command]
pub async fn create_file(
    orchestrator: State<'_, Orchestrator>,
    path: String,
    content: Option<String>,
) -> Result<()> {
    let action = Action::CreateFile { path, content };
    
    orchestrator.execute_action(action).await
        .map_err(|e| crate::error::OrchflowError::FileError {
            operation: "create_file".to_string(),
            path: "".to_string(),
            reason: e,
        })?;
    
    Ok(())
}

/// Create a new directory
#[tauri::command]
pub async fn create_directory(
    orchestrator: State<'_, Orchestrator>,
    path: String,
) -> Result<()> {
    let action = Action::CreateDirectory { path };
    
    orchestrator.execute_action(action).await
        .map_err(|e| crate::error::OrchflowError::FileError {
            operation: "create_directory".to_string(),
            path: "".to_string(),
            reason: e,
        })?;
    
    Ok(())
}

/// Delete a file or directory
#[tauri::command]
pub async fn delete_path(
    orchestrator: State<'_, Orchestrator>,
    path: String,
    permanent: bool,
) -> Result<()> {
    let action = Action::DeletePath { path, permanent };
    
    orchestrator.execute_action(action).await
        .map_err(|e| crate::error::OrchflowError::FileError {
            operation: "delete_path".to_string(),
            path: "".to_string(),
            reason: e,
        })?;
    
    Ok(())
}

/// Rename a file or directory
#[tauri::command]
pub async fn rename_path(
    orchestrator: State<'_, Orchestrator>,
    old_path: String,
    new_name: String,
) -> Result<RenameResult> {
    let action = Action::RenamePath { old_path: old_path.clone(), new_name };
    
    let result = orchestrator.execute_action(action).await
        .map_err(|e| crate::error::OrchflowError::FileError {
            operation: "rename_path".to_string(),
            path: old_path,
            reason: e,
        })?;
    
    serde_json::from_value(result)
        .map_err(|e| crate::error::OrchflowError::ValidationError {
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
    orchestrator: State<'_, Orchestrator>,
    files: Vec<String>,
    destination: String,
) -> Result<()> {
    let action = Action::MoveFiles { files, destination };
    
    orchestrator.execute_action(action).await
        .map_err(|e| crate::error::OrchflowError::FileError {
            operation: "move_files".to_string(),
            path: "".to_string(),
            reason: e,
        })?;
    
    Ok(())
}

/// Copy files to a new location
#[tauri::command]
pub async fn copy_files(
    orchestrator: State<'_, Orchestrator>,
    files: Vec<String>,
    destination: String,
) -> Result<()> {
    let action = Action::CopyFiles { files, destination };
    
    orchestrator.execute_action(action).await
        .map_err(|e| crate::error::OrchflowError::FileError {
            operation: "copy_files".to_string(),
            path: "".to_string(),
            reason: e,
        })?;
    
    Ok(())
}

/// Search for files matching a pattern
#[tauri::command]
pub async fn search_files(
    orchestrator: State<'_, Orchestrator>,
    pattern: String,
    path: Option<String>,
) -> Result<SearchResult> {
    let action = Action::SearchFiles { pattern: pattern.clone(), path };
    
    let result = orchestrator.execute_action(action).await
        .map_err(|e| crate::error::OrchflowError::FileError {
            operation: "search_files".to_string(),
            path: "".to_string(),
            reason: e,
        })?;
    
    serde_json::from_value(result)
        .map_err(|e| crate::error::OrchflowError::ValidationError {
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
pub async fn expand_directory(
    orchestrator: State<'_, Orchestrator>,
    path: String,
) -> Result<Vec<FileNode>> {
    // Get file manager directly for this operation
    if let Some(file_manager) = &orchestrator.file_manager {
        let children = file_manager.expand_directory(std::path::Path::new(&path)).await
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
pub async fn collapse_directory(
    orchestrator: State<'_, Orchestrator>,
    path: String,
) -> Result<()> {
    // Get file manager directly for this operation
    if let Some(file_manager) = &orchestrator.file_manager {
        file_manager.collapse_directory(std::path::Path::new(&path)).await
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
    orchestrator: State<'_, Orchestrator>,
    path: String,
    max_lines: Option<usize>,
) -> Result<String> {
    // Get file manager directly for this operation
    if let Some(file_manager) = &orchestrator.file_manager {
        let preview = file_manager.get_file_preview(
            std::path::Path::new(&path),
            max_lines.unwrap_or(50)
        ).await
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
    orchestrator: State<'_, Orchestrator>,
    limit: Option<usize>,
) -> Result<Vec<FileOperation>> {
    // Get file manager directly for this operation
    if let Some(file_manager) = &orchestrator.file_manager {
        let history = file_manager.get_operation_history(limit.unwrap_or(50)).await;
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
pub async fn undo_file_operation(
    orchestrator: State<'_, Orchestrator>,
) -> Result<()> {
    // Get file manager directly for this operation
    if let Some(file_manager) = &orchestrator.file_manager {
        file_manager.undo_last_operation().await
            .map_err(|e| e)?;
        Ok(())
    } else {
        Err(crate::error::OrchflowError::InternalError {
            context: "undo_file_operation".to_string(),
            reason: "File manager not initialized".to_string(),
        })
    }
}