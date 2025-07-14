# Orchflow API Reference

This document provides a comprehensive reference for all public APIs discovered through code analysis. All endpoints, parameters, and responses are documented based on actual implementation.

## Table of Contents

1. [Tauri Command Handlers (IPC API)](#tauri-command-handlers-ipc-api)
2. [Manager Client API](#manager-client-api)
3. [JSON-RPC 2.0 API (Muxd Server)](#json-rpc-20-api-muxd-server)
4. [WebSocket APIs](#websocket-apis)
5. [REST API Endpoints](#rest-api-endpoints)
6. [Error Codes](#error-codes)

## Tauri Command Handlers (IPC API)

The primary API for frontend-backend communication. All commands are invoked via Tauri's IPC bridge.

### Session Management

#### `manager_execute` - Execute Manager Actions
```typescript
invoke('manager_execute', { action: ManagerAction })

// Action Types:
interface ManagerAction {
  type: 'CreateSession' | 'DeleteSession' | 'RenameSession' | 'SelectSession' | ...
  // Additional properties based on action type
}
```

##### CreateSession
```typescript
{ type: 'CreateSession', name: string }
// Returns: { id: string, name: string, created_at: number }
```

##### DeleteSession
```typescript
{ type: 'DeleteSession', sessionId: string }
// Returns: boolean
```

##### RenameSession
```typescript
{ type: 'RenameSession', sessionId: string, name: string }
// Returns: boolean
```

##### SelectSession
```typescript
{ type: 'SelectSession', sessionId: string }
// Returns: void
```

### Pane Management

##### CreatePane
```typescript
{ type: 'CreatePane', sessionId: string, command?: string }
// Returns: { id: string, session_id: string, created_at: number }
```

##### DeletePane
```typescript
{ type: 'DeletePane', paneId: string }
// Returns: boolean
```

##### SendInput
```typescript
{ type: 'SendInput', paneId: string, data: string }
// Returns: void
```

##### ResizePane
```typescript
{ type: 'ResizePane', paneId: string, cols: number, rows: number }
// Returns: void
```

### Terminal Operations

#### `stream_terminal_output`
```typescript
invoke('stream_terminal_output', { sessionId: string })
// Starts streaming terminal output via WebSocket events
```

#### `stop_terminal_stream`
```typescript
invoke('stop_terminal_stream', { sessionId: string })
// Stops terminal output streaming
```

#### `get_terminal_buffer`
```typescript
invoke('get_terminal_buffer', { sessionId: string, lines?: number })
// Returns: string[] (terminal output lines)
```

### File Operations

#### `read_file`
```typescript
invoke('read_file', { path: string })
// Returns: string (file contents)
```

#### `write_file`
```typescript
invoke('write_file', { path: string, content: string })
// Returns: void
```

#### `create_file`
```typescript
invoke('create_file', { path: string })
// Returns: void
```

#### `delete_file`
```typescript
invoke('delete_file', { path: string })
// Returns: void
```

#### `rename_file`
```typescript
invoke('rename_file', { oldPath: string, newPath: string })
// Returns: void
```

#### `list_directory`
```typescript
invoke('list_directory', { path: string })
// Returns: FileEntry[]

interface FileEntry {
  name: string
  path: string
  is_dir: boolean
  size?: number
  modified?: number
}
```

### Search Operations

#### `search_files`
```typescript
invoke('search_files', { 
  directory: string, 
  pattern: string, 
  maxResults?: number 
})
// Returns: SearchResult[]

interface SearchResult {
  path: string
  line_number: number
  line_content: string
  match_start: number
  match_end: number
}
```

#### `search_in_file`
```typescript
invoke('search_in_file', { 
  path: string, 
  pattern: string, 
  caseSensitive?: boolean 
})
// Returns: SearchMatch[]
```

### Git Integration

#### `git_status`
```typescript
invoke('git_status', { directory: string })
// Returns: GitStatus

interface GitStatus {
  modified: string[]
  added: string[]
  deleted: string[]
  untracked: string[]
}
```

#### `git_diff`
```typescript
invoke('git_diff', { path: string })
// Returns: string (diff output)
```

#### `git_commit`
```typescript
invoke('git_commit', { message: string, files: string[] })
// Returns: string (commit hash)
```

### Plugin Management

#### `load_plugin`
```typescript
invoke('load_plugin', { path: string })
// Returns: PluginInfo

interface PluginInfo {
  id: string
  name: string
  version: string
  commands: string[]
}
```

#### `execute_plugin_command`
```typescript
invoke('execute_plugin_command', { 
  pluginId: string, 
  command: string, 
  args?: any 
})
// Returns: any (plugin-specific)
```

### Neovim Integration

#### `neovim_eval`
```typescript
invoke('neovim_eval', { instanceId: string, expression: string })
// Returns: any (Neovim evaluation result)
```

#### `neovim_command`
```typescript
invoke('neovim_command', { instanceId: string, command: string })
// Returns: void
```

#### `neovim_get_mode`
```typescript
invoke('neovim_get_mode', { instanceId: string })
// Returns: { mode: string, blocking: boolean }
```

### System Operations

#### `get_system_info`
```typescript
invoke('get_system_info')
// Returns: SystemInfo

interface SystemInfo {
  os: string
  arch: string
  cpu_count: number
  memory_total: number
  memory_available: number
}
```

#### `open_external`
```typescript
invoke('open_external', { url: string })
// Opens URL in default browser
```

## Manager Client API

TypeScript/JavaScript interface for high-level operations.

### Connection Management

```typescript
class ManagerClient {
  constructor(invoke: TauriInvoke, options?: { timeout?: number })
  
  async connect(): Promise<void>
  async disconnect(): Promise<void>
  async reconnect(): Promise<void>
  
  // Event handling
  async subscribe(events: EventType[]): Promise<void>
  onEvent(event: EventType, handler: (data: any) => void): void
  
  // Execute actions
  async execute<T>(action: ManagerAction): Promise<T>
}
```

### Event Types

```typescript
type EventType = 
  | 'SessionCreated'
  | 'SessionDeleted'
  | 'SessionRenamed'
  | 'SessionSelected'
  | 'PaneCreated'
  | 'PaneDeleted'
  | 'PaneOutput'
  | 'FileModified'
  | 'PluginLoaded'
  | 'PluginCommand'
```

## JSON-RPC 2.0 API (Muxd Server)

WebSocket server on port 50505 (configurable).

### Connection

```javascript
const ws = new WebSocket('ws://localhost:50505')
```

### Request Format

```json
{
  "jsonrpc": "2.0",
  "id": "unique-id",
  "method": "method_name",
  "params": {}
}
```

### Methods

#### session.create
```json
{
  "method": "session.create",
  "params": { "name": "string" }
}
// Returns: { "id": "session-id", "name": "string" }
```

#### session.list
```json
{
  "method": "session.list",
  "params": {}
}
// Returns: [{ "id": "string", "name": "string", "panes": [...] }]
```

#### pane.create
```json
{
  "method": "pane.create",
  "params": { "session_id": "string", "command": "string" }
}
// Returns: { "id": "pane-id", "session_id": "string" }
```

#### pane.send_input
```json
{
  "method": "pane.send_input",
  "params": { "pane_id": "string", "data": "string" }
}
// Returns: null
```

#### pane.resize
```json
{
  "method": "pane.resize",
  "params": { "pane_id": "string", "cols": 80, "rows": 24 }
}
// Returns: null
```

## WebSocket APIs

### Manager WebSocket Events

Real-time events streamed from the backend.

#### Event Format
```typescript
interface WebSocketEvent {
  type: EventType
  timestamp: number
  data: any // Event-specific data
}
```

#### PaneOutput Event
```typescript
{
  type: 'PaneOutput',
  data: {
    pane_id: string
    output: string
    timestamp: number
  }
}
```

### Terminal IPC Events

Via Tauri's event system:

```typescript
listen('terminal-output', (event) => {
  const { sessionId, data } = event.payload
  // Handle terminal output
})
```

## REST API Endpoints

### AI Streaming Endpoint
```
POST /api/ai/stream
Content-Type: application/json

{
  "prompt": "string",
  "context": "string",
  "model": "string"
}

// Returns: Server-Sent Events stream
```

### System Metrics
```
GET /api/metrics
// Returns: JSON with system metrics
```

## Error Codes

### Common Error Codes

| Code | Description |
|------|-------------|
| 1001 | Session not found |
| 1002 | Pane not found |
| 1003 | File not found |
| 1004 | Permission denied |
| 1005 | Invalid parameters |
| 1006 | Plugin error |
| 1007 | Neovim error |
| 1008 | Git operation failed |
| 1009 | WebSocket connection error |
| 1010 | Timeout error |

### Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: number
    message: string
    details?: any
  }
}
```

## Additional APIs

### Cursor API
Enhanced terminal cursor tracking:

```typescript
invoke('get_cursor_position', { paneId: string })
// Returns: { x: number, y: number, visible: boolean }
```

### Public Module Exports

#### Store Exports
```typescript
// From src/lib/stores/manager.ts
export { manager, activeSession, activePanes, activePane }
export type { ManagerState, Session, Pane }
```

#### Utility Exports
```typescript
// From src/lib/utils/
export { formatBytes, formatDuration, debounce, throttle }
```

## Security Considerations

1. All file operations are sandboxed through Tauri's permission system
2. External URLs must be explicitly allowed
3. Plugin commands are isolated and validated
4. WebSocket connections are limited to localhost by default
5. Sensitive operations require explicit user confirmation

This API reference is generated from actual code analysis and represents the complete set of public interfaces available in Orchflow.