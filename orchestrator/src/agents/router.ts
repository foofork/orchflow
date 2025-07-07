import { EventEmitter } from 'events';
import { 
  AgentHandler, 
  AgentInstance, 
  AgentManifest, 
  AgentResponse, 
  AgentStatus, 
  Task,
  Priority
} from './types';
import { logger } from '../logger';
import { v4 as uuidv4 } from 'uuid';

export class AgentRouter extends EventEmitter {
  private agents: Map<string, AgentInstance> = new Map();
  private taskQueue: Map<Priority, Task[]> = new Map([
    [Priority.CRITICAL, []],
    [Priority.HIGH, []],
    [Priority.NORMAL, []],
    [Priority.LOW, []]
  ]);
  private activeTasksPerAgent: Map<string, Set<string>> = new Map();
  private routingRules: Map<string, string[]> = new Map(); // task type -> agent IDs
  
  constructor() {
    super();
    this.setupTaskProcessor();
  }

  /**
   * Register a new agent with the router
   */
  async registerAgent(type: string, handler: AgentHandler): Promise<string> {
    const agentId = `${type}-${uuidv4().slice(0, 8)}`;
    
    try {
      // Initialize the agent
      await handler.initialize();
      
      const instance: AgentInstance = {
        id: agentId,
        manifest: handler.manifest,
        handler,
        status: AgentStatus.READY,
        startedAt: new Date(),
        lastActivity: new Date(),
        metrics: {
          tasksCompleted: 0,
          tasksFailed: 0,
          totalExecutionTime: 0,
          averageExecutionTime: 0
        }
      };
      
      this.agents.set(agentId, instance);
      this.activeTasksPerAgent.set(agentId, new Set());
      
      // Update routing rules based on agent capabilities
      for (const capability of handler.manifest.capabilities) {
        if (!this.routingRules.has(capability)) {
          this.routingRules.set(capability, []);
        }
        this.routingRules.get(capability)!.push(agentId);
      }
      
      logger.info(`Agent registered: ${agentId} (${handler.manifest.name})`);
      this.emit('agent:registered', { agentId, manifest: handler.manifest });
      
      return agentId;
    } catch (error) {
      logger.error(`Failed to register agent ${type}:`, error);
      throw error;
    }
  }

