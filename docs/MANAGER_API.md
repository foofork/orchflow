# Manager API Documentation

## Overview

The Manager is the core orchestration component of orchflow, responsible for coordinating sessions, panes, plugins, and backend operations. It provides a unified API for the frontend to interact with all IDE functionality.

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

### Svelte Store (`manager.ts`)

```typescript
import { writable, derived } from 'svelte/store';
import { ManagerClient } from '$lib/api/manager-client';

class ManagerStore {
  private client = new ManagerClient();
  private ws: WebSocket | null = null;
  
  // State stores
  sessions = writable<Session[]>([]);
  activeSessionId = writable<string | null>(null);
  panes = writable<Map<string, Pane[]>>(new Map());
  plugins = writable<PluginInfo[]>([]);
  
  // Derived stores
  activeSession = derived(
    [this.sessions, this.activeSessionId],
    ([$sessions, $activeId]) => 
      $sessions.find(s => s.id === $activeId)
  );
  
  activePanes = derived(
    [this.panes, this.activeSessionId],
    ([$panes, $activeId]) => 
      $activeId ? $panes.get($activeId) || [] : []
  );
  
  // Methods
  async createSession(name: string) {
    const session = await this.client.createSession(name);
    this.sessions.update(sessions => [...sessions, session]);
    return session;
  }
  
  async createTerminal(sessionId: string, options?: CreateTerminalOptions) {
    return await this.client.createPane({
      session_id: sessionId,
      pane_type: 'Terminal',
      title: options?.name || 'Terminal',
      parent_id: options?.parentId,
      direction: options?.direction
    });
  }
}

export const manager = new ManagerStore();
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

### Built-in Plugins

1. **Terminal Plugin** - Terminal emulation and PTY management
2. **Session Plugin** - Session persistence and restoration
3. **File Browser Plugin** - File system navigation
4. **Search Plugin** - Project-wide search functionality
5. **Git Plugin** - Version control integration
6. **LSP Plugin** - Language Server Protocol support
7. **Test Runner Plugin** - Test execution and result parsing

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

## WebSocket Events (Port 50505)

The Manager broadcasts events via WebSocket for real-time updates:

```typescript
const ws = new WebSocket('ws://localhost:50505');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  switch (data.type) {
    case 'SessionCreated':
      // Handle new session
      break;
    case 'PaneOutput':
      // Handle terminal output
      break;
    // ... handle other events
  }
};
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

### From Orchestrator to Manager

1. Update imports:
   ```typescript
   // Old
   import { orchestrator } from '$lib/stores/orchestrator';
   
   // New
   import { manager } from '$lib/stores/manager';
   ```

2. Update method calls:
   ```typescript
   // Old
   orchestrator.createSession(name);
   
   // New
   manager.createSession(name);
   ```

3. Update action types to PascalCase:
   ```typescript
   // Old
   { type: 'create_session', name: 'Test' }
   
   // New
   { type: 'CreateSession', params: { name: 'Test' } }
   ```

## Advanced Features

### Custom Actions

Extend the Manager with custom actions:

```rust
// In your plugin
match action {
    "custom_action" => {
        // Handle custom action
        Ok(json!({ "status": "completed" }))
    }
    _ => Err("Unknown action".to_string())
}
```

### Event Filtering

Subscribe to specific event types:

```typescript
manager.onEvent('PaneOutput', (event) => {
  if (event.pane_id === myPaneId) {
    // Handle output for specific pane
  }
});
```

### State Snapshots

Create and restore state snapshots:

```rust
// Create snapshot
let snapshot = manager.create_snapshot().await?;

// Restore snapshot
manager.restore_snapshot(snapshot).await?;
```