# Orchflow Development Roadmap

## 📋 Roadmap Maintenance

**When to Update:**
- Task status changes
- New blockers emerge
- Priorities shift
- Features complete

**How to Update:**
1. Update "Current Development Focus" first
2. Move completed work to "Completed Phases"
3. Keep metrics current (performance, coverage)
4. Link relevant documentation
5. **FINISH THE JOB**: No task complete without passing tests

**TDD Requirement:**
- **MANDATORY**: Write tests FIRST, then code
- **Red → Green → Refactor**: Follow TDD cycle
- **>90% Coverage**: Maintain test coverage
- **See**: [Test Strategy Guide](docs/TEST_STRATEGY.md)

**Documentation Discipline:**
- **Roadmap Items** → HERE, not scattered in code comments
- **Architecture Decisions** → docs/architecture/UNIFIED_ARCHITECTURE.md
- **API Changes** → Relevant API docs
- **NO SPRAWL**: Don't document roadmap items in random files

## 🎉 Major Milestone: Phase 5 Complete!

### 🚨 CRITICAL: Test-Driven Development is MANDATORY

**FINISH THE JOB** - No feature is complete without:
1. **Tests Written FIRST** - TDD is not optional
2. **All Tests PASSING** - Red → Green → Refactor
3. **Coverage >90%** - Measure and maintain
4. **CI/CD Green** - No merging with failing tests

> **📖 See [Test Strategy Guide](docs/TEST_STRATEGY.md) for testing approach**
> **📖 See [Contributing Guide](docs/CONTRIBUTING.md) for TDD workflow**

### Executive Summary
Orchflow has successfully completed **all infrastructure and core implementation phases** (Phases 1-5), establishing a production-ready foundation with:

> **📖 For complete system architecture, see [Unified Architecture Design](docs/architecture/UNIFIED_ARCHITECTURE.md)**
> **📖 For component responsibilities, see [Component Architecture Guide](docs/COMPONENT_RESPONSIBILITIES.md)**
- ✅ **MuxBackend abstraction** - Clean separation of terminal multiplexer operations
- ✅ **Unified state management** - Single source of truth with StateManager
- ✅ **Comprehensive error handling** - 12 error categories with rich context
- ✅ **Enhanced terminal management** - Multi-shell support, command history, output search
- ✅ **Complete file management** - File operations, watching, project-wide search
- ✅ **Editor integration** - Monaco removed, CodeMirror + Neovim fully operational
- ✅ **Muxd backend** - High-performance multiplexer daemon with WebSocket transport
- ✅ **Plugin ecosystem** - Complete plugin system with production examples
- ✅ **System integration** - Terminal search, test parsers, event dispatch
- ✅ **Terminal streaming** - Real-time PTY output via Tauri IPC
- ✅ **Frontend migration** - Manager API replacing Orchestrator
- ✅ **Performance optimized** - <100ms startup, ~10MB memory

**Current Status**: Phase 7 Complete! Core UI implemented. Working on remaining features and polish.

## 📚 Essential Documentation for AI Agents

**Architecture Documentation:**
- [Unified Architecture](docs/architecture/UNIFIED_ARCHITECTURE.md) - Complete system architecture
- [PTY Architecture](docs/architecture/PTY_ARCHITECTURE.md) - Terminal implementation details
- [State Management Architecture](docs/architecture/STATE_MANAGEMENT_ARCHITECTURE.md) - Unified state system
- [Manager Pattern Architecture](docs/architecture/MANAGER_PATTERN_ARCHITECTURE.md) - Central orchestration
- [Manager/Orchestrator Architecture](docs/architecture/MANAGER_ORCHESTRATOR_ARCHITECTURE.md) - Component usage decisions
- [IPC Command Architecture](docs/architecture/IPC_COMMAND_ARCHITECTURE.md) - Frontend-backend communication
- [Plugin System Architecture](docs/architecture/PLUGIN_SYSTEM_ARCHITECTURE.md) - Extensibility framework
- [Plugin API](docs/api/PLUGIN_API.md) - Plugin API specification
- [Search Integration Architecture](docs/architecture/SEARCH_INTEGRATION_ARCHITECTURE.md) - Ripgrep integration
- [Muxd Protocol Architecture](docs/architecture/MUXD_PROTOCOL_ARCHITECTURE.md) - Multiplexer protocol

