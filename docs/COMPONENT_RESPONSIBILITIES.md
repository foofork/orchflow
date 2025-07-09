# orchflow Component Responsibilities & Testing Guide

## Overview

This document clearly defines which component is responsible for each task in the orchflow architecture, where implementations should live, and how to test each component.

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (SvelteKit)                      │
│  • UI Components (Svelte)                                       │
│  • User Interactions                                            │
│  • Visual Presentation                                          │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Tauri IPC
┌─────────────────────────▼───────────────────────────────────────┐
│                    Rust Manager (src-tauri)                      │
│  • Terminal Lifecycle (create/destroy)                          │
│  • File System Operations                                       │
│  • State Persistence (SQLite)                                   │
│  • MuxBackend (tmux) Integration                               │
│  • Plugin System                                                │
│  • WebSocket Server                                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │ JSON-RPC
┌─────────────────────────▼───────────────────────────────────────┐
│              TypeScript Orchestrator (Sidecar)                   │
│  • AI Agent Management                                          │
│  • Swarm Coordination                                           │
│  • Task Routing & Scheduling                                   │
│  • Inter-Agent Communication                                    │
│  • Command Adapters (claude-flow, etc.)                        │
│  • ruv-FANN Integration                                         │
└─────────────────────────────────────────────────────────────────┘
```

## Task Responsibilities by Component

### 1. Frontend (SvelteKit) - `frontend/src/`

**Responsibilities:**
- Display terminal output via xterm.js
- Handle user input and keyboard events
- Render AI chat interface
- Show swarm visualization grid
- Display file explorer and editor
- Manage UI state and reactivity

**What NOT to implement here:**
- Terminal process management
- AI logic or agent coordination
- File system operations
- State persistence

**Testing:**
```bash
# Location: frontend/
npm run test:unit      # Component tests
npm run test:integration  # UI integration tests
npm run test:e2e       # End-to-end browser tests
```

**Test Files:**
```
frontend/src/lib/components/
├── Terminal.test.ts
├── SwarmMonitor.test.ts
├── AIChat.test.ts
└── FileExplorer.test.ts
```

### 2. Rust Manager - `frontend/src-tauri/src/`

**Responsibilities:**
- **Terminal Management:**
  - Create/destroy terminal instances
  - PTY (pseudo-terminal) management
  - Terminal I/O streaming
  - Terminal health monitoring
  
- **File Operations:**
  - Read/write files
  - File watching
  - Trash operations
  - Project search (ripgrep)
  
- **State Management:**
  - Session persistence (SQLite)
  - Settings management
  - Layout persistence
  
- **System Integration:**
  - MuxBackend abstraction (tmux)
  - Plugin loading and lifecycle
  - WebSocket server for external clients
  
- **Bridge Operations:**
  - Forward AI requests to Orchestrator
  - Relay swarm creation requests
  - Handle terminal metadata updates

**What NOT to implement here:**
- AI agent logic
- Task scheduling algorithms
- Inter-agent communication
- Command interpretation

**Testing:**
```bash
# Location: frontend/src-tauri/
cargo test                    # Unit tests
cargo test --test integration # Integration tests
./run_test_coverage.sh       # Coverage report
```

**Test Files:**
```
frontend/src-tauri/src/
├── terminal_stream/tests.rs
├── manager/tests.rs
├── mux_backend/tests.rs
├── bridge/tests.rs          # NEW
└── swarm/tests.rs           # NEW
```

### 3. TypeScript Orchestrator - `orchestrator/src/`

**Responsibilities:**
- **AI Agent Management:**
  - Create and destroy AI agents
  - Assign roles to agents
  - Monitor agent health
  - Handle agent failures
  
- **Swarm Coordination:**
  - Create agent swarms
  - Distribute tasks to agents
  - Coordinate multi-agent workflows
  - Aggregate agent results
  
- **Task Management:**
  - Parse user intents
  - Route tasks to appropriate agents
  - Schedule parallel/sequential execution
  - Handle task dependencies
  
- **Command Adapters:**
  - claude-flow integration
  - GPT/OpenAI adapters
  - Custom command sets
  - Tool execution
  
- **Memory & Context:**
  - Maintain conversation history
  - Share context between agents
  - Vector store for semantic search
  - ruv-FANN neural networks

**What NOT to implement here:**
- Terminal process spawning
- File system operations
- UI rendering
- Low-level system calls

**Testing:**
```bash
# Location: orchestrator/
npm test                     # All tests
npm run test:unit           # Unit tests
npm run test:integration    # Integration tests
npm run test:swarm          # Swarm coordination tests
```

**Test Files:**
```
orchestrator/src/
├── orchestrator.test.ts
├── agents/
│   ├── agent-manager.test.ts
│   └── agent-router.test.ts
├── swarm/
│   ├── coordinator.test.ts
│   └── visual-swarm.test.ts
├── bridge/
│   └── manager-bridge.test.ts
└── adapters/
    ├── claude-flow.test.ts
    └── adapter-base.test.ts
