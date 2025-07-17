import { EventEmitter } from 'events';
import { MCPClient } from './mcp-client';
import { NLIntentRecognizer } from './nl-intent-recognizer';
import { ConversationContext } from './conversation-context';
import { OrchestratorClient } from './orchestrator-client';
import { StatusPane } from './status-pane';
import { WorkerAccessManager } from './worker-access-manager';
import { TmuxBackend } from '../../tmux-integration/tmux-backend';
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
  private intentRecognizer: NLIntentRecognizer;
  private conversationContext: ConversationContext;
  private orchestratorClient: OrchestratorClient;
  private statusPane: StatusPane;
  private workerAccessManager: WorkerAccessManager;
  private tmuxBackend: TmuxBackend;
  private sessionId: string;
  private primaryPaneId: string;
  private statusPaneId: string;

  constructor(config: OrchFlowTerminalConfig) {
    super();
    this.mcpClient = new MCPClient(config.mcpEndpoint);
    this.intentRecognizer = new NLIntentRecognizer();
    this.conversationContext = new ConversationContext();
    this.orchestratorClient = new OrchestratorClient(config.orchestratorEndpoint);
    this.statusPane = new StatusPane(config.statusPaneConfig);
    this.workerAccessManager = new WorkerAccessManager();
    this.tmuxBackend = new TmuxBackend();
  }

  async initialize(): Promise<void> {
    console.log(chalk.cyan('Initializing OrchFlow Terminal...'));
    
    // Setup 70/30 split screen layout
    await this.setupSplitScreenLayout();
    
    // Connect to services
    await this.mcpClient.connect();
    await this.orchestratorClient.connect();
    
    // Initialize components
    await this.statusPane.initialize(this.statusPaneId);
    await this.setupIntentHandlers();
    await this.setupWorkerAccessShortcuts();
    await this.restoreSession();
    
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

    // Parse natural language intent
    const intent = await this.intentRecognizer.parseIntent(
      input, 
      this.conversationContext
    );

    // Handle based on intent
    switch (intent.action) {
      case 'create_task':
        await this.handleCreateTask(intent);
        break;
      case 'connect_to_worker':
        await this.handleConnectToWorker(intent);
        break;
      case 'list_workers':
        await this.handleListWorkers(intent);
        break;
      case 'pause_worker':
        await this.handlePauseWorker(intent);
        break;
      case 'clarify':
        await this.handleClarification(intent);
        break;
      default:
        await this.handleGenericQuery(intent);
    }
  }

  private async handleCreateTask(intent: any): Promise<void> {
    const task = {
      id: this.generateId(),
      type: intent.parameters.taskType,
      description: intent.parameters.description,
      parameters: intent.parameters,
      dependencies: [],
      status: 'pending',
      priority: intent.parameters.priority || 5,
      descriptiveName: intent.parameters.descriptiveName
    };

    const result = await this.orchestratorClient.submitTask(task);
    await this.updateUI(`✓ Task created: "${task.descriptiveName}" worker will be spawned`);
  }

  private async handleConnectToWorker(intent: any): Promise<void> {
    const workerName = intent.parameters.workerName;
    const workers = await this.orchestratorClient.listWorkers();
    
    // Find worker by descriptive name (fuzzy match)
    const targetWorker = workers.find(w => 
      w.descriptiveName.toLowerCase().includes(workerName.toLowerCase())
    );
    
    if (targetWorker) {
      await this.workerAccessManager.connectToWorker(targetWorker.id);
      await this.updateUI(`✓ Connected to "${targetWorker.descriptiveName}"`);
    } else {
      const workerList = workers.map(w => `  • ${w.descriptiveName}`).join('\n');
      await this.updateUI(`Worker '${workerName}' not found. Available workers:\n${workerList}`);
    }
  }

  private async handleListWorkers(intent: any): Promise<void> {
    const workers = await this.orchestratorClient.listWorkers();
    
    if (workers.length === 0) {
      await this.updateUI('No active workers');
      return;
    }
    
    const workerList = workers.map(w => {
      const statusIcon = this.getStatusIcon(w.status);
      const key = w.quickAccessKey ? `[${w.quickAccessKey}]` : '   ';
      return `${key} ${w.descriptiveName.padEnd(25)} ${statusIcon} ${w.status} (${w.progress}%)`;
    }).join('\n');
    
    await this.updateUI(workerList);
  }

  private async handlePauseWorker(intent: any): Promise<void> {
    const workerId = intent.parameters.workerId;
    const workerName = intent.parameters.workerName;
    
    let targetWorker;
    if (workerId) {
      targetWorker = await this.orchestratorClient.getWorker(workerId);
    } else if (workerName) {
      const workers = await this.orchestratorClient.listWorkers();
      targetWorker = workers.find(w => 
        w.descriptiveName.toLowerCase().includes(workerName.toLowerCase())
      );
    }
    
    if (targetWorker) {
      await this.orchestratorClient.pauseWorker(targetWorker.id);
      await this.updateUI(`✓ Paused "${targetWorker.descriptiveName}"`);
    } else {
      await this.updateUI('Worker not found');
    }
  }

  private async handleClarification(intent: any): Promise<void> {
    await this.updateUI(intent.parameters.message);
  }

  private async handleGenericQuery(intent: any): Promise<void> {
    // Use Claude to handle generic queries
    const response = await this.mcpClient.invokeTool('orchflow_query', {
      query: intent.parameters.query,
      context: this.conversationContext.getRecentHistory()
    });
    
    await this.updateUI(response.result);
  }

  private async setupIntentHandlers(): Promise<void> {
    // Intent handlers are set up in the NLIntentRecognizer
    // This method ensures the recognizer is properly configured
    await this.intentRecognizer.initialize();
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

  async shutdown(): Promise<void> {
    console.log(chalk.yellow('Shutting down OrchFlow Terminal...'));
    
    // Save session state
    await this.orchestratorClient.saveSessionData({
      conversation: this.conversationContext.export(),
      workers: await this.orchestratorClient.listWorkers()
    });
    
    // Disconnect services
    await this.mcpClient.disconnect();
    await this.orchestratorClient.disconnect();
    
    // Clean up tmux session
    await this.tmuxBackend.killSession(this.sessionId);
    
    console.log(chalk.green('✓ OrchFlow Terminal shutdown complete'));
  }
}