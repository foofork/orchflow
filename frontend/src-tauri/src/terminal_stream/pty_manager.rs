// Clean PTY Manager Implementation
//
// Uses blocking thread pool for PTY operations to avoid Send/Sync issues

use portable_pty::{CommandBuilder, PtySize, native_pty_system};
use std::sync::Arc;
use tokio::sync::{mpsc, broadcast, Mutex};
use std::collections::HashMap;
use bytes::Bytes;
use std::io::{Read, Write};

#[derive(Clone)]
pub struct PtyHandle {
    pub id: String,
    pub output_tx: broadcast::Sender<Bytes>,
    input_tx: mpsc::UnboundedSender<Bytes>,
    control_tx: mpsc::UnboundedSender<ControlMsg>,
    process_info_tx: mpsc::UnboundedSender<ProcessInfoRequest>,
}

impl PtyHandle {
    /// Send input to the terminal
    pub async fn send_input(&self, data: Bytes) -> Result<(), String> {
        self.input_tx.send(data)
            .map_err(|_| "Terminal input channel closed".to_string())
    }
    
    /// Resize the terminal
    pub async fn resize(&self, rows: u16, cols: u16) -> Result<(), String> {
        let size = PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };
        
        self.control_tx.send(ControlMsg::Resize(size))
            .map_err(|_| "Terminal control channel closed".to_string())
    }
    
    /// Shutdown the terminal
    pub async fn shutdown(&self) -> Result<(), String> {
        self.control_tx.send(ControlMsg::Shutdown)
            .map_err(|_| "Terminal control channel closed".to_string())
    }
    
    /// Get process information
    pub async fn get_process_info(&self) -> Result<ProcessInfo, String> {
        let (tx, rx) = tokio::sync::oneshot::channel();
        self.process_info_tx.send(ProcessInfoRequest(tx))
            .map_err(|_| "Process info channel closed".to_string())?;
        rx.await.map_err(|_| "Failed to get process info".to_string())
    }
}

enum ControlMsg {
    Resize(PtySize),
    Shutdown,
}

struct ProcessInfoRequest(tokio::sync::oneshot::Sender<ProcessInfo>);

#[derive(Debug, Clone, serde::Serialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub command: String,
    pub status: ProcessStatus,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize)]
pub enum ProcessStatus {
    Running,
    Exited(i32),
    Crashed,
}

pub struct PtyManager {
    handles: Arc<Mutex<HashMap<String, broadcast::Sender<Bytes>>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            handles: Arc::new(Mutex::new(HashMap::new())),
        }
    }
    
    pub async fn create_pty(
        &self,
        terminal_id: String,
        shell: Option<String>,
        rows: u16,
        cols: u16,
    ) -> Result<PtyHandle, crate::error::OrchflowError> {
        let size = PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };
        
        // Create channels
        let (output_tx, _output_rx) = broadcast::channel(1024);
        let (input_tx, input_rx) = mpsc::unbounded_channel();
        let (control_tx, control_rx) = mpsc::unbounded_channel();
        let (process_info_tx, process_info_rx) = mpsc::unbounded_channel();
        
        // Store output sender
        self.handles.lock().await.insert(terminal_id.clone(), output_tx.clone());
        
        // Spawn PTY in blocking thread
        let terminal_id_clone = terminal_id.clone();
        let handles_clone = self.handles.clone();
        let output_tx_clone = output_tx.clone();
        
        tokio::task::spawn_blocking(move || {
            run_pty_blocking(
                terminal_id_clone,
                shell,
                size,
                output_tx_clone,
                input_rx,
                control_rx,
                process_info_rx,
                handles_clone,
            )
        });
        
        Ok(PtyHandle {
            id: terminal_id,
            output_tx,
            input_tx,
            control_tx,
            process_info_tx,
        })
    }
    
    pub async fn close_pty(&self, terminal_id: &str) -> Result<(), crate::error::OrchflowError> {
        self.handles.lock().await.remove(terminal_id);
        Ok(())
    }
}

