# Terminal Manager Enhancement Recommendations

## Executive Summary

Based on analysis of OpenCode's architecture and orchflow's unified architecture design, this document outlines prioritized recommendations for enhancing orchflow's terminal manager system. These enhancements align with the desktop-focused development phase while preparing for future web deployment. The recommendations emphasize AI-driven orchestration, visual agent separation in tmux panes, and seamless integration with the planned ruv-FANN runtime.

**Important**: For clear component responsibilities and implementation locations, see [COMPONENT_RESPONSIBILITIES.md](./COMPONENT_RESPONSIBILITIES.md). This document defines exactly which tasks belong in the Manager (Rust), Orchestrator (TypeScript), or Frontend (Svelte).

## Priority 1: Core Terminal Intelligence with AI Integration (Week 1-2)

### 1.1 Terminal Type System & Agent Metadata

**What to implement:**
- Add terminal metadata to track AI agent purpose and capabilities
- Support visual agent separation in tmux panes as per unified architecture
- Enable orchestrator to route tasks to appropriate agent terminals
- Prepare for ruv-FANN integration

**Implementation Locations:**
- **Manager (Rust)**: `frontend/src-tauri/src/terminal_stream/types.rs` - Define metadata structures
- **Orchestrator (TS)**: `orchestrator/src/agents/terminal-metadata.ts` - Define context interfaces
- **Frontend**: `frontend/src/lib/components/Terminal.svelte` - Display agent metadata

**Technical approach:**

```rust
// src-tauri/src/terminal_stream/types.rs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalMetadata {
    pub purpose: TerminalPurpose,
    pub agent_role: Option<String>, // AI agent role (Architect, Frontend Dev, etc.)
    pub agent_id: Option<String>,   // Link to orchestrator agent
    pub language: Option<String>,
    pub framework: Option<String>,
    pub capabilities: Vec<String>,
    pub working_directory: PathBuf,
    pub environment: HashMap<String, String>,
    pub tmux_pane_id: Option<String>, // For visual separation
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TerminalPurpose {
    Build,
    Test,
    Repl,
    Debug,
    General,
    AIAgent(String), // AI-driven agent terminal
    SwarmMonitor,    // Overview terminal for swarm coordination
    Custom(String),
}

// Update TerminalInstance in terminal_stream/mod.rs
pub struct TerminalInstance {
    pub id: String,
    pub pty: Arc<Mutex<Box<dyn MasterPty>>>,
    pub metadata: TerminalMetadata, // NEW
    // ... existing fields
}
```

```typescript
// orchestrator/src/agents/terminal-metadata.ts
export interface TerminalContext {
  purpose: 'build' | 'test' | 'repl' | 'debug' | 'general' | 'ai-agent' | 'swarm-monitor';
  agentRole?: string; // Architect, Frontend Dev, TypeScript Expert, etc.
  agentId?: string;   // Unique agent identifier
  language?: string;
  framework?: string;
  recentCommands: string[];
  errorPatterns: string[];
  tmuxPaneId?: string; // Visual pane identifier
}

// Enhanced AgentRouter for AI swarm coordination
export class AISwarmRouter extends AgentRouter {
  async routeToSwarmAgent(command: string, task: SwarmTask): Promise<Agent> {
    // Find or create agent for specific role
    const agent = await this.getOrCreateAgent(task.requiredRole);
    
    // Ensure agent has dedicated tmux pane
    if (!agent.tmuxPaneId) {
      agent.tmuxPaneId = await this.createAgentPane(agent);
    }
    
    // Route command to agent's terminal
    return agent;
  }
  
  async visualizeSwarm(swarmId: string): Promise<SwarmVisualization> {
    const agents = await this.getSwarmAgents(swarmId);
    return {
      gridLayout: this.calculateOptimalGrid(agents.length),
      agents: agents.map(a => ({
        paneId: a.tmuxPaneId,
        role: a.role,
        status: a.status,
        progress: a.taskProgress
      }))
    };
  }
}
```

### 1.2 Configurable Shell Execution

**What to implement:**
- Support for `.orchflow.json` configuration
- Custom shell paths and initialization arguments
- Per-project shell preferences

**Technical approach:**

