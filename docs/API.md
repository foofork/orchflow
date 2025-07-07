# OrchFlow API Reference

## Overview

OrchFlow provides multiple APIs for different integration points:

1. **Tauri IPC API** - Frontend to backend communication
2. **WebSocket API** - Real-time event streaming
3. **Module API** - Module development interface
4. **REST API** - HTTP endpoints for external tools

## Tauri IPC API

All IPC commands return promises and handle errors automatically.

### Session Management

#### `db_create_session`
Create a new development session.

```typescript
const session = await invoke('db_create_session', {
  name: 'My Project',
  projectPath: '/path/to/project'
});
// Returns: { id: string, name: string, created_at: string }
```

#### `db_get_session`
Get session by ID.

```typescript
const session = await invoke('db_get_session', {
  id: 'session-uuid'
});
```

#### `db_list_sessions`
List all sessions.

```typescript
const sessions = await invoke('db_list_sessions');
// Returns: Session[]
```

### Terminal Management

#### `tmux_create_session`
Create a new tmux session.

```typescript
const sessionId = await invoke('tmux_create_session', {
  name: 'dev-session'
});
// Returns: string (session ID)
```

#### `tmux_create_pane`
Create a new pane in session.

```typescript
const paneId = await invoke('tmux_create_pane', {
  sessionId: 'dev-session',
  command: 'npm run dev'
});
// Returns: string (pane ID)
```

#### `tmux_split_pane`
Split an existing pane.

```typescript
const newPaneId = await invoke('tmux_split_pane', {
  paneId: 'existing-pane-id',
  direction: 'horizontal', // or 'vertical'
  size: 50 // percentage
});
```

#### `tmux_send_keys`
Send keystrokes to a pane.

```typescript
await invoke('tmux_send_keys', {
  paneId: 'pane-id',
  keys: 'ls -la\n'
});
```

#### `tmux_capture_pane`
Capture pane output.

```typescript
const output = await invoke('tmux_capture_pane', {
  paneId: 'pane-id',
  start: -100, // lines from end
  end: -1
});
// Returns: string (terminal output)
```

### Editor Management

#### `nvim_create_instance`
Create a new Neovim instance.

```typescript
const instanceId = await invoke('nvim_create_instance');
// Returns: string (instance ID)
```

#### `nvim_open_file`
Open file in Neovim instance.

```typescript
await invoke('nvim_open_file', {
  instanceId: 'nvim-instance-id',
  path: '/path/to/file.js'
});
```

#### `nvim_execute_command`
Execute Vim command.

```typescript
const result = await invoke('nvim_execute_command', {
  instanceId: 'nvim-instance-id',
  command: ':w'
});
```

#### `nvim_get_buffer`
Get current buffer content.

```typescript
const content = await invoke('nvim_get_buffer', {
  instanceId: 'nvim-instance-id'
});
// Returns: { path: string, content: string, modified: boolean }
```

### Layout Management

#### `create_layout`
Create a new layout.

```typescript
const layout = await invoke('create_layout', {
  name: 'dev-layout',
  type: 'grid'
});
// Returns: GridLayout
```

#### `split_layout_pane`
Split a layout pane.

```typescript
await invoke('split_layout_pane', {
  layoutId: 'layout-id',
  paneId: 'pane-id',
  direction: 'horizontal'
});
```

#### `db_save_layout`
Save layout to database.

```typescript
await invoke('db_save_layout', {
  sessionId: 'session-id',
  name: 'My Layout',
  config: layoutConfig
});
```

### Module Management

#### `module_scan`
Scan for available modules.

```typescript
const modules = await invoke('module_scan');
// Returns: ModuleInfo[]
```

#### `module_enable`
Enable a module.

```typescript
await invoke('module_enable', {
  moduleId: 'my-module'
});
```

#### `module_execute`
Execute module command.

```typescript
const result = await invoke('module_execute', {
  moduleId: 'my-module',
  command: 'generate-tests',
  args: ['/path/to/file.js']
});
```

## WebSocket API

Connect to `ws://localhost:8080/ws` for real-time updates.

### Message Format

All messages use JSON with this structure:

```typescript
interface WebSocketMessage {
  type: string;
  event: string;
  data: any;
  timestamp: string;
}
```

### Event Types

#### Terminal Events

```javascript
// Terminal output
{
  type: 'terminal',
  event: 'output',
  data: {
    paneId: 'pane-123',
    content: 'npm start\n> my-app@1.0.0 start...'
  }
}

// Terminal error
{
  type: 'terminal',
  event: 'error',
  data: {
    paneId: 'pane-123',
    error: 'Command not found'
  }
}
```

#### Editor Events

```javascript
// File opened
{
  type: 'editor',
  event: 'file_opened',
  data: {
    instanceId: 'nvim-123',
    path: '/src/index.js'
  }
}

// Buffer modified
{
  type: 'editor',
  event: 'buffer_modified',
  data: {
    instanceId: 'nvim-123',
    path: '/src/index.js',
    modified: true
  }
}
```

#### System Events

