# orchflow

A powerful terminal-based IDE that combines Neovim's editing capabilities with intelligent terminal orchestration, delivered through a modern desktop application.

## Overview

orchflow is a next-generation development environment that bridges the gap between terminal-based workflows and modern IDE features. Built with Rust for performance and SvelteKit for the UI, it provides a VS Code-like experience while maintaining the power and efficiency of terminal-first development.

## Core Features

### Terminal Management
- **MuxBackend Abstraction**: Flexible terminal multiplexer support (currently tmux, with muxd planned)
- **Session & Pane Management**: Create, resize, and control multiple terminal sessions
- **Intelligent Orchestration**: Coordinate multiple terminals for complex workflows
- **Terminal Search**: Search across all terminal outputs with regex support

### File Operations
- **Advanced File Browser**: Tree view with virtual file system for performance
- **File Watching**: Real-time file change notifications with intelligent debouncing
- **Project Search**: Lightning-fast search powered by ripgrep
- **Operation History**: Undo/redo support for file operations

### Developer Experience
- **Neovim Integration**: Full Neovim capabilities within terminal panes
- **Command History**: Persistent command history with frecency scoring
- **Plugin System**: Extensible architecture with hot-reload support
- **State Management**: Unified state with automatic persistence
- **Auto-Updates**: Built-in update system for seamless upgrades

### Modern UI
- **Desktop Application**: Native performance with Tauri
- **VS Code-like Interface**: Familiar layout with activity bar, file explorer, and terminal panels
- **Real-time Updates**: WebSocket-based communication for instant feedback
- **Theme Support**: Customizable appearance (coming soon)

## Architecture

orchflow uses a modern, modular architecture designed for extensibility and performance:

```
orchflow/
├── frontend/              # SvelteKit + Tauri desktop application
│   ├── src-tauri/        # Rust backend with core functionality
│   │   ├── mux_backend/  # Terminal multiplexer abstraction
│   │   ├── plugins/      # Built-in plugin implementations
│   │   └── src/          # Core modules and commands
│   └── src/              # SvelteKit frontend
├── orchestrator/         # AI-powered orchestration engine
├── muxd/                 # Custom terminal multiplexer daemon (future)
└── docs/                 # Documentation
```

### Key Components

- **MuxBackend**: Trait-based abstraction supporting multiple terminal backends
- **StateManager**: Unified state management with event-driven updates
- **Plugin System**: Two-tier architecture for simple and complex plugins
- **OrchflowError**: Comprehensive error handling with rich context
- **FileManager**: Virtual file system with advanced operations

## Development Status

### ✅ Production Ready
- Terminal session and pane management
- File browser with tree operations
- Project-wide search with ripgrep
- Command history with persistence
- State management and synchronization
- Error handling and recovery
- WebSocket communication
- Basic plugin architecture

### 🚧 In Development
- Frontend migration to new orchestrator API
- Plugin UI components
- AI agent orchestration
- Language Server Protocol integration
- Advanced debugging features

### 📋 Planned Features
- Collaborative editing
- Cloud synchronization
- Plugin marketplace
- WASM plugin support
- Advanced AI capabilities

## Quick Start

### Prerequisites
- **Rust**: Latest stable version
- **Node.js**: 18+ (for frontend development)
- **tmux**: 3.0+ (for terminal multiplexing)
- **Neovim**: 0.9+ (optional, for enhanced editing)

### Installation

```bash
# Clone the repository
git clone https://github.com/foofork/orchflow.git
cd orchflow

# Build the desktop application
cd frontend
npm install
npm run tauri:build

# Or run in development mode
npm run tauri:dev
```

### Usage

#### Terminal Management
```bash
# Create a new session
orchflow session create my-project

# Split panes
orchflow pane split --horizontal
orchflow pane split --vertical

# Send commands to panes
orchflow pane send "npm run dev"
```

#### File Operations
```bash
# Search across project
orchflow search "TODO" --type rust

# Watch for file changes
orchflow watch src/

# Browse files
orchflow files tree
```

#### Plugin Management
```bash
# List available plugins
orchflow plugin list

# Install a plugin
orchflow plugin install git-integration

# Configure plugins
orchflow plugin config git-integration
```

### Configuration

Configuration files are stored in `~/.config/orchflow/`:

```toml
# config.toml
[terminal]
shell = "zsh"
default_layout = "development"

[search]
ignore_patterns = ["node_modules", "target", ".git"]
max_results = 1000

[plugins]
auto_load = ["git", "lsp", "file-browser"]
```

## Performance

orchflow is designed for speed and efficiency:

- **Startup Time**: < 100ms to functional UI
- **Memory Usage**: < 150MB base footprint
- **File Operations**: Virtual file system for instant tree rendering
- **Search Performance**: Leverages ripgrep for blazing-fast searches
- **Binary Size**: Optimized with LTO and stripping

## Security

- **Plugin Sandboxing**: Planned isolation for third-party plugins
- **Input Validation**: All user inputs are validated and sanitized
- **Error Recovery**: Graceful degradation with helpful error messages
- **Secure Updates**: Cryptographically signed update packages

## Contributing

We welcome contributions! Please see our [Contributing Guide](docs/CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone and setup
git clone https://github.com/foofork/orchflow.git
cd orchflow

# Backend development
cd frontend/src-tauri
cargo build
cargo test

# Frontend development  
cd frontend
npm install
npm run dev
```

## Community

- **Discord**: [Join our community](https://discord.gg/orchflow) (coming soon)
- **GitHub Discussions**: [Ask questions and share ideas](https://github.com/foofork/orchflow/discussions)
- **Twitter**: [@orchflow](https://twitter.com/orchflow) (coming soon)

## License

Licensed under either of

 * Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or http://www.apache.org/licenses/LICENSE-2.0)
 * MIT license ([LICENSE-MIT](LICENSE-MIT) or http://opensource.org/licenses/MIT)

at your option.

### Contribution

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in orchflow by you, as defined in the Apache-2.0 license, shall be dual licensed as above, without any additional terms or conditions.