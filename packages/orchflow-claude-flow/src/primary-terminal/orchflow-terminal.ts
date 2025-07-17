import { EventEmitter } from 'events';
import { MCPClient } from './mcp-client';
import { ConversationContext } from './conversation-context';
import { OrchestratorClient } from './orchestrator-client';
import { StatusPane } from './status-pane';
import { WorkerAccessManager } from './worker-access-manager';
import { TmuxBackend } from '../tmux-integration/tmux-backend';
import { OrchFlowFunctionalContext } from '../context/functional-context';
import { DynamicInstructionProvider } from '../instructions/dynamic-instructions';
import { OrchFlowMemoryContext } from '../context/memory-context';
import { ClaudeMDManager } from '../context/claude-md-manager';
import { StatusPaneManager } from './status-pane-integration';
import chalk from 'chalk';

export interface OrchFlowTerminalConfig {
  mcpEndpoint: string;
  orchestratorEndpoint: string;
  statusPaneConfig: {
    width: number;
    updateInterval: number;
    showQuickAccess: boolean;
  };
}

export class OrchFlowTerminal extends EventEmitter {
  private mcpClient: MCPClient;
  private conversationContext: ConversationContext;
  private orchestratorClient: OrchestratorClient;
  private statusPane: StatusPane;
  private workerAccessManager: WorkerAccessManager;
  private tmuxBackend: TmuxBackend;
  private contextProvider: OrchFlowFunctionalContext;
  private instructionProvider: DynamicInstructionProvider;
  private memoryContext: OrchFlowMemoryContext;
  private claudeMDManager: ClaudeMDManager;
  private statusPaneManager: StatusPaneManager;
  private sessionId: string = '';
  private primaryPaneId: string = '';
  private statusPaneId: string = '';

  constructor(config: OrchFlowTerminalConfig) {
    super();
    this.mcpClient = new MCPClient(config.mcpEndpoint);
    this.conversationContext = new ConversationContext();
    this.orchestratorClient = new OrchestratorClient(config.orchestratorEndpoint);
    this.tmuxBackend = new TmuxBackend();
    this.statusPane = new StatusPane(this.tmuxBackend);
    this.workerAccessManager = new WorkerAccessManager();
    
    // Initialize missing properties
    this.contextProvider = new OrchFlowFunctionalContext(
      this.orchestratorClient,
      this.conversationContext,
      this.workerAccessManager
    );
    this.instructionProvider = new DynamicInstructionProvider();
    this.memoryContext = new OrchFlowMemoryContext(this.mcpClient);
    this.claudeMDManager = new ClaudeMDManager();
    
    // Initialize status pane manager (will be started after initialization)
    this.statusPaneManager = new StatusPaneManager({
      statusPane: this.statusPane,
      orchestrator: this.orchestratorClient as any,
      performanceMonitor: null as any // Will be set after performance monitor is created
    });
  }

  async initialize(): Promise<void> {
    console.log(chalk.cyan('Initializing OrchFlow Terminal...'));

    // Performance optimization - initialize optimizer first
    const { SetupOptimizer } = await import('../performance/setup-optimizer');
    const optimizer = new SetupOptimizer();
    await optimizer.optimizeSetup();

    // Setup 70/30 split screen layout
    await this.setupSplitScreenLayout();

    // Connect to services
    await this.mcpClient.connect();
    await this.orchestratorClient.connect();

    // Initialize new context providers
    this.contextProvider = new OrchFlowFunctionalContext(
      this.orchestratorClient,
      this.conversationContext,
      this.workerAccessManager
    );
    
    this.instructionProvider = new DynamicInstructionProvider();
    this.memoryContext = new OrchFlowMemoryContext(this.mcpClient);
    this.claudeMDManager = new ClaudeMDManager();

    // Initialize components
    await this.statusPane.initialize(this.statusPaneId);
    await this.setupIntentHandlers();
    await this.setupWorkerAccessShortcuts();
    await this.restoreSession();
    
    // Update CLAUDE.md with OrchFlow context
    await this.updateClaudeMDWithContext();

    // Performance monitoring - start monitoring after initialization
    const { PerformanceMonitor } = await import('../performance/performance-monitor');
    const monitor = new PerformanceMonitor();
    monitor.start(5000); // Monitor every 5 seconds
    
    // Store monitor for cleanup and connect to status pane
    (this as any).performanceMonitor = monitor;
    
    // Connect performance monitor to status pane manager
    this.statusPaneManager['performanceMonitor'] = monitor;
    
    // Start status pane integrations
    await this.statusPaneManager.start();

    console.log(chalk.green('✓ OrchFlow Terminal ready'));
    console.log(chalk.gray('Type your commands in natural language...'));
  }

