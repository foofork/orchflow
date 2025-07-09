# orchflow Implementation Plan

This document provides technical specifications and implementation details for orchflow features. For current development status and priorities, see [DEVELOPMENT_ROADMAP.md](../DEVELOPMENT_ROADMAP.md).

## High Priority Tech Debt (Concurrent with UI Development)

### 1. Git Integration (1 week)
**Component**: Manager (Rust)  
**Location**: `frontend/src-tauri/src/file_manager/git.rs`  
**IPC Commands**: Will extend `git_commands.rs`  
**Frontend Access**: Via `invoke()` commands  
**Architecture**: Part of FileManager, see [Manager Pattern](../architecture/MANAGER_PATTERN_ARCHITECTURE.md)

```rust
// file_manager/git.rs
pub struct GitIntegration {
    repo: git2::Repository,
    ignore_matcher: gitignore::Matcher,
}

impl GitIntegration {
    // Replace TODO comments with actual implementation
    pub fn check_ignore(&self, path: &Path) -> bool
    pub fn get_file_status(&self, path: &Path) -> GitStatus
    pub fn get_branch_info(&self) -> BranchInfo
}
```

### 2. Plugin System Completion (1-2 weeks)
**Component**: Manager (Rust)  
**Location**: `frontend/src-tauri/src/modules.rs` and `plugin_system/`  
**IPC Commands**: `module_commands.rs` - load, unload, list plugins  
**Frontend Access**: Via PluginManager component  
**Architecture**: See [Plugin System Architecture](../architecture/PLUGIN_SYSTEM_ARCHITECTURE.md)

```rust
// modules/loader.rs
impl ModuleLoader {
    // Implement WASM plugin loading
    pub async fn load_wasm_plugin(&self, path: &Path) -> Result<Module>
    
    // Implement native plugin loading
    pub async fn load_native_plugin(&self, path: &Path) -> Result<Module>
    
    // Plugin activation events
    pub fn check_activation_events(&self, event: &str) -> Vec<PluginId>
}
```

### 3. Module Registry (2 weeks)
```rust
// modules/registry.rs
pub struct ModuleRegistry {
    registry_url: String,
    cache: HashMap<String, ModuleMetadata>,
}

impl ModuleRegistry {
    pub async fn search(&self, query: &str) -> Result<Vec<ModuleInfo>>
    pub async fn get_details(&self, id: &str) -> Result<ModuleDetails>
    pub async fn install(&self, id: &str) -> Result<PathBuf>
}
```

## Phase 7.1: Core Productivity Components (2-3 weeks)

### 1. Enhanced Command Palette
**Component**: Frontend (Svelte)  
**Location**: `frontend/src/lib/components/CommandPalette.svelte`  
**Backend**: Accesses Manager via `invoke()` for commands  
**Data Flow**: User input → Frontend filtering → Manager execution  
**Architecture**: See [IPC Command Architecture](../architecture/IPC_COMMAND_ARCHITECTURE.md)

```svelte
<script lang="ts">
  interface Command {
    id: string;
    title: string;
    category: 'file' | 'git' | 'terminal' | 'plugin';
    shortcut?: string;
    action: () => Promise<void>;
  }
  
  // Features:
  // - Fuzzy search with fuse.js
  // - Recent commands with frecency scoring
  // - Plugin-specific commands
  // - Quick actions (git, terminal, files)
  // - Keyboard navigation
</script>
```

### 2. Advanced File Explorer
**Component**: Frontend (Svelte)  
**Location**: `frontend/src/lib/components/FileExplorer.svelte`  
**Backend**: FileManager (Rust) via `file_commands.rs`  
**IPC Commands**: `get_file_tree`, `create_file`, `rename_file`, `delete_file`  
**Real-time Updates**: File watcher events via WebSocket  
**Architecture**: Integrates with [State Management](../architecture/STATE_MANAGEMENT_ARCHITECTURE.md)

```svelte
<script lang="ts">
  interface FileNode {
    path: string;
    name: string;
    type: 'file' | 'directory';
    gitStatus?: 'modified' | 'added' | 'deleted' | 'untracked';
    children?: FileNode[];
  }
  
  // Features:
  // - Tree view with virtual scrolling
  // - Git status indicators
  // - Drag & drop support
  // - Right-click context menu
  // - File type icons
  // - Search within explorer
</script>
```

