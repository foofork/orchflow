// LSP-specific types and data structures

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use tokio::sync::{mpsc, Mutex};
use std::sync::Arc;
use tokio::process::Child;
use lsp_types::Diagnostic;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageServerConfig {
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    pub file_extensions: Vec<String>,
    pub root_markers: Vec<String>,
    pub initialization_options: Option<Value>,
}

pub struct LanguageServerProcess {
    pub process: Child,
    pub config: LanguageServerConfig,
    pub initialized: bool,
    pub request_id: Arc<Mutex<i64>>,
    pub pending_requests: Arc<Mutex<HashMap<i64, mpsc::Sender<Result<Value, String>>>>>,
    pub stdin_tx: mpsc::Sender<String>,
}

impl LanguageServerProcess {
    pub fn new(
        process: Child,
        config: LanguageServerConfig,
        stdin_tx: mpsc::Sender<String>,
    ) -> Self {
        Self {
            process,
            config,
            initialized: false,
            request_id: Arc::new(Mutex::new(0i64)),
            pending_requests: Arc::new(Mutex::new(HashMap::new())),
            stdin_tx,
        }
    }
}

pub type DiagnosticsMap = Arc<Mutex<HashMap<String, Vec<Diagnostic>>>>;