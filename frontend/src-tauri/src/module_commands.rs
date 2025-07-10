// Module Management Commands - Tauri commands for module system
//
// These commands provide the interface for installing, managing, and executing modules

use crate::modules::{ModuleLoader, ModuleManifest};
use crate::simple_state_store::SimpleStateStore;
use crate::error::OrchflowError;
use tauri::State;
use std::sync::Arc;
use tokio::sync::Mutex;
use serde_json::Value;
use serde::{Deserialize, Serialize};

// ===== Module Management Commands =====

#[tauri::command]
pub async fn install_module(
    name: String,
    version: String,
    manifest: Value,
    module_loader: State<'_, Arc<Mutex<ModuleLoader>>>,
) -> Result<Value, String> {
    // Parse the manifest
    let manifest: ModuleManifest = serde_json::from_value(manifest)
        .map_err(|e| format!("Invalid manifest: {}", e))?;
    
    // Validate manifest fields match provided name/version
    if manifest.name != name {
        return Err("Module name mismatch".to_string());
    }
    if manifest.version != version {
        return Err("Module version mismatch".to_string());
    }
    
    // Install through the loader (which will persist to DB)
    let loader = module_loader.lock().await;
    
    // Check if module already exists
    if let Some(existing) = loader.get_module(&name) {
        return Err(format!("Module '{}' already installed (version {})", 
            existing.manifest.name, existing.manifest.version));
    }
    
    // For now, we'll store the manifest in the database
    // In a real implementation, this would download and extract the module files
    drop(loader); // Release lock before calling scan_modules
    
    // Trigger a rescan to pick up the new module
    let mut loader = module_loader.lock().await;
    loader.scan_modules().await
        .map_err(|e| format!("Failed to scan modules: {}", e))?;
    
    // Return the installed module info
    if let Some(module) = loader.get_module(&name) {
        Ok(serde_json::to_value(&module.manifest).unwrap())
    } else {
        Err("Module installation failed".to_string())
    }
}

#[tauri::command]
pub async fn list_modules(
    module_loader: State<'_, Arc<Mutex<ModuleLoader>>>,
) -> Result<Vec<Value>, String> {
    let loader = module_loader.lock().await;
    
    // Get all modules from the loader
    let modules: Vec<Value> = loader.list_modules()
        .into_iter()
        .map(|module| {
            serde_json::json!({
                "name": module.manifest.name,
                "version": module.manifest.version,
                "description": module.manifest.description,
                "author": module.manifest.author,
                "type": module.manifest.module_type,
                "enabled": module.config.enabled,
                "permissions": module.manifest.permissions,
            })
        })
        .collect();
    
    Ok(modules)
}

#[tauri::command]
pub async fn get_module(
    name: String,
    module_loader: State<'_, Arc<Mutex<ModuleLoader>>>,
) -> Result<Value, String> {
    let loader = module_loader.lock().await;
    
    if let Some(module) = loader.get_module(&name) {
        Ok(serde_json::json!({
            "name": module.manifest.name,
            "version": module.manifest.version,
            "description": module.manifest.description,
            "author": module.manifest.author,
            "type": module.manifest.module_type,
            "enabled": module.config.enabled,
            "permissions": module.manifest.permissions,
            "entry_point": module.manifest.entry_point,
            "dependencies": module.manifest.dependencies,
            "config_schema": module.manifest.config_schema,
        }))
    } else {
        Err(OrchflowError::module_not_found(&name).to_string())
    }
}

#[tauri::command]
pub async fn enable_module(
    name: String,
    enabled: bool,
    module_loader: State<'_, Arc<Mutex<ModuleLoader>>>,
) -> Result<(), String> {
    let mut loader = module_loader.lock().await;
    loader.set_module_enabled(&name, enabled).await
}