```rust
// src-tauri/src/config/shell_config.rs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellConfig {
    pub path: PathBuf,
    pub args: Vec<String>,
    pub env: HashMap<String, String>,
    pub init_commands: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrchflowConfig {
    pub shell: Option<ShellConfig>,
    pub terminal_defaults: Option<TerminalDefaults>,
    pub workspace_settings: Option<WorkspaceSettings>,
}

impl OrchflowConfig {
    pub fn load_from_workspace(workspace_path: &Path) -> Result<Self, OrchflowError> {
        let config_path = workspace_path.join(".orchflow.json");
        if config_path.exists() {
            let content = fs::read_to_string(&config_path)?;
            Ok(serde_json::from_str(&content)?)
        } else {
            Ok(Self::default())
        }
    }
}

// Update PtyManager to use ShellConfig
impl PtyManager {
    pub fn create_terminal_with_config(
        &self,
        config: &ShellConfig,
        metadata: TerminalMetadata,
    ) -> Result<String, OrchflowError> {
        let mut cmd = CommandBuilder::new(&config.path);
        cmd.args(&config.args);
        
        for (key, value) in &config.env {
            cmd.env(key, value);
        }
        
        let pty_pair = self.create_pty()?;
        let child = pty_pair.slave.spawn_command(cmd)?;
        
        // Store with metadata
        let terminal = TerminalInstance {
            id: Uuid::new_v4().to_string(),
            pty: Arc::new(Mutex::new(Box::new(pty_pair.master))),
            metadata,
            child: Arc::new(Mutex::new(child)),
            // ... other fields
        };
        
        self.instances.lock().unwrap().insert(terminal.id.clone(), terminal);
        Ok(terminal.id)
    }
}
```

### 1.3 AI-Aware Command Routing & Swarm Coordination

**What to implement:**
- Intent parsing aligned with AI agent roles
- Swarm-aware terminal selection
- Integration with ruv-FANN cognitive patterns
- Visual swarm monitoring support

**Technical approach:**

```typescript
// orchestrator/src/core/ai-command-intent.ts
export class AICommandIntentParser {
  private patterns: Map<string, TerminalPurpose> = new Map([
    [/^(npm|yarn|pnpm) (test|run test)/, 'test'],
    [/^(cargo test|go test|pytest)/, 'test'],
    [/^(npm|yarn|pnpm) (build|run build)/, 'build'],
    [/^(cargo build|go build|make)/, 'build'],
    [/^(node|python|ruby|cargo run)/, 'repl'],
    [/^(gdb|lldb|delve)/, 'debug'],
  ]);
  
  private agentPatterns: Map<RegExp, string> = new Map([
    [/^analyze|architect|design/, 'Architect'],
    [/^implement.*frontend|react|vue|svelte/, 'Frontend Dev'],
    [/^type|typescript|interface/, 'TypeScript Expert'],
    [/^test|jest|vitest|pytest/, 'Test Engineer'],
    [/^build|webpack|vite|rollup/, 'Build Engineer'],
  ]);

  async parseIntent(command: string, swarmContext?: SwarmContext): Promise<CommandIntent> {
    // Check if this is for a specific AI agent
    if (swarmContext?.isActive) {
      for (const [pattern, role] of this.agentPatterns) {
        if (pattern.test(command.toLowerCase())) {
          return {
            purpose: 'ai-agent',
            agentRole: role,
            confidence: 0.95,
            suggestedTerminal: await this.findAgentTerminal(role, swarmContext),
          };
        }
      }
    }
    
    // Fall back to standard patterns
    for (const [pattern, purpose] of this.patterns) {
      if (pattern.test(command)) {
        return {
          purpose,
          confidence: 0.9,
          suggestedTerminal: await this.findBestTerminal(purpose),
        };
      }
    }
    
    // Use AI to infer intent
    return this.inferFromAI(command, swarmContext);
  }
}

// Enhanced terminal pool with intent matching
export class SmartTerminalPool extends TerminalPool {
  async acquireForIntent(intent: CommandIntent): Promise<TerminalSession> {
    // Try to find matching terminal
    const existing = this.terminals.find(t => 
      t.metadata.purpose === intent.purpose &&
      t.isHealthy() &&
      !t.isBusy()
    );
    
    if (existing) {
      return this.prepareForReuse(existing, intent);
    }
    
    // Create specialized terminal
    return this.createSpecialized(intent);
  }
}
```

## Priority 2: Enhanced Process Management (Week 2-3)

### 2.1 Process Registry with Health Monitoring

**Note**: The Event Bus implementation should be lightweight for desktop phase. Full distributed event bus (NATS/Redis) only needed for web deployment.

**What to implement:**
- Centralized process registry
- Proactive health monitoring
- Automatic recovery mechanisms

**Technical approach:**

