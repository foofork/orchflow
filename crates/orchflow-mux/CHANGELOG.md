# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of OrchFlow Mux
- MuxBackend trait abstraction for terminal multiplexers
- TmuxBackend implementation with full tmux support
- MockBackend for testing and development
- BackendFactory for automatic backend selection
- Comprehensive error handling with MuxError enum
- Session lifecycle management (create, list, attach, detach, kill)
- Pane operations (create, resize, select, split, kill)
- Terminal interaction (send keys, capture output)
- Environment-based backend configuration
- Async/await support throughout
- Extensive test coverage with integration tests
- Performance benchmarks comparing backends
- Command history tracking in mock backend
- Configurable fail modes for testing edge cases

### Changed
- Migrated from desktop application to modular crate structure
- Improved error handling with specific error types
- Enhanced mock backend with realistic behavior simulation
- Optimized tmux command execution and parsing
- Standardized async patterns across all backends

### Fixed
- Proper error propagation in all backend operations
- Resource cleanup in session and pane management
- Concurrent operation handling in tmux backend
- Mock backend state consistency
- Edge case handling in pane operations

## [0.1.0] - 2025-07-15

### Added
- Initial release with terminal multiplexer abstraction
- Full tmux integration with all major operations
- Mock backend for testing and development
- Factory pattern for backend selection
- Comprehensive error handling
- Performance benchmarks
- Integration with OrchFlow Core
- Extensive documentation and examples