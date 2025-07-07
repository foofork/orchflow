# OrchFlow API Reference

This document maps all Tauri commands to their REST-like equivalents and provides comprehensive API documentation.

## Table of Contents

1. [Command Structure](#command-structure)
2. [Terminal Management](#terminal-management)
3. [Layout Management](#layout-management)
4. [Editor Integration](#editor-integration)
5. [State Management](#state-management)
6. [Module System](#module-system)
7. [Update System](#update-system)
8. [Metrics & Monitoring](#metrics--monitoring)
9. [File Operations](#file-operations)
10. [Events](#events)

## Command Structure

All Tauri commands follow a consistent pattern:

```typescript
// Frontend invocation
const result = await invoke<ReturnType>('command_name', {
  param1: value1,
  param2: value2
});

// REST equivalent
POST /api/command_name
{
  "param1": value1,
  "param2": value2
}
```

### Error Handling

All commands return errors as strings. Successful responses vary by command.

```typescript
try {
  const result = await invoke('command', { arg: 'value' });
} catch (error: string) {
  console.error('Command failed:', error);
}
```

## Terminal Management

### tmux_create_session

Creates a new tmux session with orchestrator setup.

**Command**: `tmux_create_session`

**Parameters**:
```typescript
{
  session_name: string;  // Unique session identifier
}
```

**Returns**: `string` - Session ID

**REST Equivalent**:
```
POST /api/tmux/sessions
{
  "session_name": "main"
}
```

**Example**:
```typescript
const sessionId = await invoke<string>('tmux_create_session', {
  session_name: 'dev-session'
});
```

---

### tmux_list_sessions

Lists all active tmux sessions.

**Command**: `tmux_list_sessions`

**Parameters**: None

**Returns**: `SessionInfo[]`
```typescript
interface SessionInfo {
  name: string;
  windows: number;
  created: string;
  attached: boolean;
}
```

**REST Equivalent**:
```
GET /api/tmux/sessions
```

---

### tmux_create_pane

Creates a new pane in a tmux window.

**Command**: `tmux_create_pane`

**Parameters**:
```typescript
{
  session_name: string;
  window_id?: number;    // Optional, defaults to current
  split_type?: 'horizontal' | 'vertical';
  size?: number;         // Percentage (0-100)
  start_directory?: string;
}
```

**Returns**: `string` - Pane ID

**REST Equivalent**:
```
POST /api/tmux/sessions/{session_name}/panes
{
  "window_id": 0,
  "split_type": "vertical",
  "size": 50
}
```

---

### tmux_send_keys

Sends keystrokes to a tmux pane.

**Command**: `tmux_send_keys`

**Parameters**:
```typescript
{
  session_name: string;
  pane_id: string;
  keys: string;
  enter?: boolean;  // Append Enter key
}
```

**Returns**: `void`

**REST Equivalent**:
```
POST /api/tmux/sessions/{session_name}/panes/{pane_id}/keys
{
  "keys": "ls -la",
  "enter": true
}
```

---

### tmux_capture_pane

Captures the content of a tmux pane.

**Command**: `tmux_capture_pane`

**Parameters**:
```typescript
{
  session_name: string;
  pane_id: string;
  history?: number;  // Lines of history to capture
}
```

**Returns**: `string` - Pane content

**REST Equivalent**:
```
GET /api/tmux/sessions/{session_name}/panes/{pane_id}/content?history=100
```

## Layout Management

### create_layout

Creates a new grid-based layout.

**Command**: `create_layout`

**Parameters**:
```typescript
{
  layout_id: string;
  rows: number;
  cols: number;
}
```

**Returns**: `GridLayout`
```typescript
interface GridLayout {
  id: string;
  rows: number;
  cols: number;
  panes: GridPane[];
}
```

**REST Equivalent**:
```
POST /api/layouts
{
  "layout_id": "main",
  "rows": 2,
  "cols": 2
}
```

---

### split_layout_pane

Splits an existing pane in the layout.

**Command**: `split_layout_pane`

**Parameters**:
```typescript
{
  layout_id: string;
  pane_id: string;
  direction: 'horizontal' | 'vertical';
  ratio?: number;  // Split ratio (0.0-1.0)
}
```

**Returns**: `[string, string]` - IDs of resulting panes

**REST Equivalent**:
```
POST /api/layouts/{layout_id}/panes/{pane_id}/split
{
  "direction": "horizontal",
  "ratio": 0.5
}
```

## Editor Integration

### nvim_create_instance

Creates a new Neovim instance.

**Command**: `nvim_create_instance`

**Parameters**:
```typescript
{
  instance_id: string;
  working_dir?: string;
}
```

**Returns**: `void`

**REST Equivalent**:
```
POST /api/neovim/instances
{
  "instance_id": "editor-1",
  "working_dir": "/home/user/project"
}
```

---

### nvim_open_file

Opens a file in Neovim.

**Command**: `nvim_open_file`

**Parameters**:
```typescript
{
  instance_id: string;
  file_path: string;
  line?: number;
  column?: number;
}
```

**Returns**: `void`

**REST Equivalent**:
```
POST /api/neovim/instances/{instance_id}/open
{
  "file_path": "/src/main.rs",
  "line": 42,
  "column": 10
}
```

---

### nvim_execute_command

Executes a Vim command.

**Command**: `nvim_execute_command`

**Parameters**:
```typescript
{
  instance_id: string;
  command: string;
}
```

**Returns**: `string` - Command output

**REST Equivalent**:
```
POST /api/neovim/instances/{instance_id}/command
{
  "command": ":set number"
}
```

## State Management

### db_create_session

Creates a new work session.

**Command**: `db_create_session`

**Parameters**:
```typescript
{
  name: string;
  project_path?: string;
  metadata?: Record<string, any>;
}
```

**Returns**: `Session`
```typescript
interface Session {
  id: string;
  name: string;
  project_path?: string;
  created_at: string;
  last_active: string;
  metadata: Record<string, any>;
}
```

**REST Equivalent**:
```
POST /api/sessions
{
  "name": "Feature Development",
  "project_path": "/home/user/project"
}
```

---

### db_save_layout

Saves the current layout configuration.

**Command**: `db_save_layout`

**Parameters**:
```typescript
{
  session_id: string;
  layout: GridLayout;
  name?: string;
}
```

**Returns**: `string` - Layout ID

**REST Equivalent**:
```
POST /api/sessions/{session_id}/layouts
{
  "layout": { ... },
  "name": "Development Layout"
}
```

---

### db_get_setting

Retrieves a configuration setting.

**Command**: `db_get_setting`

**Parameters**:
```typescript
{
  key: string;
  default_value?: any;
}
```

**Returns**: `any` - Setting value

**REST Equivalent**:
```
GET /api/settings/{key}
```

---

### db_set_setting

Updates a configuration setting.

**Command**: `db_set_setting`

**Parameters**:
```typescript
{
  key: string;
  value: any;
}
```

**Returns**: `void`

**REST Equivalent**:
```
PUT /api/settings/{key}
{
  "value": { ... }
}
```

## Module System

### module_scan

Scans for available modules/extensions.

**Command**: `module_scan`

**Parameters**: None

**Returns**: `ModuleInfo[]`
```typescript
interface ModuleInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
  commands: string[];
}
```

**REST Equivalent**:
```
GET /api/modules
```

---

### module_enable

Enables or disables a module.

**Command**: `module_enable`

**Parameters**:
```typescript
{
  module_id: string;
  enabled: boolean;
}
```

**Returns**: `void`

**REST Equivalent**:
```
PATCH /api/modules/{module_id}
{
  "enabled": true
}
```

---

### module_execute

Executes a module command.

**Command**: `module_execute`

**Parameters**:
```typescript
{
  module_id: string;
  command: string;
  args?: Record<string, any>;
}
```

**Returns**: `any` - Command result

**REST Equivalent**:
```
POST /api/modules/{module_id}/commands/{command}
{
  "args": { ... }
}
```

## Update System

### check_for_update

Checks for available application updates.

**Command**: `check_for_update`

**Parameters**: None

**Returns**: `UpdateStatus`
```typescript
interface UpdateStatus {
  available: boolean;
  version?: string;
  notes?: string;
  pub_date?: string;
  error?: string;
}
```

**REST Equivalent**:
```
GET /api/updates/check
```

---

### download_and_install_update

Downloads and installs an available update.

**Command**: `download_and_install_update`

**Parameters**: None

**Returns**: `void`

**Events Emitted**:
- `update-progress`: Download progress
- `update-downloaded`: Download complete
- `update-error`: Error occurred

**REST Equivalent**:
```
POST /api/updates/install
```

---

### get_current_version

Gets the current application version.

**Command**: `get_current_version`

**Parameters**: None

**Returns**: `string` - Version string

**REST Equivalent**:
```
GET /api/version
```

## Metrics & Monitoring

### get_system_metrics

Retrieves current system metrics.

**Command**: `get_system_metrics`

**Parameters**: None

**Returns**: `SystemMetrics`
```typescript
interface SystemMetrics {
  timestamp: number;
  cpu_usage: number;
  memory_used: number;
  memory_total: number;
  disk_used: number;
  disk_total: number;
  process_count: number;
  network_rx: number;
  network_tx: number;
}
```

**REST Equivalent**:
```
GET /api/metrics/system
```

## File Operations

### get_current_dir

Gets the current working directory.

**Command**: `get_current_dir`

**Parameters**: None

**Returns**: `string` - Directory path

**REST Equivalent**:
```
GET /api/fs/cwd
```

## Events

OrchFlow uses a bidirectional event system for real-time updates.

### Listening to Events

```typescript
import { listen } from '@tauri-apps/api/event';

const unlisten = await listen<PayloadType>('event-name', (event) => {
  console.log('Event received:', event.payload);
});

// Clean up
unlisten();
```

### Available Events

#### System Events
- `startup-complete`: App initialization finished
- `window-focus`: Window gained focus
- `window-blur`: Window lost focus

#### Update Events
- `update-available`: New version available
- `update-progress`: Download progress
- `update-downloaded`: Update ready to install
- `update-error`: Update error occurred

#### Session Events
- `session-created`: New session created
- `session-activated`: Session switched
- `session-closed`: Session terminated

#### Terminal Events
- `terminal-output`: Terminal produced output
- `terminal-exit`: Terminal process exited

#### Metrics Events
- `metrics-update`: New metrics data available

### WebSocket Events (Future)

For real-time communication in web contexts:

```typescript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.on('message', (data) => {
  const event = JSON.parse(data);
  switch (event.type) {
    case 'metrics-update':
      updateMetrics(event.payload);
      break;
  }
});
```

## Error Codes

Standard error responses follow this format:

```typescript
interface ErrorResponse {
  code: string;
  message: string;
  details?: any;
}
```

Common error codes:
- `SESSION_NOT_FOUND`: Session doesn't exist
- `PANE_NOT_FOUND`: Pane doesn't exist
- `INVALID_LAYOUT`: Layout configuration invalid
- `NEOVIM_ERROR`: Neovim operation failed
- `DATABASE_ERROR`: Database operation failed
- `PERMISSION_DENIED`: Insufficient permissions
- `NETWORK_ERROR`: Network request failed

## Rate Limiting

Commands that interact with external processes may be rate-limited:
- Terminal operations: 100/second
- File operations: 50/second
- Database writes: 30/second

## Migration Guide

For migrating from direct IPC to REST API:

```typescript
// Before (Tauri IPC)
const result = await invoke('tmux_create_session', {
  session_name: 'main'
});

// After (REST API)
const response = await fetch('/api/tmux/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ session_name: 'main' })
});
const result = await response.json();
```

## Authentication (Future)

Future versions will support API authentication:

```typescript
// Bearer token authentication
const response = await fetch('/api/sessions', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```