// Example implementation of state synchronization protocol
// Demonstrates differential updates and efficient sync mechanisms

use std::sync::Arc;
use std::collections::{HashMap, VecDeque};
use tokio::sync::{RwLock, broadcast, mpsc};
use serde::{Serialize, Deserialize};
use serde_diff::{Diff, SerdeDiff};
use bincode;
use flate2::{Compression, write::GzEncoder};
use std::io::Write;

// ===== Core State Types =====

#[derive(Debug, Clone, Serialize, Deserialize, SerdeDiff, PartialEq)]
pub struct ApplicationState {
    pub sessions: HashMap<String, SessionState>,
    pub panes: HashMap<String, PaneState>,
    pub terminals: HashMap<String, TerminalState>,
    pub files: FileTreeState,
    pub settings: HashMap<String, String>,
    pub version: u64,
    pub checksum: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, SerdeDiff, PartialEq)]
pub struct SessionState {
    pub id: String,
    pub name: String,
    pub layout: Option<GridLayout>,
    pub active_pane: Option<String>,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, SerdeDiff, PartialEq)]
pub struct PaneState {
    pub id: String,
    pub session_id: String,
    pub pane_type: PaneType,
    pub backend_id: Option<String>,
    pub title: String,
    pub is_focused: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, SerdeDiff, PartialEq)]
pub struct TerminalState {
    pub id: String,
    pub pane_id: String,
    pub rows: u16,
    pub cols: u16,
    pub cursor_x: u16,
    pub cursor_y: u16,
    pub scrollback_lines: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, SerdeDiff, PartialEq)]
pub struct FileTreeState {
    pub root: String,
    pub expanded_dirs: Vec<String>,
    pub selected_files: Vec<String>,
    pub file_count: usize,
}

