# TypeScript Orchestrator Migration Analysis

## Overview
This document identifies TypeScript files in the frontend that use the old orchestrator pattern and need to be migrated to use the new Rust orchestrator API through Tauri commands.

## Files Using Old Orchestrator Pattern

### 1. `/lib/api/orchestrator-client.ts`
**Current Pattern**: HTTP/WebSocket client connecting to `http://localhost:8080`
- **HTTP endpoints**: `/api/agents`, `/api/execute`, `/api/metrics`
- **WebSocket**: Connects to `ws://localhost:8080/ws`
- **Migration needed**: Replace with Tauri commands

### 2. `/lib/stores/orchestrator.ts`
**Current Pattern**: WebSocket store connecting to `ws://localhost:8081`
- **WebSocket events**: `gui:attach`, `state:initial`, `state:update`, `tab:*`, `agent:*`
- **HTTP endpoints**: `http://localhost:3000/api/command`, `http://localhost:3000/api/terminals`
- **Migration needed**: Replace with Tauri commands and events

### 3. `/lib/stores/tauri-orchestrator.ts`
**Current Pattern**: Hybrid approach using tmux directly
- **Already using**: Tauri's tmux module
- **Missing**: Full orchestrator integration
- **Migration needed**: Integrate with Rust orchestrator commands

### 4. `/lib/services/metrics.ts`
**Current Pattern**: Mixed approach - checks for Tauri but falls back to HTTP
- **HTTP endpoint**: `/api/metrics`
- **WebSocket**: `ws://localhost:8081/metrics`
- **Already has**: Tauri integration check
- **Migration needed**: Complete Tauri integration

## Components Using Orchestrator

### Direct Store Usage
1. **Terminal.svelte**: Uses `terminalOutputs`, `send` from orchestrator store
2. **CommandBar.svelte**: Uses non-existent orchestrator methods (`execute`, `getSuggestions`)
3. **Dashboard.svelte**: Uses `agents`, `connected`, `metrics`, `createTerminal`
4. **TabBar.svelte**: Likely uses tab-related orchestrator functions
5. **StatusBar.svelte**: Likely uses connection status and metrics
6. **DebugPanel.svelte**: Likely uses agent and debugging functions

## Current Rust Orchestrator Commands

The Rust backend provides these Tauri commands:
- `orchestrator_execute(action: Action)` - Main execution interface
- `orchestrator_subscribe(events: Vec<String>)` - Event subscription (placeholder)

### Available Actions
```rust
pub enum Action {
    // Terminal actions
    CreatePane { session_id, pane_type, command, shell_type, name },
    RunCommand { pane_id, command },
    GetOutput { pane_id, lines },
    RenamePane { pane_id, name },
    // ... more actions
}
```

## Migration Strategy

### Phase 1: Create TypeScript Bindings
1. Create `/lib/tauri/orchestrator.ts` with type-safe wrappers for:
   - `orchestrator_execute` command
   - Action types matching Rust enum
   - Response types

### Phase 2: Update Stores
1. **orchestrator.ts**: Replace WebSocket with Tauri events
2. **tauri-orchestrator.ts**: Use orchestrator commands instead of direct tmux
3. Create unified store that works with Tauri orchestrator

### Phase 3: Update Components
1. Update all components to use new Tauri-based stores
2. Remove HTTP/WebSocket dependencies
3. Handle Tauri events properly

### Phase 4: Remove Old Code
1. Remove `orchestrator-client.ts`
2. Remove WebSocket connection code
3. Clean up unused HTTP endpoints

## Key Differences to Handle

1. **Event System**: WebSocket → Tauri events
2. **Command Execution**: HTTP POST → Tauri commands
3. **State Management**: Server-pushed state → Client-managed with Tauri events
4. **Error Handling**: HTTP errors → Tauri command errors
5. **Connection Management**: WebSocket reconnection → Tauri always connected

## Priority Order

1. Create TypeScript bindings for orchestrator commands
2. Update metrics service (already partially migrated)
3. Update terminal management (core functionality)
4. Update dashboard and status components
5. Clean up old code

## Notes

- The Rust orchestrator is already integrated with tmux backend
- File manager, search, and other features are available through separate Tauri commands
- Consider using Tauri's event system for real-time updates instead of WebSocket