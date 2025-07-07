# Manager + Orchestrator Architecture Guide

> **Last Updated**: January 2025  
> **Status**: Current architecture documentation  
> **Replaces**: Various migration and analysis documents

## Table of Contents

1. [Overview](#overview)
2. [Architecture Philosophy](#architecture-philosophy)
3. [Manager vs Orchestrator](#manager-vs-orchestrator)
4. [Feature Comparison](#feature-comparison)
5. [When to Use Which](#when-to-use-which)
6. [Deployment Models](#deployment-models)
7. [Integration Guide](#integration-guide)
8. [Technical Specifications](#technical-specifications)
9. [Future Roadmap](#future-roadmap)
10. [FAQ](#faq)

## Overview

orchflow implements a **Manager + Orchestrator architecture** that provides maximum flexibility for users. Rather than forcing a single implementation, the project offers two complementary systems:

1. **Rust Manager** - Embedded infrastructure/platform manager for core IDE features and terminal management
2. **TypeScript Orchestrator** - Optional service for advanced AI orchestration and automation features

This architecture allows users to choose their complexity level: from a simple, fast terminal IDE to a powerful AI-assisted development environment.

## Architecture Philosophy

### Core Principle: "Pay for What You Use"

```
Simple Terminal IDE → Rust Only → Fast, Lightweight, Zero Dependencies
AI-Assisted Development → Rust + TypeScript → Full Feature Set
Multi-Tool Orchestration → TypeScript Service → Shared Across IDEs
```

### Design Goals

1. **No Forced Dependencies** - Don't require Node.js for basic terminal management
2. **Progressive Enhancement** - Start simple, add features as needed
3. **Tool Agnostic** - Advanced orchestrator can serve multiple clients
4. **Performance First** - Basic operations must be fast
5. **Flexibility** - Support diverse workflows and preferences

## Manager vs Orchestrator

### Rust Manager (Infrastructure/Platform)

**Location**: `/frontend/src-tauri/src/manager.rs`

**Purpose**: Provide fast, native infrastructure management including terminal sessions, file operations, and platform integration

**Key Components**:
```rust
- Session & Pane Management (manager.rs) // Infrastructure layer
- MuxBackend Abstraction (mux_backend/) // Terminal backend management
- File Operations (file_manager.rs) // Direct filesystem access
- State Management (state_manager.rs) // Platform state
- Plugin System (plugin_system/) // Platform extensions
- Command History (command_history.rs) // Terminal history
- Search Functions (project_search.rs, terminal_search.rs) // File search
```

**Characteristics**:
- Embedded in Tauri desktop app
- Direct system integration
- Millisecond response times
- No external dependencies
- Always available

### TypeScript Orchestrator (AI/Automation)

**Location**: `/orchestrator/`

**Purpose**: Provide true orchestration - intelligent command routing, AI coordination, and workflow automation

**Key Components**:
```typescript
- Agent Management & Routing (agent-manager.ts, agent-router.ts) // Orchestration logic
- AI Integration (mcp/, modes/) // AI model coordination
- Distributed Computing (coordination/swarm-coordinator.ts) // Multi-agent orchestration
- Memory & Context (memory/) // Persistent orchestration state
- Fault Tolerance (circuit-breaker.ts) // Orchestration reliability
- Resource Management (resource-manager.ts) // Orchestration resource locks
- Task Scheduling (task-scheduler.ts) // Workflow automation
- Protocol System (protocol-manager.ts) // Development rules
```

**Characteristics**:
- Runs as optional service or sidecar
- Feature-rich with modular design
- AI and automation focused
- Extensible plugin system
- Cross-tool compatible

## Feature Comparison

### Core Features (Both Have)

| Feature | Rust Implementation | TypeScript Implementation |
|---------|-------------------|--------------------------|
| Session Management | ✅ Native via MuxBackend | ✅ Via EventBus |
| Pane Control | ✅ Direct tmux integration | ✅ Terminal adapters |
| Command Execution | ✅ Synchronous/Async | ✅ Async with queuing |
| Basic Plugins | ✅ Trait-based | ✅ Module-based |
| State Persistence | ✅ SQLite | ✅ File-based |

### Exclusive to Rust Manager

| Feature | Description | Benefit |
|---------|-------------|---------|
| MuxBackend Abstraction | Flexible terminal backend support | Future-proof |
| Native File Operations | Direct filesystem access | High performance |
| Integrated Search | Ripgrep-powered project search | Fast searching |
| Command History | SQLite with frecency scoring | Smart history |
| Tauri IPC | Direct desktop integration | Low latency |
| File Browser Plugin | Navigate, create, edit, delete files | Complete file management |
| Test Runner Plugin | Multi-framework test detection & execution | Universal test support |
| Session Templates | Workspace snapshots and templates | Quick environment setup |

### Exclusive to TypeScript Orchestrator

| Feature | Description | Use Case |
|---------|-------------|----------|
| **Agent Router** | Intelligent command routing to specialized agents | Auto-select dev/test/build agents |
| **Agent Types** | Specialized terminals (dev, test, repl, build, lint) | Task-specific environments |
| **MCP Integration** | Model Context Protocol for AI servers | Claude, GPT integration |
| **Swarm Coordination** | Distributed task execution | Multi-agent workflows |
| **Memory Manager** | Persistent context across sessions | Long-term project memory |
| **Circuit Breakers** | Fault tolerance with automatic recovery | Reliability |
| **Resource Manager** | Lock management to prevent conflicts | Concurrent operations |
| **Protocol System** | Development rules and constraints | Team standards |
| **SPARC Modes** | Specialized behaviors (TDD, Debug, Architect) | Context-aware assistance |
| **Task Scheduler** | Cron-like task scheduling | Automation |
| **Output Streaming** | Real-time terminal output streaming | Live monitoring |
| **Metrics Collection** | Prometheus-compatible metrics | Performance monitoring |

## When to Use Which

### Use Rust Manager Only When:

- You want a fast, lightweight terminal IDE
- You don't need AI assistance
- You prefer minimal resource usage
- You're working on a single project
- You value simplicity and speed

**Example Configuration**:
```toml
[orchestrator]
mode = "embedded"
```

### Use Manager + Orchestrator When:

- You want AI-powered development assistance
- You need intelligent command routing
- You work with complex, multi-agent workflows
- You want persistent memory across sessions
- You need advanced automation features

**Example Configuration**:
```toml
[orchestrator]
mode = "sidecar"

[features]
ai_agents = true
memory_manager = true
mcp_integration = true
```

### Use TypeScript as Service When:

- You want to share orchestration across multiple tools
- You need distributed task execution
- You're managing multiple projects simultaneously
- You want a central orchestration hub
- You're building custom development tools

**Example Configuration**:
```toml
[orchestrator]
mode = "service"
service_url = "ws://localhost:3000"
```

## Deployment Models

### 1. Embedded Mode (Default)

```
┌─────────────────────────────┐
│   orchflow Desktop App      │
│  ┌──────────────────────┐   │
│  │     Rust Manager     │   │
│  │  - Fast & Native     │   │
│  │  - Zero Dependencies │   │
│  └──────────────────────┘   │
└─────────────────────────────┘
```

**Start Command**: `orchflow`

### 2. Sidecar Mode (AI-Enhanced)

```
┌─────────────────────────────┐     ┌──────────────────────────┐
│   orchflow Desktop App      │     │  TypeScript Orchestrator │
│  ┌──────────────────────┐   │ WS  │  (Child Process)         │
│  │     Rust Manager     ├───┼─────┤  - AI Orchestration     │
│  │  - Infrastructure    │   │     │  - Memory Manager       │
│  └──────────────────────┘   │     │  - Agent Router         │
└─────────────────────────────┘     └──────────────────────────┘
```

**Start Command**: `orchflow --ai-mode`

### 3. Service Mode (Multi-Tool)

```
                           ┌──────────────────────────────┐
                           │  TypeScript Orchestrator     │
                           │  (System Service :3000)      │
                           │  - Shared Agent Pool         │
                           │  - Persistent Memory         │
                           │  - Cross-Project Context     │
                           └─────────────┬────────────────┘
                                         │ WebSocket
                ┌────────────────────────┼────────────────────────┐
                │                        │                        │
    ┌───────────▼──────────┐  ┌─────────▼──────────┐  ┌─────────▼──────────┐
    │ orchflow Desktop     │  │ VS Code Extension  │  │ CLI Tools          │
    │   (Rust Manager)     │  │                    │  │                    │
    └──────────────────────┘  └────────────────────┘  └────────────────────┘
```

**Start Service**: `orchflow-service start`  
**Connect Client**: `orchflow --connect-service`

## Integration Guide

### Current State

- **Rust Manager**: Fully integrated with desktop app ✅
  - WebSocket server on port 7777 for AI integration
  - Full plugin system with file browser, test runner, git, etc.
  - Handles infrastructure and platform management
- **TypeScript Orchestrator**: Runs independently ✅
  - WebSocket server on port 3000 (configurable)
  - Advanced AI orchestration and automation
  - Handles intelligent routing and coordination
- **Integration**: Not yet connected (planned) 🚧

### Planned Integration

```typescript
// TypeScript orchestrator as a service
const orchestrator = new Orchestrator({
  mode: 'service',
  enableWebSocket: true,
  port: 3000,
});

// Rust manager connects to orchestrator when needed
match config.ai_features {
  true => {
    let orchestrator_client = WebSocketClient::connect("ws://localhost:3000").await?;
    // Forward orchestration requests
  }
  false => {
    // Use embedded manager only
  }
}
```

### Communication Protocol

The Manager and Orchestrator communicate using JSON-RPC 2.0:

```json
// Request from Rust Manager to TypeScript Orchestrator
{
  "jsonrpc": "2.0",
  "method": "agent.route",
  "params": {
    "input": "run tests for authentication",
    "context": { "project": "webapp" }
  },
  "id": 1
}

// Response from TypeScript Orchestrator
{
  "jsonrpc": "2.0",
  "result": {
    "agent_type": "test",
    "suggested_command": "npm test -- --grep auth",
    "confidence": 0.95
  },
  "id": 1
}
```

#### Common API Methods

```typescript
// Agent management
"agent.create": { type: string, name: string, command?: string }
"agent.list": {}
"agent.send": { agentId: string, input: string }
"agent.stop": { agentId: string }

// Session management
"session.create": { name: string, metadata?: object }
"session.restore": { sessionId: string }
"session.save": { sessionId: string }

// AI features (TypeScript orchestrator only)
"ai.route": { input: string, context?: object }
"ai.complete": { prompt: string, mode?: string }
"memory.store": { key: string, value: any, metadata?: object }
"memory.search": { query: string, limit?: number }
```

## Technical Specifications

### Performance Targets

| Operation | Rust Manager | TypeScript Orchestrator |
|-----------|------------------|------------------------|
| Startup | <50ms | <200ms |
| Command Execution | <10ms | <25ms |
| Memory Usage | <100MB | <200MB (configurable) |
| CPU Idle | <1% | <2% |

### API Compatibility

Both systems expose compatible APIs for their respective domains:

```typescript
// Common Interface (simplified)
interface Orchestrator {
  createSession(name: string): Promise<Session>;
  createPane(sessionId: string, type: PaneType): Promise<Pane>;
  executeCommand(paneId: string, command: string): Promise<void>;
  // ... more methods
}
```

## Future Direction

The Manager + Orchestrator architecture is the foundation for orchflow's flexibility. Future development will focus on:

1. **Integration** - Enabling seamless communication between the Rust Manager and TypeScript Orchestrator
2. **Clear Separation** - Maintaining distinct responsibilities: infrastructure (Rust) vs orchestration (TypeScript)
3. **Plugin Ecosystem** - Standardizing plugin APIs appropriate to each system's role
4. **Performance** - Continuous optimization while maintaining feature richness

For detailed development plans and roadmap, see [DEVELOPMENT_ROADMAP_UPDATED.md](/DEVELOPMENT_ROADMAP_UPDATED.md).

## FAQ

### Q: Why separate Manager and Orchestrator instead of one system?

**A**: Different responsibilities require different architectures. Rust excels at infrastructure management (terminals, files, platform integration), while TypeScript excels at orchestration (AI coordination, intelligent routing, workflow automation). This separation of concerns creates a cleaner, more maintainable architecture.

### Q: Will the TypeScript orchestrator be removed?

**A**: No. Initial plans to remove it have been abandoned. The Manager + Orchestrator architecture is now a core design principle of orchflow.

### Q: Do I need both systems?

**A**: No. The Rust Manager provides a complete terminal IDE experience with infrastructure management. The TypeScript Orchestrator adds advanced AI orchestration and automation features for users who want them.

### Q: Can they work together?

**A**: Not yet, but this is actively being developed. The plan is to allow seamless integration while maintaining independence.

### Q: Which should I contribute to?

**A**: 
- Infrastructure/platform features → Rust Manager
- AI/orchestration features → TypeScript Orchestrator
- Integration layer → Both

### Q: Is this technical debt?

**A**: No. This is intentional architecture that provides clear separation of concerns. The Rust Manager handles infrastructure, the TypeScript Orchestrator handles intelligent coordination. Each system is well-maintained and serves distinct purposes.

## Debugging & Troubleshooting

### Check Connection Status

```bash
# Is TypeScript orchestrator running?
lsof -i :3000

# Check WebSocket connections
netstat -an | grep 3000

# View orchestrator logs
tail -f ~/.config/orchflow/orchestrator.log
```

### Enable Debug Logging

```typescript
// In TypeScript orchestrator
const orchestrator = await createOrchestrator({
    debug: true,
    logLevel: 'verbose',
    logFile: '~/.config/orchflow/orchestrator.log',
});
```

```rust
// In Rust app
env_logger::Builder::from_env(
    env_logger::Env::default()
        .default_filter_or("orchflow=debug")
).init();
```

### Common Issues

1. **Port conflicts**: Check if port 3000 is already in use
2. **Permission errors**: Ensure orchflow has terminal access permissions
3. **Connection timeouts**: Verify firewall settings for localhost connections

## Technology Stack

### Core Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| Shell wrapper | Tauri | Native window chrome, auto-updater, OS integration |
| UI framework | SvelteKit (static) | Zero SSR overhead, hot reload, reactive UI |
| Editor kernel | Neovim RPC | Modal editing, extensibility, cross-platform |
| Code editor | CodeMirror (partial) | Configuration panels, lightweight editing |
| Terminal runtime | MuxBackend (tmux/muxd) | Terminal multiplexing abstraction |
| Infrastructure Manager | Rust | Terminal/file/plugin management |
| AI Orchestrator | TypeScript | Task coordination, agent management |
| State store | SQLite (sqlx) | Persistent storage, zero-config database |
| Event bus | WebSocket | Real-time communication, event streaming |
| Modules | Flatfiles + SQLite | Plugin system, dynamic loading |

### Key Design Decisions

1. **Manager + Orchestrator Architecture**: Rust Manager for infrastructure, TypeScript Orchestrator for AI coordination
2. **MuxBackend Abstraction**: Flexibility to use tmux, muxd, or other terminal multiplexers
3. **Headless Neovim**: Multiple Neovim instances managed via RPC for isolation
4. **Module System**: Dynamic loading with manifest-based configuration
5. **SQLite Everything**: Single-file database for all persistent state

## Data Flow

### 1. Command Execution Flow
```
User Input → Frontend → Tauri IPC → Rust Manager → MuxBackend → tmux/Neovim → Response
```

### 2. Orchestration Flow (when enabled)
```
Natural Language → TypeScript Orchestrator → Agent Router → Rust Manager → Execution
```

### 3. Event Flow
```
Component Event → Event Bus → Manager/Orchestrator → WebSocket → Frontend Update
```

### 4. Module Loading Flow
```
Discover Modules → Validate Manifests → Load Dependencies → Initialize → Register Commands
```

## Module System

Dynamic plugin system supporting:
- **Layout Modules** - Custom workspace layouts
- **Agent Modules** - AI/automation agents
- **Tool Modules** - Development tools
- **Provider Modules** - External service integrations

**Module Structure:**
```
module-name/
├── manifest.json    # Module metadata and config schema
├── index.js        # Entry point (CommonJS or ES modules)
└── assets/         # Optional resources
```

## Performance Optimizations

1. **Startup Performance** (<100ms target)
   - Parallel initialization of components
   - Lazy loading of non-critical features
   - Optimized Rust binary (LTO, size optimization)

2. **Runtime Performance**
   - Event debouncing and batching
   - Virtual scrolling for large outputs
   - Incremental UI updates
   - Resource pooling (terminal instances)

3. **Binary Size**
   - Rust opt-level "z" (size optimization)
   - Symbol stripping in release builds
   - Code splitting in frontend
   - Dynamic imports for heavy dependencies

## Security Considerations

1. **Process Isolation**
   - Each Neovim instance runs in separate process
   - Terminal sessions isolated via MuxBackend
   - Modules run in restricted context

2. **IPC Security**
   - Tauri's secure IPC bridge
   - Command allowlisting
   - Input sanitization

3. **Module Security**
   - Permission-based module system
   - Manifest validation
   - Sandboxed execution context

## Development Workflow

### Building from Source

```bash
# Install dependencies
cd frontend
npm install

# Development mode
npm run tauri dev

# Production build
npm run tauri build
```

### Testing

```bash
# Run all tests
./test-orchestrator.sh
./test-desktop.sh

# Test specific component
cd orchestrator && npm test
cd frontend && npm test
cd frontend/src-tauri && cargo test
```

### Module Development

1. Create module directory in `modules/`
2. Add `manifest.json` with metadata
3. Implement `index.js` with required exports
4. Test with module loader

See `modules/example-terminal-agent/` for reference implementation.

## Summary

The Manager + Orchestrator architecture represents orchflow's commitment to user choice and flexibility. By separating infrastructure management (Rust Manager) from intelligent orchestration (TypeScript Orchestrator), orchflow can serve everyone from minimalist terminal users to AI-powered development teams.

This architecture is not a transition state—it's the destination. The Manager provides rock-solid infrastructure, while the Orchestrator adds optional intelligence on top.

---

*This document consolidates and replaces previous migration plans, analyses, and the original ARCHITECTURE.md. For historical context, see git history.*