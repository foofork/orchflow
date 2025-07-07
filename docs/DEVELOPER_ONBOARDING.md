# orchflow Developer Onboarding Guide

Welcome to orchflow! This guide will help you get started with developing for orchflow, a terminal-based IDE that combines Neovim's editing power with intelligent terminal orchestration.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Development Setup](#development-setup)
3. [Architecture Overview](#architecture-overview)
4. [Development Workflow](#development-workflow)
5. [Key Concepts](#key-concepts)
6. [Common Tasks](#common-tasks)
7. [Testing](#testing)
8. [Contributing](#contributing)

## Project Overview

orchflow is a modern terminal IDE built with:
- **Frontend**: SvelteKit + TypeScript + Tauri
- **Backend**: Rust
- **Terminal**: PTY management with IPC streaming
- **Plugins**: Extensible plugin system

### Project Structure

```
orchflow/
├── frontend/                 # SvelteKit frontend
│   ├── src/
│   │   ├── lib/            # Shared components and utilities
│   │   ├── routes/         # SvelteKit routes
│   │   └── app.html        # HTML template
│   └── src-tauri/          # Rust backend
│       ├── src/
│       │   ├── manager/    # Core orchestration
│       │   ├── plugins/    # Plugin implementations
│       │   ├── terminal_stream/ # Terminal streaming
│       │   └── main.rs     # Entry point
│       └── Cargo.toml      # Rust dependencies
├── docs/                   # Documentation
└── CLAUDE.md              # AI assistant instructions
```

## Development Setup

### Prerequisites

- **Node.js** 18+ and npm
- **Rust** 1.70+ (via rustup)
- **Git**
- **OS-specific requirements**:
  - macOS: Xcode Command Line Tools
  - Linux: `libgtk-3-dev`, `libwebkit2gtk-4.0-dev`, `libssl-dev`
  - Windows: Visual Studio Build Tools

### Initial Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/foofork/orchflow.git
   cd orchflow
   ```

2. **Install frontend dependencies**:
   ```bash
   cd frontend
   npm install
   ```

3. **Build the project**:
   ```bash
   npm run tauri dev
   ```

This will start the development server with hot-reload for both frontend and backend changes.

## Architecture Overview

### Core Components

1. **Manager** (`frontend/src-tauri/src/manager/`)
   - Central orchestration component
   - Handles sessions, panes, and plugins
   - Provides unified API for frontend

2. **Terminal Streaming** (`frontend/src-tauri/src/terminal_stream/`)
   - PTY (pseudo-terminal) management
   - Real-time output streaming via IPC
   - Input handling and terminal state

3. **Plugin System** (`frontend/src-tauri/src/plugins/`)
   - Extensible architecture
   - Built-in plugins: Terminal, File Browser, Search, Git, LSP
   - Plugin lifecycle management

4. **State Management**
   - Backend: SimpleStateStore (SQLite)
   - Frontend: Svelte stores with WebSocket sync

### Communication Flow

```
Frontend (SvelteKit)
    ↓ Tauri Commands (IPC)
Manager (Rust)
    ↓ Actions
Plugins / Terminal / State
    ↓ Events
WebSocket → Frontend Updates
```

## Development Workflow

### 1. Making Backend Changes

When modifying Rust code:

```bash
# Run in development mode
npm run tauri dev

# Run tests
cargo test

# Check for compilation errors
cargo check

# Format code
cargo fmt

# Run linter
cargo clippy
```

### 2. Making Frontend Changes

When modifying SvelteKit code:

```bash
# Development server (already running with tauri dev)
npm run dev

# Type checking
npm run check

# Linting
npm run lint

# Format code
npm run format
```

### 3. Adding a New Feature

1. **Plan the feature**:
   - Update `DEVELOPMENT_ROADMAP.md`
   - Create issues/tasks

2. **Implement backend**:
   - Add Rust types/structs
   - Implement Tauri commands
   - Add to Manager if needed

3. **Implement frontend**:
   - Create TypeScript types
   - Add API client methods
   - Build UI components

4. **Test thoroughly**:
   - Unit tests for logic
   - Integration tests for IPC
   - Manual testing

5. **Document**:
   - Update API docs
   - Add code comments
   - Update user docs if needed

## Key Concepts

### Sessions and Panes

- **Session**: A workspace containing multiple panes
- **Pane**: A terminal, editor, or plugin view
- **Layout**: Arrangement of panes (split, tabbed)

### Actions and Events

- **Action**: Command sent from frontend to backend
- **Event**: Notification from backend to frontend

Example Action:
```rust
Action::CreatePane {
    session_id: String,
    pane_type: PaneType,
    title: String,
}
```

Example Event:
```rust
Event::PaneCreated {
    pane: Pane,
}
```

### Terminal Streaming

Real-time terminal output using IPC:

1. Frontend creates terminal via IPC
2. Backend spawns PTY process
3. Output streamed as base64-encoded events
4. Frontend decodes and displays

### Plugin Development

Create a new plugin:

1. Implement the `Plugin` trait
2. Add to `PluginRegistry`
3. Handle actions and events
4. Emit appropriate events

## Common Tasks

### Adding a New Tauri Command

1. Define in Rust:
```rust
#[tauri::command]
pub async fn my_command(
    param: String,
    state: State<'_, Arc<Manager>>,
) -> Result<String, String> {
    // Implementation
    Ok("Success".to_string())
}
```

2. Register in `main.rs`:
```rust
.invoke_handler(tauri::generate_handler![
    my_command,
    // ... other commands
])
```

3. Call from frontend:
```typescript
import { invoke } from '@tauri-apps/api/tauri';

const result = await invoke('my_command', { param: 'value' });
```

### Adding a New Manager Action

1. Add to `Action` enum:
```rust
pub enum Action {
    // ... existing actions
    MyNewAction { param: String },
}
```

2. Handle in execution engine:
```rust
match action {
    Action::MyNewAction { param } => {
        // Handle action
    }
}
```

3. Add frontend method:
```typescript
async myNewAction(param: string) {
    return await this.execute({
        type: 'MyNewAction',
        params: { param }
    });
}
```

### Creating a UI Component

1. Create Svelte component:
```svelte
<!-- MyComponent.svelte -->
<script lang="ts">
  export let title: string;
  
  import { manager } from '$lib/stores/manager';
  
  async function handleClick() {
    await manager.someAction();
  }
</script>

<div class="my-component">
  <h2>{title}</h2>
  <button on:click={handleClick}>Action</button>
</div>

<style>
  .my-component {
    /* styles */
  }
</style>
```

2. Use in parent component:
```svelte
<script>
  import MyComponent from './MyComponent.svelte';
</script>

<MyComponent title="Hello" />
```

## Testing

### Unit Tests (Rust)

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_something() {
        assert_eq!(2 + 2, 4);
    }
    
    #[tokio::test]
    async fn test_async() {
        let result = async_function().await;
        assert!(result.is_ok());
    }
}
```

### Integration Tests

Place in `tests/` directory:
```rust
// tests/integration_test.rs
use orchflow::manager::Manager;

#[tokio::test]
async fn test_manager_operations() {
    // Test cross-module integration
}
```

### Frontend Tests

```typescript
// MyComponent.test.ts
import { render } from '@testing-library/svelte';
import MyComponent from './MyComponent.svelte';

test('renders title', () => {
  const { getByText } = render(MyComponent, {
    props: { title: 'Test' }
  });
  
  expect(getByText('Test')).toBeInTheDocument();
});
```

## Contributing

### Code Style

- **Rust**: Follow rustfmt defaults
- **TypeScript**: Follow Prettier config
- **Svelte**: Follow Prettier + ESLint rules

### Commit Messages

Follow conventional commits:
```
feat(terminal): add color support
fix(manager): resolve session leak
docs: update API documentation
refactor(plugins): extract common logic
test: add integration tests
```

### Pull Request Process

1. Fork the repository
2. Create feature branch: `git checkout -b feat/my-feature`
3. Make changes and test
4. Commit with clear messages
5. Push to your fork
6. Create pull request with description

### Development Tips

1. **Use the Todo System**: Track tasks with `TodoWrite`/`TodoRead`
2. **Read CLAUDE.md**: Understand project conventions
3. **Check Roadmap**: Align with project direction
4. **Test Early**: Write tests as you develop
5. **Document**: Update docs with API changes

## Getting Help

- **Documentation**: Check `docs/` folder
- **Issues**: Search/create GitHub issues
- **Discussions**: Join GitHub Discussions
- **Code**: Read existing implementations

## Next Steps

1. Set up your development environment
2. Run the project and explore
3. Pick a small issue to start
4. Read relevant documentation
5. Ask questions when stuck

Welcome to the orchflow community! 🌊