```rust
// src-tauri/src/terminal_stream/process_registry.rs
pub struct ProcessRegistry {
    processes: Arc<RwLock<HashMap<String, ProcessInfo>>>,
    health_checker: Arc<HealthChecker>,
    event_bus: Arc<EventBus>,
}

#[derive(Debug, Clone)]
pub struct ProcessInfo {
    pub terminal_id: String,
    pub pid: u32,
    pub metadata: TerminalMetadata,
    pub health: HealthStatus,
    pub started_at: DateTime<Utc>,
    pub last_activity: DateTime<Utc>,
    pub resource_usage: ResourceMetrics,
}

#[derive(Debug, Clone)]
pub struct HealthStatus {
    pub is_responsive: bool,
    pub error_count: u32,
    pub last_error: Option<String>,
    pub recovery_attempts: u32,
    pub health_score: f64, // 0.0 to 1.0
}

impl ProcessRegistry {
    pub async fn monitor_health(&self) {
        let mut interval = tokio::time::interval(Duration::from_secs(5));
        
        loop {
            interval.tick().await;
            
            let processes = self.processes.read().await;
            for (id, info) in processes.iter() {
                if let Err(e) = self.check_process_health(id, info).await {
                    self.handle_unhealthy_process(id, e).await;
                }
            }
        }
    }
    
    async fn check_process_health(&self, id: &str, info: &ProcessInfo) -> Result<(), HealthError> {
        // Check if process is still alive
        if !self.is_process_alive(info.pid)? {
            return Err(HealthError::ProcessDead);
        }
        
        // Check responsiveness (send echo command)
        if !self.check_responsiveness(id).await? {
            return Err(HealthError::Unresponsive);
        }
        
        // Check resource usage
        if info.resource_usage.memory_mb > 1000 {
            return Err(HealthError::ExcessiveMemory);
        }
        
        Ok(())
    }
}
```

### 2.2 Event Bus Architecture

**What to implement:**
- Decoupled event system for component communication
- Type-safe event definitions
- Event replay and debugging capabilities

**Technical approach:**

```rust
// src-tauri/src/events/event_bus.rs
pub struct EventBus {
    subscribers: Arc<RwLock<HashMap<String, Vec<EventSubscriber>>>>,
    event_log: Arc<RwLock<VecDeque<Event>>>,
    max_log_size: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TerminalEvent {
    Created { id: String, metadata: TerminalMetadata },
    OutputReceived { id: String, data: Vec<u8> },
    CommandExecuted { id: String, command: String },
    HealthChanged { id: String, old: HealthStatus, new: HealthStatus },
    Recycled { id: String, old_purpose: TerminalPurpose, new_purpose: TerminalPurpose },
}

impl EventBus {
    pub async fn publish(&self, event: TerminalEvent) {
        // Log event
        self.log_event(&event).await;
        
        // Notify subscribers
        let event_type = event.type_name();
        if let Some(subscribers) = self.subscribers.read().await.get(&event_type) {
            for subscriber in subscribers {
                if let Err(e) = subscriber.handle(event.clone()).await {
                    error!("Subscriber error: {:?}", e);
                }
            }
        }
        
        // Emit to frontend via Tauri
        if let Some(app) = APP_HANDLE.get() {
            let _ = app.emit_all("terminal-event", &event);
        }
    }
}
```

```typescript
// frontend/src/lib/services/terminal-events.ts
export class TerminalEventBus {
  private subscribers = new Map<string, Set<EventHandler>>();
  
  constructor() {
    // Listen to Tauri events
    listen<TerminalEvent>('terminal-event', (event) => {
      this.dispatch(event.payload);
    });
  }
  
  subscribe(eventType: string, handler: EventHandler): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    
    this.subscribers.get(eventType)!.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.get(eventType)?.delete(handler);
    };
  }
  
  private dispatch(event: TerminalEvent) {
    const handlers = this.subscribers.get(event.type);
    handlers?.forEach(handler => handler(event));
  }
}
```

## Priority 2.5: AI Swarm Integration (Critical for Unified Architecture)

### Tmux-Based Visual Agent Separation

**What to implement:**
- Create dedicated tmux sessions for AI swarms
- Visual grid layout for agent terminals
- Real-time swarm monitoring interface
- Integration with SwarmMonitor.svelte component

**Implementation Locations:**
- **Manager (Rust)**: `frontend/src-tauri/src/swarm/visual_swarm.rs` - Tmux session management
- **Orchestrator (TS)**: `orchestrator/src/swarm/coordinator.ts` - Agent assignment logic
- **Frontend**: `frontend/src/lib/components/SwarmMonitor.svelte` - Grid visualization

**Technical approach:**

