# OrchFlow-Claude Integration: Simplified Implementation Plan

## Core Insight

OrchFlow's split terminal and visual layout are **implementation details** that Claude Code doesn't need to know about. Instead, focus on providing functional context about workers, tasks, and orchestration patterns.

## What Claude Code Actually Needs from OrchFlow

### 1. Worker Context
```typescript
interface WorkerContext {
  workers: Array<{
    id: string;
    descriptiveName: string;  // "React Component Builder"
    status: 'active' | 'paused' | 'completed';
    currentTask?: string;
    quickAccessKey?: number;  // 1-9 for quick access
    progress?: number;
    estimatedCompletion?: Date;
  }>;
}
```

### 2. Task Context
```typescript
interface TaskContext {
  mainObjective: string;
  activeSubtasks: string[];
  completedTasks: string[];
  dependencies: Map<string, string[]>;
  taskHistory: Array<{task: string, status: string, timestamp: Date}>;
}
```

### 3. OrchFlow Command Patterns
```typescript
interface OrchFlowPatterns {
  workerCreation: string[];     // ["Create a {role} to {task}"]
  workerManagement: string[];   // ["Pause the {worker}", "Connect to {worker}"]
  taskOrchestration: string[];  // ["Build {feature} with {approach}"]
  quickAccess: string[];        // ["Press 1-9", "Connect to worker 3"]
}
```

## Current State Analysis

### ✅ Already Implemented:
1. **Enhanced MCP Tools** (`enhanced-mcp-tools.ts`)
   - `orchflow_natural_task` - Natural language task creation
   - `orchflow_smart_connect` - Intelligent worker connection
   - `orchflow_status_rich` - Rich status information
   - `orchflow_quick_access` - Quick access key management
   - Tools have handlers but receive minimal context

2. **Natural Language Processing** (`main-orchestrator.ts`)
   - `parseNaturalLanguageTask()` function exists
   - Generates descriptive worker names
   - Assigns quick access keys

3. **Basic MCP Integration** (`orchflow-terminal.ts`)
   - Calls MCP tools with natural language input
   - Passes conversation history only

### ❌ Still Missing:
1. **Functional Context Provider**
   - No class to gather worker states, tasks, and patterns
   - Terminal doesn't enrich MCP calls with worker context

2. **Dynamic Instruction Provider**
   - No runtime instruction generation
   - No task-specific OrchFlow examples
   - No pattern suggestions based on context

3. **Context Integration**
   - MCP tools receive minimal context
   - No worker state information passed
   - No available commands or patterns shared

## Updated Implementation Plan

### Phase 1: Functional Context Provider (Week 1)

#### 1.1 Create Context Provider
```typescript
// New file: /packages/orchflow-claude-flow/src/context/functional-context.ts
export class OrchFlowFunctionalContext {
  constructor(
    private orchestratorClient: OrchestratorClient,
    private conversationContext: ConversationContext,
    private workerManager: WorkerManager
  ) {}

  async getContext(userInput: string): Promise<any> {
    const workers = await this.orchestratorClient.listWorkers();
    const enrichedWorkers = await this.enrichWorkerInfo(workers);
    
    return {
      workers: enrichedWorkers,
      currentTask: await this.getCurrentTaskContext(),
      availableCommands: this.getRelevantCommands(userInput),
      quickAccessMap: await this.getQuickAccessMapping(),
      recentHistory: this.conversationContext.getRecentHistory(),
      systemCapabilities: this.getSystemCapabilities()
    };
  }
  
  private async enrichWorkerInfo(workers: any[]): Promise<any[]> {
    // Add progress, estimated completion, current activity
    return workers.map(w => ({
      ...w,
      progress: w.progress || 0,
      currentActivity: w.lastLog || 'Working...',
      estimatedCompletion: this.estimateCompletion(w)
    }));
  }
  
  private getRelevantCommands(input: string): string[] {
    const commands = [];
    
    // Always include quick access hint
    commands.push('Tip: Press 1-9 to quickly connect to workers');
    
    // Context-aware suggestions
    if (input.toLowerCase().includes('create') || input.toLowerCase().includes('build')) {
      commands.push(
        'Create a React component builder to handle UI',
        'Create an API developer for the backend',
        'Create a test engineer to write unit tests'
      );
    }
    
    if (input.toLowerCase().includes('connect') || input.toLowerCase().includes('check')) {
      commands.push(
        'Connect to the React builder',
        'What is worker 3 doing?',
        'Show me all workers'
      );
    }
    
    return commands;
  }
}
```