### 3. Integrated Terminal Panel
**Component**: Frontend (Svelte)  
**Location**: `frontend/src/lib/components/TerminalPanel.svelte`  
**Backend**: TerminalStreamManager (Rust) via PTY  
**IPC Commands**: `create_streaming_terminal`, `send_terminal_input`, `resize_terminal`  
**WebSocket**: Real-time terminal output streaming  
**Architecture**: See [PTY Architecture](../architecture/PTY_ARCHITECTURE.md) and [Terminal Streaming API](../api/TERMINAL_STREAMING_API.md)

```svelte
<script lang="ts">
  // Building on existing StreamingTerminal
  interface TerminalTab {
    id: string;
    title: string;
    cwd: string;
    isActive: boolean;
  }
  
  // Features:
  // - Multiple terminal tabs
  // - Split view support
  // - Terminal selector dropdown
  // - Process status indicators
  // - History search (Ctrl+R)
  // - Quick commands menu
</script>
```

### 4. Enhanced Status Bar
**Component**: Frontend (Svelte)  
**Location**: `frontend/src/lib/components/StatusBar.svelte`  
**Backend**: StateManager queries via `invoke()`  
**Update Pattern**: Subscribe to state changes + periodic refresh  
**Architecture**: Part of unified UI state management

```svelte
<script lang="ts">
  // Features:
  // - Current file info (line/col, encoding, language)
  // - Git branch and status
  // - Running processes count
  // - Active plugins indicator
  // - Background tasks progress
  // - Click actions for each segment
</script>
```

### 5. Quick File Switcher
**Component**: Frontend (Svelte)  
**Location**: `frontend/src/lib/components/QuickSwitcher.svelte`  
**Backend**: Caches recent files in StateManager  
**Search**: Client-side fuzzy search with scoring  
**Performance**: Virtual list for large file sets

```svelte
<script lang="ts">
  // Features:
  // - Recent files list (MRU)
  // - Fuzzy search
  // - File preview on hover
  // - Open files tabs
  // - Keyboard shortcuts (Cmd+P)
  // - Symbol search (@)
</script>
```

## Phase 7.2: Advanced Productivity Components (1 month)

### 1. Search and Replace Panel
**Component**: Frontend (Svelte) + Backend (Rust)  
**Frontend**: `frontend/src/lib/components/SearchReplace.svelte`  
**Backend**: SearchPlugin via `search_commands.rs`  
**IPC Commands**: `search_project`, `replace_in_files`  
**Architecture**: See [Search Integration](../architecture/SEARCH_INTEGRATION_ARCHITECTURE.md)

- Project-wide search with regex
- Search in specific paths
- Replace with preview
- Search history
- Context lines

### 2. Git Integration Panel
**Component**: Frontend (Svelte) + Backend (Rust)  
**Frontend**: `frontend/src/lib/components/GitPanel.svelte`  
**Backend**: GitPlugin + FileManager integration  
**IPC Commands**: `git_status`, `git_commit`, `git_branch_list`, `git_diff`  
**Real-time**: File watcher triggers git status updates

- Branch switcher
- Staged/unstaged changes
- Commit interface
- Diff viewer
- Merge conflict resolver

### 3. Plugin Manager UI
**Component**: Frontend (Svelte)  
**Frontend**: `frontend/src/lib/components/PluginManager.svelte`  
**Backend**: ModuleSystem via `module_commands.rs`  
**IPC Commands**: `list_modules`, `install_module`, `get_module_config`  
**Architecture**: See [Plugin System](../architecture/PLUGIN_SYSTEM_ARCHITECTURE.md)

- Available plugins grid
- Install/uninstall
- Configuration UI
- Enable/disable toggles
- Update notifications

### 4. Notification System
**Component**: Frontend (Svelte) - Client-side only  
**Location**: `frontend/src/lib/components/NotificationCenter.svelte`  
**State**: Svelte store for notification queue  
**Integration**: Components dispatch via `$notifications.add()`

