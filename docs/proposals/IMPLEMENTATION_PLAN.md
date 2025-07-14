# orchflow Implementation Plan

This document provides technical specifications and implementation details for orchflow features. For current development status and priorities, see [DEVELOPMENT_ROADMAP.md](../DEVELOPMENT_ROADMAP.md).

## Phase 1: Complete Rust Terminal Manager

### 1.1 Terminal Streaming Completion
**Component**: TerminalStreamManager  
**Location**: `frontend/src-tauri/src/terminal_stream/`

```rust
// PTY Process Tracking
pub struct PtyProcess {
    pid: u32,
    pty: Box<dyn MasterPty>,
    buffer: RingBuffer<u8>,
}

impl TerminalStreamManager {
    // TODO implementations
    pub fn get_process_id(&self, terminal_id: &str) -> Option<u32>
    pub fn search_scrollback(&self, terminal_id: &str, pattern: &str) -> Vec<Match>
    pub fn get_active_terminal(&self) -> Option<String>
    pub fn persist_terminal_state(&self, terminal_id: &str) -> Result<()>
}
```

### 1.2 Git Integration
**Component**: FileManager  
**Location**: `frontend/src-tauri/src/file_manager/git.rs`

```rust
pub struct GitIntegration {
    repo: git2::Repository,
    ignore_matcher: gitignore::Matcher,
}

impl GitIntegration {
    pub fn check_ignore(&self, path: &Path) -> bool
    pub fn get_file_status(&self, path: &Path) -> GitStatus
    pub fn get_branch_info(&self) -> BranchInfo
    pub fn get_diff(&self, path: &Path) -> Option<Diff>
}
```

### 1.3 Search & Replace Engine
**Component**: SearchPlugin  
**Location**: `frontend/src-tauri/src/plugins/search_plugin/`

```rust
pub struct ReplaceEngine {
    searcher: SearcherBuilder,
    replacer: Replacer,
}

impl ReplaceEngine {
    pub async fn replace_in_files(
        &self,
        pattern: &str,
        replacement: &str,
        paths: Vec<PathBuf>
    ) -> Result<ReplaceResults>
    
    pub fn preview_replacements(&self, file: &Path) -> Vec<ReplacementPreview>
}
```

### 1.4 Module System
**Component**: ModuleLoader  
**Location**: `frontend/src-tauri/src/modules.rs`

```rust
impl ModuleLoader {
    // WASM Support
    pub async fn load_wasm_plugin(&self, path: &Path) -> Result<Module>
    pub fn create_wasm_sandbox(&self) -> WasmSandbox
    
    // Native Support
    pub async fn load_native_plugin(&self, path: &Path) -> Result<Module>
    pub fn validate_native_signature(&self, plugin: &Path) -> bool
    
    // Registry
    pub async fn search_registry(&self, query: &str) -> Vec<ModuleInfo>
}
```

## Phase 2: Terminal Intelligence & Production

### 2.1 Terminal Metadata System
**Component**: TerminalMetadata  
**Location**: `frontend/src-tauri/src/terminal_metadata.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TerminalType {
    Build { tool: String, target: String },
    Test { framework: String, pattern: Option<String> },
    REPL { language: String, version: String },
    Debug { debugger: String, process: String },
    Agent { agent_id: String, role: String, swarm_id: Option<String> },
}

pub struct TerminalMetadata {
    pub id: String,
    pub terminal_type: TerminalType,
    pub purpose: String,
    pub context: HashMap<String, Value>,
    pub lifecycle: LifecycleState,
    pub error_patterns: Vec<ErrorPattern>,
}

impl TerminalManager {
    pub fn classify_terminal(&self, command: &str) -> TerminalType
    pub fn track_lifecycle(&mut self, id: &str, event: LifecycleEvent)
    pub fn detect_errors(&self, output: &str) -> Vec<DetectedError>
}
```

### 2.2 Production Monitoring
**Component**: Telemetry  
**Location**: `frontend/src-tauri/src/telemetry.rs`

```rust
use opentelemetry::{metrics, trace};

pub struct TelemetryManager {
    meter: metrics::Meter,
    tracer: trace::Tracer,
}

impl TelemetryManager {
    pub fn record_startup_time(&self, duration: Duration)
    pub fn track_terminal_operation(&self, op: &str, latency: Duration)
    pub fn monitor_memory_usage(&self)
    pub fn create_span(&self, name: &str) -> Span
}
```

