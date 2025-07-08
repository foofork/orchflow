# orchflow

A next-generation terminal-based IDE that orchestrates multiple tools and workflows into a unified development environment. Think of it as VS Code meets tmux, but built from the ground up for developers who prefer terminal-first workflows.

## What is orchflow?

orchflow is designed to solve a fundamental problem: modern development requires juggling multiple terminals, editors, build processes, and tools. Instead of alt-tabbing between windows or managing complex tmux sessions, orchflow provides intelligent orchestration of all these tools in a single, fast desktop application.

### Core Capabilities

- **Intelligent Terminal Orchestration**: Manage multiple terminal sessions with automatic layout management, command history tracking, and the ability to broadcast commands across multiple panes. Built on a flexible MuxBackend abstraction that currently uses tmux but can support other backends.

- **Real-time Terminal Streaming**: Full PTY (pseudo-terminal) implementation with bidirectional I/O, supporting any shell or terminal application. Features include scrollback buffers, terminal search, process health monitoring, and automatic restart on crashes.

- **Advanced File Management**: Beyond basic file operations - includes trash support with metadata tracking, operation history with undo/redo, Git integration (in progress), virtual file system for performance, and project-wide search using ripgrep.

- **Unified State Management**: All application state is managed through a central StateManager with SQLite persistence, event-driven updates, and automatic synchronization between frontend and backend.

- **Extensible Plugin System**: Write plugins in JavaScript/TypeScript with hot-reload support, full API access to terminal/file/state management, and example plugins for Git, Docker, and test runners.

- **Neovim Integration**: Use Neovim as the editor within terminal panes, with full RPC support planned for deeper integration.

### Where It's Headed

**Phase 7 (Current)**: Building essential UI components
- Command palette with fuzzy search and plugin commands
- Advanced file explorer with Git status indicators
- Integrated terminal panel with tabs and splits
- Search and replace across projects
- Git integration panel with diff viewer

**Future Vision**:
- **AI-Powered Orchestration**: Connect to LLMs for intelligent command suggestions, automated workflow creation, and code understanding
- **Collaborative Development**: Real-time session sharing, pair programming support, and team workspaces
- **Language Intelligence**: Full LSP support with inline diagnostics, intelligent code completion, and refactoring tools
- **Workflow Automation**: Record and replay complex workflows, conditional command execution, and scheduled tasks
- **Cloud Integration**: Sync settings and sessions across machines, remote development support, and cloud-based plugin marketplace

### What Makes It Different

1. **Terminal-First Philosophy**: Unlike VS Code which bolts on terminal support, orchflow is built around terminal workflows from day one.

2. **Performance Obsessed**: <100ms startup time, ~10MB base memory usage, and aggressive optimization throughout.

3. **True Orchestration**: Not just running commands - orchflow understands relationships between processes, can coordinate multiple tools, and provides intelligent automation.

4. **Hybrid Architecture**: Combines the best of desktop apps (native performance, system integration) with web technologies (flexible UI, easy customization).

## Project Status

**Development Stage**: Pre-release (Active Development)

- ✅ **Phases 1-6 Complete**: Core infrastructure including terminal streaming, file management, state system, plugin architecture
- 🚧 **Phase 7 In Progress**: Essential UI components 
- 📋 **High-Priority Tech Debt**: Git integration, WASM plugin support, module registry

The foundation is solid and feature-complete. We're now building the UI layer that will make these powerful capabilities accessible.

## Prerequisites

- Rust 1.70+
- Node.js 20+
- tmux 3.0+ (for terminal multiplexing)
- Git (for version control features)

## Installation

```bash
# Clone repository
git clone https://github.com/orchflow/orchflow.git
cd orchflow

# Install frontend dependencies
cd frontend
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## Development

### Project Structure

```
orchflow/
├── frontend/                 # Svelte frontend
│   ├── src/                 # Frontend source
│   └── src-tauri/           # Rust backend
│       └── src/             # Backend source
├── docs/                    # Documentation
└── .github/                 # CI/CD workflows
```

### Running Tests

```bash
# Backend tests
cd frontend/src-tauri
cargo test

# Frontend tests
cd frontend
npm test

# Test coverage
cd frontend/src-tauri
./scripts/test-coverage.sh
```

### Code Quality

- Rust: `cargo clippy` (no warnings)
- TypeScript: ESLint configured
- Test Coverage: >85% requirement
- CI/CD: GitHub Actions for all platforms

## Architecture

- **Backend**: Tauri + Rust for system operations
- **Frontend**: SvelteKit for UI
- **IPC**: Type-safe commands between frontend/backend
- **Storage**: SQLite via SimpleStateStore
- **Terminal**: PTY management with portable-pty

## Roadmap

See [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) for detailed progress.

- ✅ Phase 1-6: Core infrastructure (complete)
- 🚧 Phase 7: Essential UI components (in progress)
- 📋 Future: Plugin marketplace, collaboration features

## Contributing

This project is in early development. Contribution guidelines will be established once we reach beta.

## License

MIT OR Apache-2.0 (dual licensed)

## Acknowledgments

Built with:
- [Tauri](https://tauri.app/) - Desktop application framework
- [portable-pty](https://github.com/wez/portable-pty) - Cross-platform PTY
- [Svelte](https://svelte.dev/) - UI framework

---

*Note: This is pre-release software under active development. APIs and features may change.*