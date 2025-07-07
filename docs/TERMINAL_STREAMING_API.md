# Terminal Streaming API Documentation

## Overview

The Terminal Streaming API provides real-time terminal output streaming and input handling through Tauri's IPC mechanism. This system replaces traditional WebSocket-based terminal communication with a more efficient, native IPC approach.

## Architecture

### Components

1. **PTY Manager** (`pty_manager.rs`)
   - Manages pseudo-terminal (PTY) processes
   - Handles process lifecycle and I/O
   - Provides process health monitoring

2. **IPC Handler** (`ipc_handler.rs`)
   - Bridges PTY output to Tauri events
   - Handles base64 encoding for binary-safe transmission
   - Manages event dispatching

3. **Buffer Management** (`buffer.rs`)
   - Ring buffer for efficient scrollback
   - Configurable size limits (10,000 lines / 10MB default)
   - Thread-safe access

4. **State Management** (`state.rs`)
   - Tracks terminal state (mode, cursor position)
   - Manages terminal metadata
   - Provides state synchronization

## API Reference

### Tauri Commands

#### `create_streaming_terminal`
Creates a new terminal instance with PTY support.

```rust
#[tauri::command]
async fn create_streaming_terminal(
    terminal_id: String,
    shell: Option<String>,
    cwd: Option<String>,
    env: Option<std::collections::HashMap<String, String>>,
    manager: State<'_, Arc<TerminalStreamManager>>,
) -> Result<TerminalMetadata, String>
```

**Parameters:**
- `terminal_id`: Unique identifier for the terminal
- `shell`: Optional shell command (defaults to system shell)
- `cwd`: Optional working directory
- `env`: Optional environment variables

**Returns:** `TerminalMetadata` containing terminal information

#### `send_terminal_input`
Sends input to a specific terminal.

```rust
#[tauri::command]
async fn send_terminal_input(
    terminal_id: String,
    data: String,
    manager: State<'_, Arc<TerminalStreamManager>>,
) -> Result<(), String>
```

**Parameters:**
- `terminal_id`: Target terminal ID
- `data`: Input text to send

#### `resize_streaming_terminal`
Resizes the terminal dimensions.

```rust
#[tauri::command]
async fn resize_streaming_terminal(
    terminal_id: String,
    rows: u16,
    cols: u16,
    manager: State<'_, Arc<TerminalStreamManager>>,
) -> Result<(), String>
```

#### `close_streaming_terminal`
Closes a terminal and cleans up resources.

```rust
#[tauri::command]
async fn close_streaming_terminal(
    terminal_id: String,
    manager: State<'_, Arc<TerminalStreamManager>>,
) -> Result<(), String>
```

#### `get_terminal_buffer`
Retrieves the current terminal buffer content.

```rust
#[tauri::command]
async fn get_terminal_buffer(
    terminal_id: String,
    manager: State<'_, Arc<TerminalStreamManager>>,
) -> Result<String, String>
```

#### `list_streaming_terminals`
Lists all active terminal IDs.

```rust
#[tauri::command]
async fn list_streaming_terminals(
    manager: State<'_, Arc<TerminalStreamManager>>,
) -> Result<Vec<String>, String>
```

#### `get_terminal_state`
Gets the current state of a terminal.

```rust
#[tauri::command]
async fn get_terminal_state(
    terminal_id: String,
    manager: State<'_, Arc<TerminalStreamManager>>,
) -> Result<TerminalState, String>
```

#### `get_terminal_process_info`
Retrieves process information for a terminal.

```rust
#[tauri::command]
async fn get_terminal_process_info(
    terminal_id: String,
    manager: State<'_, Arc<TerminalStreamManager>>,
) -> Result<ProcessInfo, String>
```

#### `monitor_terminal_health`
Checks the health status of a terminal.

```rust
#[tauri::command]
async fn monitor_terminal_health(
    terminal_id: String,
    manager: State<'_, Arc<TerminalStreamManager>>,
) -> Result<TerminalHealth, String>
```

#### `restart_terminal_process`
Restarts a terminal process that has stopped.

```rust
#[tauri::command]
async fn restart_terminal_process(
    terminal_id: String,
    manager: State<'_, Arc<TerminalStreamManager>>,
) -> Result<ProcessInfo, String>
```

### Events

