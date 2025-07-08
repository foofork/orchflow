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
        // TODO: Validate config against module.manifest.config_schema
        
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
    _query: String,
    _state_store: State<'_, Arc<SimpleStateStore>>,
) -> Result<Vec<Value>, String> {
    // TODO: Implement module registry search
    // This would connect to a central module registry/marketplace
    // For now, return empty results
    Ok(vec![])
}

#[tauri::command]
pub async fn get_module_details_from_registry(
    module_id: String,
    _state_store: State<'_, Arc<SimpleStateStore>>,
) -> Result<Value, String> {
    // TODO: Implement fetching module details from registry
    Err(format!("Module '{}' not found in registry", module_id))
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
    _name: String,
    _module_type: String,
    _output_dir: String,
) -> Result<String, String> {
    // TODO: Implement module template generation
    // This would create a skeleton module structure
    Err("Module template generation not yet implemented".to_string())
}