# OrchFlow Terminal Architecture

## Overview

OrchFlow uses a three-tier terminal architecture that eliminates the need for unix-style keyword commands, allowing users to interact naturally with Claude in the primary terminal while complex work is distributed to worker terminals.

## Architecture Components

### 1. Primary Terminal (User Interface & Control Center)
- **Purpose**: Natural language interaction with Claude + System visibility
- **Key Features**:
  - Never gets tied up with long-running work
  - Maintains conversational context
  - Translates user intent to orchestrator commands
  - **Live system overview dashboard**
  - **Direct access to any running worker**
  - **Interactive inspection and control**
- **Implementation**: Claude-code with MCP tools for orchestrator awareness

### 2. Orchestrator/Manager Terminal (Intelligent Coordination Layer)
- **Purpose**: Orchestrate work execution with dependency awareness
- **Responsibilities**:
  - Receive commands from primary terminal
  - **Analyze task dependencies and parallelization opportunities**
  - **Schedule work in optimal sequence or parallel execution**
  - Spawn worker terminals (claude-flow swarms, hive-minds, tasks)
  - Track worker status, progress, and resource usage
  - **Maintain communication channels between workers**
  - **Handle inter-worker dependencies**
  - Report back to primary terminal with live updates
  - Handle worker lifecycle (start/pause/resume/stop/kill)
- **Implementation**: OrchFlow Manager with dependency graph and scheduling engine

### 3. Worker Terminals (Intelligent Execution Layer)
- **Purpose**: Execute work independently while remaining accessible
- **Types**:
  - Claude-flow swarms (multi-agent collaboration)
  - Hive-mind instances (collective intelligence)
  - Individual task runners (focused execution)
  - Specialized agents (domain-specific work)
- **Features**:
  - **Each runs full claude-code instance**
  - **Can be inspected and chatted with while running**
  - **Pauseable and resumeable**
  - **Can spawn their own sub-swarms/hive-minds**
  - Run in tmux panes for easy access
  - Report progress to orchestrator
  - Maintain conversation context
  - Support live intervention

## Natural Language Interface Design

### User Experience Flow

```
User (Primary Terminal): "Can you analyze this codebase for performance issues?"

Claude: "I'll analyze the codebase for performance issues. Let me set up a specialized team to handle this."
[Sends command to orchestrator]

Orchestrator: [Spawns performance analysis swarm in worker terminals]

Claude: "I've started a performance analysis swarm with 3 specialized agents:
- Code Analyzer: Examining hot paths and bottlenecks
- Memory Profiler: Checking for leaks and inefficient allocations  
- Benchmark Runner: Running performance tests

You can check progress anytime by asking 'how's the analysis going?' or stop it with 'cancel the performance analysis'."
```

### Key Benefits

1. **Zero Learning Curve**: Users speak naturally, no commands to memorize
2. **Non-Blocking**: Primary terminal always responsive for conversation
3. **Transparency**: Users see what's happening without technical details
4. **Control**: Simple natural language to stop/modify running tasks
5. **Context Aware**: Claude remembers conversation and task context

## Implementation Strategy

### Phase 1: Primary Terminal Setup
```typescript
interface PrimaryTerminal {
  // Initialize with orchestrator awareness
  async init() {
    // 1. Setup MCP connection to orchestrator
    // 2. Load orchestrator command schemas
    // 3. Initialize conversation context
    // 4. Enable intent recognition
  }
  
  // Process natural language input
  async processUserInput(input: string): Promise<void> {
    const intent = await this.inferIntent(input);
    const command = await this.translateToOrchestrator(intent);
    await this.orchestrator.execute(command);
    await this.reportToUser(command.status);
  }
  
  // Maintain awareness of running tasks
  async getStatus(): Promise<TaskStatus[]> {
    return this.orchestrator.getAllWorkerStatus();
  }
}
```

### Phase 2: Orchestrator Integration
```typescript
interface Orchestrator {
  // Spawn workers based on intent
  async spawnWorker(config: WorkerConfig): Promise<WorkerId> {
    // Determine worker type (swarm, hive-mind, task)
    // Spawn in appropriate terminal/process
    // Register for status updates
    // Return worker ID for tracking
  }
  
  // Manage worker lifecycle
  async stopWorker(id: WorkerId): Promise<void>;
  async getWorkerStatus(id: WorkerId): Promise<WorkerStatus>;
  async getAllWorkerStatus(): Promise<WorkerStatus[]>;
}
```