- Toast notifications
- Error messages
- Progress indicators
- Action buttons
- Notification center

### 5. Workspace Manager
**Component**: Frontend (Svelte) + Backend (Rust)  
**Frontend**: `frontend/src/lib/components/WorkspaceManager.svelte`  
**Backend**: StateManager for session persistence  
**IPC Commands**: `save_workspace`, `load_workspace`, `list_workspaces`  
**Storage**: SQLite for workspace configurations

- Session creation/switching
- Layout templates
- Auto-save configs
- Recent workspaces
- Project templates



## Service Abstraction Layer (Foundation for Web & AI)

### Overview
The service abstraction layer enables 90% code reuse between desktop and web platforms, preparing orchflow for both web deployment and AI integration without coupling the frontend to platform-specific APIs.

### Implementation

#### 1. Service Interfaces
```typescript
// frontend/src/lib/services/index.ts
export interface Services {
  terminal: TerminalService;
  file: FileService;
  ai: AIService;
  state: StateService;
}

// Terminal service contract
interface TerminalService {
  createSession(config: SessionConfig): Promise<Session>;
  createPane(sessionId: string, options?: PaneOptions): Promise<Pane>;
  sendInput(paneId: string, data: string): Promise<void>;
  onOutput(paneId: string, callback: (data: string) => void): Unsubscribe;
  resizePane(paneId: string, cols: number, rows: number): Promise<void>;
  closePane(paneId: string): Promise<void>;
}

// File service contract  
interface FileService {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listDirectory(path: string): Promise<FileEntry[]>;
  createDirectory(path: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  watchFile(path: string, callback: (event: FileEvent) => void): Unsubscribe;
}

// AI service contract
interface AIService {
  chat(message: string, context?: Context): Promise<AIResponse>;
  detectIntent(message: string): Promise<Intent>;
  createSwarm(config: SwarmConfig): Promise<SwarmSession>;
  getSwarmStatus(sessionId: string): Promise<SwarmStatus>;
}
```

#### 2. Platform Detection & Factory
```typescript
// frontend/src/lib/services/platform.ts
export function detectPlatform(): 'desktop' | 'web' {
  return typeof window.__TAURI__ !== 'undefined' ? 'desktop' : 'web';
}

// Service factory for platform-specific implementations
class ServiceFactory {
  static createServices(platform: 'desktop' | 'web'): Services {
    if (platform === 'desktop') {
      return {
        terminal: new TauriTerminalService(),
        file: new TauriFileService(),
        ai: new LocalAIService(),
        state: new SQLiteStateService()
      };
    } else {
      return {
        terminal: new WebTerminalService(),
        file: new APIFileService(),
        ai: new CloudAIService(),
        state: new PostgresStateService()
      };
    }
  }
}

// Usage in components
export function initializeApp() {
  const platform = detectPlatform();
  const services = ServiceFactory.createServices(platform);
  
  // Set globally accessible services
  setContext('terminal', services.terminal);
  setContext('file', services.file);
  setContext('ai', services.ai);
  setContext('state', services.state);
}
```

#### 3. Migration Strategy
1. **Define all service interfaces** first
2. **Implement desktop services** using existing Tauri commands
3. **Create mock services** for testing
4. **Add feature flags** for gradual migration
5. **Migrate components** one at a time to use abstract services

### Manager ↔ Orchestrator Protocol

#### Overview
The Manager-Orchestrator protocol enables AI agents to control terminals through a well-defined JSON-RPC 2.0 interface over WebSocket.

#### Implementation
```rust
// frontend/src-tauri/src/orchestrator_bridge.rs
pub struct OrchestratorBridge {
    websocket: WebSocketServer,
    manager: Arc<Manager>,
}

impl OrchestratorBridge {
    pub async fn start(&self, port: u16) -> Result<()> {
        // JSON-RPC 2.0 over WebSocket
        self.websocket.listen(port, |msg| {
            match msg.method.as_str() {
                "terminal.create" => self.handle_create_terminal(msg.params),
                "terminal.sendInput" => self.handle_send_input(msg.params),
                "terminal.resize" => self.handle_resize(msg.params),
                "swarm.status" => self.handle_swarm_status(msg.params),
                _ => Err("Unknown method")
            }
        })
    }
}
```

