use async_trait::async_trait;
use serde_json::{json, Value};
use std::collections::HashMap;
use crate::orchestrator::{Plugin, PluginMetadata, PluginContext, Event, Action, PaneType};

#[derive(Debug, Clone)]
struct TerminalHistory {
    pane_id: String,
    commands: Vec<String>,
    outputs: Vec<String>,
    max_history: usize,
}

impl TerminalHistory {
    fn new(pane_id: String) -> Self {
        Self {
            pane_id,
            commands: Vec::new(),
            outputs: Vec::new(),
            max_history: 1000,
        }
    }
    
    fn add_command(&mut self, command: String) {
        self.commands.push(command);
        if self.commands.len() > self.max_history {
            self.commands.remove(0);
        }
    }
    
    fn add_output(&mut self, output: String) {
        self.outputs.push(output);
        if self.outputs.len() > self.max_history {
            self.outputs.remove(0);
        }
    }
}

/// Enhanced Terminal Plugin - Provides advanced terminal features
pub struct TerminalPlugin {
    context: Option<PluginContext>,
    terminals: HashMap<String, TerminalHistory>,
    command_aliases: HashMap<String, String>,
    auto_suggestions: Vec<String>,
    capture_output: bool,
}

impl TerminalPlugin {
    pub fn new() -> Self {
        let mut aliases = HashMap::new();
        // Add common aliases
        aliases.insert("ll".to_string(), "ls -la".to_string());
        aliases.insert("la".to_string(), "ls -a".to_string());
        aliases.insert("..".to_string(), "cd ..".to_string());
        aliases.insert("...".to_string(), "cd ../..".to_string());
        
        Self {
            context: None,
            terminals: HashMap::new(),
            command_aliases: aliases,
            auto_suggestions: vec![
                "git status".to_string(),
                "git add .".to_string(),
                "git commit -m".to_string(),
                "npm install".to_string(),
                "npm run dev".to_string(),
                "cargo build".to_string(),
                "cargo test".to_string(),
            ],
            capture_output: true,
        }
    }
    
    /// Get command suggestions based on input
    fn get_suggestions(&self, input: &str) -> Vec<String> {
        let mut suggestions = Vec::new();
        
        // Check aliases
        for (alias, command) in &self.command_aliases {
            if alias.starts_with(input) {
                suggestions.push(command.clone());
            }
        }
        
        // Check auto-suggestions
        for suggestion in &self.auto_suggestions {
            if suggestion.starts_with(input) && !suggestions.contains(suggestion) {
                suggestions.push(suggestion.clone());
            }
        }
        
        // Check command history
        for history in self.terminals.values() {
            for cmd in &history.commands {
                if cmd.starts_with(input) && !suggestions.contains(cmd) {
                    suggestions.push(cmd.clone());
                }
            }
        }
        
        suggestions.sort();
        suggestions.dedup();
        suggestions.truncate(10); // Limit to 10 suggestions
        
        suggestions
    }
    
    /// Search through terminal output
    fn search_output(&self, pane_id: &str, query: &str) -> Vec<(usize, String)> {
        let mut results = Vec::new();
        
        if let Some(history) = self.terminals.get(pane_id) {
            for (idx, output) in history.outputs.iter().enumerate() {
                if output.contains(query) {
                    results.push((idx, output.clone()));
                }
            }
        }
        
        results
    }
    
    /// Get command at specific history index
    fn get_history_command(&self, pane_id: &str, index: i32) -> Option<String> {
        if let Some(history) = self.terminals.get(pane_id) {
            if index < 0 {
                // Negative index counts from the end
                let idx = (history.commands.len() as i32 + index) as usize;
                history.commands.get(idx).cloned()
            } else {
                history.commands.get(index as usize).cloned()
            }
        } else {
            None
        }
    }
}

#[async_trait]
impl Plugin for TerminalPlugin {
    fn id(&self) -> &str {
        "terminal-enhanced"
    }
    
    fn metadata(&self) -> PluginMetadata {
        PluginMetadata {
            name: "Enhanced Terminal".to_string(),
            version: "0.1.0".to_string(),
            author: "Orchflow Team".to_string(),
            description: "Advanced terminal features including history, suggestions, and search".to_string(),
            capabilities: vec![
                "terminal.history".to_string(),
                "terminal.suggestions".to_string(),
                "terminal.search".to_string(),
                "terminal.alias".to_string(),
                "terminal.capture".to_string(),
                "terminal.split".to_string(),
            ],
        }
    }
    
    async fn init(&mut self, context: PluginContext) -> Result<(), String> {
        // Subscribe to terminal events
        context.subscribe(vec![
            "pane_created".to_string(),
            "pane_output".to_string(),
            "command_executed".to_string(),
            "pane_closed".to_string(),
        ]).await?;
        
        self.context = Some(context);
        Ok(())
    }
    
