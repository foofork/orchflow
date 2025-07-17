import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { TaskGraph } from './task-graph';
import { WorkerManager } from './worker-manager';
import { MCPServer } from './mcp-server';
import { StateManager } from './state-manager';
import { SmartScheduler } from './smart-scheduler';
import { ClaudeFlowWrapper } from './claude-flow-wrapper';
import { ConflictDetector } from './conflict-detector';
import { WorkerNamer } from '../primary-terminal/worker-namer';
import { ErrorHandler } from '../core/error-handler';

export interface OrchFlowOrchestratorConfig {
  mcpPort: number;
  stateConfig: {
    database: string;
  };
  workerConfig: {
    maxWorkers: number;
  };
  thinWrapperMode?: boolean;
}

export interface Task {
  id: string;
  type: 'research' | 'code' | 'test' | 'analysis' | 'swarm' | 'hive-mind';
  description: string;
  parameters: any;
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'blocked';
  assignedWorker?: string;
  assignedWorkerName?: string;
  priority: number;
  estimatedDuration?: number;
  claudeFlowCommand?: string;
  config?: any;
  deadline?: string;
  createdAt?: Date;
  updatedAt?: Date;
  error?: string;
}

export interface WorkerId {
  id: string;
}

export interface ConflictInfo {
  type: 'resource' | 'dependency' | 'file' | 'port';
  conflictingTask: string;
  description: string;
  severity: 'warning' | 'error';
}

export class OrchFlowOrchestrator extends EventEmitter {
  private taskGraph: TaskGraph;
  private workerManager: WorkerManager;
  private mcpServer: MCPServer;
  private stateManager: StateManager;
  private scheduler: SmartScheduler;
  private claudeFlowWrapper: ClaudeFlowWrapper;
  private conflictDetector: ConflictDetector;
  private workerNamer: WorkerNamer;
  private errorHandler: ErrorHandler;
  private config: OrchFlowOrchestratorConfig;
  private wsServer: WebSocket.Server | null = null;
  private clients: Set<WebSocket> = new Set();
  private schedulerInterval: NodeJS.Timeout | null = null;

  constructor(config: OrchFlowOrchestratorConfig) {
    super();
    this.config = config;
    this.taskGraph = new TaskGraph();
    this.workerManager = new WorkerManager(config.workerConfig);
    this.mcpServer = new MCPServer(config.mcpPort);
    this.stateManager = new StateManager(config.stateConfig);
    this.scheduler = new SmartScheduler();
    this.claudeFlowWrapper = new ClaudeFlowWrapper();
    this.conflictDetector = new ConflictDetector();
    this.workerNamer = new WorkerNamer();
    this.errorHandler = ErrorHandler.getInstance();
  }

  async initialize(): Promise<void> {
    console.log('Initializing OrchFlow Orchestrator...');

    try {
      // Initialize components
      await this.stateManager.initialize();
      await this.mcpServer.start();
      await this.registerOrchFlowMCPTools();
      await this.startWebSocketServer();
      await this.startSmartScheduler();

      // Restore previous state if available
      await this.restoreState();

      console.log('OrchFlow Orchestrator initialized');
    } catch (error) {
      await this.errorHandler.handleError(error as Error, {
        component: 'OrchFlowOrchestrator',
        operation: 'initialize'
      });
      throw error;
    }
  }

  async spawnWorker(workerType: string, config?: any): Promise<string> {
    // Create a basic task for the worker
    const task: Task = {
      id: this.generateTaskId(),
      type: workerType as Task['type'],
      description: config?.description || `${workerType} worker`,
      parameters: config || {},
      dependencies: [],
      status: 'pending',
      priority: config?.priority || 5
    };

    return this.spawnWorkerWithDescriptiveName(task);
  }

