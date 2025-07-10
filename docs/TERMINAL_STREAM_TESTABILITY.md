# TerminalStreamManager Testability Refactoring

## Overview

The `TerminalStreamManager` was previously tightly coupled to Tauri's `AppHandle`, making it impossible to unit test without a full Tauri runtime. This document describes the refactoring that made it testable.

## Problem

The original implementation required a `tauri::AppHandle` in its constructor:

```rust
impl TerminalStreamManager {
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        let ipc_handler = Arc::new(IpcHandler::new(app_handle));
        // ...
    }
}
```

This made unit testing impossible because:
1. `AppHandle` can only be obtained from a running Tauri application
2. IPC operations were directly coupled to Tauri's event system
3. Tests would require a full GUI environment

## Solution

### 1. IPC Abstraction Trait

Created an `IpcChannel` trait to abstract IPC operations:

```rust
#[async_trait]
pub trait IpcChannel: Send + Sync {
    async fn start_streaming(&self, terminal_id: String, pty_handle: PtyHandle) 
        -> Result<(), OrchflowError>;
    async fn send_input(&self, terminal_id: &str, input: TerminalInput) 
        -> Result<(), OrchflowError>;
    async fn send_control(&self, terminal_id: &str, message: ControlMessage) 
        -> Result<(), OrchflowError>;
    async fn stop_streaming(&self, terminal_id: &str) 
        -> Result<(), OrchflowError>;
}
```

### 2. Production Implementation

Created `TauriIpcChannel` that wraps the existing `IpcHandler`:

```rust
pub struct TauriIpcChannel {
    inner: Arc<IpcHandler>,
}

impl TauriIpcChannel {
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        Self {
            inner: Arc::new(IpcHandler::new(app_handle)),
        }
    }
}
```

### 3. Mock Implementation

Created `MockIpcChannel` for testing:

```rust
pub struct MockIpcChannel {
    pub events: Arc<Mutex<Vec<TerminalEvent>>>,
    pub active_streams: Arc<Mutex<HashMap<String, PtyHandle>>>,
    pub stop_tx: mpsc::Sender<String>,
    pub stop_rx: Arc<Mutex<mpsc::Receiver<String>>>,
}
```

### 4. Refactored TerminalStreamManager

Updated `TerminalStreamManager` to use the trait:

```rust
pub struct TerminalStreamManager {
    pty_manager: Arc<PtyManager>,
    ipc_channel: Arc<dyn IpcChannel>,  // Now uses trait instead of concrete type
    // ...
}

impl TerminalStreamManager {
    /// Create with specific IPC channel (for testing)
    pub fn with_ipc_channel(ipc_channel: Arc<dyn IpcChannel>) -> Self {
        // ...
    }
    
    /// Create with Tauri IPC (for production)
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        let ipc_channel = Arc::new(TauriIpcChannel::new(app_handle));
        Self::with_ipc_channel(ipc_channel)
    }
}
```

## Benefits

1. **Unit Testing**: Can now test `TerminalStreamManager` without Tauri
2. **Separation of Concerns**: IPC logic is decoupled from terminal management
3. **Flexibility**: Easy to add new IPC implementations (e.g., for different platforms)
4. **Backward Compatibility**: Existing code using `new()` continues to work

## Example Test

```rust
#[tokio::test]
async fn test_create_terminal_with_mock() {
    let mock_channel = Arc::new(MockIpcChannel::new());
    let manager = TerminalStreamManager::with_ipc_channel(mock_channel.clone());
    
    let result = manager.create_terminal(
        "test-term".to_string(),
        None,
        24,
        80,
    ).await;
    
    assert!(result.is_ok());
    
    // Verify terminal was created and streaming started
    let streams = mock_channel.active_streams.lock().await;
    assert!(streams.contains_key("test-term"));
}
```

## Files Changed

1. **New Files**:
   - `src/terminal_stream/ipc_trait.rs` - Trait definition and implementations
   - `src/terminal_stream/testable_tests.rs` - Unit tests using mocks

2. **Modified Files**:
   - `src/terminal_stream/mod.rs` - Updated to use trait-based IPC
   - `src/terminal_stream/mod.rs` - Exports for new types

## Future Improvements

1. Add more comprehensive mock behavior
2. Create integration tests that use real Tauri runtime
3. Consider making other components testable using similar patterns
4. Add performance benchmarks comparing real vs mock IPC