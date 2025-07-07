# Migration Guide: From Separate to Unified Orchestrator

## Overview

The orchflow orchestrator has been refactored from having two separate classes (`Orchestrator` and `EnhancedOrchestrator`) to a single unified `Orchestrator` class with optional features.

## Key Changes

### 1. Import Changes

**Before:**
```typescript
import { Orchestrator } from './index';
// or
import { EnhancedOrchestrator } from './core/enhanced-orchestrator';
```

**After:**
```typescript
import { Orchestrator } from './orchestrator';
// or
import { Orchestrator } from './index'; // index.ts now exports from orchestrator.ts
```

### 2. Class Usage

**Before:**
```typescript
// Basic orchestrator
const orchestrator = new Orchestrator({ sessionName: 'my-session' });

// Enhanced orchestrator
const orchestrator = new EnhancedOrchestrator({ 
  sessionName: 'my-session',
  enableSessions: true,
  // ... other features
});
```

**After:**
```typescript
// Unified orchestrator with smart defaults
const orchestrator = new Orchestrator({ 
  sessionName: 'my-session',
  // Features are enabled by default, disable what you don't need
  enableMemory: false,  // Example: disable memory feature
  enableSwarm: false,   // Example: disable swarm feature
});
```

### 3. Default Feature Settings

The unified orchestrator enables most features by default:

- ✅ `enableWebSocket`: true
- ✅ `enableSessions`: true
- ✅ `enableProtocols`: true
- ✅ `enableCache`: true
- ✅ `enableModes`: true
- ✅ `enableCircuitBreakers`: true
- ✅ `enableResourceManager`: true
- ❌ `enableMemory`: false (requires storage setup)
- ✅ `enableMetrics`: true
- ❌ `enableScheduler`: false (adds overhead)
- ❌ `enableTerminalPool`: false (requires tmux)
- ❌ `enableMCP`: false (requires server config)
- ❌ `enableSwarm`: false (requires scheduler)

### 4. New Methods Available

The unified orchestrator now exposes previously internal methods:

```typescript
// Memory management (if enabled)
await orchestrator.remember(key, value, metadata);
const value = await orchestrator.recall(key);
const results = await orchestrator.searchMemory(query);
await orchestrator.forget(key);

// Task management (if scheduler enabled)
const taskId = await orchestrator.submitTask(task);
const status = await orchestrator.getTaskStatus(taskId);
await orchestrator.cancelTask(taskId);

// Agent management
await orchestrator.stopAgent(agentId); // Now properly implemented
```

### 5. Configuration Structure

**Full configuration example:**
```typescript
const orchestrator = new Orchestrator({
  // Core config
  sessionName: 'my-app',
  port: 8080,
  dataDir: '.orchflow',
  
  // Feature flags
  enableWebSocket: true,
  enableSessions: true,
  enableProtocols: true,
  enableCache: true,
  enableModes: true,
  enableCircuitBreakers: true,
  enableResourceManager: true,
  enableMemory: true,
  enableMetrics: true,
  enableScheduler: true,
  enableTerminalPool: true,
  enableMCP: true,
  enableSwarm: true,
  
  // Feature-specific config
  mcpServers: [{
    id: 'my-server',
    name: 'My MCP Server',
    version: '1.0.0',
    endpoint: 'http://localhost:3000',
    transport: 'http',
  }],
  
  cacheConfig: {
    defaultTTL: 300000,  // 5 minutes
    maxSize: 1000,
  },
  
  terminalPoolConfig: {
    minSize: 2,
    maxSize: 10,
    idleTimeout: 300000,
  },
});
```

### 6. Breaking Changes

1. **`EnhancedOrchestrator` class removed** - Use `Orchestrator` instead
2. **Import paths changed** - Update all imports
3. **Some internal managers no longer directly accessible** - Use the proxy methods on the orchestrator

### 7. Feature Detection

You can check which features are enabled:

```typescript
const status = await orchestrator.getStatus();
console.log('Enabled features:', status.features);
// Output: ['core', 'websocket', 'sessions', 'protocols', ...]
```

## Migration Steps

1. **Update imports** in all files from `EnhancedOrchestrator` to `Orchestrator`
2. **Remove feature enable flags** for features you want (they're on by default)
3. **Add disable flags** for features you don't need
4. **Update method calls** to use new exposed methods
5. **Test your application** with the new unified orchestrator

## Benefits

- **Simpler API**: One class for everything
- **Smart defaults**: Most features enabled out of the box
- **Better performance**: Unused features don't add overhead
- **Cleaner codebase**: No duplicate orchestrator logic
- **Future-proof**: New features just add to config options