#### 1.2 Update MCP Tool Integration
```typescript
// Update: orchflow-terminal.ts processNaturalLanguageCommand
private async processNaturalLanguageCommand(input: string): Promise<void> {
  try {
    // Get rich functional context
    const context = await this.contextProvider.getContext(input);
    
    const response = await this.mcpClient.invokeTool('orchflow_natural_task', {
      naturalLanguageInput: input,
      context: context.recentHistory,
      // NEW: Add functional context
      orchflowContext: {
        workers: context.workers,
        quickAccessMap: context.quickAccessMap,
        availableCommands: context.availableCommands,
        currentTask: context.currentTask
      }
    });
    
    if (response.success) {
      await this.updateUI(response.description || 'Command processed successfully');
    }
  } catch (error) {
    await this.updateUI(`Error processing command: ${error}`);
  }
}
```

### Phase 2: Dynamic Instruction Injection (Week 2)

#### 2.1 Task-Specific Instructions
```typescript
// New: /packages/orchflow-claude-flow/src/instructions/dynamic-instructions.ts
export class DynamicInstructionProvider {
  generateInstructions(taskType: string, context: any): string {
    const instructions = [`# OrchFlow Task Context\n`];
    
    // Add current objective if available
    if (context.currentTask?.mainObjective) {
      instructions.push(`## Current Objective: ${context.currentTask.mainObjective}\n`);
    }
    
    // Add relevant patterns based on task type
    const patterns = this.getTaskPatterns(taskType);
    if (patterns.length > 0) {
      instructions.push('## Relevant OrchFlow Commands:');
      patterns.forEach(p => instructions.push(`- ${p}`));
    }
    
    // Add current worker status with quick access
    if (context.workers && context.workers.length > 0) {
      instructions.push('\n## Active Workers:');
      context.workers.forEach(w => {
        const key = w.quickAccessKey ? `[${w.quickAccessKey}]` : '[--]';
        const progress = w.progress ? ` (${w.progress}%)` : '';
        instructions.push(`- ${key} ${w.descriptiveName}: ${w.status}${progress}`);
      });
      instructions.push('\nTip: Use number keys 1-9 or worker names to connect');
    }
    
    return instructions.join('\n');
  }
  
  private getTaskPatterns(taskType: string): string[] {
    const patterns: Record<string, string[]> = {
      'web-development': [
        '"Create a React component builder" - for UI components',
        '"Create an API developer" - for backend services',
        '"Create a database designer" - for data modeling',
        '"Create a test engineer" - for unit/integration tests'
      ],
      'api-development': [
        '"Create a REST API designer" - for endpoint planning',
        '"Create a GraphQL developer" - for GraphQL schemas',
        '"Create an API tester" - for endpoint testing',
        '"Create a documentation writer" - for API docs'
      ],
      'general': [
        '"Create a [role] to [task]" - spawn a specialized worker',
        '"Connect to [worker name or number]" - switch to a worker',
        '"What is [worker] doing?" - check worker status',
        '"Pause/Resume [worker]" - control worker execution'
      ]
    };
    
    return patterns[taskType] || patterns.general;
  }
}
```

#### 2.2 Enhance MCP Tool Handlers
```typescript
// Update: enhanced-mcp-tools.ts handler
handler: async (params: any) => {
  const { naturalLanguageInput, context = [], orchflowContext } = params;

  // Parse with enriched context
  const taskInfo = await orchestrator.parseNaturalLanguageTask(
    naturalLanguageInput, 
    context,
    orchflowContext // Pass the rich context
  );

  // Generate dynamic instructions
  const instructions = new DynamicInstructionProvider().generateInstructions(
    taskInfo.taskType || 'general',
    orchflowContext
  );

  // Create worker with full context awareness
  const workerId = await orchestrator.spawnWorkerWithDescriptiveName(taskInfo);

  return {
    success: true,
    workerId,
    workerName: taskInfo.assignedWorkerName,
    quickAccessKey: taskInfo.quickAccessKey,
    description: `Created "${taskInfo.assignedWorkerName}" for: ${taskInfo.description}`,
    instructions, // Include instructions in response
    nextSteps: orchflowContext.availableCommands
  };
}
```

### Phase 3: Memory Integration (Week 3)

#### 3.1 Context Persistence
```typescript
// New: /packages/orchflow-claude-flow/src/context/memory-context.ts
export class OrchFlowMemoryContext {
  async storeWorkerContext(workerId: string, context: any): Promise<void> {
    await this.mcpClient.invokeTool('mcp__claude-flow__memory_usage', {
      action: 'store',
      key: `orchflow/workers/${workerId}/context`,
      value: JSON.stringify({
        ...context,
        timestamp: new Date().toISOString()
      }),
      namespace: 'orchflow',
      ttl: 3600 // 1 hour TTL
    });
  }
  
