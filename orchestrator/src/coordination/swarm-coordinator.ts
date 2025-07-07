import { EventEmitter } from 'events';
import { EventBus, OrchflowEvents } from '../core/event-bus';
import { metricsCollector } from '../metrics/metrics-collector';
import { AgentManager, Agent } from '../agent-manager';
import { TaskScheduler, Task } from './task-scheduler';
import { LoadBalancer } from './load-balancer';
import { resourceManager } from '../core/resource-manager';
import { circuitBreakerManager } from '../core/circuit-breaker';

export interface SwarmTask {
  id: string;
  name: string;
  type: 'map' | 'reduce' | 'pipeline' | 'parallel' | 'sequential';
  subtasks: Array<{
    id: string;
    name: string;
    command: string;
    dependencies?: string[];
    weight?: number;
    retryable?: boolean;
  }>;
  config?: {
    maxConcurrency?: number;
    timeout?: number;
    retryAttempts?: number;
    failureThreshold?: number; // For map-reduce: % of tasks that can fail
  };
  status: 'pending' | 'running' | 'completed' | 'failed';
  results?: Map<string, any>;
  errors?: Map<string, Error>;
  startTime?: Date;
  endTime?: Date;
}

export interface SwarmAgent extends Agent {
  workerId: string;
  taskQueue: string[];
  currentTask?: string;
  performance: {
    tasksCompleted: number;
    averageTime: number;
    successRate: number;
    lastHeartbeat: Date;
  };
}

export interface SwarmConfig {
  minWorkers: number;
  maxWorkers: number;
  workerIdleTimeout: number;
  heartbeatInterval: number;
  taskTimeout: number;
  enableAutoScaling: boolean;
  scaleUpThreshold: number; // Queue size to trigger scale up
  scaleDownThreshold: number; // Idle time to trigger scale down
}

export class SwarmCoordinator extends EventEmitter {
  private agentManager: AgentManager;
  private taskScheduler: TaskScheduler;
  private loadBalancer: LoadBalancer;
  private config: Required<SwarmConfig>;
  
  private swarmTasks: Map<string, SwarmTask> = new Map();
  private workers: Map<string, SwarmAgent> = new Map();
  private taskToWorker: Map<string, string> = new Map();
  private workerPools: Map<string, Set<string>> = new Map(); // type -> worker IDs
  
  private heartbeatTimer?: NodeJS.Timer;
  private scalingTimer?: NodeJS.Timer;
  
  constructor(
    agentManager: AgentManager,
    taskScheduler: TaskScheduler,
    loadBalancer: LoadBalancer,
    config: Partial<SwarmConfig> = {}
  ) {
    super();
    this.agentManager = agentManager;
    this.taskScheduler = taskScheduler;
    this.loadBalancer = loadBalancer;
    
    this.config = {
      minWorkers: config.minWorkers || 2,
      maxWorkers: config.maxWorkers || 10,
      workerIdleTimeout: config.workerIdleTimeout || 300000, // 5 minutes
      heartbeatInterval: config.heartbeatInterval || 30000, // 30 seconds
      taskTimeout: config.taskTimeout || 600000, // 10 minutes
      enableAutoScaling: config.enableAutoScaling ?? true,
      scaleUpThreshold: config.scaleUpThreshold || 5,
      scaleDownThreshold: config.scaleDownThreshold || 180000, // 3 minutes
    };
    
    this.setupEventHandlers();
  }
  
  async initialize(): Promise<void> {
    console.log(`Initializing swarm coordinator (min: ${this.config.minWorkers}, max: ${this.config.maxWorkers})`);
    
    // Create minimum workers
    await this.createWorkerPool('general', this.config.minWorkers);
    
    // Start monitoring
    this.startHeartbeatMonitoring();
    
    if (this.config.enableAutoScaling) {
      this.startAutoScaling();
    }
    
    EventBus.emit(OrchflowEvents.SYSTEM_READY, undefined);
  }
  
