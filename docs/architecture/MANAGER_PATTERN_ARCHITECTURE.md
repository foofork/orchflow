# Manager Pattern Architecture in orchflow

## Overview

The Manager pattern is orchflow's central orchestration mechanism, coordinating all major operations across the application. It provides a unified API for the frontend while managing complex backend interactions.

## Core Concept

The Manager acts as a facade and coordinator, handling:
- Action processing and routing
- Plugin lifecycle management
- State coordination
- Event distribution
- Resource management

## Architecture Diagram

```
┌─────────────────────────────────────────────┐
│            Frontend (TypeScript)             │
│                                             │
│         ┌─────────────────────┐             │
│         │   Tauri Commands    │             │
│         └──────────┬──────────┘             │
└────────────────────┼────────────────────────┘
                     │ IPC
┌────────────────────┼────────────────────────┐
│                    ▼                         │
│         ┌─────────────────────┐             │
│         │      Manager        │ ← Central   │
│         │                     │   Facade    │
│         └──────┬──┬──┬────────┘             │
│                │  │  │                       │
│     ┌──────────┘  │  └──────────┐           │
│     ▼             ▼             ▼           │
│ ┌────────┐  ┌────────────┐  ┌────────┐     │
│ │ State  │  │   Plugin    │  │  Mux   │     │
│ │Manager │  │   System    │  │Backend │     │
│ └────────┘  └────────────┘  └────────┘     │
│     │             │              │           │
│     ▼             ▼              ▼           │
│ ┌────────┐  ┌────────────┐  ┌────────┐     │
│ │SQLite  │  │  Plugins    │  │  PTY   │     │
│ │ Store  │  │(Term,File,.)│  │ System │     │
│ └────────┘  └────────────┘  └────────┘     │
│            Backend (Rust)                    │
└─────────────────────────────────────────────┘
```

## Action Processing Pipeline

### Action Flow

1. **Frontend initiates action** → Tauri command
2. **Manager receives action** → Validates and routes
3. **Plugin/Component handles** → Executes operation
4. **State updates** → Through StateManager
5. **Events emitted** → Frontend notified

### Action Types

```rust
pub enum ManagerAction {
    // Session management
    CreateSession { name: String },
    DeleteSession { id: String },
    
    // Pane operations
    CreatePane { session_id: String, pane_type: PaneType },
    SplitPane { pane_id: String, direction: SplitDirection },
    
    // Plugin commands
    ExecutePluginCommand { plugin_id: String, command: String, args: Value },
    
    // Terminal operations
    SendTerminalInput { terminal_id: String, input: String },
    ResizeTerminal { terminal_id: String, rows: u16, cols: u16 },
}
```

## Key Components

### Manager Structure

```rust
pub struct Manager {
    state_manager: Arc<StateManager>,
    plugin_system: Arc<PluginSystem>,
    mux_backend: Arc<dyn MuxBackend>,
    event_bus: Arc<EventBus>,
    app_handle: tauri::AppHandle,
}
```

### Core Responsibilities

1. **Action Routing**
   - Parse incoming actions
   - Route to appropriate handler
   - Coordinate multi-step operations

2. **Plugin Management**
   - Load and initialize plugins
   - Route plugin commands
   - Manage plugin lifecycle

3. **State Coordination**
   - Ensure state consistency
   - Coordinate complex state changes
   - Handle transaction boundaries

4. **Event Distribution**
   - Broadcast state changes
   - Notify interested parties
   - Handle event ordering

## Implementation Patterns

### Command Handler Pattern

```rust
impl Manager {
    pub async fn handle_action(&self, action: ManagerAction) -> Result<ActionResult> {
        match action {
            ManagerAction::CreateSession { name } => {
                self.create_session(name).await
            }
            ManagerAction::ExecutePluginCommand { plugin_id, command, args } => {
                self.execute_plugin_command(plugin_id, command, args).await
            }
            // ... other actions
        }
    }
    
    async fn create_session(&self, name: String) -> Result<ActionResult> {
        // Create session in state
        let session = self.state_manager.create_session(name).await?;
        
        // Initialize mux backend session
        self.mux_backend.create_session(&session.id).await?;
        
        // Notify plugins
        self.plugin_system.notify_session_created(&session).await;
        
        // Return result
        Ok(ActionResult::SessionCreated { session })
    }
}
```

### Plugin Integration

```rust
impl Manager {
    async fn execute_plugin_command(
        &self, 
        plugin_id: String, 
        command: String, 
        args: Value
    ) -> Result<ActionResult> {
        // Get plugin
        let plugin = self.plugin_system.get_plugin(&plugin_id)?;
        
        // Create context
        let context = PluginContext {
            state_manager: self.state_manager.clone(),
            app_handle: self.app_handle.clone(),
        };
        
        // Execute command
        let result = plugin.handle_command(&command, args, context).await?;
        
        Ok(ActionResult::PluginResult { plugin_id, result })
    }
}
```

## Error Handling

### Hierarchical Error Processing

```rust
pub enum ManagerError {
    StateError(StateError),
    PluginError(PluginError),
    MuxError(MuxError),
    ValidationError(String),
}

impl Manager {
    async fn handle_with_recovery(&self, action: ManagerAction) -> Result<ActionResult> {
        match self.handle_action(action).await {
            Ok(result) => Ok(result),
            Err(ManagerError::StateError(e)) => {
                // Attempt state recovery
                self.recover_state(e).await
            }
            Err(e) => Err(e),
        }
    }
}
```

## Performance Considerations

### Async Operations
- All I/O operations are async
- Parallel execution where possible
- Careful deadlock avoidance

### Resource Pooling
- Connection pools for backends
- Reusable plugin contexts
- Cached state queries

### Event Batching
- Group related events
- Debounce high-frequency updates
- Priority-based event handling

## Best Practices

1. **Keep Manager thin** - Delegate to specialized components
2. **Validate early** - Check inputs at Manager boundary
3. **Use type-safe actions** - Avoid string-based commands
4. **Handle errors gracefully** - Provide recovery paths
5. **Log strategically** - Track action flow for debugging

## Future Evolution

- Action replay for debugging
- Distributed manager for clustering
- Plugin marketplace integration
- Advanced scheduling capabilities

The Manager pattern provides a clean, extensible architecture for orchestrating orchflow's complex operations while maintaining separation of concerns.