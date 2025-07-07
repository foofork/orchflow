# orchflow Orchestrator

A powerful, unified orchestration system for AI-assisted development with intelligent terminal management, session persistence, and advanced coordination features.

## Features

### Core Features (Always Available)
- 🚀 **Agent Management** - Create and manage AI agents for different tasks
- 🔄 **Smart Routing** - Automatically route commands to appropriate agents
- 🌐 **WebSocket Server** - Real-time communication with frontends
- 📡 **Event Bus** - Type-safe event system for loose coupling

### Optional Features (Configurable)
- 📝 **Session Management** - Persistent sessions across conversations
- 📋 **Protocol System** - Development rules and constraints
- 🎯 **SPARC Modes** - Specialized AI behaviors (TDD, Debug, Architect, etc.)
- 💾 **Advanced Memory** - Cross-project knowledge with search
- ⚡ **Circuit Breakers** - Fault tolerance and automatic recovery
- 🔒 **Resource Management** - Deadlock detection and prevention
- 📊 **Metrics Collection** - Prometheus-compatible monitoring
- 🗓️ **Task Scheduling** - Advanced scheduling with dependencies
- ⚖️ **Load Balancing** - Distribute work across agents
- 🏊 **Terminal Pooling** - Pre-warmed terminal sessions
- 🤖 **MCP Integration** - Model Context Protocol support
- 🐝 **Swarm Coordination** - Distributed task execution

## Installation

```bash
npm install
```

## Quick Start

```typescript
import { Orchestrator } from '@orchflow/orchestrator';

// Create orchestrator with smart defaults
const orchestrator = new Orchestrator({
  sessionName: 'my-project',
});

await orchestrator.initialize();

// Execute commands
const agent = await orchestrator.execute('start dev server');
console.log(`Agent ${agent.id} created`);
```

## Configuration

The orchestrator uses smart defaults, enabling essential features automatically:

```typescript
const orchestrator = new Orchestrator({
  // Core config
  sessionName: 'my-project',        // default: 'orchflow'
  port: 8080,                       // default: 8080
  dataDir: '.orchflow',             // default: '.orchflow'
  
  // Features (all optional with smart defaults)
  enableWebSocket: true,            // default: true
  enableSessions: true,             // default: true
  enableProtocols: true,            // default: true
  enableCache: true,                // default: true
  enableModes: true,                // default: true
  enableCircuitBreakers: true,      // default: true
  enableResourceManager: true,      // default: true
  enableMemory: false,              // default: false (requires storage)
  enableMetrics: true,              // default: true
  enableScheduler: false,           // default: false (overhead)
  enableTerminalPool: false,        // default: false (requires tmux)
  enableMCP: false,                 // default: false (requires servers)
  enableSwarm: false,               // default: false (requires scheduler)
});
```

## Usage Examples

### Basic Agent Management
```typescript
// Create an agent
const agent = await orchestrator.createAgent('dev-server', 'dev');

// Send commands
await orchestrator.sendToAgent(agent.id, 'npm start');

// Get output
const output = await orchestrator.getAgentOutput(agent.id);

// Stop agent
await orchestrator.stopAgent(agent.id);
```

### Session Management
```typescript
// Start a session
await orchestrator.startSession('feature-development', {
  feature: 'user-auth',
  priority: 'high'
});

// Generate handoff for next conversation
const handoff = await orchestrator.generateHandoff();
```

### Protocol System
```typescript
// Add development rules
await orchestrator.addProtocol({
  type: 'directive',
  priority: 100,
  action: 'Always write tests first',
  enabled: true
});

// List active protocols
const protocols = orchestrator.listProtocols();
```

### SPARC Modes
```typescript
// Activate TDD mode
await orchestrator.activateMode('tdd', {
  framework: 'jest',
  coverage: 80
});

// List available modes
const modes = orchestrator.listModes();
// Includes: tdd, debug, architect, security, optimize, docs
```

### Memory Management
```typescript
// Remember information
await orchestrator.remember('api-endpoint', '/api/v1/users', {
  tags: ['api', 'rest'],
  category: 'endpoints'
});

// Recall information
const endpoint = await orchestrator.recall('api-endpoint');

// Search memory
const results = await orchestrator.searchMemory('api');
```

### Task Scheduling
```typescript
// Submit a task
const taskId = await orchestrator.submitTask({
  name: 'Run tests',
  priority: 10,
  execute: async () => {
    // Task implementation
    return { success: true };
  }
});

// Check status
const status = await orchestrator.getTaskStatus(taskId);
```

### Swarm Coordination
```typescript
// Submit parallel tasks
const swarmId = await orchestrator.submitSwarmTask({
  name: 'Process data',
  type: 'parallel',
  subtasks: [
    { id: 'task1', name: 'Process A', command: 'process-a.sh' },
    { id: 'task2', name: 'Process B', command: 'process-b.sh' },
  ]
});
```

## WebSocket API

The orchestrator provides a WebSocket server for real-time communication:

```javascript
const ws = new WebSocket('ws://localhost:8080');

// Execute command
ws.send(JSON.stringify({
  type: 'execute',
  command: 'start dev server'
}));

// List agents
ws.send(JSON.stringify({
  type: 'list:agents'
}));

// Subscribe to agent output
ws.send(JSON.stringify({
  type: 'stream:subscribe',
  agentId: 'agent-123'
}));
```

## Running the Demo

```bash
# Interactive CLI demo
npm run demo

# Basic demo (minimal features)
npm run demo:basic

# Test example usage
npm run test:example
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Orchestrator                       │
├─────────────────────────────────────────────────────┤
│  Core Components                                     │
│  ├── AgentManager (terminal management)             │
│  ├── AgentRouter (command routing)                  │
│  └── EventBus (event system)                        │
├─────────────────────────────────────────────────────┤
│  Optional Features                                   │
│  ├── SessionManager (persistence)                   │
│  ├── ProtocolManager (rules)                        │
│  ├── ModeManager (AI behaviors)                     │
│  ├── MemoryManager (knowledge base)                 │
│  ├── CircuitBreakers (fault tolerance)              │
│  ├── ResourceManager (locks)                        │
│  ├── TaskScheduler (job queue)                      │
│  ├── LoadBalancer (distribution)                    │
│  ├── TerminalPool (pre-warming)                     │
│  ├── MCPRegistry (AI tools)                         │
│  └── SwarmCoordinator (distributed tasks)           │
└─────────────────────────────────────────────────────┘
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test
npm run test:unit
npm run test:all

# Type checking
npm run typecheck
```

## Platform Support

- **macOS**: Full support (tmux optional)
- **Linux**: Full support (tmux recommended)
- **Windows**: Limited support (node-process adapter only)

## Configuration Files

The orchestrator stores data in the configured `dataDir` (default `.orchflow`):

```
.orchflow/
├── sessions/      # Session data and handoffs
├── protocols/     # Protocol rules (YAML)
├── modes/         # Custom mode configurations
├── memory/        # Knowledge base entries
└── cache/         # Cached command results
```

## Troubleshooting

### Tmux Not Found
If you see "tmux: command not found", the orchestrator will automatically fall back to the node-process adapter. To use full terminal multiplexing features:

```bash
# macOS
brew install tmux

# Linux
sudo apt-get install tmux
```

### Memory Not Persisting
Ensure the data directory has write permissions and enable memory in config:

```typescript
const orchestrator = new Orchestrator({
  enableMemory: true,
  dataDir: './my-data' // Ensure this directory is writable
});
```

## License

MIT