  async spawnWorkerWithDescriptiveName(task: Task): Promise<string> {
    // Generate context-aware descriptive name
    const descriptiveName = this.workerNamer.generateName(task);

    // Check for conflicts before spawning
    const conflicts = await this.conflictDetector.checkConflicts(task);
    if (conflicts.length > 0) {
      const errors = conflicts.filter(c => c.severity === 'error');
      if (errors.length > 0) {
        throw new Error(`Task conflicts detected: ${errors.map(c => c.description).join(', ')}`);
      }
    }

    // Build claude-flow command using thin wrapper
    const command = this.claudeFlowWrapper.buildCommand(task);

    // Spawn worker with descriptive name
    const workerId = await this.workerManager.spawnWorker(task.type, {
      ...task.config,
      descriptiveName,
      command,
      quickAccessKey: this.assignQuickAccessKey()
    });

    // Update task with worker assignment
    task.assignedWorker = workerId;
    task.assignedWorkerName = descriptiveName;
    task.claudeFlowCommand = command;

    // Notify clients
    this.broadcastWorkerUpdate(workerId, {
      id: workerId,
      descriptiveName,
      status: 'spawning',
      progress: 0
    });

    return workerId;
  }

  async submitTask(task: Task): Promise<void> {
    // Add task to graph
    this.taskGraph.addTask(task);

    // Persist task state
    await this.stateManager.persistTask(task);

    // Trigger scheduling
    await this.scheduler.schedule();

    // Notify clients
    this.broadcastTaskUpdate(task);
  }