#[tauri::command]
pub async fn uninstall_module(
    name: String,
    module_loader: State<'_, Arc<Mutex<ModuleLoader>>>,
    state_store: State<'_, Arc<SimpleStateStore>>,
) -> Result<(), String> {
    // First disable the module
    let mut loader = module_loader.lock().await;
    loader.set_module_enabled(&name, false).await?;
    
    // Remove from database
    state_store.uninstall_module_by_name(&name).await
        .map_err(|e| e.to_string())?;
    
    // Rescan to update loader state
    loader.scan_modules().await
        .map_err(|e| format!("Failed to rescan modules: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn execute_module_command(
    module_name: String,
    command: String,
    args: Vec<String>,
    module_loader: State<'_, Arc<Mutex<ModuleLoader>>>,
) -> Result<String, String> {
    let loader = module_loader.lock().await;
    loader.execute_command(&module_name, &command, args).await
}

#[tauri::command]
pub async fn get_module_commands(
    module_name: String,
    module_loader: State<'_, Arc<Mutex<ModuleLoader>>>,
) -> Result<Vec<String>, String> {
    let loader = module_loader.lock().await;
    
    if let Some(module) = loader.get_module(&module_name) {
        if let Some(instance) = &module.instance {
            Ok(instance.get_commands())
        } else {
            Ok(vec![]) // Module not initialized yet
        }
    } else {
        Err(OrchflowError::module_not_found(&module_name).to_string())
    }
}

#[tauri::command]
pub async fn update_module_config(
    module_name: String,
    config: Value,
    module_loader: State<'_, Arc<Mutex<ModuleLoader>>>,
    state_store: State<'_, Arc<SimpleStateStore>>,
) -> Result<(), String> {
    // Validate config against schema if available
    let loader = module_loader.lock().await;
    
    if let Some(module) = loader.get_module(&module_name) {
        // Validate config against schema if present
        if let Some(schema) = &module.manifest.config_schema {
            validate_config_against_schema(&config, schema)?;
        }
        
        // Store config in database
        let config_str = serde_json::to_string(&config)
            .map_err(|e| e.to_string())?;
        
        state_store.set_setting(
            &format!("module.{}.config", module_name),
            &config_str,
        )
        .await
        .map_err(|e| e.to_string())?;
        
        Ok(())
    } else {
        Err(OrchflowError::module_not_found(&module_name).to_string())
    }
}

#[tauri::command]
pub async fn get_module_config(
    module_name: String,
    module_loader: State<'_, Arc<Mutex<ModuleLoader>>>,
) -> Result<Value, String> {
    let loader = module_loader.lock().await;
    
    if let Some(module) = loader.get_module(&module_name) {
        Ok(serde_json::to_value(&module.config.settings).unwrap())
    } else {
        Err(OrchflowError::module_not_found(&module_name).to_string())
    }
}

// ===== Module Discovery Commands =====

#[tauri::command]
pub async fn search_module_registry(
    query: String,
    _state_store: State<'_, Arc<SimpleStateStore>>,
) -> Result<Vec<Value>, String> {
    // In a real implementation, this would query a central registry API
    // For now, return mock data for demonstration
    
    let mock_modules = vec![
        ModuleRegistryEntry {
            id: "git-integration".to_string(),
            name: "Git Integration".to_string(),
            version: "1.2.0".to_string(),
            description: "Full Git integration with diff viewer and commit interface".to_string(),
            author: "OrchFlow Team".to_string(),
            module_type: "tool".to_string(),
            downloads: 1523,
            rating: 4.8,
            updated_at: "2024-01-15T10:30:00Z".to_string(),
            tags: vec!["git".to_string(), "vcs".to_string(), "productivity".to_string()],
        },
        ModuleRegistryEntry {
            id: "python-agent".to_string(),
            name: "Python AI Agent".to_string(),
            version: "0.9.1".to_string(),
            description: "Python-based AI agent for code analysis and generation".to_string(),
            author: "Community".to_string(),
            module_type: "agent".to_string(),
            downloads: 892,
            rating: 4.5,
            updated_at: "2024-01-10T15:45:00Z".to_string(),
            tags: vec!["python".to_string(), "ai".to_string(), "agent".to_string()],
        },
        ModuleRegistryEntry {
            id: "dark-theme".to_string(),
            name: "Dark Theme Pro".to_string(),
            version: "2.0.0".to_string(),
            description: "Professional dark theme with multiple color schemes".to_string(),
            author: "ThemeWorks".to_string(),
            module_type: "theme".to_string(),
            downloads: 3421,
            rating: 4.9,
            updated_at: "2024-01-08T09:00:00Z".to_string(),
            tags: vec!["theme".to_string(), "dark".to_string(), "ui".to_string()],
        },
    ];
    
    // Filter by query
    let filtered: Vec<Value> = mock_modules
        .into_iter()
        .filter(|module| {
            let query_lower = query.to_lowercase();
            module.name.to_lowercase().contains(&query_lower) ||
            module.description.to_lowercase().contains(&query_lower) ||
            module.tags.iter().any(|tag| tag.to_lowercase().contains(&query_lower))
        })
        .map(|module| serde_json::to_value(module).unwrap())
        .collect();
    
    Ok(filtered)
}

#[tauri::command]
pub async fn get_module_details_from_registry(
    module_id: String,
    _state_store: State<'_, Arc<SimpleStateStore>>,
) -> Result<Value, String> {
    // In a real implementation, this would fetch from a registry API
    // For now, return mock detailed data
    
    let module_details = match module_id.as_str() {
        "git-integration" => serde_json::json!({
            "id": "git-integration",
            "name": "Git Integration",
            "version": "1.2.0",
            "description": "Full Git integration with diff viewer and commit interface",
            "long_description": "A comprehensive Git integration module that provides:\n\n- Branch management\n- Diff viewer with syntax highlighting\n- Commit interface with staging\n- Git history visualization\n- Conflict resolution tools\n\nSeamlessly integrates with OrchFlow's file explorer and editor.",
            "author": {
                "name": "OrchFlow Team",
                "email": "modules@orchflow.io",
                "url": "https://orchflow.io"
            },
            "module_type": "tool",
            "downloads": 1523,
            "rating": 4.8,
            "ratings_count": 87,
            "updated_at": "2024-01-15T10:30:00Z",
            "created_at": "2023-06-20T14:00:00Z",
            "tags": ["git", "vcs", "productivity"],
            "screenshots": [
                "https://registry.orchflow.io/screenshots/git-integration-1.png",
                "https://registry.orchflow.io/screenshots/git-integration-2.png"
            ],
            "readme_url": "https://registry.orchflow.io/modules/git-integration/README.md",
            "repository_url": "https://github.com/orchflow/git-integration-module",
            "homepage_url": "https://orchflow.io/modules/git-integration",
            "license": "MIT",
            "manifest": {
                "name": "git-integration",
                "version": "1.2.0",
                "description": "Full Git integration with diff viewer and commit interface",
                "author": "OrchFlow Team",
                "entry_point": "dist/index.js",
                "module_type": "tool",
                "dependencies": [],
                "permissions": ["file_system", "process"],
                "config_schema": {
                    "type": "object",
                    "properties": {
                        "enabled": {
                            "type": "boolean",
                            "default": true
                        },
                        "auto_fetch": {
                            "type": "boolean",
                            "default": false,
                            "description": "Automatically fetch from remotes"
                        },
                        "default_branch": {
                            "type": "string",
                            "default": "main",
                            "description": "Default branch name for new repositories"
                        }
                    }
                }
            },
            "changelog": [
                {
                    "version": "1.2.0",
                    "date": "2024-01-15",
                    "changes": ["Added conflict resolution UI", "Improved diff performance", "Fixed staging area bugs"]
                },
                {
                    "version": "1.1.0",
                    "date": "2023-11-20",
                    "changes": ["Added branch visualization", "Support for submodules", "Enhanced commit search"]
                }
            ]
        }),
        "python-agent" => serde_json::json!({
            "id": "python-agent",
            "name": "Python AI Agent",
            "version": "0.9.1",
            "description": "Python-based AI agent for code analysis and generation",
            "long_description": "An intelligent Python agent that can:\n\n- Analyze Python code for bugs and improvements\n- Generate boilerplate code\n- Refactor existing code\n- Provide code explanations\n- Suggest optimizations\n\nPowered by advanced AI models with Python-specific training.",
            "author": {
                "name": "Community",
                "email": "python-agent@community.orchflow.io"
            },
            "module_type": "agent",
            "downloads": 892,
            "rating": 4.5,
            "ratings_count": 45,
            "updated_at": "2024-01-10T15:45:00Z",
            "tags": ["python", "ai", "agent"],
            "license": "Apache-2.0"
        }),
        "dark-theme" => serde_json::json!({
            "id": "dark-theme",
            "name": "Dark Theme Pro",
            "version": "2.0.0",
            "description": "Professional dark theme with multiple color schemes",
            "author": {
                "name": "ThemeWorks",
                "email": "themes@themeworks.dev"
            },
            "module_type": "theme",
            "downloads": 3421,
            "rating": 4.9,
            "ratings_count": 234,
            "updated_at": "2024-01-08T09:00:00Z",
            "tags": ["theme", "dark", "ui"],
            "license": "Commercial"
        }),
        _ => return Err(format!("Module '{}' not found in registry", module_id))
    };
    
    Ok(module_details)
}

// ===== Module Development Commands =====

#[tauri::command]
pub async fn validate_module_manifest(
    manifest: Value,
) -> Result<bool, String> {
    // Try to parse the manifest
    match serde_json::from_value::<ModuleManifest>(manifest) {
        Ok(_) => Ok(true),
        Err(e) => Err(format!("Invalid manifest: {}", e)),
    }
}

#[tauri::command]
pub async fn create_module_template(
    name: String,
    module_type: String,
    output_dir: String,
) -> Result<String, String> {
    use tokio::fs;
    use std::path::Path;
    
    // Validate module type
    let valid_types = ["agent", "command", "layout", "theme", "language", "tool"];
    if !valid_types.contains(&module_type.as_str()) {
        return Err(format!("Invalid module type: {}. Must be one of: {:?}", module_type, valid_types));
    }
    
    // Create module directory
    let module_path = Path::new(&output_dir).join(&name);
    fs::create_dir_all(&module_path).await
        .map_err(|e| format!("Failed to create module directory: {}", e))?;
    
    // Create manifest.json
    let manifest = serde_json::json!({
        "name": name,
        "version": "0.1.0",
        "description": format!("A new {} module", module_type),
        "author": "Your Name <your.email@example.com>",
        "entry_point": "index.js",
        "module_type": module_type,
        "dependencies": [],
        "permissions": match module_type.as_str() {
            "agent" => vec!["terminal", "process"],
            "command" => vec!["terminal"],
            "layout" => vec!["state"],
            "theme" => vec![],
            "language" => vec!["file_system"],
            "tool" => vec!["file_system", "process"],
            _ => vec![]
        },
        "config_schema": {
            "type": "object",
            "properties": {
                "enabled": {
                    "type": "boolean",
                    "default": true
                }
            }
        }
    });
    
    let manifest_path = module_path.join("manifest.json");
    fs::write(&manifest_path, serde_json::to_string_pretty(&manifest).unwrap()).await
        .map_err(|e| format!("Failed to write manifest.json: {}", e))?;
    
    // Create entry point file
    let entry_content = match module_type.as_str() {
        "agent" => r#"// Agent Module Template
class AgentModule {
  constructor() {
    this.name = 'MyAgent';
    this.version = '0.1.0';
    this.terminals = new Map();
  }

  async init() {
    console.log(`${this.name} agent initialized`);
  }

  async execute(command, args) {
    switch (command) {
      case 'start':
        return this.startAgent(args[0]);
      case 'stop':
        return this.stopAgent(args[0]);
      case 'status':
        return this.getStatus();
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }

  async startAgent(terminalId) {
    // Start agent in specified terminal
    this.terminals.set(terminalId, { status: 'running', startTime: Date.now() });
    return `Agent started in terminal ${terminalId}`;
  }

  async stopAgent(terminalId) {
    // Stop agent in specified terminal
    this.terminals.delete(terminalId);
    return `Agent stopped in terminal ${terminalId}`;
  }

  async getStatus() {
    const running = Array.from(this.terminals.keys());
    return `Agent running in ${running.length} terminal(s): ${running.join(', ')}`;
  }

  getCommands() {
    return ['start', 'stop', 'status'];
  }

  async cleanup() {
    // Clean up all terminals
    this.terminals.clear();
    console.log(`${this.name} agent cleaned up`);
  }
}

module.exports = AgentModule;
"#,
        "command" => r#"// Command Module Template
class CommandModule {
  constructor() {
    this.name = 'MyCommand';
    this.version = '0.1.0';
  }

  async init() {
    console.log(`${this.name} command module initialized`);
  }

  async execute(command, args) {
    switch (command) {
      case 'hello':
        return this.hello(args[0]);
      case 'process':
        return this.processData(args);
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }

  async hello(name = 'World') {
    return `Hello, ${name}!`;
  }

  async processData(args) {
    // Example command that processes arguments
    const result = args.map(arg => arg.toUpperCase()).join(' ');
    return `Processed: ${result}`;
  }

  getCommands() {
    return ['hello', 'process'];
  }

  async cleanup() {
    console.log(`${this.name} command module cleaned up`);
  }
}

module.exports = CommandModule;
"#,
        _ => r#"// Module Entry Point
class Module {
  constructor() {
    this.name = 'MyModule';
    this.version = '0.1.0';
  }

  async init() {
    console.log('Module initialized');
  }

  async execute(command, args) {
    return `Executed ${command} with args: ${args.join(', ')}`;
  }

  getCommands() {
    return ['example-command'];
  }

  async cleanup() {
    console.log('Module cleanup');
  }
}

module.exports = Module;
"#
    };
    
    let entry_path = module_path.join("index.js");
    fs::write(&entry_path, entry_content).await
        .map_err(|e| format!("Failed to write entry point: {}", e))?;
    
    // Create README.md
    let readme_content = format!(
        "# {}\n\nA {} module for OrchFlow.\n\n## Installation\n\n```bash\norchflow module install {}\n```\n\n## Configuration\n\nEdit your module configuration:\n\n```json\n{{\n  \"enabled\": true\n}}\n```\n\n## Development\n\n1. Edit `index.js` to implement your module functionality\n2. Update `manifest.json` with your module details\n3. Test your module locally\n4. Publish to the module registry\n",
        name, module_type, name
    );
    
    let readme_path = module_path.join("README.md");
    fs::write(&readme_path, readme_content).await
        .map_err(|e| format!("Failed to write README.md: {}", e))?;
    
    Ok(module_path.to_string_lossy().to_string())
}

/// Validate configuration against a JSON schema
fn validate_config_against_schema(config: &Value, schema: &Value) -> Result<(), String> {
    // Basic validation - in a real implementation, use a JSON Schema validator
    if let (Some(config_obj), Some(schema_obj)) = (config.as_object(), schema.as_object()) {
        if let Some(properties) = schema_obj.get("properties").and_then(|p| p.as_object()) {
            // Check required properties
            if let Some(required) = schema_obj.get("required").and_then(|r| r.as_array()) {
                for req in required {
                    if let Some(req_str) = req.as_str() {
                        if !config_obj.contains_key(req_str) {
                            return Err(format!("Missing required property: {}", req_str));
                        }
                    }
                }
            }
            
            // Validate property types
            for (key, value) in config_obj {
                if let Some(prop_schema) = properties.get(key) {
                    validate_property_type(value, prop_schema, key)?;
                } else if schema_obj.get("additionalProperties") == Some(&Value::Bool(false)) {
                    return Err(format!("Unknown property: {}", key));
                }
            }
        }
    }
    
    Ok(())
}

/// Validate a single property against its schema
fn validate_property_type(value: &Value, schema: &Value, property_name: &str) -> Result<(), String> {
    if let Some(type_str) = schema.get("type").and_then(|t| t.as_str()) {
        let valid = match type_str {
            "string" => value.is_string(),
            "number" => value.is_number(),
            "boolean" => value.is_boolean(),
            "array" => value.is_array(),
            "object" => value.is_object(),
            "null" => value.is_null(),
            _ => true,
        };
        
        if !valid {
            return Err(format!("Property '{}' must be of type '{}'", property_name, type_str));
        }
    }
    
    Ok(())
}

// Module registry types
#[derive(Debug, Serialize, Deserialize)]
pub struct ModuleRegistryEntry {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub module_type: String,
    pub downloads: u64,
    pub rating: f32,
    pub updated_at: String,
    pub tags: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    
    #[test]
    fn test_validate_config_against_schema() {
        // Test valid config
        let schema = json!({
            "type": "object",
            "properties": {
                "enabled": { "type": "boolean" },
                "name": { "type": "string" },
                "count": { "type": "number" }
            },
            "required": ["enabled"]
        });
        
        let valid_config = json!({
            "enabled": true,
            "name": "test",
            "count": 42
        });
        
        assert!(validate_config_against_schema(&valid_config, &schema).is_ok());
        
        // Test missing required property
        let invalid_config = json!({
            "name": "test"
        });
        
        let result = validate_config_against_schema(&invalid_config, &schema);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Missing required property: enabled"));
        
        // Test wrong type
        let wrong_type_config = json!({
            "enabled": "yes", // Should be boolean
            "name": "test"
        });
        
        let result = validate_config_against_schema(&wrong_type_config, &schema);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("must be of type 'boolean'"));
        
        // Test additional properties when not allowed
        let strict_schema = json!({
            "type": "object",
            "properties": {
                "enabled": { "type": "boolean" }
            },
            "additionalProperties": false
        });
        
        let extra_prop_config = json!({
            "enabled": true,
            "extra": "not allowed"
        });
        
        let result = validate_config_against_schema(&extra_prop_config, &strict_schema);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Unknown property: extra"));
    }
    
    #[test]
    fn test_validate_property_type() {
        let string_schema = json!({ "type": "string" });
        let number_schema = json!({ "type": "number" });
        let boolean_schema = json!({ "type": "boolean" });
        let array_schema = json!({ "type": "array" });
        let object_schema = json!({ "type": "object" });
        
        // Test string validation
        assert!(validate_property_type(&json!("test"), &string_schema, "prop").is_ok());
        assert!(validate_property_type(&json!(123), &string_schema, "prop").is_err());
        
        // Test number validation
        assert!(validate_property_type(&json!(42), &number_schema, "prop").is_ok());
        assert!(validate_property_type(&json!(3.14), &number_schema, "prop").is_ok());
        assert!(validate_property_type(&json!("42"), &number_schema, "prop").is_err());
        
        // Test boolean validation
        assert!(validate_property_type(&json!(true), &boolean_schema, "prop").is_ok());
        assert!(validate_property_type(&json!(false), &boolean_schema, "prop").is_ok());
        assert!(validate_property_type(&json!(1), &boolean_schema, "prop").is_err());
        
        // Test array validation
        assert!(validate_property_type(&json!([1, 2, 3]), &array_schema, "prop").is_ok());
        assert!(validate_property_type(&json!("array"), &array_schema, "prop").is_err());
        
        // Test object validation
        assert!(validate_property_type(&json!({"key": "value"}), &object_schema, "prop").is_ok());
        assert!(validate_property_type(&json!("object"), &object_schema, "prop").is_err());
    }
    
    #[test]
    fn test_module_registry_search() {
        // Test search functionality
        let mock_modules = vec![
            ModuleRegistryEntry {
                id: "test-module".to_string(),
                name: "Test Module".to_string(),
                version: "1.0.0".to_string(),
                description: "A test module for searching".to_string(),
                author: "Test Author".to_string(),
                module_type: "tool".to_string(),
                downloads: 100,
                rating: 4.5,
                updated_at: "2024-01-01T00:00:00Z".to_string(),
                tags: vec!["test".to_string(), "search".to_string()],
            },
        ];
        
        // Test name match
        let name_match = mock_modules.iter()
            .filter(|m| m.name.to_lowercase().contains("test"))
            .count();
        assert_eq!(name_match, 1);
        
        // Test tag match
        let tag_match = mock_modules.iter()
            .filter(|m| m.tags.iter().any(|t| t.contains("search")))
            .count();
        assert_eq!(tag_match, 1);
        
        // Test no match
        let no_match = mock_modules.iter()
            .filter(|m| m.name.contains("nonexistent"))
            .count();
        assert_eq!(no_match, 0);
    }
    
    #[tokio::test]
    async fn test_create_module_template() {
        use tempfile::TempDir;
        
        let temp_dir = TempDir::new().unwrap();
        let output_dir = temp_dir.path().to_str().unwrap().to_string();
        
        // Test valid module type
        let result = create_module_template(
            "test-module".to_string(),
            "command".to_string(),
            output_dir.clone()
        ).await;
        
        assert!(result.is_ok());
        let module_path = result.unwrap();
        
        // Check that files were created
        let manifest_path = std::path::Path::new(&module_path).join("manifest.json");
        assert!(manifest_path.exists());
        
        let entry_path = std::path::Path::new(&module_path).join("index.js");
        assert!(entry_path.exists());
        
        let readme_path = std::path::Path::new(&module_path).join("README.md");
        assert!(readme_path.exists());
        
        // Test invalid module type
        let invalid_result = create_module_template(
            "invalid-module".to_string(),
            "invalid-type".to_string(),
            output_dir
        ).await;
        
        assert!(invalid_result.is_err());
        assert!(invalid_result.unwrap_err().contains("Invalid module type"));
    }
}