// ===== Sync Protocol Messages =====

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum SyncMessage {
    // Client -> Server
    Subscribe { client_id: String, last_version: u64 },
    RequestFullSync { client_id: String },
    ApplyChanges { changes: ClientChanges },
    Acknowledge { version: u64 },
    
    // Server -> Client
    StateUpdate { update: StateUpdate },
    FullState { state: CompressedState },
    InvalidVersion { client_version: u64, server_version: u64 },
    Error { code: String, message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateUpdate {
    pub from_version: u64,
    pub to_version: u64,
    pub diff: StateDiff,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateDiff {
    pub changes: Vec<u8>, // Serialized diff
    pub compressed: bool,
    pub size_bytes: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientChanges {
    pub client_id: String,
    pub base_version: u64,
    pub operations: Vec<StateOperation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "op", content = "data")]
pub enum StateOperation {
    CreateSession { name: String },
    DeleteSession { id: String },
    UpdateSession { id: String, updates: SessionUpdate },
    CreatePane { session_id: String, pane_type: PaneType },
    DeletePane { id: String },
    UpdatePane { id: String, updates: PaneUpdate },
    UpdateTerminal { id: String, updates: TerminalUpdate },
    UpdateFileTree { updates: FileTreeUpdate },
    SetSetting { key: String, value: String },
}

// ===== State Sync Manager =====

pub struct StateSyncManager {
    current_state: Arc<RwLock<ApplicationState>>,
    state_snapshots: Arc<RwLock<VecDeque<(u64, ApplicationState)>>>,
    max_snapshots: usize,
    snapshot_interval: u64,
    clients: Arc<RwLock<HashMap<String, ClientConnection>>>,
    update_tx: broadcast::Sender<StateUpdate>,
}

struct ClientConnection {
    id: String,
    last_acknowledged_version: u64,
    pending_updates: VecDeque<StateUpdate>,
    subscribed_at: chrono::DateTime<chrono::Utc>,
}

impl StateSyncManager {
    pub fn new(max_snapshots: usize, snapshot_interval: u64) -> Self {
        let (update_tx, _) = broadcast::channel(1024);
        
        Self {
            current_state: Arc::new(RwLock::new(ApplicationState::default())),
            state_snapshots: Arc::new(RwLock::new(VecDeque::with_capacity(max_snapshots))),
            max_snapshots,
            snapshot_interval,
            clients: Arc::new(RwLock::new(HashMap::new())),
            update_tx,
        }
    }
    
    /// Compute differential update between versions
    pub async fn compute_diff(&self, from_version: u64) -> Result<StateDiff, SyncError> {
        let current = self.current_state.read().await;
        
        // Try to find snapshot
        let snapshots = self.state_snapshots.read().await;
        let from_state = snapshots
            .iter()
            .find(|(v, _)| *v == from_version)
            .map(|(_, s)| s)
            .ok_or(SyncError::VersionNotFound(from_version))?;
        
        // Compute diff
        let diff = from_state.diff(&*current)
            .map_err(|e| SyncError::DiffError(e.to_string()))?;
        
        // Serialize diff
        let serialized = bincode::serialize(&diff)
            .map_err(|e| SyncError::SerializationError(e.to_string()))?;
        
        // Compress if large
        let (changes, compressed) = if serialized.len() > 1024 {
            let compressed = compress_data(&serialized)?;
            (compressed, true)
        } else {
            (serialized, false)
        };
        
        Ok(StateDiff {
            changes,
            compressed,
            size_bytes: changes.len(),
        })
    }
    
    /// Apply client changes with conflict resolution
    pub async fn apply_client_changes(&self, changes: ClientChanges) -> Result<u64, SyncError> {
        let mut state = self.current_state.write().await;
        
        // Validate base version
        if changes.base_version != state.version {
            return Err(SyncError::VersionMismatch {
                client: changes.base_version,
                server: state.version,
            });
        }
        
        // Apply operations
        for operation in changes.operations {
            apply_state_operation(&mut state, operation)?;
        }
        
        // Update version and checksum
        state.version += 1;
        state.checksum = calculate_checksum(&state);
        
        // Take snapshot if needed
        if state.version % self.snapshot_interval == 0 {
            self.take_snapshot(state.clone()).await?;
        }
        
        // Broadcast update
        let update = StateUpdate {
            from_version: changes.base_version,
            to_version: state.version,
            diff: self.compute_diff(changes.base_version).await?,
            timestamp: chrono::Utc::now(),
        };
        
        let _ = self.update_tx.send(update);
        
        Ok(state.version)
    }
    
    /// Take a state snapshot
    async fn take_snapshot(&self, state: ApplicationState) -> Result<(), SyncError> {
        let mut snapshots = self.state_snapshots.write().await;
        
        // Add new snapshot
        snapshots.push_back((state.version, state));
        
        // Remove old snapshots
        while snapshots.len() > self.max_snapshots {
            snapshots.pop_front();
        }
        
        Ok(())
    }
    
    /// Subscribe a client for updates
    pub async fn subscribe_client(&self, client_id: String, last_version: u64) -> Result<(), SyncError> {
        let mut clients = self.clients.write().await;
        
        clients.insert(client_id.clone(), ClientConnection {
            id: client_id,
            last_acknowledged_version: last_version,
            pending_updates: VecDeque::new(),
            subscribed_at: chrono::Utc::now(),
        });
        
        Ok(())
    }
    
    /// Get pending updates for a client
    pub async fn get_client_updates(&self, client_id: &str) -> Result<Vec<StateUpdate>, SyncError> {
        let mut clients = self.clients.write().await;
        
        let client = clients.get_mut(client_id)
            .ok_or(SyncError::ClientNotFound(client_id.to_string()))?;
        
        let updates: Vec<_> = client.pending_updates.drain(..).collect();
        Ok(updates)
    }
}

// ===== Conflict Resolution =====

fn apply_state_operation(state: &mut ApplicationState, op: StateOperation) -> Result<(), SyncError> {
    match op {
        StateOperation::CreateSession { name } => {
            let id = generate_id();
            state.sessions.insert(id.clone(), SessionState {
                id: id.clone(),
                name,
                layout: None,
                active_pane: None,
                metadata: HashMap::new(),
            });
        }
        
        StateOperation::DeleteSession { id } => {
            state.sessions.remove(&id)
                .ok_or(SyncError::ResourceNotFound("session", id))?;
        }
        
        StateOperation::UpdateSession { id, updates } => {
            let session = state.sessions.get_mut(&id)
                .ok_or(SyncError::ResourceNotFound("session", id))?;
            apply_session_updates(session, updates);
        }
        
        StateOperation::CreatePane { session_id, pane_type } => {
            let id = generate_id();
            state.panes.insert(id.clone(), PaneState {
                id: id.clone(),
                session_id,
                pane_type,
                backend_id: None,
                title: "New Pane".to_string(),
                is_focused: false,
            });
        }
        
        StateOperation::DeletePane { id } => {
            state.panes.remove(&id)
                .ok_or(SyncError::ResourceNotFound("pane", id))?;
        }
        
        StateOperation::UpdatePane { id, updates } => {
            let pane = state.panes.get_mut(&id)
                .ok_or(SyncError::ResourceNotFound("pane", id))?;
            apply_pane_updates(pane, updates);
        }
        
        StateOperation::UpdateTerminal { id, updates } => {
            let terminal = state.terminals.get_mut(&id)
                .ok_or(SyncError::ResourceNotFound("terminal", id))?;
            apply_terminal_updates(terminal, updates);
        }
        
        StateOperation::UpdateFileTree { updates } => {
            apply_file_tree_updates(&mut state.files, updates);
        }
        
        StateOperation::SetSetting { key, value } => {
            state.settings.insert(key, value);
        }
    }
    
    Ok(())
}

// ===== Compression Utilities =====

fn compress_data(data: &[u8]) -> Result<Vec<u8>, SyncError> {
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(data)
        .map_err(|e| SyncError::CompressionError(e.to_string()))?;
    encoder.finish()
        .map_err(|e| SyncError::CompressionError(e.to_string()))
}

fn decompress_data(data: &[u8]) -> Result<Vec<u8>, SyncError> {
    use flate2::read::GzDecoder;
    use std::io::Read;
    
    let mut decoder = GzDecoder::new(data);
    let mut decompressed = Vec::new();
    decoder.read_to_end(&mut decompressed)
        .map_err(|e| SyncError::CompressionError(e.to_string()))?;
    Ok(decompressed)
}

// ===== WebSocket Handler =====

pub struct SyncWebSocketHandler {
    sync_manager: Arc<StateSyncManager>,
    client_id: String,
    tx: mpsc::UnboundedSender<SyncMessage>,
    rx: mpsc::UnboundedReceiver<SyncMessage>,
}

impl SyncWebSocketHandler {
    pub async fn handle_connection(&mut self) -> Result<(), SyncError> {
        // Subscribe for updates
        let mut update_rx = self.sync_manager.update_tx.subscribe();
        
        loop {
            tokio::select! {
                // Handle incoming messages
                Some(msg) = self.rx.recv() => {
                    self.handle_client_message(msg).await?;
                }
                
                // Handle state updates
                Ok(update) = update_rx.recv() => {
                    self.send_update(update).await?;
                }
                
                // Heartbeat
                _ = tokio::time::sleep(Duration::from_secs(30)) => {
                    self.send_heartbeat().await?;
                }
            }
        }
    }
    
    async fn handle_client_message(&mut self, msg: SyncMessage) -> Result<(), SyncError> {
        match msg {
            SyncMessage::Subscribe { client_id, last_version } => {
                self.sync_manager.subscribe_client(client_id, last_version).await?;
            }
            
            SyncMessage::RequestFullSync { client_id } => {
                let state = self.sync_manager.current_state.read().await;
                let compressed = compress_state(&*state)?;
                
                self.tx.send(SyncMessage::FullState { state: compressed })
                    .map_err(|_| SyncError::ChannelClosed)?;
            }
            
            SyncMessage::ApplyChanges { changes } => {
                match self.sync_manager.apply_client_changes(changes).await {
                    Ok(new_version) => {
                        self.tx.send(SyncMessage::Acknowledge { version: new_version })
                            .map_err(|_| SyncError::ChannelClosed)?;
                    }
                    Err(e) => {
                        self.tx.send(SyncMessage::Error {
                            code: "APPLY_FAILED".to_string(),
                            message: e.to_string(),
                        }).map_err(|_| SyncError::ChannelClosed)?;
                    }
                }
            }
            
            _ => {}
        }
        
        Ok(())
    }
    
    async fn send_update(&mut self, update: StateUpdate) -> Result<(), SyncError> {
        self.tx.send(SyncMessage::StateUpdate { update })
            .map_err(|_| SyncError::ChannelClosed)?;
        Ok(())
    }
    
    async fn send_heartbeat(&mut self) -> Result<(), SyncError> {
        // Could send a lightweight message to keep connection alive
        Ok(())
    }
}

// ===== Error Types =====

#[derive(Debug, thiserror::Error)]
pub enum SyncError {
    #[error("Version not found: {0}")]
    VersionNotFound(u64),
    
    #[error("Version mismatch: client={client}, server={server}")]
    VersionMismatch { client: u64, server: u64 },
    
    #[error("Diff error: {0}")]
    DiffError(String),
    
    #[error("Serialization error: {0}")]
    SerializationError(String),
    
    #[error("Compression error: {0}")]
    CompressionError(String),
    
    #[error("Resource not found: {0} with id {1}")]
    ResourceNotFound(&'static str, String),
    
    #[error("Client not found: {0}")]
    ClientNotFound(String),
    
    #[error("Channel closed")]
    ChannelClosed,
}

// ===== Helper Types =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionUpdate {
    pub name: Option<String>,
    pub layout: Option<Option<GridLayout>>,
    pub active_pane: Option<Option<String>>,
    pub metadata: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaneUpdate {
    pub title: Option<String>,
    pub is_focused: Option<bool>,
    pub backend_id: Option<Option<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalUpdate {
    pub rows: Option<u16>,
    pub cols: Option<u16>,
    pub cursor_x: Option<u16>,
    pub cursor_y: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTreeUpdate {
    pub expanded_dirs: Option<Vec<String>>,
    pub selected_files: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompressedState {
    pub data: Vec<u8>,
    pub version: u64,
    pub compressed: bool,
    pub checksum: u64,
}

// ===== Utility Functions =====

fn generate_id() -> String {
    use uuid::Uuid;
    Uuid::new_v4().to_string()
}

fn calculate_checksum(state: &ApplicationState) -> u64 {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    
    let mut hasher = DefaultHasher::new();
    state.version.hash(&mut hasher);
    // Add more fields as needed
    hasher.finish()
}

fn compress_state(state: &ApplicationState) -> Result<CompressedState, SyncError> {
    let serialized = bincode::serialize(state)
        .map_err(|e| SyncError::SerializationError(e.to_string()))?;
    
    let compressed = compress_data(&serialized)?;
    
    Ok(CompressedState {
        data: compressed,
        version: state.version,
        compressed: true,
        checksum: state.checksum,
    })
}

// Placeholder types
#[derive(Debug, Clone, Serialize, Deserialize, SerdeDiff, PartialEq)]
pub enum PaneType {
    Terminal,
    Editor,
    FileTree,
}

#[derive(Debug, Clone, Serialize, Deserialize, SerdeDiff, PartialEq)]
pub struct GridLayout {
    pub root: LayoutNode,
}

#[derive(Debug, Clone, Serialize, Deserialize, SerdeDiff, PartialEq)]
pub struct LayoutNode {
    pub id: String,
}

impl Default for ApplicationState {
    fn default() -> Self {
        Self {
            sessions: HashMap::new(),
            panes: HashMap::new(),
            terminals: HashMap::new(),
            files: FileTreeState {
                root: "/".to_string(),
                expanded_dirs: Vec::new(),
                selected_files: Vec::new(),
                file_count: 0,
            },
            settings: HashMap::new(),
            version: 0,
            checksum: 0,
        }
    }
}

// Helper update functions
fn apply_session_updates(session: &mut SessionState, updates: SessionUpdate) {
    if let Some(name) = updates.name {
        session.name = name;
    }
    if let Some(layout) = updates.layout {
        session.layout = layout;
    }
    if let Some(active_pane) = updates.active_pane {
        session.active_pane = active_pane;
    }
    if let Some(metadata) = updates.metadata {
        session.metadata = metadata;
    }
}

fn apply_pane_updates(pane: &mut PaneState, updates: PaneUpdate) {
    if let Some(title) = updates.title {
        pane.title = title;
    }
    if let Some(is_focused) = updates.is_focused {
        pane.is_focused = is_focused;
    }
    if let Some(backend_id) = updates.backend_id {
        pane.backend_id = backend_id;
    }
}

fn apply_terminal_updates(terminal: &mut TerminalState, updates: TerminalUpdate) {
    if let Some(rows) = updates.rows {
        terminal.rows = rows;
    }
    if let Some(cols) = updates.cols {
        terminal.cols = cols;
    }
    if let Some(cursor_x) = updates.cursor_x {
        terminal.cursor_x = cursor_x;
    }
    if let Some(cursor_y) = updates.cursor_y {
        terminal.cursor_y = cursor_y;
    }
}

fn apply_file_tree_updates(files: &mut FileTreeState, updates: FileTreeUpdate) {
    if let Some(expanded_dirs) = updates.expanded_dirs {
        files.expanded_dirs = expanded_dirs;
    }
    if let Some(selected_files) = updates.selected_files {
        files.selected_files = selected_files;
    }
}