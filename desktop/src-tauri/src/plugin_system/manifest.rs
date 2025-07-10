use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use semver::{Version, VersionReq};

/// Plugin manifest structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginManifest {
    /// Unique plugin identifier (e.g., "com.example.myplugin")
    pub id: String,
    
    /// Display name
    pub name: String,
    
    /// Plugin version
    pub version: String,
    
    /// Plugin description
    pub description: String,
    
    /// Author information
    pub author: Author,
    
    /// Repository URL
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repository: Option<String>,
    
    /// License
    pub license: String,
    
    /// Engine requirements
    pub engines: EngineRequirements,
    
    /// Main entry point
    pub main: String,
    
    /// Activation events
    pub activation_events: Vec<String>,
    
    /// Plugin contributions
    pub contributes: Contributions,
    
    /// Required permissions
    pub permissions: Vec<PluginPermission>,
    
    /// Plugin dependencies
    #[serde(default)]
    pub dependencies: HashMap<String, String>,
}

/// Author information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Author {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

/// Engine requirements
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineRequirements {
    pub orchflow: String,
}

/// Plugin contributions
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Contributions {
    #[serde(default)]
    pub commands: Vec<CommandContribution>,
    
    #[serde(default)]
    pub configuration: ConfigurationContribution,
    
    #[serde(default)]
    pub keybindings: Vec<KeybindingContribution>,
    
    #[serde(default)]
    pub menus: MenuContributions,
    
    #[serde(default)]
    pub views: ViewContributions,
    
    #[serde(default)]
    pub languages: Vec<LanguageContribution>,
    
    #[serde(default)]
    pub themes: Vec<ThemeContribution>,
}

/// Command contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandContribution {
    pub command: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
}

/// Configuration contribution
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ConfigurationContribution {
    pub title: String,
    pub properties: HashMap<String, ConfigProperty>,
}

/// Configuration property
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigProperty {
    #[serde(rename = "type")]
    pub prop_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<serde_json::Value>,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enum_values: Option<Vec<String>>,
}

/// Keybinding contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeybindingContribution {
    pub command: String,
    pub key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub when: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mac: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub linux: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub win: Option<String>,
}

/// Menu contributions
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MenuContributions {
    #[serde(default)]
    pub command_palette: Vec<MenuItemContribution>,
    
    #[serde(default)]
    pub editor_context: Vec<MenuItemContribution>,
    
    #[serde(default)]
    pub explorer_context: Vec<MenuItemContribution>,
    
    #[serde(default)]
    pub terminal_context: Vec<MenuItemContribution>,
}

/// Menu item contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MenuItemContribution {
    pub command: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub when: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub group: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order: Option<i32>,
}

/// View contributions
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ViewContributions {
    #[serde(default)]
    pub views: HashMap<String, Vec<ViewContribution>>,
}

/// View contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViewContribution {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub when: Option<String>,
}

/// Language contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LanguageContribution {
    pub id: String,
    pub extensions: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub aliases: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filenames: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first_line: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub configuration: Option<String>,
}

/// Theme contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeContribution {
    pub id: String,
    pub label: String,
    pub path: String,
    #[serde(rename = "uiTheme")]
    pub ui_theme: String,
}

/// Plugin permissions
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PluginPermission {
    /// Read terminal output
    TerminalRead,
    /// Write to terminal
    TerminalWrite,
    /// Read files
    FilesystemRead,
    /// Write files
    FilesystemWrite,
    /// Make network requests
    NetworkFetch,
    /// Execute system commands
    SystemExec,
    /// Create webview panels
    UiWebview,
    /// Access workspace configuration
    WorkspaceConfig,
    /// Register language providers
    LanguageProviders,
    /// Debug other extensions
    DebugExtensions,
}

impl PluginManifest {
    /// Load manifest from JSON string
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }
    
    /// Load manifest from file
    pub async fn from_file(path: &std::path::Path) -> Result<Self, Box<dyn std::error::Error>> {
        let content = tokio::fs::read_to_string(path).await?;
        Ok(Self::from_json(&content)?)
    }
    
    /// Validate manifest
    pub fn validate(&self) -> Result<(), String> {
        // Validate ID format
        if !self.id.contains('.') {
            return Err("Plugin ID must be in reverse domain format (e.g., com.example.plugin)".to_string());
        }
        
        // Validate version
        Version::parse(&self.version)
            .map_err(|e| format!("Invalid version: {}", e))?;
        
        // Validate engine requirements
        VersionReq::parse(&self.engines.orchflow)
            .map_err(|e| format!("Invalid engine requirement: {}", e))?;
        
        // Validate main entry point
        if self.main.is_empty() {
            return Err("Main entry point cannot be empty".to_string());
        }
        
        // Validate activation events
        for event in &self.activation_events {
            if !Self::is_valid_activation_event(event) {
                return Err(format!("Invalid activation event: {}", event));
            }
        }
        
        Ok(())
    }
    
    /// Check if activation event is valid
    fn is_valid_activation_event(event: &str) -> bool {
        event.starts_with("onStartup")
            || event.starts_with("onCommand:")
            || event.starts_with("onLanguage:")
            || event.starts_with("onFileSystem:")
            || event.starts_with("onView:")
            || event.starts_with("onUri:")
            || event.starts_with("onWebviewPanel:")
            || event == "*"
    }
    
    /// Check if manifest is compatible with current Orchflow version
    pub fn is_compatible(&self, orchflow_version: &Version) -> bool {
        if let Ok(req) = VersionReq::parse(&self.engines.orchflow) {
            req.matches(orchflow_version)
        } else {
            false
        }
    }
}