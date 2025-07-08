// Tests for Module Management Commands
// Validates module installation, management, and execution

#[cfg(test)]
mod tests {
    use crate::modules::{ModuleLoader, ModuleManifest, ModuleType, Permission};
    use crate::simple_state_store::SimpleStateStore;
    use std::sync::Arc;
    use tokio::sync::Mutex;
    use tempfile::TempDir;

    async fn setup_test_loader() -> (Arc<Mutex<ModuleLoader>>, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let store = Arc::new(SimpleStateStore::new().unwrap());
        let loader = ModuleLoader::new(temp_dir.path().to_path_buf(), store);
        (Arc::new(Mutex::new(loader)), temp_dir)
    }

    fn create_test_manifest(name: &str) -> ModuleManifest {
        ModuleManifest {
            name: name.to_string(),
            version: "1.0.0".to_string(),
            description: "Test module".to_string(),
            author: "Test Author".to_string(),
            entry_point: "index.js".to_string(),
            module_type: ModuleType::Command,
            dependencies: vec![],
            permissions: vec![Permission::Terminal],
            config_schema: None,
        }
    }

    #[tokio::test]
    async fn test_module_manifest_validation() {
        let manifest = create_test_manifest("test-module");
        let json = serde_json::to_value(&manifest).unwrap();
        
        // Should be valid
        let result = serde_json::from_value::<ModuleManifest>(json.clone());
        assert!(result.is_ok());
        
        // Test invalid manifest
        let mut invalid = json.as_object().unwrap().clone();
        invalid.remove("name");
        let invalid_json = serde_json::Value::Object(invalid);
        
        let result = serde_json::from_value::<ModuleManifest>(invalid_json);
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_module_loader_initialization() {
        let (loader, _temp_dir) = setup_test_loader().await;
        
        // List modules should return empty initially
        let loader = loader.lock().await;
        let modules = loader.list_modules();
        assert_eq!(modules.len(), 0);
    }

    #[tokio::test]
    async fn test_module_scanning() {
        let (loader, temp_dir) = setup_test_loader().await;
        
        // Create a module directory with manifest
        let module_dir = temp_dir.path().join("test-module");
        std::fs::create_dir(&module_dir).unwrap();
        
        let manifest = create_test_manifest("test-module");
        let manifest_path = module_dir.join("manifest.json");
        std::fs::write(
            &manifest_path,
            serde_json::to_string_pretty(&manifest).unwrap(),
        )
        .unwrap();
        
        // Scan modules
        let mut loader = loader.lock().await;
        let loaded = loader.scan_modules().await.unwrap();
        
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0], "test-module");
        
        // Verify module is loaded
        let module = loader.get_module("test-module").unwrap();
        assert_eq!(module.manifest.name, "test-module");
        assert_eq!(module.manifest.version, "1.0.0");
    }

    #[tokio::test]
    async fn test_module_enable_disable() {
        let (loader, temp_dir) = setup_test_loader().await;
        
        // Create and scan a module
        let module_dir = temp_dir.path().join("toggle-module");
        std::fs::create_dir(&module_dir).unwrap();
        
        let manifest = create_test_manifest("toggle-module");
        let manifest_path = module_dir.join("manifest.json");
        std::fs::write(
            &manifest_path,
            serde_json::to_string_pretty(&manifest).unwrap(),
        )
        .unwrap();
        
        let mut loader = loader.lock().await;
        loader.scan_modules().await.unwrap();
        
        // Module should be enabled by default
        let module = loader.get_module("toggle-module").unwrap();
        assert!(module.config.enabled);
        
        // Disable module
        loader.set_module_enabled("toggle-module", false).await.unwrap();
        
        let module = loader.get_module("toggle-module").unwrap();
        assert!(!module.config.enabled);
        
        // Enable module
        loader.set_module_enabled("toggle-module", true).await.unwrap();
        
        let module = loader.get_module("toggle-module").unwrap();
        assert!(module.config.enabled);
    }

    #[tokio::test]
    async fn test_module_permissions() {
        let manifest = ModuleManifest {
            name: "permission-test".to_string(),
            version: "1.0.0".to_string(),
            description: "Test permissions".to_string(),
            author: "Test".to_string(),
            entry_point: "index.js".to_string(),
            module_type: ModuleType::Tool,
            dependencies: vec![],
            permissions: vec![
                Permission::FileSystem,
                Permission::Network,
                Permission::Terminal,
            ],
            config_schema: None,
        };
        
        // Verify permissions are stored correctly
        assert_eq!(manifest.permissions.len(), 3);
        assert!(manifest.permissions.contains(&Permission::FileSystem));
        assert!(manifest.permissions.contains(&Permission::Network));
        assert!(manifest.permissions.contains(&Permission::Terminal));
    }

    #[tokio::test]
    async fn test_module_types() {
        // Test all module types serialize/deserialize correctly
        let types = vec![
            ModuleType::Agent,
            ModuleType::Command,
            ModuleType::Layout,
            ModuleType::Theme,
            ModuleType::Language,
            ModuleType::Tool,
        ];
        
        for module_type in types {
            let json = serde_json::to_value(&module_type).unwrap();
            let deserialized: ModuleType = serde_json::from_value(json).unwrap();
            
            match (&module_type, &deserialized) {
                (ModuleType::Agent, ModuleType::Agent) => (),
                (ModuleType::Command, ModuleType::Command) => (),
                (ModuleType::Layout, ModuleType::Layout) => (),
                (ModuleType::Theme, ModuleType::Theme) => (),
                (ModuleType::Language, ModuleType::Language) => (),
                (ModuleType::Tool, ModuleType::Tool) => (),
                _ => panic!("Module type mismatch"),
            }
        }
    }

    #[tokio::test]
    async fn test_module_config() {
        let (loader, temp_dir) = setup_test_loader().await;
        
        // Create module with config schema
        let module_dir = temp_dir.path().join("config-module");
        std::fs::create_dir(&module_dir).unwrap();
        
        let mut manifest = create_test_manifest("config-module");
        manifest.config_schema = Some(serde_json::json!({
            "type": "object",
            "properties": {
                "apiKey": {
                    "type": "string",
                    "description": "API key for the service"
                },
                "timeout": {
                    "type": "number",
                    "default": 5000
                }
            }
        }));
        
        let manifest_path = module_dir.join("manifest.json");
        std::fs::write(
            &manifest_path,
            serde_json::to_string_pretty(&manifest).unwrap(),
        )
        .unwrap();
        
        let mut loader = loader.lock().await;
        loader.scan_modules().await.unwrap();
        
        let module = loader.get_module("config-module").unwrap();
        assert!(module.manifest.config_schema.is_some());
    }

    #[tokio::test]
    async fn test_module_error_handling() {
        let (loader, _temp_dir) = setup_test_loader().await;
        
        let loader = loader.lock().await;
        
        // Test getting non-existent module
        let result = loader.get_module("non-existent");
        assert!(result.is_none());
        
        // Test executing command on non-existent module
        let result = loader
            .execute_command("non-existent", "test", vec![])
            .await;
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Module not found");
        
        // Test setting enabled on non-existent module
        drop(loader); // Release lock
        let mut loader = Arc::new(Mutex::new(
            ModuleLoader::new(
                _temp_dir.path().to_path_buf(),
                Arc::new(SimpleStateStore::new().unwrap()),
            ),
        ))
        .lock()
        .await;
        
        let result = loader.set_module_enabled("non-existent", false).await;
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Module not found");
    }
}