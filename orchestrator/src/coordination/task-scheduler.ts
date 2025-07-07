import { EventBus, OrchflowEvents } from '../core/event-bus';
import { Task, Agent, SchedulingStrategy, TaskAssignment } from './types';
import { resourceManager } from '../core/resource-manager';
import { metricsCollector } from '../metrics/metrics-collector';

export class TaskScheduler {
  private tasks: Map<string, Task> = new Map();
  private taskQueue: Task[] = [];
  private agents: Map<string, Agent> = new Map();
  private strategy: SchedulingStrategy;
  private schedulingInterval: NodeJS.Timer;
  private taskTimeouts: Map<string, NodeJS.Timer> = new Map();
  
  constructor(
    strategy: SchedulingStrategy,
    private schedulingIntervalMs: number = 1000
  ) {
    this.strategy = strategy;
    this.setupEventHandlers();
    this.startScheduler();
  }
  
  private setupEventHandlers(): void {
    // Track agent lifecycle
    EventBus.on(OrchflowEvents.AGENT_CREATED, ({ agentId, type }) => {
      this.registerAgent({
        id: agentId,
        type,
        capabilities: this.getAgentCapabilities(type),
        status: 'idle',
        currentTasks: [],
        completedTasks: 0,
        failedTasks: 0,
        averageTaskTime: 0,
        health: 100,
      });
    });
    
    EventBus.on(OrchflowEvents.AGENT_STOPPED, ({ agentId }) => {
      this.unregisterAgent(agentId);
    });
    
    // Track task completion
    EventBus.on(OrchflowEvents.COMMAND_COMPLETED, ({ command, result }) => {
      const task = this.findTaskByCommand(command);
      if (task) {
        this.completeTask(task.id, result);
      }
    });
    
    EventBus.on(OrchflowEvents.COMMAND_FAILED, ({ command, error }) => {
      const task = this.findTaskByCommand(command);
      if (task) {
        this.failTask(task.id, error);
      }
    });
  }
  
  private startScheduler(): void {
    this.schedulingInterval = setInterval(() => {
      this.scheduleTasks();
    }, this.schedulingIntervalMs);
  }
  
