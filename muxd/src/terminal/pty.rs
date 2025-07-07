use crate::error::{MuxdError, Result};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::collections::HashMap;
use std::io::Read;
use std::sync::Arc;
use parking_lot::Mutex;
use tracing::{debug, error, info};

/// PTY wrapper for managing pseudo-terminal processes
pub struct Pty {
    master: Arc<Mutex<Box<dyn portable_pty::MasterPty + Send>>>,
    slave: Arc<Mutex<Box<dyn portable_pty::SlavePty + Send>>>,
    child: Arc<Mutex<Option<Box<dyn portable_pty::Child + Send + Sync>>>>,
    writer: Arc<Mutex<Box<dyn std::io::Write + Send>>>,
}

impl Pty {
    /// Create a new PTY
    pub fn new() -> Result<Self> {
        let pty_system = native_pty_system();
        let pty_pair = pty_system
            .openpty(PtySize::default())
            .map_err(|e| MuxdError::IoError(e.to_string()))?;
        
        let writer = pty_pair.master.take_writer()
            .map_err(|e| MuxdError::IoError(format!("Failed to take writer: {}", e)))?;
        
        Ok(Self {
            master: Arc::new(Mutex::new(pty_pair.master)),
            slave: Arc::new(Mutex::new(pty_pair.slave)),
            child: Arc::new(Mutex::new(None)),
            writer: Arc::new(Mutex::new(writer)),
        })
    }
    
    /// Spawn a process in the PTY
    pub fn spawn(
        &mut self,
        command: Option<&str>,
        working_dir: Option<&str>,
        env: HashMap<String, String>,
    ) -> Result<u32> {
        // Get default shell if no command specified
        let shell = command.map(String::from).unwrap_or_else(|| {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
        });
        
        let mut cmd = CommandBuilder::new(shell);
        
        // Set working directory
        if let Some(dir) = working_dir {
            cmd.cwd(dir);
        }
        
        // Set environment variables
        for (key, value) in env {
            cmd.env(key, value);
        }
        
        // Spawn the process
        let child = self.slave.lock().spawn_command(cmd)
            .map_err(|e| MuxdError::IoError(format!("Failed to spawn process: {}", e)))?;
        
        // Get PID
        let pid = child.process_id().ok_or_else(|| {
            MuxdError::InvalidState {
                reason: "Failed to get process ID".to_string(),
            }
        })?;
        
        debug!("Spawned process with PID {}", pid);
        
        // Store child process
        *self.child.lock() = Some(child);
        
        Ok(pid)
    }
    
    /// Write data to the PTY
    pub fn write(&self, data: &[u8]) -> Result<()> {
        use std::io::Write;
        self.writer.lock()
            .write_all(data)
            .map_err(|e| MuxdError::IoError(format!("Failed to write to PTY: {}", e)))?;
        Ok(())
    }
    
    /// Resize the PTY
    pub fn resize(&self, rows: u16, cols: u16) -> Result<()> {
        let size = PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };
        
        self.master.lock()
            .resize(size)
            .map_err(|e| MuxdError::IoError(format!("Failed to resize PTY: {}", e)))?;
        
        debug!("Resized PTY to {}x{}", cols, rows);
        Ok(())
    }
    
    /// Get the PID of the child process
    pub fn pid(&self) -> Option<u32> {
        self.child
            .lock()
            .as_ref()
            .and_then(|child| child.process_id())
    }
    
    /// Kill the child process
    pub fn kill(&mut self) -> Result<()> {
        if let Some(mut child) = self.child.lock().take() {
            child
                .kill()
                .map_err(|e| MuxdError::IoError(format!("Failed to kill process: {}", e)))?;
            
            info!("Killed PTY process");
        }
        Ok(())
    }
    
    /// Take the reader for the PTY output
    pub fn take_reader(&mut self) -> Result<Box<dyn Read + Send>> {
        self.master.lock()
            .try_clone_reader()
            .map_err(|e| MuxdError::IoError(format!("Failed to take reader: {}", e)))
    }
}

impl std::fmt::Debug for Pty {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Pty")
            .field("has_child", &self.child.lock().is_some())
            .finish()
    }
}

impl Drop for Pty {
    fn drop(&mut self) {
        // Try to kill the process on drop
        if let Err(e) = self.kill() {
            error!("Failed to kill PTY process on drop: {}", e);
        }
    }
}