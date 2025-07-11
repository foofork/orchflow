claude-flow swarm "investigate and ensure our exports and module tests are fullfilled" --strategy development --parallel --claude

# Claude Flow Command Guide for Orchflow Development

This guide documents the most effective Claude Flow command workflows for developing the Orchflow terminal-based IDE project.

## 🚀 Quick Start

### Initial Setup (One-time)
```bash
# Initialize Claude Flow with SPARC methodology
claude-flow init --sparc

# Set up Hive Mind for intelligent coordination
claude-flow hive-mind wizard
```

## 📋 Common Development Workflows

### 1. Feature Development (TDD Approach)

**One-shot for simple features:**
```bash
# Use SPARC TDD mode for test-driven development
claude-flow sparc tdd "implement vim keybindings for terminal"
```

**Multi-command for complex features:**
```bash
# Step 1: Research and architecture
claude-flow swarm "research terminal vim mode implementations" --strategy research --max-agents 3

# Step 2: Design with architecture mode
claude-flow sparc architect "design vim mode architecture for terminal component"

# Step 3: Implement with TDD
claude-flow sparc tdd "implement vim mode with tests" --monitor

# Step 4: Store learnings
claude-flow memory store vim-implementation "completed vim mode with normal, insert, visual modes"
```

### 2. Rust Manager Development

**One-shot for manager commands:**
```bash
# Implement new manager functionality
claude-flow sparc code "add workspace management to Rust manager"
```

**Multi-command for complex manager features:**
```bash
# Step 1: Analyze existing code
claude-flow swarm "analyze Rust manager architecture in src-tauri" --strategy analysis

# Step 2: Design new feature
claude-flow sparc architect "design workspace persistence for manager"

# Step 3: Implement with testing
claude-flow sparc tdd "implement workspace save/load commands"

# Step 4: Integration testing
claude-flow swarm "test manager workspace integration" --strategy testing --parallel
```

### 3. UI Component Development (Svelte)

**One-shot for simple components:**
```bash
# Create new UI component
claude-flow sparc ui "create ActivityIndicator component with tests"
```

**Multi-command for complex UI features:**
```bash
# Step 1: Research UI patterns
claude-flow swarm "research terminal UI accessibility patterns" --strategy research

# Step 2: Design component architecture
claude-flow sparc architect "design accessible terminal panel system"

# Step 3: Implement components
claude-flow hive-mind spawn "build accessible terminal panel with keyboard navigation"

# Step 4: Add comprehensive tests
claude-flow swarm "add integration tests for terminal panels" --strategy testing --max-agents 4
```

### 4. Bug Fixing and Debugging

**One-shot for simple bugs:**
```bash
# Debug specific issue
claude-flow sparc debug "fix terminal resize handling in streaming mode"
```

**Multi-command for complex debugging:**
```bash
# Step 1: Reproduce and analyze
claude-flow swarm "reproduce terminal streaming performance issue" --strategy analysis

# Step 2: Debug with monitoring
claude-flow sparc debug "trace terminal stream memory leak" --monitor

# Step 3: Fix and verify
claude-flow sparc refactor "optimize terminal buffer management"

# Step 4: Add regression tests
claude-flow sparc tdd "add performance regression tests for terminal"
```

### 5. API Development

**One-shot for simple endpoints:**
```bash
# Add new API endpoint
claude-flow sparc api "add file search API endpoint to manager"
```

**Multi-command for comprehensive API work:**
```bash
# Step 1: Design API
claude-flow sparc architect "design unified manager API for desktop app"

# Step 2: Implement with swarm
claude-flow hive-mind spawn "implement complete manager API with OpenAPI spec"

# Step 3: Add tests
claude-flow swarm "create API integration test suite" --strategy testing --parallel

# Step 4: Document
claude-flow sparc docs "generate API documentation from OpenAPI spec"
```

### 6. Performance Optimization

**One-shot for targeted optimization:**
```bash
# Optimize specific component
claude-flow sparc refactor "optimize file tree rendering performance"
```

**Multi-command for comprehensive optimization:**
```bash
# Step 1: Profile and analyze
claude-flow swarm "profile desktop app performance bottlenecks" --strategy analysis --max-agents 5

# Step 2: Create optimization plan
claude-flow memory store perf-analysis "identified bottlenecks in terminal rendering and file operations"

# Step 3: Implement optimizations
claude-flow hive-mind spawn "optimize critical performance paths"

# Step 4: Verify improvements
claude-flow swarm "benchmark performance improvements" --strategy testing
```

### 7. Documentation Updates

**One-shot for simple docs:**
```bash
# Update specific documentation
claude-flow sparc docs "update manager API documentation"
```

**Multi-command for comprehensive docs:**
```bash
# Step 1: Analyze documentation gaps
claude-flow swarm "analyze documentation coverage" --strategy analysis

# Step 2: Generate missing docs
claude-flow hive-mind spawn "create comprehensive component documentation"

# Step 3: Update architecture docs
claude-flow sparc docs "update unified architecture documentation"
```