```rust
// src-tauri/src/swarm/visual_swarm.rs
pub struct VisualSwarm {
    session_id: String,
    tmux_session: String,
    agents: HashMap<String, SwarmAgent>,
    layout: SwarmLayout,
}

#[derive(Debug, Clone)]
pub struct SwarmAgent {
    id: String,
    role: String,
    pane_id: String,
    terminal_id: String,
    status: AgentStatus,
}

impl VisualSwarm {
    pub async fn create_swarm_session(
        &mut self,
        task: &str,
        agent_count: usize,
    ) -> Result<String, OrchflowError> {
        // Create dedicated tmux session for swarm
        let session_name = format!("swarm-{}", Uuid::new_v4());
        self.backend.create_session(&session_name).await?;
        
        // Calculate optimal grid layout
        let layout = self.calculate_grid_layout(agent_count);
        
        // Create panes for each agent
        for i in 0..agent_count {
            let pane = self.create_agent_pane(&session_name, i, &layout).await?;
            let agent = SwarmAgent {
                id: Uuid::new_v4().to_string(),
                role: self.determine_agent_role(task, i),
                pane_id: pane.id,
                terminal_id: pane.terminal_id,
                status: AgentStatus::Initializing,
            };
            self.agents.insert(agent.id.clone(), agent);
        }
        
        Ok(session_name)
    }
    
    fn calculate_grid_layout(&self, count: usize) -> SwarmLayout {
        match count {
            1 => SwarmLayout::Single,
            2 => SwarmLayout::Horizontal,
            3..=4 => SwarmLayout::Grid2x2,
            5..=6 => SwarmLayout::Grid2x3,
            _ => SwarmLayout::Grid3x3,
        }
    }
}
```

```typescript
// frontend/src/lib/components/SwarmMonitor.svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { swarmStore } from '$lib/stores/swarm';
  import Terminal from './Terminal.svelte';
  
  export let swarmId: string;
  
  let agents: SwarmAgent[] = [];
  let layout: 'grid' | 'focus' = 'grid';
  let focusedAgent: string | null = null;
  
  $: gridClass = calculateGridClass(agents.length);
  
  function calculateGridClass(count: number): string {
    if (count <= 2) return 'grid-cols-2';
    if (count <= 4) return 'grid-cols-2 grid-rows-2';
    if (count <= 6) return 'grid-cols-3 grid-rows-2';
    return 'grid-cols-3 grid-rows-3';
  }
  
  async function handleAgentClick(agentId: string) {
    if (layout === 'focus') {
      focusedAgent = agentId;
    }
  }
</script>

<div class="swarm-monitor h-full">
  <div class="swarm-header p-4 border-b">
    <h2 class="text-xl font-bold">Swarm: {swarmId}</h2>
    <div class="flex gap-4 mt-2">
      <span class="text-sm">
        🔄 Active | {agents.length} Agents | {$swarmStore.progress}% Complete
      </span>
      <button on:click={() => layout = layout === 'grid' ? 'focus' : 'grid'}>
        {layout === 'grid' ? '🔍 Focus Mode' : '⚏ Grid Mode'}
      </button>
    </div>
  </div>
  
  <div class="swarm-grid p-4 grid {gridClass} gap-4 h-full">
    {#each agents as agent}
      <div class="agent-pane border rounded-lg overflow-hidden"
           class:focused={focusedAgent === agent.id}
           on:click={() => handleAgentClick(agent.id)}>
        <div class="agent-header bg-gray-100 p-2">
          <span class="font-medium">{agent.role}</span>
          <span class="text-sm ml-2">{agent.status}</span>
        </div>
        <div class="agent-terminal h-full">
          <Terminal 
            terminalId={agent.terminalId}
            paneId={agent.paneId}
            readOnly={false}
          />
        </div>
      </div>
    {/each}
  </div>
</div>
</script>
```

## Priority 3: Intelligent Terminal Orchestration (Week 3-4)

### 3.1 Workspace Context Management

**What to implement:**
- Project type detection
- Active file tracking
- Command history analysis

**Technical approach:**

```rust
// src-tauri/src/workspace/context.rs
pub struct WorkspaceContextManager {
    project_analyzer: ProjectAnalyzer,
    file_watcher: FileWatcher,
    command_history: CommandHistory,
}

impl WorkspaceContextManager {
    pub async fn analyze_workspace(&self, path: &Path) -> Result<WorkspaceContext, OrchflowError> {
        let project_type = self.project_analyzer.detect_type(path)?;
        let dependencies = self.project_analyzer.analyze_dependencies(path)?;
        let active_files = self.file_watcher.get_recently_modified(Duration::hours(1))?;
        
        Ok(WorkspaceContext {
            project_type,
            languages: self.detect_languages(&active_files),
            frameworks: self.detect_frameworks(&dependencies),
            recent_commands: self.command_history.get_recent(20),
            suggested_terminals: self.suggest_terminals(&project_type),
        })
    }
    
    fn suggest_terminals(&self, project_type: &ProjectType) -> Vec<TerminalSuggestion> {
        match project_type {
            ProjectType::Node => vec![
                TerminalSuggestion {
                    purpose: TerminalPurpose::Build,
                    command: "npm run build",
                    description: "Build the project",
                },
                TerminalSuggestion {
                    purpose: TerminalPurpose::Test,
                    command: "npm test -- --watch",
                    description: "Run tests in watch mode",
                },
            ],
            ProjectType::Rust => vec![
                TerminalSuggestion {
                    purpose: TerminalPurpose::Build,
                    command: "cargo watch -x build",
                    description: "Watch and build",
                },
                TerminalSuggestion {
                    purpose: TerminalPurpose::Test,
                    command: "cargo watch -x test",
                    description: "Watch and test",
                },
            ],
            // ... other project types
        }
    }
}
```

