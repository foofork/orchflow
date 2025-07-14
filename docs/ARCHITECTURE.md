# Orchflow Architecture

This document describes the actual system architecture as discovered through comprehensive code analysis. All diagrams and descriptions are based on real component relationships and data flows observed in the codebase.

## System Overview

Orchflow follows a multi-tier architecture with clear separation between frontend presentation, backend services, and system integration layers.

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (SvelteKit)                      │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │   Routes    │  │  Components  │  │     Stores      │   │
│  │ +layout.sv  │  │ Terminal.sv  │  │  manager.ts     │   │
│  │ +page.sv    │  │ Editor.sv    │  │  settings.ts    │   │
│  └──────┬──────┘  └──────┬───────┘  └────────┬────────┘   │
│         │                 │                    │            │
│  ┌──────┴─────────────────┴────────────────────┴────────┐  │
│  │                    API Layer                          │  │
│  │           manager-client.ts (WebSocket + Tauri)       │  │
│  └───────────────────────┬──────────────────────────────┘  │
└──────────────────────────┼──────────────────────────────────┘
                           │ IPC/WebSocket
┌──────────────────────────┼──────────────────────────────────┐
│                    Tauri Backend                             │
│  ┌───────────────────────┴──────────────────────────────┐  │
│  │                  Rust Services                        │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐ │  │
│  │  │   Manager   │  │  Terminal   │  │   Neovim     │ │  │
│  │  │   Service   │  │   Service   │  │  Service     │ │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘ │  │
│  └─────────┼────────────────┼─────────────────┼─────────┘  │
└────────────┼────────────────┼─────────────────┼─────────────┘
             │                │                  │
┌────────────┼────────────────┼─────────────────┼─────────────┐
│            │         Muxd Server                │             │
│  ┌─────────┴──────┐  ┌──────┴──────┐  ┌──────┴───────┐    │
│  │ Session Mgr    │  │  Terminal   │  │   State      │    │
│  │                │  │    PTY      │  │ Persistence  │    │
│  └────────────────┘  └─────────────┘  └──────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Frontend Layer

#### Routes (`src/routes/`)
- **`+layout.svelte`**: Root layout with global providers
- **`+page.svelte`**: Main application page
- **`+error.svelte`**: Error boundary
- **Nested Routes**: Modular feature organization

#### Components (`src/lib/components/`)
```
components/
├── layout/           # Core layout components
│   ├── ActivityBar.svelte
│   ├── Sidebar.svelte
│   ├── TabBar.svelte
│   └── StatusBar.svelte
├── terminal/         # Terminal-related components
│   ├── Terminal.svelte
│   ├── StreamingTerminal.svelte
│   └── TerminalPanel.svelte
├── editor/           # Editor components
│   ├── NeovimEditor.svelte
│   └── CodeMirrorWrapper.svelte
├── file/             # File management
│   ├── FileExplorer.svelte
│   └── FileTree.svelte
└── common/           # Shared components
    ├── Modal.svelte
    ├── Toast.svelte
    └── Tooltip.svelte
```

#### State Management (`src/lib/stores/`)
- **`manager.ts`**: Central state store
  - Sessions, panes, plugins, settings
  - WebSocket connection state
  - Derived stores for reactive data
- **`settings.ts`**: User preferences
- **`notifications.ts`**: Toast notifications
- **`commandHistory.ts`**: Command tracking

### Backend Layer

#### Tauri Services (`desktop/src-tauri/src/`)
```
src/
├── commands/         # Tauri command handlers
│   ├── manager.rs    # Manager operations
│   ├── file.rs       # File system operations
│   ├── terminal.rs   # Terminal management
│   └── plugin.rs     # Plugin system
├── services/         # Core services
│   ├── terminal_service.rs
│   ├── neovim_service.rs
│   ├── file_watcher.rs
│   └── git_service.rs
├── state/            # Application state
│   ├── app_state.rs
│   └── session_state.rs
└── utils/            # Utilities
    ├── error.rs
    └── logger.rs
```

#### Muxd Server (`muxd/src/`)
```
src/
├── server/           # WebSocket server
│   ├── mod.rs
│   └── handlers.rs
├── session/          # Session management
│   ├── manager.rs
│   └── pane.rs
├── terminal/         # PTY handling
│   ├── pty.rs
│   └── stream.rs
└── state/            # State persistence
    └── store.rs
```

## Data Flow Patterns

### 1. Synchronous Request-Response Flow

```
User Action → Frontend Component → Store Action → API Client
    ↓
Tauri IPC → Backend Handler → Service Layer → System Call
    ↓
Response ← Store Update ← API Response ← Service Result
```

Example: Creating a new file
```typescript
// Frontend
await invoke('create_file', { path: '/project/new.js' })

// Backend
#[tauri::command]
async fn create_file(path: String) -> Result<()> {
    fs::write(&path, "")?;
    emit_file_event("created", &path);
    Ok(())
}
```

