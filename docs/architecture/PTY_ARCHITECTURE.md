# PTY Architecture in orchflow

## Overview

orchflow uses a sophisticated pseudo-terminal (PTY) architecture to provide reliable, cross-platform terminal emulation. This document describes the current implementation and design decisions.

## Core Components

### Backend (Rust/Tauri)

- **PTY Library**: `portable-pty` v0.8 - Cross-platform pseudo-terminal support
- **Architecture Layers**:
  - `TerminalStreamManager`: High-level terminal coordination
  - `PtyManager`: PTY lifecycle management and blocking operations
  - `IpcHandler`: Frontend-backend communication bridge
  - `Protocol`: Message types and data structures

### Frontend (Svelte/TypeScript)

- **Terminal Emulator**: `@xterm/xterm` with WebGL renderer
- **Components**:
  - `TerminalPanel.svelte`: Multi-terminal management and layout
  - `StreamingTerminal.svelte`: Individual terminal instances

## Architecture Diagram

```
┌─────────────────────────────┐
│   Frontend (xterm.js)       │
└──────────────┬──────────────┘
               │ Base64 encoded data
┌──────────────▼──────────────┐
│      Tauri IPC Layer        │
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│  TerminalStreamManager      │ ← Orchestrates terminal operations
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│      IpcHandler             │ ← Routes messages & encodes data
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│      PtyManager             │ ← Manages PTY lifecycle
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│  Blocking Thread Pool       │ ← Isolates blocking I/O
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│     portable-pty            │ ← Actual PTY implementation
└─────────────────────────────┘
```

## Data Flow

### Terminal Creation

1. Frontend calls `create_streaming_terminal` Tauri command
2. `TerminalStreamManager` creates terminal via `PtyManager`
3. `PtyManager` spawns PTY in blocking thread pool
4. PTY output streams through broadcast channels
5. `IpcHandler` forwards to frontend via Tauri events

### Input/Output Flow

**Input Path**:
```
Frontend → Tauri Command → IpcHandler → Input Channel → PTY Process
```

**Output Path**:
```
PTY Process → Broadcast Channel → IpcHandler → Base64 → Tauri Event → Frontend
```

## Key Design Decisions

### Blocking Thread Isolation

PTY operations run in `tokio::task::spawn_blocking` because:
- PTY I/O is inherently blocking
- Avoids Send/Sync trait complications
- Prevents blocking the async runtime

### Channel Architecture

- **Output**: Broadcast channel for multiple subscribers
- **Input**: Unbounded MPSC for sequential processing
- **Control**: Separate channel for resize/shutdown
- **Process Info**: Request/response with oneshot channels

### Base64 Encoding

Terminal data is Base64 encoded for IPC:
- Ensures binary safety over JSON
- Preserves escape sequences
- Handles non-UTF8 data correctly

## Event System

### Frontend Events
- `terminal:output` - Streaming terminal data
- `terminal:exit` - Process termination
- `terminal:error` - Error notifications
- `terminal:state` - State changes (resize, mode)

### Backend Channels
- Output broadcast for fan-out
- Input MPSC for ordering
- Control channel for management
- Process info for status queries

## Advanced Features

### Terminal Management
- Dynamic resize support
- Process health monitoring
- Terminal restart capability
- Broadcast to multiple terminals
- Terminal groups and templates

### Performance Optimizations
- WebGL renderer for GPU acceleration
- Efficient binary data handling
- Non-blocking architecture
- Configurable scrollback buffer

## Implementation Example

```rust
// Creating a terminal
let terminal = PtyManager::create_terminal(TerminalConfig {
    shell: Some("/bin/zsh".into()),
    cwd: Some("/home/user/project".into()),
    env: HashMap::new(),
    size: PtySize { rows: 24, cols: 80 },
})?;

// Handling output
let mut output_rx = terminal.subscribe_output();
tokio::spawn(async move {
    while let Ok(data) = output_rx.recv().await {
        let encoded = base64::encode(&data);
        app_handle.emit_all("terminal:output", TerminalOutput {
            terminal_id,
            data: encoded,
        })?;
    }
});
```

## Future Considerations

- Terminal recording and playback
- Advanced tmux integration
- Remote terminal support
- Performance profiling tools

This architecture provides a robust foundation for terminal emulation while maintaining cross-platform compatibility and performance.