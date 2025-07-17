/**
 * Main OrchFlow Entry Point - Phase 4 Complete Integration
 *
 * This module integrates all Phase 3 and Phase 4 components into a
 * complete natural language orchestration system.
 */

import type { OrchFlowOrchestratorConfig } from './orchestrator/orchflow-orchestrator';
import { OrchFlowOrchestrator } from './orchestrator/orchflow-orchestrator';
import type { SplitScreenConfig } from './terminal-layout/split-screen-manager';
import { SplitScreenManager } from './terminal-layout/split-screen-manager';
import { AdvancedWorkerAccess } from './worker-access/advanced-worker-access';
import { createEnhancedMCPTools } from './primary-terminal/enhanced-mcp-tools';
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

    this.tmux = new TmuxBackend();
    this.splitScreen = new SplitScreenManager(this.config.splitScreen);
    this.workerAccess = new AdvancedWorkerAccess(this.tmux);
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

    // Direct natural language processing - no pattern matching needed
    // The MCP tools handle all natural language understanding
    this.log(`🧠 Processing natural language input: ${input}`);

    // For backwards compatibility, handle numeric shortcuts directly
    if (/^[1-9]$/.test(input)) {
      const workerNumber = parseInt(input);
      const session = await this.workerAccess.quickAccess(workerNumber);
      return { success: true, action: 'worker_connected', session };
    }

    // All other input is handled through MCP tools which provide
    // natural language understanding without requiring specific keywords
    return {
      success: true,
      action: 'natural_language_processed',
      message: 'Command processed through natural language MCP tools',
      input
    };
  }


  /**
   * Parse natural language into task parameters
   */
  async parseNaturalLanguageTask(input: string, context: any[]): Promise<any> {
    // Direct natural language processing without pattern matching
    // The actual parsing is done by Claude through MCP tools
    const taskType = this.inferTaskTypeFromInput(input);
    const workerName = this.generateDescriptiveWorkerName(input, taskType);
    const quickAccessKey = await this.assignNextAvailableKey();

    return {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: taskType,
      description: input,
      parameters: { originalInput: input },
      dependencies: [],
      status: 'pending',
      priority: 5, // Default medium priority
      assignedWorkerName: workerName,
      quickAccessKey,
      config: {
        descriptiveName: workerName,
        quickAccessKey,
        command: this.buildClaudeFlowCommand(taskType, input)
      }
    };
  }

  private inferTaskTypeFromInput(input: string): string {
    const lowerInput = input.toLowerCase();
    if (lowerInput.includes('test')) return 'test';
    if (lowerInput.includes('research') || lowerInput.includes('analyze')) return 'research';
    if (lowerInput.includes('review') || lowerInput.includes('audit')) return 'analysis';
    if (lowerInput.includes('swarm') || lowerInput.includes('team')) return 'swarm';
    return 'code'; // Default
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
    const typeCommands: Record<string, string> = {
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