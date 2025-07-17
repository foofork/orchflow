# @orchflow/claude-flow

Natural language orchestration for Claude via injection architecture.

## Overview

OrchFlow enhances Claude with parallel processing capabilities, allowing you to orchestrate multiple workers, manage complex workflows, and maintain persistent context across sessions.

## Installation

### Development Installation

```bash
git clone https://github.com/orchflow/orchflow.git
cd orchflow/packages/orchflow-claude-flow
npm install
npm run build
npm install -g .
```

### Verify Installation

```bash
orchflow --help
```

## Quick Start

Launch OrchFlow with:

```bash
orchflow
```

The interactive setup wizard will guide you through configuration based on your terminal environment.

## Features

### 🚀 Unified Architecture (5 Core Managers)
- **ConfigurationManager** - Unified configuration with intelligent caching
- **ContextManager** - Memory, conversation, and session context
- **TerminalManager** - Terminal lifecycle and state management
- **WorkerManager** - Worker orchestration and lifecycle
- **UIManager** - Status pane and user interface

### 🎯 Enhanced MCP Tools (7 Specialized Tools)
- **orchflow_worker_create** - Dynamic worker creation
- **orchflow_worker_switch** - Seamless worker switching
- **orchflow_context_share** - Cross-worker context sharing
- **orchflow_status_update** - Real-time status updates
- **orchflow_session_save** - Session persistence
- **orchflow_session_restore** - Session recovery
- **orchflow_parallel_execute** - Parallel task execution

### 🔧 Auto-Installation Features
- **tmux** with 9 package managers (apt, yum, brew, etc.)
- **Intelligent environment detection**
- **Automatic capability detection**
- **Graceful fallback modes**

## Usage

### Basic Commands

```bash
# Start with default settings
orchflow

# Start with custom port
orchflow --port 3002

# Restore a saved session
orchflow --restore project

# Debug mode
orchflow --debug

# Connect to existing core (no new core)
orchflow --no-core
```

### Natural Language Orchestration

Once OrchFlow is running, you can use natural language to orchestrate tasks:

```
- "Let's build the API and frontend in parallel"
- "Create workers for testing, documentation, and deployment"
- "Show me the progress across all workers"
- "Switch to the testing worker"
```

## Architecture

OrchFlow uses a unified architecture with 5 core managers that coordinate through a central orchestrator:

```
┌─────────────────────────────────────────────────────────────┐
│                  UnifiedSetupOrchestrator                   │
│                    (Central Coordinator)                    │
├─────────────────────────────────────────────────────────────┤
│  ConfigurationManager  │  ContextManager  │  TerminalManager │
│  ├─ Config caching     │  ├─ Memory mgmt  │  ├─ tmux backend │
│  ├─ Validation        │  ├─ Conversation │  ├─ Split screen │
│  └─ Performance opts  │  └─ Sessions     │  └─ Status pane  │
├─────────────────────────────────────────────────────────────┤
│     WorkerManager      │              UIManager             │
│     ├─ Lifecycle      │              ├─ Status updates     │
│     ├─ Orchestration  │              ├─ Progress tracking  │
│     └─ Smart routing  │              └─ User interaction   │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

OrchFlow stores configuration in `.orchflow/config.json`. Key settings:

```json
{
  "core": {
    "port": 3001,
    "enablePersistence": true,
    "enableWebSocket": true,
    "maxWorkers": 4
  },
  "ui": {
    "theme": "default",
    "statusPane": {
      "enabled": true,
      "position": "right",
      "width": 30
    }
  },
  "terminal": {
    "multiplexer": "tmux",
    "autoInstall": true
  }
}
```

## Development

### Build

```bash
npm run build
```

### Test

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Run with coverage
npm run test:coverage
```

### Lint and Format

```bash
npm run lint
npm run lint:fix
npm run format
```

## API Reference

### Core Classes

- **OrchFlowCore** - Main orchestration engine
- **UnifiedSetupOrchestrator** - Central coordinator
- **ConfigurationManager** - Configuration management
- **ContextManager** - Context and memory management
- **TerminalManager** - Terminal integration
- **WorkerManager** - Worker lifecycle management
- **UIManager** - User interface management

### MCP Tools

OrchFlow provides 7 specialized MCP tools for Claude integration:

1. **orchflow_worker_create** - Create new workers
2. **orchflow_worker_switch** - Switch between workers
3. **orchflow_context_share** - Share context between workers
4. **orchflow_status_update** - Update worker status
5. **orchflow_session_save** - Save current session
6. **orchflow_session_restore** - Restore saved session
7. **orchflow_parallel_execute** - Execute parallel tasks

## Performance

OrchFlow includes performance optimizations:

- **Intelligent caching** - Configuration and context caching
- **Parallel execution** - Multiple worker coordination
- **Memory management** - Efficient context handling
- **Connection pooling** - Optimized network connections

## Troubleshooting

### Common Issues

1. **tmux not found**: OrchFlow auto-installs tmux when needed
2. **Port conflicts**: Use `--port` to specify custom port
3. **Session conflicts**: Use `--restore` to recover sessions
4. **Memory issues**: OrchFlow manages memory automatically

### Debug Mode

Enable debug output:

```bash
orchflow --debug
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- **Documentation**: [OrchFlow Docs](https://github.com/orchflow/orchflow/tree/main/docs)
- **Issues**: [GitHub Issues](https://github.com/orchflow/orchflow/issues)
- **Community**: [GitHub Discussions](https://github.com/orchflow/orchflow/discussions)