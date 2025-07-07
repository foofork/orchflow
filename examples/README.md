# orchflow Examples

This directory contains example projects and tutorials to help you learn orchflow development.

## Available Examples

### 1. [Basic Terminal](./basic-terminal/)
Learn how to use orchflow's Terminal Streaming API to create and manage terminal instances.

**What you'll learn:**
- Creating terminal instances
- Handling input/output streams
- Terminal lifecycle management
- Multi-terminal coordination

**Difficulty:** Beginner
**Estimated time:** 30 minutes

### 2. [Plugin Development](./plugin-development/)
Build a complete plugin from scratch, including both Rust backend and TypeScript frontend.

**What you'll learn:**
- Plugin architecture
- Rust trait implementation
- Frontend integration patterns
- State management
- Event handling

**Difficulty:** Intermediate
**Estimated time:** 2 hours

## Getting Started

1. **Prerequisites:**
   - Complete the [Developer Onboarding Guide](../docs/DEVELOPER_ONBOARDING.md)
   - Have orchflow running in development mode

2. **Running Examples:**
   ```bash
   cd orchflow/frontend
   npm run tauri dev
   ```

3. **Navigate to Examples:**
   - Basic Terminal: http://localhost:5173/terminal-demo
   - Plugin Development: Follow the plugin development guide

## Example Structure

Each example follows this structure:
```
example-name/
├── README.md           # Tutorial and explanation
├── rust/              # Rust backend code (if applicable)
├── frontend/          # Frontend code (if applicable)
└── docs/              # Additional documentation
```

## Contributing Examples

We welcome contributions of new examples! To add an example:

1. Create a new directory with a descriptive name
2. Include a comprehensive README.md with:
   - Clear learning objectives
   - Step-by-step instructions
   - Code explanations
   - Common troubleshooting
3. Test your example thoroughly
4. Submit a pull request

### Example Ideas

We'd love to see examples for:
- **Session Management**: Creating and managing workspaces
- **File Operations**: File browser and editor integration
- **Git Integration**: Version control workflows
- **Custom Themes**: UI customization
- **Advanced Plugins**: More complex plugin examples
- **Performance Optimization**: Best practices for performance
- **Testing**: How to test orchflow applications

## Getting Help

- **Documentation**: Check the [docs folder](../docs/)
- **Issues**: Create a GitHub issue
- **Discussions**: Join GitHub Discussions
- **Community**: Connect with other developers

## Example Difficulty Levels

- **Beginner**: Basic concepts, ready-to-run examples
- **Intermediate**: More complex features, some setup required
- **Advanced**: Complex integrations, assumes deep knowledge

## Quick Reference

### Common Commands

```bash
# Start development server
npm run tauri dev

# Run tests
cargo test

# Build for production
npm run tauri build

# Check types
npm run check

# Format code
cargo fmt && npm run format
```

### Useful Resources

- [Terminal Streaming API](../docs/TERMINAL_STREAMING_API.md)
- [Manager API](../docs/MANAGER_API.md)
- [Architecture Overview](../docs/DEVELOPER_ONBOARDING.md#architecture-overview)
- [Plugin System Guide](../docs/MANAGER_API.md#plugin-system)

Happy coding! 🌊