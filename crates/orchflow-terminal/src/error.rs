use thiserror::Error;

#[derive(Error, Debug)]
pub enum TerminalError {
    #[error("PTY creation failed: {0}")]
    PtyCreation(String),
    
    #[error("Terminal not found: {0}")]
    TerminalNotFound(String),
    
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Channel error: {0}")]
    Channel(String),
    
    #[error("Terminal already exists: {0}")]
    TerminalExists(String),
    
    #[error("Process exited with code: {0}")]
    ProcessExited(i32),
    
    #[error("Operation timed out")]
    Timeout,
    
    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),
}