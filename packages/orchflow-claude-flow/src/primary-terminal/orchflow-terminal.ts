import { EventEmitter } from 'events';
import { MCPClient } from './mcp-client';
import { ConversationContext } from './conversation-context';
import { OrchestratorClient } from './orchestrator-client';
import { StatusPane } from './status-pane';
import { WorkerAccessManager } from './worker-access-manager';
import { TmuxBackend } from '../tmux-integration/tmux-backend';
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
  private sessionId: string = '';
  private primaryPaneId: string = '';
  private statusPaneId: string = '';

  constructor(config: OrchFlowTerminalConfig) {
    super();
    this.mcpClient = new MCPClient(config.mcpEndpoint);
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
    // Process through MCP tools for natural language understanding
    // No pattern matching or specific keywords required
    try {
      const response = await this.mcpClient.invokeTool('orchflow_natural_task', {
        naturalLanguageInput: input,
        context: this.conversationContext.getRecentHistory()
      });

      if (response.success) {
        await this.updateUI(response.description || 'Command processed successfully');
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

    // Disconnect services
    await this.mcpClient.disconnect();
    await this.orchestratorClient.disconnect();

    // Clean up tmux session
    await this.tmuxBackend.killSession(this.sessionId);

    console.log(chalk.green('✓ OrchFlow Terminal shutdown complete'));
  }
}