### Phase 3: Worker Terminal Patterns
```typescript
interface WorkerTerminal {
  id: string;
  type: 'swarm' | 'hive-mind' | 'task';
  status: 'running' | 'completed' | 'failed';
  progress: number;
  output: string[];
  
  // Lifecycle methods
  start(): Promise<void>;
  stop(): Promise<void>;
  getProgress(): Promise<Progress>;
}
```

## Example Interactions

### Starting Work
```
User: "I need to refactor the authentication module to use JWT tokens"
Claude: "I'll set up a refactoring team to handle the JWT migration. This will involve:
- Analyzing current auth implementation
- Designing JWT integration
- Implementing changes with tests
- Updating documentation

Starting the refactoring swarm now..."
[Orchestrator spawns refactoring swarm]
```

### System Overview
```
User: "Show me what's running"
Claude: "Here's your current system activity:

🎯 Active Workers (3 running, 1 queued)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. JWT Refactoring Swarm [65% ████████░░░░]
   └─ 4 agents: Analyzer ✓ | Designer ✓ | Coder ⚡ | Tester ○
   └─ Status: Implementing endpoint migrations (8/12 complete)
   └─ Started: 10 mins ago | Est: 15 mins remaining

2. Performance Analysis Hive [42% █████░░░░░░░]
   └─ Queen + 3 workers analyzing database queries
   └─ Status: Found 3 bottlenecks, optimizing...
   └─ Started: 5 mins ago | Est: 7 mins remaining

3. Documentation Generator [90% ███████████░]
   └─ Single agent updating API docs
   └─ Status: Final review pass
   └─ Started: 20 mins ago | Est: 2 mins remaining

4. [QUEUED] Security Audit
   └─ Waiting for: Performance Analysis to complete
   └─ Reason: Shared database access required

Type a number to inspect that worker, or ask me anything about them."
```

### Inspecting a Worker
```
User: "Let me see what's happening in 1"
Claude: "Connecting you to the JWT Refactoring Swarm..."

[Terminal switches to worker view]

Worker Claude: "Hello! I'm coordinating the JWT refactoring. We're currently:
- ✓ Analyzed all 12 auth endpoints
- ✓ Designed JWT schema with refresh tokens
- ⚡ Migrating endpoints (working on /api/users/login now)
- ○ Tests pending for migrated endpoints

Would you like to:
1. See the code changes so far
2. Modify the JWT implementation approach  
3. Pause this work
4. Continue monitoring

Or just chat with me about the refactoring?"

User: "Show me the JWT schema you designed"
Worker Claude: "Here's our JWT token structure:
[Shows detailed schema...]

User: "Looks good, carry on"
[Returns to primary terminal]
```

### Orchestrator Intelligence
```
User: "I need to update the user service and run integration tests"
Claude: "I'll coordinate this work efficiently. The orchestrator has determined:

📊 Execution Plan:
1. User Service Update (can start immediately)
2. Integration Tests (must wait for update to complete)

However, I notice you have a Performance Analysis running that's accessing the user database. 

Options:
A. Wait 7 mins for analysis to complete (recommended - avoids conflicts)
B. Pause the analysis temporarily
C. Proceed anyway (may cause slowdowns)

What would you prefer?"
```

### Interactive Control
```
User: "Pause the documentation generator, it's using too many resources"
Claude: "I've paused the Documentation Generator. 

Worker state saved at: 90% complete (API docs through endpoint /api/v2/orders)

You can:
- 'resume docs' - Continue from where it stopped
- 'talk to docs' - Chat with the paused worker
- 'kill docs' - Terminate and discard progress

The freed resources are now available for other workers."
```

### Worker Communication
```
User: "Can the refactoring team share their auth findings with the security audit?"
Claude: "I'll establish communication between the teams.

✓ JWT Refactoring Swarm has shared:
- Authentication endpoint analysis
- Current vulnerabilities found
- Proposed JWT security measures

The Security Audit team will incorporate these findings when they start, avoiding duplicate analysis. This will reduce their estimated time by ~15 minutes."
```

## Technical Implementation Details

### System Visibility Architecture
```typescript
interface SystemOverview {
  workers: WorkerInfo[];
  queue: QueuedTask[];
  resources: ResourceUsage;
  dependencies: DependencyGraph;
}

interface WorkerInfo {
  id: string;
  type: 'swarm' | 'hive-mind' | 'task';
  name: string;
  status: 'running' | 'paused' | 'queued' | 'completed';
  progress: number;
  agents?: AgentInfo[];
  startTime: Date;
  estimatedCompletion: Date;
  terminalPane: string; // tmux pane identifier
  canInspect: boolean;
  canPause: boolean;
  dependencies: string[]; // other worker IDs
}
```

