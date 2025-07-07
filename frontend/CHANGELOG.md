# Changelog

All notable changes to OrchFlow will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of OrchFlow v0.1.0
- Core shell with window persistence and theme switching
- Tab strip with drag-and-drop reordering
- File tree sidebar with unlimited nesting
- Live metrics dashboard with 2-second polling
- Command palette with fuzzy search (sub-10ms)
- Inline AI assistant with streaming diff support
- Git panel with staged/unstaged file management
- Tree-sitter symbol outline (Ctrl+Shift+O)
- Settings modal with comprehensive configuration
- Auto-updater with signature verification
- Platform-specific installers (.dmg, .exe, .AppImage)

### Infrastructure
- Comprehensive E2E test suite with Cypress
- Performance benchmarking with Lighthouse
- CI/CD pipeline with GitHub Actions
- Code signing for all platforms
- Automated release process

### Documentation
- Complete API reference guide
- Development environment setup guide
- Contribution guidelines
- Security policy
- Deployment guide

## [0.1.0] - 2024-XX-XX (Upcoming)

### 🎉 Initial Release

#### Core Features
- **Terminal Orchestration**: Intelligent tmux integration for seamless workflow management
- **Neovim Integration**: Full Neovim RPC support with native performance
- **Modern UI**: VS Code-style interface with activity bar and command palette
- **File Management**: Tree view with drag-drop support and quick actions
- **Git Integration**: Built-in Git panel for version control
- **AI Assistant**: Integrated AI helper with code understanding
- **Live Metrics**: Real-time CPU, memory, and disk monitoring
- **Theme Support**: Dark/light themes with system preference detection
- **Auto Updates**: Seamless background updates with rollback support

#### Platform Support
- macOS (Intel & Apple Silicon)
- Windows 10/11
- Linux (Ubuntu 18.04+, Fedora, Arch)

#### Developer Experience
- Keyboard-first navigation
- Extensive customization options
- Extension system (preview)
- Performance-focused architecture

#### Security
- Signed installers for all platforms
- Sandboxed execution environment
- Encrypted credential storage

### Known Issues
- Terminal colors may not match system theme on first launch
- File watcher may miss rapid changes in large directories
- Some keyboard shortcuts conflict with system shortcuts on Linux

### Breaking Changes
- N/A (Initial release)

---

## Version History Format

### [Version] - YYYY-MM-DD

#### Added
- New features

#### Changed
- Changes in existing functionality

#### Deprecated
- Soon-to-be removed features

#### Removed
- Removed features

#### Fixed
- Bug fixes

#### Security
- Security vulnerability fixes

---

## Upcoming Releases

### [0.2.0] - Planned Features
- [ ] Remote development support
- [ ] Collaborative editing
- [ ] Plugin marketplace
- [ ] Advanced debugging tools
- [ ] Integrated task runner
- [ ] Custom workspace layouts
- [ ] Language server protocol support

### [0.3.0] - Future Considerations
- [ ] Web-based version
- [ ] Mobile companion app
- [ ] Cloud synchronization
- [ ] Team features
- [ ] Advanced AI integrations

---

## Release Notes Guidelines

When preparing release notes:

1. **User-Facing Changes First**: Prioritize features users will notice
2. **Include Screenshots**: For UI changes
3. **Migration Steps**: If breaking changes
4. **Credit Contributors**: Thank community members
5. **Security Fixes**: List CVE numbers if applicable

Example format:
```markdown
## [0.1.1] - 2024-XX-XX

### Highlights
- 🚀 50% faster startup time
- 🎨 New icon themes
- 🐛 Fixed critical memory leak

### Added
- Custom keybinding editor (#123) - Thanks @contributor
- Zen mode for distraction-free coding
...
```

---

[Unreleased]: https://github.com/orchflow/orchflow/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/orchflow/orchflow/releases/tag/v0.1.0