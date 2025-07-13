use crate::manager::{Action, Event, Plugin, PluginContext, PluginMetadata};
use crate::state_manager::PaneType;
use async_trait::async_trait;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use tokio::fs;

/// File Browser Plugin - Provides file system navigation and operations
pub struct FileBrowserPlugin {
    context: Option<PluginContext>,
    current_dir: PathBuf,
    file_watchers: Vec<String>, // Paths being watched
}

impl FileBrowserPlugin {
    pub fn new() -> Self {
        Self {
            context: None,
            current_dir: std::env::current_dir().unwrap_or_else(|_| PathBuf::from("/")),
            file_watchers: Vec::new(),
        }
    }

    async fn list_directory(&self, path: &Path) -> Result<Value, String> {
        let mut entries = Vec::new();
        let mut read_dir = fs::read_dir(path)
            .await
            .map_err(|e| format!("Failed to read directory: {}", e))?;

        while let Some(entry) = read_dir
            .next_entry()
            .await
            .map_err(|e| format!("Failed to read entry: {}", e))?
        {
            let metadata = entry
                .metadata()
                .await
                .map_err(|e| format!("Failed to read metadata: {}", e))?;

            let file_type = if metadata.is_dir() {
                "directory"
            } else if metadata.is_symlink() {
                "symlink"
            } else {
                "file"
            };

            entries.push(json!({
                "name": entry.file_name().to_string_lossy(),
                "path": entry.path().to_string_lossy(),
                "type": file_type,
                "size": metadata.len(),
                "modified": metadata.modified()
                    .map(|t| t.duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_secs())
                        .unwrap_or(0))
                    .unwrap_or(0),
            }));
        }

        // Sort directories first, then files
        entries.sort_by(|a, b| {
            let a_type = a["type"].as_str().unwrap_or("");
            let b_type = b["type"].as_str().unwrap_or("");
            if a_type == "directory" && b_type != "directory" {
                std::cmp::Ordering::Less
            } else if a_type != "directory" && b_type == "directory" {
                std::cmp::Ordering::Greater
            } else {
                a["name"]
                    .as_str()
                    .unwrap_or("")
                    .cmp(b["name"].as_str().unwrap_or(""))
            }
        });

        Ok(json!({
            "path": path.to_string_lossy(),
            "entries": entries,
            "total": entries.len(),
        }))
    }

    async fn read_file(&self, path: &Path) -> Result<String, String> {
        fs::read_to_string(path)
            .await
            .map_err(|e| format!("Failed to read file: {}", e))
    }

    async fn write_file(&self, path: &Path, content: &str) -> Result<(), String> {
        fs::write(path, content)
            .await
            .map_err(|e| format!("Failed to write file: {}", e))
    }

    async fn create_directory(&self, path: &Path) -> Result<(), String> {
        fs::create_dir_all(path)
            .await
            .map_err(|e| format!("Failed to create directory: {}", e))
    }

    async fn delete_path(&self, path: &Path) -> Result<(), String> {
        if path.is_dir() {
            fs::remove_dir_all(path)
                .await
                .map_err(|e| format!("Failed to remove directory: {}", e))
        } else {
            fs::remove_file(path)
                .await
                .map_err(|e| format!("Failed to remove file: {}", e))
        }
    }

    async fn move_path(&self, from: &Path, to: &Path) -> Result<(), String> {
        fs::rename(from, to)
            .await
            .map_err(|e| format!("Failed to move path: {}", e))
    }
}

#[async_trait]
impl Plugin for FileBrowserPlugin {
    fn id(&self) -> &str {
        "file-browser"
    }

    fn metadata(&self) -> PluginMetadata {
        PluginMetadata {
            name: "File Browser".to_string(),
            version: "0.1.0".to_string(),
            author: "Orchflow Team".to_string(),
            description: "File system navigation and operations".to_string(),
            capabilities: vec![
                "file.list".to_string(),
                "file.read".to_string(),
                "file.write".to_string(),
                "file.create".to_string(),
                "file.delete".to_string(),
                "file.move".to_string(),
                "file.watch".to_string(),
            ],
        }
    }