  async getTaskHistory(limit: number = 10): Promise<any[]> {
    const result = await this.mcpClient.invokeTool('mcp__claude-flow__memory_search', {
      pattern: 'orchflow/tasks/*',
      namespace: 'orchflow',
      limit
    });
    
    return result.matches.map(m => JSON.parse(m.value));
  }
  
  async suggestBasedOnHistory(currentInput: string): Promise<string[]> {
    const history = await this.getTaskHistory();
    const similar = history.filter(h => 
      this.calculateSimilarity(h.input, currentInput) > 0.7
    );
    
    return similar.map(h => h.successfulCommand);
  }
}
```

### Phase 3.5: CLAUDE.md Integration (Week 3-4)

#### 3.5.1 Dynamic CLAUDE.md Augmentation
```typescript
// New: /packages/orchflow-claude-flow/src/context/claude-md-manager.ts
export class ClaudeMDManager {
  private orchflowSection = `
## OrchFlow Terminal Commands

You are working in an OrchFlow-enhanced environment with natural language orchestration.

### Available OrchFlow Commands:
- **Create workers**: "Create a React builder to handle the UI"
- **Quick access**: Press 1-9 to instantly connect to workers
- **Connect by name**: "Connect to the API developer" or "Show me the React builder"
- **Check status**: "What is worker 3 doing?" or "Show all workers"
- **Control workers**: "Pause the database designer" or "Resume worker 2"

Note: These commands are for the PRIMARY TERMINAL only, not for workers.

### Current Worker Status:
{{WORKER_STATUS}}

### Active Task Context:
{{TASK_CONTEXT}}

### OrchFlow Tips:
- Workers have descriptive names like "React Component Builder"
- Use natural language - no command prefixes needed
- The primary terminal (this one) stays responsive while workers run
- You can connect to any running worker to guide their work
`;

  async generateOrchFlowSection(context: any): Promise<string> {
    let section = this.orchflowSection;
    
    // Replace placeholders with actual context
    const workerStatus = this.formatWorkerStatus(context.workers);
    const taskContext = this.formatTaskContext(context.currentTask);
    
    section = section.replace('{{WORKER_STATUS}}', workerStatus);
    section = section.replace('{{TASK_CONTEXT}}', taskContext);
    
    return section;
  }
  
  async appendToClaudeMD(content: string): Promise<void> {
    // Append OrchFlow-specific content to CLAUDE.md
    // This happens when OrchFlow terminal starts
    const claudeMdPath = path.join(process.cwd(), 'CLAUDE.md');
    const existing = await fs.readFile(claudeMdPath, 'utf-8');
    
    if (!existing.includes('## OrchFlow Terminal Commands')) {
      await fs.appendFile(claudeMdPath, '\n\n' + content);
    }
  }
}
```

#### 3.5.2 Worker-Specific CLAUDE.md
```typescript
// Update: When spawning workers
export class WorkerSpawner {
  async spawnWorkerWithContext(taskInfo: TaskInfo): Promise<string> {
    // Generate worker-specific CLAUDE.md content
    const workerInstructions = `
## Worker Identity: ${taskInfo.assignedWorkerName}

You are a specialized worker in the OrchFlow orchestration system.

### Your Role:
- **Identity**: ${taskInfo.assignedWorkerName}
- **Task**: ${taskInfo.description}
- **Focus**: Complete your assigned task efficiently

### OrchFlow Coordination:
- Store important decisions in memory for system coordination
- Use: mcp__claude-flow__memory_usage with key pattern "orchflow/workers/${taskInfo.workerId}/*"
- The orchestrator may spawn additional workers based on your progress
- You can request sub-workers if your task becomes complex

### Your Specific Instructions:
${taskInfo.specificInstructions || 'Focus on completing your assigned task efficiently.'}
`;

    // Set environment variable for claude-flow to pick up
    process.env.CLAUDE_ADDITIONAL_CONTEXT = workerInstructions;
    
    // Spawn worker with claude-flow
    const command = `claude-flow sparc run ${taskInfo.taskType} "${taskInfo.description}"`;
    return await this.executeCommand(command);
  }
}
```

### Phase 4: Integration & Testing (Week 4)

#### 4.1 Wire Everything Together
```typescript
// Update: orchflow-terminal.ts
export class OrchFlowTerminal {
  private contextProvider: OrchFlowFunctionalContext;
  private instructionProvider: DynamicInstructionProvider;
  private memoryContext: OrchFlowMemoryContext;
  
