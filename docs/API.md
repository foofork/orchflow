# orchflow API Reference

## Overview

orchflow provides a comprehensive API through Tauri IPC commands for terminal management, file operations, and development workflow orchestration.

## Current Architecture

The API is built on:
- **Manager Pattern**: Centralized management of terminals, files, and state
- **PTY Streaming**: Real-time terminal I/O using portable-pty
- **Unified State**: Consistent state management across all components
- **WebSocket Events**: Real-time updates for UI synchronization

See [PTY Architecture](architecture/PTY_ARCHITECTURE.md) for terminal implementation details.

## Terminal Streaming API

### `create_streaming_terminal`
Create a new streaming terminal with PTY support.

```typescript
const terminal = await invoke('create_streaming_terminal', {
  config: {
    shell: '/bin/zsh',  // optional, defaults to system shell
    cwd: '/path/to/project',  // optional
    env: { KEY: 'value' },  // optional environment variables
    rows: 24,
    cols: 80
  }
});
// Returns: { terminal_id: string }
```

### `send_terminal_input`
Send input to a terminal.

```typescript
// Text input
await invoke('send_terminal_input', {
  terminalId: 'term-123',
  data: 'ls -la\n'
});

// Special keys
await invoke('send_terminal_key', {
  terminalId: 'term-123',
  key: 'Enter',
  modifiers: { ctrl: true }
});
```

### `resize_streaming_terminal`
Resize terminal dimensions.

```typescript
await invoke('resize_streaming_terminal', {
  terminalId: 'term-123',
  rows: 30,
  cols: 120
});
```

### Terminal Events

Listen for terminal output and state changes:

```typescript
import { listen } from '@tauri-apps/api/event';

// Terminal output (Base64 encoded)
await listen('terminal:output', (event) => {
  const { terminal_id, data } = event.payload;
  const decoded = atob(data);  // Decode Base64
  // Update terminal display
});

// Terminal exit
await listen('terminal:exit', (event) => {
  const { terminal_id, exit_code } = event.payload;
});
```

## File Management API

### `get_file_tree`
Get directory tree structure.

```typescript
const tree = await invoke('get_file_tree', {
  path: '/project/path',
  showHidden: false,
  gitStatus: true  // Include git status
});
// Returns: FileNode with children
```

### `create_file` / `create_directory`
Create files and directories.

```typescript
await invoke('create_file', {
  path: '/project/src/new-file.ts',
  content: '// New file'
});

await invoke('create_directory', {
  path: '/project/src/components'
});
```

### `move_files` / `copy_files`
Move or copy files with trash support.

```typescript
await invoke('move_files', {
  sources: ['/path/file1.ts', '/path/file2.ts'],
  destination: '/new/path/',
  useTrash: true  // Move to trash instead of delete
});
```

## Search API

### `search_project`
Project-wide search with ripgrep.

```typescript
const results = await invoke('search_project', {
  query: 'TODO',
  options: {
    regex: true,
    caseSensitive: false,
    wholeWord: false,
    includePatterns: ['*.ts', '*.tsx'],
    excludePatterns: ['node_modules', '.git'],
    maxResults: 1000
  }
});
// Returns: SearchResult[] with matches and context
```

### `replace_in_files`
Search and replace across files.

```typescript
const changes = await invoke('replace_in_files', {
  searchQuery: 'oldFunction',
  replaceWith: 'newFunction',
  files: ['/src/file1.ts', '/src/file2.ts'],
  options: { regex: false, caseSensitive: true }
});
// Returns: FileChange[] with preview
```

## Git Integration API

### `get_file_git_status`
Get git status for files.

```typescript
const status = await invoke('get_file_git_status', {
  path: '/project/src/file.ts'
});
// Returns: 'modified' | 'untracked' | 'ignored' | etc.
```

### `get_git_branch_info`
Get current branch information.

```typescript
const branch = await invoke('get_git_branch_info', {
  projectPath: '/project'
});
// Returns: { name: string, remote: string, ahead: number, behind: number }
```

## State Management API

### `create_session`
Create a new development session.

```typescript
const session = await invoke('create_session', {
  name: 'My Project',
  projectPath: '/path/to/project'
});
// Returns: Session object with id
```

### `get_unified_layout`
Get current layout configuration.

```typescript
const layout = await invoke('get_unified_layout', {
  sessionId: 'session-123'
});
// Returns: LayoutNode tree structure
```

## Manager/Orchestrator API

### `orchestrator_execute`
Execute orchestrator actions (terminal, file, plugin operations).

```typescript
const result = await invoke('orchestrator_execute', {
  action: {
    type: 'CreateTerminal',
    payload: { shell: '/bin/bash' }
  }
});
```

### `list_plugins`
Get loaded plugins.

```typescript
const plugins = await invoke('list_plugins');
// Returns: PluginMetadata[]
```

## WebSocket Events

For real-time updates, connect to the WebSocket endpoint:

```typescript
const ws = new WebSocket('ws://localhost:9999');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle events: terminal updates, file changes, etc.
};
```

## Future Architecture

orchflow is designed with a unified architecture that will eventually support both desktop and web deployments. See [Unified Architecture](ORCHFLOW_UNIFIED_ARCHITECTURE.md) for the long-term vision.

Future additions will include:
- **AI Agent API**: Natural language commands and agent orchestration
- **Cloud Sync API**: Settings and session synchronization
- **Collaboration API**: Real-time shared sessions
- **Plugin Marketplace API**: Discovery and installation

Currently, all APIs are desktop-focused using Tauri IPC.