  private async registerOrchFlowMCPTools(): Promise<void> {
    // Register OrchFlow orchestrator tools for Primary Terminal
    this.mcpServer.registerTool('orchflow_submit_task', {
      name: 'orchflow_submit_task',
      description: 'Submit a new task for OrchFlow execution',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'number' },
          generateDescriptiveName: { type: 'boolean', default: true }
        }
      },
      handler: async (params) => {
        const task: Task = {
          id: this.generateTaskId(),
          type: params.type,
          description: params.description,
          parameters: params,
          dependencies: [],
          status: 'pending',
          priority: params.priority || 5
        };
        await this.submitTask(task);
        return { taskId: task.id, status: 'submitted' };
      }
    });

    this.mcpServer.registerTool('orchflow_list_workers', {
      name: 'orchflow_list_workers',
      description: 'List all active workers with descriptive names',
      parameters: {},
      handler: async () => {
        return this.workerManager.listWorkers();
      }
    });

    this.mcpServer.registerTool('orchflow_connect_worker', {
      name: 'orchflow_connect_worker',
      description: 'Connect to a specific worker for interaction',
      parameters: {
        type: 'object',
        properties: {
          workerId: { type: 'string' },
          workerName: { type: 'string' }
        }
      },
      handler: async (params) => {
        const worker = await this.workerManager.getWorker(params.workerId || params.workerName);
        if (!worker) {
          throw new Error('Worker not found');
        }
        return { connection: worker.connection };
      }
    });

    this.mcpServer.registerTool('orchflow_pause_worker', {
      name: 'orchflow_pause_worker',
      description: 'Pause a specific worker by ID or name',
      parameters: {
        type: 'object',
        properties: {
          workerId: { type: 'string' },
          workerName: { type: 'string' }
        }
      },
      handler: async (params) => {
        await this.workerManager.pauseWorker(params.workerId || params.workerName);
        return { status: 'paused' };
      }
    });

    this.mcpServer.registerTool('orchflow_query', {
      name: 'orchflow_query',
      description: 'General query handler for OrchFlow',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          context: { type: 'array' }
        }
      },
      handler: async (params) => {
        // This would integrate with Claude for general queries
        return { result: `Processing query: ${params.query}` };
      }
    });
  }

  private async startSmartScheduler(): Promise<void> {
    // Run scheduler every second
    this.schedulerInterval = setInterval(async () => {
      try {
        const executableTasks = this.taskGraph.getExecutableTasks();
        for (const task of executableTasks) {
          await this.executeTask(task);
        }
      } catch (error) {
        console.error('Scheduler error:', error);
      }
    }, 1000);
  }

  private async executeTask(task: Task): Promise<void> {
    try {
      // Update task status
      task.status = 'running';
      await this.stateManager.updateTask(task);

      // Find best worker for task
      let workerId = await this.findBestWorker(task);

      if (!workerId) {
        // Spawn new worker if none available
        workerId = await this.spawnWorkerWithDescriptiveName(task);
      }

      // Assign task to worker
      await this.assignTaskToWorker(workerId, task);
    } catch (error) {
      task.status = 'failed';
      task.error = (error as Error).message;
      await this.stateManager.updateTask(task);
      
      await this.errorHandler.handleError(error as Error, {
        component: 'OrchFlowOrchestrator',
        operation: 'executeTask',
        taskId: task.id
      });
    }
  }

  private async findBestWorker(task: Task): Promise<string | null> {
    const workers = await this.workerManager.listWorkers();

    // Find idle worker with matching capabilities
    const suitableWorkers = workers.filter(worker =>
      worker.status === 'running' &&
      !worker.currentTask &&
      this.hasRequiredCapabilities(worker, task)
    );

    if (suitableWorkers.length === 0) {
      return null;
    }

    // Return worker with lowest resource usage
    return suitableWorkers.reduce((best, current) =>
      current.resources.cpuUsage < best.resources.cpuUsage ? current : best
    ).id;
  }

  private hasRequiredCapabilities(worker: any, task: Task): boolean {
    // Check if worker type matches task type
    return worker.type === task.type;
  }

  private async assignTaskToWorker(workerId: string, task: Task): Promise<void> {
    await this.workerManager.assignTask(workerId, task);

    // Update task with worker assignment
    task.assignedWorker = workerId;
    await this.stateManager.updateTask(task);

    // Notify clients
    this.broadcastTaskUpdate(task);
  }

  private getRequiredCapabilities(task: Task): string[] {
    // Map task type to required capabilities
    const capabilityMap: Record<string, string[]> = {
      'research': ['analyze', 'search', 'summarize'],
      'code': ['typescript', 'javascript', 'python', 'git'],
      'test': ['jest', 'mocha', 'pytest', 'testing'],
      'analysis': ['data-analysis', 'visualization', 'reporting'],
      'swarm': ['coordination', 'parallel-execution', 'orchestration'],
      'hive-mind': ['collective-intelligence', 'consensus', 'distributed']
    };

    return capabilityMap[task.type] || [];
  }

  private getResourceLimits(task: Task): any {
    // Set resource limits based on task type
    const resourceMap: Record<string, any> = {
      'research': { cpu: 25, memory: 512 },
      'code': { cpu: 50, memory: 1024 },
      'test': { cpu: 50, memory: 1024 },
      'analysis': { cpu: 75, memory: 2048 },
      'swarm': { cpu: 100, memory: 2048 },
      'hive-mind': { cpu: 100, memory: 4096 }
    };

    return resourceMap[task.type] || { cpu: 50, memory: 1024 };
  }

  private assignQuickAccessKey(): number | undefined {
    // Assign keys 1-9 to workers
    const usedKeys = new Set(
      this.workerManager.getWorkers().map(w => w.quickAccessKey).filter(k => k)
    );

    for (let i = 1; i <= 9; i++) {
      if (!usedKeys.has(i)) {
        return i;
      }
    }

    return undefined; // No keys available
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get all workers from worker manager
   */
  getWorkers(): any[] {
    return this.workerManager.getWorkers();
  }

  /**
   * Find a worker by ID
   */
  async getWorker(workerId: string): Promise<any> {
    const workers = this.workerManager.getWorkers();
    return workers.find(w => w.id === workerId);
  }

  /**
   * Get session data for restoration
   */
  async getSessionData(): Promise<any> {
    return {
      workers: this.workerManager.getWorkers(),
      tasks: this.taskGraph.getAllTasks(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Save session data
   */
  async saveSessionData(data: any): Promise<void> {
    try {
      await this.stateManager.saveState(data);
    } catch (error) {
      console.error('Failed to save session data:', error);
    }
  }

  private async startWebSocketServer(): Promise<void> {
    this.wsServer = new WebSocket.Server({ port: 3001 });

    this.wsServer.on('connection', (ws) => {
      this.clients.add(ws);

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          await this.handleWebSocketMessage(ws, data);
        } catch (error) {
          ws.send(JSON.stringify({ error: (error as Error).message }));
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      // Send initial state
      this.sendInitialState(ws);
    });
  }

  private async handleWebSocketMessage(ws: WebSocket, message: any): Promise<void> {
    const { id, method, params } = message;

    try {
      let result;

      switch (method) {
        case 'submitTask':
          await this.submitTask(params.task);
          result = { status: 'submitted' };
          break;
        case 'listWorkers':
          result = await this.workerManager.listWorkers();
          break;
        case 'getWorker':
          result = await this.workerManager.getWorker(params.workerId);
          break;
        case 'pauseWorker':
          await this.workerManager.pauseWorker(params.workerId);
          result = { status: 'paused' };
          break;
        case 'resumeWorker':
          await this.workerManager.resumeWorker(params.workerId);
          result = { status: 'resumed' };
          break;
        case 'getSessionData':
          result = await this.stateManager.getSessionData();
          break;
        case 'saveSessionData':
          await this.stateManager.saveSessionData(params.data);
          result = { status: 'saved' };
          break;
        default:
          throw new Error(`Unknown method: ${method}`);
      }

      ws.send(JSON.stringify({ id, result }));
    } catch (error) {
      ws.send(JSON.stringify({ id, error: { message: (error as Error).message } }));
    }
  }

  private async sendInitialState(ws: WebSocket): Promise<void> {
    const workers = await this.workerManager.listWorkers();
    const tasks = this.taskGraph.getAllTasks();

    ws.send(JSON.stringify({
      type: 'event',
      event: 'initialState',
      data: { workers, tasks }
    }));
  }

  private broadcastWorkerUpdate(workerId: string, workerInfo: any): void {
    const message = JSON.stringify({
      type: 'event',
      event: 'workerUpdate',
      data: workerInfo
    });

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  private broadcastTaskUpdate(task: Task): void {
    const message = JSON.stringify({
      type: 'event',
      event: 'taskUpdate',
      data: task
    });

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  private async restoreState(): Promise<void> {
    try {
      const savedTasks = await this.stateManager.getAllTasks();
      savedTasks.forEach(task => {
        this.taskGraph.addTask(task);
      });
    } catch (error) {
      console.error('Failed to restore state:', error);
    }
  }

  async destroy(): Promise<void> {
    return this.shutdown();
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down OrchFlow Orchestrator...');

    // Stop scheduler
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }

    // Save current state
    await this.stateManager.saveAllTasks(this.taskGraph.getAllTasks());

    // Shutdown components
    await this.workerManager.shutdown();
    await this.mcpServer.stop();

    // Close WebSocket connections
    this.clients.forEach(client => client.close());
    if (this.wsServer) {
      this.wsServer.close();
    }

    console.log('OrchFlow Orchestrator shutdown complete');
  }

  // Duplicate functions removed - already defined earlier in the class

  /**
   * Get workers with rich information for status pane
   */
  async getWorkersWithRichInfo(): Promise<any[]> {
    const workers = this.workerManager.getWorkers();
    return workers.map(worker => ({
      id: worker.id,
      descriptiveName: worker.descriptiveName || worker.name,
      status: worker.status,
      progress: worker.progress || 0,
      currentTask: worker.currentTask,
      startTime: worker.startTime,
      estimatedCompletion: worker.estimatedCompletion,
      resourceUsage: worker.resourceUsage,
      quickAccessKey: worker.quickAccessKey
    }));
  }

  /**
   * Get task statistics for status pane
   */
  async getTaskStatistics(): Promise<any> {
    const tasks = this.taskGraph.getAllTasks();
    return {
      pending: tasks.filter(t => t.status === 'pending').length,
      running: tasks.filter(t => t.status === 'running').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      total: tasks.length
    };
  }
}