# Contributing to OrchFlow

Thank you for your interest in contributing to OrchFlow! This guide will help you get started with contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Coding Standards](#coding-standards)
- [Documentation](#documentation)
- [Community](#community)

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md) to ensure a welcoming environment for all contributors.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Set up development environment** (see below)
4. **Create a branch** for your changes
5. **Make your changes** with tests
6. **Submit a pull request**

## Development Setup

### Prerequisites

- **Node.js** 18+ and npm
- **Rust** 1.70+ and Cargo
- **Tauri CLI** (`cargo install tauri-cli`)
- **tmux** 3.2+ (for terminal orchestration)
- **Neovim** 0.8+ (for editor integration)
- **Git** for version control

### Initial Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/orchflow.git
cd orchflow

# Add upstream remote
git remote add upstream https://github.com/orchflow/orchflow.git

# Install dependencies
cd frontend
npm install

# Install Rust dependencies
cd src-tauri
cargo build

# Install orchestrator dependencies
cd ../../orchestrator
npm install

# Run initial tests
npm test
```

### Development Mode

```bash
# Terminal 1: Start the orchestrator
cd orchestrator
npm run dev

# Terminal 2: Start Tauri dev server
cd frontend
npm run tauri dev
```

## Project Structure

```
orchflow/
├── frontend/              # Tauri + SvelteKit frontend
│   ├── src/              # Svelte components and routes
│   ├── src-tauri/        # Rust backend code
│   └── static/           # Static assets
├── orchestrator/         # TypeScript orchestrator service
│   ├── src/             # Source code
│   └── tests/           # Test files
├── modules/             # Plugin modules
├── docs/                # Documentation
└── scripts/             # Build and utility scripts
```

### Key Components

- **Frontend** - User interface built with SvelteKit
- **Tauri Backend** - Native app shell and system integration
- **Orchestrator** - Coordinates terminals, editors, and agents
- **Modules** - Plugin system for extensibility

## Making Changes

### Branch Naming

Use descriptive branch names:
- `feature/add-syntax-highlighting`
- `fix/terminal-resize-issue`
- `docs/update-api-reference`
- `refactor/optimize-startup-time`

### Commit Messages

Follow conventional commits:

```
type(scope): subject

body

footer
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Build/tooling changes

Examples:
```
feat(terminal): add split pane functionality

fix(editor): resolve cursor position bug in Neovim integration

docs(api): update WebSocket event documentation
```

### Code Changes Checklist

- [ ] Code follows project style guide
- [ ] Tests added/updated for changes
- [ ] Documentation updated if needed
- [ ] No console.log or debug code
- [ ] Passes all linting checks
- [ ] Builds successfully
- [ ] Manual testing completed

## Testing

### Running Tests

```bash
# Frontend tests
cd frontend
npm test

# Rust tests
cd frontend/src-tauri
cargo test

# Orchestrator tests
cd orchestrator
npm test

# Module tests
cd modules/my-module
npm test

# Full test suite
./scripts/test-all.sh
```

### Writing Tests

#### TypeScript/JavaScript Tests (Vitest)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { myFunction } from './my-module';

describe('myFunction', () => {
  it('should return expected value', () => {
    const result = myFunction('input');
    expect(result).toBe('expected output');
  });
});
```

#### Rust Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_function() {
        let result = my_function("input");
        assert_eq!(result, "expected output");
    }
}
```

### Integration Tests

```bash
# Run integration tests
cd tests/integration
npm test
```

## Submitting Changes

### Pull Request Process

1. **Update your fork**
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature
   ```

3. **Make changes and commit**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

4. **Push to your fork**
   ```bash
   git push origin feature/your-feature
   ```

5. **Create Pull Request**
   - Go to GitHub and create PR from your fork
   - Fill out the PR template
   - Link any related issues

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
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes
```

## Coding Standards

### TypeScript/JavaScript

- Use TypeScript for new code
- Follow ESLint configuration
- Use meaningful variable names
- Add JSDoc comments for public APIs

```typescript
/**
 * Creates a new terminal pane
 * @param config - Terminal configuration
 * @returns Terminal pane ID
 */
export async function createTerminal(config: TerminalConfig): Promise<string> {
  // Implementation
}
```

### Rust

- Follow Rust conventions
- Use `clippy` for linting
- Document public APIs
- Handle errors properly

```rust
/// Creates a new terminal session
/// 
/// # Arguments
/// * `name` - Session name
/// 
/// # Returns
/// * `Result<String>` - Session ID or error
pub fn create_session(name: &str) -> Result<String, Error> {
    // Implementation
}
```

### Svelte

- Use TypeScript in components
- Follow component structure
- Keep components focused
- Use stores for state management

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  
  export let title: string;
  
  onMount(() => {
    // Initialization
  });
</script>

<div class="component">
  <h1>{title}</h1>
</div>

<style>
  .component {
    /* Styles */
  }
</style>
```

## Documentation

### Code Documentation

- Document all public APIs
- Add inline comments for complex logic
- Update README files
- Include examples

### API Documentation

When adding/changing APIs:
1. Update `docs/API.md`
2. Add TypeScript types
3. Include usage examples
4. Document errors

### Module Documentation

For new modules:
1. Create `README.md` in module directory
2. Document configuration options
3. Provide usage examples
4. List available commands

## Community

### Getting Help

- **Discord**: [discord.gg/orchflow](https://discord.gg/orchflow)
- **GitHub Discussions**: For questions and ideas
- **Issues**: For bugs and feature requests

### Code Reviews

- Be respectful and constructive
- Provide specific feedback
- Suggest improvements
- Approve when satisfied

### Recognition

Contributors are recognized in:
- [CONTRIBUTORS.md](CONTRIBUTORS.md)
- Release notes
- Project README

## Development Tips

### Performance

- Profile before optimizing
- Use React DevTools Profiler
- Monitor bundle size
- Test on slower machines

### Debugging

```bash
# Enable debug logging
RUST_LOG=debug npm run tauri dev

# Use Chrome DevTools
# Right-click in app → Inspect Element

# Debug Rust code
RUST_BACKTRACE=1 cargo run
```

### Common Issues

1. **Build fails**: Check Node/Rust versions
2. **Tests fail**: Run `npm install` in all directories
3. **tmux errors**: Ensure tmux 3.2+ is installed
4. **Module not loading**: Check manifest.json syntax

## Release Process

Maintainers follow this process:

1. Update version numbers
2. Update CHANGELOG.md
3. Create release PR
4. Run full test suite
5. Build release binaries
6. Create GitHub release
7. Publish to package registries

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (see LICENSE file).

## Thank You!

Your contributions make OrchFlow better for everyone. We appreciate your time and effort! 🎉