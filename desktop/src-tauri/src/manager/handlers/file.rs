// File management handlers

use serde_json::Value;
use crate::manager::{Manager, Event};
use std::path::Path;

pub async fn create_file(
    manager: &Manager,
    path: &str,
    content: Option<&str>,
) -> Result<Value, String> {
    let file_manager = manager.file_manager.as_ref()
        .ok_or_else(|| "File manager not initialized".to_string())?;
    
    use std::path::Path;
    file_manager.create_file(Path::new(path), content.unwrap_or("")).await
        .map_err(|e| e.to_string())?;
    
    Ok(serde_json::json!({
        "created": true,
        "path": path
    }))
}

pub async fn open_file(manager: &Manager, path: &str) -> Result<Value, String> {
    let file_manager = manager.file_manager.as_ref()
        .ok_or_else(|| "File manager not initialized".to_string())?;
    
    // Read the file content using tokio
    let content = tokio::fs::read_to_string(path).await
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    // Get active pane ID
    let sessions = manager.state_manager.list_sessions().await;
    let active_pane_id = sessions.iter()
        .find_map(|s| s.active_pane.clone())
        .ok_or_else(|| "No active pane found".to_string())?;
    
    // Emit file opened event
    manager.emit_event(Event::FileOpened {
        path: path.to_string(),
        pane_id: active_pane_id.clone(),
    });
    
    Ok(serde_json::json!({
        "opened": true,
        "path": path,
        "content": content,
        "pane_id": active_pane_id
    }))
}

pub async fn create_directory(manager: &Manager, path: &str) -> Result<Value, String> {
    let file_manager = manager.file_manager.as_ref()
        .ok_or_else(|| "File manager not initialized".to_string())?;
    
    use std::path::Path;
    file_manager.create_directory(Path::new(path)).await
        .map_err(|e| e.to_string())?;
    
    Ok(serde_json::json!({
        "created": true,
        "path": path
    }))
}

pub async fn delete_path(
    manager: &Manager,
    path: &str,
    permanent: bool,
) -> Result<Value, String> {
    let file_manager = manager.file_manager.as_ref()
        .ok_or_else(|| "File manager not initialized".to_string())?;
    
    use std::path::Path;
    if permanent {
        file_manager.delete_permanent(Path::new(path)).await
    } else {
        file_manager.delete_to_trash(Path::new(path)).await
    }
    .map_err(|e| e.to_string())?;
    
    Ok(serde_json::json!({
        "deleted": true,
        "path": path,
        "permanent": permanent
    }))
}

pub async fn rename_path(
    manager: &Manager,
    old_path: &str,
    new_name: &str,
) -> Result<Value, String> {
    let file_manager = manager.file_manager.as_ref()
        .ok_or_else(|| "File manager not initialized".to_string())?;
    
    // Build new path
    let old_path_obj = Path::new(old_path);
    let parent = old_path_obj.parent()
        .ok_or_else(|| "Invalid path".to_string())?;
    let new_path = parent.join(new_name);
    let new_path_str = new_path.to_str()
        .ok_or_else(|| "Invalid path encoding".to_string())?;
    
    file_manager.rename(old_path_obj, new_name).await
        .map_err(|e| e.to_string())?;
    
    Ok(serde_json::json!({
        "renamed": true,
        "old_path": old_path,
        "new_path": new_path_str
    }))
}

pub async fn copy_path(
    manager: &Manager,
    source: &str,
    destination: &str,
) -> Result<Value, String> {
    let file_manager = manager.file_manager.as_ref()
        .ok_or_else(|| "File manager not initialized".to_string())?;
    
    use std::path::PathBuf;
    file_manager.copy_files(vec![PathBuf::from(source)], Path::new(destination)).await
        .map_err(|e| e.to_string())?;
    
    Ok(serde_json::json!({
        "copied": true,
        "source": source,
        "destination": destination
    }))
}

pub async fn move_path(
    manager: &Manager,
    source: &str,
    destination: &str,
) -> Result<Value, String> {
    let file_manager = manager.file_manager.as_ref()
        .ok_or_else(|| "File manager not initialized".to_string())?;
    
    use std::path::PathBuf;
    file_manager.move_files(vec![PathBuf::from(source)], Path::new(destination)).await
        .map_err(|e| e.to_string())?;
    
    Ok(serde_json::json!({
        "moved": true,
        "source": source,
        "destination": destination
    }))
}