use crate::error::{MuxdError, Result};
use crate::protocol::{PaneId, PaneType};
use crate::protocol::types::PaneSize;
use crate::terminal::pty::Pty;
use bytes::Bytes;
use chrono::{DateTime, Utc};
use parking_lot::RwLock;
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{debug, error, info};

/// A terminal pane that manages a PTY process
#[derive(Debug)]
pub struct Pane {
    pub id: PaneId,
    pub session_id: String,
    pub pane_type: PaneType,
    pub created_at: DateTime<Utc>,
    
    // PTY management
    pty: Arc<RwLock<Option<Pty>>>,
    
    // Output handling
    output_tx: mpsc::UnboundedSender<Bytes>,
    output_buffer: Arc<RwLock<Vec<u8>>>,
    
    // State
    size: Arc<RwLock<PaneSize>>,
    title: Arc<RwLock<Option<String>>>,
    working_dir: Arc<RwLock<Option<String>>>,
    exit_code: Arc<RwLock<Option<i32>>>,
}

impl Pane {
    /// Create a new pane
    pub fn new(
        session_id: String,
        pane_type: PaneType,
        output_tx: mpsc::UnboundedSender<Bytes>,
    ) -> Self {
        Self {
            id: PaneId::new(),
            session_id,
            pane_type,
            created_at: Utc::now(),
            pty: Arc::new(RwLock::new(None)),
            output_tx,
            output_buffer: Arc::new(RwLock::new(Vec::with_capacity(1024 * 64))), // 64KB buffer
            size: Arc::new(RwLock::new(PaneSize::default())),
            title: Arc::new(RwLock::new(None)),
            working_dir: Arc::new(RwLock::new(None)),
            exit_code: Arc::new(RwLock::new(None)),
        }
    }
    
    /// Start the pane with a command
    pub async fn start(
        &self,
        command: Option<String>,
        working_dir: Option<String>,
        env: std::collections::HashMap<String, String>,
        size: Option<PaneSize>,
    ) -> Result<u32> {
        let size = size.unwrap_or_default();
        *self.size.write() = size;
        
        if let Some(dir) = &working_dir {
            *self.working_dir.write() = Some(dir.clone());
        }
        
        // Create PTY
        let mut pty = Pty::new()?;
        
        // Set size
        pty.resize(size.rows, size.cols)?;
        
        // Start process
        let pid = pty.spawn(command.as_deref(), working_dir.as_deref(), env)?;
        
        info!("Started pane {} with PID {}", self.id, pid);
        
        // Start output reader
        self.start_output_reader(pty.take_reader()?);
        
        // Store PTY
        *self.pty.write() = Some(pty);
        
        Ok(pid)
    }
    
    /// Write data to the pane
    pub fn write(&self, data: &[u8]) -> Result<()> {
        let pty_lock = self.pty.read();
        let pty = pty_lock.as_ref().ok_or_else(|| MuxdError::InvalidState {
            reason: "Pane not started".to_string(),
        })?;
        
        pty.write(data)?;
        Ok(())
    }
    
    /// Resize the pane
    pub fn resize(&self, rows: u16, cols: u16) -> Result<()> {
        let new_size = PaneSize { rows, cols };
        
        let pty_lock = self.pty.read();
        if let Some(pty) = pty_lock.as_ref() {
            pty.resize(rows, cols)?;
        }
        
        *self.size.write() = new_size;
        Ok(())
    }
    
    /// Read buffered output
    pub fn read_output(&self, num_lines: usize) -> String {
        let buffer = self.output_buffer.read();
        
        // Convert buffer to string, handling UTF-8 errors gracefully
        let output = String::from_utf8_lossy(&buffer);
        
        // Return last N lines
        let lines: Vec<&str> = output.lines().collect();
        let start = lines.len().saturating_sub(num_lines);
        
        lines[start..].join("\n")
    }
    
    /// Get current size
    pub fn size(&self) -> PaneSize {
        *self.size.read()
    }
    
    /// Get PID if running
    pub fn pid(&self) -> Option<u32> {
        self.pty.read().as_ref().and_then(|pty| pty.pid())
    }
    
    /// Check if pane is alive
    pub fn is_alive(&self) -> bool {
        self.exit_code.read().is_none()
    }
    
    /// Kill the pane
    pub fn kill(&self) -> Result<()> {
        let mut pty_lock = self.pty.write();
        if let Some(mut pty) = pty_lock.take() {
            pty.kill()?;
        }
        Ok(())
    }
    
    /// Start reading output from PTY
    fn start_output_reader(&self, mut reader: Box<dyn std::io::Read + Send>) {
        let output_tx = self.output_tx.clone();
        let output_buffer = self.output_buffer.clone();
        let exit_code = self.exit_code.clone();
        let pane_id = self.id.clone();
        
        // Use blocking task for reading from PTY
        tokio::task::spawn_blocking(move || {
            let mut buf = vec![0u8; 4096];
            
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => {
                        // EOF - process exited
                        info!("Pane {} process exited", pane_id);
                        *exit_code.write() = Some(0);
                        break;
                    }
                    Ok(n) => {
                        let data = &buf[..n];
                        
                        // Add to buffer
                        {
                            let mut buffer = output_buffer.write();
                            buffer.extend_from_slice(data);
                            
                            // Limit buffer size (keep last 64KB)
                            if buffer.len() > 64 * 1024 {
                                let excess = buffer.len() - 64 * 1024;
                                buffer.drain(..excess);
                            }
                        }
                        
                        // Send to output channel
                        let _ = output_tx.send(Bytes::copy_from_slice(data));
                    }
                    Err(e) => {
                        error!("Error reading from pane {}: {}", pane_id, e);
                        *exit_code.write() = Some(1);
                        break;
                    }
                }
            }
        });
    }
}