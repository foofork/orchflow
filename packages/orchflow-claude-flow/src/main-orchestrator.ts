/**
 * Main OrchFlow Entry Point - Phase 4 Complete Integration
 * 
 * This module integrates all Phase 3 and Phase 4 components into a
 * complete natural language orchestration system.
 */

import { OrchFlowOrchestrator, OrchFlowOrchestratorConfig } from './orchestrator/orchflow-orchestrator';
import { SplitScreenManager, SplitScreenConfig } from './terminal-layout/split-screen-manager';
import { AdvancedWorkerAccess } from './worker-access/advanced-worker-access';
import { createEnhancedMCPTools } from './primary-terminal/enhanced-mcp-tools';
import { NLIntentRecognizer } from './primary-terminal/nl-intent-recognizer';
import { TmuxBackend } from './tmux-integration/tmux-backend';
import { EventEmitter } from 'events';

export interface MainOrchestratorConfig {
  orchestrator: OrchFlowOrchestratorConfig;
  splitScreen: SplitScreenConfig;
  enableNaturalLanguage: boolean;
  enableQuickAccess: boolean;
  maxWorkers: number;
  debugMode: boolean;
}

export class MainOrchestrator extends EventEmitter {
  private orchestrator: OrchFlowOrchestrator;
  private splitScreen: SplitScreenManager;
  private workerAccess: AdvancedWorkerAccess;
  private nlRecognizer: NLIntentRecognizer;
  private tmux: TmuxBackend;
  private config: MainOrchestratorConfig;
  private isRunning: boolean = false;

  constructor(config: Partial<MainOrchestratorConfig> = {}) {
    super();
    
    this.config = {
      orchestrator: {
        mcpPort: 3001,
        stateConfig: { database: './orchflow-state.json' },
        workerConfig: { maxWorkers: 8 },
        thinWrapperMode: true
      },
      splitScreen: {
        primaryWidth: 70,
        statusWidth: 30,
        sessionName: 'orchflow_main',
        enableQuickAccess: true
      },
      enableNaturalLanguage: true,
      enableQuickAccess: true,
      maxWorkers: 8,
      debugMode: false,
      ...config
    };

    this.tmux = new TmuxBackendImpl();
    this.splitScreen = new SplitScreenManager(this.config.splitScreen);
    this.workerAccess = new AdvancedWorkerAccess(this.tmux);
    this.nlRecognizer = new NLIntentRecognizer();
    this.orchestrator = new OrchFlowOrchestrator(this.config.orchestrator);
  }

  /**
   * Initialize the complete OrchFlow system
   */
  async initialize(): Promise<void> {
    console.log('🐝 Initializing OrchFlow Main Orchestrator...');

    try {
      // Phase 1: Initialize core orchestrator
      await this.orchestrator.initialize();
      this.log('✅ Core orchestrator initialized');

      // Phase 2: Setup split-screen layout  
      await this.splitScreen.initialize();
      this.log('✅ Split-screen layout created (70/30)');

      // Phase 3: Register enhanced MCP tools
      await this.registerEnhancedMCPTools();
      this.log('✅ Enhanced MCP tools registered');

      // Phase 4: Setup event handlers
      this.setupEventHandlers();
      this.log('✅ Event handlers configured');

      // Phase 5: Display welcome message
      await this.displayWelcomeMessage();
      this.log('✅ Welcome message displayed');

      this.isRunning = true;
      this.emit('initialized');
      
      console.log('🚀 OrchFlow is ready! Natural language orchestration active.');
      
    } catch (error) {
      console.error('❌ Failed to initialize OrchFlow:', error);
      throw error;
    }
  }

  private async registerEnhancedMCPTools(): Promise<void> {
    const enhancedTools = createEnhancedMCPTools(this);
    
    for (const tool of enhancedTools) {
      this.orchestrator['mcpServer'].registerTool(tool.name, tool);
    }
  }

