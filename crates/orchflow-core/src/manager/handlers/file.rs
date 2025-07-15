use crate::error::Result;
use crate::manager::Manager;
use serde_json::Value;

pub async fn create_file(manager: &Manager, path: &str, content: Option<&str>) -> Result<Value> {
    if let Some(file_manager) = &manager.file_manager {
        file_manager.create_file(path, content).await?;

        // Emit event
        manager.emit_event(crate::manager::Event::FileSaved {
            path: path.to_string(),
        });

        Ok(serde_json::json!({
            "status": "ok",
            "path": path
        }))
    } else {
        Err(crate::error::OrchflowError::General(
            "File manager not available".to_string(),
        ))
    }
}

pub async fn open_file(manager: &Manager, path: &str) -> Result<Value> {
    if let Some(file_manager) = &manager.file_manager {
        let content = file_manager.read_file(path).await?;

        // Emit event
        manager.emit_event(crate::manager::Event::FileRead {
            path: path.to_string(),
            size: content.len(),
        });

        Ok(serde_json::json!({
            "status": "ok",
            "path": path,
            "content": content
        }))
    } else {
        Err(crate::error::OrchflowError::General(
            "File manager not available".to_string(),
        ))
    }
}

pub async fn create_directory(manager: &Manager, path: &str) -> Result<Value> {
    if let Some(file_manager) = &manager.file_manager {
        file_manager.create_directory(path).await?;

        Ok(serde_json::json!({
            "status": "ok",
            "path": path
        }))
    } else {
        Err(crate::error::OrchflowError::General(
            "File manager not available".to_string(),
        ))
    }
}

pub async fn delete_path(manager: &Manager, path: &str, _permanent: bool) -> Result<Value> {
    if let Some(file_manager) = &manager.file_manager {
        file_manager.delete_file(path).await?;

        Ok(serde_json::json!({
            "status": "ok",
            "path": path
        }))
    } else {
        Err(crate::error::OrchflowError::General(
            "File manager not available".to_string(),
        ))
    }
}

pub async fn rename_path(manager: &Manager, old_path: &str, new_name: &str) -> Result<Value> {
    if let Some(file_manager) = &manager.file_manager {
        // Construct new path from old path and new name
        let path = std::path::Path::new(old_path);
        let new_path = if let Some(parent) = path.parent() {
            parent.join(new_name).to_string_lossy().to_string()
        } else {
            new_name.to_string()
        };

        file_manager.rename_file(old_path, &new_path).await?;

        Ok(serde_json::json!({
            "status": "ok",
            "old_path": old_path,
            "new_path": new_path
        }))
    } else {
        Err(crate::error::OrchflowError::General(
            "File manager not available".to_string(),
        ))
    }
}

pub async fn copy_path(manager: &Manager, source: &str, destination: &str) -> Result<Value> {
    if let Some(file_manager) = &manager.file_manager {
        file_manager.copy_file(source, destination).await?;

        Ok(serde_json::json!({
            "status": "ok",
            "source": source,
            "destination": destination
        }))
    } else {
        Err(crate::error::OrchflowError::General(
            "File manager not available".to_string(),
        ))
    }
}

pub async fn move_path(manager: &Manager, source: &str, destination: &str) -> Result<Value> {
    if let Some(file_manager) = &manager.file_manager {
        file_manager.move_file(source, destination).await?;

        Ok(serde_json::json!({
            "status": "ok",
            "source": source,
            "destination": destination
        }))
    } else {
        Err(crate::error::OrchflowError::General(
            "File manager not available".to_string(),
        ))
    }
}

pub async fn move_files(manager: &Manager, files: &[String], destination: &str) -> Result<Value> {
    if let Some(file_manager) = &manager.file_manager {
        let mut results = Vec::new();
        for file in files {
            match file_manager.move_file(file, destination).await {
                Ok(_) => results.push(serde_json::json!({ "file": file, "status": "moved" })),
                Err(e) => results.push(
                    serde_json::json!({ "file": file, "status": "error", "error": e.to_string() }),
                ),
            }
        }
        Ok(serde_json::json!({ "results": results }))
    } else {
        Err(crate::error::OrchflowError::General(
            "File manager not available".to_string(),
        ))
    }
}

pub async fn copy_files(manager: &Manager, files: &[String], destination: &str) -> Result<Value> {
    if let Some(file_manager) = &manager.file_manager {
        let mut results = Vec::new();
        for file in files {
            match file_manager.copy_file(file, destination).await {
                Ok(_) => results.push(serde_json::json!({ "file": file, "status": "copied" })),
                Err(e) => results.push(
                    serde_json::json!({ "file": file, "status": "error", "error": e.to_string() }),
                ),
            }
        }
        Ok(serde_json::json!({ "results": results }))
    } else {
        Err(crate::error::OrchflowError::General(
            "File manager not available".to_string(),
        ))
    }
}

pub async fn get_file_tree(
    _manager: &Manager,
    path: Option<&str>,
    max_depth: Option<u32>,
) -> Result<Value> {
    // This would need a more sophisticated implementation
    let base_path = path.unwrap_or(".");
    Ok(serde_json::json!({
        "status": "ok",
        "path": base_path,
        "max_depth": max_depth,
        "message": "File tree functionality not fully implemented"
    }))
}

pub async fn search_files(_manager: &Manager, pattern: &str, path: Option<&str>) -> Result<Value> {
    // This would need a more sophisticated implementation
    let search_path = path.unwrap_or(".");
    Ok(serde_json::json!({
        "status": "ok",
        "pattern": pattern,
        "path": search_path,
        "message": "File search functionality not fully implemented"
    }))
}