  async submitTask(task: Omit<Task, 'id' | 'status' | 'retries'>): Promise<string> {
    const id = `task-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const fullTask: Task = {
      ...task,
      id,
      status: 'pending',
      retries: 0,
    };
    
    this.tasks.set(id, fullTask);
    this.taskQueue.push(fullTask);
    
    metricsCollector.increment('scheduler.tasks.submitted');
    
    // Check dependencies
    if (await this.areDependenciesMet(fullTask)) {
      fullTask.status = 'scheduled';
      fullTask.scheduledAt = new Date();
    }
    
    return id;
  }
  
  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    
    if (task.status === 'running') {
      // Stop assigned agents
      if (task.assignedTo) {
        for (const agentId of task.assignedTo) {
          EventBus.emit(OrchflowEvents.AGENT_STOPPED, { agentId });
        }
      }
    }
    
    task.status = 'cancelled';
    this.removeFromQueue(task);
    
    metricsCollector.increment('scheduler.tasks.cancelled');
    
    return true;
  }
  
  private async scheduleTasks(): Promise<void> {
    const timer = metricsCollector.timer('scheduler.scheduling_cycle');
    
    try {
      // Get available agents
      const availableAgents = Array.from(this.agents.values())
        .filter(agent => agent.status === 'idle' && agent.health > 50);
      
      if (availableAgents.length === 0) return;
      
      // Get schedulable tasks
      const schedulableTasks = await this.getSchedulableTasks();
      
      if (schedulableTasks.length === 0) return;
      
      // Apply scheduling strategy
      const assignments = this.strategy.schedule(schedulableTasks, availableAgents);
      
      // Execute assignments
      for (const assignment of assignments) {
        await this.executeAssignment(assignment);
      }
    } finally {
      timer();
    }
  }
  
  private async getSchedulableTasks(): Promise<Task[]> {
    const schedulable: Task[] = [];
    
    for (const task of this.taskQueue) {
      if (task.status !== 'scheduled') continue;
      
      if (await this.areDependenciesMet(task)) {
        schedulable.push(task);
      }
    }
    
    return schedulable;
  }
  
  private async areDependenciesMet(task: Task): Promise<boolean> {
    for (const depId of task.dependencies) {
      const dep = this.tasks.get(depId);
      if (!dep || dep.status !== 'completed') {
        return false;
      }
    }
    return true;
  }
  
  private async executeAssignment(assignment: TaskAssignment): Promise<void> {
    const task = this.tasks.get(assignment.taskId);
    const agent = this.agents.get(assignment.agentId);
    
    if (!task || !agent) return;
    
    // Acquire resources if needed
    if (task.agentRequirements?.type) {
      const acquired = await resourceManager.acquireLock(
        `agent-type:${task.agentRequirements.type}`,
        assignment.agentId,
        'exclusive',
        assignment.priority,
        task.timeout
      );
      
      if (!acquired) {
        // Reschedule task
        task.status = 'scheduled';
        return;
      }
    }
    
    // Update task status
    task.status = 'running';
    task.startedAt = new Date();
    task.assignedTo = [assignment.agentId];
    
    // Update agent status
    agent.status = 'busy';
    agent.currentTasks.push(task.id);
    
    // Set timeout if specified
    if (task.timeout) {
      const timer = setTimeout(() => {
        this.timeoutTask(task.id);
      }, task.timeout);
      this.taskTimeouts.set(task.id, timer);
    }
    
    // Emit task started event
    EventBus.emit(OrchflowEvents.COMMAND_EXECUTED, {
      command: task.name,
      agentId: assignment.agentId,
    });
    
    metricsCollector.increment('scheduler.tasks.started');
    metricsCollector.histogram('scheduler.task_wait_time', 
      Date.now() - (task.scheduledAt?.getTime() || Date.now())
    );
  }
  
  private completeTask(taskId: string, result: any): void {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'running') return;
    
    // Clear timeout
    const timer = this.taskTimeouts.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.taskTimeouts.delete(taskId);
    }
    
    // Update task
    task.status = 'completed';
    task.completedAt = new Date();
    task.result = result;
    
    // Update agent
    if (task.assignedTo) {
      for (const agentId of task.assignedTo) {
        const agent = this.agents.get(agentId);
        if (agent) {
          agent.status = 'idle';
          agent.currentTasks = agent.currentTasks.filter(id => id !== taskId);
          agent.completedTasks++;
          agent.lastTaskTime = new Date();
          
          // Update average task time
          const taskTime = task.completedAt.getTime() - task.startedAt!.getTime();
          agent.averageTaskTime = 
            (agent.averageTaskTime * (agent.completedTasks - 1) + taskTime) / 
            agent.completedTasks;
          
          // Release resources
          if (task.agentRequirements?.type) {
            resourceManager.releaseLock(
              `agent-type:${task.agentRequirements.type}`,
              agentId
            );
          }
        }
      }
    }
    
    // Remove from queue
    this.removeFromQueue(task);
    
    metricsCollector.increment('scheduler.tasks.completed');
    metricsCollector.histogram('scheduler.task_execution_time',
      task.completedAt.getTime() - task.startedAt!.getTime()
    );
    
    // Check for dependent tasks
    this.checkDependentTasks(taskId);
  }
  
  private failTask(taskId: string, error: string): void {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'running') return;
    
    // Clear timeout
    const timer = this.taskTimeouts.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.taskTimeouts.delete(taskId);
    }
    
    task.error = error;
    task.retries++;
    
    // Check if should retry
    if (task.retries < task.maxRetries) {
      task.status = 'scheduled';
      console.log(`Retrying task ${task.name} (${task.retries}/${task.maxRetries})`);
      metricsCollector.increment('scheduler.tasks.retried');
    } else {
      task.status = 'failed';
      task.completedAt = new Date();
      this.removeFromQueue(task);
      metricsCollector.increment('scheduler.tasks.failed');
    }
    
    // Update agent
    if (task.assignedTo) {
      for (const agentId of task.assignedTo) {
        const agent = this.agents.get(agentId);
        if (agent) {
          agent.status = 'idle';
          agent.currentTasks = agent.currentTasks.filter(id => id !== taskId);
          agent.failedTasks++;
          agent.health = Math.max(0, agent.health - 10); // Reduce health
          
          // Release resources
          if (task.agentRequirements?.type) {
            resourceManager.releaseLock(
              `agent-type:${task.agentRequirements.type}`,
              agentId
            );
          }
        }
      }
    }
  }
  
  private timeoutTask(taskId: string): void {
    console.log(`Task ${taskId} timed out`);
    this.failTask(taskId, 'Task timed out');
  }
  
  private checkDependentTasks(completedTaskId: string): void {
    for (const task of this.taskQueue) {
      if (task.status === 'pending' && task.dependencies.includes(completedTaskId)) {
        // Check if all dependencies are now met
        const allMet = task.dependencies.every(depId => {
          const dep = this.tasks.get(depId);
          return dep && dep.status === 'completed';
        });
        
        if (allMet) {
          task.status = 'scheduled';
          task.scheduledAt = new Date();
        }
      }
    }
  }
  
  private removeFromQueue(task: Task): void {
    const index = this.taskQueue.indexOf(task);
    if (index !== -1) {
      this.taskQueue.splice(index, 1);
    }
  }
  
  private findTaskByCommand(command: string): Task | undefined {
    return Array.from(this.tasks.values()).find(t => t.name === command);
  }
  
  registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
    metricsCollector.gauge('scheduler.agents.total', this.agents.size);
  }
  
  unregisterAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    
    // Fail any running tasks
    for (const taskId of agent.currentTasks) {
      this.failTask(taskId, 'Agent went offline');
    }
    
    this.agents.delete(agentId);
    metricsCollector.gauge('scheduler.agents.total', this.agents.size);
  }
  
  private getAgentCapabilities(type: string): string[] {
    const capabilityMap: Record<string, string[]> = {
      dev: ['javascript', 'typescript', 'build', 'serve'],
      test: ['test', 'jest', 'mocha', 'vitest'],
      repl: ['evaluate', 'debug', 'interactive'],
      lint: ['eslint', 'prettier', 'format'],
      build: ['compile', 'bundle', 'package'],
    };
    
    return capabilityMap[type] || [];
  }
  
  getTaskStatus(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }
  
  getQueueStatus(): {
    pending: number;
    scheduled: number;
    running: number;
    total: number;
  } {
    let pending = 0;
    let scheduled = 0;
    let running = 0;
    
    for (const task of this.taskQueue) {
      switch (task.status) {
        case 'pending': pending++; break;
        case 'scheduled': scheduled++; break;
        case 'running': running++; break;
      }
    }
    
    return {
      pending,
      scheduled,
      running,
      total: this.taskQueue.length,
    };
  }
  
  getAgentStatus(): Agent[] {
    return Array.from(this.agents.values());
  }
  
  setStrategy(strategy: SchedulingStrategy): void {
    this.strategy = strategy;
  }
  
  destroy(): void {
    clearInterval(this.schedulingInterval);
    
    // Clear all timeouts
    for (const timer of this.taskTimeouts.values()) {
      clearTimeout(timer);
    }
    
    this.tasks.clear();
    this.taskQueue = [];
    this.agents.clear();
    this.taskTimeouts.clear();
  }
}