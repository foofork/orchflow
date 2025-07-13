use super::*;
use crate::plugin_system::{PluginMetadata, PluginState};
use chrono::Utc;
use std::path::PathBuf;
use tempfile::TempDir;

/// Test plugin implementation for testing
pub struct TestPlugin {
    metadata: PluginMetadata,
    loaded: bool,
    activated: bool,
}

impl TestPlugin {
    pub fn new(id: &str, activation_events: Vec<String>) -> Self {
        Self {
            metadata: PluginMetadata {
                id: id.to_string(),
                name: format!("Test Plugin {}", id),
                version: "1.0.0".to_string(),
                description: "Test plugin for unit tests".to_string(),
                author: "Test Author".to_string(),
                path: PathBuf::from("/tmp/test"),
                installed_at: Utc::now(),
                updated_at: Utc::now(),
                state: PluginState::Installed,
                error: None,
                activation_events,
            },
            loaded: false,
            activated: false,
        }
    }
}

#[async_trait::async_trait]
impl Plugin for TestPlugin {
    fn metadata(&self) -> &PluginMetadata {
        &self.metadata
    }

    async fn load(&mut self) -> Result<()> {
        self.loaded = true;
        Ok(())
    }

    async fn activate(&mut self) -> Result<()> {
        self.activated = true;
        Ok(())
    }

    async fn deactivate(&mut self) -> Result<()> {
        self.activated = false;
        Ok(())
    }

    async fn unload(&mut self) -> Result<()> {
        self.loaded = false;
        self.activated = false;
        Ok(())
    }

    async fn handle_command(&self, _command: &str, _args: serde_json::Value) -> Result<serde_json::Value> {
        Ok(serde_json::json!({"status": "ok"}))
    }

    fn capabilities(&self) -> crate::plugin_system::PluginCapabilities {
        Default::default()
    }
}

/// Create a test manifest file
async fn create_test_manifest(dir: &std::path::Path, plugin_id: &str, activation_events: Vec<String>) -> Result<()> {
    let manifest = serde_json::json!({
        "id": plugin_id,
        "name": format!("Test Plugin {}", plugin_id),
        "version": "1.0.0",
        "description": "Test plugin",
        "author": {
            "name": "Test Author"
        },
        "license": "MIT",
        "engines": {
            "orchflow": ">=1.0.0"
        },
        "main": "main.js",
        "activationEvents": activation_events,
        "contributes": {},
        "permissions": []
    });

    let plugin_dir = dir.join(plugin_id);
    tokio::fs::create_dir_all(&plugin_dir).await?;
    
    let manifest_path = plugin_dir.join("plugin.json");
    tokio::fs::write(&manifest_path, manifest.to_string()).await?;
    
    // Create a dummy main.js file
    let main_path = plugin_dir.join("main.js");
    tokio::fs::write(&main_path, "console.log('Hello from test plugin');").await?;
    
    Ok(())
}

#[tokio::test]
async fn test_plugin_auto_activation_startup() {
    let temp_dir = TempDir::new().unwrap();
    let plugin_dir = temp_dir.path().to_path_buf();
    
    // Create test manifest with onStartup activation
    create_test_manifest(&plugin_dir, "test.startup", vec!["onStartup".to_string()])
        .await
        .unwrap();
    
    // Create test orchestrator
    let orchestrator = Arc::new(RwLock::new(crate::manager::Orchestrator::new()));
    let manager = PluginManager::new(orchestrator, plugin_dir);
    
    // Test that startup plugin should be auto-activated
    let should_activate = manager.check_manifest_for_startup_activation("test.startup").await;
    assert!(should_activate, "Plugin with onStartup should be auto-activated");
}

#[tokio::test]
async fn test_plugin_auto_activation_wildcard() {
    let temp_dir = TempDir::new().unwrap();
    let plugin_dir = temp_dir.path().to_path_buf();
    
    // Create test manifest with wildcard activation
    create_test_manifest(&plugin_dir, "test.wildcard", vec!["*".to_string()])
        .await
        .unwrap();
    
    // Create test orchestrator
    let orchestrator = Arc::new(RwLock::new(crate::manager::Orchestrator::new()));
    let manager = PluginManager::new(orchestrator, plugin_dir);
    
    // Test that wildcard plugin should be auto-activated
    let should_activate = manager.check_manifest_for_startup_activation("test.wildcard").await;
    assert!(should_activate, "Plugin with * should be auto-activated");
}

