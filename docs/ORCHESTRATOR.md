# OrchFlow Orchestrator Documentation

## Overview

The OrchFlow orchestrator is the brain of the system, managing terminal-based agents through tmux and routing commands based on AI-powered intent parsing.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   GUI/CLI       │────▶│  Agent Router    │────▶│  Agent Manager  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │                         │
         │                       │                         ▼
         │                       │                 ┌───────────────┐
         │                       │                 │  Tmux Session │
         │                       │                 └───────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌──────────────────┐
│ WebSocket Server│     │  Intent Parser   │
└─────────────────┘     └──────────────────┘
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
  enableWebSocket?: boolean; // Enable WS server (default: true)
}
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

## Troubleshooting

### Common Issues

1. **Tmux not found**: Ensure tmux is installed: `brew install tmux`
2. **Session conflicts**: Use unique session names per project
3. **Agent failures**: Check agent output for error messages
4. **WebSocket errors**: Ensure port is not already in use

### Debug Mode

Set environment variable for verbose logging:
```bash
DEBUG=orchflow:* ./test-orchestrator.sh
```