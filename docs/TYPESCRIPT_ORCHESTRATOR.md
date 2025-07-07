# TypeScript Orchestrator Documentation

> **Note**: This document covers the TypeScript Orchestrator, which provides AI-powered agent coordination and workflow automation. For information about how the Orchestrator works with the Rust Manager, see [MANAGER_ORCHESTRATOR_ARCHITECTURE.md](./MANAGER_ORCHESTRATOR_ARCHITECTURE.md).

> **Terminology Clarification**: 
> - **Rust Manager** (`/frontend/src-tauri/src/orchestrator.rs`) - Handles infrastructure: terminals, files, plugins
> - **TypeScript Orchestrator** (`/orchestrator/`) - Handles orchestration: AI agents, workflows, automation
>
> Despite the filename, the Rust component is a manager, not an orchestrator.

## Overview

The TypeScript Orchestrator is an optional orchestration system that provides AI-powered agent management, intelligent command routing, and workflow automation. It complements the Rust Manager (which handles infrastructure) by adding intelligence and coordination capabilities. It can run as a standalone service, sidecar process, or be imported as a library.

## Architecture

```
         Rust Manager                     TypeScript Orchestrator
┌────────────────────────┐        ┌────────────────────────────┐
│ Terminal/File Management  │◀──────▶│   Agent Router             │
│ Plugin System             │        │   │                        │
│ State Management          │        │   ▼                        │
└────────────────────────┘        │   Agent Manager            │
         │                            │   │                        │
         │ WebSocket :7777            │   ▼                        │
         ▲                            │   Intent Parser            │
         │                            │                            │
         │                            │   WebSocket Server :3000   │
         │                            └────────────────────────────┘
         │                                           │
    GUI/CLI/Plugins ◀──────────────────────────────────┘
```

## Components

### Agent Manager (`agent-manager.ts`)
- Creates and manages terminal agents via tmux
- Monitors agent health and status
- Handles agent lifecycle (create, stop, restart)
- Captures agent output

### Agent Router (`agent-router.ts`)
- Parses natural language commands
- Routes commands to appropriate agents
- Manages routing rules and patterns
- Provides command suggestions

### Orchestrator (`index.ts`)
- Main coordination layer
- WebSocket server for GUI communication
- Event-driven architecture
- Broadcasts agent status updates

## Agent Types

- **dev**: Development server agents (npm run dev, etc.)
- **test**: Test runner agents (jest, mocha, pytest)
- **repl**: Interactive REPL agents (node, python, ruby)
- **build**: Build process agents (webpack, rollup)
- **lint**: Code quality agents (eslint, prettier)
- **custom**: User-defined agents

## Usage Examples

### Natural Language Commands
```
"start dev server"     → Creates dev agent running npm run dev
"run tests"           → Creates test agent running npm test
"open python repl"    → Creates REPL agent running python3
"build project"       → Creates build agent running npm run build
```

### Programmatic Usage
```typescript
import { Orchestrator } from '@orchflow/orchestrator';

const orchestrator = new Orchestrator({
  sessionName: 'my-project',
  port: 8080,
});

// Execute natural language command
const agent = await orchestrator.execute('start dev server');

// Direct agent creation
const testAgent = await orchestrator.createAgent(
  'test-runner',
  'test',
  'npm test -- --watch'
);

// Send command to agent
await orchestrator.sendToAgent(agent.id, 'rs'); // Restart nodemon

// Get agent output
const output = await orchestrator.getAgentOutput(agent.id, 100);
```

## WebSocket API

### Client → Server Messages

```typescript
// Execute command
{
  type: 'execute',
  command: 'start dev server',
  requestId: '123'
}

// Send command to specific agent
{
  type: 'agent:command',
  agentId: 'agent-1',
  command: 'npm run build',
  requestId: '124'
}

// Get agent output
{
  type: 'agent:output',
  agentId: 'agent-1',
  lines: 50,
  requestId: '125'
}

// List all agents
{
  type: 'list:agents',
  requestId: '126'
}
```

### Server → Client Messages

```typescript
// Agent created
{
  type: 'agent:created',
  data: { id, name, type, status, ... }
}

// Agent status update
{
  type: 'agent:stopped',
  data: { id, name, ... }
}

// Command result
{
  type: 'execute:result',
  agent: { ... },
  requestId: '123'
}
```

## Configuration