  async initialize(): Promise<void> {
    // ... existing initialization ...
    
    // Initialize new providers
    this.contextProvider = new OrchFlowFunctionalContext(
      this.orchestratorClient,
      this.conversationContext,
      this.workerAccessManager
    );
    
    this.instructionProvider = new DynamicInstructionProvider();
    this.memoryContext = new OrchFlowMemoryContext();
  }
  
  async processUserInput(input: string): Promise<void> {
    // Quick access handling remains the same
    if (/^[1-9]$/.test(input)) {
      await this.handleQuickAccess(parseInt(input));
      return;
    }
    
    // Get full context
    const context = await this.contextProvider.getContext(input);
    
    // Get historical suggestions
    const suggestions = await this.memoryContext.suggestBasedOnHistory(input);
    if (suggestions.length > 0) {
      context.historicalSuggestions = suggestions;
    }
    
    // Generate instructions
    const taskType = this.inferTaskType(input);
    const instructions = this.instructionProvider.generateInstructions(taskType, context);
    
    // Process with full context
    const response = await this.mcpClient.invokeTool('orchflow_natural_task', {
      naturalLanguageInput: input,
      context: this.conversationContext.getRecentHistory(),
      orchflowContext: context,
      instructions
    });
    
    // Store successful patterns
    if (response.success) {
      await this.memoryContext.storeWorkerContext(response.workerId, {
        input,
        response,
        context: context.currentTask
      });
    }
    
    await this.handleResponse(response);
  }
}
```

## What We're NOT Doing

1. **No Terminal Layout Context** - Claude Code doesn't need to know about 70/30 splits
2. **No Tmux Details** - Pane IDs and session management stay in OrchFlow
3. **No Visual Indicators** - Status icons and colors are UI concerns
4. **No Complex Bridges** - Direct, simple context passing

## Key Differences from Original Plan

1. **Leveraging Existing Tools** - Enhanced MCP tools already exist, just need context
2. **Memory Integration** - Using claude-flow's memory tools for persistence
3. **Progressive Enhancement** - Can implement incrementally without breaking current functionality
4. **Focus on Context** - Main gap is providing rich context to existing tools

## Success Metrics

1. **Context Completeness**: MCP tools receive full worker/task context
2. **Command Recognition**: 95%+ accuracy on natural language
3. **Response Time**: <50ms for context generation
4. **Pattern Learning**: Successful commands stored and suggested

## Implementation Priority

1. **Week 1**: Functional Context Provider (Highest Impact)
2. **Week 2**: Dynamic Instructions (Better UX) 
3. **Week 3**: CLAUDE.md Integration + Memory System
4. **Week 4**: Full Integration & Testing

### Critical Note on CLAUDE.md

**Current Problem**: OrchFlow has no postinstall script, so CLAUDE.md only contains claude-flow instructions. Workers spawned by OrchFlow don't know about OrchFlow patterns.

**Installation Sequence Conflict**:
```bash
npm install -g claude-flow              # Writes CLAUDE.md with swarm patterns
npm install -g @orchflow/claude-flow    # NO postinstall - doesn't modify CLAUDE.md
orchflow                                # Workers get claude-flow CLAUDE.md only
```

**Required Solutions**:
1. **Add postinstall script** to append OrchFlow section to CLAUDE.md
2. **Runtime augmentation** when OrchFlow terminal starts
3. **Worker context injection** when spawning workers
4. **Conflict detection** to avoid duplicate OrchFlow sections

## Missing Implementation Details

### Package.json Updates Needed
```json
{
  "scripts": {
    "postinstall": "node scripts/setup-claude-md.js"
  }
}
```

### Required New Files
- `/src/context/functional-context.ts` - Context provider
- `/src/instructions/dynamic-instructions.ts` - Instruction generator
- `/src/context/memory-context.ts` - Memory persistence
- `/src/context/claude-md-manager.ts` - CLAUDE.md management
- `/scripts/setup-claude-md.js` - Postinstall script

## Conclusion

The core infrastructure exists - we just need to enrich the context passed to MCP tools and provide dynamic instructions based on current state. This simplified approach leverages existing enhanced MCP tools while adding the missing context layer.