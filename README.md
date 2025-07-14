# Orchflow

> **High-performance, tmux-based Terminal-First IDE Designed for AI-Powered Development Orchestration**

[![License](https://img.shields.io/badge/license-MIT%2FApache--2.0-blue.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/rust-1.75%2B-orange.svg)](https://www.rust-lang.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.0%2B-blue.svg)](https://www.typescriptlang.org/)
[![Tauri](https://img.shields.io/badge/tauri-2.0-yellow.svg)](https://tauri.app/)

---

Orchflow is a lightweight, **tmux-based, terminal-first IDE** combining powerful terminal management, Neovim integration, and a plugin-driven architecture designed specifically to enable AI-powered development orchestration.

## 🚀 Key Features

* **Native Performance**: Instant startup (<100ms), minimal memory (~10MB)
* **Tmux Multiplexing**: Powerful session management via `muxd`
* **Embedded Neovim**: Full editing capabilities with Neovim integration
* **Extensible Plugins**: Expand with custom JavaScript/TypeScript plugins
* **Persistent Sessions**: Auto-save sessions and restore seamlessly
* **AI-Ready**: Infrastructure optimized for future AI agent integrations

## 🛠️ Core Components

### Desktop Application (Tauri)

* **Rust Backend**, **SvelteKit Frontend**
* Native performance and system-level integration

### Tmux Multiplexer Daemon (`muxd`)

* **Rust Async Daemon** (tokio-based)
* Commands: `start`, `stop`, `status`
* WebSocket API for terminal control (port 50505)

## ✨ User-Facing Features

### Terminal Management

* Multiple session support (tmux-powered)
* Real-time streaming with WebSocket
* Session templates and group organization

### Code Editing

* Embedded Neovim instances
* Intelligent buffer and mode management
* Programmatic Neovim command execution

### File Management

* Hierarchical file explorer
* Real-time file watching and Git integration
* Trash support for safe deletion

### User Interface

* Activity bar, sidebar, tabs, and command palette
* Customizable settings and plugin manager

### Plugin System

* Easy plugin creation in JavaScript/TypeScript
* Event-driven extensibility and command registration

## 📐 Architecture Overview

```
Frontend (SvelteKit)
├── Routes · Components · Stores
└── API Layer (WebSocket + Tauri IPC)
          │
Tauri Backend (Rust)
├── Manager · Terminal · File Services
└── muxd Server (Session & PTY Management via tmux)
```

## 💻 Technology Stack

**Frontend:**

* SvelteKit, xterm.js, CodeMirror, Vite

**Backend:**

* Rust (Tauri), tokio, axum, SQLite, portable-pty, tmux

## 📦 Installation

### Prerequisites

* Node.js 20+, Rust 1.75+, Git 2.30+, tmux 3.0+

<details>
<summary><strong>Platform-specific setup</strong></summary>

**macOS**:

```bash
xcode-select --install
brew install tmux
```

**Linux (Ubuntu)**:

```bash
sudo apt update
sudo apt install -y libwebkit2gtk-4.0-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev tmux build-essential pkg-config libssl-dev
```

**Windows**:

* Visual Studio 2022 with C++ build tools
* Windows SDK, WebView2, Git Bash/WSL2

</details>

### Build & Run

```bash
git clone https://github.com/yourusername/orchflow.git
cd orchflow/desktop
npm install

# Production build
npm run tauri:build

# Development
npm run tauri:dev
```

## 🚦 Usage Quickstart

### Orchflow Desktop

```bash
./target/release/orchflow
```

### Tmux Multiplexer (`muxd`)

```bash
muxd start | muxd status | muxd stop
```

### Common Shortcuts

* **New Session**: `Ctrl/Cmd + N`
* **Switch Session**: `Ctrl/Cmd + [1-9]`
* **Command Palette**: `Ctrl/Cmd + P`
* **File Explorer**: `Ctrl/Cmd + E`
* **Settings**: `Ctrl/Cmd + ,`

## 📖 API Reference

227+ comprehensive command handlers for:

* Session and terminal control
* Complete file system operations
* Plugin management
* Neovim interaction

See [API_REFERENCE.md](docs/API_REFERENCE.md).

## 🎯 Who Benefits Most?

* Terminal power users
* Neovim and tmux enthusiasts
* Developers seeking performance and extensibility
* Teams adopting AI-driven workflows

## 🌟 Differentiators

* Tmux-based workflow, native speed, robust session persistence
* Purpose-built AI orchestration infrastructure
* Fully extensible through plugins

## 🔮 Future Roadmap

* **AI Agent Integration**: Terminal orchestration by intelligent agents
* **Swarm Coordination**: Multi-agent parallel workflows
* **Neural Integration**: Native AI models (e.g., ruv-FANN)
* **Cloud Sync**: Multi-device session synchronization

## 🔒 Security & Privacy

* Sandboxed file operations
* Local-only WebSocket connections
* Plugin isolation, zero telemetry

## 📜 Licensing

MIT and Apache 2.0 dual-license. [License details](LICENSE).

## 🙌 Acknowledgments

Built with:

* [Tauri](https://tauri.app/), [SvelteKit](https://kit.svelte.dev/), [Tokio](https://tokio.rs/), [xterm.js](https://xtermjs.org/)

---

**⚠️ Status: Pre-release Software.** APIs/features may evolve. Not yet production-ready.

**Vision:** Seamless AI-driven terminal orchestration empowering human-agent collaboration.