// PTY (Pseudo-Terminal) Management V2
//
// Thread-safe implementation using channels for cross-thread communication

use portable_pty::{CommandBuilder, PtySize, native_pty_system};
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc, broadcast, oneshot};
use std::collections::HashMap;
use bytes::Bytes;
use std::thread;

#[derive(Clone)]
pub struct PtyHandle {
    pub id: String,
    pub reader_tx: broadcast::Sender<Bytes>,
    pub writer_tx: mpsc::UnboundedSender<Bytes>,
    pub resize_tx: mpsc::UnboundedSender<PtySize>,
    pub shutdown_tx: mpsc::Sender<()>,
}

/// Commands sent to PTY thread
enum PtyCommand {
    Create {
        terminal_id: String,
        shell: Option<String>,
        size: PtySize,
        response: oneshot::Sender<Result<PtyHandle, String>>,
    },
    Resize {
        terminal_id: String,
        size: PtySize,
        response: oneshot::Sender<Result<(), String>>,
    },
    Close {
        terminal_id: String,
        response: oneshot::Sender<Result<(), String>>,
    },
}

pub struct PtyManager {
    command_tx: mpsc::UnboundedSender<PtyCommand>,
    handles: Arc<RwLock<HashMap<String, PtyHandle>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        let (command_tx, mut command_rx) = mpsc::unbounded_channel::<PtyCommand>();
        let handles = Arc::new(RwLock::new(HashMap::new()));
        let handles_clone = handles.clone();
        
        // Spawn PTY management thread
        thread::spawn(move || {
            // Create runtime for this thread
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();
            
            rt.block_on(async move {
                let pty_system = native_pty_system();
                let mut active_ptys = HashMap::new();
                
                while let Some(command) = command_rx.recv().await {
                    match command {
                        PtyCommand::Create { terminal_id, shell, size, response } => {
                            let result = create_pty_internal(
                                &pty_system,
                                terminal_id.clone(),
                                shell,
                                size,
                                &handles_clone,
                            ).await;
                            
                            if let Ok(ref handle) = result {
                                active_ptys.insert(terminal_id, handle.clone());
                            }
                            
                            let _ = response.send(result);
                        }
                        PtyCommand::Resize { terminal_id, size, response } => {
                            if let Some(handle) = active_ptys.get(&terminal_id) {
                                let _ = handle.resize_tx.send(size).await;
                                let _ = response.send(Ok(()));
                            } else {
                                let _ = response.send(Err("Terminal not found".to_string()));
                            }
                        }
                        PtyCommand::Close { terminal_id, response } => {
                            if let Some(handle) = active_ptys.remove(&terminal_id) {
                                let _ = handle.shutdown_tx.send(()).await;
                                handles_clone.write().await.remove(&terminal_id);
                                let _ = response.send(Ok(()));
                            } else {
                                let _ = response.send(Err("Terminal not found".to_string()));
                            }
                        }
                    }
                }
            });
        });
        
        Self {
            command_tx,
            handles,
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
        
        let (response_tx, response_rx) = oneshot::channel();
        
        self.command_tx.send(PtyCommand::Create {
            terminal_id,
            shell,
            size,
            response: response_tx,
        }).map_err(|_| crate::error::OrchflowError::TerminalError {
            operation: "create_pty".to_string(),
            reason: "PTY manager thread died".to_string(),
        })?;
        
        response_rx.await
            .map_err(|_| crate::error::OrchflowError::TerminalError {
                operation: "create_pty".to_string(),
                reason: "Failed to receive PTY creation response".to_string(),
            })?
            .map_err(|e| crate::error::OrchflowError::TerminalError {
                operation: "create_pty".to_string(),
                reason: e,
            })
    }
    
    pub async fn resize_pty(
        &self,
        terminal_id: &str,
        rows: u16,
        cols: u16,
    ) -> Result<(), crate::error::OrchflowError> {
        let size = PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };
        
        let (response_tx, response_rx) = oneshot::channel();
        