  private setupEventHandlers(): void {
    // Orchestrator events
    this.orchestrator.on('workerSpawned', async (worker) => {
      await this.workerAccess.registerWorker(worker);
      await this.splitScreen.addWorkerToStatus(worker);
      this.log(`👤 Worker spawned: ${worker.descriptiveName}`);
    });

    this.orchestrator.on('workerStopped', async (worker) => {
      this.workerAccess.unregisterWorker(worker.id);
      await this.splitScreen.removeWorkerFromStatus(worker.id);
      this.log(`💤 Worker stopped: ${worker.descriptiveName}`);
    });

    this.orchestrator.on('taskCompleted', async (task) => {
      await this.splitScreen.displayNotification(`✅ Task completed: ${task.description}`);
    });

    // Split screen events
    this.splitScreen.on('workerUpdate', (data) => {
      this.emit('statusUpdate', data);
    });

    // Worker access events
    this.workerAccess.on('sessionCreated', async (session) => {
      await this.splitScreen.highlightWorker(session.workerId);
      this.log(`🔗 Connected to worker: ${session.workerName}`);
    });
  }

  /**
   * Process natural language input from primary terminal
   */
  async processNaturalLanguageInput(input: string, context: any[] = []): Promise<any> {
    if (!this.config.enableNaturalLanguage) {
      throw new Error('Natural language processing is disabled');
    }

    // Recognize intent
    const intent = await this.nlRecognizer.recognizeIntent(input);
    this.log(`🧠 Intent recognized: ${intent.intent} (confidence: ${intent.confidence})`);

    switch (intent.intent) {
      case 'create_task':
        return this.handleCreateTask(intent, input, context);
        
      case 'connect_to_worker':
        return this.handleConnectToWorker(intent);
        
      case 'list_workers':
        return this.handleListWorkers();
        
      case 'pause_worker':
        return this.handlePauseWorker(intent);
        
      case 'query':
        return this.handleQuery(intent, context);
        
      default:
        return this.handleUnknownIntent(input);
    }
  }

  private async handleCreateTask(intent: any, input: string, context: any[]): Promise<any> {
    const taskInfo = await this.parseNaturalLanguageTask(input, context);
    const workerId = await this.orchestrator.spawnWorkerWithDescriptiveName(taskInfo);
    
    return {
      success: true,
      action: 'task_created',
      workerId,
      workerName: taskInfo.assignedWorkerName,
      message: `Created "${taskInfo.assignedWorkerName}" for: ${taskInfo.description}`
    };
  }

  private async handleConnectToWorker(intent: any): Promise<any> {
    const { workerName, quickAccessKey } = intent.parameters;
    
    if (quickAccessKey) {
      const session = await this.workerAccess.quickAccess(quickAccessKey);
      return { success: true, action: 'worker_connected', session };
    } else {
      const session = await this.workerAccess.connectToWorker(workerName);
      return { success: true, action: 'worker_connected', session };
    }
  }

  private async handleListWorkers(): Promise<any> {
    const workers = await this.orchestrator['workerManager'].listWorkers();
    return {
      success: true,
      action: 'workers_listed',
      workers: workers.map(w => ({
        id: w.id,
        name: w.descriptiveName,
        status: w.status,
        quickKey: w.quickAccessKey
      }))
    };
  }

  private async handlePauseWorker(intent: any): Promise<any> {
    const { workerName } = intent.parameters;
    await this.orchestrator['workerManager'].pauseWorker(workerName);
    return { success: true, action: 'worker_paused', workerName };
  }

  private async handleQuery(intent: any, context: any[]): Promise<any> {
    // This would integrate with Claude for general queries
    return {
      success: true,
      action: 'query_processed',
      result: `Processing query: ${intent.parameters.query}`,
      context
    };
  }

  private async handleUnknownIntent(input: string): Promise<any> {
    const suggestions = [
      'Try: "Build a React component for user profiles"',
      'Try: "Connect to the API developer"',
      'Try: "Show me all workers"',
      'Try: "Press 3" for quick access'
    ];

    return {
      success: false,
      action: 'unknown_intent',
      message: 'I didn\'t understand that command.',
      suggestions,
      originalInput: input
    };
  }

