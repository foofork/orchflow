# OrchFlow Architecture

## Overview

OrchFlow is a terminal-based IDE that combines Neovim's editing power with intelligent terminal orchestration. It's built as a native desktop application using Tauri, providing VS Code-like functionality with better performance and terminal-first design.

## Core Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Tauri Shell (Rust)                     │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │   Window    │  │    State     │  │   Module      │  │
│  │  Manager    │  │    Store     │  │   Loader      │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
│         │                 │                  │           │
│  ┌─────────────────────────────────────────────────┐   │
│  │            Orchestrator (Rust/TypeScript)         │   │
│  │  ┌─────────┐  ┌─────────┐  ┌───────────────┐   │   │
│  │  │  Agent   │  │  Task   │  │   WebSocket   │   │   │
│  │  │ Manager  │  │Scheduler│  │    Server     │   │   │
│  │  └─────────┘  └─────────┘  └───────────────┘   │   │
│  └─────────────────────────────────────────────────┘   │
│         │                 │                  │           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │    Neovim    │  │     tmux     │  │   Frontend   │ │
│  │     RPC      │  │   Manager    │  │  (SvelteKit) │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Technology Stack

### Core Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| Shell wrapper | Tauri | Native window chrome, auto-updater, OS integration |
| UI framework | SvelteKit (static) | Zero SSR overhead, hot reload, reactive UI |
| Editor kernel | Neovim RPC | Modal editing, extensibility, cross-platform |
| Terminal runtime | tmux 3.2+ | Terminal multiplexing, session management |
| Orchestrator | Rust (Axum) + TypeScript | Task coordination, agent management |
| State store | SQLite (sqlx) | Persistent storage, zero-config database |
| Event bus | WebSocket | Real-time communication, event streaming |
| Modules | Flatfiles + SQLite | Plugin system, dynamic loading |

### Key Design Decisions

1. **Dual Orchestrator Architecture**: Both Rust (for performance) and TypeScript (for flexibility) orchestrators work together
2. **Headless Neovim**: Multiple Neovim instances managed via RPC for isolation
3. **tmux Integration**: Native terminal multiplexing instead of custom implementation
4. **Module System**: Dynamic loading with manifest-based configuration
5. **SQLite Everything**: Single-file database for all persistent state

## Component Details

### 1. Tauri Shell (Rust)

The native application shell providing:
- Window management
- OS integration (file associations, system tray)
- Native menus and shortcuts
- Auto-updater functionality
- Secure IPC bridge

**Key Files:**
- `frontend/src-tauri/src/main.rs` - Application entry point
- `frontend/src-tauri/src/startup.rs` - Optimized startup sequence
- `frontend/src-tauri/tauri.conf.json` - Tauri configuration

### 2. State Store

SQLite-based persistent storage for:
- User sessions and layouts
- Module configurations
- Editor states and preferences
- Terminal history and outputs

**Schema:** See `frontend/src-tauri/migrations/001_initial_schema.sql`

### 3. Neovim Integration

Headless Neovim instances managed via RPC:
- Each editor pane gets its own Neovim instance
- Communication via Unix sockets (macOS/Linux) or named pipes (Windows)
- Automatic instance lifecycle management

**Key APIs:**
- `nvim_create_instance()` - Spawn new Neovim
- `nvim_open_file()` - Open file in instance
- `nvim_execute_command()` - Run Vim commands

### 4. tmux Manager

Terminal multiplexing and session management:
- Automatic tmux server management
- Pane creation, splitting, and resizing
- Command execution and output capture
- Session persistence across restarts

**Key APIs:**
- `tmux_create_session()` - New tmux session
- `tmux_split_pane()` - Split terminal panes
- `tmux_send_keys()` - Send commands to panes

### 5. Module System

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

### 6. Orchestrator

Coordinates all components with:
- Task scheduling and execution
- Agent routing and management
- Resource allocation
- Event distribution
- WebSocket API for real-time updates

**Dual Implementation:**
- **Rust** (`frontend/src-tauri/src/orchestrator.rs`) - High-performance core
- **TypeScript** (`orchestrator/`) - Flexible business logic

### 7. Frontend (SvelteKit)

Reactive UI built with:
- Static adapter (no SSR needed in Tauri)
- Component-based architecture
- Real-time updates via WebSocket
- xterm.js for terminal rendering
- Monaco Editor for configuration panels (lazy loaded)

## Data Flow

### 1. Command Execution Flow
```
User Input → Frontend → Tauri IPC → Orchestrator → tmux/Neovim → Response
```

### 2. Event Flow
```
Component Event → Event Bus → Orchestrator → WebSocket → Frontend Update
```

### 3. Module Loading Flow
```
Discover Modules → Validate Manifests → Load Dependencies → Initialize → Register Commands
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
   - tmux provides session isolation
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
```

### Module Development

1. Create module directory in `modules/`
2. Add `manifest.json` with metadata
3. Implement `index.js` with required exports
4. Test with `module_scan` command

See `modules/example-terminal-agent/` for reference implementation.

## Future Enhancements

1. **Cloud Sync** - Settings and session sync across devices
2. **Collaboration** - Real-time collaborative editing
3. **GPU Acceleration** - Hardware-accelerated terminal rendering
4. **Mobile Companion** - iOS/Android apps for remote access
5. **AI Integration** - Built-in copilot functionality

## Related Documentation

- [API Reference](./API.md)
- [Module Development Guide](./MODULES.md)
- [Contributing Guide](./CONTRIBUTING.md)
- [Performance Guide](./PERFORMANCE.md)