The Terminal Streaming API emits the following events via Tauri's event system:

#### `terminal:output`
Emitted when terminal produces output.

```typescript
interface TerminalOutputEvent {
  terminal_id: string;
  data: string; // Base64 encoded
}
```

#### `terminal:exit`
Emitted when terminal process exits.

```typescript
interface TerminalExitEvent {
  terminal_id: string;
  exit_code: number;
}
```

#### `terminal:error`
Emitted when an error occurs.

```typescript
interface TerminalErrorEvent {
  terminal_id: string;
  error: string;
}
```

#### `terminal:state`
Emitted when terminal state changes.

```typescript
interface TerminalStateEvent {
  terminal_id: string;
  state: TerminalState;
}
```

## Frontend Integration

### TypeScript Service (`terminal-ipc.ts`)

```typescript
import { invoke } from '@tauri-apps/api/tauri';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export class TerminalIPC {
  private listeners: Map<string, UnlistenFn> = new Map();
  
  async createTerminal(
    terminalId: string,
    options?: CreateTerminalOptions
  ): Promise<TerminalMetadata> {
    return await invoke('create_streaming_terminal', {
      terminal_id: terminalId,
      shell: options?.shell,
      cwd: options?.cwd,
      env: options?.env
    });
  }
  
  async sendInput(terminalId: string, data: string): Promise<void> {
    return await invoke('send_terminal_input', {
      terminal_id: terminalId,
      data
    });
  }
  
  async onOutput(
    terminalId: string,
    callback: (data: string) => void
  ): Promise<UnlistenFn> {
    return await listen<TerminalOutputEvent>('terminal:output', (event) => {
      if (event.payload.terminal_id === terminalId) {
        const decoded = atob(event.payload.data);
        callback(decoded);
      }
    });
  }
}
```

### Svelte Component Example

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Terminal } from '@xterm/xterm';
  import { TerminalIPC } from '$lib/services/terminal-ipc';
  
  export let terminalId: string;
  
  let terminal: Terminal;
  let ipc = new TerminalIPC();
  let unlisten: UnlistenFn;
  
  onMount(async () => {
    // Initialize xterm.js
    terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14
    });
    
    // Create backend terminal
    await ipc.createTerminal(terminalId);
    
    // Listen for output
    unlisten = await ipc.onOutput(terminalId, (data) => {
      terminal.write(data);
    });
    
    // Handle input
    terminal.onData((data) => {
      ipc.sendInput(terminalId, data);
    });
  });
  
  onDestroy(() => {
    unlisten?.();
    terminal?.dispose();
  });
</script>
```

## Performance Considerations

### Buffering
- Output is buffered with a 16ms flush interval (~60fps)
- Prevents UI flooding with rapid output
- Configurable buffer size limits

### Base64 Encoding
- Required for binary-safe transmission through JSON
- Minimal overhead for text data
- Ensures ANSI escape sequences are preserved

### Process Monitoring
- Health checks run periodically
- Automatic restart capability for crashed processes
- Resource usage tracking (future enhancement)

## Error Handling

All commands return `Result<T, String>` where errors include:
- Terminal not found
- Process spawn failures
- I/O errors
- Invalid parameters

Example error handling in TypeScript:

```typescript
try {
  await ipc.createTerminal(terminalId);
} catch (error) {
  console.error('Failed to create terminal:', error);
  // Handle error appropriately
}
```

## Best Practices

1. **Terminal ID Management**
   - Use UUIDs or unique identifiers
   - Clean up terminals when done
   - Track terminal lifecycle in frontend

2. **Input Handling**
   - Batch rapid keystrokes when possible
   - Handle special keys appropriately
   - Consider input validation

3. **Output Processing**
   - Decode base64 on receipt
   - Handle ANSI escape sequences
   - Implement scrollback limits

4. **Resource Management**
   - Close terminals when not needed
   - Monitor process health
   - Handle reconnection scenarios

## Migration from WebSocket

If migrating from WebSocket-based terminal:

1. Replace WebSocket connection with IPC calls
2. Update event listeners to use Tauri events
3. Change from binary frames to base64 strings
4. Update error handling for IPC pattern

## Future Enhancements

- Resource usage metrics
- Session recording/replay
- Synchronized terminal groups
- Advanced process control (signals, etc.)