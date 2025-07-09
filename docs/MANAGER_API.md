# Manager API Documentation

> **Last Updated**: January 2025  
> **Status**: Current API documentation for orchflow Manager  
> **Companion to**: [COMPONENT_RESPONSIBILITIES.md](./COMPONENT_RESPONSIBILITIES.md)

## Overview

The Manager is the core Rust backend component of orchflow, responsible for terminal management, file operations, plugin orchestration, and state persistence. It provides a unified Tauri API for the frontend to interact with all IDE functionality.

**Architecture**: The Manager operates as a standalone Rust service with optional Orchestrator integration for AI features.

## Architecture

The Manager follows a modular architecture with clear separation of concerns:

```
Manager
├── Core (manager/mod.rs)
│   ├── Session Management
│   ├── Pane Management
│   └── Plugin Coordination
├── Handlers (manager/handlers/)
│   ├── Session Handler
│   ├── Pane Handler
│   ├── Plugin Handler
│   ├── File Handler
│   └── Command Handler
├── Execution Engine (manager/execution.rs)
└── Action Types (manager/types.rs)
```

## Core Types

### Action
The primary interface for Manager operations:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "params")]
pub enum Action {
    // Session Management
    CreateSession { name: String },
    DeleteSession { session_id: String },
    ListSessions,
    GetActiveSession,
    SetActiveSession { session_id: String },
    
    // Pane Management
    CreatePane { 
        session_id: String,
        pane_type: PaneType,
        title: String,
        parent_id: Option<String>,
        direction: Option<SplitDirection>,
    },
    ClosePane { pane_id: String },
    SplitPane { 
        pane_id: String,
        direction: SplitDirection,
    },
    FocusPane { pane_id: String },
    
    // Plugin Management
    LoadPlugin { plugin_id: String },
    UnloadPlugin { plugin_id: String },
    ListPlugins,
    GetPluginInfo { plugin_id: String },
    ExecutePluginCommand {
        plugin_id: String,
        command: String,
        args: Value,
    },
    
    // Terminal Operations
    SendInput { pane_id: String, data: String },
    ResizePane { pane_id: String, rows: u16, cols: u16 },
    
    // File Operations
    OpenFile { path: String },
    SaveFile { path: String, content: String },
    CreateFile { path: String },
    DeleteFile { path: String },
    RenameFile { old_path: String, new_path: String },
}
```

### Event
Events emitted by the Manager:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum Event {
    // Session Events
    SessionCreated { session: Session },
    SessionDeleted { session_id: String },
    ActiveSessionChanged { session_id: String },
    
    // Pane Events
    PaneCreated { pane: Pane },
    PaneClosed { pane_id: String },
    PaneFocused { pane_id: String },
    PaneResized { pane_id: String, rows: u16, cols: u16 },
    PaneOutput { pane_id: String, data: String },
    
    // Plugin Events
    PluginLoaded { plugin_id: String },
    PluginUnloaded { plugin_id: String },
    PluginOutput { plugin_id: String, output: Value },
    PluginError { plugin_id: String, error: String },
    
    // File Events
    FileOpened { path: String },
    FileSaved { path: String },
    FileChanged { path: String },
    FileDeleted { path: String },
    
    // Command Events
    CommandCompleted { pane_id: String, exit_code: i32 },
    
    // Error Events
    Error { message: String, context: Option<String> },
}
```

## Tauri Commands

### Session Management

#### `manager_execute`
Primary command for executing Manager actions:

```rust
#[tauri::command]
pub async fn manager_execute(
    action: Action,
    manager: State<'_, Arc<Manager>>,
) -> Result<Value, String>
```

#### `get_sessions`
List all sessions:

```rust
#[tauri::command]
pub async fn get_sessions(
    manager: State<'_, Arc<Manager>>,
) -> Result<Vec<Session>, String>
```

#### `get_active_session`
Get the currently active session:

```rust
#[tauri::command]
pub async fn get_active_session(
    manager: State<'_, Arc<Manager>>,
) -> Result<Option<Session>, String>
```

