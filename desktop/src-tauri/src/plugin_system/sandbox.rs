use crate::error::{OrchflowError, Result};
use crate::plugin_system::manifest::PluginPermission;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use tracing::{debug, warn};

/// Plugin sandbox for security enforcement
pub struct PluginSandbox {
    /// Plugin ID
    plugin_id: String,
    /// Granted permissions
    permissions: HashSet<PluginPermission>,
    /// Allowed file paths
    allowed_paths: Vec<PathBuf>,
    /// Workspace root
    workspace_root: Option<PathBuf>,
}

impl PluginSandbox {
    /// Create a new sandbox for a plugin
    pub fn new(plugin_id: String, permissions: Vec<PluginPermission>) -> Self {
        Self {
            plugin_id,
            permissions: permissions.into_iter().collect(),
            allowed_paths: Vec::new(),
            workspace_root: None,
        }
    }
    
    /// Set workspace root
    pub fn set_workspace_root(&mut self, root: PathBuf) {
        self.workspace_root = Some(root);
    }
    
    /// Add allowed path
    pub fn add_allowed_path(&mut self, path: PathBuf) {
        self.allowed_paths.push(path);
    }
    
    /// Check if permission is granted
    pub fn has_permission(&self, permission: PluginPermission) -> bool {
        self.permissions.contains(&permission)
    }
    
    /// Check if file access is allowed
    pub fn check_file_access(&self, path: &Path, write: bool) -> Result<()> {
        let permission = if write {
            PluginPermission::FilesystemWrite
        } else {
            PluginPermission::FilesystemRead
        };
        
        if !self.has_permission(permission) {
            return Err(OrchflowError::PermissionDenied {
                operation: format!("file_{}", if write { "write" } else { "read" }),
                resource: path.to_string_lossy().to_string(),
            });
        }
        
        // Check if path is within allowed paths
        if !self.is_path_allowed(path) {
            return Err(OrchflowError::PermissionDenied {
                operation: "file_access".to_string(),
                resource: path.to_string_lossy().to_string(),
            });
        }
        
        Ok(())
    }
    
    /// Check if path is allowed
    fn is_path_allowed(&self, path: &Path) -> bool {
        // Always allow access within workspace
        if let Some(workspace) = &self.workspace_root {
            if path.starts_with(workspace) {
                return true;
            }
        }
        
        // Check explicit allowed paths
        for allowed in &self.allowed_paths {
            if path.starts_with(allowed) {
                return true;
            }
        }
        
        // Check if it's a plugin-specific directory
        if let Some(data_dir) = dirs::data_dir() {
            let plugin_dir = data_dir.join("orchflow").join("plugins").join(&self.plugin_id);
            if path.starts_with(&plugin_dir) {
                return true;
            }
        }
        
        false
    }
    
    /// Check if terminal access is allowed
    pub fn check_terminal_access(&self, write: bool) -> Result<()> {
        let permission = if write {
            PluginPermission::TerminalWrite
        } else {
            PluginPermission::TerminalRead
        };
        
        if !self.has_permission(permission) {
            return Err(OrchflowError::PermissionDenied {
                operation: format!("terminal_{}", if write { "write" } else { "read" }),
                resource: "terminal".to_string(),
            });
        }
        
        Ok(())
    }
    
    /// Check if network access is allowed
    pub fn check_network_access(&self, url: &str) -> Result<()> {
        if !self.has_permission(PluginPermission::NetworkFetch) {
            return Err(OrchflowError::PermissionDenied {
                operation: "network_fetch".to_string(),
                resource: url.to_string(),
            });
        }
        
        // Additional URL validation could go here
        // e.g., block local network access, enforce HTTPS, etc.
        
        Ok(())
    }
    
    /// Check if system command execution is allowed
    pub fn check_system_exec(&self, command: &str) -> Result<()> {
        if !self.has_permission(PluginPermission::SystemExec) {
            return Err(OrchflowError::PermissionDenied {
                operation: "system_exec".to_string(),
                resource: command.to_string(),
            });
        }
        
        // Block dangerous commands
        let dangerous_commands = [
            "rm", "del", "format", "mkfs", "dd", "shred",
            "shutdown", "reboot", "poweroff", "halt",
        ];
        
        let cmd_lower = command.to_lowercase();
        for dangerous in &dangerous_commands {
            if cmd_lower.starts_with(dangerous) {
                warn!("Plugin {} attempted to execute dangerous command: {}", self.plugin_id, command);
                return Err(OrchflowError::PermissionDenied {
                    operation: "system_exec".to_string(),
                    resource: format!("dangerous command: {}", command),
                });
            }
        }
        
        Ok(())
    }
    
    /// Check if UI webview creation is allowed
    pub fn check_webview_access(&self) -> Result<()> {
        if !self.has_permission(PluginPermission::UiWebview) {
            return Err(OrchflowError::PermissionDenied {
                operation: "ui_webview".to_string(),
                resource: "webview".to_string(),
            });
        }
        
        Ok(())
    }
    
    /// Validate all requested permissions
    pub fn validate_permissions(&self, requested: &[PluginPermission]) -> Result<()> {
        for permission in requested {
            if !self.has_permission(*permission) {
                return Err(OrchflowError::PermissionDenied {
                    operation: "permission_request".to_string(),
                    resource: format!("{:?}", permission),
                });
            }
        }
        
        Ok(())
    }
}

/// Security context for plugin API calls
pub struct SecurityContext {
    plugin_id: String,
    sandbox: PluginSandbox,
}

impl SecurityContext {
    /// Create a new security context
    pub fn new(plugin_id: String, permissions: Vec<PluginPermission>) -> Self {
        Self {
            plugin_id: plugin_id.clone(),
            sandbox: PluginSandbox::new(plugin_id, permissions),
        }
    }
    
    /// Get sandbox
    pub fn sandbox(&self) -> &PluginSandbox {
        &self.sandbox
    }
    
    /// Get mutable sandbox
    pub fn sandbox_mut(&mut self) -> &mut PluginSandbox {
        &mut self.sandbox
    }
    
    /// Audit log for security events
    pub fn audit_log(&self, action: &str, resource: &str, allowed: bool) {
        debug!(
            "Plugin {} {} access to {}: {}",
            self.plugin_id,
            if allowed { "granted" } else { "denied" },
            resource,
            action
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_permission_check() {
        let sandbox = PluginSandbox::new(
            "test.plugin".to_string(),
            vec![PluginPermission::FilesystemRead, PluginPermission::TerminalRead],
        );
        
        assert!(sandbox.has_permission(PluginPermission::FilesystemRead));
        assert!(sandbox.has_permission(PluginPermission::TerminalRead));
        assert!(!sandbox.has_permission(PluginPermission::FilesystemWrite));
        assert!(!sandbox.has_permission(PluginPermission::SystemExec));
    }
    
    #[test]
    fn test_dangerous_command_blocking() {
        let sandbox = PluginSandbox::new(
            "test.plugin".to_string(),
            vec![PluginPermission::SystemExec],
        );
        
        assert!(sandbox.check_system_exec("ls -la").is_ok());
        assert!(sandbox.check_system_exec("rm -rf /").is_err());
        assert!(sandbox.check_system_exec("shutdown -h now").is_err());
    }
}