### 8. GitHub Workflow Automation

**Pull Request Management:**
```bash
# Create feature PR with tests
claude-flow github pr-manager "create PR for vim mode feature"

# Review and enhance existing PR
claude-flow github pr-manager "enhance PR #123 with tests and docs"
```

**Release Management:**
```bash
# Prepare release
claude-flow github release-manager "prepare v0.2.0 release with changelog"

# Coordinate release across packages
claude-flow github sync-coordinator "sync versions for desktop and manager"
```

## 🔄 Advanced Workflows

### Complete Feature Development Cycle

```bash
# 1. Initialize hive mind for feature
claude-flow hive-mind spawn "implement complete search and replace feature"

# 2. Set up lifecycle hooks for tracking
claude-flow hooks pre-task --description "search-replace feature" --task-id sr-001

# 3. Execute with monitoring
claude-flow swarm "build search-replace with preview" --monitor --ui --parallel

# 4. Track completion
claude-flow hooks post-task --task-id sr-001 --analyze-performance

# 5. Store learnings
claude-flow memory store search-replace-patterns "implementation patterns and decisions"

# 6. Export session insights
claude-flow hooks session-end --export-metrics --generate-summary
```

### Continuous Learning Workflow

```bash
# After successful implementation
claude-flow training pattern-learn --operation "component-creation" --outcome "success"

# Train models on recent operations
claude-flow training neural-train --data recent --model task-predictor

# Update agent models
claude-flow training model-update --agent-type coder --operation-result "efficient"
```

## 💡 Pro Tips

### 1. Use Memory for Context
```bash
# Store project-specific patterns
claude-flow memory store orchflow-conventions "use manager pattern, TDD, comprehensive tests"

# Query when needed
claude-flow memory query "terminal implementation"
```

### 2. Leverage Parallel Execution
```bash
# Run multiple analyses in parallel
claude-flow swarm "analyze codebase health" --parallel --max-agents 8
```

### 3. Monitor Long-Running Tasks
```bash
# Use monitoring for complex operations
claude-flow hive-mind spawn "refactor entire terminal system" --monitor --ui
```

### 4. Chain Commands with Hooks
```bash
# Automated workflow with hooks
claude-flow hooks pre-task --description "major refactor" --auto-spawn-agents
claude-flow sparc refactor "modernize state management"
claude-flow hooks post-task --analyze-performance --generate-insights
```

## 🎯 Project-Specific Scenarios

### Rust Manager Enhancement
```bash
# Complete manager feature addition
claude-flow hive-mind spawn "add plugin system to Rust manager with hot reload"
```

### Terminal Performance Fix
```bash
# Debug and fix terminal issues
claude-flow swarm "fix terminal flickering and optimize rendering" --strategy optimization --parallel
```

### Test Coverage Improvement
```bash
# Boost test coverage
claude-flow swarm "achieve 90% test coverage for UI components" --strategy testing --max-agents 6
```

### Architecture Refactoring
```bash
# Major architectural changes
claude-flow sparc architect "migrate to unified state management"
claude-flow hive-mind spawn "implement new state architecture with migration"
```

## 📊 Monitoring and Analytics

```bash
# View system status
claude-flow status

# Check hive mind metrics
claude-flow hive-mind metrics

# Analyze swarm performance
claude-flow hive-mind status

# Export session data
claude-flow memory export orchflow-session.json
```

## 🔧 Troubleshooting

```bash
# If agents get stuck
claude-flow agent list
claude-flow agent terminate <agent-id>

# Reset hive mind
claude-flow hive-mind init --reset

# Clear old memory
claude-flow memory cleanup --older-than 7d

# Check system health
claude-flow status --verbose
```

---

Remember: Claude Flow coordinates the work, but Claude Code (you) executes the actual implementation. Use these commands to enhance your development workflow on the Orchflow project!


# 1. Analyze ruv-FANN Rust core
  claude-flow swarm "analyze ruv-FANN Rust modules for direct integration into Orchflow" --strategy analysis

  # 2. Create integration plan
  claude-flow sparc architect "design direct ruv-FANN integration into Orchflow Rust codebase"

  # 3. Build unified system
  claude-flow hive-mind spawn "integrate ruv-FANN orchestration directly into Orchflow manager"

  This is actually much better - we can achieve the dream architecture of a fully integrated, AI-powered terminal
  IDE with no process boundaries! The 10/10 solution is within reach.




   # 1. Design the IPC protocol
  claude-flow sparc architect "design IPC protocol for orchflow-ruv-FANN communication"

  # 2. Create proof of concept
  claude-flow hive-mind spawn "build sidecar integration proof-of-concept"

  # 3. Plan deployment strategy
  claude-flow swarm "plan ruv-FANN bundling and deployment for orchflow" --strategy analysis