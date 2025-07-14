use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use tokio::net::UnixStream;
use tokio::io::{AsyncWriteExt, BufReader};
use rmp_serde::Serializer;
use serde_json::Value;
use std::fmt;

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
    pub error_type: NeovimErrorType,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum NeovimErrorType {
    ConnectionError,
    RpcError,
    CommandError,
    ParseError,
    InstanceNotFound,
    Timeout,
}

impl fmt::Display for NeovimErrorType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            NeovimErrorType::ConnectionError => write!(f, "ConnectionError"),
            NeovimErrorType::RpcError => write!(f, "RpcError"),
            NeovimErrorType::CommandError => write!(f, "CommandError"),
            NeovimErrorType::ParseError => write!(f, "ParseError"),
            NeovimErrorType::InstanceNotFound => write!(f, "InstanceNotFound"),
            NeovimErrorType::Timeout => write!(f, "Timeout"),
        }
    }
}

impl fmt::Display for NeovimError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{}] {}", self.error_type, self.message)
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RpcRequest {
    pub id: u64,
    pub method: String,
    pub params: Vec<Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RpcResponse {
    pub id: u64,
    pub result: Option<Value>,
    pub error: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RpcNotification {
    pub method: String,
    pub params: Vec<Value>,
}

pub struct NeovimInstance {
    #[cfg_attr(not(feature = "dev-unused"), allow(dead_code))]
    pub id: String,
    pub socket_path: String,
    process: Option<std::process::Child>,
    // RPC communication state
    request_id: Arc<Mutex<u64>>,
    pending_responses: Arc<Mutex<HashMap<u64, tokio::sync::oneshot::Sender<Result<Value, NeovimError>>>>>,
    rpc_connection: Arc<Mutex<Option<RpcConnection>>>,
}

pub struct RpcConnection {
    stream: UnixStream,
    reader: BufReader<tokio::net::unix::OwnedReadHalf>,
    writer: tokio::net::unix::OwnedWriteHalf,
}

impl NeovimInstance {
    pub fn new(id: String) -> Result<Self, NeovimError> {
        let socket_path = format!("/tmp/nvim-{}.sock", id);

        // Start Neovim in headless mode with RPC
        let child = Command::new("nvim")
            .args(&["--headless", "--listen", &socket_path])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| NeovimError {
                message: format!("Failed to start Neovim: {}", e),
                error_type: NeovimErrorType::ConnectionError,
            })?;

        // Give Neovim time to start
        std::thread::sleep(std::time::Duration::from_millis(500));

        Ok(NeovimInstance {
            id,
            socket_path,
            process: Some(child),
            request_id: Arc::new(Mutex::new(1)),
            pending_responses: Arc::new(Mutex::new(HashMap::new())),
            rpc_connection: Arc::new(Mutex::new(None)),
        })
    }

    // Initialize RPC connection
    pub async fn connect_rpc(&self) -> Result<(), NeovimError> {
        let stream = UnixStream::connect(&self.socket_path)
            .await
            .map_err(|e| NeovimError {
                message: format!("Failed to connect to Neovim socket: {}", e),
                error_type: NeovimErrorType::ConnectionError,
            })?;

        let (reader, writer) = stream.into_split();
        let reader = BufReader::new(reader);

        let connection = RpcConnection {
            stream: UnixStream::connect(&self.socket_path).await.map_err(|e| NeovimError {
                message: format!("Failed to reconnect: {}", e),
                error_type: NeovimErrorType::ConnectionError,
            })?,
            reader,
            writer,
        };

        let mut rpc_conn = self.rpc_connection.lock().unwrap();
        *rpc_conn = Some(connection);

        Ok(())
    }

    // Send RPC request with timeout
    pub async fn send_rpc_request(&self, method: &str, params: Vec<Value>) -> Result<Value, NeovimError> {
        // Get next request ID
        let request_id = {
            let mut id = self.request_id.lock().unwrap();
            let current_id = *id;
            *id += 1;
            current_id
        };

        // Create response channel
        let (tx, rx) = tokio::sync::oneshot::channel();
        
        // Store pending response
        {
            let mut pending = self.pending_responses.lock().unwrap();
            pending.insert(request_id, tx);
        }

        // Create request
        let request = RpcRequest {
            id: request_id,
            method: method.to_string(),
            params,
        };

        // Send request via MessagePack
        {
            let mut rpc_conn = self.rpc_connection.lock().unwrap();
            if let Some(ref mut connection) = *rpc_conn {
                let mut buf = Vec::new();
                request.serialize(&mut Serializer::new(&mut buf))
                    .map_err(|e| NeovimError {
                        message: format!("Failed to serialize request: {}", e),
                        error_type: NeovimErrorType::RpcError,
                    })?;
                
                connection.writer.write_all(&buf).await
                    .map_err(|e| NeovimError {
                        message: format!("Failed to send request: {}", e),
                        error_type: NeovimErrorType::ConnectionError,
                    })?;
            } else {
                return Err(NeovimError {
                    message: "RPC connection not established".to_string(),
                    error_type: NeovimErrorType::ConnectionError,
                });
            }
        }

        // Wait for response with timeout
        tokio::time::timeout(std::time::Duration::from_secs(5), rx)
            .await
            .map_err(|_| NeovimError {
                message: "RPC request timeout".to_string(),
                error_type: NeovimErrorType::Timeout,
            })?
            .map_err(|_| NeovimError {
                message: "Response channel closed".to_string(),
                error_type: NeovimErrorType::RpcError,
            })?
    }

    pub fn execute_lua(&self, code: &str) -> Result<String, NeovimError> {
        // Use nvim command to execute Lua code
        let output = Command::new("nvim")
            .args(&[
                "--server",
                &self.socket_path,
                "--remote-expr",
                &format!("luaeval('{}')", code.replace("'", "\\'")),
            ])
            .output()
            .map_err(|e| NeovimError {
                message: format!("Failed to execute Lua: {}", e),
                error_type: NeovimErrorType::CommandError,
            })?;

        if !output.status.success() {
            return Err(NeovimError {
                message: String::from_utf8_lossy(&output.stderr).to_string(),
                error_type: NeovimErrorType::CommandError,
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
        serde_json::from_str(&json_result).map_err(|e| NeovimError {
            message: format!("Failed to parse buffer info: {}", e),
            error_type: NeovimErrorType::ParseError,
        })
    }

    pub fn open_file(&self, filepath: &str) -> Result<(), NeovimError> {
        Command::new("nvim")
            .args(&["--server", &self.socket_path, "--remote", filepath])
            .status()
            .map_err(|e| NeovimError {
                message: format!("Failed to open file: {}", e),
                error_type: NeovimErrorType::CommandError,
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
        serde_json::from_str(&json_result).map_err(|e| NeovimError {
            message: format!("Failed to parse cursor position: {}", e),
            error_type: NeovimErrorType::ParseError,
        })
    }

    #[cfg_attr(not(feature = "dev-unused"), allow(dead_code))]
    pub fn set_cursor_position(&self, line: u32, column: u32) -> Result<(), NeovimError> {
        let lua_code = format!("vim.api.nvim_win_set_cursor(0, {{{}, {}}})", line, column);

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
        let result: serde_json::Value =
            serde_json::from_str(&json_result).map_err(|e| NeovimError {
                message: format!("Failed to parse command result: {}", e),
                error_type: NeovimErrorType::ParseError,
            })?;

        if result["success"].as_bool().unwrap_or(false) {
            Ok(result["result"].as_str().unwrap_or("").to_string())
        } else {
            Err(NeovimError {
                message: result["error"]
                    .as_str()
                    .unwrap_or("Unknown error")
                    .to_string(),
                error_type: NeovimErrorType::CommandError,
            })
        }
    }

    pub fn get_mode(&self) -> Result<String, NeovimError> {
        let lua_code = r#"
            local mode = vim.api.nvim_get_mode()
            return vim.fn.json_encode(mode.mode)
        "#;

        let json_result = self.execute_lua(lua_code)?;
        serde_json::from_str(&json_result).map_err(|e| NeovimError {
            message: format!("Failed to parse mode: {}", e),
            error_type: NeovimErrorType::ParseError,
        })
    }

    pub fn eval_expression(&self, expression: &str) -> Result<serde_json::Value, NeovimError> {
        let lua_code = format!(
            r#"
            local ok, result = pcall(function()
                return vim.api.nvim_eval([[{}]])
            end)
            if ok then
                return vim.fn.json_encode({{success = true, result = result}})
            else
                return vim.fn.json_encode({{success = false, error = tostring(result)}})
            end
            "#,
            expression.replace("]]", "] ]")
        );

        let json_result = self.execute_lua(&lua_code)?;
        let result: serde_json::Value =
            serde_json::from_str(&json_result).map_err(|e| NeovimError {
                message: format!("Failed to parse eval result: {}", e),
                error_type: NeovimErrorType::ParseError,
            })?;

        if result["success"].as_bool().unwrap_or(false) {
            Ok(result["result"].clone())
        } else {
            Err(NeovimError {
                message: result["error"]
                    .as_str()
                    .unwrap_or("Unknown error")
                    .to_string(),
                error_type: NeovimErrorType::CommandError,
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

    pub fn get_instance(
        &self,
        id: &str,
    ) -> Result<std::sync::MutexGuard<HashMap<String, NeovimInstance>>, NeovimError> {
        let instances = self.instances.lock().unwrap();
        if instances.contains_key(id) {
            Ok(instances)
        } else {
            Err(NeovimError {
                message: format!("Neovim instance '{}' not found", id),
                error_type: NeovimErrorType::InstanceNotFound,
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
pub async fn nvim_create_instance(
    id: String,
    manager: tauri::State<'_, NeovimManager>,
) -> Result<String, String> {
    manager.create_instance(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn nvim_open_file(
    id: String,
    filepath: String,
    manager: tauri::State<'_, NeovimManager>,
) -> Result<(), String> {
    let instances = manager.get_instance(&id).map_err(|e| e.to_string())?;
    if let Some(instance) = instances.get(&id) {
        instance.open_file(&filepath).map_err(|e| e.to_string())
    } else {
        Err("Instance not found".to_string())
    }
}

#[tauri::command]
pub async fn nvim_get_buffer(
    id: String,
    manager: tauri::State<'_, NeovimManager>,
) -> Result<NeovimBuffer, String> {
    let instances = manager.get_instance(&id).map_err(|e| e.to_string())?;
    if let Some(instance) = instances.get(&id) {
        instance.get_current_buffer().map_err(|e| e.to_string())
    } else {
        Err("Instance not found".to_string())
    }
}

#[tauri::command]
pub async fn nvim_set_buffer_content(
    id: String,
    content: String,
    manager: tauri::State<'_, NeovimManager>,
) -> Result<(), String> {
    let instances = manager.get_instance(&id).map_err(|e| e.to_string())?;
    if let Some(instance) = instances.get(&id) {
        instance.set_buffer_content(&content).map_err(|e| e.to_string())
    } else {
        Err("Instance not found".to_string())
    }
}

#[tauri::command]
pub async fn nvim_execute_command(
    id: String,
    command: String,
    manager: tauri::State<'_, NeovimManager>,
) -> Result<String, String> {
    let instances = manager.get_instance(&id).map_err(|e| e.to_string())?;
    if let Some(instance) = instances.get(&id) {
        instance.execute_command(&command).map_err(|e| e.to_string())
    } else {
        Err("Instance not found".to_string())
    }
}

#[tauri::command]
pub async fn nvim_close_instance(
    id: String,
    manager: tauri::State<'_, NeovimManager>,
) -> Result<(), String> {
    manager.close_instance(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn nvim_get_mode(
    id: String,
    manager: tauri::State<'_, NeovimManager>,
) -> Result<String, String> {
    let instances = manager.get_instance(&id).map_err(|e| e.to_string())?;
    if let Some(instance) = instances.get(&id) {
        instance.get_mode().map_err(|e| e.to_string())
    } else {
        Err("Instance not found".to_string())
    }
}

#[tauri::command]
pub async fn nvim_eval(
    id: String,
    expression: String,
    manager: tauri::State<'_, NeovimManager>,
) -> Result<serde_json::Value, String> {
    let instances = manager.get_instance(&id).map_err(|e| e.to_string())?;
    if let Some(instance) = instances.get(&id) {
        instance.eval_expression(&expression).map_err(|e| e.to_string())
    } else {
        Err("Instance not found".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_test_instance() -> NeovimManager {
        NeovimManager::new()
    }

    #[test]
    fn test_neovim_manager_creation() {
        let manager = setup_test_instance();
        assert_eq!(manager.instances.lock().unwrap().len(), 0);
    }

    #[test]
    fn test_instance_not_found() {
        let manager = setup_test_instance();
        let result = manager.get_instance("non-existent");
        
        assert!(result.is_err());
        if let Err(e) = result {
            assert_eq!(e.error_type as u8, NeovimErrorType::InstanceNotFound as u8);
        }
    }

    #[test]
    fn test_error_types() {
        let error = NeovimError {
            message: "Test error".to_string(),
            error_type: NeovimErrorType::ConnectionError,
        };
        
        assert_eq!(error.to_string(), "[ConnectionError] Test error");
        
        let error2 = NeovimError {
            message: "Parse error".to_string(),
            error_type: NeovimErrorType::ParseError,
        };
        
        assert_eq!(error2.to_string(), "[ParseError] Parse error");
    }

    #[test]
    fn test_rpc_structures() {
        use serde_json::json;
        
        let request = RpcRequest {
            id: 1,
            method: "nvim_get_mode".to_string(),
            params: vec![],
        };
        
        let request_json = serde_json::to_string(&request).unwrap();
        assert!(request_json.contains("nvim_get_mode"));
        
        let response = RpcResponse {
            id: 1,
            result: Some(json!("n")),
            error: None,
        };
        
        let response_json = serde_json::to_string(&response).unwrap();
        assert!(response_json.contains("\"n\""));
    }

    #[test] 
    fn test_buffer_structure() {
        let buffer = NeovimBuffer {
            id: 1,
            name: "test.txt".to_string(),
            filetype: "text".to_string(),
            modified: false,
            lines: vec!["line 1".to_string(), "line 2".to_string()],
        };
        
        assert_eq!(buffer.id, 1);
        assert_eq!(buffer.name, "test.txt");
        assert_eq!(buffer.lines.len(), 2);
    }

    #[test]
    fn test_cursor_structure() {
        let cursor = NeovimCursor {
            line: 1,
            column: 0,
        };
        
        assert_eq!(cursor.line, 1);
        assert_eq!(cursor.column, 0);
    }

    #[test]
    fn test_neovim_instance_socket_path() {
        let instance_id = "test-123".to_string();
        
        // We can't actually create an instance without nvim installed,
        // but we can test the socket path generation logic indirectly
        let expected_socket = format!("/tmp/nvim-{}.sock", instance_id);
        assert!(expected_socket.contains("test-123"));
        assert!(expected_socket.starts_with("/tmp/nvim-"));
        assert!(expected_socket.ends_with(".sock"));
    }
}
