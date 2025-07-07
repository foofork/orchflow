# Manager + Orchestrator Integration Roadmap

> **Purpose**: Track the integration work between the Rust Manager and TypeScript Orchestrator to enable orchflow's full capabilities.
> **Related**: See [MANAGER_ORCHESTRATOR_ARCHITECTURE.md](./docs/MANAGER_ORCHESTRATOR_ARCHITECTURE.md) for architectural details.
> **Status**: Integration work has NOT started yet - both components exist independently

## Overview

This roadmap tracks the work needed to integrate orchflow's two components:
- **Rust Manager** (Core IDE infrastructure, terminal/file/plugin management, embedded in desktop app)
- **TypeScript Orchestrator** (AI agent coordination, workflow automation, optional service)

### Architecture Decision: Local IPC vs WebSocket

For desktop applications, we'll use **different communication methods** based on deployment mode:
- **Sidecar Mode**: Use stdin/stdout pipes (like LSP) - more efficient for local processes
- **Service Mode**: Use WebSocket - necessary for network communication

This avoids the overhead of TCP/WebSocket for local inter-process communication while maintaining flexibility for remote scenarios.

## Current State (Updated Jan 2025)

### ✅ What Exists
- Rust Manager fully functional with MuxBackend abstraction for terminal/file management
- TypeScript Orchestrator runs independently with AI agent coordination
- Manager WebSocket server (port 7777) **disabled for performance** - will use IPC instead
- Orchestrator has WebSocket server (port 3000) for its own clients
- Clear architectural separation and purpose
- Configuration hooks exist but aren't wired up
- **NEW**: Modular architecture - large files refactored into domain modules
- **NEW**: Zero compilation errors achieved
- **NEW**: SimpleStateStore replacing SQLx for persistence
- **NEW**: Terminal streaming via Tauri IPC (not WebSocket)
- **NEW**: Performance optimized - startup <100ms, memory ~10MB

### 🚧 What's Missing 
- No spawning logic to start TypeScript Orchestrator from Manager
- No IPC mechanism for local communication (stdin/stdout, pipes, or local sockets)
- No WebSocket client for remote orchestrator connection
- No handlers on either side for inter-process communication
- No feature detection or capability negotiation
- **CRITICAL**: No real-time terminal output streaming infrastructure
  - PTY management not implemented
  - WebSocket terminal I/O not connected
  - Terminal state synchronization missing

## Phase 1: Foundation (Weeks 1-2)

### 1.0 Code Clarity Refactor ✅ COMPLETE (Jan 2025)
- [x] Rename `/frontend/src-tauri/src/orchestrator.rs` to `manager.rs`
- [x] Update all imports and references from `orchestrator` to `manager`
- [x] Update Rust struct/type names to use "Manager" instead of "Orchestrator"
- [x] Keep Tauri command names (`orchestrator_execute`, etc.) for API compatibility
- [x] Update all internal documentation references
- [x] Preserve event names for future TypeScript Orchestrator integration
- [x] Refactor all large files (500+ lines) into modular structures:
  - manager.rs → 12 modules (6 core + 6 handlers)
  - file_manager.rs → 7 modules
  - error.rs → 13 domain-specific error modules
  - state_manager.rs → 8 modules
  - simple_state_store.rs → 8 modules (sessions, panes, layouts, etc.)
  - Plugin files → modular structures
- [x] Achieve zero compilation errors
- [x] Fix all FileError vs FileOperationError usage
- [x] Update SimpleStateStore API usage throughout codebase

### 1.0.5 Terminal Streaming Infrastructure ✅ COMPLETE (Jan 2025)
- [x] **PTY Management**
  - [x] Implement portable-pty for cross-platform terminal creation ✅
  - [x] Bidirectional I/O handling with proper buffering ✅
  - [x] Terminal resize event handling ✅
- [x] **IPC Terminal Protocol** (Using Tauri IPC instead of WebSocket)
  - [x] Design message format for terminal I/O ✅
  - [x] Implement output streaming from PTY to IPC ✅
  - [x] Handle input from IPC to PTY ✅
  - [x] Add control messages (resize, mode change) ✅