  private async setupSplitScreenLayout(): Promise<void> {
    // Create 70/30 split screen layout
    const session = await this.tmuxBackend.createSession('orchflow-terminal');
    this.sessionId = session.id;

    // Primary pane is already created, it's 100% width initially
    this.primaryPaneId = session.panes[0].id;

    // Split for status pane (30% width on the right)
    const statusPane = await this.tmuxBackend.splitPane(
      session.id,
      this.primaryPaneId,
      'vertical',
      30 // 30% for status pane
    );

    this.statusPaneId = statusPane.id;

    // Set pane titles
    await this.tmuxBackend.setPaneTitle(this.primaryPaneId, 'OrchFlow Terminal');
    await this.tmuxBackend.setPaneTitle(this.statusPaneId, 'Status & Workers');
  }

  private async setupWorkerAccessShortcuts(): Promise<void> {
    // Setup 1-9 numeric shortcuts for worker access
    for (let i = 1; i <= 9; i++) {
      this.registerShortcut(i.toString(), async () => {
        await this.connectToWorkerByNumber(i);
      });
    }
  }

  private registerShortcut(key: string, handler: () => Promise<void>): void {
    // In a real implementation, this would hook into the terminal input system
    // For now, we'll just store the handlers
    this.on(`shortcut:${key}`, handler);
  }

  private async connectToWorkerByNumber(number: number): Promise<void> {
    const workers = await this.orchestratorClient.listWorkers();
    const targetWorker = workers.find(w => w.quickAccessKey === number);

    if (targetWorker) {
      await this.workerAccessManager.connectToWorker(targetWorker.id);
      await this.updateUI(`Connected to ${targetWorker.descriptiveName}`);
    } else {
      await this.updateUI(`No worker assigned to key ${number}`);
    }
  }

  async processUserInput(input: string): Promise<void> {
    // Check for numeric shortcuts first
    if (input.length === 1 && /^[1-9]$/.test(input)) {
      await this.connectToWorkerByNumber(parseInt(input));
      return;
    }

    // Add to conversation history
    this.conversationContext.addMessage({
      type: 'user',
      content: input,
      timestamp: new Date()
    });

    // Direct natural language processing through MCP tools
    // No pattern matching or keyword requirements

    // For numeric shortcuts (1-9), handle quick access
    if (/^[1-9]$/.test(input)) {
      const workerNumber = parseInt(input);
      await this.handleQuickAccess(workerNumber);
      return;
    }

    // All other input is processed through MCP tools
    // which understand natural language without requiring keywords
    await this.processNaturalLanguageCommand(input);
  }

  private async processNaturalLanguageCommand(input: string): Promise<void> {
    try {
      // Get rich functional context
      const context = await this.contextProvider.getContext(input);
      
      // Get historical suggestions
      const suggestions = await this.memoryContext.suggestBasedOnHistory(input);
      if (suggestions.length > 0) {
        context.historicalSuggestions = suggestions;
      }
      
      // Generate task-specific instructions
      const taskType = this.inferTaskType(input);
      const instructions = this.instructionProvider.generateInstructions(taskType, context);
      
      const response = await this.mcpClient.invokeTool('orchflow_natural_task', {
        naturalLanguageInput: input,
        context: this.conversationContext.getRecentHistory(),
        orchflowContext: context,
        instructions
      });

      if (response.success) {
        await this.updateUI(response.description || 'Command processed successfully');
        
        // Store successful patterns for learning
        await this.memoryContext.storeTaskHistory({
          taskId: response.workerId || `task_${Date.now()}`,
          input,
          taskType,
          assignedWorker: response.workerName || 'Unknown',
          startTime: new Date(),
          status: 'completed',
          successfulCommand: input,
          context: context.currentTask
        });
        
        // Update CLAUDE.md with current context
        await this.updateClaudeMDWithContext();
      } else {
        await this.updateUI(`Error: ${response.error || 'Failed to process command'}`);
      }
    } catch (error) {
      await this.updateUI(`Error processing command: ${error}`);
    }
  }

  private async handleQuickAccess(workerNumber: number): Promise<void> {
    try {
      // Quick access is handled through the orchestrator
      const workers = await this.orchestratorClient.listWorkers();
      const worker = workers.find(w => w.quickAccessKey === workerNumber);
      
      if (worker) {
        await this.workerAccessManager.connectToWorker(worker.id);
        await this.updateUI(`✓ Connected to "${worker.descriptiveName}" [${workerNumber}]`);
      } else {
        await this.updateUI(`No worker assigned to key ${workerNumber}`);
      }
    } catch (error) {
      await this.updateUI(`Error connecting to worker: ${error}`);
    }
  }

