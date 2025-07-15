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
use std::sync::Arc;

// Create a storage backend
let store = Arc::new(MemoryStore::new());

// Create state manager
let state_manager = StateManager::new(store);

// Create a backend (implement the MuxBackend trait)
let backend = Arc::new(MyTmuxBackend::new());

// Create the manager
let manager = Manager::new(backend, state_manager);

// Execute actions
let result = manager.execute_action(Action::CreateSession {
    name: "main".to_string(),
}).await?;
```

## Implementing a Backend

To integrate with a terminal multiplexer, implement the `MuxBackend` trait:

```rust
use orchflow_core::MuxBackend;
use async_trait::async_trait;

struct MyBackend;

#[async_trait]
impl MuxBackend for MyBackend {
    async fn create_session(&self, name: &str) -> Result<String, String> {
        // Implementation
    }
    
    // ... other methods
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