### 3.2 Terminal Recycling & Reuse

**What to implement:**
- Context-aware terminal recycling
- Smart cleanup and preparation
- Terminal state preservation

**Technical approach:**

```typescript
// orchestrator/src/core/terminal-recycler.ts
export class TerminalRecycler {
  async recycle(
    terminal: TerminalSession,
    newContext: TerminalContext
  ): Promise<TerminalSession> {
    // Clear previous state
    await this.clearTerminal(terminal);
    
    // Update metadata
    terminal.metadata = {
      ...terminal.metadata,
      ...newContext,
      recycledAt: new Date(),
      previousPurpose: terminal.metadata.purpose,
    };
    
    // Prepare for new purpose
    await this.prepareForPurpose(terminal, newContext.purpose);
    
    // Emit recycled event
    this.eventBus.emit('terminal.recycled', {
      terminalId: terminal.id,
      oldPurpose: terminal.metadata.previousPurpose,
      newPurpose: newContext.purpose,
    });
    
    return terminal;
  }
  
  private async prepareForPurpose(
    terminal: TerminalSession,
    purpose: TerminalPurpose
  ): Promise<void> {
    const preparations = {
      test: ['clear', 'echo "Test terminal ready"'],
      build: ['clear', 'echo "Build terminal ready"'],
      repl: ['clear'],
      debug: ['clear', 'echo "Debug terminal ready"'],
    };
    
    const commands = preparations[purpose] || ['clear'];
    for (const cmd of commands) {
      await terminal.sendInput(cmd + '\n');
    }
  }
}
```

### 3.3 Multi-Terminal Workflows

**What to implement:**
- Workflow definition system
- Parallel execution coordination
- Result aggregation

**Technical approach:**

```typescript
// orchestrator/src/workflows/workflow-engine.ts
export interface WorkflowDefinition {
  name: string;
  steps: WorkflowStep[];
  parallel: boolean;
  continueOnError: boolean;
}

export interface WorkflowStep {
  id: string;
  terminalPurpose: TerminalPurpose;
  commands: string[];
  expectedOutputPattern?: RegExp;
  timeout?: number;
  dependsOn?: string[];
}

export class WorkflowEngine {
  async executeWorkflow(
    definition: WorkflowDefinition
  ): Promise<WorkflowResult> {
    const executor = definition.parallel
      ? this.executeParallel
      : this.executeSequential;
      
    const steps = this.topologicalSort(definition.steps);
    const results = await executor.call(this, steps);
    
    return {
      success: results.every(r => r.success),
      duration: this.calculateDuration(results),
      steps: results,
    };
  }
  
  private async executeParallel(
    steps: WorkflowStep[]
  ): Promise<StepResult[]> {
    const terminals = await Promise.all(
      steps.map(step => this.terminalPool.acquireForIntent({
        purpose: step.terminalPurpose,
        commands: step.commands,
      }))
    );
    
    const results = await Promise.allSettled(
      steps.map((step, index) => 
        this.executeStep(step, terminals[index])
      )
    );
    
    return results.map(r => 
      r.status === 'fulfilled' ? r.value : this.errorResult(r.reason)
    );
  }
}
```

## Priority 4: Command Intelligence (Week 4-5)

### 4.1 Command Prediction & Suggestions

**What to implement:**
- Frecency-based suggestions
- Context-aware predictions
- Command templates

**Technical approach:**

```rust
// src-tauri/src/commands/prediction.rs
pub struct CommandPredictor {
    history: Arc<CommandHistory>,
    templates: Arc<CommandTemplates>,
    context_analyzer: Arc<ContextAnalyzer>,
}

impl CommandPredictor {
    pub async fn get_suggestions(
        &self,
        input: &str,
        context: &WorkspaceContext,
        limit: usize,
    ) -> Vec<CommandSuggestion> {
        let mut suggestions = Vec::new();
        
        // Frecency-based suggestions from history
        let historical = self.history
            .get_frecent_matches(input, context)
            .await?;
        suggestions.extend(historical);
        
        // Template-based suggestions
        let templates = self.templates
            .get_matching_templates(input, context)
            .await?;
        suggestions.extend(templates);
        
        // Context-aware predictions
        let predicted = self.predict_next_commands(context).await?;
        suggestions.extend(predicted);
        
        // Deduplicate and sort by score
        self.deduplicate_and_rank(suggestions, limit)
    }
    
    async fn predict_next_commands(
        &self,
        context: &WorkspaceContext,
    ) -> Result<Vec<CommandSuggestion>, OrchflowError> {
        // Analyze recent file changes
        let changed_files = context.recent_file_changes();
        
        // Predict based on patterns
        let mut predictions = Vec::new();
        
        if changed_files.iter().any(|f| f.ends_with(".rs")) {
            predictions.push(CommandSuggestion {
                command: "cargo check".to_string(),
                score: 0.8,
                reason: "Rust files changed".to_string(),
            });
        }
        
        if changed_files.iter().any(|f| f.ends_with("test.ts")) {
            predictions.push(CommandSuggestion {
                command: "npm test".to_string(),
                score: 0.9,
                reason: "Test files changed".to_string(),
            });
        }
        
        Ok(predictions)
    }
}
```