    async fn init(&mut self, context: PluginContext) -> Result<(), String> {
        // Subscribe to file-related events
        context
            .subscribe(vec![
                "file_opened".to_string(),
                "file_saved".to_string(),
                "pane_created".to_string(),
            ])
            .await?;

        self.context = Some(context);
        Ok(())
    }

    async fn handle_event(&mut self, event: &Event) -> Result<(), String> {
        match event {
            Event::PaneCreated { pane } => {
                // If it's a file tree pane, populate it
                if matches!(pane.pane_type, PaneType::FileTree) {
                    if let Some(ctx) = &self.context {
                        // Show current directory in the file tree
                        let listing = self.list_directory(&self.current_dir).await?;

                        // Send the listing to the pane (this would be implemented in the frontend)
                        ctx.execute(Action::RunCommand {
                            pane_id: pane.id.clone(),
                            command: format!("file-tree:update {}", listing),
                        })
                        .await?;
                    }
                }
            }

            Event::FileOpened { path, .. } => {
                // Update current directory to the file's parent
                if let Some(parent) = Path::new(path).parent() {
                    self.current_dir = parent.to_path_buf();
                }
            }

            _ => {}
        }
        Ok(())
    }

    async fn handle_request(&mut self, method: &str, params: Value) -> Result<Value, String> {
        match method {
            "file.list" => {
                let path = params["path"]
                    .as_str()
                    .map(Path::new)
                    .unwrap_or(&self.current_dir);
                self.list_directory(path).await
            }

            "file.read" => {
                let path = params["path"].as_str().ok_or("Missing path parameter")?;
                let content = self.read_file(Path::new(path)).await?;
                Ok(json!({ "content": content }))
            }

            "file.write" => {
                let path = params["path"].as_str().ok_or("Missing path parameter")?;
                let content = params["content"]
                    .as_str()
                    .ok_or("Missing content parameter")?;
                self.write_file(Path::new(path), content).await?;
                Ok(json!({ "status": "ok" }))
            }

            "file.create" => {
                let path = params["path"].as_str().ok_or("Missing path parameter")?;
                let is_directory = params["is_directory"].as_bool().unwrap_or(false);

                if is_directory {
                    self.create_directory(Path::new(path)).await?;
                } else {
                    self.write_file(Path::new(path), "").await?;
                }
                Ok(json!({ "status": "ok" }))
            }

            "file.delete" => {
                let path = params["path"].as_str().ok_or("Missing path parameter")?;
                self.delete_path(Path::new(path)).await?;
                Ok(json!({ "status": "ok" }))
            }

            "file.move" => {
                let from = params["from"].as_str().ok_or("Missing from parameter")?;
                let to = params["to"].as_str().ok_or("Missing to parameter")?;
                self.move_path(Path::new(from), Path::new(to)).await?;
                Ok(json!({ "status": "ok" }))
            }

            "file.watch" => {
                let path = params["path"].as_str().ok_or("Missing path parameter")?;
                self.file_watchers.push(path.to_string());
                // In a real implementation, we'd set up actual file watching
                Ok(json!({
                    "status": "ok",
                    "watching": self.file_watchers.len()
                }))
            }

            "file.currentDir" => Ok(json!({ "path": self.current_dir.to_string_lossy() })),

            "file.changeDir" => {
                let path = params["path"].as_str().ok_or("Missing path parameter")?;
                self.current_dir = PathBuf::from(path);
                Ok(json!({ "path": self.current_dir.to_string_lossy() }))
            }

            _ => Err(format!("Unknown method: {}", method)),
        }
    }

    async fn shutdown(&mut self) -> Result<(), String> {
        // Clean up file watchers
        self.file_watchers.clear();
        Ok(())
    }
}
