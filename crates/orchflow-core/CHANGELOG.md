# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of OrchFlow Core
- Manager orchestration engine with builder pattern
- State management system with persistent storage
- Plugin system with event-driven architecture
- Backend abstraction for terminal multiplexers
- Event system for real-time updates
- File management integration
- Command history tracking
- Search provider integration
- Comprehensive error handling with thiserror
- Async/await support throughout
- Full test coverage with mock implementations
- Enterprise-ready builder pattern
- Resource cleanup and proper error handling

### Changed
- Migrated from desktop application to modular crate structure
- Replaced .unwrap() calls with proper error handling
- Consolidated duplicate trait definitions
- Standardized import patterns using crate:: prefix
- Improved builder pattern to prevent service configuration after initialization

### Fixed
- Builder pattern now properly handles service configuration
- Removed potential panics from unwrap() calls
- Fixed duplicate MuxBackend trait definitions
- Corrected import consistency across modules
- Added proper Drop implementation for resource cleanup

## [0.1.0] - 2025-07-15

### Added
- Initial release with core orchestration functionality
- Transport-agnostic design for maximum flexibility
- Plugin architecture for extensibility
- Event-driven updates for reactive applications
- Comprehensive documentation and examples
- Performance benchmarks and optimization
- Integration patterns for enterprise use