### 4.2 Command Templates

**What to implement:**
- Project-specific command templates
- Variable substitution
- Template sharing

**Technical approach:**

```typescript
// frontend/src/lib/services/command-templates.ts
export interface CommandTemplate {
  id: string;
  name: string;
  description: string;
  command: string;
  variables: TemplateVariable[];
  tags: string[];
  projectTypes: ProjectType[];
}

export class CommandTemplateService {
  private templates = new Map<string, CommandTemplate>();
  
  async loadTemplates(): Promise<void> {
    // Load built-in templates
    const builtIn = await this.loadBuiltInTemplates();
    
    // Load user templates
    const user = await this.loadUserTemplates();
    
    // Load project templates
    const project = await this.loadProjectTemplates();
    
    // Merge all templates
    [...builtIn, ...user, ...project].forEach(t => 
      this.templates.set(t.id, t)
    );
  }
  
  async executeTemplate(
    templateId: string,
    variables: Record<string, string>
  ): Promise<string> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }
    
    // Substitute variables
    let command = template.command;
    for (const [key, value] of Object.entries(variables)) {
      command = command.replace(`{{${key}}}`, value);
    }
    
    return command;
  }
}
```

## Priority 4.5: Manager-Orchestrator Bridge (Critical Path)

### JSON-RPC Communication Layer

**What to implement:**
- Bidirectional communication between Rust Manager and TypeScript Orchestrator
- Terminal lifecycle events for AI coordination
- Swarm session management protocol
- Real-time agent status updates

**Implementation Locations:**
- **Manager (Rust)**: `frontend/src-tauri/src/bridge/orchestrator_bridge.rs` - RPC client
- **Orchestrator (TS)**: `orchestrator/src/bridge/manager-bridge.ts` - RPC server
- **Shared Protocol**: Document in `docs/bridge-protocol.md`

**Technical approach:**

```rust
// src-tauri/src/bridge/orchestrator_bridge.rs
pub struct OrchestratorBridge {
    rpc_client: JsonRpcClient,
    event_bus: Arc<EventBus>,
    swarm_sessions: Arc<RwLock<HashMap<String, SwarmSession>>>,
}

impl OrchestratorBridge {
    pub async fn notify_terminal_created(
        &self,
        terminal_id: &str,
        metadata: &TerminalMetadata,
    ) -> Result<(), OrchflowError> {
        // Notify orchestrator of new terminal
        let params = json!({
            "terminalId": terminal_id,
            "metadata": metadata,
            "timestamp": Utc::now(),
        });
        
        self.rpc_client.notify("terminal.created", params).await?;
        
        // If this is an AI agent terminal, register with swarm
        if let TerminalPurpose::AIAgent(role) = &metadata.purpose {
            self.register_agent_terminal(terminal_id, role).await?;
        }
        
        Ok(())
    }
    
    pub async fn create_swarm(
        &self,
        task: &str,
        config: SwarmConfig,
    ) -> Result<String, OrchflowError> {
        // Request swarm creation from orchestrator
        let result = self.rpc_client.call("swarm.create", json!({
            "task": task,
            "config": config,
        })).await?;
        
        let swarm_id = result["swarmId"].as_str()
            .ok_or(OrchflowError::InvalidResponse)?;
            
        // Create visual swarm session
        let visual_swarm = VisualSwarm::new(swarm_id, &config);
        let session_name = visual_swarm.create_swarm_session(task, config.agent_count).await?;
        
        // Store swarm session
        self.swarm_sessions.write().await.insert(
            swarm_id.to_string(),
            SwarmSession {
                id: swarm_id.to_string(),
                tmux_session: session_name,
                visual_swarm,
                created_at: Utc::now(),
            }
        );
        
        Ok(swarm_id.to_string())
    }
}

// Tauri commands for frontend
#[tauri::command]
pub async fn create_ai_swarm(
    task: String,
    agent_count: Option<usize>,
    state: State<'_, AppState>,
) -> Result<SwarmInfo, String> {
    let bridge = state.orchestrator_bridge.lock().await;
    
    let config = SwarmConfig {
        agent_count: agent_count.unwrap_or(5),
        max_tokens: 100000,
        parallel_execution: true,
    };
    
    let swarm_id = bridge.create_swarm(&task, config).await
        .map_err(|e| e.to_string())?;
        
    Ok(SwarmInfo {
        swarm_id,
        status: "initializing".to_string(),
        agent_count: config.agent_count,
    })
}
```