```typescript
interface OrchestratorConfig {
  sessionName?: string;      // Tmux session name (default: 'orchflow')
  port?: number;            // WebSocket port (default: 8080)
  
  // Core features (enabled by default)
  enableWebSocket?: boolean; // Enable WS server (default: true)
  enableSessions?: boolean;  // Session persistence (default: true)
  enableCache?: boolean;     // Response caching (default: true)
  
  // Advanced features (optional)
  enableMemory?: boolean;    // Cross-session memory (default: false)
  enableMCP?: boolean;       // Model Context Protocol (default: false)
  enableSwarm?: boolean;     // Swarm coordination (default: false)
  enableMetrics?: boolean;   // Prometheus metrics (default: true)
  
  // Operation modes
  mode?: 'standalone' | 'sidecar' | 'service'; // default: 'standalone'
}
```

### Feature Flags

The orchestrator uses smart defaults, enabling essential features automatically while keeping resource-intensive features optional:

```typescript
// Minimal setup - just core orchestration
const orchestrator = new Orchestrator({
  sessionName: 'my-project'
});

// Full AI-powered orchestration
const orchestrator = new Orchestrator({
  sessionName: 'my-project',
  enableMemory: true,
  enableMCP: true,
  enableSwarm: true
});
```

## Extending the Router

Add custom routing rules:

```typescript
router.addRule({
  pattern: /^deploy\s+to\s+(staging|production)/i,
  agentType: 'deploy',
  extractor: (match) => ({ 
    environment: match[1].toLowerCase() 
  }),
});
```

## Best Practices

1. **Session Naming**: Use descriptive session names for different projects
2. **Agent Monitoring**: Agents are automatically monitored for health
3. **Output Capture**: Use `getOutput()` to capture recent agent output
4. **Graceful Shutdown**: Always call `orchestrator.shutdown()` when done

## Running the Orchestrator

### Standalone Mode
```bash
cd orchestrator
npm install
npm run dev
```

### As a Service
```bash
# Install globally
npm install -g @orchflow/orchestrator

# Run as service
orchflow-orchestrator --port 3000 --mode service
```

### From Desktop App (Sidecar)
```bash
# Enable orchestration features in desktop app
orchflow --ai-mode

# Or via config
echo 'orchestrator.mode = "sidecar"' >> ~/.config/orchflow/config.toml
```

> The Rust Manager will spawn the TypeScript Orchestrator as a child process when AI features are requested.

## Advanced Features

### Memory Manager
When enabled, provides persistent context across sessions:
```typescript
// Store project context
await orchestrator.memory.store('project-setup', {
  framework: 'react',
  testRunner: 'jest',
  packageManager: 'npm'
});

// Retrieved automatically for relevant commands
```

### MCP Integration
Connect to AI model servers:
```typescript
await orchestrator.mcp.connect('claude-server', {
  url: 'ws://localhost:5000',
  capabilities: ['completion', 'edit']
});
```

### Swarm Coordination
Distribute tasks across multiple agents:
```typescript
await orchestrator.swarm.execute({
  task: 'test-all-services',
  agents: ['frontend', 'backend', 'api'],
  strategy: 'parallel'
});
```

## Troubleshooting

### Common Issues

1. **Tmux not found**: Ensure tmux is installed: `brew install tmux`
2. **Session conflicts**: Use unique session names per project
3. **Agent failures**: Check agent output for error messages
4. **WebSocket errors**: Ensure port is not already in use
5. **High memory usage**: Disable unused features (memory, swarm)

### Debug Mode

Set environment variable for verbose logging:
```bash
DEBUG=orchflow:* npm run dev

# Or for specific components
DEBUG=orchflow:router,orchflow:agent npm run dev
```

### Performance Tuning

```typescript
// Optimize for low resource usage
const orchestrator = new Orchestrator({
  sessionName: 'my-project',
  enableMemory: false,
  enableSwarm: false,
  enableMetrics: false,
  cacheSize: 100 // Limit cache
});
```

## See Also

- [MANAGER_ORCHESTRATOR_ARCHITECTURE.md](./MANAGER_ORCHESTRATOR_ARCHITECTURE.md) - Understand the Manager + Orchestrator architecture
- [Plugin API Specification](./plugin-api-spec.md) - Create plugins for the orchestrator
- [MCP Protocol Specification](./mcp-protocol-spec.md) - Integrate with AI models