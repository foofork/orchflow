# orchflow Orchestrator Analysis Report

## Overview
The orchflow codebase has multiple orchestrator implementations across different layers, creating opportunities for consolidation and better third-party AI integration.

## Current Architecture

### 1. Multiple Orchestrator Implementations

#### Rust/Tauri Layer (`frontend/src-tauri/src/`)
- **simple_orchestrator.rs**: Basic agent/task management with Tauri event system
  - Agent lifecycle (create, status, execute)
  - Task management (create, complete, status)
  - System metrics
  - WebSocket-like events via Tauri

- **simple_state_store.rs**: SQLite-based persistence
  - Sessions, panes, layouts storage
  - Settings management
  - Direct SQL operations

- **tmux.rs**: Terminal multiplexer integration
  - Session/window/pane management
  - Command execution
  - Terminal capture and control

#### TypeScript/Node Layer (`orchestrator/src/`)
- **orchestrator.ts**: Unified orchestrator with feature flags
  - Core: AgentManager, AgentRouter
  - Optional: Sessions, Protocols, Modes, Memory, etc.
  - WebSocket server for real-time updates
  - Extensive plugin system

- **agent-manager.ts**: Terminal-based agent lifecycle
  - Terminal adapter abstraction
  - Multiple terminal backend support
  - Agent monitoring and control

- **Multiple specialized managers**:
  - SessionManager: Conversation persistence
  - ProtocolManager: Development rules/constraints
  - MemoryManager: Advanced knowledge storage
  - ModeManager: SPARC AI behaviors
  - ResourceManager: Lock/resource management
  - TaskScheduler: Advanced task orchestration
  - SwarmCoordinator: Distributed execution

#### Lua/Neovim Layer (`lua/orchflow/orchestrator/`)
- Terminal management abstractions
- Multiple backend support (tmux, wezterm)

### 2. Redundant Concepts

#### Session Management
- **Rust**: `Session` in simple_state_store.rs (SQLite-based)
- **TypeScript**: `Session` in session-manager.ts (file-based)
- Both track similar data: agents, tasks, metadata

#### Agent/Task Management
- **Rust**: `Agent` and `Task` in simple_orchestrator.rs
- **TypeScript**: `Agent` in agent-manager.ts, `TaskInfo` in session-manager.ts
- Similar lifecycle management, different implementations

#### Terminal/Pane Management
- **Rust**: Direct tmux integration in tmux.rs
- **TypeScript**: Abstract terminal-adapter.ts with multiple backends
- **Lua**: Terminal abstractions for Neovim integration

#### State Persistence
- **Rust**: SQLite via simple_state_store.rs
- **TypeScript**: File-based in SessionManager, MemoryManager
- No unified approach to state management

### 3. Communication Patterns
- **Rust ↔ Frontend**: Tauri commands and events
- **TypeScript ↔ Frontend**: WebSocket server
- **Lua ↔ System**: Direct terminal commands
- No unified IPC mechanism

## Consolidation Opportunities

### 1. Unified Orchestrator Core
Create a single orchestrator that:
- Lives in Rust for performance and system access
- Exposes both Tauri commands AND a plugin API
- Manages all agents, tasks, sessions centrally
- Provides consistent events across all interfaces

### 2. Plugin Architecture for AI Integration
Design a plugin system that:
- Allows third-party AI agents to register
- Provides standard interfaces for:
  - Task execution
  - Terminal access
  - State management
  - Event subscription
- Supports multiple transport mechanisms (IPC, WebSocket, HTTP)

### 3. Unified State Management
Consolidate to a single state store that:
- Uses SQLite for all persistent data
- Provides a consistent API across languages
- Supports real-time subscriptions
- Handles migrations and versioning

### 4. Terminal Abstraction Layer
Create a unified terminal management system:
- Single implementation in Rust
- Exposed to all layers (Tauri, plugins, Lua)
- Supports multiple backends transparently
- Handles pooling and lifecycle centrally

### 5. Event System Consolidation
Implement a unified event bus that:
- Bridges Tauri events, WebSocket, and plugin callbacks
- Provides type-safe event definitions
- Supports filtering and batching
- Enables cross-layer communication

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (SvelteKit)                  │
├─────────────────────────────────────────────────────────┤
│                    Tauri IPC Layer                       │
├─────────────────────────────────────────────────────────┤
│              Unified Orchestrator (Rust)                 │
│  ┌─────────────┬──────────────┬────────────────────┐   │
│  │   Core      │   Plugins    │   Terminal         │   │
│  │  Manager    │   Registry   │   Abstraction      │   │
│  └─────────────┴──────────────┴────────────────────┘   │
│  ┌─────────────┬──────────────┬────────────────────┐   │
│  │   State     │   Event      │   Resource         │   │
│  │   Store     │   Bus        │   Manager          │   │
│  └─────────────┴──────────────┴────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│                    Plugin API                            │
│  ┌─────────────┬──────────────┬────────────────────┐   │
│  │   IPC       │  WebSocket   │   HTTP/gRPC        │   │
│  │  Transport  │  Transport   │   Transport         │   │
│  └─────────────┴──────────────┴────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│                  External Plugins                        │
│  ┌─────────────┬──────────────┬────────────────────┐   │
│  │  AI Agents  │   MCP        │   Custom           │   │
│  │  (Claude,   │  Servers     │   Tools            │   │
│  │   GPT, etc) │              │                     │   │
│  └─────────────┴──────────────┴────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Migration Strategy

### Phase 1: Core Consolidation
1. Merge simple_orchestrator.rs with best patterns from TypeScript orchestrator
2. Create plugin API specification
3. Implement unified state store
4. Build event bus bridge

### Phase 2: Feature Migration
1. Port essential TypeScript features to Rust:
   - Session management
   - Basic task scheduling
   - Terminal pooling
2. Create plugin wrappers for complex features:
   - SPARC modes
   - MCP integration
   - Swarm coordination

### Phase 3: Plugin Ecosystem
1. Implement plugin transports (IPC, WebSocket, HTTP)
2. Create plugin SDK with examples
3. Build reference AI agent plugins
4. Document plugin development

## Benefits of Consolidation

1. **Simpler Architecture**: One orchestrator instead of three
2. **Better Performance**: Rust core with optional TypeScript plugins
3. **Easier AI Integration**: Standard plugin API for all AI agents
4. **Consistent State**: Single source of truth for all data
5. **Maintainability**: Less code duplication, clearer boundaries
6. **Extensibility**: Third parties can easily add capabilities

## Key Design Decisions Needed

1. **Plugin Communication**: IPC vs WebSocket vs HTTP for plugins?
2. **State Schema**: How to merge Rust and TypeScript state models?
3. **Event Types**: Unified event taxonomy across all layers?
4. **Terminal Backends**: Which to support in core vs plugins?
5. **Migration Path**: How to transition without breaking existing features?

## Next Steps

1. Review and validate this analysis
2. Define plugin API specification
3. Create proof-of-concept unified orchestrator
4. Test with sample AI agent plugin
5. Plan incremental migration strategy