### 2. Asynchronous Event Stream Flow

```
Backend Event → WebSocket → Frontend Event Handler → Store Update
     ↑                                                    ↓
System Event                                        UI Update
```

Example: Terminal output streaming
```typescript
// Backend emits
ws.send(Event::PaneOutput { pane_id, data })

// Frontend receives
managerClient.onEvent('PaneOutput', (event) => {
    terminalStore.appendOutput(event.pane_id, event.data)
})
```

### 3. State Synchronization Flow

```
Local State Change → Store Update → Persistence Layer
        ↓                               ↓
    UI Update                    SQLite Database
```

## Communication Protocols

### Tauri IPC Protocol
- **Transport**: Native platform IPC
- **Encoding**: JSON with MessagePack for binary data
- **Security**: Sandboxed with capability-based permissions

```rust
#[tauri::command]
async fn execute_action(action: ManagerAction) -> Result<Value> {
    match action {
        ManagerAction::CreateSession { name } => {
            let session = manager.create_session(name).await?;
            Ok(json!(session))
        }
        // ... other actions
    }
}
```

### WebSocket Protocol
- **Port**: 50505 (configurable)
- **Format**: JSON-RPC 2.0
- **Events**: Real-time push notifications

```json
{
    "jsonrpc": "2.0",
    "method": "session.created",
    "params": {
        "id": "session-123",
        "name": "Main"
    }
}
```

## System Integration Points

### File System Integration
```
Frontend Request → Tauri File API → OS File System
                        ↓
                 Permission Check
                        ↓
                  File Operation
                        ↓
                  Watch Events → Frontend Updates
```

### Terminal Integration
```
User Input → Terminal Component → Muxd Server
                                      ↓
                                  PTY Process
                                      ↓
                              Shell/Application
                                      ↓
                              Output Stream
                                      ↓
                          WebSocket → Terminal Display
```

### Git Integration
```
File Change → File Watcher → Git Status Check
                                  ↓
                           Status Update Event
                                  ↓
                        UI Status Indicators
```

## Security Architecture

### Sandboxing Layers
1. **Tauri Permissions**: Capability-based access control
2. **File System**: Restricted to allowed directories
3. **Network**: Limited to localhost by default
4. **Process**: Isolated subprocess execution

### Authentication Flow
```
User → Frontend → Auth Request → Backend Validation
                                      ↓
                               Session Creation
                                      ↓
                              Token Generation
                                      ↓
                        Secure Storage (OS Keychain)
```

## Performance Optimizations

### Frontend Optimizations
- **Virtual Scrolling**: Terminal output virtualization
- **Lazy Loading**: Component code splitting
- **Memoization**: Derived store caching
- **Debouncing**: Input and search throttling

### Backend Optimizations
- **Connection Pooling**: Reused WebSocket connections
- **Async I/O**: Non-blocking operations with tokio
- **Memory Management**: Arena allocators for terminals
- **Caching**: LRU cache for file metadata

## Plugin Architecture

```
Plugin Manifest → Validation → Loading
       ↓              ↓           ↓
  metadata.json   Security    JS Module
                   Check         ↓
                              Sandbox
                                ↓
                          Command Registration
                                ↓
                          Event Subscriptions
```

### Plugin Isolation
- **Separate V8 Context**: Isolated JavaScript environment
- **Message Passing**: No direct memory access
- **Permission Model**: Explicit capability grants

## Deployment Architecture

### Desktop Application
```
Tauri Bundle
├── Binary (Platform-specific)
├── Resources
│   ├── Web Assets (Compressed)
│   └── Icons
├── Libraries
│   ├── WebView
│   └── Native Dependencies
└── Configuration
    └── Default Settings
```

### Update Mechanism
```
App Start → Version Check → Update Available?
                                ↓ Yes
                         Download Update
                                ↓
                         Verify Signature
                                ↓
                         Install & Restart
```

## Scalability Considerations

### Horizontal Scaling
- **Multiple Muxd Instances**: Session distribution
- **Load Balancing**: Round-robin terminal allocation
- **Shared State**: Redis for distributed sessions

### Vertical Scaling
- **Thread Pool**: Configurable worker threads
- **Memory Limits**: Per-session memory caps
- **Connection Limits**: Maximum concurrent terminals

## Monitoring and Observability

### Metrics Collection
```
Application → Metrics Collector → Time Series DB
                    ↓
              Aggregation
                    ↓
             Dashboard UI
```

### Key Metrics
- **Performance**: Startup time, memory usage, CPU
- **Usage**: Active sessions, commands executed
- **Errors**: Crash reports, error rates
- **Network**: WebSocket latency, throughput

This architecture provides a robust foundation for a high-performance terminal IDE with clear separation of concerns, efficient data flow, and extensibility through plugins.