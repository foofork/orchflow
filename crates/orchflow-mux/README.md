# OrchFlow Mux

Terminal multiplexer abstraction layer supporting multiple backends including tmux and mock implementations.

## Features

- **Backend Abstraction**: Clean trait-based interface for terminal multiplexers
- **Tmux Support**: Full tmux integration with session, pane, and window management
- **Mock Backend**: Testing and development backend with configurable behavior
- **Factory Pattern**: Automatic backend selection based on environment
- **Async/Await**: Fully async API for non-blocking operations
- **Error Handling**: Comprehensive error types for robust integration

## Supported Backends

- **TmuxBackend**: Production-ready tmux integration
- **MockBackend**: Testing and development backend
- **Future**: Screen, custom multiplexers

## Usage

### Basic Usage

```rust
use orchflow_mux::backend::{TmuxBackend, MuxBackend};
use orchflow_mux::factory::BackendFactory;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Auto-detect backend
    let backend = BackendFactory::create_backend().await?;
    
    // Create a session
    let session_id = backend.create_session("my-session").await?;
    
    // Create a pane
    let pane_id = backend.create_pane(&session_id, SplitType::None).await?;
    
    // Send commands
    backend.send_keys(&pane_id, "echo 'Hello World'").await?;
    backend.send_keys(&pane_id, "Enter").await?;
    
    // Capture output
    let output = backend.capture_pane(&pane_id).await?;
    println!("Output: {}", output);
    
    Ok(())
}
```

### Direct Backend Usage

```rust
use orchflow_mux::backend::{TmuxBackend, MuxBackend, SplitType};

// Create tmux backend directly
let backend = TmuxBackend::new();

// Session management
let session_id = backend.create_session("work").await?;
let sessions = backend.list_sessions().await?;

// Pane operations
let pane_id = backend.create_pane(&session_id, SplitType::Horizontal).await?;
backend.resize_pane(&pane_id, PaneSize { width: 80, height: 24 }).await?;
backend.select_pane(&pane_id).await?;

// Terminal interaction
backend.send_keys(&pane_id, "cd /home/user").await?;
backend.send_keys(&pane_id, "Enter").await?;

// Cleanup
backend.kill_pane(&pane_id).await?;
backend.kill_session(&session_id).await?;
```

### Mock Backend for Testing

```rust
use orchflow_mux::backend::{MockBackend, MuxBackend};

// Create mock backend
let mut backend = MockBackend::new();

// Configure mock behavior
backend.set_fail_mode(false);
backend.set_custom_output("mock-pane", "Hello from mock!");

// Use like any other backend
let session_id = backend.create_session("test").await?;
let pane_id = backend.create_pane(&session_id, SplitType::None).await?;

// Mock will return configured output
let output = backend.capture_pane(&pane_id).await?;
assert_eq!(output, "Hello from mock!");
```

### Environment-Based Backend Selection

```rust
use orchflow_mux::factory::BackendFactory;

// Set environment variable to control backend
std::env::set_var("ORCHFLOW_BACKEND", "tmux");

// Factory will create appropriate backend
let backend = BackendFactory::create_backend().await?;

// Works with any backend implementation
let session_id = backend.create_session("auto").await?;
```

## Backend Trait

Implement `MuxBackend` for custom multiplexer support:

```rust
use orchflow_mux::backend::{MuxBackend, MuxError, Session, Pane, PaneSize, SplitType};
use async_trait::async_trait;

struct CustomBackend;

#[async_trait]
impl MuxBackend for CustomBackend {
    async fn create_session(&self, name: &str) -> Result<String, MuxError> {
        // Your implementation
        Ok(format!("session-{}", name))
    }
    
    async fn create_pane(&self, session_id: &str, split: SplitType) -> Result<String, MuxError> {
        // Your implementation
        Ok(format!("pane-{}", session_id))
    }
    
    // ... implement other required methods
}
```

## Error Handling

The crate provides comprehensive error types:

```rust
use orchflow_mux::backend::MuxError;

match backend.create_session("test").await {
    Ok(session_id) => println!("Created session: {}", session_id),
    Err(MuxError::BackendError(msg)) => eprintln!("Backend error: {}", msg),
    Err(MuxError::SessionNotFound(id)) => eprintln!("Session not found: {}", id),
    Err(MuxError::PaneNotFound(id)) => eprintln!("Pane not found: {}", id),
    Err(MuxError::InvalidInput(msg)) => eprintln!("Invalid input: {}", msg),
}
```

## Integration with OrchFlow Core

This crate is designed to work seamlessly with `orchflow-core`:

```rust
use orchflow_core::{Manager, state::StateManager, storage::MemoryStore};
use orchflow_mux::factory::BackendFactory;
use std::sync::Arc;

let store = Arc::new(MemoryStore::new());
let state_manager = StateManager::new(store);
let backend = Arc::new(BackendFactory::create_backend().await?);

let manager = Manager::new(backend, state_manager);
```

## License

Licensed under either of

- Apache License, Version 2.0
- MIT license

at your option.