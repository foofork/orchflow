

<!-- ORCHFLOW_SECTION_START -->

## OrchFlow Terminal Commands

You are working in an OrchFlow-enhanced environment with natural language orchestration.

### Available OrchFlow Commands:
- **Create workers**: "Create a React builder to handle the UI"
- **Quick access**: Press 1-9 to instantly connect to workers
- **Connect by name**: "Connect to the API developer" or "Show me the React builder"
- **Check status**: "What is worker 3 doing?" or "Show all workers"
- **Control workers**: "Pause the database designer" or "Resume worker 2"

Note: These commands are for the PRIMARY TERMINAL only, not for individual workers.

### Current Worker Status:
No active workers

### Active Task Context:
**Main Objective**: General development tasks

### Quick Access Map:
No quick access keys assigned

### OrchFlow Integration Tips:
- **Worker Names**: Use descriptive names like "React Component Builder" or "API Security Specialist"
- **Natural Language**: No command prefixes needed - just speak naturally
- **Primary Terminal**: This terminal stays responsive while workers run in background
- **Worker Connection**: Connect to any running worker to guide their specific work
- **Memory Integration**: Workers automatically coordinate through shared memory
- **Session Persistence**: All worker states and contexts are preserved across sessions

### Memory Coordination:
Workers use these patterns for coordination:
- `mcp__claude-flow__memory_usage` - Store and retrieve shared context
- `orchflow/workers/{workerId}/*` - Worker-specific memory keys
- `orchflow/tasks/*` - Task history and learning patterns

<!-- ORCHFLOW_SECTION_END -->