- [x] **Terminal State Management**
  - [x] Track active terminal per pane ✅
  - [x] Cursor position and selection tracking ✅
  - [x] Terminal mode (normal/insert/visual) ✅
  - [x] Scrollback buffer management ✅
- [x] **Performance & Reliability**
  - [x] Output throttling/debouncing (16ms flush interval) ✅
  - [x] Process monitoring and recovery ✅
  - [x] Health check and restart capabilities ✅

### 1.1 Local IPC for Sidecar Mode
- [ ] Implement child process spawning in Rust Manager
- [ ] Create stdin/stdout communication pipes
- [ ] Implement JSON-RPC 2.0 over stdio (like LSP)
- [ ] Add process lifecycle management (start, restart, shutdown)
- [ ] Handle process crashes and recovery

### 1.2 WebSocket Client for Service Mode
- [ ] Implement WebSocket client in Rust Manager
- [ ] Create connection handler in TypeScript Orchestrator
- [ ] Support connecting to remote orchestrator service
- [ ] Handle network connection lifecycle

### 1.3 Unified Configuration
- [ ] Create shared configuration schema
- [ ] Implement config readers in Manager and Orchestrator
- [ ] Add feature flags for optional orchestrator features
- [ ] Support deployment modes:
  - `manager-only`: No orchestrator
  - `sidecar`: Local IPC via stdio
  - `service`: Remote WebSocket connection

### 1.4 Feature Detection Protocol
- [ ] Define capability advertisement format
- [ ] Manager queries Orchestrator capabilities on connect
- [ ] Create fallback mechanisms when Orchestrator unavailable
- [ ] Add version compatibility checking
- [ ] Support capability negotiation over both IPC and WebSocket

## Phase 2: Integration (Weeks 3-4)

### 2.1 Process Management
- [ ] Detect when AI/orchestration features are requested
- [ ] Implement orchestrator binary bundling/location
- [ ] Add Node.js runtime detection/bundling
- [ ] Create process spawn with proper environment
- [ ] Monitor process health and auto-restart
- [ ] Handle graceful shutdown on app exit

### 2.2 Command Routing
- [ ] Implement command classification (manager vs orchestrator)
- [ ] Create routing layer in Rust Manager
- [ ] Forward orchestration commands to TypeScript Orchestrator
- [ ] Return results to user seamlessly

### 2.3 State Synchronization
- [ ] Share session/pane state from Manager to Orchestrator
- [ ] Stream terminal output to Orchestrator for AI analysis
- [ ] Notify Orchestrator of file system changes
- [ ] Maintain consistent project context

## Phase 3: Advanced Features (Weeks 5-6)

### 3.1 AI Feature Integration
- [ ] Route natural language commands from Manager to Orchestrator
- [ ] Manager executes Orchestrator's agent routing decisions
- [ ] Enable Orchestrator to query Manager state
- [ ] Support MCP server connections via Orchestrator

### 3.2 Plugin Interoperability
- [ ] Define Manager-Orchestrator plugin API
- [ ] Allow Manager plugins to request orchestration
- [ ] Enable Orchestrator to control Manager plugins
- [ ] Create unified plugin discovery

### 3.3 Performance Optimization
- [ ] Implement connection pooling
- [ ] Add caching for frequent operations
- [ ] Optimize message serialization
- [ ] Profile and reduce latency

## Phase 4: Enhanced IDE Features (Weeks 7-10)

Based on capability assessment, implement missing IDE features:

### 4.1 Must Have (MVP)
- [ ] **LSP Integration** - Language server protocol support
  - [ ] Multi-language server management
  - [ ] Code completion and diagnostics
  - [ ] Go-to-definition and references
- [ ] **Enhanced Search** - Beyond current ripgrep integration
  - [ ] Search and replace functionality
  - [ ] Search history and saved searches
  - [ ] Preview replacements
- [ ] **Build System Integration**
  - [ ] Auto-detect build tools
  - [ ] Parse build errors
  - [ ] Task automation

### 4.2 Should Have (v1.0)
- [ ] **Debugger Integration** (DAP protocol)
  - [ ] Breakpoint management
  - [ ] Variable inspection
  - [ ] Call stack navigation