**APIs & Component Docs:**
- [Complete API Reference](docs/api/README.md) - All OrchFlow integration points
- [Manager API Documentation](docs/api/MANAGER_API.md) - Core Rust Manager API
- [Terminal Streaming API](docs/api/TERMINAL_STREAMING_API.md) - Real-time terminal integration
- [Component Architecture Guide](docs/COMPONENT_RESPONSIBILITIES.md) - Component boundaries and responsibilities

**Development & Enhancement:**
- [Contributing Guide](docs/CONTRIBUTING.md) - Development setup and process
- [Test Strategy Guide](docs/TEST_STRATEGY.md) - Professional testing approach
- [Performance Guide](docs/PERFORMANCE_GUIDE.md) - Optimization strategies
- [UI Implementation Plan](docs/PHASE_7_IMPLEMENTATION_PLAN.md) - Component roadmap
- [Terminal Enhancement Guide](docs/TERMINAL_MANAGER_ENHANCEMENTS.md) - AI-driven terminal features

## Completed Phases ✅

| Phase | Achievement | Key Metric |
|-------|-------------|------------|
| 1 | MuxBackend Abstraction | Sub-ms test performance |
| 2 | Unified State Management | <5ms operations |
| 3 | Error System + File Ops | 12 error categories |
| 4 | Muxd + Plugin System | Hot-reload support |
| 5 | System Integration | Complete test parsers |
| 6 | Terminal Streaming | Real-time PTY via IPC |
| 7 | Desktop UI Complete | All core components |

## Technical Debt 🔧

### High Priority
| Item | Status | Details |
|------|--------|---------|
| Fix 51 failing tests | 🚧 | xterm.js mocks, Tauri handles |
| Git Integration | ❌ | Complete panel UI, operations |
| Plugin System | ❌ | WASM/native loading |
| Frontend API | ⚠️ | StatusBar, CommandBar using old orchestrator |
| Component Enhancement | ❌ | Missing Dialog, ContextMenu features |

### Medium Priority
- Terminal scrollback search
- Search result syntax highlighting  
- Real file permissions (not hardcoded)

### Low Priority
- Remove legacy AppState
- Update architecture docs

## Current Development Focus 🚧

### ⚠️ TDD Requirements for Active Work
**EVERY feature below MUST follow TDD:**
1. Write failing tests FIRST
2. Implement minimal code to pass
3. Refactor with confidence
4. Document test scenarios

### 🎯 STRATEGIC PRIORITY: Complete the Rust Manager First

> **📖 See [Professional Roadmap](docs/PROFESSIONAL_ROADMAP.md) for long-term vision**

#### Phase 1: Complete Rust Terminal Manager (ACTIVE) ⚡ CRITICAL

**Research & Planning** (Week 0)
- [ ] Analyze all 51 failing tests to categorize issues
- [ ] Document terminal manager architecture gaps
- [ ] Create test plan for >90% coverage

**Test Suite Recovery** (Week 1) - BLOCKER
- [ ] Fix xterm.js canvas rendering mocks
- [ ] Fix Tauri app handle in unit tests
- [ ] Fix all remaining test failures
- [ ] Add integration tests for terminal operations
- [ ] **NO NEW FEATURES UNTIL ALL TESTS PASS**

**Complete Terminal Features** (Week 1-2)
- [ ] Process ID tracking from PTY (TODO in terminal_stream)
- [ ] Terminal scrollback search implementation
- [ ] Active terminal tracking
- [ ] Session ID retrieval for terminals
- [ ] Terminal state persistence
- [ ] Write tests for each feature FIRST

**Finish File Manager** (Week 2)
- [ ] Git ignore checking (TODO in file_manager/git.rs)
- [ ] Git status checking implementation
- [ ] Real file permissions retrieval (not hardcoded)
- [ ] Complete trash functionality
- [ ] Integration tests with git operations

**Complete Search/Replace** (Week 2-3)
- [ ] Implement replace_in_files functionality
- [ ] Add search history persistence
- [ ] Implement save/load search
- [ ] Add syntax highlighting to results
- [ ] Performance tests for large codebases

**Module System Completion** (Week 3)
- [ ] WASM plugin loading
- [ ] Native plugin loading
- [ ] Config validation against schema
- [ ] Module registry integration
- [ ] Security tests for plugin sandboxing

#### Phase 2: Terminal Intelligence & Production (Weeks 4-6)