### Orchestrator Intelligence Engine
```typescript
class Orchestrator {
  private dependencyGraph: DependencyGraph;
  private resourceManager: ResourceManager;
  private scheduler: TaskScheduler;
  
  // Analyze work for optimal execution
  async planExecution(tasks: Task[]): ExecutionPlan {
    const dependencies = this.analyzeDependencies(tasks);
    const parallelizable = this.findParallelizableWork(tasks, dependencies);
    const sequence = this.determineOptimalSequence(tasks, dependencies);
    
    return {
      parallel: parallelizable,
      sequential: sequence,
      estimatedTime: this.calculateTotalTime(tasks),
      resourceRequirements: this.assessResources(tasks)
    };
  }
  
  // Smart scheduling with conflict detection
  async scheduleWork(task: Task): ScheduleResult {
    const conflicts = await this.detectConflicts(task);
    if (conflicts.length > 0) {
      return {
        status: 'queued',
        reason: conflicts[0].description,
        waitingFor: conflicts[0].blockingWorker,
        estimatedStartTime: conflicts[0].expectedClearTime
      };
    }
    
    return { status: 'started', workerId: await this.spawnWorker(task) };
  }
}
```

### Worker Inspection & Interaction
```typescript
interface WorkerInspector {
  // Connect to running worker's claude instance
  async connectToWorker(workerId: string): WorkerConnection {
    const pane = this.orchestrator.getWorkerPane(workerId);
    return {
      terminalId: pane.id,
      claudeInstance: pane.claudeInstance,
      conversationContext: await pane.getContext(),
      controls: {
        pause: () => pane.pause(),
        resume: () => pane.resume(),
        kill: () => pane.terminate(),
        sendMessage: (msg: string) => pane.claudeInstance.chat(msg)
      }
    };
  }
  
  // Enable live chat with worker
  async chatWithWorker(workerId: string, message: string): Promise<string> {
    const connection = await this.connectToWorker(workerId);
    return connection.claudeInstance.chat(message);
  }
}
```

### MCP Tool Registration (Enhanced)
```javascript
// Orchestrator MCP tools exposed to Claude
const orchestratorTools = {
  'spawn_swarm': {
    description: 'Spawn a claude-flow swarm for complex tasks',
    parameters: { objective, strategy, maxAgents, dependencies }
  },
  'spawn_hive_mind': {
    description: 'Spawn a hive-mind for collaborative work',
    parameters: { objective, queenType, workerCount, dependencies }
  },
  'get_system_overview': {
    description: 'Get full system activity overview',
    parameters: { includeQueued, includeCompleted }
  },
  'inspect_worker': {
    description: 'Connect to and inspect a running worker',
    parameters: { workerId }
  },
  'chat_with_worker': {
    description: 'Send message to a worker claude instance',
    parameters: { workerId, message }
  },
  'pause_worker': {
    description: 'Pause a running worker',
    parameters: { workerId }
  },
  'resume_worker': {
    description: 'Resume a paused worker',
    parameters: { workerId }
  },
  'stop_worker': {
    description: 'Stop a running worker',
    parameters: { workerId, saveState }
  },
  'analyze_dependencies': {
    description: 'Analyze task dependencies for scheduling',
    parameters: { tasks }
  },
  'share_worker_data': {
    description: 'Share data between workers',
    parameters: { sourceWorkerId, targetWorkerId, data }
  }
};
```

### Session Context Management
```javascript
// Primary terminal maintains conversation context
class ConversationContext {
  private runningTasks: Map<string, TaskContext>;
  private userPreferences: UserPreferences;
  private taskHistory: TaskHistory[];
  
  // Intent recognition based on context
  async inferIntent(input: string): Intent {
    // Use conversation history
    // Consider running tasks
    // Apply user preferences
    // Return structured intent
  }
}
```

## Benefits Over Unix + Keyword Approach

1. **Natural Interaction**: Users describe what they want, not how to do it
2. **Intelligent Routing**: Claude understands context and chooses appropriate tools
3. **Progressive Disclosure**: Technical details hidden unless requested
4. **Error Recovery**: Natural language explanations and suggestions
5. **Learning System**: Improves understanding of user patterns over time

## Next Steps

1. Implement primary terminal MCP integration
2. Create orchestrator command protocol
3. Define worker terminal spawning patterns
4. Build status reporting system
5. Add natural language intent recognition
6. Create conversation context management
7. Implement graceful error handling
8. Add progress visualization

This architecture enables users to work naturally with Claude while maintaining full control and visibility over distributed work execution.