- [ ] **Configuration Management**
  - [ ] Settings UI/API
  - [ ] Keybinding customization
  - [ ] Theme support
- [ ] **Enhanced Version Control**
  - [ ] Diff viewer
  - [ ] Merge conflict resolution
  - [ ] Commit interface

### 4.3 Nice to Have (Future)
- [ ] **Snippet Management**
- [ ] **Extension Marketplace**
- [ ] **Collaborative Features**

## Implementation Architecture

### Local IPC Design (Sidecar Mode)
```rust
// Rust Manager side
struct OrchestatorProcess {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
    rpc_client: JsonRpcClient,
}

impl OrchestatorProcess {
    fn spawn() -> Result<Self> {
        let child = Command::new("node")
            .arg("orchestrator/dist/index.js")
            .arg("--mode=sidecar")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;
        // Set up JSON-RPC over stdio...
    }
}
```

### WebSocket Design (Service Mode)
```rust
// Rust Manager side
struct OrchestatorClient {
    ws_client: WebSocketClient,
    rpc_client: JsonRpcClient,
}

impl OrchestatorClient {
    async fn connect(url: &str) -> Result<Self> {
        let ws_client = WebSocketClient::connect(url).await?;
        // Set up JSON-RPC over WebSocket...
    }
}
```

## Phase 5: Polish & Production (Weeks 11-12)

### 5.1 Error Handling
- [ ] Manager operates fully when Orchestrator unavailable
- [ ] Clear messages when orchestration features unavailable
- [ ] Automatic Orchestrator restart on crash
- [ ] User-friendly fallbacks to Manager-only mode

### 5.2 Documentation
- [ ] Integration setup guide
- [ ] Manager API documentation
- [ ] Orchestrator API documentation
- [ ] Example workflows showing Manager+Orchestrator

### 5.3 Testing
- [ ] Integration test suite
- [ ] Performance benchmarks
- [ ] Stress testing
- [ ] Edge case handling

## Success Metrics

- **Latency**: <10ms for local IPC, <25ms for WebSocket
- **Reliability**: Manager 100% functional without Orchestrator
- **Performance**: No degradation for core Manager features
- **Adoption**: 50% of users enable Orchestrator features

## Implementation Notes

### Communication Protocols

#### Local IPC (Sidecar Mode)
```typescript
// Over stdin/stdout pipes - like Language Server Protocol
// Manager → Orchestrator (via stdin)
{
  "jsonrpc": "2.0",
  "method": "orchestrate.route",
  "params": { "command": "run tests" },
  "id": "123"
}

// Orchestrator → Manager (via stdout)
{
  "jsonrpc": "2.0",
  "method": "manager.createPane",
  "params": { "type": "terminal", "command": "npm test" },
  "id": "456"
}
```

#### WebSocket (Service Mode)
```typescript
// Same JSON-RPC 2.0 protocol but over WebSocket
// Includes connection handshake and heartbeat
```

### Deployment Modes

1. **Manager-only** (default)
   - Core IDE without orchestration
   - No TypeScript Orchestrator running
   - Fastest, lowest resource usage

2. **Sidecar** (local orchestration)
   - Manager spawns Orchestrator as child process
   - Communication via stdin/stdout pipes
   - Orchestrator lifecycle tied to Manager
   - Best for desktop app with AI features

3. **Service** (remote orchestration)
   - Orchestrator runs as separate service
   - Communication via WebSocket
   - Can serve multiple clients
   - Best for team/cloud scenarios

### Priority Order
1. Core integration (Phases 1-2)
2. IDE features (Phase 4.1)
3. Advanced features (Phase 3)
4. Nice-to-have features (Phase 4.3)

## Open Questions

1. Should Manager embed basic orchestration logic?
2. How to handle version mismatches between Manager and Orchestrator?
3. Should plugins declare if they need orchestration?
4. What's the upgrade path for existing users?

## Next Steps

1. Review and approve this roadmap
2. Create detailed technical specifications
3. Set up integration test environment
4. Begin Phase 1 implementation

---

*Note: This roadmap clarifies that the Rust component is the Manager (infrastructure) and the TypeScript component is the Orchestrator (AI coordination), maintaining both as part of orchflow's flexibility-first philosophy.*