  private async setupIntentHandlers(): Promise<void> {
    // Intent handling is now done through MCP tools
    // No pattern-based intent recognition needed
  }

  private async restoreSession(): Promise<void> {
    // Restore previous session state if available
    const sessionData = await this.orchestratorClient.getSessionData();
    if (sessionData) {
      this.conversationContext.restore(sessionData.conversation);
      await this.statusPane.restoreWorkers(sessionData.workers);
    }
  }

  private async updateUI(message: string): Promise<void> {
    // In a real implementation, this would update the terminal display
    console.log(chalk.white(message));

    // Also add to conversation history
    this.conversationContext.addMessage({
      type: 'assistant',
      content: message,
      timestamp: new Date()
    });
  }

  /**
   * Update CLAUDE.md with current OrchFlow context
   */
  private async updateClaudeMDWithContext(): Promise<void> {
    try {
      const context = await this.contextProvider.getContext('');
      const orchflowSection = await this.claudeMDManager.generateOrchFlowSection(context);
      await this.claudeMDManager.appendToClaudeMD(orchflowSection);
    } catch (error) {
      console.warn('Failed to update CLAUDE.md:', error);
    }
  }

  /**
   * Infer task type from input
   */
  private inferTaskType(input: string): string {
    const lowerInput = input.toLowerCase();
    if (lowerInput.includes('test')) return 'test';
    if (lowerInput.includes('research') || lowerInput.includes('analyze')) return 'research';
    if (lowerInput.includes('review') || lowerInput.includes('audit')) return 'analysis';
    if (lowerInput.includes('swarm') || lowerInput.includes('team')) return 'swarm';
    if (lowerInput.includes('auth') || lowerInput.includes('login')) return 'auth';
    if (lowerInput.includes('database') || lowerInput.includes('db')) return 'database';
    if (lowerInput.includes('api') || lowerInput.includes('endpoint')) return 'api-development';
    if (lowerInput.includes('react') || lowerInput.includes('component')) return 'web-development';
    return 'code'; // Default
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'running': return '🟢';
      case 'paused': return '🟡';
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'spawning': return '🔄';
      default: return '⚪';
    }
  }

  private generateId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async switchToWorker(workerId: string): Promise<void> {
    const worker = await this.orchestratorClient.getWorker(workerId);
    if (!worker) {
      await this.updateUI(`Worker ${workerId} not found`);
      return;
    }

    // Update conversation context
    this.conversationContext.switchContext(workerId);

    // Update UI
    await this.updateUI(`Switched to ${worker.descriptiveName || worker.name}`);

    // Emit event for status pane update
    this.emit('workerSwitched', worker);
  }

  async connectWebSocket(wsUrl: string): Promise<void> {
    await this.orchestratorClient.connectWebSocket(wsUrl);

    // Forward events to status pane
    this.orchestratorClient.on('worker:created', (worker) => {
      this.statusPane.addWorker(worker);
    });

    this.orchestratorClient.on('worker:updated', (worker) => {
      this.statusPane.updateWorker(worker);
    });

    this.orchestratorClient.on('worker:deleted', (workerId) => {
      this.statusPane.removeWorker(workerId);
    });
  }

  async shutdown(): Promise<void> {
    console.log(chalk.yellow('Shutting down OrchFlow Terminal...'));

    // Save session state
    await this.orchestratorClient.saveSessionData({
      conversation: this.conversationContext.export(),
      workers: await this.orchestratorClient.listWorkers()
    });

    // Clean up memory context
    if (this.memoryContext) {
      await this.memoryContext.cleanupOldEntries();
    }

    // Stop performance monitoring
    if ((this as any).performanceMonitor) {
      (this as any).performanceMonitor.stop();
    }
    
    // Stop status pane integrations
    if (this.statusPaneManager) {
      await this.statusPaneManager.stop();
    }

    // Remove OrchFlow section from CLAUDE.md
    if (this.claudeMDManager) {
      await this.claudeMDManager.removeOrchFlowSection();
    }

    // Disconnect services
    await this.mcpClient.disconnect();
    await this.orchestratorClient.disconnect();

    // Clean up tmux session
    await this.tmuxBackend.killSession(this.sessionId);

    console.log(chalk.green('✓ OrchFlow Terminal shutdown complete'));
  }
}