```

## Terminal Manager Enhancement Task Distribution

### Phase 1: Core Terminal Intelligence (Week 1-2)

#### Manager Tasks:
```rust
// Location: frontend/src-tauri/src/terminal_stream/
- Implement TerminalMetadata struct
- Add metadata to TerminalInstance
- Create terminal with metadata support
- Store tmux pane IDs
```

#### Orchestrator Tasks:
```typescript
// Location: orchestrator/src/agents/
- Implement TerminalContext interface
- Create AISwarmRouter
- Build agent-to-terminal mapping
- Handle terminal purpose routing
```

#### Frontend Tasks:
```svelte
<!-- Location: frontend/src/lib/components/ -->
- Update Terminal.svelte to show metadata
- Display agent role in terminal header
- Add visual indicators for terminal purpose
```

### Phase 2: Enhanced Process Management (Week 2-3)

#### Manager Tasks:
```rust
// Location: frontend/src-tauri/src/
- Implement ProcessRegistry in terminal_stream/
- Add health monitoring to TerminalStreamManager
- Create lightweight EventBus in event_bus/
- Build recovery mechanisms
```

#### Orchestrator Tasks:
```typescript
// Location: orchestrator/src/
- Subscribe to Manager events via bridge
- Handle terminal health events
- Implement agent recovery strategies
- Coordinate swarm health checks
```

### Phase 3: Manager-Orchestrator Bridge (Week 3-4)

#### Manager Tasks:
```rust
// Location: frontend/src-tauri/src/bridge/
- Implement OrchestratorBridge
- Create JSON-RPC client
- Handle bidirectional communication
- Forward events to Orchestrator
```

#### Orchestrator Tasks:
```typescript
// Location: orchestrator/src/bridge/
- Implement ManagerBridge
- Create JSON-RPC server
- Handle Manager notifications
- Manage terminal registry
```

### Phase 4: AI Swarm Integration (Week 4-5)

#### Manager Tasks:
```rust
// Location: frontend/src-tauri/src/swarm/
- Implement VisualSwarm
- Create tmux grid layouts
- Manage swarm sessions
- Handle pane arrangement
```

#### Orchestrator Tasks:
```typescript
// Location: orchestrator/src/swarm/
- Create swarm coordination logic
- Implement agent assignment
- Handle task distribution
- Monitor swarm progress
```

#### Frontend Tasks:
```svelte
<!-- Location: frontend/src/lib/components/ -->
- Implement SwarmMonitor.svelte
- Create grid layout system
- Add agent status displays
- Handle terminal focus switching
```

## Testing Strategy by Component

### Manager Testing Strategy

```rust
// Unit Tests - frontend/src-tauri/src/*/tests.rs
#[cfg(test)]
mod tests {
    // Test individual functions
    #[test]
    fn test_terminal_creation() { }
    