  private setupEventHandlers(): void {
    // Monitor agent output for task completion
    EventBus.on(OrchflowEvents.TERMINAL_OUTPUT, ({ terminalId, output }) => {
      const worker = this.findWorkerByTerminal(terminalId);
      if (worker && worker.currentTask) {
        this.handleWorkerOutput(worker, output);
      }
    });
    
    // Monitor agent failures
    EventBus.on(OrchflowEvents.AGENT_ERROR, ({ agentId, error }) => {
      const worker = this.findWorkerById(agentId);
      if (worker) {
        this.handleWorkerError(worker, new Error(error));
      }
    });
  }
  
  private async createWorkerPool(type: string, count: number): Promise<void> {
    const pool = this.workerPools.get(type) || new Set();
    
    const createPromises: Promise<void>[] = [];
    for (let i = 0; i < count; i++) {
      createPromises.push(this.createWorker(type));
    }
    
    await Promise.all(createPromises);
    this.workerPools.set(type, pool);
  }
  
  private async createWorker(type: string): Promise<void> {
    const workerId = `worker-${type}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    try {
      const agent = await this.agentManager.createAgent({
        name: workerId,
        type: 'custom',
        command: 'echo "Worker ready"',
      });
      
      if (!agent) {
        throw new Error('Failed to create agent');
      }
      
      const worker: SwarmAgent = {
        ...agent,
        workerId,
        taskQueue: [],
        performance: {
          tasksCompleted: 0,
          averageTime: 0,
          successRate: 1.0,
          lastHeartbeat: new Date(),
        },
      };
      
      this.workers.set(workerId, worker);
      
      const pool = this.workerPools.get(type) || new Set();
      pool.add(workerId);
      this.workerPools.set(type, pool);
      
      console.log(`Created swarm worker: ${workerId}`);
      metricsCollector.increment('swarm.workers.created');
      
      this.emit('worker:created', worker);
    } catch (error) {
      console.error(`Failed to create worker: ${error}`);
      metricsCollector.increment('swarm.workers.creation_failed');
    }
  }
  
  async submitSwarmTask(task: Omit<SwarmTask, 'id' | 'status' | 'results' | 'errors'>): Promise<string> {
    const taskId = `swarm-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const swarmTask: SwarmTask = {
      ...task,
      id: taskId,
      status: 'pending',
      results: new Map(),
      errors: new Map(),
    };
    
    this.swarmTasks.set(taskId, swarmTask);
    console.log(`Submitted swarm task: ${taskId} (${task.type}, ${task.subtasks.length} subtasks)`);
    
    // Start execution based on type
    this.executeSwarmTask(swarmTask).catch(error => {
      console.error(`Swarm task failed: ${error}`);
      swarmTask.status = 'failed';
      swarmTask.errors?.set('coordinator', error);
      this.emit('swarm:failed', swarmTask);
    });
    
    return taskId;
  }
  
  private async executeSwarmTask(task: SwarmTask): Promise<void> {
    task.status = 'running';
    task.startTime = new Date();
    this.emit('swarm:started', task);
    
    const timer = metricsCollector.timer('swarm.task.execution', { type: task.type });
    
    try {
      switch (task.type) {
        case 'parallel':
          await this.executeParallel(task);
          break;
          
        case 'sequential':
          await this.executeSequential(task);
          break;
          
        case 'map':
          await this.executeMapReduce(task, 'map');
          break;
          
        case 'reduce':
          await this.executeMapReduce(task, 'reduce');
          break;
          
        case 'pipeline':
          await this.executePipeline(task);
          break;
          
        default:
          throw new Error(`Unknown swarm task type: ${task.type}`);
      }
      
      task.status = 'completed';
      task.endTime = new Date();
      this.emit('swarm:completed', task);
      
      metricsCollector.increment('swarm.tasks.completed', 1, { type: task.type });
    } catch (error) {
      task.status = 'failed';
      task.endTime = new Date();
      task.errors?.set('execution', error as Error);
      
      metricsCollector.increment('swarm.tasks.failed', 1, { type: task.type });
      throw error;
    } finally {
      timer();
    }
  }
  