**Terminal Metadata System** (Week 4-5)
- [ ] Research terminal classification patterns
- [ ] Terminal type classification (Build, Test, REPL, Debug, Agent)
- [ ] Purpose-driven terminal management
- [ ] Context tracking per terminal
- [ ] Process lifecycle monitoring
- [ ] Error pattern detection
- [ ] Write comprehensive tests

**Production Hardening** (Week 6)
- [ ] Performance profiling and optimization
- [ ] Memory leak detection and fixes
- [ ] OpenTelemetry integration
- [ ] Auto-updater setup
- [ ] Release pipeline
- [ ] Code signing
- [ ] Load testing with 100+ terminals

#### Phase 3: Orchestrator Layer (Weeks 7-9)

**Research & Design** (Week 7)
- [ ] Study existing orchestrator patterns
- [ ] Design Manager ↔ Orchestrator protocol
- [ ] Plan TypeScript project structure
- [ ] Define agent lifecycle management

**Orchestrator Implementation** (Week 8-9)
- [ ] Create TypeScript orchestrator project
- [ ] Implement JSON-RPC 2.0 protocol
- [ ] WebSocket connection to Manager
- [ ] Basic agent framework
- [ ] Command adapter system
- [ ] Mock AI provider for testing
- [ ] Integration tests with Manager

#### Phase 4: AI Integration (Weeks 10-11)

**AI Components** (Week 10)
- [ ] AI Chat UI component
- [ ] Intent detection system
- [ ] Command routing logic
- [ ] Agent spawning interface
- [ ] Swarm monitoring view

**Integration & Testing** (Week 11)
- [ ] Connect to real AI providers
- [ ] End-to-end swarm tests
- [ ] Performance optimization
- [ ] Error handling for AI failures

#### Phase 5: Web Platform (Weeks 12+)

**Service Abstraction Layer** (Week 12)
- [ ] Research web terminal solutions
- [ ] Define service interfaces
- [ ] Platform detection logic
- [ ] Service factory pattern
- [ ] Mock web services for testing

**Web Implementation** (Week 13+)
- [ ] Web terminal service
- [ ] Container orchestration
- [ ] Multi-tenancy support
- [ ] Security hardening
- [ ] Load testing

### Active Feature Work (BLOCKED until Phase 1 complete)
- **Git Integration Panel**: Branch management, diff viewer, commit interface
  - [ ] Write component tests for GitPanel
  - [ ] Write integration tests for git operations
  - [ ] Implement features to pass tests
- **Notification System**: Toast notifications, progress indicators
  - [ ] Write tests for notification queue
  - [ ] Write tests for toast animations
  - [ ] Implement notification system
- **Workspace Manager**: Session persistence and switching
  - [ ] Write tests for session serialization
  - [ ] Write tests for workspace switching
  - [ ] Implement workspace features
- **Plugin Manager UI**: Installation and configuration interface
  - [ ] Write tests for plugin installation flow
  - [ ] Write tests for configuration UI
  - [ ] Implement plugin manager

### Recently Completed (Phase 7)
- ✅ **Command Palette**: Fuzzy search with frecency scoring
- ✅ **File Explorer**: Tree view with Git status, context menus
- ✅ **Terminal Panel**: Multiple terminals with streaming
- ✅ **Status Bar**: File info, Git status, system metrics
- ✅ **Quick Switcher**: MRU files with fuzzy search
- ✅ **Search & Replace**: Project-wide with regex support

## Future Enhancements 📅

> **Important**: For architecture decisions on Manager vs Orchestrator usage, see [Manager/Orchestrator Architecture](docs/architecture/MANAGER_ORCHESTRATOR_ARCHITECTURE.md)

### Near-term (Month 2)
1. **Advanced Muxd Features**
   - [ ] Resource limits per pane
   - [ ] Enhanced event streaming
   - [ ] Security policies
   - [ ] Performance metrics

2. **Additional Plugins**
   - [ ] Debugger plugin (DAP protocol)
   - [ ] Database client plugin
   - [ ] API testing plugin
   - [ ] Cloud provider plugins (AWS, GCP, Azure)

### Long-term (Month 3+)
1. **Collaboration Features**
   - [ ] Session sharing
   - [ ] Real-time collaboration
   - [ ] Presence indicators
   - [ ] Shared terminals

2. **Enterprise Features**
   - [ ] SSO integration
   - [ ] Audit logging
   - [ ] Compliance tools
   - [ ] Team management

## Success Metrics 📊