    #[test]
    fn test_metadata_persistence() { }
}

// Integration Tests - frontend/src-tauri/tests/
#[test]
fn test_manager_orchestrator_communication() { }

#[test]
fn test_swarm_session_creation() { }
```

### Orchestrator Testing Strategy

```typescript
// Unit Tests - orchestrator/src/**/*.test.ts
describe('AgentManager', () => {
  it('should create agent with metadata', async () => {
    // Test agent creation
  });
  
  it('should route tasks to correct agent', async () => {
    // Test routing logic
  });
});

// Integration Tests
describe('Manager-Orchestrator Bridge', () => {
  it('should handle terminal events', async () => {
    // Test event flow
  });
});
```

### Frontend Testing Strategy

```typescript
// Component Tests - frontend/src/lib/components/**/*.test.ts
import { render, fireEvent } from '@testing-library/svelte';

describe('SwarmMonitor', () => {
  it('should display agent grid', () => {
    // Test grid rendering
  });
  
  it('should handle terminal focus', async () => {
    // Test user interactions
  });
});
```

## Communication Flow Examples

### 1. Creating an AI Swarm

```
User → Frontend → Manager → Orchestrator → Manager → Frontend
        │         │         │              │         │
        └─ Click  └─ IPC    └─ JSON-RPC   └─ Events └─ Update UI
           "Create   "create_  "swarm.      "terminal.
            Swarm"    ai_swarm" create"      created"
```

### 2. Terminal Health Monitoring

```
Terminal → Manager → Orchestrator → Manager → Frontend
          │         │              │         │
          └─ PTY    └─ Event      └─ Action └─ Update
             Error     "health.      "restart"  Status
                       degraded"
```

### 3. Agent Task Execution

```
Orchestrator → Manager → Terminal → Manager → Orchestrator
    │           │         │         │         │
    └─ RPC      └─ Send   └─ Output └─ Stream └─ Process
       "execute"   Input              Event      Results
```

## File Organization Guidelines

### Manager (Rust)
```
frontend/src-tauri/src/
├── bridge/           # Orchestrator communication
├── swarm/            # Swarm session management
├── terminal_stream/  # Terminal I/O handling
├── event_bus/        # Event coordination
└── manager/          # Core manager logic
```

### Orchestrator (TypeScript)
```
orchestrator/src/
├── bridge/           # Manager communication
├── agents/           # AI agent logic
├── swarm/            # Swarm coordination
├── adapters/         # Command adapters
└── memory/           # Context management
```

### Frontend (Svelte)
```
frontend/src/lib/
├── components/       # UI components
├── services/         # API clients
├── stores/           # State management
└── types/            # TypeScript types
```

## Common Pitfalls to Avoid

1. **Don't implement AI logic in Manager** - Manager should only relay requests
2. **Don't handle terminals in Orchestrator** - Orchestrator should only send commands
3. **Don't put business logic in Frontend** - Frontend should only display and interact
4. **Don't create circular dependencies** - Use events for decoupled communication
5. **Don't mix concerns** - Each component has clear boundaries

## Quick Reference: Where to Implement What

| Feature | Manager (Rust) | Orchestrator (TS) | Frontend (Svelte) |
|---------|---------------|-------------------|-------------------|
| Terminal Creation | ✅ Implement | ❌ Request only | ❌ Display only |
| AI Agent Logic | ❌ Forward only | ✅ Implement | ❌ Display only |
| File Operations | ✅ Implement | ❌ Request only | ❌ Display only |
| Swarm Visualization | ✅ Layout only | ✅ Coordination | ✅ Rendering |
| Task Scheduling | ❌ Forward only | ✅ Implement | ❌ Display only |
| Health Monitoring | ✅ Terminal health | ✅ Agent health | ✅ Status display |
| Command Execution | ✅ Send to terminal | ✅ Parse & route | ❌ Display only |
| State Persistence | ✅ Implement | ❌ Request only | ❌ Display only |