### Pane Management

#### `get_panes`
List panes for a session:

```rust
#[tauri::command]
pub async fn get_panes(
    session_id: String,
    manager: State<'_, Arc<Manager>>,
) -> Result<Vec<Pane>, String>
```

#### `send_pane_input`
Send input to a specific pane:

```rust
#[tauri::command]
pub async fn send_pane_input(
    pane_id: String,
    input: String,
    manager: State<'_, Arc<Manager>>,
) -> Result<(), String>
```

### Plugin Management

#### `list_plugins`
List all available plugins:

```rust
#[tauri::command]
pub async fn list_plugins(
    manager: State<'_, Arc<Manager>>,
) -> Result<Vec<PluginInfo>, String>
```

#### `get_plugin_metadata`
Get detailed plugin information:

```rust
#[tauri::command]
pub async fn get_plugin_metadata(
    plugin_id: String,
    manager: State<'_, Arc<Manager>>,
) -> Result<PluginMetadata, String>
```

#### `execute_plugin_command`
Execute a plugin-specific command:

```rust
#[tauri::command]
pub async fn execute_plugin_command(
    plugin_id: String,
    command: String,
    args: Value,
    manager: State<'_, Arc<Manager>>,
) -> Result<Value, String>
```

### State Persistence

#### `persist_state`
Manually trigger state persistence:

```rust
#[tauri::command]
pub async fn persist_state(
    manager: State<'_, Arc<Manager>>,
) -> Result<(), String>
```

## Frontend Integration

### TypeScript Client (`manager-client.ts`)

```typescript
import { invoke } from '@tauri-apps/api/tauri';
import type { Action, Event, Session, Pane, PluginInfo } from '$lib/types';

export class ManagerClient {
  async execute(action: Action): Promise<any> {
    return await invoke('manager_execute', { action });
  }
  
  async createSession(name: string): Promise<Session> {
    return await this.execute({
      type: 'CreateSession',
      params: { name }
    });
  }
  
  async createPane(params: CreatePaneParams): Promise<Pane> {
    return await this.execute({
      type: 'CreatePane',
      params
    });
  }
  
  async loadPlugin(pluginId: string): Promise<void> {
    return await this.execute({
      type: 'LoadPlugin',
      params: { plugin_id: pluginId }
    });
  }
}
```

### Current Svelte Store (`manager.ts`)

The actual implementation provides a comprehensive store with automatic event handling:

```typescript
import { writable, derived } from 'svelte/store';
import { managerClient, type Session, type Pane, type PluginInfo } from '../api/manager-client';

// Main store with automatic initialization
export const manager = createManagerStore();

// Derived stores for easy component access
export const sessions = derived(manager, $manager => $manager.sessions);
export const activeSession = derived(
  manager,
  $manager => $manager.sessions.find(s => s.id === $manager.activeSessionId)
);
export const panes = derived(manager, $manager => $manager.panes);
export const activePane = derived(
  manager,
  $manager => $manager.activePaneId ? $manager.panes.get($manager.activePaneId) : undefined
);
export const plugins = derived(manager, $manager => $manager.plugins);
export const terminalOutputs = derived(manager, $manager => $manager.terminalOutputs);
export const isConnected = derived(manager, $manager => $manager.isConnected);

// Usage in components
import { manager, sessions, activeSession } from '$lib/stores/manager';

// Create session
const session = await manager.createSession('My Project');

// Create terminal
const terminal = await manager.createTerminal(session.id, {
  name: 'Development',
  command: 'npm run dev'
});
```
```

## Plugin System

### Plugin Interface

Plugins implement the following trait:

```rust
#[async_trait]
pub trait Plugin: Send + Sync {
    fn id(&self) -> &str;
    fn name(&self) -> &str;
    fn version(&self) -> &str;
    fn author(&self) -> &str;
    
