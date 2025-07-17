# OrchFlow Terminal Architecture Analysis
**By: CODER Agent (Hive Mind)**

## Executive Summary

OrchFlow implements a sophisticated terminal architecture that wraps around claude-flow while adding enhanced orchestration capabilities. The system focuses on natural language task creation, descriptive worker naming, and advanced MCP tool integration.

## Key Technical Findings

### 1. Terminal Command Execution Model

OrchFlow uses a **thin wrapper pattern** around claude-flow:

```typescript
// From claude-flow-wrapper.ts
buildCommand(task: Task): string {
  // Generates commands like:
  // claude-flow sparc run researcher "task description"
  // claude-flow swarm "task" --strategy development --parallel
}
```

**Key Differences from claude-flow:**
- OrchFlow generates claude-flow commands dynamically based on task types
- Adds orchestration metadata (task IDs, worker names)
- Implements command validation before execution

### 2. Enhanced MCP Tools (`primary-terminal/enhanced-mcp-tools.ts`)

OrchFlow introduces unique MCP tools for terminal interaction:

```typescript
// Natural language task creation
orchflow_natural_task - Creates tasks from natural language
orchflow_smart_connect - Connects to workers using names or quick keys (1-9)
orchflow_status_rich - Shows descriptive worker names and progress
orchflow_quick_access - Manages numeric quick access keys
orchflow_session - Handles session persistence
orchflow_performance - Provides performance metrics
```

**Integration Pattern:**
- MCP tools coordinate task creation and worker management
- Actual execution delegated to claude-flow via generated commands
- Terminal remains the primary interface

### 3. Worker Management Architecture

**Dual-Mode Execution:**
```typescript
// From worker-manager.ts
if (this.isTmuxAvailable()) {
  await this.spawnTmuxWorker(worker, config.command);
} else {
  await this.spawnProcessWorker(worker, config.command);
}
```

**Worker Naming System:**
- Generates context-aware descriptive names (e.g., "React Component Builder")
- Assigns quick access keys (1-9) for rapid switching
- Maintains name-to-worker mapping for natural language access

### 4. Terminal Layout System

**70/30 Split Design:**
- Primary terminal (70%): Natural language interface
- Status pane (30%): Live worker monitoring
- Implemented via tmux or process management

### 5. Command Flow Pattern

```
User Input → NL Recognition → MCP Tool → Task Creation → 
Claude-Flow Command Generation → Worker Spawn → Terminal Execution
```

## Critical Integration Points for Claude Code

### 1. Command Format Compatibility
OrchFlow expects claude-flow commands in specific formats:
- `claude-flow sparc run [agent-type] "[description]"`
- `claude-flow swarm "[task]" --strategy [type] --parallel`

### 2. Environment Variables
OrchFlow sets custom environment variables:
- `CLAUDE_FLOW_MODE`: research/code/test/analysis/swarm/hive-mind
- `CLAUDE_FLOW_TASK_ID`: Unique task identifier
- `ORCHFLOW_WORKER`: Indicates worker context

### 3. Worker Communication
- Uses WebSocket for real-time updates (port 3001)
- Tmux sessions named: `orchflow_[worker_id]`
- Process-based fallback for non-tmux environments

### 4. MCP Server Integration
- OrchFlow runs its own MCP server (default port 3001)
- Registers both OrchFlow-specific and enhanced tools
- Expects responses in specific formats

## Unique Features Not in claude-flow

1. **Descriptive Worker Names**: Context-aware naming system
2. **Quick Access Keys**: Numeric shortcuts (1-9) for workers
3. **Natural Language Task Creation**: Advanced NL processing
4. **Session Persistence**: Save/restore orchestration state
5. **Performance Monitoring**: Built-in metrics and recommendations
6. **Split Terminal Layout**: 70/30 visual separation

## Recommended Integration Approach

For Claude Code to work seamlessly with OrchFlow:

1. **Preserve Command Format**: Keep claude-flow command generation intact
2. **Support Environment Variables**: Respect OrchFlow's env vars
3. **Handle Worker Names**: Use descriptive names in status/logs
4. **WebSocket Updates**: Send progress updates if connected
5. **MCP Tool Responses**: Format responses per OrchFlow expectations

## Technical Constraints

1. **Binary Discovery**: OrchFlow searches multiple paths for claude-flow
2. **Port Configuration**: Default MCP port 3001 (configurable)
3. **Process Management**: Dual tmux/process spawning modes
4. **Resource Limits**: Per-task-type memory and CPU limits

## Conclusion

OrchFlow acts as an orchestration layer above claude-flow, focusing on natural language interfaces and worker management. The terminal remains the execution point, with claude-flow handling the actual work while OrchFlow coordinates and monitors.