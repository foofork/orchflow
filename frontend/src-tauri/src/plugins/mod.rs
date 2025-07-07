pub mod git_plugin;
pub mod file_browser;
pub mod test_runner;
pub mod terminal_plugin;
pub mod session_plugin;
pub mod lsp_plugin;
pub mod syntax_plugin;
pub mod search_plugin;
pub mod language_config;

use crate::orchestrator::{Plugin, PluginMetadata};
use std::collections::HashMap;
use std::sync::Arc;

/// Plugin registry for managing available plugins
/// Safe to use across threads
pub struct PluginRegistry {
    available: HashMap<String, Arc<dyn Fn() -> Box<dyn Plugin> + Send + Sync>>,
}

// Safe because all closures are Send + Sync
unsafe impl Send for PluginRegistry {}
unsafe impl Sync for PluginRegistry {}

impl PluginRegistry {
    pub fn new() -> Self {
        let mut registry = Self {
            available: HashMap::new(),
        };
        
        // Register built-in plugins
        registry.register("git", || Box::new(git_plugin::GitPlugin::new()));
        registry.register("file-browser", || Box::new(file_browser::FileBrowserPlugin::new()));
        registry.register("test-runner", || Box::new(test_runner::TestRunnerPlugin::new()));
        registry.register("terminal", || Box::new(terminal_plugin::TerminalPlugin::new()));
        registry.register("session", || Box::new(session_plugin::SessionPlugin::new()));
        
        // IDE plugins
        registry.register("lsp", || Box::new(lsp_plugin::LspPlugin::new()));
        registry.register("syntax", || Box::new(syntax_plugin::SyntaxPlugin::new()));
        registry.register("search", || Box::new(search_plugin::SearchPlugin::new()));
        
        registry
    }
    
    /// Register a plugin factory
    pub fn register<F>(&mut self, id: &str, factory: F) 
    where
        F: Fn() -> Box<dyn Plugin> + Send + Sync + 'static
    {
        self.available.insert(id.to_string(), Arc::new(factory));
    }
    
    /// Create a plugin instance by ID
    pub fn create(&self, id: &str) -> Option<Box<dyn Plugin>> {
        self.available.get(id).map(|factory| factory())
    }
    
    /// List all available plugins
    pub fn list(&self) -> Vec<(String, PluginMetadata)> {
        self.available.iter().map(|(id, factory)| {
            let plugin = factory();
            (id.clone(), plugin.metadata())
        }).collect()
    }
}

impl Default for PluginRegistry {
    fn default() -> Self {
        Self::new()
    }
}