    async fn initialize(&mut self, context: PluginContext) -> Result<(), String>;
    async fn shutdown(&mut self) -> Result<(), String>;
    async fn handle_action(&mut self, action: &str, params: Value) -> Result<Value, String>;
    async fn handle_event(&mut self, event: &Event) -> Result<(), String>;
}
```

### Plugin Context

```rust
pub struct PluginContext {
    pub app_handle: AppHandle,
    pub plugin_dir: PathBuf,
    pub config: Value,
    pub manager: Arc<Manager>,
}
```

### Current Plugin System

The Manager includes these core plugins implemented in Rust:

1. **Terminal Plugin** - PTY management with real-time streaming
2. **File Manager Plugin** - File operations with trash support
3. **Search Plugin** - Project-wide search with ripgrep integration  
4. **Git Plugin** - Version control operations and status
5. **LSP Plugin** - Language server integration (in development)
6. **Test Parser Plugin** - Test result parsing for multiple frameworks
7. **Module System** - Plugin lifecycle and hot-reload support

**Note**: Plugin system supports both Rust and WASM plugins, with hot-reload capabilities.

## Error Handling

The Manager uses typed errors with rich context:

```rust
pub enum ManagerError {
    SessionNotFound(String),
    PaneNotFound(String),
    PluginNotFound(String),
    PluginError { plugin_id: String, error: String },
    BackendError(String),
    StateError(String),
    InvalidAction(String),
}
```

## Event System (Tauri IPC)

The Manager broadcasts events via Tauri's event system for real-time updates:

```typescript
import { listen } from '@tauri-apps/api/event';

// Listen to terminal output
const unlisten = await listen('terminal_output', (event) => {
  const { pane_id, data } = event.payload;
  console.log(`Terminal ${pane_id}: ${data}`);
});

// Listen to session events
const unlistenSession = await listen('session_created', (event) => {
  const session = event.payload;
  console.log('New session:', session);
});
```

## Best Practices

1. **Action Patterns**
   - Use typed actions for all operations
   - Validate parameters before execution
   - Return meaningful error messages

2. **State Management**
   - Let the Manager handle state persistence
   - Use events for state synchronization
   - Avoid direct state manipulation

3. **Plugin Development**
   - Follow the plugin interface strictly
   - Handle errors gracefully
   - Emit appropriate events

4. **Performance**
   - Batch operations when possible
   - Use async operations for I/O
   - Implement proper cleanup

## Migration Guide

### Migration Status

**Current Status**: Migration from orchestrator to manager API is largely complete (Phase 6.1 ✅)

**Remaining Components** (see [DEVELOPMENT_ROADMAP.md](../DEVELOPMENT_ROADMAP.md#frontend-api-consolidation)):
- StatusBar.svelte - Still imports from `orchestrator` store
- CommandBar.svelte - Still uses `orchestrator.createTerminal()`, `orchestrator.execute()`

**Migration Pattern**:
```typescript
// Old: orchestrator store (legacy)
import { orchestrator } from '$lib/stores/orchestrator';
await orchestrator.createTerminal(sessionId, options);

// New: manager store (current)
import { manager } from '$lib/stores/manager';
await manager.createTerminal(sessionId, options);
```

## Advanced Features

### Terminal Streaming

Real-time terminal output via Tauri events:

```typescript
import { listen } from '@tauri-apps/api/event';

// Subscribe to terminal output
const unlisten = await listen('terminal_output', (event) => {
  const { pane_id, data } = event.payload;
  // Base64 decode the data
  const decoded = atob(data);
  terminal.write(decoded);
});
```

### Plugin Commands

Execute plugin-specific functionality:

```typescript
// Load a plugin
await manager.loadPlugin('git-plugin');

// Execute plugin command via manager
const result = await managerClient.execute({
  type: 'ExecutePluginCommand',
  params: {
    plugin_id: 'git-plugin',
    command: 'status',
    args: { path: '/project/path' }
  }
});
```

### State Persistence

Automatic state persistence with manual triggers:

```typescript
// Trigger manual state save
await manager.persistState();

// State is automatically persisted on changes
// and restored on application startup
```