```javascript
// Module loaded
{
  type: 'system',
  event: 'module_loaded',
  data: {
    moduleId: 'my-module',
    version: '1.0.0'
  }
}

// Resource usage
{
  type: 'system',
  event: 'metrics',
  data: {
    cpu: 23.5,
    memory: 1024,
    terminals: 3,
    editors: 2
  }
}
```

### Client Example

```javascript
const ws = new WebSocket('ws://localhost:8080/ws');

ws.onopen = () => {
  console.log('Connected to OrchFlow');
  
  // Subscribe to specific events
  ws.send(JSON.stringify({
    action: 'subscribe',
    events: ['terminal.output', 'editor.file_opened']
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Event:', message.event, message.data);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};
```

## REST API

HTTP endpoints for external tool integration.

### Base URL
```
http://localhost:8080/api
```

### Authentication
```
Authorization: Bearer <api-token>
```

### Endpoints

#### `GET /sessions`
List all sessions.

```bash
curl http://localhost:8080/api/sessions \
  -H "Authorization: Bearer $TOKEN"
```

Response:
```json
{
  "sessions": [
    {
      "id": "abc123",
      "name": "My Project",
      "created_at": "2024-01-01T00:00:00Z",
      "last_active": "2024-01-01T12:00:00Z"
    }
  ]
}
```

#### `POST /sessions`
Create new session.

```bash
curl -X POST http://localhost:8080/api/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Project",
    "projectPath": "/path/to/project"
  }'
```

#### `POST /terminals`
Create new terminal.

```bash
curl -X POST http://localhost:8080/api/terminals \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "abc123",
    "command": "npm run dev"
  }'
```

#### `POST /terminals/:id/command`
Send command to terminal.

```bash
curl -X POST http://localhost:8080/api/terminals/pane-123/command \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "ls -la"
  }'
```

#### `GET /terminals/:id/output`
Get terminal output.

```bash
curl http://localhost:8080/api/terminals/pane-123/output \
  -H "Authorization: Bearer $TOKEN"
```

#### `POST /editors`
Create new editor instance.

```bash
curl -X POST http://localhost:8080/api/editors \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "file": "/src/index.js"
  }'
```

#### `GET /modules`
List installed modules.

```bash
curl http://localhost:8080/api/modules \
  -H "Authorization: Bearer $TOKEN"
```

#### `POST /modules/:id/execute`
Execute module command.

```bash
curl -X POST http://localhost:8080/api/modules/my-module/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "generate-tests",
    "args": ["/src/index.js"]
  }'
```

## Error Handling

All APIs use consistent error format:

```typescript
interface ApiError {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `SESSION_NOT_FOUND` | Session ID does not exist |
| `PANE_NOT_FOUND` | Terminal pane not found |
| `INSTANCE_NOT_FOUND` | Neovim instance not found |
| `MODULE_NOT_FOUND` | Module not installed |
| `PERMISSION_DENIED` | Insufficient permissions |
| `INVALID_REQUEST` | Request validation failed |
| `INTERNAL_ERROR` | Server error |

### Error Example

```json
{
  "error": {
    "code": "PANE_NOT_FOUND",
    "message": "Terminal pane 'pane-xyz' does not exist",
    "details": {
      "paneId": "pane-xyz",
      "sessionId": "session-123"
    }
  }
}
```

## Rate Limiting

API requests are rate limited:

- **IPC API**: No limit (local only)
- **WebSocket**: 100 messages/second
- **REST API**: 60 requests/minute

Rate limit headers:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1704067200
```

## Versioning

API version is included in responses:

```
X-API-Version: 1.0.0
```

Breaking changes will increment major version.

## SDK Libraries

Official SDKs available:

- **JavaScript/TypeScript**: `@orchflow/sdk`
- **Python**: `orchflow-sdk`
- **Go**: `github.com/orchflow/sdk-go`
- **Rust**: `orchflow-sdk`

### JavaScript SDK Example

```javascript
import { OrchFlow } from '@orchflow/sdk';

const client = new OrchFlow({
  apiKey: process.env.ORCHFLOW_API_KEY
});

// Create session
const session = await client.sessions.create({
  name: 'My Project'
});

// Create terminal
const terminal = await client.terminals.create({
  sessionId: session.id,
  command: 'npm run dev'
});

// Listen for output
terminal.on('output', (data) => {
  console.log('Terminal:', data);
});

// Send command
await terminal.send('ls -la\n');
```

## CLI Integration

Use OrchFlow from command line:

```bash
# Create session
orchflow session create --name "My Project"

# List sessions
orchflow session list

# Create terminal
orchflow terminal create --session abc123 --cmd "npm start"

# Send command
orchflow terminal send --id pane-123 "ls -la"

# Execute module
orchflow module exec my-module generate-tests /src/index.js
```

## Debugging

Enable debug logging:

```bash
# Tauri app
RUST_LOG=debug orchflow

# API server
DEBUG=orchflow:* npm start

# WebSocket
WS_DEBUG=true orchflow
```

## Support

- [API Documentation](https://orchflow.dev/api)
- [SDK Examples](https://github.com/orchflow/examples)
- [Community Discord](https://discord.gg/orchflow)