# Contributing to orchflow

Welcome to orchflow! This guide covers everything you need to know about contributing to the project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Architecture Overview](#architecture-overview)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Coding Standards](#coding-standards)
- [Documentation](#documentation)
- [Submitting Changes](#submitting-changes)

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Set up development environment** (see below)
4. **Create a branch** for your changes
5. **Make your changes** following TDD practices
6. **Submit a pull request**

## Development Setup

### Prerequisites

- **Node.js** 20+ and npm
- **Rust** 1.70+ (via rustup)
- **Git**
- **tmux** 3.0+ (for terminal multiplexing)
- **OS-specific requirements**:
  - macOS: Xcode Command Line Tools
  - Linux: `libgtk-3-dev`, `libwebkit2gtk-4.0-dev`, `libssl-dev`
  - Windows: Visual Studio Build Tools

### Initial Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/orchflow.git
cd orchflow

# Add upstream remote
git remote add upstream https://github.com/orchflow/orchflow.git

# Install frontend dependencies
cd frontend
npm install

# Run initial build
npm run tauri dev
```

## Architecture Overview

orchflow is a terminal-based IDE built with:
- **Frontend**: SvelteKit + TypeScript + Tauri
- **Backend**: Rust with Manager pattern
- **Terminal**: PTY streaming with portable-pty
- **State**: SQLite with unified state management

### Project Structure

```
orchflow/
├── frontend/                 # SvelteKit frontend
│   ├── src/
│   │   ├── lib/            # Components and stores
│   │   ├── routes/         # SvelteKit routes
│   │   └── app.html        # HTML template
│   └── src-tauri/          # Rust backend
│       ├── src/
│       │   ├── manager/    # Core orchestration
│       │   ├── terminal_stream/ # PTY management
│       │   └── main.rs     # Entry point
│       └── Cargo.toml      # Rust dependencies
├── docs/                   # Documentation
│   └── architecture/       # Architecture docs
└── CLAUDE.md              # AI context and rules
```

### Core Components

1. **Manager** (`src-tauri/src/manager/`)
   - Central orchestration component
   - Handles sessions, panes, and plugins
   - Provides unified API for frontend

2. **Terminal Streaming** (`src-tauri/src/terminal_stream/`)
   - PTY management with portable-pty
   - Real-time streaming via IPC
   - Base64 encoded output
   - See [PTY Architecture](architecture/PTY_ARCHITECTURE.md)

3. **State Management**
   - Backend: SimpleStateStore (SQLite)
   - Frontend: Svelte stores
   - WebSocket for real-time sync

4. **Plugin System**
   - JavaScript/TypeScript plugins
   - Hot-reload support
   - Sandboxed execution

## Development Workflow

### Before Starting

1. Check [DEVELOPMENT_ROADMAP.md](../DEVELOPMENT_ROADMAP.md) for current priorities
2. Review existing issues and PRs
3. Ensure your fork is up to date:
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

### Making Changes

1. **Create a feature branch**:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Follow TDD practices**:
   - Write tests first
   - See implementation fail
   - Write minimal code to pass
   - Refactor with confidence
   - See [Test Strategy](TEST_STRATEGY.md)

3. **Make atomic commits**:
   ```bash
   git commit -m "feat(component): add specific functionality"
   ```
   Use conventional commits: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Running the Project

```bash
# Development mode with hot-reload
cd frontend
npm run tauri dev

# Run tests
npm test

# Run specific test file
npm test -- src/lib/components/Terminal.test.ts

# Build for production
npm run tauri build
```

## Testing

### Test Requirements

- **Minimum coverage**: 85% for new code
- **Test categories**:
  - Unit tests (`.test.ts`)
  - Integration tests (`.integration.test.ts`)
  - Component tests (Svelte components)

### Running Tests

```bash
# Frontend tests
cd frontend
npm test

# Rust tests
cd frontend/src-tauri
cargo test

# Test with coverage
npm test -- --coverage
```

### Writing Tests

```typescript
// Example component test
import { render, fireEvent } from '@testing-library/svelte';
import Terminal from './Terminal.svelte';

describe('Terminal', () => {
  it('should handle input', async () => {
    const { getByRole } = render(Terminal);
    const input = getByRole('textbox');
    
    await fireEvent.type(input, 'ls -la');
    await fireEvent.keyDown(input, { key: 'Enter' });
    
    // Assert expected behavior
  });
});
```

## Coding Standards

### TypeScript/JavaScript

- Use TypeScript for all new code
- Follow ESLint configuration
- Prefer functional components
- Use proper types, avoid `any`

### Rust

- Follow Rust idioms and clippy suggestions
- Use `Result` for error handling
- Document public APIs
- Keep modules focused and small

### General

- Keep files under 500 lines
- One feature per commit
- Clear, descriptive variable names
- Comment complex logic only

## Documentation

### When to Document

- New features or APIs
- Architecture changes
- Complex algorithms
- Public interfaces

### Where to Document

- **API changes** → `docs/API.md`
- **Architecture** → `docs/architecture/`
- **Testing** → `docs/TEST_STRATEGY.md`
- **Roadmap items** → `DEVELOPMENT_ROADMAP.md`

### Documentation Style

- Keep it concise and clear
- Include code examples
- Update when implementation changes
- Use markdown formatting

## Submitting Changes

### Before Submitting

1. **Run all tests**: `npm test`
2. **Check types**: `npm run check`
3. **Lint code**: `npm run lint`
4. **Update documentation** if needed
5. **Ensure CI passes**

### Pull Request Process

1. **Create PR** with clear description
2. **Link related issues**
3. **Include test results**
4. **Add screenshots** for UI changes
5. **Request review** from maintainers

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests pass locally
- [ ] Added new tests
- [ ] Coverage maintained

## Related Issues
Fixes #123
```

## Need Help?

- Check existing [documentation](../docs/)
- Review [CLAUDE.md](../CLAUDE.md) for project rules
- Look at similar PRs for examples
- Ask in discussions or issues

Remember: Quality over quantity. We prefer well-tested, thoughtful contributions over rushed features.

---

Thank you for contributing to orchflow! Your efforts help make terminal-based development better for everyone.