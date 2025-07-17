# OrchFlow API Documentation 📚

Complete API reference for programmatic OrchFlow usage.

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Core Classes](#core-classes)
4. [Configuration](#configuration)
5. [Events](#events)
6. [MCP Tools](#mcp-tools)
7. [TypeScript Types](#typescript-types)
8. [Examples](#examples)

## Overview

OrchFlow provides both command-line and programmatic APIs for natural language orchestration. The API is designed for:

- **Integration**: Embed OrchFlow in existing applications
- **Automation**: Script complex orchestration workflows
- **Customization**: Build custom worker types and behaviors
- **Monitoring**: Real-time system observation and control

## Installation

```bash
npm install @orchflow/claude-flow
```

### TypeScript Support

OrchFlow is written in TypeScript with full type definitions:

```typescript
import { MainOrchestrator, OrchFlowConfig } from '@orchflow/claude-flow';
```

## Core Classes

### MainOrchestrator

Main entry point for programmatic OrchFlow usage.

```typescript
import { MainOrchestrator } from '@orchflow/claude-flow';

const orchestrator = new MainOrchestrator({
  maxWorkers: 8,
  enableNaturalLanguage: true,
  debugMode: false
});

await orchestrator.initialize();
```

#### Constructor Options

```typescript
interface MainOrchestratorConfig {
  orchestrator: OrchFlowOrchestratorConfig;
  splitScreen: SplitScreenConfig;
  enableNaturalLanguage: boolean;
  enableQuickAccess: boolean;
  maxWorkers: number;
  debugMode: boolean;
}
```

#### Methods

##### `initialize(): Promise<void>`

Initialize the complete OrchFlow system.

```typescript
await orchestrator.initialize();
```

##### `processNaturalLanguageInput(input: string, context?: any[]): Promise<any>`

Process natural language input and execute appropriate actions.

```typescript
const result = await orchestrator.processNaturalLanguageInput(
  "Build a React component for user profiles",
  []
);

console.log(result);
// {
//   success: true,
//   action: 'task_created',
//   workerId: 'worker_123',
//   workerName: 'React Component Developer'
// }
```

##### `shutdown(): Promise<void>`

Gracefully shutdown the orchestrator.

```typescript
await orchestrator.shutdown();
```

##### `getSystemInfo(): any`

Get current system information.

```typescript
const info = orchestrator.getSystemInfo();
console.log(info);
// {
//   version: '0.1.0',
//   isRunning: true,
//   workers: [...],
//   activeSessions: [...]
// }
```

### OrchFlowOrchestrator

Core orchestration engine for task and worker management.

```typescript
import { OrchFlowOrchestrator } from '@orchflow/claude-flow';

const orchestrator = new OrchFlowOrchestrator({
  mcpPort: 3001,
  stateConfig: { database: './state.json' },
  workerConfig: { maxWorkers: 8 }
});
```

#### Methods

##### `spawnWorkerWithDescriptiveName(task: Task): Promise<string>`

Spawn a worker with a context-aware descriptive name.

```typescript
const task = {
  id: 'task_123',
  type: 'code',
  description: 'Build authentication system',
  // ... other task properties
};

const workerId = await orchestrator.spawnWorkerWithDescriptiveName(task);
// Creates worker named "Auth System Builder"
```

##### `submitTask(task: Task): Promise<void>`

Submit a task for execution.

```typescript
await orchestrator.submitTask({
  id: 'task_456',
  type: 'test',
  description: 'Test user registration flow',
  dependencies: [],
  status: 'pending',
  priority: 5
});
```

### WorkerManager

Manages worker lifecycle and operations.

```typescript
import { WorkerManager } from '@orchflow/claude-flow';

const workerManager = new WorkerManager({
  maxWorkers: 8,
  resourceLimits: {
    maxCpu: 80,
    maxMemory: 2048
  }
});
```

#### Methods

##### `spawnWorker(type: string, config: any): Promise<string>`

Spawn a new worker.

```typescript
const workerId = await workerManager.spawnWorker('code', {
  descriptiveName: 'React Developer',
  quickAccessKey: 1,
  command: 'claude-flow sparc run coder "Build React components"'
});
```

##### `listWorkers(): Promise<Worker[]>`

List all active workers.

```typescript
const workers = await workerManager.listWorkers();
workers.forEach(worker => {
  console.log(`${worker.descriptiveName}: ${worker.status}`);
});
```

##### `pauseWorker(workerIdOrName: string): Promise<void>`

Pause a specific worker.

```typescript
await workerManager.pauseWorker('React Developer');
// or
await workerManager.pauseWorker('worker_123');
```

### StateManager

Manages persistent state and session snapshots.

```typescript
import { StateManager } from '@orchflow/claude-flow';

const stateManager = new StateManager({
  database: './orchflow-state.json',
  autoSave: true,
  saveInterval: 30000
});
```

#### Methods

##### `persistTask(task: Task): Promise<void>`

Persist task state.

```typescript
await stateManager.persistTask(task);
```

##### `createSnapshot(name?: string): Promise<string>`

Create a session snapshot.

```typescript
const snapshotPath = await stateManager.createSnapshot('before_refactor');
```

##### `restoreSnapshot(snapshotPath: string): Promise<void>`

Restore from a snapshot.

```typescript
await stateManager.restoreSnapshot('./snapshots/before_refactor.json');
```

### AdvancedWorkerAccess

Provides smart worker search and connection capabilities.

```typescript
import { AdvancedWorkerAccess } from '@orchflow/claude-flow';

const workerAccess = new AdvancedWorkerAccess(tmuxBackend);
```

#### Methods

##### `findWorkers(query: string, limit?: number): WorkerSearchResult[]`

Find workers using fuzzy search.

```typescript
const results = workerAccess.findWorkers('react', 5);
results.forEach(result => {
  console.log(`${result.worker.descriptiveName} (confidence: ${result.confidence})`);
});
```

##### `connectToWorker(query: string): Promise<WorkerAccessSession>`

Connect to a worker using natural language.

```typescript
const session = await workerAccess.connectToWorker('auth builder');
console.log(`Connected to: ${session.workerName}`);
```

##### `quickAccess(key: number): Promise<WorkerAccessSession>`

Connect using quick access key.

```typescript
const session = await workerAccess.quickAccess(1);
```

## Configuration

### OrchFlowConfig

Main configuration interface:

```typescript
interface OrchFlowConfig {
  orchestratorPort?: number;
  statusPaneWidth?: number;
  enableQuickAccess?: boolean;
  maxWorkers?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}
```

### Usage

```typescript
import { initializeOrchFlow } from '@orchflow/claude-flow';

await initializeOrchFlow({
  orchestratorPort: 3001,
  statusPaneWidth: 30,
  enableQuickAccess: true,
  maxWorkers: 10,
  logLevel: 'info'
});
```

## Events

OrchFlow uses EventEmitter for real-time communication.

### MainOrchestrator Events

```typescript
orchestrator.on('initialized', () => {
  console.log('OrchFlow is ready!');
});

orchestrator.on('statusUpdate', (data) => {
  console.log('Status update:', data);
});
```

### Worker Events

```typescript
workerManager.on('workerSpawned', (worker) => {
  console.log(`Worker spawned: ${worker.descriptiveName}`);
});

workerManager.on('workerStopped', (worker) => {
  console.log(`Worker stopped: ${worker.descriptiveName}`);
});

workerManager.on('workerError', ({ worker, error }) => {
  console.error(`Worker error: ${worker.descriptiveName}`, error);
});
```

### Task Events

```typescript
orchestrator.on('taskCompleted', (task) => {
  console.log(`Task completed: ${task.description}`);
});

orchestrator.on('taskFailed', (task) => {
  console.error(`Task failed: ${task.description}`);
});
```

## MCP Tools

OrchFlow registers MCP tools for Claude integration.

### Available Tools

#### `orchflow_spawn_worker`

Create a new worker for parallel task execution.

```typescript
const result = await mcpServer.callTool('orchflow_spawn_worker', {
  task: 'Build REST API for user management',
  type: 'developer',
  parentContext: {
    sharedKnowledge: {
      apiVersion: 'v1',
      authMethod: 'JWT'
    }
  }
});
```

#### `orchflow_worker_status`

Get the status of all workers or a specific worker.

```typescript
const result = await mcpServer.callTool('orchflow_worker_status', {
  workerId: 'worker-123' // optional
});
```

#### `orchflow_switch_context`

Switch the conversation context to a specific worker.

```typescript
const result = await mcpServer.callTool('orchflow_switch_context', {
  workerId: 'worker-123',
  preserveHistory: true
});
```

#### `orchflow_share_knowledge`

Share information, decisions, or code between workers.

```typescript
const result = await mcpServer.callTool('orchflow_share_knowledge', {
  knowledge: {
    apiEndpoint: 'https://api.example.com/v1',
    authToken: 'Bearer token-here'
  },
  targetWorkers: ['worker-123', 'worker-456']
});
```

#### `orchflow_merge_work`

Merge results from multiple workers.

```typescript
const result = await mcpServer.callTool('orchflow_merge_work', {
  workerIds: ['worker-123', 'worker-456'],
  strategy: 'combine'
});
```

#### `orchflow_save_session`

Save the current orchestration session state.

```typescript
const result = await mcpServer.callTool('orchflow_save_session', {
  name: 'auth-system-project',
  description: 'Authentication system development session'
});
```

#### `orchflow_restore_session`

Restore a previously saved orchestration session.

```typescript
const result = await mcpServer.callTool('orchflow_restore_session', {
  name: 'auth-system-project'
});
```

### Custom MCP Tools

Register custom tools:

```typescript
import { createEnhancedMCPTools } from '@orchflow/claude-flow';

const customTools = createEnhancedMCPTools(orchestrator);
customTools.forEach(tool => {
  mcpServer.registerTool(tool.name, tool);
});
```

## TypeScript Types

### Core Types

```typescript
interface Task {
  id: string;
  type: 'research' | 'code' | 'test' | 'analysis' | 'swarm' | 'hive-mind';
  description: string;
  parameters: any;
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'blocked';
  assignedWorker?: string;
  assignedWorkerName?: string;
  priority: number;
  estimatedDuration?: number;
  claudeFlowCommand?: string;
  config?: any;
  deadline?: string;
  createdAt?: Date;
  updatedAt?: Date;
  error?: string;
}

interface Worker {
  id: string;
  type: string;
  descriptiveName: string;
  status: 'spawning' | 'running' | 'paused' | 'stopped' | 'error';
  process?: ChildProcess;
  tmuxSession?: string;
  currentTask?: Task;
  quickAccessKey?: number;
  resources: {
    cpuUsage: number;
    memoryUsage: number;
  };
  capabilities: string[];
  startTime: Date;
  lastActivity: Date;
  output: string[];
  connection?: {
    type: 'tmux' | 'process';
    sessionName?: string;
    pid?: number;
  };
  config?: any;
}

interface WorkerSearchResult {
  worker: Worker;
  confidence: number;
  matchType: 'exact' | 'partial' | 'fuzzy' | 'numeric';
  matchField: 'name' | 'description' | 'quickKey';
}

interface WorkerAccessSession {
  workerId: string;
  workerName: string;
  paneId: string;
  startTime: Date;
  lastActivity: Date;
  isActive: boolean;
}
```

### Configuration Types

```typescript
interface MainOrchestratorConfig {
  orchestrator: OrchFlowOrchestratorConfig;
  splitScreen: SplitScreenConfig;
  enableNaturalLanguage: boolean;
  enableQuickAccess: boolean;
  maxWorkers: number;
  debugMode: boolean;
}

interface SplitScreenConfig {
  primaryWidth: number;
  statusWidth: number;
  sessionName?: string;
  enableQuickAccess?: boolean;
}

interface WorkerConfig {
  maxWorkers: number;
  workerTimeout?: number;
  resourceLimits?: {
    maxCpu?: number;
    maxMemory?: number;
  };
}
```

## Examples

### Basic Usage

```typescript
import { MainOrchestrator } from '@orchflow/claude-flow';

async function main() {
  const orchestrator = new MainOrchestrator({
    maxWorkers: 8,
    enableNaturalLanguage: true
  });

  await orchestrator.initialize();

  // Create a task
  const result = await orchestrator.processNaturalLanguageInput(
    "Build a React component for user authentication"
  );

  console.log('Task created:', result);

  // Monitor system
  orchestrator.on('statusUpdate', (status) => {
    console.log('System status:', status);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    await orchestrator.shutdown();
    process.exit(0);
  });
}

main().catch(console.error);
```

### Advanced Worker Management

```typescript
import { WorkerManager } from '@orchflow/claude-flow';

async function workerManagement() {
  const manager = new WorkerManager({ maxWorkers: 5 });

  // Spawn custom worker
  const workerId = await manager.spawnWorker('code', {
    descriptiveName: 'Custom React Developer',
    quickAccessKey: 1,
    command: 'claude-flow sparc run coder "Build React components"'
  });

  // Monitor worker events
  manager.on('workerSpawned', (worker) => {
    console.log(`Spawned: ${worker.descriptiveName}`);
  });

  manager.on('workerError', ({ worker, error }) => {
    console.error(`Error in ${worker.descriptiveName}:`, error);
  });

  // List and manage workers
  const workers = await manager.listWorkers();
  for (const worker of workers) {
    if (worker.status === 'error') {
      await manager.stopWorker(worker.id);
    }
  }
}
```

### Session Management

```typescript
import { StateManager } from '@orchflow/claude-flow';

async function sessionManagement() {
  const stateManager = new StateManager({
    database: './session.json',
    autoSave: true
  });

  await stateManager.initialize();

  // Create snapshot before major operation
  const snapshotPath = await stateManager.createSnapshot('before_refactor');
  console.log('Snapshot created:', snapshotPath);

  // Perform operations...
  
  // If something goes wrong, restore
  try {
    // ... risky operations
  } catch (error) {
    console.log('Restoring from snapshot...');
    await stateManager.restoreSnapshot(snapshotPath);
  }

  // List all snapshots
  const snapshots = await stateManager.listSnapshots();
  console.log('Available snapshots:', snapshots);
}
```

### Custom MCP Integration

```typescript
import { MCPServer } from '@orchflow/claude-flow';

async function customMCP() {
  const mcpServer = new MCPServer(3001);
  await mcpServer.start();

  // Register custom tool
  mcpServer.registerTool('custom_deploy', {
    name: 'custom_deploy',
    description: 'Deploy application to production',
    parameters: {
      type: 'object',
      properties: {
        environment: { type: 'string' },
        branch: { type: 'string' }
      }
    },
    handler: async (params) => {
      // Custom deployment logic
      console.log(`Deploying ${params.branch} to ${params.environment}`);
      return { success: true, deploymentId: 'deploy_123' };
    }
  });

  console.log('Custom MCP server running on port 3001');
}
```

---

**For more examples and detailed usage patterns, see the [Examples](EXAMPLES.md) documentation.**