        self.command_tx.send(PtyCommand::Resize {
            terminal_id: terminal_id.to_string(),
            size,
            response: response_tx,
        }).map_err(|_| crate::error::OrchflowError::TerminalError {
            operation: "resize_pty".to_string(),
            reason: "PTY manager thread died".to_string(),
        })?;
        
        response_rx.await
            .map_err(|_| crate::error::OrchflowError::TerminalError {
                operation: "resize_pty".to_string(),
                reason: "Failed to receive resize response".to_string(),
            })?
            .map_err(|e| crate::error::OrchflowError::TerminalError {
                operation: "resize_pty".to_string(),
                reason: e,
            })
    }
    
    pub async fn close_pty(
        &self,
        terminal_id: &str,
    ) -> Result<(), crate::error::OrchflowError> {
        let (response_tx, response_rx) = oneshot::channel();
        
        self.command_tx.send(PtyCommand::Close {
            terminal_id: terminal_id.to_string(),
            response: response_tx,
        }).map_err(|_| crate::error::OrchflowError::TerminalError {
            operation: "close_pty".to_string(),
            reason: "PTY manager thread died".to_string(),
        })?;
        
        response_rx.await
            .map_err(|_| crate::error::OrchflowError::TerminalError {
                operation: "close_pty".to_string(),
                reason: "Failed to receive close response".to_string(),
            })?
            .map_err(|e| crate::error::OrchflowError::TerminalError {
                operation: "close_pty".to_string(),
                reason: e,
            })
    }
}

async fn create_pty_internal(
    pty_system: &dyn portable_pty::PtySystem,
    terminal_id: String,
    shell: Option<String>,
    size: PtySize,
    handles: &Arc<RwLock<HashMap<String, PtyHandle>>>,
) -> Result<PtyHandle, String> {
    // Create PTY pair
    let pty_pair = pty_system.openpty(size)
        .map_err(|e| format!("Failed to create PTY: {}", e))?;
    
    // Determine shell
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
    let _child = pty_pair.slave.spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;
    
    // Create channels
    let (reader_tx, _reader_rx) = broadcast::channel::<Bytes>(1024);
    let (writer_tx, mut writer_rx) = mpsc::unbounded_channel::<Bytes>();
    let (resize_tx, mut resize_rx) = mpsc::unbounded_channel::<PtySize>();
    let (shutdown_tx, mut shutdown_rx) = mpsc::channel::<()>(1);
    
    // Get reader/writer
    let reader = pty_pair.master.try_clone_reader()
        .map_err(|e| format!("Failed to clone reader: {}", e))?;
    let writer = pty_pair.master.take_writer()
        .map_err(|e| format!("Failed to take writer: {}", e))?;
    
    // Spawn I/O tasks in current thread's runtime
    let reader_tx_clone = reader_tx.clone();
    tokio::spawn(async move {
        let mut reader = reader;
        let mut writer = writer;
        
        // Reader task
        let reader_handle = tokio::spawn(async move {
            use std::io::Read;
            let mut buf = vec![0u8; 4096];
            
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let data = Bytes::copy_from_slice(&buf[..n]);
                        let _ = reader_tx_clone.send(data);
                    }
                    Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
                    }
                    Err(_) => break,
                }
            }
        });
        
        // Writer/Control loop
        loop {
            tokio::select! {
                Some(data) = writer_rx.recv() => {
                    use std::io::Write;
                    let _ = writer.write_all(&data);
                    let _ = writer.flush();
                }
                Some(size) = resize_rx.recv() => {
                    let _ = pty_pair.master.resize(size);
                }
                _ = shutdown_rx.recv() => {
                    reader_handle.abort();
                    break;
                }
            }
        }
    });
    
    let handle = PtyHandle {
        id: terminal_id.clone(),
        reader_tx,
        writer_tx,
        resize_tx,
        shutdown_tx,
    };
    
    handles.write().await.insert(terminal_id, handle.clone());
    
    Ok(handle)
}