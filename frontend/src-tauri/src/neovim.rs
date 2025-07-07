use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct NeovimBuffer {
    pub id: u32,
    pub name: String,
    pub filetype: String,
    pub modified: bool,
    pub lines: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NeovimCursor {
    pub line: u32,
    pub column: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NeovimError {
    pub message: String,
}

pub struct NeovimInstance {
    #[cfg_attr(not(feature = "dev-unused"), allow(dead_code))]
    pub id: String,
    pub socket_path: String,
    process: Option<std::process::Child>,
    // TODO: For future RPC implementation:
    // - responses: Arc<Mutex<HashMap<u32, String>>> for async message tracking
    // - request_id: Arc<Mutex<u32>> for message sequencing
    // Consider using neovim-lib or nvim-rs for proper msgpack-rpc support
}

impl NeovimInstance {
    pub fn new(id: String) -> Result<Self, NeovimError> {
        let socket_path = format!("/tmp/nvim-{}.sock", id);
        
        // Start Neovim in headless mode with RPC
        let child = Command::new("nvim")
            .args(&[
                "--headless",
                "--listen", &socket_path,
            ])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| NeovimError { 
                message: format!("Failed to start Neovim: {}", e) 
            })?;
        
        // Give Neovim time to start
        std::thread::sleep(std::time::Duration::from_millis(500));
        
        Ok(NeovimInstance {
            id,
            socket_path,
            process: Some(child),
        })
    }
    
    pub fn execute_lua(&self, code: &str) -> Result<String, NeovimError> {
        // Use nvim command to execute Lua code
        let output = Command::new("nvim")
            .args(&[
                "--server", &self.socket_path,
                "--remote-expr",
                &format!("luaeval('{}')", code.replace("'", "\\'")),
            ])
            .output()
            .map_err(|e| NeovimError { 
                message: format!("Failed to execute Lua: {}", e) 
            })?;
        
        if !output.status.success() {
            return Err(NeovimError {
                message: String::from_utf8_lossy(&output.stderr).to_string(),
            });
        }
        
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    }
    
    pub fn get_current_buffer(&self) -> Result<NeovimBuffer, NeovimError> {
        // Get buffer info via Lua
        let lua_code = r#"
            local buf = vim.api.nvim_get_current_buf()
            local name = vim.api.nvim_buf_get_name(buf)
            local ft = vim.api.nvim_buf_get_option(buf, 'filetype')
            local modified = vim.api.nvim_buf_get_option(buf, 'modified')
            local lines = vim.api.nvim_buf_get_lines(buf, 0, -1, false)
            return vim.fn.json_encode({
                id = buf,
                name = name,
                filetype = ft,
                modified = modified,
                lines = lines
            })
        "#;
        
        let json_result = self.execute_lua(lua_code)?;
        serde_json::from_str(&json_result)
            .map_err(|e| NeovimError { 
                message: format!("Failed to parse buffer info: {}", e) 
            })
    }
    
    pub fn open_file(&self, filepath: &str) -> Result<(), NeovimError> {
        Command::new("nvim")
            .args(&[
                "--server", &self.socket_path,
                "--remote", filepath,
            ])
            .status()
            .map_err(|e| NeovimError { 
                message: format!("Failed to open file: {}", e) 
            })?;
        
        Ok(())
    }
    
    pub fn set_buffer_content(&self, content: &str) -> Result<(), NeovimError> {
        let lua_code = format!(
            r#"
            local buf = vim.api.nvim_get_current_buf()
            local lines = vim.split([[{}]], '\n')
            vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
            "#,
            content.replace("]]", "] ]")
        );
        
        self.execute_lua(&lua_code)?;
        Ok(())
    }
    
    #[cfg_attr(not(feature = "dev-unused"), allow(dead_code))]
    pub fn get_cursor_position(&self) -> Result<NeovimCursor, NeovimError> {
        let lua_code = r#"
            local pos = vim.api.nvim_win_get_cursor(0)
            return vim.fn.json_encode({line = pos[1], column = pos[2]})
        "#;
        
        let json_result = self.execute_lua(lua_code)?;
        serde_json::from_str(&json_result)
            .map_err(|e| NeovimError { 
                message: format!("Failed to parse cursor position: {}", e) 
            })
    }
    
    #[cfg_attr(not(feature = "dev-unused"), allow(dead_code))]
    pub fn set_cursor_position(&self, line: u32, column: u32) -> Result<(), NeovimError> {
        let lua_code = format!(
            "vim.api.nvim_win_set_cursor(0, {{{}, {}}})",
            line, column
        );
        
        self.execute_lua(&lua_code)?;
        Ok(())
    }
    
    pub fn execute_command(&self, command: &str) -> Result<String, NeovimError> {
        let lua_code = format!(
            r#"
            local ok, result = pcall(vim.cmd, [[{}]])
            if ok then
                return vim.fn.json_encode({{success = true, result = ""}})
            else
                return vim.fn.json_encode({{success = false, error = tostring(result)}})
            end
            "#,
            command.replace("]]", "] ]")
        );
        
        let json_result = self.execute_lua(&lua_code)?;
        let result: serde_json::Value = serde_json::from_str(&json_result)
            .map_err(|e| NeovimError { 
                message: format!("Failed to parse command result: {}", e) 
            })?;
        
        if result["success"].as_bool().unwrap_or(false) {
            Ok(result["result"].as_str().unwrap_or("").to_string())
        } else {
            Err(NeovimError {
                message: result["error"].as_str().unwrap_or("Unknown error").to_string(),
            })
        }
    }
    
    pub fn shutdown(&mut self) -> Result<(), NeovimError> {
        // Send quit command
        self.execute_command("qa!")?;
        
        // Kill the process if still running
        if let Some(mut child) = self.process.take() {
            child.kill().ok();
            child.wait().ok();
        }
        
        // Clean up socket
        std::fs::remove_file(&self.socket_path).ok();
        
        Ok(())
    }
}

impl Drop for NeovimInstance {
    fn drop(&mut self) {
        self.shutdown().ok();
    }
}

// Manager for multiple Neovim instances
pub struct NeovimManager {
    instances: Arc<Mutex<HashMap<String, NeovimInstance>>>,
}

impl NeovimManager {
    pub fn new() -> Self {
        NeovimManager {
            instances: Arc::new(Mutex::new(HashMap::new())),
        }
    }
    
    pub fn create_instance(&self, id: String) -> Result<String, NeovimError> {
        let instance = NeovimInstance::new(id.clone())?;
        let mut instances = self.instances.lock().unwrap();
        instances.insert(id.clone(), instance);
        Ok(id)
    }
    
    pub fn get_instance(&self, id: &str) -> Result<std::sync::MutexGuard<HashMap<String, NeovimInstance>>, NeovimError> {
        let instances = self.instances.lock().unwrap();
        if instances.contains_key(id) {
            Ok(instances)
        } else {
            Err(NeovimError {
                message: format!("Neovim instance '{}' not found", id),
            })
        }
    }
    
    pub fn close_instance(&self, id: &str) -> Result<(), NeovimError> {
        let mut instances = self.instances.lock().unwrap();
        if let Some(mut instance) = instances.remove(id) {
            instance.shutdown()?;
        }
        Ok(())
    }
}

// Tauri commands
#[tauri::command]
pub async fn nvim_create_instance(id: String, manager: tauri::State<'_, NeovimManager>) -> Result<String, String> {
    manager.create_instance(id).map_err(|e| e.message)
}

#[tauri::command]
pub async fn nvim_open_file(id: String, filepath: String, manager: tauri::State<'_, NeovimManager>) -> Result<(), String> {
    let instances = manager.get_instance(&id).map_err(|e| e.message)?;
    if let Some(instance) = instances.get(&id) {
        instance.open_file(&filepath).map_err(|e| e.message)
    } else {
        Err("Instance not found".to_string())
    }
}

#[tauri::command]
pub async fn nvim_get_buffer(id: String, manager: tauri::State<'_, NeovimManager>) -> Result<NeovimBuffer, String> {
    let instances = manager.get_instance(&id).map_err(|e| e.message)?;
    if let Some(instance) = instances.get(&id) {
        instance.get_current_buffer().map_err(|e| e.message)
    } else {
        Err("Instance not found".to_string())
    }
}

#[tauri::command]
pub async fn nvim_set_buffer_content(id: String, content: String, manager: tauri::State<'_, NeovimManager>) -> Result<(), String> {
    let instances = manager.get_instance(&id).map_err(|e| e.message)?;
    if let Some(instance) = instances.get(&id) {
        instance.set_buffer_content(&content).map_err(|e| e.message)
    } else {
        Err("Instance not found".to_string())
    }
}

#[tauri::command]
pub async fn nvim_execute_command(id: String, command: String, manager: tauri::State<'_, NeovimManager>) -> Result<String, String> {
    let instances = manager.get_instance(&id).map_err(|e| e.message)?;
    if let Some(instance) = instances.get(&id) {
        instance.execute_command(&command).map_err(|e| e.message)
    } else {
        Err("Instance not found".to_string())
    }
}

#[tauri::command]
pub async fn nvim_close_instance(id: String, manager: tauri::State<'_, NeovimManager>) -> Result<(), String> {
    manager.close_instance(&id).map_err(|e| e.message)
}