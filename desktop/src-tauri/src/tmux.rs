use serde::{Deserialize, Serialize};
use std::process::Command;
use std::path::PathBuf;
use dirs::home_dir;

#[derive(Debug, Serialize, Deserialize)]
pub struct TmuxSession {
    pub name: String,
    pub windows: Vec<TmuxWindow>,
    pub created: String,
    pub attached: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TmuxWindow {
    pub id: String,
    pub name: String,
    pub panes: Vec<TmuxPane>,
    pub active: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TmuxPane {
    pub id: String,
    pub index: i32,
    pub width: i32,
    pub height: i32,
    pub command: String,
    pub active: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TmuxError {
    pub message: String,
}

pub struct TmuxManager {
    socket_path: PathBuf,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TmuxSplitResult {
    pub pane_id: String,
    pub window_id: String,
    pub session_name: String,
}

impl TmuxManager {
    pub fn new() -> Self {
        let mut socket_path = home_dir().unwrap_or_else(|| PathBuf::from("."));
        socket_path.push(".orchflow");
        socket_path.push("tmux.sock");
        
        // Ensure .orchflow directory exists
        if let Some(parent) = socket_path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        
        Self { socket_path }
    }
    
    fn tmux_cmd(&self) -> Command {
        let mut cmd = Command::new("tmux");
        cmd.arg("-S").arg(&self.socket_path);
        cmd
    }
    
    pub fn ensure_server(&self) -> Result<(), TmuxError> {
        // Check if server is running
        let output = self.tmux_cmd()
            .arg("has-session")
            .output()
            .map_err(|e| TmuxError { message: format!("Failed to check tmux server: {}", e) })?;
        
        if !output.status.success() {
            // Start new server
            self.tmux_cmd()
                .arg("new-session")
                .arg("-d")
                .arg("-s")
                .arg("orchflow-main")
                .output()
                .map_err(|e| TmuxError { message: format!("Failed to start tmux server: {}", e) })?;
        }
        
        Ok(())
    }
    
    pub fn create_session(&self, name: &str) -> Result<TmuxSession, TmuxError> {
        self.ensure_server()?;
        
        // Create new session
        let output = self.tmux_cmd()
            .arg("new-session")
            .arg("-d")
            .arg("-s")
            .arg(name)
            .arg("-P")
            .arg("-F")
            .arg("#{session_name}")
            .output()
            .map_err(|e| TmuxError { message: format!("Failed to create session: {}", e) })?;
        
        if !output.status.success() {
            return Err(TmuxError { 
                message: String::from_utf8_lossy(&output.stderr).to_string() 
            });
        }
        
        Ok(TmuxSession {
            name: name.to_string(),
            windows: vec![],
            created: chrono::Utc::now().to_rfc3339(),
            attached: false,
        })
    }
    
    pub fn list_sessions(&self) -> Result<Vec<TmuxSession>, TmuxError> {
        self.ensure_server()?;
        
        let output = self.tmux_cmd()
            .arg("list-sessions")
            .arg("-F")
            .arg("#{session_name}:#{session_created}:#{session_attached}")
            .output()
            .map_err(|e| TmuxError { message: format!("Failed to list sessions: {}", e) })?;
        
        if !output.status.success() {
            return Ok(vec![]); // No sessions
        }
        
        let sessions = String::from_utf8_lossy(&output.stdout)
            .lines()
            .filter_map(|line| {
                let parts: Vec<&str> = line.split(':').collect();
                if parts.len() >= 3 {
                    Some(TmuxSession {
                        name: parts[0].to_string(),
                        windows: vec![],
                        created: parts[1].to_string(),
                        attached: parts[2] == "1",
                    })
                } else {
                    None
                }
            })
            .collect();
        
        Ok(sessions)
    }
    
    pub fn split_pane(&self, target_pane: &str, horizontal: bool, percent: Option<u8>, command: Option<&str>) -> Result<TmuxSplitResult, TmuxError> {
        self.ensure_server()?;
        
        let mut cmd = self.tmux_cmd();
        cmd.arg("split-window");
        
        // Horizontal split (-h) creates left/right panes
        // Vertical split (default) creates top/bottom panes
        if horizontal {
            cmd.arg("-h");
        }
        
        // Target pane to split
        cmd.arg("-t").arg(target_pane);
        
        // Percentage size
        if let Some(p) = percent {
            cmd.arg("-p").arg(p.to_string());
        }
        
        // Print pane info
        cmd.arg("-P")
           .arg("-F").arg("#{pane_id}:#{window_id}:#{session_name}");
        
        // Command to run
        if let Some(command) = command {
            cmd.arg(command);
        }
        
        let output = cmd.output()
            .map_err(|e| TmuxError { message: format!("Failed to split pane: {}", e) })?;
        
        if !output.status.success() {
            return Err(TmuxError { 
                message: String::from_utf8_lossy(&output.stderr).to_string() 
            });
        }
        
        let result_info = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let parts: Vec<&str> = result_info.split(':').collect();
        
        if parts.len() < 3 {
            return Err(TmuxError { message: "Invalid split result format".to_string() });
        }
        
        Ok(TmuxSplitResult {
            pane_id: parts[0].to_string(),
            window_id: parts[1].to_string(),
            session_name: parts[2].to_string(),
        })
    }
    
    pub fn create_pane(&self, session: &str, command: Option<&str>) -> Result<TmuxPane, TmuxError> {
        self.ensure_server()?;
        
        let mut cmd = self.tmux_cmd();
        cmd.arg("split-window")
            .arg("-t").arg(session)
            .arg("-P")
            .arg("-F").arg("#{pane_id}:#{pane_index}:#{pane_width}:#{pane_height}");
        
        if let Some(command) = command {
            cmd.arg(command);
        }
        
        let output = cmd.output()
            .map_err(|e| TmuxError { message: format!("Failed to create pane: {}", e) })?;
        
        if !output.status.success() {
            return Err(TmuxError { 
                message: String::from_utf8_lossy(&output.stderr).to_string() 
            });
        }
        
        let pane_info = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let parts: Vec<&str> = pane_info.split(':').collect();
        
        if parts.len() < 4 {
            return Err(TmuxError { message: "Invalid pane info format".to_string() });
        }
        
        Ok(TmuxPane {
            id: parts[0].to_string(),
            index: parts[1].parse().unwrap_or(0),
            width: parts[2].parse().unwrap_or(80),
            height: parts[3].parse().unwrap_or(24),
            command: command.unwrap_or("").to_string(),
            active: true,
        })
    }
    
    pub fn send_keys(&self, pane_id: &str, keys: &str) -> Result<(), TmuxError> {
        let output = self.tmux_cmd()
            .arg("send-keys")
            .arg("-t").arg(pane_id)
            .arg(keys)
            .output()
            .map_err(|e| TmuxError { message: format!("Failed to send keys: {}", e) })?;
        
        if !output.status.success() {
            return Err(TmuxError { 
                message: String::from_utf8_lossy(&output.stderr).to_string() 
            });
        }
        
        Ok(())
    }
    
    pub fn capture_pane(&self, pane_id: &str, lines: Option<i32>) -> Result<String, TmuxError> {
        let mut cmd = self.tmux_cmd();
        cmd.arg("capture-pane")
            .arg("-t").arg(pane_id)
            .arg("-p");
        
        if let Some(n) = lines {
            cmd.arg("-S").arg(format!("-{}", n));
        }
        
        let output = cmd.output()
            .map_err(|e| TmuxError { message: format!("Failed to capture pane: {}", e) })?;
        
        if !output.status.success() {
            return Err(TmuxError { 
                message: String::from_utf8_lossy(&output.stderr).to_string() 
            });
        }
        
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }
    
    pub fn resize_pane(&self, pane_id: &str, width: i32, height: i32) -> Result<(), TmuxError> {
        // Set width
        self.tmux_cmd()
            .arg("resize-pane")
            .arg("-t").arg(pane_id)
            .arg("-x").arg(width.to_string())
            .output()
            .map_err(|e| TmuxError { message: format!("Failed to resize pane width: {}", e) })?;
        
        // Set height
        self.tmux_cmd()
            .arg("resize-pane")
            .arg("-t").arg(pane_id)
            .arg("-y").arg(height.to_string())
            .output()
            .map_err(|e| TmuxError { message: format!("Failed to resize pane height: {}", e) })?;
        
        Ok(())
    }
    
    pub fn kill_pane(&self, pane_id: &str) -> Result<(), TmuxError> {
        let output = self.tmux_cmd()
            .arg("kill-pane")
            .arg("-t").arg(pane_id)
            .output()
            .map_err(|e| TmuxError { message: format!("Failed to kill pane: {}", e) })?;
        
        if !output.status.success() {
            return Err(TmuxError { 
                message: String::from_utf8_lossy(&output.stderr).to_string() 
            });
        }
        
        Ok(())
    }
}

// Tauri commands
#[tauri::command]
pub async fn tmux_create_session(name: String) -> Result<TmuxSession, String> {
    let manager = TmuxManager::new();
    manager.create_session(&name).map_err(|e| e.message)
}

#[tauri::command]
pub async fn tmux_split_pane(
    target_pane: String, 
    horizontal: bool, 
    percent: Option<u8>, 
    command: Option<String>
) -> Result<TmuxSplitResult, String> {
    let manager = TmuxManager::new();
    manager.split_pane(&target_pane, horizontal, percent, command.as_deref())
        .map_err(|e| e.message)
}

#[tauri::command]
pub async fn tmux_list_sessions() -> Result<Vec<TmuxSession>, String> {
    let manager = TmuxManager::new();
    manager.list_sessions().map_err(|e| e.message)
}

#[tauri::command]
pub async fn tmux_create_pane(session: String, command: Option<String>) -> Result<TmuxPane, String> {
    let manager = TmuxManager::new();
    manager.create_pane(&session, command.as_deref()).map_err(|e| e.message)
}

#[tauri::command]
pub async fn tmux_send_keys(pane_id: String, keys: String) -> Result<(), String> {
    let manager = TmuxManager::new();
    manager.send_keys(&pane_id, &keys).map_err(|e| e.message)
}

#[tauri::command]
pub async fn tmux_capture_pane(pane_id: String, lines: Option<i32>) -> Result<String, String> {
    let manager = TmuxManager::new();
    manager.capture_pane(&pane_id, lines).map_err(|e| e.message)
}

#[tauri::command]
pub async fn tmux_resize_pane(pane_id: String, width: i32, height: i32) -> Result<(), String> {
    let manager = TmuxManager::new();
    manager.resize_pane(&pane_id, width, height).map_err(|e| e.message)
}

#[tauri::command]
pub async fn tmux_kill_pane(pane_id: String) -> Result<(), String> {
    let manager = TmuxManager::new();
    manager.kill_pane(&pane_id).map_err(|e| e.message)
}