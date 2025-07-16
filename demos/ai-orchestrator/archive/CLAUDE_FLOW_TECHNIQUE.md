# Claude-Flow Technique: Single Terminal Orchestration

## The Key Insight

Claude-flow doesn't spawn multiple separate claude-code processes. Instead, it **controls a single claude-code instance** that acts as a hive-mind coordinator, managing multiple virtual agents within the same context.

## How It Actually Works

### 1. Single Claude-Code Instance
```bash
# Claude-flow launches ONE claude-code process
claude-flow swarm "Build REST API" --max-agents 8

# This translates to:
claude-code --dangerously-skip-permissions \
  --tools TodoWrite,Task,Bash,Read,Write,etc \
  --system-prompt "You are a swarm coordinator..."
```

### 2. Virtual Agent Architecture

The technique uses **context switching** within a single Claude conversation:

```
[Claude-Code Terminal]
┌─────────────────────────────────────────────────┐
│ SWARM COORDINATOR (Single Claude Instance)       │
├─────────────────────────────────────────────────┤
│                                                 │
│ Virtual Agent: Architect                        │
│ > Designing system architecture...              │
│                                                 │
│ Virtual Agent: Backend-Dev                      │
│ > Implementing API endpoints...                 │
│                                                 │
│ Virtual Agent: Tester                           │
│ > Writing test cases...                         │
│                                                 │
│ [All running in same Claude context]            │
└─────────────────────────────────────────────────┘
```

### 3. The Orchestration Pattern

Claude-flow uses specific prompting patterns to make Claude act as multiple agents:

```javascript
// Simplified version of what claude-flow does
const swarmPrompt = `
You are a swarm coordinator managing multiple AI agents.
Each agent has a specific role and expertise.

Current agents:
- Architect: System design and architecture
- Coder: Implementation and coding
- Tester: Testing and quality assurance

For each task:
1. Delegate to appropriate agent
2. Switch context to that agent's perspective
3. Complete the work as that agent
4. Report back as coordinator

Task: ${userTask}
`;
```

### 4. Memory and Coordination

Claude-flow leverages Claude's tools to maintain state:

```javascript
// TodoWrite for task tracking
TodoWrite([
  { id: "arch-1", content: "Design API structure", assignedAgent: "architect" },
  { id: "code-1", content: "Implement endpoints", assignedAgent: "coder" },
  { id: "test-1", content: "Write tests", assignedAgent: "tester" }
]);

// Memory for shared context
await memory_usage({
  action: "store",
  key: "api_design",
  value: "REST API with /users, /auth endpoints"
});

// Task tool for parallel conceptual execution
Task("Architect Agent", "Design the API structure and store in memory");
Task("Coder Agent", "Implement based on architect's design");
```

### 5. The SPARC Modes

SPARC modes are **personality configurations** for the single Claude instance:

```bash
# Each mode gives Claude a different "hat" to wear
./claude-flow sparc run architect "Design system"
# Claude acts as architect

./claude-flow sparc run coder "Implement design"  
# Claude acts as coder

# Swarm mode makes Claude wear multiple hats
./claude-flow swarm "Build system"
# Claude acts as coordinator + all agents
```

## The Real Architecture

```
┌──────────────────────────────────────────────────┐
│              User Terminal                        │
├──────────────────────────────────────────────────┤
│ $ claude-flow swarm "Build REST API"             │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────┐
│           Claude-Flow Process                     │
├──────────────────────────────────────────────────┤
│ 1. Parses command                                │
│ 2. Constructs swarm prompt                       │
│ 3. Launches claude-code with tools               │
│ 4. Monitors progress                             │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────┐
│      Single Claude-Code Instance                  │
├──────────────────────────────────────────────────┤
│ Acting as:                                       │
│ - Swarm Coordinator                              │
│ - Virtual Architect Agent                        │
│ - Virtual Coder Agent                            │
│ - Virtual Tester Agent                           │
│                                                  │
│ Using Tools:                                     │
│ - TodoWrite (task management)                    │
│ - Task (parallel simulation)                     │
│ - Memory (shared context)                        │
│ - Bash, Read, Write (actual work)               │
└──────────────────────────────────────────────────┘
```

## Key Techniques

### 1. Context Switching
```
[As Coordinator]: I'll assign this to the architect agent.
[As Architect]: I'm designing the system with these components...
[As Coordinator]: Architecture complete. Coder, please implement.
[As Coder]: I'll implement the design...
```

### 2. Parallel Simulation
Even though it's one Claude instance, it simulates parallel work:
```javascript
// Claude processes these "conceptually in parallel"
Task("Agent 1", "Research best practices");
Task("Agent 2", "Design architecture");
Task("Agent 3", "Set up project structure");
```

### 3. Memory-Based Coordination
Agents share information through the memory system:
```javascript
// Architect stores design
memory_store("api_design", "REST endpoints: /users, /auth");

// Coder retrieves design
const design = memory_get("api_design");
```

## Implications for Our Demo

### Original Assumption ❌
Multiple terminals, each running separate claude-flow/claude-code instances

### Reality ✅
- **One primary terminal** running claude-flow
- **One orchestrator display** showing claude-flow's output
- **Virtual agents** displayed as log sections, not separate terminals

### Revised Architecture
```
┌─────────────────────────────────────────────────┐
│                 Terminal Layout                  │
├──────────────────┬───────────────────────────────┤
│ User Input       │ Claude-Flow Output           │
│                  │                               │
│ > Build REST API │ [Coordinator] Starting swarm │
│                  │                               │
│ > Status?        │ [Architect] Designing...      │
│                  │ ✓ Design complete             │
│                  │                               │
│ > Show progress  │ [Coder] Implementing...       │
│                  │ - Created user routes         │
│                  │ - Added authentication        │
│                  │ ✓ Implementation complete     │
│                  │                               │
│                  │ [Tester] Writing tests...     │
│                  │ ✓ Tests complete              │
│                  │                               │
│                  │ [Coordinator] All tasks done! │
└──────────────────┴───────────────────────────────┘
```

## The Power of This Approach

1. **Efficiency**: One Claude instance = one API connection
2. **Shared Context**: All "agents" have access to full conversation
3. **Coordination**: No IPC needed between agents
4. **Flexibility**: Easy to add new agent types
5. **State Management**: Built-in through Claude's memory

This is why claude-flow is so powerful - it transforms a single Claude instance into a coordinated swarm through clever prompting and tool usage!