```typescript
// orchestrator/src/bridge/manager-bridge.ts
export class ManagerBridge {
  private rpcServer: JsonRpcServer;
  private terminalRegistry: Map<string, ManagedTerminal> = new Map();
  
  constructor(private orchestrator: Orchestrator) {
    this.rpcServer = new JsonRpcServer();
    this.setupHandlers();
  }
  
  private setupHandlers() {
    // Handle terminal lifecycle events
    this.rpcServer.on('terminal.created', async (params) => {
      const { terminalId, metadata } = params;
      
      if (metadata.purpose === 'ai-agent' && metadata.agentId) {
        // Link terminal to AI agent
        const agent = this.orchestrator.getAgent(metadata.agentId);
        if (agent) {
          agent.attachTerminal(terminalId, metadata);
        }
      }
      
      this.terminalRegistry.set(terminalId, {
        id: terminalId,
        metadata,
        createdAt: new Date(),
      });
    });
    
    // Handle swarm creation requests
    this.rpcServer.method('swarm.create', async (params) => {
      const { task, config } = params;
      
      // Create AI swarm
      const swarm = await this.orchestrator.createSwarm(task, config);
      
      // Wait for agents to be ready
      await swarm.waitForReady();
      
      return {
        swarmId: swarm.id,
        agents: swarm.agents.map(a => ({
          id: a.id,
          role: a.role,
          terminalId: a.terminalId,
        })),
      };
    });
  }
}
```

## Priority 5: Advanced Features (Week 5-6)

### 5.1 MCP (Model Context Protocol) Integration

**What to implement:**
- MCP server management
- Context provider integration
- AI-enhanced terminal operations

**Technical approach:**

```rust
// src-tauri/src/mcp/mod.rs
pub struct McpManager {
    servers: Arc<RwLock<HashMap<String, McpServer>>>,
    config: McpConfig,
}

pub struct McpServer {
    id: String,
    process: Child,
    transport: McpTransport,
    capabilities: Vec<String>,
}

impl McpManager {
    pub async fn start_server(
        &self,
        config: &McpServerConfig,
    ) -> Result<String, OrchflowError> {
        let child = Command::new(&config.command)
            .args(&config.args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()?;
            
        let transport = McpTransport::new(child.stdout, child.stdin);
        let capabilities = transport.initialize().await?;
        
        let server = McpServer {
            id: Uuid::new_v4().to_string(),
            process: child,
            transport,
            capabilities,
        };
        
        self.servers.write().await.insert(server.id.clone(), server);
        Ok(server.id)
    }
    
    pub async fn get_context(
        &self,
        server_id: &str,
        query: &str,
    ) -> Result<McpContext, OrchflowError> {
        let servers = self.servers.read().await;
        let server = servers.get(server_id)
            .ok_or(OrchflowError::McpServerNotFound)?;
            
        server.transport.request_context(query).await
    }
}
```

### 5.2 Performance Monitoring Dashboard

**What to implement:**
- Real-time metrics collection
- Terminal performance analytics
- Resource usage visualization

**Technical approach:**

```typescript
// frontend/src/lib/components/PerformanceMonitor.svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart } from 'chart.js';
  import { terminalMetrics } from '$lib/stores/metrics';
  
  let cpuChart: Chart;
  let memoryChart: Chart;
  let latencyChart: Chart;
  
  onMount(() => {
    // Subscribe to metrics updates
    const unsubscribe = terminalMetrics.subscribe(metrics => {
      updateCharts(metrics);
    });
    
    // Initialize charts
    initializeCharts();
    
    return unsubscribe;
  });
  
  function initializeCharts() {
    cpuChart = new Chart(cpuCanvas, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'CPU Usage %',
          data: [],
          borderColor: 'rgb(75, 192, 192)',
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true, max: 100 }
        }
      }
    });
    // ... initialize other charts
  }
</script>
```

## Implementation Timeline (Aligned with Unified Architecture)

### Week 1-2: Core Terminal Intelligence & AI Foundation
- [ ] Implement terminal metadata system with AI agent support
- [ ] Add configurable shell execution (.orchflow.json)
- [ ] Build AI-aware command routing
- [ ] Create SwarmAgent terminal type

### Week 2-3: Visual Swarm Integration
- [ ] Implement tmux-based visual agent separation
- [ ] Create SwarmMonitor.svelte component
- [ ] Build grid layout system for agent panes
- [ ] Add real-time agent status updates

### Week 3-4: Manager-Orchestrator Bridge
- [ ] Implement JSON-RPC communication layer
- [ ] Create orchestrator bridge in Rust
- [ ] Build manager bridge in TypeScript
- [ ] Add swarm lifecycle management