#[tokio::test]
async fn test_plugin_no_auto_activation() {
    let temp_dir = TempDir::new().unwrap();
    let plugin_dir = temp_dir.path().to_path_buf();
    
    // Create test manifest without startup activation
    create_test_manifest(&plugin_dir, "test.noactivation", vec!["onCommand:test".to_string()])
        .await
        .unwrap();
    
    // Create test orchestrator
    let orchestrator = Arc::new(RwLock::new(crate::manager::Orchestrator::new()));
    let manager = PluginManager::new(orchestrator, plugin_dir);
    
    // Test that command plugin should NOT be auto-activated
    let should_activate = manager.check_manifest_for_startup_activation("test.noactivation").await;
    assert!(!should_activate, "Plugin with onCommand should NOT be auto-activated");
}

#[tokio::test]
async fn test_get_plugins_for_event() {
    let temp_dir = TempDir::new().unwrap();
    let plugin_dir = temp_dir.path().to_path_buf();
    
    // Create test orchestrator
    let orchestrator = Arc::new(RwLock::new(crate::manager::Orchestrator::new()));
    let manager = PluginManager::new(orchestrator, plugin_dir);
    
    // Add test plugins to the manager
    let startup_plugin = Arc::new(RwLock::new(Box::new(TestPlugin::new(
        "test.startup", 
        vec!["onStartup".to_string()]
    )) as Box<dyn Plugin>));
    
    let command_plugin = Arc::new(RwLock::new(Box::new(TestPlugin::new(
        "test.command", 
        vec!["onCommand:test".to_string()]
    )) as Box<dyn Plugin>));
    
    let wildcard_plugin = Arc::new(RwLock::new(Box::new(TestPlugin::new(
        "test.wildcard", 
        vec!["*".to_string()]
    )) as Box<dyn Plugin>));
    
    {
        let mut plugins = manager.plugins.write().await;
        plugins.insert("test.startup".to_string(), startup_plugin);
        plugins.insert("test.command".to_string(), command_plugin);
        plugins.insert("test.wildcard".to_string(), wildcard_plugin);
    }
    
    // Test startup event
    let startup_plugins = manager.get_plugins_for_event("onStartup").await;
    assert_eq!(startup_plugins.len(), 2, "Should match startup and wildcard plugins");
    assert!(startup_plugins.contains(&"test.startup".to_string()));
    assert!(startup_plugins.contains(&"test.wildcard".to_string()));
    
    // Test command event
    let command_plugins = manager.get_plugins_for_event("onCommand:test").await;
    assert_eq!(command_plugins.len(), 2, "Should match command and wildcard plugins");
    assert!(command_plugins.contains(&"test.command".to_string()));
    assert!(command_plugins.contains(&"test.wildcard".to_string()));
    
    // Test unmatched event
    let unmatched_plugins = manager.get_plugins_for_event("onOtherEvent").await;
    assert_eq!(unmatched_plugins.len(), 1, "Should only match wildcard plugin");
    assert!(unmatched_plugins.contains(&"test.wildcard".to_string()));
}

#[tokio::test]
async fn test_should_activate_for_event_patterns() {
    let temp_dir = TempDir::new().unwrap();
    let plugin_dir = temp_dir.path().to_path_buf();
    
    // Create test orchestrator
    let orchestrator = Arc::new(RwLock::new(crate::manager::Orchestrator::new()));
    let manager = PluginManager::new(orchestrator, plugin_dir);
    
    // Test exact command match
    assert!(manager.should_activate_for_event(
        &["onCommand:mycommand".to_string()], 
        "onCommand:mycommand"
    ));
    
    // Test generic command activation
    assert!(manager.should_activate_for_event(
        &["onCommand:".to_string()], 
        "onCommand:anycommand"
    ));
    
    // Test language activation
    assert!(manager.should_activate_for_event(
        &["onLanguage:rust".to_string()], 
        "onLanguage:rust"
    ));
    
    // Test wildcard activation
    assert!(manager.should_activate_for_event(
        &["*".to_string()], 
        "anyEvent"
    ));
    
    // Test no match
    assert!(!manager.should_activate_for_event(
        &["onCommand:other".to_string()], 
        "onCommand:different"
    ));
}