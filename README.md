# Orchflow

> A high-performance terminal-first IDE designed as the foundation for AI-powered development orchestration

[![License](https://img.shields.io/badge/license-MIT%2FApache--2.0-blue.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/rust-1.75%2B-orange.svg)](https://www.rust-lang.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.0%2B-blue.svg)](https://www.typescriptlang.org/)
[![Tauri](https://img.shields.io/badge/tauri-2.0-yellow.svg)](https://tauri.app/)

## What is Orchflow?

Orchflow is a **terminal-first IDE** that combines powerful terminal management and code editing in a fast desktop application. It's architected as the foundation for future AI-powered development orchestration, providing the infrastructure needed for AI agents to eventually work alongside developers through intelligent terminal orchestration.

### Key Features

- **🚀 Native Performance** - Sub-100ms startup, ~10MB base memory usage
- **🖥️ Terminal Multiplexing** - Advanced session management with muxd daemon
- **📝 Neovim Integration** - Embedded Neovim for powerful text editing  
- **🔌 Plugin Architecture** - Extend functionality with JavaScript/TypeScript plugins
- **💾 Session Persistence** - Never lose your work with automatic state saving
- **🤖 AI-Ready Infrastructure** - Architecture designed for future AI agent integration

## Core Components

### 1. Desktop Application (Tauri)
- **Entry Point**: `desktop/src-tauri/src/main.rs`
- **Technology**: Rust backend with Tauri framework, SvelteKit frontend
- **Purpose**: Provides a native desktop application with system-level capabilities

### 2. Terminal Multiplexer Daemon (muxd)
- **Entry Point**: `muxd/src/main.rs`
- **Technology**: Rust async service using tokio
- **Commands**:
  - `muxd start` - Start the daemon (foreground or background)
  - `muxd stop` - Stop the daemon
  - `muxd status` - Check daemon status
- **Features**: Session persistence, terminal pane control, WebSocket API on port 50505

## User-Facing Features

### Terminal Management
- **Multiple Sessions**: Create and manage multiple terminal sessions
- **Tmux Integration**: Full tmux backend for session persistence
- **Real-time Streaming**: WebSocket-based terminal output streaming
- **Session Templates**: Save and restore terminal layouts
- **Terminal Groups**: Organize terminals into logical groups

### Code Editing
- **Neovim Integration**: Embedded Neovim instances for powerful text editing
- **Buffer Management**: Seamless file operations within Neovim
- **Mode Detection**: Track and respond to Neovim modes
- **Command Execution**: Run Neovim commands programmatically

### File Management
- **Tree Explorer**: Hierarchical file navigation with expand/collapse
- **File Operations**: Create, delete, rename, move, copy files and directories
- **Trash Support**: Safe deletion with restore capability
- **File Watching**: Real-time updates when files change
- **Git Integration**: Visual indicators for file status

### User Interface Components
- **Activity Bar**: Quick access to different application views
- **Sidebar**: Contains file explorer, search, and git panels
- **Tab Bar**: Manage open files and terminals
- **Status Bar**: System status, notifications, and metrics
- **Command Palette**: Quick command execution (Ctrl/Cmd+P)
- **Settings Modal**: Configure application preferences
- **Plugin Manager**: Install and manage extensions

### Plugin System
- **JavaScript/TypeScript Plugins**: Extend functionality with custom code
- **Command Registration**: Add new commands to the command palette
- **Event System**: React to application events
- **Manifest Validation**: Ensure plugin compatibility

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (SvelteKit)                      │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │   Routes    │  │  Components  │  │     Stores      │   │
│  └──────┬──────┘  └──────┬───────┘  └────────┬────────┘   │
│         └─────────────────┴────────────────────┴────────┐  │
│                          API Layer                       │  │
│                   (WebSocket + Tauri IPC)                │  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────┐
│                    Tauri Backend                             │
│         Manager Service · Terminal Service · File Service    │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────┐
│                    Muxd Server                               │
│      Session Management · PTY Control · State Persistence    │
└──────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **Framework**: SvelteKit 2.22.5
- **UI Library**: Svelte 5.35.7
- **Terminal**: xterm.js 5.5.0
- **Editor**: CodeMirror 6
- **Build Tool**: Vite 6.3.5

### Backend
- **Core**: Rust with Tauri 2.0
- **Async Runtime**: tokio 1.46
- **Web Server**: axum 0.7
- **Database**: SQLite (via rusqlite 0.31)
- **Terminal Handling**: portable-pty 0.8
- **WebSocket**: tokio-tungstenite 0.24

## Installation

### Prerequisites

- **Node.js** 20.0+ and npm 9.0+
- **Rust** 1.75+ (via [rustup](https://rustup.rs/))
- **Git** 2.30+
- **tmux** 3.0+ (for terminal multiplexing)

#### Platform-specific Requirements

<details>
<summary>macOS</summary>

```bash
# Install Xcode Command Line Tools
xcode-select --install

# Install tmux via Homebrew
brew install tmux
```
</details>

<details>
<summary>Linux</summary>

Ubuntu/Debian:
```bash
sudo apt update
sudo apt install -y libwebkit2gtk-4.0-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev tmux build-essential pkg-config libssl-dev
```

Fedora:
```bash
sudo dnf install -y webkit2gtk3-devel gtk3-devel libappindicator-gtk3-devel librsvg2-devel tmux gcc pkg-config openssl-devel
```

Arch:
```bash
sudo pacman -S webkit2gtk gtk3 libayatana-appindicator librsvg tmux base-devel pkg-config openssl
```
</details>

<details>
<summary>Windows</summary>

- Visual Studio 2022 with C++ build tools
- Windows SDK
- WebView2 (usually pre-installed on Windows 10/11)
- Git Bash or WSL2 for tmux support
</details>

### Building from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/orchflow.git
cd orchflow

# Install dependencies
cd desktop
npm install

# Build the application
npm run tauri:build

# Or run in development mode
npm run tauri:dev
```

## Usage

### Starting Orchflow

```bash
# Run the desktop application
./target/release/orchflow

# Or start in development mode
npm run tauri:dev
```

### Terminal Multiplexer (muxd)

The muxd daemon provides advanced terminal management:

```bash
# Start the daemon
muxd start

# Check status
muxd status

# Stop the daemon
muxd stop
```

### Core Operations

- **Create Session**: `Ctrl/Cmd + N` - New terminal session
- **Switch Sessions**: `Ctrl/Cmd + [1-9]` - Quick session switching
- **Command Palette**: `Ctrl/Cmd + P` - Access all commands
- **File Explorer**: `Ctrl/Cmd + E` - Toggle file tree
- **Settings**: `Ctrl/Cmd + ,` - Open preferences

## API Reference

Orchflow provides a comprehensive API with 227+ command handlers:

### Key APIs

- **Session Management** - Create, delete, rename, and switch sessions
- **Terminal Operations** - Full PTY control with streaming I/O
- **File Operations** - Complete file system access with trash support
- **Git Integration** - Status, diff, commit, push/pull operations
- **Plugin System** - Load and execute custom plugins
- **Neovim Integration** - Embedded editor control

See [API_REFERENCE.md](API_REFERENCE.md) for complete documentation.

## Who Would Use Orchflow?

Based on the discovered functionality, Orchflow is designed for:

1. **Terminal Power Users**: Developers who prefer terminal-based workflows but want modern IDE conveniences
2. **Tmux Users**: Those seeking a graphical interface for tmux with enhanced features
3. **Neovim Users**: Developers wanting Neovim with integrated file management and terminals
4. **Performance-Conscious Developers**: Those needing a fast, lightweight IDE alternative
5. **Future AI Development**: Teams preparing infrastructure for AI-assisted development workflows

## Key Differentiators

1. **Terminal-First Design**: Built around terminal workflows, not adapted from traditional IDEs
2. **Native Performance**: Rust backend ensures minimal resource usage
3. **Session Persistence**: Never lose terminal state between restarts
4. **AI-Ready Architecture**: Infrastructure prepared for future AI orchestration
5. **Extensible Design**: Plugin system for custom functionality

## Development

### Project Structure

```
orchflow/
├── desktop/          # Tauri desktop application
│   ├── src/         # Frontend (SvelteKit)
│   └── src-tauri/   # Backend (Rust)
├── muxd/            # Terminal multiplexer daemon
├── lua/             # Neovim integration
└── docs/            # Documentation
```

### Running Tests

```bash
# Frontend tests
cd desktop
npm run test:unit

# Backend tests
cd desktop/src-tauri
cargo test

# Muxd tests
cd muxd
cargo test
```

### Code Quality Standards

- **Zero TypeScript Errors** ✅
- **Zero ESLint Errors** ✅
- **Zero Rust Compilation Errors** ✅
- **>90% Test Coverage** (target)
- **TDD Mandatory** - Write tests first

## Performance Characteristics

Orchflow is designed for speed:

- **Startup Target**: <100ms (optimized Rust backend)
- **Memory Usage**: ~10MB baseline
- **Build Time**: <60 seconds
- **Real-time Updates**: WebSocket latency <10ms locally

## Data Storage

- **Configuration**: SQLite database for settings and state
- **Session Data**: Persistent storage of terminal sessions
- **Command History**: Searchable command history across sessions
- **Test Results**: Storage and retrieval of test execution data
- **Plugin Data**: Isolated storage for plugin configurations

## Roadmap

### Current Focus (Q1 2025)

- [ ] UI Overhaul
- [x] Core infrastructure complete
- [x] 227+ API endpoints implemented

### Future Plans

- **AI Agent Integration** - Enable AI agents to spawn and control terminals
- **Swarm Coordination** - Multi-agent orchestration capabilities
- **Neural Network Integration** - Direct AI model integration (evaluating ruv-FANN)
- **Cloud Sync** - Session synchronization across devices

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests first (TDD)
4. Implement your feature
5. Ensure all tests pass
6. Submit a Pull Request

## Security

- Sandboxed file operations through Tauri
- Localhost-only WebSocket connections
- Plugin isolation with permission model
- No telemetry or data collection

## License

This project is dual-licensed under MIT and Apache 2.0. See [LICENSE](LICENSE) for details.

## Acknowledgments

Built with:
- [Tauri](https://tauri.app/) - Native app framework
- [SvelteKit](https://kit.svelte.dev/) - Frontend framework
- [Tokio](https://tokio.rs/) - Async runtime
- [xterm.js](https://xtermjs.org/) - Terminal emulator

## Status

⚠️ **Pre-release Software**: Orchflow is under active development. APIs and features may change. Not recommended for production use yet.

### Current State
- Core infrastructure: ✅ Complete
- Terminal management: ✅ Working
- File operations: ✅ Implemented
- Plugin system: ✅ Functional
- AI integration: 🚧 In development

---

**Vision**: Create the foundation for AI-powered development where agents and developers work together seamlessly through intelligent terminal orchestration.

For more information, see our [documentation](docs/).