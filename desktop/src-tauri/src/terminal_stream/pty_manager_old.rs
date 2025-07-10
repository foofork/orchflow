// PTY (Pseudo-Terminal) Management
//
// Handles creation and management of pseudo-terminals for
// cross-platform terminal emulation.

use portable_pty::{CommandBuilder, PtySize, native_pty_system, PtySystem};
use std::sync::{Arc, Mutex};
use tokio::sync::{RwLock, mpsc, broadcast};
use std::collections::HashMap;
use bytes::Bytes;

#[derive(Clone)]
pub struct PtyHandle {
    pub id: String,
    pub reader_tx: broadcast::Sender<Bytes>,
    pub writer_tx: mpsc::UnboundedSender<Bytes>,
    pub resize_tx: mpsc::UnboundedSender<PtySize>,
}

struct PtyInstance {
    master: Box<dyn portable_pty::MasterPty>,
    _child: Box<dyn portable_pty::Child>,
    reader_task: Option<tokio::task::JoinHandle<()>>,
    writer_task: Option<tokio::task::JoinHandle<()>>,
}

pub struct PtyManager {
    ptys: Arc<RwLock<HashMap<String, PtyInstance>>>,
    pty_system: Box<dyn PtySystem>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            ptys: Arc::new(RwLock::new(HashMap::new())),
            pty_system: native_pty_system(),
        }
    }
    
    pub async fn create_pty(
        &self,
        terminal_id: String,
        shell: Option<String>,
        rows: u16,
        cols: u16,
    ) -> Result<PtyHandle, crate::error::OrchflowError> {
        let pty_size = PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };
        
        // Create PTY pair
        let pty_pair = self.pty_system.openpty(pty_size)
            .map_err(|e| crate::error::OrchflowError::TerminalError {
                operation: "create_pty".to_string(),
                reason: e.to_string(),
            })?;
        
        // Determine shell to use
        let shell_path = shell.unwrap_or_else(|| {
            if cfg!(windows) {
                "powershell.exe".to_string()
            } else {
                std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
            }
        });
        
        // Build command
        let mut cmd = CommandBuilder::new(shell_path);
        cmd.cwd(std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("/")));
        
        // Spawn shell
        let child = pty_pair.slave.spawn_command(cmd)
            .map_err(|e| crate::error::OrchflowError::TerminalError {
                operation: "spawn_shell".to_string(),
                reason: e.to_string(),
            })?;
        
        // Create channels for I/O
        let (reader_tx, _reader_rx) = broadcast::channel::<Bytes>(1024);
        let (writer_tx, mut writer_rx) = mpsc::unbounded_channel::<Bytes>();
        let (resize_tx, mut resize_rx) = mpsc::unbounded_channel::<PtySize>();
        
        // Get reader/writer from master
        let mut reader = pty_pair.master.try_clone_reader()
            .map_err(|e| crate::error::OrchflowError::TerminalError {
                operation: "clone_reader".to_string(),
                reason: e.to_string(),
            })?;
        
        let mut writer = pty_pair.master.take_writer()
            .map_err(|e| crate::error::OrchflowError::TerminalError {
                operation: "take_writer".to_string(),
                reason: e.to_string(),
            })?;
        
        // Spawn reader task
        let reader_tx_clone = reader_tx.clone();
        let reader_task = tokio::spawn(async move {
            use std::io::Read;
            let mut buf = vec![0u8; 4096];
            
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break, // EOF
                    Ok(n) => {
                        let data = Bytes::copy_from_slice(&buf[..n]);
                        // Broadcast sender returns error if no receivers, which is ok
                        let _ = reader_tx_clone.send(data);
                    }
                    Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
                    }
                    Err(_) => break,
                }
            }
        });
        
        // Spawn writer task
        let writer_task = tokio::spawn(async move {
            use std::io::Write;
            
            while let Some(data) = writer_rx.recv().await {
                if writer.write_all(&data).is_err() {
                    break;
                }
                if writer.flush().is_err() {
                    break;
                }
            }
        });
        
        // Spawn resize task
        let master_clone = pty_pair.master.try_clone()
            .map_err(|e| crate::error::OrchflowError::TerminalError {
                operation: "clone_master".to_string(),
                reason: e.to_string(),
            })?;
        
        tokio::spawn(async move {
            let mut master = master_clone;
            while let Some(size) = resize_rx.recv().await {
                let _ = master.resize(size);
            }
        });
        
        // Store PTY instance
        let instance = PtyInstance {
            master: pty_pair.master,
            _child: child,
            reader_task: Some(reader_task),
            writer_task: Some(writer_task),
        };
        
        self.ptys.write().await.insert(terminal_id.clone(), instance);
        
        Ok(PtyHandle {
            id: terminal_id,
            reader_tx,
            writer_tx,
            resize_tx,
        })
    }
    
    pub async fn resize_pty(
        &self,
        terminal_id: &str,
        rows: u16,
        cols: u16,
    ) -> Result<(), crate::error::OrchflowError> {
        let ptys = self.ptys.read().await;
        if let Some(pty) = ptys.get(terminal_id) {
            let size = PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            };
            
            pty.master.resize(size)
                .map_err(|e| crate::error::OrchflowError::TerminalError {
                    operation: "resize_pty".to_string(),
                    reason: e.to_string(),
                })?;
        }
        
        Ok(())
    }
    
    pub async fn close_pty(
        &self,
        terminal_id: &str,
    ) -> Result<(), crate::error::OrchflowError> {
        if let Some(mut pty) = self.ptys.write().await.remove(terminal_id) {
            // Cancel tasks
            if let Some(task) = pty.reader_task.take() {
                task.abort();
            }
            if let Some(task) = pty.writer_task.take() {
                task.abort();
            }
        }
        
        Ok(())
    }
}