### Week 4-5: Enhanced Process & Event Management
- [ ] Create process registry with health monitoring
- [ ] Implement event bus for AI coordination
- [ ] Add automatic recovery for agent terminals
- [ ] Build inter-agent communication system

### Week 5-6: Advanced AI Features
- [ ] Integrate MCP support for AI context
- [ ] Add ruv-FANN preparation hooks
- [ ] Create command adapter system
- [ ] Build performance monitoring for swarms

## Repository Structure Changes

### New Directories Required
```
frontend/src-tauri/src/
├── bridge/              # Manager-Orchestrator communication
├── swarm/               # AI swarm visual management  
└── event_bus/          # Lightweight event coordination

orchestrator/src/
├── bridge/              # Manager communication handlers
└── swarm/               # Visual swarm coordination
```

### File Organization
- Keep terminal streaming in `terminal_stream/`
- Move swarm-specific code to `swarm/`
- Centralize IPC handling in `bridge/`

## Testing Strategy

**See [COMPONENT_RESPONSIBILITIES.md](./COMPONENT_RESPONSIBILITIES.md) for detailed testing locations and strategies.**

### Manager Tests (Rust) - `frontend/src-tauri/`
```bash
cargo test                    # Unit tests
cargo test --test integration # Integration tests
./run_test_coverage.sh       # Coverage report
```

### Orchestrator Tests (TypeScript) - `orchestrator/`
```bash
npm test                     # All tests
npm run test:unit           # Unit tests
npm run test:swarm          # Swarm-specific tests
```

### Frontend Tests (Svelte) - `frontend/`
```bash
npm run test:unit           # Component tests
npm run test:integration    # UI integration
npm run test:e2e           # Browser tests
```

### Cross-Component Integration Tests
- Manager ↔ Orchestrator bridge communication
- End-to-end swarm creation flow
- Terminal lifecycle with AI agents
- Health monitoring and recovery

## Migration Path

1. **Phase 1**: Implement new features alongside existing code
2. **Phase 2**: Gradually migrate existing terminals to new system
3. **Phase 3**: Update frontend components to use new APIs
4. **Phase 4**: Deprecate old terminal management code
5. **Phase 5**: Remove legacy code after validation

## Success Metrics

- **Terminal creation time**: <50ms
- **Command routing accuracy**: >95%
- **Terminal reuse rate**: >70%
- **Health check overhead**: <1% CPU
- **Memory per terminal**: <10MB
- **Workflow execution reliability**: >99%

## Risks & Mitigation

### Risk 1: Performance Regression
- **Mitigation**: Continuous benchmarking, feature flags for rollback

### Risk 2: Breaking Changes
- **Mitigation**: Backwards compatibility layer, gradual migration

### Risk 3: Complexity Increase
- **Mitigation**: Clear documentation, modular design, code reviews

## Architectural Alignment Summary

### Key Differences from Original Recommendations

1. **AI-First Design**: All terminal enhancements now support the AI swarm architecture
2. **Visual Agent Separation**: Tmux panes provide clear visibility into agent operations
3. **Manager-Orchestrator Bridge**: Critical new component for AI coordination
4. **Swarm-Aware Terminal Types**: New terminal purposes for AI agents and monitoring
5. **Event-Driven AI Coordination**: Event bus designed for agent communication

### Integration with Unified Architecture

The enhanced terminal manager serves as the foundation for orchflow's AI-driven experience:

1. **Natural AI Interaction**: Users chat while agents work in visible terminals
2. **Visual Clarity**: Every agent gets its own tmux pane in the swarm grid
3. **Intelligent Orchestration**: Terminal metadata enables smart task routing
4. **Performance**: Process pooling and health monitoring ensure reliability
5. **Extensibility**: Command adapters support claude-flow and other AI tools

### Critical Success Factors

1. **Tight Integration**: Manager and Orchestrator must communicate seamlessly
2. **Visual Feedback**: SwarmMonitor component must provide real-time updates
3. **Performance**: Agent spawning must be near-instantaneous (<20ms)
4. **Reliability**: Health monitoring prevents zombie agents
5. **Flexibility**: Support for various AI providers through adapters

## Conclusion

These AI-focused enhancements transform orchflow's terminal manager into an intelligent swarm orchestration system. By combining OpenCode's best practices with orchflow's unified architecture vision, we create a unique development environment where AI agents work visually and transparently.

The implementation prioritizes the desktop experience while preparing for future web deployment. Each enhancement builds toward the goal of natural AI interaction with visual agent separation, making complex AI orchestration accessible and debuggable.

The terminal manager becomes not just a tool runner, but an AI swarm conductor - orchestrating multiple specialized agents working in parallel while maintaining clear visual feedback and user control.