  /**
   * Parse natural language into task parameters
   */
  async parseNaturalLanguageTask(input: string, context: any[]): Promise<any> {
    const intent = await this.nlRecognizer.recognizeIntent(input);
    const taskParams = intent.parameters;

    // Generate descriptive worker name
    const workerName = this.generateDescriptiveWorkerName(input, taskParams.type);

    // Assign quick access key
    const quickAccessKey = await this.assignNextAvailableKey();

    return {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: taskParams.type || 'code',
      description: input,
      parameters: taskParams,
      dependencies: [],
      status: 'pending',
      priority: this.parsePriority(taskParams.priority),
      assignedWorkerName: workerName,
      quickAccessKey,
      config: {
        descriptiveName: workerName,
        quickAccessKey,
        command: this.buildClaudeFlowCommand(taskParams.type, input)
      }
    };
  }

  private generateDescriptiveWorkerName(input: string, type: string): string {
    // Enhanced worker naming based on context
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('auth') || lowerInput.includes('login')) {
      return 'Auth System Builder';
    } else if (lowerInput.includes('api') || lowerInput.includes('endpoint')) {
      return 'API Developer';
    } else if (lowerInput.includes('test') || lowerInput.includes('testing')) {
      return 'Test Engineer';
    } else if (lowerInput.includes('react') || lowerInput.includes('component')) {
      return 'React Component Developer';
    } else if (lowerInput.includes('database') || lowerInput.includes('db')) {
      return 'Database Specialist';
    } else if (lowerInput.includes('ui') || lowerInput.includes('interface')) {
      return 'UI/UX Developer';
    } else if (lowerInput.includes('performance') || lowerInput.includes('optimize')) {
      return 'Performance Optimizer';
    } else {
      return `${type.charAt(0).toUpperCase()}${type.slice(1)} Specialist`;
    }
  }

  private async assignNextAvailableKey(): Promise<number | undefined> {
    const assignments = this.workerAccess.getQuickKeyAssignments();
    const usedKeys = new Set(assignments.map(a => a.key));
    
    for (let i = 1; i <= 9; i++) {
      if (!usedKeys.has(i)) {
        return i;
      }
    }
    
    return undefined; // All keys are used
  }

  private parsePriority(priority?: string): number {
    switch (priority?.toLowerCase()) {
      case 'high': return 8;
      case 'medium': return 5;
      case 'low': return 2;
      default: return 5;
    }
  }

  private buildClaudeFlowCommand(type: string, description: string): string {
    const typeCommands = {
      'research': `claude-flow sparc run researcher "${description}"`,
      'code': `claude-flow sparc run coder "${description}"`,
      'test': `claude-flow sparc run tester "${description}"`,
      'analysis': `claude-flow sparc run analyzer "${description}"`,
      'swarm': `claude-flow swarm "${description}" --strategy development`,
      'hive-mind': `claude-flow hive-mind spawn "${description}"`
    };
    
    return typeCommands[type] || `claude-flow sparc run developer "${description}"`;
  }

  private async displayWelcomeMessage(): Promise<void> {
    const message = `
🐝 OrchFlow Natural Language Orchestration Ready!

📋 Try these commands:
• "Build a React component for user profiles"
• "Connect to the API developer" 
• "Show me all workers"
• Press 1-9 for quick worker access

📊 Status: ${await this.getSystemStatus()}
`;

    await this.splitScreen.sendToPrimaryPane(`echo "${message}"`);
  }

  private async getSystemStatus(): Promise<string> {
    const workers = await this.orchestrator['workerManager'].listWorkers();
    return `${workers.length} workers, Split-screen active, MCP tools registered`;
  }

  private log(message: string): void {
    if (this.config.debugMode) {
      console.log(`[OrchFlow] ${message}`);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down OrchFlow...');
    
    this.isRunning = false;
    
    await this.workerAccess.cleanup();
    await this.splitScreen.cleanup();
    await this.orchestrator.shutdown();
    
    this.removeAllListeners();
    
    console.log('✅ OrchFlow shutdown complete');
  }

  /**
   * Get system information for debugging
   */
  getSystemInfo(): any {
    return {
      version: '0.1.0',
      isRunning: this.isRunning,
      config: this.config,
      layout: this.splitScreen.getLayoutInfo(),
      workers: this.workerAccess.getQuickKeyAssignments(),
      activeSessions: this.workerAccess.getActiveSessions()
    };
  }
}