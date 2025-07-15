# OrchFlow Core

A transport-agnostic orchestration engine for managing terminal sessions, panes, and plugins with an event-driven architecture.

## Overview

OrchFlow Core provides the foundational orchestration engine that powers the OrchFlow ecosystem. It's designed to be independent of any specific UI framework or transport mechanism, making it suitable for integration into various environments including desktop apps, web services, and CLI tools.

## Architecture

The core is built around several key components:

- **Manager**: The main orchestration engine that coordinates all operations
- **State Management**: Persistent state management with event notifications
- **Plugin System**: Extensible plugin architecture for custom functionality
- **Backend Abstraction**: Support for different terminal multiplexers (tmux, etc.)
- **Event System**: Reactive event-driven architecture for real-time updates

## Features

- Transport-agnostic design - works with any frontend
- Event-driven architecture for reactive UIs
- Pluggable backend support (tmux, screen, etc.)
- Extensible plugin system
- Type-safe action and event handling
- Async/await throughout

## Usage

```rust
use orchflow_core::{Manager, storage::MemoryStore, state::StateManager};
use orchflow_mux::backend::TmuxBackend; // Real tmux backend
use std::sync::Arc;

// Create a storage backend
let store = Arc::new(MemoryStore::new());

// Create state manager
let state_manager = StateManager::new(store);

// Create a backend - use TmuxBackend for production or MockBackend for testing
let backend = Arc::new(TmuxBackend::new());

// Create the manager
let manager = Manager::new(backend, state_manager);

// Execute actions
let result = manager.execute_action(Action::CreateSession {
    name: "main".to_string(),
}).await?;
```

## Backend Options

OrchFlow Core is designed to work with different terminal multiplexer backends:

### Production Backends
- **TmuxBackend** (from `orchflow-mux`): Full tmux integration for production use
- **Custom backends**: Implement the `MuxBackend` trait for other multiplexers

### Testing Backends
- **MockBackend** (from `orchflow-mux`): Configurable mock for testing and development

### Using Available Backends

```rust
use orchflow_mux::backend::{TmuxBackend, MockBackend};
use orchflow_mux::factory::BackendFactory;

// Production: Use tmux backend
let backend = Arc::new(TmuxBackend::new());

// Testing: Use mock backend  
let mut mock_backend = MockBackend::new();
mock_backend.set_fail_mode(false);
let backend = Arc::new(mock_backend);

// Auto-detection: Let factory choose based on environment
let backend = Arc::new(BackendFactory::create_backend().await?);
```

## Implementing a Custom Backend

To integrate with a different terminal multiplexer, implement the `MuxBackend` trait:

```rust
use orchflow_mux::backend::{MuxBackend, MuxError};
use async_trait::async_trait;

struct MyCustomBackend;

#[async_trait]
impl MuxBackend for MyCustomBackend {
    async fn create_session(&self, name: &str) -> Result<String, MuxError> {
        // Your custom implementation
        Ok(format!("custom-session-{}", name))
    }
    
    // ... implement other required methods
}
```

## Creating Plugins

Extend functionality by implementing the `Plugin` trait:

```rust
use orchflow_core::{Plugin, PluginContext, Event};
use async_trait::async_trait;

struct MyPlugin;

#[async_trait]
impl Plugin for MyPlugin {
    fn id(&self) -> &str {
        "my-plugin"
    }
    
    async fn handle_event(&mut self, event: &Event) -> Result<(), String> {
        // Handle events
    }
    
    // ... other methods
}
```

## License

MIT OR Apache-2.0