# orchflow

A terminal-based IDE that combines the editing capabilities of Neovim with intelligent terminal orchestration in a fast desktop application.

## Overview

orchflow solves a simple problem: developers need to manage multiple terminals and tools at once. Instead of juggling windows and manual coordination, orchflow handles the orchestration in one fast application.

The project focuses on three core principles:
- Performance: Sub-100ms startup, ~10MB base memory usage
- Terminal-first design: Built around terminal workflows, not adapted to them
- Intelligent orchestration: Tools that understand and coordinate with each other

## Current State

orchflow is in active development. Core features working today include:

- Terminal multiplexing through tmux integration
- File management with trash support and operation history
- State persistence through SQLite
- Plugin architecture with JavaScript/TypeScript support
- WebSocket-based communication between frontend and backend

Current work: building the UI to make these features usable.

## Technical Architecture

The application uses:
- **Backend**: Rust with Tauri for system operations and performance
- **Frontend**: SvelteKit for the user interface
- **Terminal Management**: tmux for session persistence and multiplexing
- **State Storage**: SQLite for configuration and session data
- **Communication**: Type-safe IPC between frontend and backend

## Development Approach

orchflow is being built with a focus on:

1. **Sustainable Performance**: Every feature must keep the app fast. No exceptions.

2. **Progressive Enhancement**: Start with terminals, add features as they make sense.

3. **Open Architecture**: Plugins can extend orchflow without touching core code.

## What's Coming

**Now**: Polishing the UI - terminal panels, file browser, command palette.

**Next**: Git integration, plugins, workspaces.

**Later**: The flexible architecture could support AI features, web deployment, and more. We'll see where it goes.

## Project Philosophy

orchflow's philosophy is simple:

- **Tools should be fast**: Performance is not optional
- **Complexity should be hidden**: Powerful features with simple interfaces
- **Everything should persist**: Close the app, lose nothing
- **AI should assist, not replace**: Automation for repetitive tasks
- **Open source benefits everyone**: Community-driven development

## Status for Users

While the core is working, orchflow is not yet ready for general use. The project is in pre-release development with active work on the user interface. Developers comfortable with early-stage software are welcome to explore and contribute.

## The Vision

An AI-driven terminal orchestration platform. orchflow provides the infrastructure for AI agents to intelligently manage and coordinate multiple terminal sessions, making complex development workflows transparent and controllable.

The goal: enable AI systems to work alongside developers in a way that's visible, understandable, and powerful. Terminal management is the starting point - the real innovation is making AI-driven development workflows practical.

---

*This is pre-release software. APIs and features are subject to change as the project evolves toward its first stable release.*