  private async executeParallel(task: SwarmTask): Promise<void> {
    const maxConcurrency = task.config?.maxConcurrency || this.config.maxWorkers;
    const chunks = this.chunkArray(task.subtasks, maxConcurrency);
    
    for (const chunk of chunks) {
      const promises = chunk.map(subtask => this.executeSubtask(task, subtask));
      await Promise.allSettled(promises);
    }
  }
  
  private async executeSequential(task: SwarmTask): Promise<void> {
    for (const subtask of task.subtasks) {
      await this.executeSubtask(task, subtask);
    }
  }
  
  private async executeMapReduce(task: SwarmTask, phase: 'map' | 'reduce'): Promise<void> {
    if (phase === 'map') {
      // Execute all map tasks in parallel
      await this.executeParallel(task);
      
      // Prepare reduce task
      const reduceTask: SwarmTask = {
        id: `${task.id}-reduce`,
        name: `${task.name} - Reduce`,
        type: 'reduce',
        subtasks: [{
          id: 'reduce-final',
          name: 'Final Reduce',
          command: 'reduce',
        }],
        status: 'pending',
        results: new Map(),
        errors: new Map(),
      };
      
      // Pass map results to reduce
      reduceTask.results?.set('map-results', Array.from(task.results?.values() || []));
      
      await this.executeSwarmTask(reduceTask);
      
      // Copy reduce results back to original task
      task.results?.set('reduce-result', reduceTask.results?.get('reduce-final'));
    } else {
      // Execute reduce phase
      const mapResults = task.results?.get('map-results') || [];
      const reduceResult = this.performReduce(mapResults);
      task.results?.set('reduce-final', reduceResult);
    }
  }
  
  private async executePipeline(task: SwarmTask): Promise<void> {
    let previousResult: any = null;
    
    for (const subtask of task.subtasks) {
      // Pass previous result as input
      if (previousResult !== null) {
        subtask.command = `${subtask.command} --input '${JSON.stringify(previousResult)}'`;
      }
      
      await this.executeSubtask(task, subtask);
      previousResult = task.results?.get(subtask.id);
    }
  }
  
  private async executeSubtask(
    parentTask: SwarmTask,
    subtask: SwarmTask['subtasks'][0]
  ): Promise<void> {
    const timer = metricsCollector.timer('swarm.subtask.execution');
    
    try {
      // Get available worker
      const worker = await this.getAvailableWorker();
      if (!worker) {
        throw new Error('No available workers');
      }
      
      // Assign task to worker
      worker.currentTask = subtask.id;
      this.taskToWorker.set(subtask.id, worker.workerId);
      
      // Execute command on worker
      await this.agentManager.sendCommand(worker.id, subtask.command);
      
      // Wait for completion (with timeout)
      const result = await this.waitForTaskCompletion(
        worker,
        subtask.id,
        parentTask.config?.timeout || this.config.taskTimeout
      );
      
      // Store result
      parentTask.results?.set(subtask.id, result);
      
      // Update worker stats
      worker.performance.tasksCompleted++;
      worker.currentTask = undefined;
      
      metricsCollector.increment('swarm.subtasks.completed');
    } catch (error) {
      parentTask.errors?.set(subtask.id, error as Error);
      
      // Retry if configured
      if (subtask.retryable && parentTask.config?.retryAttempts) {
        console.log(`Retrying subtask ${subtask.id}`);
        await this.executeSubtask(parentTask, subtask);
      } else {
        metricsCollector.increment('swarm.subtasks.failed');
        throw error;
      }
    } finally {
      timer();
    }
  }
  