  /**
   * Route a task to an appropriate agent
   */
  async routeTask(task: Task): Promise<AgentResponse> {
    // Add to queue
    const queue = this.taskQueue.get(task.priority)!;
    queue.push(task);
    
    this.emit('task:queued', { taskId: task.id, type: task.type });
    
    // Process queue will handle execution
    return new Promise((resolve, reject) => {
      const timeout = task.timeout || 30000; // 30s default
      
      const timer = setTimeout(() => {
        reject(new Error(`Task ${task.id} timed out after ${timeout}ms`));
      }, timeout);
      
      this.once(`task:completed:${task.id}`, (response: AgentResponse) => {
        clearTimeout(timer);
        resolve(response);
      });
      
      this.once(`task:failed:${task.id}`, (error: Error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  /**
   * Get available agents and their status
   */
  getAvailableAgents(): AgentManifest[] {
    return Array.from(this.agents.values())
      .filter(agent => agent.status === AgentStatus.READY)
      .map(agent => agent.manifest);
  }

  /**
   * Get agent instance by ID
   */
  getAgent(agentId: string): AgentInstance | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Unregister an agent
   */
  async unregisterAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    
    // Update status
    agent.status = AgentStatus.SHUTTING_DOWN;
    
    // Wait for active tasks to complete
    const activeTasks = this.activeTasksPerAgent.get(agentId);
    if (activeTasks && activeTasks.size > 0) {
      logger.info(`Waiting for ${activeTasks.size} active tasks to complete for agent ${agentId}`);
      // TODO: Implement graceful task completion wait
    }
    
    // Shutdown the agent
    try {
      await agent.handler.shutdown();
    } catch (error) {
      logger.error(`Error shutting down agent ${agentId}:`, error);
    }
    
    // Remove from routing rules
    for (const [taskType, agentIds] of this.routingRules.entries()) {
      const index = agentIds.indexOf(agentId);
      if (index > -1) {
        agentIds.splice(index, 1);
        if (agentIds.length === 0) {
          this.routingRules.delete(taskType);
        }
      }
    }
    
    // Clean up
    this.agents.delete(agentId);
    this.activeTasksPerAgent.delete(agentId);
    
    logger.info(`Agent unregistered: ${agentId}`);
    this.emit('agent:unregistered', { agentId });
  }

  /**
   * Process tasks from the queue
   */
  private setupTaskProcessor(): void {
    setInterval(() => {
      this.processTasks();
    }, 100); // Process every 100ms
  }

  private async processTasks(): Promise<void> {
    // Process in priority order
    for (const [priority, queue] of Array.from(this.taskQueue.entries()).sort((a, b) => b[0] - a[0])) {
      while (queue.length > 0) {
        const task = queue[0];
        const agentId = this.selectAgentForTask(task);
        
        if (!agentId) {
          // No available agent for this task type
          break;
        }
        
        const agent = this.agents.get(agentId)!;
        
        // Check if agent can take more tasks
        const activeTasks = this.activeTasksPerAgent.get(agentId)!;
        const maxConcurrent = agent.manifest.resourceLimits?.maxConcurrentTasks || 5;
        
        if (activeTasks.size >= maxConcurrent) {
          // Agent is at capacity, try next priority
          break;
        }
        
        // Remove from queue and execute
        queue.shift();
        this.executeTask(agent, task);
      }
    }
  }

  private selectAgentForTask(task: Task): string | null {
    const eligibleAgents = this.routingRules.get(task.type) || [];
    
    // Find agent with lowest load
    let selectedAgent: string | null = null;
    let minLoad = Infinity;
    
    for (const agentId of eligibleAgents) {
      const agent = this.agents.get(agentId);
      if (!agent || agent.status !== AgentStatus.READY) {
        continue;
      }
      
      const activeTasks = this.activeTasksPerAgent.get(agentId)!.size;
      if (activeTasks < minLoad) {
        minLoad = activeTasks;
        selectedAgent = agentId;
      }
    }
    
    return selectedAgent;
  }

  private async executeTask(agent: AgentInstance, task: Task): Promise<void> {
    const startTime = Date.now();
    const activeTasks = this.activeTasksPerAgent.get(agent.id)!;
    
    activeTasks.add(task.id);
    agent.status = AgentStatus.BUSY;
    agent.lastActivity = new Date();
    
    logger.info(`Executing task ${task.id} on agent ${agent.id}`);
    this.emit('task:started', { taskId: task.id, agentId: agent.id });
    
    try {
      const response = await agent.handler.execute(task);
      
      // Update metrics
      const executionTime = Date.now() - startTime;
      agent.metrics.tasksCompleted++;
      agent.metrics.totalExecutionTime += executionTime;
      agent.metrics.averageExecutionTime = 
        agent.metrics.totalExecutionTime / agent.metrics.tasksCompleted;
      
      // Add execution time to response
      response.metrics = {
        ...response.metrics,
        executionTime
      };
      
      logger.info(`Task ${task.id} completed successfully`);
      this.emit(`task:completed:${task.id}`, response);
      this.emit('task:completed', { taskId: task.id, response });
      
    } catch (error) {
      agent.metrics.tasksFailed++;
      
      logger.error(`Task ${task.id} failed:`, error);
      this.emit(`task:failed:${task.id}`, error);
      this.emit('task:failed', { taskId: task.id, error });
      
    } finally {
      activeTasks.delete(task.id);
      
      if (activeTasks.size === 0) {
        agent.status = AgentStatus.READY;
      }
    }
  }

  /**
   * Get router statistics
   */
  getStats() {
    const stats = {
      totalAgents: this.agents.size,
      agentsByStatus: {} as Record<AgentStatus, number>,
      queuedTasks: 0,
      activeTasks: 0,
      tasksByPriority: {} as Record<Priority, number>
    };
    
    // Count agents by status
    for (const agent of this.agents.values()) {
      stats.agentsByStatus[agent.status] = (stats.agentsByStatus[agent.status] || 0) + 1;
    }
    
    // Count queued tasks
    for (const [priority, queue] of this.taskQueue) {
      stats.tasksByPriority[priority] = queue.length;
      stats.queuedTasks += queue.length;
    }
    
    // Count active tasks
    for (const tasks of this.activeTasksPerAgent.values()) {
      stats.activeTasks += tasks.size;
    }
    
    return stats;
  }
}