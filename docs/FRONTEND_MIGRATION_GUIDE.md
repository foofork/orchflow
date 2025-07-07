# Frontend Migration Guide: Orchestrator to Manager API

This guide helps migrate frontend components from the old orchestrator API to the new Manager API.

## Overview

The Manager API is the new Rust-based backend that replaces the TypeScript orchestrator. It provides better performance, type safety, and direct integration with the terminal backend.

## Key Changes

### 1. Import Changes

**Old:**
```typescript
import { orchestrator, activeSession, activePane } from '$lib/stores/orchestrator';
import { orchestratorClient } from '$lib/api/orchestrator-client';
```

**New:**
```typescript
import { manager, activeSession, activePane } from '$lib/stores/manager';
import { managerClient } from '$lib/api/manager-client';
```

### 2. Action Types

The action types have changed from lowercase to PascalCase:

**Old:**
```typescript
orchestratorClient.execute({ type: 'create_session', name: 'My Session' })
```

**New:**
```typescript
managerClient.execute({ type: 'CreateSession', name: 'My Session' })
```

### 3. Direct Command Methods

Many operations now have direct Tauri commands instead of going through the action system:

**Old:**
```typescript
const sessions = await orchestratorClient.execute({ type: 'list_sessions' });
```

**New:**
```typescript
const sessions = await managerClient.getSessions();
```

### 4. Store API Changes

The store methods remain mostly the same, but with improved typing:

**Old:**
```typescript
await orchestrator.createTerminal(sessionId, { title: 'Terminal 1' });
```

**New:**
```typescript
await manager.createTerminal(sessionId, { name: 'Terminal 1' });
```

### 5. Event Handling

Events now use PascalCase and WebSocket for real-time updates:

**Old:**
```typescript
orchestratorClient.onEvent('pane_created', (event) => {
  // Handle event
});
```

**New:**
```typescript
managerClient.onEvent('PaneCreated', (event) => {
  // Handle event
});
```

## Migration Steps

### Step 1: Update Imports

Search and replace all imports:
- `'$lib/stores/orchestrator'` → `'$lib/stores/manager'`
- `'$lib/api/orchestrator-client'` → `'$lib/api/manager-client'`
- `orchestrator` → `manager`
- `orchestratorClient` → `managerClient`

### Step 2: Update Action Types

Update all action type strings to PascalCase:
- `create_session` → `CreateSession`
- `create_pane` → `CreatePane`
- `send_input` → `SendInput`
- `close_pane` → `ClosePane`
- etc.

### Step 3: Use Direct Commands

Replace action executions with direct commands where available:

```typescript
// Sessions
await managerClient.getSessions();
await managerClient.getSession(sessionId);

// Panes
await managerClient.getPanes(sessionId);
await managerClient.getPane(paneId);
await managerClient.selectBackendPane(paneId);

// Plugins
await managerClient.listPlugins();
await managerClient.getPluginMetadata(pluginId);

// Files
await managerClient.readFile(path);
await managerClient.saveFile(path, content);
await managerClient.listDirectory(path);

// State
await managerClient.persistState();
```

### Step 4: Update Event Handlers

Update event type strings and ensure WebSocket connection:

```typescript
// The manager store automatically connects to WebSocket
// Just update event type names to PascalCase
```

### Step 5: Update Type Imports

Update any type imports to use the new types:

```typescript
import type { Session, Pane, PluginInfo } from '$lib/api/manager-client';
```

## Component Examples

### Terminal Component

**Old:**
```svelte
<script lang="ts">
  import { orchestrator } from '$lib/stores/orchestrator';
  
  async function createTerminal() {
    await orchestrator.createTerminal($activeSession?.id);
  }
</script>
```

**New:**
```svelte
<script lang="ts">
  import { manager } from '$lib/stores/manager';
  
  async function createTerminal() {
    await manager.createTerminal($activeSession?.id);
  }
</script>
```

### Plugin List Component

**Old:**
```svelte
<script lang="ts">
  import { orchestratorClient } from '$lib/api/orchestrator-client';
  
  let plugins = [];
  
  onMount(async () => {
    plugins = await orchestratorClient.execute({ type: 'list_plugins' });
  });
</script>
```

**New:**
```svelte
<script lang="ts">
  import { plugins } from '$lib/stores/manager';
  // Plugins are automatically loaded and kept in sync
</script>

{#each $plugins as plugin}
  <div>{plugin.name}</div>
{/each}
```

### File Editor Component

**Old:**
```svelte
<script lang="ts">
  import { orchestratorClient } from '$lib/api/orchestrator-client';
  
  async function saveFile() {
    await orchestratorClient.execute({
      type: 'update_file',
      path: filePath,
      content: editorContent
    });
  }
</script>
```

**New:**
```svelte
<script lang="ts">
  import { manager } from '$lib/stores/manager';
  
  async function saveFile() {
    await manager.saveFile(filePath, editorContent);
  }
</script>
```

## Testing the Migration

1. **Check Console**: Look for any errors related to undefined methods or incorrect action types
2. **Verify Events**: Ensure real-time updates are working (terminal output, file changes, etc.)
3. **Test Commands**: Try all major operations (create session, create terminal, etc.)
4. **Check Types**: TypeScript should catch most type mismatches

## Rollback Plan

If you need to temporarily rollback:

1. Keep both stores available during migration
2. Use feature flags to switch between old and new API
3. Components can import from either store based on a flag

```typescript
import { orchestrator } from '$lib/stores/orchestrator';
import { manager } from '$lib/stores/manager';
import { USE_NEW_API } from '$lib/config';

const store = USE_NEW_API ? manager : orchestrator;
```

## Benefits of Migration

1. **Better Performance**: Direct Rust backend, no TypeScript middleware
2. **Type Safety**: Full TypeScript types matching Rust structures
3. **Real-time Updates**: WebSocket connection for instant updates
4. **More Features**: Access to new features like terminal streaming, advanced search
5. **Better Error Handling**: Structured errors with context

## Common Issues

### Issue: "orchestrator_execute is not defined"
**Solution**: Make sure you're using the managerClient, not orchestratorClient

### Issue: Events not updating
**Solution**: Check WebSocket connection on port 50505

### Issue: Types don't match
**Solution**: Update to new PascalCase action types and new type definitions

### Issue: Missing functionality
**Solution**: Some features may need to use the action system via `execute()`