#### Protocol Specification
```typescript
// Protocol messages
interface TerminalCreateRequest {
  jsonrpc: "2.0";
  method: "terminal.create";
  params: {
    sessionId: string;
    terminalType: "build" | "test" | "repl" | "debug" | "agent";
    agentId?: string;
    metadata?: Record<string, any>;
  };
  id: number;
}

interface TerminalOutputEvent {
  jsonrpc: "2.0";
  method: "terminal.output";
  params: {
    terminalId: string;
    data: string;
    timestamp: number;
  };
}
```

## AI-Driven Features

### Vision
orchflow's AI integration transforms development through natural language interaction and intelligent multi-agent orchestration. Based on the unified architecture, AI assistants work in visual tmux panes, enabling transparent collaboration between humans and AI.

### Core AI Capabilities

#### 1. AI Agent Terminal System
**Components**: Orchestrator (TypeScript) + Manager (Rust)  
**Orchestrator**: `orchestrator/src/agents/` - Agent lifecycle and routing  
**Manager**: Terminal creation and PTY management  
**Integration**: Orchestrator requests terminals via Manager API  
**Architecture**: See [Unified Architecture](../architecture/UNIFIED_ARCHITECTURE.md) and [Manager/Orchestrator Architecture](../architecture/MANAGER_ORCHESTRATOR_ARCHITECTURE.md)

- **Visual Agent Separation**: Each AI agent operates in its own tmux pane
- **Swarm Monitoring**: Grid view of all active agents and their progress
- **Agent Roles**: Architect, Frontend Dev, Test Engineer, Build Engineer, etc.
- **ruv-FANN Integration**: Ephemeral neural networks for efficient agent spawning

#### 2. Natural Language Interface
- **AI Chat Component**: Primary interface for user interaction
- **Intent Detection**: Automatically route commands to appropriate agents
- **Context Awareness**: AI understands project state and history
- **Progressive Disclosure**: Complex orchestration happens transparently

#### 3. Terminal Intelligence
- **Purpose-Driven Terminals**: Build, Test, REPL, Debug, AI Agent types
- **Smart Command Routing**: Route commands based on intent and context
- **Error Pattern Learning**: Detect and suggest fixes for common errors
- **Process Lifecycle Tracking**: Monitor and manage long-running processes

#### 4. Collaborative Features
- **Shared Memory Bus**: Agents coordinate through shared context
- **Help Request System**: Agents can request assistance from specialists
- **Progress Visualization**: Real-time status updates in swarm monitor
- **Intervention Points**: Users can pause, redirect, or assist agents

### Implementation Approach
1. Start with terminal metadata and type system
2. Add AI agent roles and swarm visualization
3. Integrate with orchestrator for command routing
4. Build natural language interface
5. Connect to ruv-FANN for intelligent agent management

## Success Metrics

1. **Performance**
   - Command palette opens <50ms
   - File tree renders <100ms
   - Search results <200ms

2. **Usability**
   - All actions accessible via keyboard
   - Consistent UI patterns
   - Clear visual feedback

3. **Quality**
   - >90% test coverage for UI
   - Zero accessibility violations
   - <5ms interaction latency

## Timeline

### Week 1-2: Core Components
- Command Palette
- File Explorer base
- Terminal Panel integration

### Week 3-4: Productivity Features
- Status Bar
- Quick Switcher
- Git status indicators

### Week 5-6: Advanced Features
- Search & Replace
- Git Panel
- Plugin Manager UI

### Week 7-8: Polish & Testing
- Performance optimization
- Accessibility audit
- E2E test suite
- Documentation

## Risk Mitigation

1. **Complexity**: Start with MVP, iterate
2. **Performance**: Profile early and often
3. **Compatibility**: Test across platforms
4. **Accessibility**: Audit continuously
5. **User Feedback**: Alpha testing program

---

With this plan, orchflow will transform from a powerful backend into a complete, modern IDE that rivals VS Code while maintaining its terminal-first philosophy and performance advantages.