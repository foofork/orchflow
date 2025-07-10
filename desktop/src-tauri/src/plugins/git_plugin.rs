use async_trait::async_trait;
use serde_json::Value;
use crate::manager::{Plugin, PluginMetadata, PluginContext, Event, Action};
use crate::state_manager::PaneType;

/// Example plugin: Git integration
pub struct GitPlugin {
    context: Option<PluginContext>,
    watch_enabled: bool,
}

impl GitPlugin {
    pub fn new() -> Self {
        Self {
            context: None,
            watch_enabled: false,
        }
    }
    
    async fn check_git_status(&self, pane_id: &str) -> Result<(), String> {
        if let Some(ctx) = &self.context {
            // Run git status in the specified pane
            ctx.execute(Action::RunCommand {
                pane_id: pane_id.to_string(),
                command: "git status --short".to_string(),
            }).await?;
        }
        Ok(())
    }
    
    async fn commit_changes(&self, pane_id: &str, message: &str) -> Result<(), String> {
        if let Some(ctx) = &self.context {
            // Stage all changes
            ctx.execute(Action::RunCommand {
                pane_id: pane_id.to_string(),
                command: "git add -A".to_string(),
            }).await?;
            
            // Commit with message
            ctx.execute(Action::RunCommand {
                pane_id: pane_id.to_string(),
                command: format!("git commit -m \"{}\"", message),
            }).await?;
        }
        Ok(())
    }
}

#[async_trait]
impl Plugin for GitPlugin {
    fn id(&self) -> &str {
        "git-plugin"
    }
    
    fn metadata(&self) -> PluginMetadata {
        PluginMetadata {
            name: "Git Integration".to_string(),
            version: "0.1.0".to_string(),
            author: "Orchflow Team".to_string(),
            description: "Git version control integration".to_string(),
            capabilities: vec![
                "git-status".to_string(),
                "git-commit".to_string(),
                "git-diff".to_string(),
                "file-watch".to_string(),
            ],
        }
    }
    
    async fn init(&mut self, context: PluginContext) -> Result<(), String> {
        // Subscribe to file events
        context.subscribe(vec![
            "file_saved".to_string(),
            "file_changed".to_string(),
            "pane_created".to_string(),
        ]).await?;
        
        self.context = Some(context);
        Ok(())
    }
    
    async fn handle_event(&mut self, event: &Event) -> Result<(), String> {
        match event {
            Event::FileSaved { path } => {
                if self.watch_enabled {
                    println!("Git Plugin: File saved: {}", path);
                    // Could auto-stage changes or show diff
                }
            }
            
            Event::PaneCreated { pane } => {
                // Could automatically show git status in new terminal panes
                if matches!(pane.pane_type, PaneType::Terminal) {
                    self.check_git_status(&pane.id).await?;
                }
            }
            
            _ => {}
        }
        Ok(())
    }
    
    async fn handle_request(&mut self, method: &str, params: Value) -> Result<Value, String> {
        match method {
            "git.status" => {
                let pane_id = params["pane_id"].as_str()
                    .ok_or("Missing pane_id")?;
                self.check_git_status(pane_id).await?;
                Ok(serde_json::json!({ "status": "ok" }))
            }
            
            "git.commit" => {
                let pane_id = params["pane_id"].as_str()
                    .ok_or("Missing pane_id")?;
                let message = params["message"].as_str()
                    .ok_or("Missing message")?;
                self.commit_changes(pane_id, message).await?;
                Ok(serde_json::json!({ "status": "ok" }))
            }
            
            "git.enableWatch" => {
                self.watch_enabled = params["enabled"].as_bool()
                    .unwrap_or(true);
                Ok(serde_json::json!({ 
                    "status": "ok",
                    "watch_enabled": self.watch_enabled 
                }))
            }
            
            _ => Err(format!("Unknown method: {}", method))
        }
    }
    
    async fn shutdown(&mut self) -> Result<(), String> {
        println!("Git Plugin: Shutting down");
        Ok(())
    }
}