    async fn handle_event(&mut self, event: &Event) -> Result<(), String> {
        match event {
            Event::PaneCreated { pane } => {
                if matches!(pane.pane_type, PaneType::Terminal) {
                    // Initialize history for new terminal
                    self.terminals.insert(
                        pane.id.clone(),
                        TerminalHistory::new(pane.id.clone())
                    );
                }
            }
            
            Event::CommandExecuted { pane_id, command } => {
                // Check for aliases
                let actual_command = self.command_aliases.get(command)
                    .cloned()
                    .unwrap_or_else(|| command.clone());
                
                // Store in history
                if let Some(history) = self.terminals.get_mut(pane_id) {
                    history.add_command(actual_command.clone());
                }
                
                // If command was aliased, execute the actual command
                if actual_command != *command {
                    if let Some(ctx) = &self.context {
                        ctx.execute(Action::RunCommand {
                            pane_id: pane_id.clone(),
                            command: actual_command,
                        }).await?;
                    }
                }
            }
            
            Event::PaneOutput { pane_id, data } => {
                if self.capture_output {
                    if let Some(history) = self.terminals.get_mut(pane_id) {
                        history.add_output(data.clone());
                    }
                }
            }
            
            Event::PaneClosed { pane_id } => {
                // Clean up terminal history
                self.terminals.remove(pane_id);
            }
            
            _ => {}
        }
        Ok(())
    }
    
    async fn handle_request(&mut self, method: &str, params: Value) -> Result<Value, String> {
        match method {
            "terminal.createSplit" => {
                let session_id = params["session_id"].as_str()
                    .unwrap_or("default");
                let direction = params["direction"].as_str()
                    .unwrap_or("horizontal");
                let command = params["command"].as_str()
                    .map(|s| s.to_string());
                
                if let Some(ctx) = &self.context {
                    let result = ctx.execute(Action::CreatePane {
                        session_id: session_id.to_string(),
                        pane_type: PaneType::Terminal,
                        command,
                        shell_type: None,
                        name: None,
                    }).await?;
                    
                    Ok(result)
                } else {
                    Err("Plugin not initialized".to_string())
                }
            }
            
            "terminal.history" => {
                let pane_id = params["pane_id"].as_str()
                    .ok_or("Missing pane_id")?;
                let limit = params["limit"].as_u64()
                    .unwrap_or(50) as usize;
                
                if let Some(history) = self.terminals.get(pane_id) {
                    let commands: Vec<_> = history.commands.iter()
                        .rev()
                        .take(limit)
                        .cloned()
                        .collect();
                    
                    Ok(json!({
                        "pane_id": pane_id,
                        "commands": commands,
                        "total": history.commands.len()
                    }))
                } else {
                    Ok(json!({
                        "pane_id": pane_id,
                        "commands": [],
                        "total": 0
                    }))
                }
            }
            
            "terminal.historyCommand" => {
                let pane_id = params["pane_id"].as_str()
                    .ok_or("Missing pane_id")?;
                let index = params["index"].as_i64()
                    .unwrap_or(-1) as i32;
                
                let command = self.get_history_command(pane_id, index);
                Ok(json!({ "command": command }))
            }
            
            "terminal.suggestions" => {
                let input = params["input"].as_str()
                    .unwrap_or("");
                let suggestions = self.get_suggestions(input);
                
                Ok(json!({
                    "input": input,
                    "suggestions": suggestions
                }))
            }
            
            "terminal.search" => {
                let pane_id = params["pane_id"].as_str()
                    .ok_or("Missing pane_id")?;
                let query = params["query"].as_str()
                    .ok_or("Missing query")?;
                
                let results = self.search_output(pane_id, query);
                let matches: Vec<_> = results.into_iter()
                    .map(|(idx, line)| json!({
                        "index": idx,
                        "line": line
                    }))
                    .collect();
                
                Ok(json!({
                    "pane_id": pane_id,
                    "query": query,
                    "matches": matches,
                    "count": matches.len()
                }))
            }
            
            "terminal.addAlias" => {
                let alias = params["alias"].as_str()
                    .ok_or("Missing alias")?;
                let command = params["command"].as_str()
                    .ok_or("Missing command")?;
                
                self.command_aliases.insert(
                    alias.to_string(),
                    command.to_string()
                );
                
                Ok(json!({
                    "status": "ok",
                    "alias": alias,
                    "command": command
                }))
            }
            
            "terminal.listAliases" => {
                let aliases: Vec<_> = self.command_aliases.iter()
                    .map(|(k, v)| json!({
                        "alias": k,
                        "command": v
                    }))
                    .collect();
                
                Ok(json!({ "aliases": aliases }))
            }
            
            "terminal.clearHistory" => {
                let pane_id = params["pane_id"].as_str();
                
                if let Some(pane_id) = pane_id {
                    if let Some(history) = self.terminals.get_mut(pane_id) {
                        history.commands.clear();
                        history.outputs.clear();
                    }
                } else {
                    // Clear all history
                    for history in self.terminals.values_mut() {
                        history.commands.clear();
                        history.outputs.clear();
                    }
                }
                
                Ok(json!({ "status": "ok" }))
            }
            
            "terminal.setCaptureOutput" => {
                self.capture_output = params["enabled"].as_bool()
                    .unwrap_or(true);
                    
                Ok(json!({ 
                    "status": "ok",
                    "capture_output": self.capture_output
                }))
            }
            
            _ => Err(format!("Unknown method: {}", method))
        }
    }
    
    async fn shutdown(&mut self) -> Result<(), String> {
        self.terminals.clear();
        Ok(())
    }
}