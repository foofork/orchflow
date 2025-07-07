# Frontend Migration Guide: HTTP/WebSocket to Tauri Orchestrator

This guide explains how to migrate the frontend from the old HTTP/WebSocket-based orchestrator to the new Tauri-based orchestrator API.

## Overview

The migration involves replacing HTTP calls and WebSocket connections with Tauri commands and events. The new system provides:
- Better performance (no network overhead)
- Type safety with TypeScript
- Unified API through the Rust orchestrator
- Built-in error handling
- Automatic reconnection not needed (always connected)

## Key Changes

### 1. Client Initialization

**Old (HTTP/WebSocket):**
```typescript
import { orchestratorClient } from '$lib/api/orchestrator-client';

// Connect to WebSocket
orchestratorClient.connect();
```

**New (Tauri):**
```typescript
import { orchestrator } from '$lib/stores/orchestrator-v2';

// Automatically initialized, no connection needed
```

### 2. Executing Commands

**Old:**
```typescript
// Create agent
const agent = await orchestratorClient.createAgent({
  name: 'test-agent',
  agent_type: 'terminal',
  command: 'bash'
});

// Execute command
const task = await orchestratorClient.executeCommand({
  agent_id: agent.id,
  command: 'ls -la'
});
```

**New:**
```typescript
// Create terminal pane
const pane = await orchestrator.createTerminal(sessionId, {
  title: 'test-terminal',
  command: 'bash'
});

// Send input
await orchestrator.sendInput(pane.id, 'ls -la\n');
```

### 3. Event Handling

**Old:**
```typescript
// Subscribe to events
const unsubscribe = orchestratorClient.onEvent((event) => {
  switch (event.type) {
    case 'agent_output':
      console.log('Output:', event.output);
      break;
    case 'agent_status_changed':
      console.log('Status:', event.status);
      break;
  }
});
```

**New:**
```typescript
// Events are automatically handled by the store
// Subscribe to derived stores for reactive updates
import { terminalOutputs } from '$lib/stores/orchestrator-v2';

const unsubscribe = terminalOutputs.subscribe(outputs => {
  const paneOutput = outputs.get(paneId);
  // Handle output
});
```

### 4. Component Migration

**Terminal Component Example:**

Old version used `agentId` and communicated through the orchestrator store's `send` function:
```svelte
<Terminal agentId={agent.id} title={agent.name} />
```

New version uses `paneId` and communicates directly through the orchestrator:
```svelte
<Terminal-v2 paneId={pane.id} title={pane.title} />
```

### 5. Store Structure

**Old Store (`orchestrator.ts`):**
- Used WebSocket for real-time updates
- HTTP calls for actions
- Manual connection management
- Agent-based structure

**New Store (`orchestrator-v2.ts`):**
- Uses Tauri events for real-time updates
- Tauri commands for actions
- Always connected
- Session/Pane-based structure

## Migration Steps

### Step 1: Update Imports

Replace all imports of the old orchestrator client:
```typescript
// Old
import { orchestratorClient } from '$lib/api/orchestrator-client';
import { orchestrator } from '$lib/stores/orchestrator';

// New
import { orchestrator } from '$lib/stores/orchestrator-v2';
import { orchestratorClient } from '$lib/api/tauri-orchestrator-client';
```

### Step 2: Update Data Models

The new system uses Sessions and Panes instead of Agents:

```typescript
// Old
interface Agent {
  id: string;
  name: string;
  agent_type: string;
  status: string;
}

// New
interface Pane {
  id: string;
  session_id: string;
  pane_type: PaneType;
  title: string;
  // ... more fields
}
```

### Step 3: Update API Calls

Replace HTTP/WebSocket calls with Tauri commands:

```typescript
// Old: Create agent
const agent = await orchestratorClient.createAgent({ ... });

// New: Create session and pane
const session = await orchestrator.createSession('my-session');
const pane = await orchestrator.createTerminal(session.id, { ... });
```

### Step 4: Update Event Handling

Events are now handled through the store's reactive subscriptions:

```typescript
// Old: Manual event subscription
orchestratorClient.onEvent(handleEvent);

// New: Reactive store subscription
terminalOutputs.subscribe($outputs => {
  // React to output changes
});
```

### Step 5: Update Components

Update all components that interact with the orchestrator:

1. **Terminal.svelte** → **Terminal-v2.svelte**
   - Change `agentId` prop to `paneId`
   - Update input handling to use `orchestrator.sendInput()`
   - Add resize handling

2. **Dashboard.svelte**
   - Update to show sessions/panes instead of agents
   - Use new store structure

3. **TabBar.svelte**
   - Update to use panes instead of agents
   - Handle session switching

4. **CommandBar.svelte**
   - Update command execution to use new API
   - Fix type errors with proper imports

## Type Definitions

The new system provides comprehensive TypeScript types:

```typescript
// Actions - what you can do
type Action = 
  | { type: 'create_pane'; session_id: string; ... }
  | { type: 'send_input'; pane_id: string; data: string }
  | { type: 'close_pane'; pane_id: string }
  // ... many more

// Events - what happens
type OrchestratorEvent =
  | { type: 'pane_created'; pane_id: string; ... }
  | { type: 'pane_output'; pane_id: string; data: string }
  | { type: 'pane_closed'; pane_id: string }
  // ... many more
```

## Plugin Integration

The new system includes plugin support:

```typescript
// List available plugins
const plugins = await orchestrator.execute({ type: 'list_plugins' });

// Load a plugin
await orchestrator.execute({ type: 'load_plugin', id: 'git-plugin' });

// Execute plugin command
const result = await orchestrator.execute({
  type: 'plugin_command',
  plugin_id: 'git-plugin',
  command: 'git.status',
  args: { path: '/my/repo' }
});
```

## File Operations

The new orchestrator includes file management:

```typescript
// Get file tree
const tree = await orchestrator.getFileTree();

// Watch for file changes
await orchestrator.watchPath('/my/project');

// Search project
const results = await orchestrator.searchProject('TODO', {
  regex: false,
  caseSensitive: false
});
```

## Error Handling

The new system provides better error handling:

```typescript
try {
  await orchestrator.createTerminal(sessionId);
} catch (error) {
  // Errors are properly typed and include details
  console.error('Failed to create terminal:', error);
}
```

## Testing the Migration

1. Start with a single component (e.g., Terminal)
2. Update imports and props
3. Test functionality
4. Move to the next component
5. Remove old orchestrator code once all components are migrated

## Checklist

- [ ] Update all imports to use new client/store
- [ ] Replace agent-based logic with session/pane logic
- [ ] Update all API calls to use Tauri commands
- [ ] Update event handling to use reactive stores
- [ ] Update all components that use orchestrator
- [ ] Remove old HTTP/WebSocket client code
- [ ] Update TypeScript types throughout
- [ ] Test all functionality
- [ ] Remove old orchestrator store
- [ ] Update documentation