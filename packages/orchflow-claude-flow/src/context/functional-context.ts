import type { OrchestratorClient, SessionData } from '../primary-terminal/orchestrator-client';
import type { ConversationContext } from '../primary-terminal/conversation-context';
import type { WorkerAccessManager } from '../primary-terminal/worker-access-manager';

export interface WorkerListContext {
  workers: Array<{
    id: string;
    descriptiveName: string;
    status: 'active' | 'paused' | 'completed';
    currentTask?: string;
    quickAccessKey?: number;
    progress?: number;
    estimatedCompletion?: Date;
  }>;
}

export interface TaskContext {
  mainObjective: string;
  activeSubtasks: string[];
  completedTasks: string[];
  dependencies: Map<string, string[]>;
  taskHistory: Array<{task: string, status: string, timestamp: Date}>;
}

export interface OrchFlowPatterns {
  workerCreation: string[];
  workerManagement: string[];
  taskOrchestration: string[];
  quickAccess: string[];
}

export interface FunctionalContextResponse {
  workers: WorkerListContext['workers'];
  currentTask?: TaskContext;
  availableCommands: string[];
  quickAccessMap: Array<{key: number, workerId: string, workerName: string}>;
  recentHistory: any[];
  systemCapabilities: string[];
  historicalSuggestions?: string[];
}

/**
 * OrchFlowFunctionalContext provides rich functional context about workers, tasks, and patterns
 * without exposing terminal implementation details like tmux panes or layouts.
 */
export class OrchFlowFunctionalContext {
  constructor(
    private orchestratorClient: OrchestratorClient,
    private conversationContext: ConversationContext,
    private _workerManager: WorkerAccessManager
  ) {}

  /**
   * Get comprehensive functional context for a user input
   */
  async getContext(userInput: string): Promise<FunctionalContextResponse> {
    const workers = await this.orchestratorClient.listWorkers();
    const enrichedWorkers = await this.enrichWorkerInfo(workers);

    return {
      workers: enrichedWorkers,
      currentTask: await this.getCurrentTaskContext(),
      availableCommands: this.getRelevantCommands(userInput),
      quickAccessMap: await this.getQuickAccessMapping(),
      recentHistory: this.conversationContext.getRecentHistory(),
      systemCapabilities: this.getSystemCapabilities(),
      historicalSuggestions: []
    };
  }

  /**
   * Enrich worker information with progress and activity details
   */
  private async enrichWorkerInfo(workers: any[]): Promise<WorkerListContext['workers']> {
    return workers.map(w => ({
      id: w.id,
      descriptiveName: w.descriptiveName || w.name,
      status: w.status || 'active',
      currentTask: w.currentTask?.description,
      quickAccessKey: w.quickAccessKey,
      progress: w.progress || 0,
      estimatedCompletion: this.estimateCompletion(w)
    }));
  }

  /**
   * Get current task context including objectives and dependencies
   */
  private async getCurrentTaskContext(): Promise<TaskContext | undefined> {
    try {
      const sessionData: SessionData | null = await this.orchestratorClient.getSessionData();
      if (!sessionData) {return undefined;}

      return {
        mainObjective: sessionData.mainObjective || 'General development tasks',
        activeSubtasks: sessionData.activeSubtasks || [],
        completedTasks: sessionData.completedTasks || [],
        dependencies: new Map(sessionData.dependencies || []),
        taskHistory: sessionData.taskHistory || []
      };
    } catch (error) {
      console.warn('Failed to get current task context:', error);
      return undefined;
    }
  }

  /**
   * Get relevant commands based on user input context
   */
  private getRelevantCommands(input: string): string[] {
    const commands = [];

    // Always include quick access hint
    commands.push('Tip: Press 1-9 to quickly connect to workers');

    // Context-aware suggestions based on input
    const lowerInput = input.toLowerCase();

    if (lowerInput.includes('create') || lowerInput.includes('build')) {
      commands.push(
        'Create a React component builder to handle UI development',
        'Create an API developer for backend services',
        'Create a test engineer to write comprehensive tests',
        'Create a database designer for data modeling'
      );
    }

    if (lowerInput.includes('connect') || lowerInput.includes('check') || lowerInput.includes('show')) {
      commands.push(
        'Connect to the React builder',
        'What is worker 3 doing?',
        'Show me all workers',
        'Check the status of the API developer'
      );
    }

    if (lowerInput.includes('auth') || lowerInput.includes('login')) {
      commands.push(
        'Create an authentication specialist',
        'Build a secure login system',
        'Implement JWT token handling'
      );
    }

    if (lowerInput.includes('test') || lowerInput.includes('testing')) {
      commands.push(
        'Create a test automation engineer',
        'Build comprehensive test suites',
        'Set up continuous integration testing'
      );
    }

    if (lowerInput.includes('database') || lowerInput.includes('db')) {
      commands.push(
        'Create a database architect',
        'Design efficient database schemas',
        'Optimize database performance'
      );
    }

    return commands;
  }

  /**
   * Get quick access key mappings for workers
   */
  private async getQuickAccessMapping(): Promise<Array<{key: number, workerId: string, workerName: string}>> {
    try {
      const workers = await this.orchestratorClient.listWorkers();
      return workers
        .filter(w => w.quickAccessKey !== undefined && w.quickAccessKey !== null)
        .map(w => ({
          key: w.quickAccessKey!,
          workerId: w.id,
          workerName: w.descriptiveName || w.name || 'Unknown Worker'
        }))
        .sort((a, b) => a.key - b.key);
    } catch (error) {
      console.warn('Failed to get quick access mapping:', error);
      return [];
    }
  }

  /**
   * Get system capabilities for context
   */
  private getSystemCapabilities(): string[] {
    return [
      'Natural language task creation',
      'Intelligent worker management',
      'Quick access shortcuts (1-9)',
      'Descriptive worker naming',
      'Task orchestration and coordination',
      'Session state persistence',
      'Performance monitoring',
      'Smart worker suggestions'
    ];
  }

  /**
   * Estimate completion time for a worker based on current activity
   */
  private estimateCompletion(worker: any): Date | undefined {
    if (!worker.startTime || worker.status === 'completed') {
      return undefined;
    }

    // Simple estimation based on task complexity and current progress
    const startTime = new Date(worker.startTime);
    const now = new Date();
    const elapsed = now.getTime() - startTime.getTime();
    const progress = worker.progress || 0;

    if (progress > 0 && progress < 100) {
      const estimatedTotal = (elapsed / progress) * 100;
      return new Date(startTime.getTime() + estimatedTotal);
    }

    // Default estimation: 30 minutes from start
    return new Date(startTime.getTime() + 30 * 60 * 1000);
  }
}