## Phase 3: Orchestrator Layer

### 3.1 Manager ↔ Orchestrator Protocol
**Component**: OrchestratorBridge  
**Location**: `frontend/src-tauri/src/orchestrator_bridge.rs`

```rust
#[derive(Serialize, Deserialize)]
#[serde(tag = "method")]
pub enum OrchestratorRequest {
    #[serde(rename = "terminal.create")]
    CreateTerminal {
        session_id: String,
        terminal_type: TerminalType,
        agent_id: Option<String>,
        metadata: HashMap<String, Value>,
    },
    #[serde(rename = "terminal.sendInput")]
    SendInput {
        terminal_id: String,
        data: String,
    },
    #[serde(rename = "swarm.getStatus")]
    GetSwarmStatus {
        swarm_id: String,
    },
}

pub struct OrchestratorBridge {
    websocket: WebSocketServer,
    manager: Arc<Manager>,
}

impl OrchestratorBridge {
    pub async fn handle_request(&self, req: OrchestratorRequest) -> Result<Value>
    pub fn broadcast_event(&self, event: TerminalEvent)
}
```

### 3.2 Orchestrator Implementation (TypeScript)
**Location**: `orchestrator/src/`

```typescript
// Agent Framework
interface Agent {
  id: string;
  role: AgentRole;
  terminalId: string;
  status: AgentStatus;
  capabilities: string[];
}

class AgentManager {
  async spawnAgent(config: AgentConfig): Promise<Agent>
  async terminateAgent(agentId: string): Promise<void>
  async routeCommand(command: string, context: Context): Promise<Agent>
}

// Command Adapters
abstract class CommandAdapter {
  abstract name: string;
  abstract async execute(command: string, terminal: Terminal): Promise<Result>
}

class ClaudeFlowAdapter extends CommandAdapter {
  name = 'claude-flow';
  async execute(command: string, terminal: Terminal) {
    // Integration with claude code
  }
}
```

## Phase 4: Web Platform

### 4.1 Service Abstraction Layer
**Location**: `frontend/src/lib/services/`

```typescript
// Service Interfaces
interface TerminalService {
  createSession(config: SessionConfig): Promise<Session>;
  createPane(sessionId: string, options?: PaneOptions): Promise<Pane>;
  sendInput(paneId: string, data: string): Promise<void>;
  onOutput(paneId: string, callback: (data: string) => void): Unsubscribe;
}

// Platform Implementations
class TauriTerminalService implements TerminalService {
  async createSession(config: SessionConfig) {
    return await invoke('create_terminal_session', { config });
  }
}

class WebTerminalService implements TerminalService {
  private ws: WebSocket;
  
  async createSession(config: SessionConfig) {
    const response = await fetch('/api/terminal/session', {
      method: 'POST',
      body: JSON.stringify(config)
    });
    return response.json();
  }
}
```

### 4.2 Web Terminal Implementation
**Component**: Container-based terminals  
**Technology**: Docker + node-pty + WebSocket

```typescript
// Server-side terminal management
class ContainerTerminalManager {
  async createUserContainer(userId: string): Promise<Container>
  async attachTerminal(containerId: string, terminalId: string): Promise<PTY>
  async handleWebSocket(ws: WebSocket, terminalId: string): Promise<void>
}
```

## AI-Driven Features (Integrated Throughout)

### Terminal Manager AI Support
- Terminal classification and metadata
- Error pattern detection
- Command intent preparation

### Orchestrator AI Coordination
- AI agent lifecycle management
- Swarm coordination
- Command routing based on intent
- Multi-provider adapter system

### Web Platform AI Features
- Shared AI sessions
- Collaborative swarm monitoring
- Multi-tenant AI resource management

## Success Metrics

### Performance
- Terminal operation latency: <5ms
- Startup time maintained: <100ms
- Memory per terminal: <5MB
- WebSocket message latency: <10ms

### Quality
- Test coverage: >90%
- Type safety: 100%
- Error handling: Graceful degradation
- Documentation: Complete API coverage

---

*This plan follows the development phases outlined in DEVELOPMENT_ROADMAP.md, providing technical specifications for implementation.*