  private async getAvailableWorker(): Promise<SwarmAgent | null> {
    // Find idle worker
    for (const worker of this.workers.values()) {
      if (!worker.currentTask && worker.status === 'running') {
        return worker;
      }
    }
    
    // Scale up if needed and possible
    if (this.workers.size < this.config.maxWorkers) {
      await this.createWorker('general');
      return this.getAvailableWorker();
    }
    
    // Wait for a worker to become available
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        for (const worker of this.workers.values()) {
          if (!worker.currentTask && worker.status === 'running') {
            clearInterval(checkInterval);
            resolve(worker);
            return;
          }
        }
      }, 1000);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(null);
      }, 30000);
    });
  }
  
  private async waitForTaskCompletion(
    worker: SwarmAgent,
    taskId: string,
    timeout: number
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkInterval = setInterval(() => {
        if (!worker.currentTask || worker.currentTask !== taskId) {
          clearInterval(checkInterval);
          resolve(worker.taskQueue[0]); // Get last result
          return;
        }
        
        if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          reject(new Error(`Task timeout: ${taskId}`));
        }
      }, 1000);
    });
  }
  
  private handleWorkerOutput(worker: SwarmAgent, output: string): void {
    // Parse output for task completion markers
    if (output.includes('TASK_COMPLETE:')) {
      const match = output.match(/TASK_COMPLETE:\s*(.+)/);
      if (match) {
        const result = JSON.parse(match[1]);
        worker.taskQueue.push(result);
        worker.currentTask = undefined;
        
        this.emit('subtask:completed', {
          workerId: worker.workerId,
          taskId: worker.currentTask,
          result,
        });
      }
    }
  }
  
  private handleWorkerError(worker: SwarmAgent, error: Error): void {
    console.error(`Worker ${worker.workerId} error:`, error);
    
    // Mark current task as failed
    if (worker.currentTask) {
      this.emit('subtask:failed', {
        workerId: worker.workerId,
        taskId: worker.currentTask,
        error,
      });
    }
    
    // Update worker performance
    worker.performance.successRate *= 0.9;
    
    // Restart worker if needed
    if (worker.status === 'failed') {
      this.restartWorker(worker);
    }
  }
  
  private async restartWorker(worker: SwarmAgent): Promise<void> {
    console.log(`Restarting worker: ${worker.workerId}`);
    
    // Remove old worker
    this.workers.delete(worker.workerId);
    
    // Create new worker
    const type = this.getWorkerType(worker.workerId);
    await this.createWorker(type);
  }
  
  private startHeartbeatMonitoring(): void {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      
      for (const worker of this.workers.values()) {
        const lastHeartbeat = worker.performance.lastHeartbeat.getTime();
        
        if (now - lastHeartbeat > this.config.heartbeatInterval * 2) {
          console.warn(`Worker ${worker.workerId} missed heartbeat`);
          worker.status = 'unknown' as any;
          
          // Restart if missed too many heartbeats
          if (now - lastHeartbeat > this.config.heartbeatInterval * 4) {
            this.restartWorker(worker);
          }
        }
      }
      
      metricsCollector.gauge('swarm.workers.active', 
        Array.from(this.workers.values()).filter(w => w.status === 'running').length
      );
    }, this.config.heartbeatInterval);
  }
  
  private startAutoScaling(): void {
    this.scalingTimer = setInterval(async () => {
      const pendingTasks = Array.from(this.swarmTasks.values())
        .filter(t => t.status === 'pending').length;
      
      const idleWorkers = Array.from(this.workers.values())
        .filter(w => !w.currentTask && w.status === 'running');
      
      // Scale up if too many pending tasks
      if (pendingTasks > this.config.scaleUpThreshold && 
          this.workers.size < this.config.maxWorkers) {
        const toCreate = Math.min(
          pendingTasks - idleWorkers.length,
          this.config.maxWorkers - this.workers.size
        );
        
        console.log(`Scaling up: creating ${toCreate} workers`);
        for (let i = 0; i < toCreate; i++) {
          await this.createWorker('general');
        }
      }
      
      // Scale down if too many idle workers
      const now = Date.now();
      for (const worker of idleWorkers) {
        const idleTime = now - worker.performance.lastHeartbeat.getTime();
        
        if (idleTime > this.config.scaleDownThreshold && 
            this.workers.size > this.config.minWorkers) {
          console.log(`Scaling down: removing idle worker ${worker.workerId}`);
          await this.removeWorker(worker);
        }
      }
    }, 30000); // Check every 30 seconds
  }
  
  private async removeWorker(worker: SwarmAgent): Promise<void> {
    // Stop the agent
    await this.agentManager.stopAgent(worker.id);
    
    // Remove from collections
    this.workers.delete(worker.workerId);
    
    const type = this.getWorkerType(worker.workerId);
    const pool = this.workerPools.get(type);
    if (pool) {
      pool.delete(worker.workerId);
    }
    
    metricsCollector.increment('swarm.workers.removed');
  }
  
  // Utility methods
  private findWorkerByTerminal(terminalId: string): SwarmAgent | undefined {
    for (const worker of this.workers.values()) {
      if (worker.terminalId === terminalId) {
        return worker;
      }
    }
    return undefined;
  }
  
  private findWorkerById(agentId: string): SwarmAgent | undefined {
    for (const worker of this.workers.values()) {
      if (worker.id === agentId) {
        return worker;
      }
    }
    return undefined;
  }
  
  private getWorkerType(workerId: string): string {
    const match = workerId.match(/worker-([^-]+)-/);
    return match ? match[1] : 'general';
  }
  
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
  
  private performReduce(values: any[]): any {
    // Simple reduce implementation - can be customized
    if (values.length === 0) return null;
    if (values.length === 1) return values[0];
    
    // For now, just merge objects or sum numbers
    if (typeof values[0] === 'number') {
      return values.reduce((sum, val) => sum + val, 0);
    } else if (typeof values[0] === 'object') {
      return Object.assign({}, ...values);
    } else {
      return values;
    }
  }
  
  // Public methods
  async getSwarmStatus(): Promise<{
    tasks: number;
    workers: number;
    activeWorkers: number;
    idleWorkers: number;
    pendingTasks: number;
    completedTasks: number;
    failedTasks: number;
    avgTaskTime: number;
  }> {
    const tasks = Array.from(this.swarmTasks.values());
    const workers = Array.from(this.workers.values());
    
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const avgTaskTime = completedTasks.length > 0
      ? completedTasks.reduce((sum, t) => {
          const time = (t.endTime?.getTime() || 0) - (t.startTime?.getTime() || 0);
          return sum + time;
        }, 0) / completedTasks.length
      : 0;
    
    return {
      tasks: tasks.length,
      workers: workers.length,
      activeWorkers: workers.filter(w => w.currentTask).length,
      idleWorkers: workers.filter(w => !w.currentTask && w.status === 'running').length,
      pendingTasks: tasks.filter(t => t.status === 'pending').length,
      completedTasks: completedTasks.length,
      failedTasks: tasks.filter(t => t.status === 'failed').length,
      avgTaskTime,
    };
  }
  
  getSwarmTask(taskId: string): SwarmTask | undefined {
    return this.swarmTasks.get(taskId);
  }
  
  async cancelSwarmTask(taskId: string): Promise<void> {
    const task = this.swarmTasks.get(taskId);
    if (!task) return;
    
    task.status = 'failed';
    task.errors?.set('cancelled', new Error('Task cancelled by user'));
    
    // Stop any workers working on this task
    for (const [subtaskId, workerId] of this.taskToWorker) {
      if (task.subtasks.some(st => st.id === subtaskId)) {
        const worker = this.workers.get(workerId);
        if (worker && worker.currentTask === subtaskId) {
          worker.currentTask = undefined;
        }
      }
    }
    
    this.emit('swarm:cancelled', task);
  }
  
  async shutdown(): Promise<void> {
    console.log('Shutting down swarm coordinator...');
    
    // Stop timers
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    if (this.scalingTimer) {
      clearInterval(this.scalingTimer);
    }
    
    // Cancel all pending tasks
    for (const task of this.swarmTasks.values()) {
      if (task.status === 'pending' || task.status === 'running') {
        await this.cancelSwarmTask(task.id);
      }
    }
    
    // Stop all workers
    const stopPromises: Promise<void>[] = [];
    for (const worker of this.workers.values()) {
      stopPromises.push(this.removeWorker(worker));
    }
    
    await Promise.all(stopPromises);
    
    this.workers.clear();
    this.swarmTasks.clear();
    this.taskToWorker.clear();
    this.workerPools.clear();
  }
}