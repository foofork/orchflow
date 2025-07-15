# Migration Guide: Using orchflow-core in the Tauri Desktop App

This guide explains how to migrate the Tauri desktop app to use the new `orchflow-core` crate.

## Overview

The Manager component has been extracted into a transport-agnostic `orchflow-core` crate located at `/workspaces/orchflow/crates/orchflow-core/`. This allows the orchestration engine to be used by any frontend, not just Tauri.

## Key Changes

### 1. Dependencies

Add `orchflow-core` to your `Cargo.toml`:

```toml
[dependencies]
orchflow-core = { path = "../../crates/orchflow-core" }
```

### 2. Import Changes

Replace local Manager imports with orchflow-core imports:

```rust
// Before
use crate::manager::{Manager, Action, Event, PaneType};

// After
use orchflow_core::{Manager, Action, Event, PaneType};
```

### 3. Backend Implementation

The existing tmux backend needs to implement the `orchflow_core::MuxBackend` trait:

```rust
use orchflow_core::MuxBackend;
use async_trait::async_trait;

#[async_trait]
impl MuxBackend for TmuxBackend {
    // Implement all required methods
}
```

### 4. Storage Implementation

Create a Tauri-specific storage adapter that implements `orchflow_core::StateStore`:

```rust
use orchflow_core::StateStore;
use async_trait::async_trait;

struct TauriStateStore {
    store: Arc<SimpleStateStore>,
}

#[async_trait]
impl StateStore for TauriStateStore {
    // Implement all required methods
}
```

### 5. Service Implementations

Implement the optional service traits:

```rust
// File Manager
#[async_trait]
impl orchflow_core::FileManager for TauriFileManager {
    // Implement file operations
}

// Search Provider
#[async_trait]
impl orchflow_core::SearchProvider for TauriSearchProvider {
    // Implement search operations
}

// Command History
#[async_trait]
impl orchflow_core::CommandHistory for TauriCommandHistory {
    // Implement history operations
}
```

### 6. Manager Creation

Update the Manager creation to use orchflow-core:

```rust
use orchflow_core::{Manager, StateManager};

// Create storage
let store = Arc::new(TauriStateStore::new(simple_state_store));

// Create state manager
let state_manager = StateManager::new(store);

// Create backend
let backend = Arc::new(TmuxBackend::new());

// Create manager with optional services
let manager = Manager::new(backend, state_manager)
    .with_file_manager(Arc::new(TauriFileManager::new()))
    .with_search_provider(Arc::new(TauriSearchProvider::new()))
    .with_command_history(Arc::new(TauriCommandHistory::new()));
```

### 7. Tauri Commands

The Tauri commands remain largely the same, but now delegate to the orchflow-core Manager:

```rust
#[tauri::command]
async fn create_session(
    manager: State<'_, Arc<Manager>>,
    name: String
) -> Result<Value, String> {
    manager.execute_action(Action::CreateSession { name })
        .await
        .map_err(|e| e.to_string())
}
```

## Benefits

1. **Modularity**: The orchestration engine is now independent of Tauri
2. **Reusability**: Can be used in CLI tools, web services, or other frontends
3. **Testability**: Easier to test without Tauri dependencies
4. **Type Safety**: Strong typing for all actions and events
5. **Flexibility**: Backend and storage are pluggable

## Next Steps

1. Update the Tauri app's Cargo.toml to depend on orchflow-core
2. Implement the required trait adapters
3. Update imports throughout the codebase
4. Test the migration thoroughly

The core Manager API remains the same, so most code changes are mechanical updates to imports and trait implementations.