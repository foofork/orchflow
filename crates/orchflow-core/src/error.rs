use thiserror::Error;

#[derive(Error, Debug)]
pub enum OrchflowError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid operation: {0}")]
    InvalidOperation(String),

    #[error("Backend error: {0}")]
    Backend(String),

    #[error("Plugin error: {0}")]
    Plugin(String),

    #[error("State error: {0}")]
    State(String),

    #[error("General error: {0}")]
    General(String),
}

impl From<orchflow_mux::backend::MuxError> for OrchflowError {
    fn from(err: orchflow_mux::backend::MuxError) -> Self {
        OrchflowError::Backend(err.to_string())
    }
}

pub type Result<T> = std::result::Result<T, OrchflowError>;
