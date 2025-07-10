use crate::error::{MuxdError, Result};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::PathBuf;
use std::process;
use tracing::{error, info};

/// Daemon management functionality
pub struct Daemon {
    pid_file: PathBuf,
}

impl Daemon {
    /// Create a new daemon manager
    pub fn new(data_dir: &str) -> Result<Self> {
        let mut pid_file = PathBuf::from(data_dir);
        pid_file.push("muxd.pid");
        
        // Ensure data directory exists
        if let Some(parent) = pid_file.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| MuxdError::IoError(format!("Failed to create data directory: {}", e)))?;
        }
        
        Ok(Self { pid_file })
    }
    
    /// Check if daemon is already running
    pub fn is_running(&self) -> bool {
        if let Ok(pid) = self.read_pid() {
            // Check if process is actually running
            #[cfg(unix)]
            {
                use nix::sys::signal;
                use nix::unistd::Pid;
                
                // Send signal 0 to check if process exists
                match signal::kill(Pid::from_raw(pid as i32), None) {
                    Ok(()) => true,
                    Err(_) => {
                        // Process doesn't exist, clean up stale PID file
                        let _ = self.remove_pid_file();
                        false
                    }
                }
            }
            
            #[cfg(not(unix))]
            {
                // On non-Unix platforms, just check if PID file exists
                // This is less reliable but better than nothing
                true
            }
        } else {
            false
        }
    }
    
    /// Get the PID of the running daemon
    pub fn get_pid(&self) -> Option<u32> {
        if self.is_running() {
            self.read_pid().ok()
        } else {
            None
        }
    }
    
    /// Write current process PID to file
    pub fn write_pid(&self) -> Result<()> {
        let pid = process::id();
        let mut file = File::create(&self.pid_file)
            .map_err(|e| MuxdError::IoError(format!("Failed to create PID file: {}", e)))?;
        
        write!(file, "{}", pid)
            .map_err(|e| MuxdError::IoError(format!("Failed to write PID: {}", e)))?;
        
        info!("Written PID {} to {:?}", pid, self.pid_file);
        Ok(())
    }
    
    /// Read PID from file
    fn read_pid(&self) -> Result<u32> {
        let mut file = File::open(&self.pid_file)
            .map_err(|e| MuxdError::IoError(format!("Failed to open PID file: {}", e)))?;
        
        let mut contents = String::new();
        file.read_to_string(&mut contents)
            .map_err(|e| MuxdError::IoError(format!("Failed to read PID file: {}", e)))?;
        
        contents.trim().parse::<u32>()
            .map_err(|e| MuxdError::IoError(format!("Invalid PID in file: {}", e)))
    }
    
    /// Remove PID file
    pub fn remove_pid_file(&self) -> Result<()> {
        if self.pid_file.exists() {
            fs::remove_file(&self.pid_file)
                .map_err(|e| MuxdError::IoError(format!("Failed to remove PID file: {}", e)))?;
            info!("Removed PID file {:?}", self.pid_file);
        }
        Ok(())
    }
    
    /// Daemonize the current process
    #[cfg(unix)]
    pub fn daemonize(&self) -> Result<()> {
        use daemonize::Daemonize;
        
        let pid_file_path = self.pid_file.clone();
        
        let daemonize = Daemonize::new()
            .pid_file(pid_file_path)
            .chown_pid_file(true)
            .working_directory(".")
            .umask(0o027);
        
        match daemonize.start() {
            Ok(_) => {
                info!("Successfully daemonized process");
                Ok(())
            }
            Err(e) => {
                error!("Failed to daemonize: {}", e);
                Err(MuxdError::IoError(format!("Daemonization failed: {}", e)))
            }
        }
    }
    
    /// Daemonize placeholder for non-Unix platforms
    #[cfg(not(unix))]
    pub fn daemonize(&self) -> Result<()> {
        Err(MuxdError::InvalidState {
            reason: "Daemonization is only supported on Unix platforms".to_string(),
        })
    }
    
    /// Send stop signal to running daemon
    #[cfg(unix)]
    pub fn stop(&self) -> Result<()> {
        if let Some(pid) = self.get_pid() {
            use nix::sys::signal::{self, Signal};
            use nix::unistd::Pid;
            
            // Send SIGTERM to gracefully shutdown
            signal::kill(Pid::from_raw(pid as i32), Signal::SIGTERM)
                .map_err(|e| MuxdError::IoError(format!("Failed to send stop signal: {}", e)))?;
            
            info!("Sent SIGTERM to process {}", pid);
            
            // Wait a bit for the process to exit
            std::thread::sleep(std::time::Duration::from_millis(500));
            
            // Check if it's still running
            if self.is_running() {
                // Send SIGKILL if still running
                signal::kill(Pid::from_raw(pid as i32), Signal::SIGKILL)
                    .map_err(|e| MuxdError::IoError(format!("Failed to send kill signal: {}", e)))?;
                
                info!("Sent SIGKILL to process {}", pid);
            }
            
            // Clean up PID file
            self.remove_pid_file()?;
            
            Ok(())
        } else {
            Err(MuxdError::InvalidState {
                reason: "No daemon is running".to_string(),
            })
        }
    }
    
    /// Stop daemon placeholder for non-Unix platforms
    #[cfg(not(unix))]
    pub fn stop(&self) -> Result<()> {
        Err(MuxdError::InvalidState {
            reason: "Daemon stop is only supported on Unix platforms".to_string(),
        })
    }
}

impl Drop for Daemon {
    fn drop(&mut self) {
        // Clean up PID file on drop if this process owns it
        if let Ok(pid) = self.read_pid() {
            if pid == process::id() {
                let _ = self.remove_pid_file();
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[test]
    fn test_daemon_creation() {
        let temp_dir = TempDir::new().unwrap();
        let daemon = Daemon::new(temp_dir.path().to_str().unwrap()).unwrap();
        
        assert!(!daemon.is_running());
        assert!(daemon.get_pid().is_none());
    }
    
    #[test]
    fn test_pid_file_operations() {
        let temp_dir = TempDir::new().unwrap();
        let daemon = Daemon::new(temp_dir.path().to_str().unwrap()).unwrap();
        
        // Write PID
        daemon.write_pid().unwrap();
        
        // Check PID
        let pid = daemon.get_pid().unwrap();
        assert_eq!(pid, process::id());
        
        // Remove PID file
        daemon.remove_pid_file().unwrap();
        assert!(daemon.get_pid().is_none());
    }
}