### Performance ✅
- **Startup time**: <100ms ✅ (achieved ~40-85ms, down from ~150ms)
- **Command latency**: <10ms for all operations
- **Memory usage**: <100MB base footprint ✅ (achieved ~10MB base)
- **Binary size**: <50MB distributable
- **Terminal operation latency**: <5ms perceived
- **File operation response**: <10ms for common operations

> **📖 See [Performance Guide](docs/PERFORMANCE_GUIDE.md) for optimization strategies**

### Quality
- **Test coverage**: >90% across all modules (currently 51 failing / 139 total)
- **Type safety**: 100% typed error handling ✅
- **Documentation**: 100% API coverage
- **Zero critical bugs** in production
- **Code review**: 100% PR review before merge
- **CI/CD**: All tests pass before merge

### Technical Excellence
- **Architecture**: Clean abstractions, no circular dependencies
- **API Design**: Consistent, intuitive, well-documented
- **Error Handling**: User-friendly messages, graceful degradation
- **Code Sharing**: 90% code reuse between platforms (future)
- **Plugin System**: Secure, performant, easy to develop

### User Experience
- **Time to first action**: <5 seconds from launch
- **AI response time**: <2 seconds (future)
- **UI responsiveness**: <50ms for all interactions
- **Error recovery**: Automatic where possible, clear guidance otherwise
- **Accessibility**: WCAG 2.1 AA compliance

### Adoption
- **Plugin ecosystem**: 10+ community plugins
- **User satisfaction**: >90% positive feedback
- **Developer onboarding**: <30 minutes to first contribution
- **Active community**: Regular contributions
- **Documentation quality**: Clear, comprehensive, up-to-date


## Technical Achievements 🏆
- MuxBackend abstraction, unified state, plugin system
- <100ms startup, efficient file watching, ripgrep search
- Strong typing, comprehensive docs, example plugins

## Next Actions 🚀

> **📖 For AI-driven terminal enhancements, see [Terminal Enhancement Guide](docs/TERMINAL_MANAGER_ENHANCEMENTS.md)**

### Week 0: Research & Planning ⚡ CRITICAL
1. **Analyze failing tests**: Categorize 51 failures by root cause
2. **Document gaps**: Terminal manager architecture issues
3. **Create test plan**: Path to >90% coverage

### Week 1: Fix Tests FIRST
1. **NO NEW FEATURES** until all 51 tests pass
2. **Mock fixes**: xterm.js, Tauri app handles
3. **Integration tests**: Terminal operations coverage

### Weeks 2-3: Complete Rust Terminal Manager
1. **Terminal**: PTY tracking, scrollback, state persistence
2. **File Manager**: Git integration, permissions, trash
3. **Search**: Replace, history, syntax highlighting
4. **Modules**: WASM/native loading, validation

### Weeks 4-6: Production Ready
1. **Terminal Intelligence**: Metadata, lifecycle, error patterns
2. **Hardening**: Profiling, leak detection, telemetry
3. **Distribution**: Auto-updater, signing, release pipeline

### Weeks 7-9: Orchestrator Layer
1. **Research**: Orchestration patterns, protocol design
2. **Implementation**: TypeScript project, JSON-RPC, agents
3. **Testing**: Manager integration, mock AI providers

### Weeks 10-11: AI Integration
1. **UI Components**: Chat, swarm monitor, agent views
2. **Integration**: Real AI providers, error handling

### Weeks 12+: Web Platform
1. **Abstraction**: Service interfaces, platform detection
2. **Implementation**: Web terminals, containers, multi-tenancy

## What's Next
Focus: Fix 51 failing tests → Complete TODOs → Polish features

## Component Analysis & Priorities 📊

Based on the comprehensive component analysis, professional testing implementation, and TODO analysis, the remaining high-priority items are:

### Testing & Quality (Week 1-2) 🚨 CRITICAL PRIORITY
1. **Test Coverage**: Current status 51 failing / 139 total tests
   - **FINISH THE JOB**: Fix ALL failing tests before new features
   - Fix remaining xterm.js canvas rendering issues
   - Improve mock strategies for complex components
   - Target >90% test coverage across all components
   - **NO NEW FEATURES UNTIL TESTS PASS**

2. **Component Enhancement**: Missing functionality identified
   - **Dialog**: Advanced modal types, form validation, stacking support
   - **ContextMenu**: Submenu support, icon display, keyboard shortcuts
   - **SearchReplace**: Advanced regex builder, search scopes, batch operations
   - **StatusBarEnhanced**: Clickable actions, customizable segments, plugin integration