fn run_pty_blocking(
    terminal_id: String,
    shell: Option<String>,
    size: PtySize,
    output_tx: broadcast::Sender<Bytes>,
    mut input_rx: mpsc::UnboundedReceiver<Bytes>,
    mut control_rx: mpsc::UnboundedReceiver<ControlMsg>,
    mut process_info_rx: mpsc::UnboundedReceiver<ProcessInfoRequest>,
    handles: Arc<Mutex<HashMap<String, broadcast::Sender<Bytes>>>>,
) {
    // Create PTY system
    let pty_system = native_pty_system();
    
    // Create PTY pair
    let pty_pair = match pty_system.openpty(size) {
        Ok(pair) => pair,
        Err(e) => {
            eprintln!("Failed to create PTY: {}", e);
            return;
        }
    };
    
    // Determine shell
    let shell_path = shell.unwrap_or_else(|| {
        if cfg!(windows) {
            "powershell.exe".to_string()
        } else {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
        }
    });
    
    // Build command
    let mut cmd = CommandBuilder::new(&shell_path);
    cmd.cwd(std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("/")));
    
    // Store shell info for process info
    let shell_name = std::path::Path::new(&shell_path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    
    // Spawn shell
    let mut child = match pty_pair.slave.spawn_command(cmd) {
        Ok(child) => child,
        Err(e) => {
            eprintln!("Failed to spawn shell: {}", e);
            return;
        }
    };
    
    // Get reader and writer
    let mut reader = match pty_pair.master.try_clone_reader() {
        Ok(r) => r,
        Err(e) => {
            eprintln!("Failed to clone reader: {}", e);
            return;
        }
    };
    
    let mut writer = match pty_pair.master.take_writer() {
        Ok(w) => w,
        Err(e) => {
            eprintln!("Failed to take writer: {}", e);
            return;
        }
    };
    
    // Note: We handle blocking with WouldBlock error instead of set_non_blocking
    
    let mut buf = vec![0u8; 4096];
    
    // Main event loop
    loop {
        // Check for input
        match input_rx.try_recv() {
            Ok(data) => {
                if writer.write_all(&data).is_err() {
                    break;
                }
                let _ = writer.flush();
            }
            Err(mpsc::error::TryRecvError::Empty) => {}
            Err(mpsc::error::TryRecvError::Disconnected) => break,
        }
        
        // Check for control messages
        match control_rx.try_recv() {
            Ok(ControlMsg::Resize(size)) => {
                let _ = pty_pair.master.resize(size);
            }
            Ok(ControlMsg::Shutdown) => break,
            Err(mpsc::error::TryRecvError::Empty) => {}
            Err(mpsc::error::TryRecvError::Disconnected) => break,
        }
        
        // Check for process info requests
        match process_info_rx.try_recv() {
            Ok(ProcessInfoRequest(tx)) => {
                let pid = child.process_id().unwrap_or(0);
                let info = ProcessInfo {
                    pid,
                    name: shell_name.clone(),
                    command: shell_path.clone(),
                    status: ProcessStatus::Running,
                };
                let _ = tx.send(info);
            }
            Err(mpsc::error::TryRecvError::Empty) => {}
            Err(mpsc::error::TryRecvError::Disconnected) => break,
        }
        
        // Read output
        match reader.read(&mut buf) {
            Ok(0) => break, // EOF
            Ok(n) => {
                let data = Bytes::copy_from_slice(&buf[..n]);
                if output_tx.send(data).is_err() {
                    // No receivers, but continue running
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                // No data available, sleep briefly
                std::thread::sleep(std::time::Duration::from_millis(10));
            }
            Err(_) => break,
        }
        
        // Check if child is still running
        match child.try_wait() {
            Ok(Some(_)) => break, // Process exited
            Ok(None) => {} // Still running
            Err(_) => break,
        }
    }
    
    // Cleanup
    let _ = child.kill();
    
    // Remove from handles
    let rt = tokio::runtime::Handle::try_current();
    if let Ok(handle) = rt {
        handle.spawn(async move {
            handles.lock().await.remove(&terminal_id);
        });
    }
}