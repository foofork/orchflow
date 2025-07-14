# Orchflow Setup Guide

This guide provides verified instructions for setting up Orchflow on all supported platforms. All steps have been tested and validated against the actual codebase.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Platform-Specific Requirements](#platform-specific-requirements)
3. [Installation Steps](#installation-steps)
4. [Build Commands](#build-commands)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)
7. [Development Setup](#development-setup)

## Prerequisites

### Required Tools

| Tool | Minimum Version | Check Command | Installation Guide |
|------|----------------|---------------|-------------------|
| Node.js | 20.0.0 | `node --version` | [nodejs.org](https://nodejs.org/) |
| Rust | 1.75.0 | `rustc --version` | [rustup.rs](https://rustup.rs/) |
| Git | 2.30.0 | `git --version` | [git-scm.com](https://git-scm.com/) |
| tmux | 3.0 | `tmux -V` | See platform-specific |

### Verifying Prerequisites

```bash
# Check all versions at once
node --version && npm --version && rustc --version && cargo --version && git --version && tmux -V
```

## Platform-Specific Requirements

### macOS

```bash
# Install Xcode Command Line Tools
xcode-select --install

# Install tmux via Homebrew
brew install tmux

# Verify installation
xcode-select -p
```

### Linux (Ubuntu/Debian)

```bash
# Update package list
sudo apt update

# Install required dependencies
sudo apt install -y \
    libwebkit2gtk-4.0-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    tmux \
    build-essential \
    pkg-config \
    libssl-dev

# Additional for some distributions
sudo apt install -y libjavascriptcoregtk-4.0-dev
```

### Linux (Fedora/RHEL)

```bash
# Install required dependencies
sudo dnf install -y \
    webkit2gtk3-devel \
    gtk3-devel \
    libappindicator-gtk3-devel \
    librsvg2-devel \
    tmux \
    gcc \
    pkg-config \
    openssl-devel
```

### Linux (Arch)

```bash
# Install required dependencies
sudo pacman -S \
    webkit2gtk \
    gtk3 \
    libayatana-appindicator \
    librsvg \
    tmux \
    base-devel \
    pkg-config \
    openssl
```

### Windows

1. **Install Visual Studio Build Tools**
   - Download from [Visual Studio](https://visualstudio.microsoft.com/downloads/)
   - Select "Desktop development with C++" workload
   - Include Windows 10/11 SDK

2. **Install tmux for Windows**
   - Option 1: WSL2 (Recommended)
     ```bash
     wsl --install
     # Inside WSL:
     sudo apt install tmux
     ```
   - Option 2: Git Bash with tmux
   - Option 3: MSYS2

3. **Install WebView2**
   - Usually comes with Windows 10/11
   - If missing: [Download WebView2](https://developer.microsoft.com/microsoft-edge/webview2/)

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/orchflow.git
cd orchflow
```

### 2. Install Frontend Dependencies

```bash
# Navigate to desktop directory
cd desktop

# Install npm dependencies
npm install

# Verify installation
npm list @tauri-apps/cli @sveltejs/kit
```

### 3. Install Rust Dependencies

```bash
# The Tauri CLI will be installed via npm
# Rust dependencies are managed by Cargo automatically

# Optional: Install cargo-watch for development
cargo install cargo-watch
```

### 4. Build Muxd Daemon

```bash
# From project root
cd muxd
cargo build --release

# Verify build
./target/release/muxd --version
```

## Build Commands

### Development Mode

```bash
# Frontend only (hot reload)
npm run dev

# Full application (hot reload)
npm run tauri:dev

# With debug logging
RUST_LOG=debug npm run tauri:dev

# With specific log levels
RUST_LOG=muxd=debug,orchflow=info npm run tauri:dev
```

### Production Build

```bash
# Standard build
npm run tauri:build

# Optimized build (smaller binary)
./optimize-build.sh

# Platform-specific builds
npm run tauri:build -- --target x86_64-pc-windows-msvc  # Windows
npm run tauri:build -- --target x86_64-apple-darwin    # macOS Intel
npm run tauri:build -- --target aarch64-apple-darwin   # macOS Apple Silicon
npm run tauri:build -- --target x86_64-unknown-linux-gnu # Linux
```

### Test Commands

```bash
# Run all tests
npm test

# Frontend tests
npm run test:unit
npm run test:unit:watch  # Watch mode
npm run test:integration

# Rust tests
cargo test --all

# Specific test suites
cd desktop && npm run test:coverage
cd muxd && cargo test
```

## Verification

### 1. Check Installation

```bash
# Run from desktop directory
npm run tauri info
```

Expected output includes:
- ✓ Node.js version
- ✓ Rust version
- ✓ Tauri CLI version
- ✓ Platform-specific dependencies

### 2. Run Development Server

```bash
npm run tauri:dev
```

Expected behavior:
- Window opens within 5 seconds
- No console errors
- Terminal interface visible

### 3. Test Core Features

1. **Create Session**: Click "New Session" → Terminal appears
2. **Run Command**: Type `echo "Hello Orchflow"` → See output
3. **File Explorer**: Click file icon → File tree loads
4. **Settings**: Click gear icon → Settings modal opens

### 4. Run Smoke Tests

```bash
# Automated verification
npm run test:smoke
```

## Troubleshooting

### Common Issues

#### Build Fails: "Cannot find module"

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Rust Build Error: "linker not found"

**Linux**:
```bash
sudo apt install build-essential
```

**macOS**:
```bash
xcode-select --install
```

#### WebView2 Error (Windows)

1. Check Windows version (requires Windows 10 1803+)
2. Install WebView2 Runtime
3. Restart and rebuild

#### tmux Not Found

```bash
# Check tmux is in PATH
which tmux

# Add to PATH if needed
export PATH="$PATH:/usr/local/bin"
```

#### Permission Denied

```bash
# Fix permissions
chmod +x ./optimize-build.sh
chmod +x ./desktop/src-tauri/target/release/orchflow
```

### Debug Mode

```bash
# Maximum verbosity
RUST_LOG=trace npm run tauri:dev

# Check specific module
RUST_LOG=orchflow::terminal=debug npm run tauri:dev

# Frontend debugging
npm run dev -- --debug
```

## Development Setup

### IDE Configuration

#### VS Code

`.vscode/settings.json`:
```json
{
  "rust-analyzer.cargo.target": "x86_64-unknown-linux-gnu",
  "rust-analyzer.checkOnSave.command": "clippy",
  "svelte.enable-ts-plugin": true,
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[rust]": {
    "editor.defaultFormatter": "rust-lang.rust-analyzer"
  }
}
```

#### Recommended Extensions

- Svelte for VS Code
- rust-analyzer
- Tauri
- Even Better TOML
- Error Lens

### Git Hooks

```bash
# Install pre-commit hooks
npm run prepare

# Manual hook installation
cp .githooks/* .git/hooks/
chmod +x .git/hooks/*
```

### Environment Variables

Create `.env.local` in desktop directory:
```bash
# Development settings
VITE_DEV_SERVER_URL=http://localhost:5173
RUST_LOG=info
MUXD_PORT=50505

# Optional features
ENABLE_PLUGINS=true
ENABLE_ANALYTICS=false
```

## Next Steps

1. **Read Documentation**:
   - [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) - Understand the project
   - [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
   - [API_REFERENCE.md](./API_REFERENCE.md) - API documentation

2. **Explore Examples**:
   - Sample plugins in `examples/plugins/`
   - Configuration examples in `examples/config/`

3. **Join Development**:
   - Check [CONTRIBUTING.md](./CONTRIBUTING.md)
   - Review open issues
   - Join Discord community

## Quick Reference

```bash
# Most common commands
npm run tauri:dev          # Start development
npm run tauri:build        # Build for production
npm test                   # Run all tests
npm run lint               # Check code style
npm run format             # Fix formatting

# Rust commands
cargo check                # Quick compilation check
cargo clippy               # Lint Rust code
cargo fmt                  # Format Rust code

# Muxd daemon
./muxd/target/release/muxd start   # Start daemon
./muxd/target/release/muxd status  # Check status
./muxd/target/release/muxd stop    # Stop daemon
```

This setup guide is based on actual dependency versions and build configurations found in the codebase. All commands have been verified to work with the current project structure.