# OrchFlow User Guide 📖

Complete guide to OrchFlow's natural language orchestration system.

## Table of Contents

1. [Overview](#overview)
2. [Installation & Setup](#installation--setup)
3. [Core Concepts](#core-concepts)
4. [Natural Language Commands](#natural-language-commands)
5. [Worker Management](#worker-management)
6. [Status Monitoring](#status-monitoring)
7. [Configuration](#configuration)
8. [Advanced Features](#advanced-features)
9. [Troubleshooting](#troubleshooting)

## Overview

OrchFlow transforms claude-flow into a natural language orchestration platform. It provides:

- **Natural Language Interface**: Create and manage tasks conversationally
- **Intelligent Workers**: AI agents with descriptive, context-aware names
- **Live Monitoring**: Real-time status pane with progress tracking
- **Quick Access**: Instant worker connection via numeric keys (1-9)
- **Seamless Integration**: All claude-flow commands work unchanged

## Installation & Setup

### Requirements

- **Node.js 16+**
- **claude-flow** (installed separately)
- **tmux** (for terminal management)
- **Unix-like system** (macOS, Linux, WSL)

### Installation

```bash
npm install -g @orchflow/claude-flow
```

### First Launch

```bash
claude-flow orchflow
```

This creates the OrchFlow directory structure:

```
~/.orchflow/
├── config.json          # User configuration
├── state.json           # Session state
├── logs/                # System logs
├── cache/               # Temporary files
└── snapshots/           # Session snapshots
```

## Core Concepts

### Workers

**Workers** are AI agents that execute specific tasks. Each worker:
- Has a **descriptive name** based on its task (e.g., "Auth System Builder")
- Runs in its own **tmux session**
- Can be accessed via **natural language** or **quick keys**
- Maintains **persistent state** across connections

### Primary Terminal

The **Primary Terminal** (70% width) is where you:
- Issue natural language commands
- Interact with Claude conversationally  
- Never get blocked by long-running tasks
- Maintain full control over the system

### Status Pane

The **Status Pane** (30% width) shows:
- Live worker status and progress
- Resource usage metrics
- Quick access key assignments
- System health information

## Natural Language Commands

### Task Creation

Create workers using natural language descriptions:

```bash
# Development tasks
Build a React component for user profiles
Create an API endpoint for authentication
Implement JWT token validation
Set up database migrations for user table

# Testing tasks  
Test the user registration flow
Create unit tests for the payment system
Run integration tests on the API

# Research tasks
Research modern CSS frameworks
Investigate GraphQL security best practices
Analyze competitor authentication flows

# Analysis tasks
Optimize database query performance
Analyze user behavior patterns
Review code for security vulnerabilities
```

### Worker Interaction

```bash
# Connect to workers
Connect to the React developer
Show me the API builder
Switch to the test engineer
Go to worker 3

# Quick access
Press 1    # Connect to worker 1
Hit 5      # Connect to worker 5
Use key 7  # Connect to worker 7

# Worker management
Pause the test runner
Resume the API developer
Stop worker 2
Restart the authentication builder
```

### Status Queries

```bash
# Worker status
Show me all workers
List active workers
What workers are running?
Display worker status

# System status
What's the system status?
Show system information
Display performance metrics
How many workers are active?

# Detailed information
Show worker 3 details
Get performance report
Display memory usage
Show task progress
```

### Session Management

```bash
# Save current state
Save session
Create snapshot
Backup current state

# Load previous state
Restore session
Load snapshot backup_20230715
Resume previous session

# Clear state
Reset all workers
Clear session data
Stop everything
```

## Worker Management

### Worker Lifecycle

1. **Creation**: Natural language task → Descriptive worker name
2. **Assignment**: Automatic quick access key (1-9)
3. **Execution**: Task runs in isolated tmux session
4. **Monitoring**: Real-time progress in status pane
5. **Connection**: Access via name or quick key
6. **Completion**: Worker remains available for interaction

### Worker Types

OrchFlow automatically detects task types and creates appropriate workers:

| Keywords | Worker Type | Example Name |
|----------|-------------|--------------|
| build, create, implement | Code | "React Component Developer" |
| test, testing, validate | Test | "API Test Engineer" |
| research, investigate | Research | "Framework Research Specialist" |
| analyze, optimize | Analysis | "Performance Analyzer" |
| auth, login, security | Auth | "Auth System Builder" |
| api, endpoint, service | API | "API Developer" |
| database, db, sql | Database | "Database Specialist" |

### Quick Access System

Workers are automatically assigned quick access keys (1-9):

```bash
[1] Auth System Builder     🟢 Running (45%)
[2] React Component Dev     🟢 Running (80%) 
[3] API Test Engineer       🟡 Paused
[4] Database Optimizer      🟢 Running (25%)
```

Press the number to instantly connect:
```bash
Press 1  # → Auth System Builder
Press 2  # → React Component Dev
```

### Worker Search

OrchFlow uses fuzzy matching to find workers:

```bash
Connect to auth        # → "Auth System Builder"
Show me react          # → "React Component Dev"  
Switch to test         # → "API Test Engineer"
Go to database         # → "Database Optimizer"
```

## Status Monitoring

### Status Pane Layout

```
┌─ Workers (4 active) ─────────────┐
│ [1] Auth System Builder     🟢 45% │
│     └─ JWT implementation         │
│                                   │
│ [2] React Component Dev     🟢 80% │  
│     └─ UserProfile.tsx           │
│                                   │
│ [3] API Test Engineer       🟡    │
│     └─ Paused by user            │
│                                   │
│ [4] Database Optimizer      🟢 25% │
│     └─ Query analysis            │
├─ System Resources ──────────────┤
│ CPU: ████████░░ 80%              │
│ RAM: ██████░░░░ 60%              │
│ Disk: ███░░░░░░░ 30%             │
├─ Quick Access ──────────────────┤
│ Press 1-4 for instant access     │
│ Ctrl+D to return here           │
└─────────────────────────────────┘
```

### Status Indicators

- 🟢 **Running**: Worker is actively executing
- 🟡 **Paused**: Worker is temporarily stopped
- 🔴 **Error**: Worker encountered an issue  
- ⚪ **Idle**: Worker is waiting for tasks
- ⏸️ **Stopped**: Worker has been terminated

### Progress Tracking

Workers show progress through:
- **Percentage completion** (estimated)
- **Current task description**
- **Resource usage metrics**
- **Time elapsed/remaining**

## Configuration

### Configuration File

Create `~/.orchflow/config.json`:

```json
{
  "ui": {
    "theme": "dark",
    "statusPaneWidth": 30,
    "showProgressBars": true,
    "animateUpdates": true
  },
  "workers": {
    "maxWorkers": 8,
    "defaultTimeout": 300000,
    "autoRestart": true,
    "resourceLimits": {
      "cpu": 80,
      "memory": 2048
    }
  },
  "orchestrator": {
    "port": 3001,
    "enableWebSocket": true,
    "saveInterval": 30000,
    "logLevel": "info"
  },
  "features": {
    "enableQuickAccess": true,
    "enableFuzzySearch": true,
    "enableAutoComplete": true,
    "enableSessionPersistence": true
  }
}
```

### Environment Variables

```bash
# Core configuration
export CLAUDE_FLOW_PATH=/custom/path/to/claude-flow
export ORCHFLOW_HOME=~/.orchflow
export ORCHFLOW_PORT=3001

# UI configuration  
export ORCHFLOW_STATUS_WIDTH=30
export ORCHFLOW_THEME=dark
export ORCHFLOW_ENABLE_ANIMATIONS=true

# Worker configuration
export ORCHFLOW_MAX_WORKERS=8
export ORCHFLOW_WORKER_TIMEOUT=300000
export ORCHFLOW_AUTO_RESTART=true

# Debug configuration
export ORCHFLOW_DEBUG=true
export ORCHFLOW_LOG_LEVEL=debug
export ORCHFLOW_VERBOSE=true
```

### Command Line Options

```bash
# Launch options
claude-flow orchflow --debug               # Enable debug mode
claude-flow orchflow --max-workers=10      # Set max workers
claude-flow orchflow --status-width=40     # Set status pane width
claude-flow orchflow --no-quick-access     # Disable quick keys
claude-flow orchflow --config=/path/config # Custom config file
```

## Advanced Features

### Session Snapshots

Create and restore session snapshots:

```bash
# Create snapshot
Create snapshot "before_refactor"
Save state as "backup_v1"

# List snapshots  
Show all snapshots
List saved sessions

# Restore snapshot
Restore snapshot "before_refactor"
Load state "backup_v1"
```

### Performance Monitoring

```bash
# Get performance metrics
Show performance report
Display system metrics
Get resource usage

# Analyze worker efficiency
Show worker performance
Analyze task completion rates
Display throughput metrics
```

### Custom Worker Types

Define custom worker types in config:

```json
{
  "customWorkers": {
    "devops": {
      "keywords": ["deploy", "infrastructure", "docker"],
      "name": "DevOps Engineer",
      "commands": ["deployment", "monitoring"]
    },
    "security": {
      "keywords": ["security", "penetration", "audit"],
      "name": "Security Specialist", 
      "commands": ["security-scan", "vulnerability-check"]
    }
  }
}
```

### Batch Operations

```bash
# Create multiple workers
Create 3 workers for frontend development
Spawn workers for full-stack project
Set up development team

# Batch management
Pause all workers
Resume all test workers  
Stop inactive workers
Restart failed workers
```

### Integration with External Tools

```bash
# GitHub integration
Create worker for PR review
Set up CI/CD monitoring
Deploy to staging environment

# Database operations
Connect to production database
Run database migrations  
Create backup job

# Monitoring integration
Set up log monitoring
Create alert system
Monitor application performance
```

## Troubleshooting

### Common Issues

#### OrchFlow Won't Start

```bash
# Check dependencies
claude-flow --version     # Should show version
tmux -V                  # Should show tmux version
node --version           # Should be 16+

# Clear cache
rm -rf ~/.orchflow/cache
rm -rf ~/.orchflow/logs

# Reinstall
npm uninstall -g @orchflow/claude-flow
npm install -g @orchflow/claude-flow
```

#### Workers Not Responding

```bash
# Check worker status
Show me all workers
Display worker details

# Restart specific worker
Restart worker 2
Stop and recreate the API developer

# System restart
Stop all workers
Clear all sessions
Restart OrchFlow
```

#### Status Pane Issues

```bash
# Refresh display
Refresh status pane
Reload worker information

# Reset layout
Reset terminal layout
Resize status pane to 30%

# Clear and restart
Clear status data
Restart status monitoring
```

#### Performance Issues

```bash
# Check resource usage
Show system resources
Display memory usage
Get CPU utilization

# Optimize settings
Reduce max workers to 5
Increase worker timeout
Enable auto cleanup

# Clear data
Clear old logs
Remove cached data
Compress session data
```

### Debug Mode

Enable debug mode for detailed troubleshooting:

```bash
claude-flow orchflow --debug
```

This shows:
- Detailed worker lifecycle events
- Real-time resource monitoring
- Network communication logs
- Error stack traces
- Performance metrics

### Log Files

Check log files for issues:

```bash
# System logs
tail -f ~/.orchflow/logs/system.log

# Worker logs  
tail -f ~/.orchflow/logs/workers.log

# Error logs
tail -f ~/.orchflow/logs/errors.log

# Debug logs (if enabled)
tail -f ~/.orchflow/logs/debug.log
```

### Getting Help

If issues persist:

1. **Check Documentation**: Review this guide and [API docs](API.md)
2. **Search Issues**: Check [GitHub Issues](https://github.com/orchflow/orchflow/issues)
3. **Create Issue**: Report bugs with debug logs
4. **Community**: Join [Discord](https://discord.gg/orchflow) for help

---

**Happy orchestrating with OrchFlow!** 🎉

For API documentation and programmatic usage, see [API.md](API.md).