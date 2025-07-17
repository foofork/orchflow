# @orchflow/claude-flow

🚀 **OrchFlow Terminal Architecture** - Natural language orchestration for claude-flow

A smart NPM wrapper that adds natural language orchestration capabilities to claude-flow while preserving all existing functionality.

## Installation

```bash
npm install -g @orchflow/claude-flow
```

## Usage

### Launch OrchFlow Terminal (Natural Language Interface)

```bash
claude-flow orchflow
```

This launches the OrchFlow terminal with:
- **70% Primary Terminal**: Natural language interface for task management
- **30% Status Pane**: Live worker monitoring with descriptive names
- **Quick Access**: Press 1-9 to instantly connect to workers
- **Smart Orchestration**: Automatic task scheduling and worker management

### Regular claude-flow Commands (Pass-through)

All standard claude-flow commands work exactly as before:

```bash
claude-flow swarm "build authentication system"
claude-flow sparc run developer "add unit tests"
claude-flow memory store mykey "important data"
# ... all other claude-flow commands
```

## How It Works

### Smart Command Interception

The wrapper intercepts only the `orchflow` command:

```
claude-flow orchflow     → Launch OrchFlow Terminal
claude-flow [anything]   → Pass to real claude-flow
```

### Thin Wrapper Architecture

```
User Input
    ↓
@orchflow/claude-flow (this package)
    ↓
    ├── "orchflow" command? → OrchFlow Components
    │                         ├─ Primary Terminal
    │                         ├─ Orchestrator
    │                         ├─ Worker Manager
    │                         └─ Status Pane
    │
    └── Other command? → Real claude-flow
```

### Component Management

OrchFlow components are downloaded on first use:

```
~/.orchflow/
├── components/
│   ├── orchflow-terminal      # Primary terminal UI
│   ├── orchflow-orchestrator  # Task orchestration
│   ├── orchflow-worker        # Worker processes
│   └── orchflow-status        # Status pane
└── config.json                # User configuration
```

## Natural Language Examples

In OrchFlow terminal, you can use natural language:

```
➤ Create a REST API for user management
✓ Task created: "REST API Developer" worker spawned

➤ Show me all workers
[1] REST API Developer      🟢 Running (45%)
[2] Database Architect      🟢 Running (80%)
[3] Test Engineer          🟡 Paused

➤ Connect to the API developer
✓ Connected to "REST API Developer"

➤ Press 2
✓ Connected to "Database Architect"
```

## Configuration

### Environment Variables

```bash
CLAUDE_FLOW_PATH=/custom/path/to/claude-flow  # Real claude-flow location
ORCHFLOW_HOME=~/.orchflow                     # OrchFlow data directory
ORCHFLOW_PORT=3000                           # Orchestrator port
ORCHFLOW_STATUS_WIDTH=30                     # Status pane width (%)
ORCHFLOW_MAX_WORKERS=10                      # Maximum concurrent workers
```

### Programmatic Usage

```typescript
import { initializeOrchFlow, launchOrchFlow } from '@orchflow/claude-flow';

// Configure OrchFlow
await initializeOrchFlow({
  orchestratorPort: 3000,
  statusPaneWidth: 30,
  enableQuickAccess: true,
  maxWorkers: 10
});

// Launch programmatically
await launchOrchFlow(['--verbose']);
```

## Technical Details

### Platform Support

- macOS (x64, arm64)
- Linux (x64, arm64)
- Windows (x64)

### Requirements

- Node.js 16+
- claude-flow (installed separately)
- tmux (for terminal management)

### Binary Distribution

OrchFlow components are distributed as platform-specific binaries via GitHub releases. The wrapper automatically downloads the correct binaries for your platform on first use.

## Development

```bash
# Clone the repository
git clone https://github.com/orchflow/orchflow
cd orchflow/packages/orchflow-claude-flow

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development mode
npm run dev

# Run tests
npm test
```

## License

MIT - See LICENSE file for details

## Documentation

### Quick Start
- **[Quick Start Guide](QUICK_START.md)** - Get started in under 5 minutes
- **[User Guide](USER_GUIDE.md)** - Complete usage documentation
- **[Examples](EXAMPLES.md)** - Common patterns and workflows

### Advanced
- **[API Documentation](API.md)** - Programmatic usage reference
- **[Troubleshooting](TROUBLESHOOTING.md)** - Problem resolution guide
- **[Implementation Status](IMPLEMENTATION_STATUS.md)** - Technical details

### Project
- **[Changelog](CHANGELOG.md)** - Version history and updates
- **[Implementation Complete](../ORCHFLOW_IMPLEMENTATION_COMPLETE.md)** - Full technical documentation

## Links

- [OrchFlow Project](https://github.com/orchflow/orchflow)
- [claude-flow](https://github.com/anthropics/claude-flow)
- [Hive Mind Documentation](../../demos/ai-orchestrator/)