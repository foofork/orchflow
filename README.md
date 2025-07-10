# orchflow

A terminal-based IDE that combines the editing capabilities of Neovim with intelligent, ai driven, terminal orchestration in a fast desktop application.

## Overview

orchflow solves a simple problem: developers need to manage multiple terminals and tools at once. Instead of juggling windows and manual coordination, orchflow handles the orchestration in one fast application.

The project focuses on three core principles:
- Performance: Sub-100ms startup, ~10MB base memory usage
- Terminal-first design: Built around terminal workflows, not adapted to them
- Intelligent orchestration: Tools that understand and coordinate with each other

## Current State

orchflow is in active development with core infrastructure complete:

- Terminal multiplexing through tmux integration
- File management with trash support and operation history
- State persistence through SQLite
- Plugin architecture with JavaScript/TypeScript support
- WebSocket-based communication between frontend and backend
- Real-time terminal streaming via Tauri IPC
- Major UI components built but still being tested

Current work: Writing comprehensive test coverage (627 tests at 84% pass rate) and fixing remaining UI issues. The project needs solid test coverage before adding advanced features like terminal intelligence.

## Technical Architecture

The application uses:
- **Backend**: Rust with Tauri for system operations and performance
- **Frontend**: SvelteKit for the user interface
- **Terminal Management**: tmux for session persistence and multiplexing
- **State Storage**: SQLite for configuration and session data

### Architectural Evolution

The project is evaluating ruv-FANN integration as an optional performance enhancement. This would allow direct neural network integration instead of IPC communication, potentially eliminating orchestrator overhead. The decision will be made based on terminal metadata system requirements and performance benchmarks.

## Development Approach

orchflow is being built with a focus on:

1. **Sustainable Performance**: Every feature must keep the app fast. No exceptions.

2. **Progressive Enhancement**: Start with terminals, add features as they make sense.

3. **Open Architecture**: Plugins can extend orchflow without touching core code.

## What's Coming

**Now**: Test coverage sprint - writing tests for all major components. Fixing UI issues discovered during testing. Making architectural decisions about AI integration approach.

**Next**: Terminal intelligence features including metadata tracking, command classification, and process monitoring. Considering ruv-FANN integration as a feature flag to replace IPC with direct neural integration for better performance.

**Later**: Full AI orchestration layer for intelligent terminal coordination. The architecture supports either traditional IPC or direct ruv-FANN integration, pending performance testing and architectural review.

## Project Philosophy

orchflow's philosophy is simple:

- **Tools should be fast**: Performance is not optional
- **Complexity should be hidden**: Powerful features with simple interfaces
- **Everything should persist**: Close the app, lose nothing
- **AI should assist, not completely replace**: Automation maximal, human in the loop
- **Open source benefits everyone**: Community-driven development

## Status for Users

orchflow is not ready for daily use. While core terminal and file management features work, the UI needs comprehensive testing and stabilization. We're currently at 84% test pass rate and working toward >90% coverage before considering it stable.

Developers interested in terminal multiplexing and early-stage software can explore, but expect breaking changes and incomplete features.

## The Vision

An AI-driven terminal orchestration platform. orchflow provides the infrastructure for AI agents to intelligently manage and coordinate multiple terminal sessions, making complex development workflows transparent and controllable.

The goal: enable AI systems to work alongside developers in a way that's visible, understandable, and powerful. Terminal management is the starting point - the real innovation is making AI-driven development workflows practical.

---

*This is pre-release software. APIs and features are subject to change as the project evolves toward its first stable release.*