### Advanced Features (Week 3-4)
1. **Git Integration Panel**: Complete UI for git operations
2. **Notification System**: Toast notifications with action buttons
3. **Workspace Manager**: Session templates and project switching
4. **Plugin System**: WASM/native loading completion

### Performance & Polish (Week 5-6)
1. **Performance Optimization**: Virtual scrolling, lazy loading, debouncing
2. **Accessibility Audit**: WCAG compliance, keyboard navigation, screen reader support
3. **Documentation**: Component API docs, usage examples, migration guides
4. **E2E Testing**: User workflow testing, cross-platform validation

## Outstanding TODO Items 📋

### Summary Statistics
- **Total TODOs**: 51 items across codebase
- **Rust Backend**: 43 items (84%)
- **TypeScript/Svelte Frontend**: 8 items (16%)

### High Priority TODOs (13 items)

#### 1. File Manager UI Operations (4 TODOs)
**Location**: `src/lib/components/FileExplorerEnhanced.svelte`
- Line 169: Implement new file dialog
- Line 174: Implement new folder dialog  
- Line 185: Implement rename functionality
- Line 191: Implement delete functionality

**Impact**: Core file management features are non-functional in the UI

#### 2. Search Functionality (5 TODOs)
**Location**: `src-tauri/src/search_commands.rs`
- Line 90: Implement replace_in_files functionality
- Line 107: Implement search history functionality
- Line 125: Implement save_search functionality
- Line 142: Implement load_search functionality
- Line 207: Implement syntax highlighting for search results

**Impact**: Search and replace features are incomplete

#### 3. Module System (4 TODOs)
**Location**: `src-tauri/src/module_commands.rs`
- Line 181: Validate config against module.manifest.config_schema
- Line 221: Implement module registry search
- Line 232: Implement fetching module details from registry
- Line 255: Implement module template generation

**Impact**: Module marketplace and development features are missing

### Medium Priority TODOs (18 items)

#### 4. Terminal Features (6 TODOs)
- Terminal active tracking
- Process ID tracking from PTY
- Scrollback search implementation
- Session ID retrieval for terminals

#### 5. AI Terminal Enhancements (NEW - from Terminal Manager Enhancements)
**Priority 1: Core Terminal Intelligence (Week 1-2)**
- Terminal type system with AI agent metadata
- Configurable shell execution with .orchflow.json support
- AI-aware command routing for swarm coordination

**Priority 2: Enhanced Process Management (Week 2-3)**
- Process lifecycle tracking and monitoring
- Automatic error detection and recovery
- Resource usage monitoring

**Priority 3: Intelligent Orchestration (Week 3-4)**
- Multi-language REPL management
- Workspace environment variables
- Terminal state persistence and recovery

**Priority 4: Command Intelligence (Week 4-5)**
- Command history with AI integration
- Natural language command translation
- Error recovery suggestions

**Priority 5: Advanced Features (Week 5-6)**
- Terminal output search and filtering
- Multi-terminal synchronization
- Performance optimization

#### 6. File Manager Backend (5 TODOs)
- Git ignore checking
- Git status checking
- File permissions retrieval
- Trash functionality (move to trash instead of permanent delete)

#### 7. Plugin System (7 TODOs)
- WASM plugin loading
- Native plugin loading
- Activation event checking
- LSP request forwarding
- Syntax folding ranges

### Low Priority TODOs (5 items)

#### 8. UI Polish (3 TODOs)
- Error toast notifications in CommandBar
- Error notifications in PluginCommandPalette
- Pane info action in orchestrator store

#### 9. Testing & Migration (2 TODOs)
- Complete migration to SimpleStateStore API
- Fix tests after error system updates

### TODO Implementation Plan

#### Phase 1: Core File Operations (Week 1)
1. Implement file/folder creation dialogs
2. Add rename functionality with inline editing
3. Add delete confirmation dialog
4. Integrate with backend file_commands

#### Phase 2: Search Enhancement (Week 2)
1. Implement replace functionality
2. Add search history persistence
3. Create saved searches feature
4. Add syntax highlighting to results

#### Phase 3: Module System Completion (Week 3-4)
1. Add config validation
2. Create module registry client
3. Implement module templates
4. Add module development tools

#### Phase 4: Terminal Improvements (Week 5-6)
1. Track active terminal
2. Add process monitoring
3. Implement scrollback search
4. Improve session management

---

*Last Updated: January 2025*
*This roadmap consolidates all previous development roadmaps and implementation plans into a single source of truth.*