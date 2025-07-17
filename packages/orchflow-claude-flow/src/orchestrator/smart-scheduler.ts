import { EventEmitter } from 'events';
import { Task } from './orchflow-orchestrator';

export interface SchedulingStrategy {
  name: string;
  score(task: Task, context: SchedulingContext): number;
}

export interface SchedulingContext {
  availableWorkers: number;
  runningTasks: Task[];
  pendingTasks: Task[];
  systemResources: {
    cpuUsage: number;
    memoryUsage: number;
    availableCpu: number;
    availableMemory: number;
  };
  taskHistory: TaskHistoryEntry[];
}

export interface TaskHistoryEntry {
  taskType: string;
  duration: number;
  success: boolean;
  resources: {
    cpuPeak: number;
    memoryPeak: number;
  };
}

export interface SchedulingDecision {
  task: Task;
  score: number;
  strategy: string;
  estimatedDuration: number;
  resourceRequirements: {
    cpu: number;
    memory: number;
  };
}

export class SmartScheduler extends EventEmitter {
  private strategies: Map<string, SchedulingStrategy> = new Map();
  private taskHistory: TaskHistoryEntry[] = [];
  private learningEnabled: boolean = true;
  private maxConcurrentTasks: number = 5;

  constructor() {
    super();
    this.initializeStrategies();
  }

  private initializeStrategies(): void {
    // Priority-based strategy
    this.strategies.set('priority', {
      name: 'priority',
      score: (task: Task) => task.priority * 10
    });

    // Dependency-aware strategy
    this.strategies.set('dependency', {
      name: 'dependency',
      score: (task: Task, context: SchedulingContext) => {
        // Tasks with no dependencies get higher score
        const noDeps = task.dependencies.length === 0 ? 50 : 0;
        // Tasks that unblock others get bonus
        const unblockBonus = this.calculateUnblockBonus(task, context);
        return noDeps + unblockBonus;
      }
    });

    // Resource-efficient strategy
    this.strategies.set('resource', {
      name: 'resource',
      score: (task: Task, context: SchedulingContext) => {
        const estimatedResources = this.estimateResourceUsage(task);
        const availableCpu = context.systemResources.availableCpu;
        const availableMemory = context.systemResources.availableMemory;
        
        // Prefer tasks that fit within available resources
        if (estimatedResources.cpu <= availableCpu && estimatedResources.memory <= availableMemory) {
          return 30;
        }
        return -10; // Penalize resource-heavy tasks when resources are low
      }
    });

    // Time-critical strategy
    this.strategies.set('deadline', {
      name: 'deadline',
      score: (task: Task) => {
        // If task has deadline metadata, prioritize based on urgency
        if (task.deadline) {
          const timeUntilDeadline = new Date(task.deadline).getTime() - Date.now();
          if (timeUntilDeadline < 3600000) { // Less than 1 hour
            return 100;
          } else if (timeUntilDeadline < 86400000) { // Less than 1 day
            return 50;
          }
        }
        return 0;
      }
    });

    // Learning-based strategy
    this.strategies.set('learned', {
      name: 'learned',
      score: (task: Task, context: SchedulingContext) => {
        const prediction = this.predictTaskPerformance(task);
        // Prefer tasks with high success rate and reasonable duration
        return prediction.successRate * 20 - (prediction.estimatedDuration / 60000); // Convert to minutes
      }
    });
  }

  async schedule(tasks?: Task[], context?: SchedulingContext): Promise<SchedulingDecision[]> {
    if (!context) {
      context = await this.gatherContext();
    }

    const pendingTasks = tasks || context.pendingTasks;
    const decisions: SchedulingDecision[] = [];

    // Score each task using all strategies
    for (const task of pendingTasks) {
      const scores = new Map<string, number>();
      let totalScore = 0;

      // Apply each strategy
      for (const [name, strategy] of this.strategies) {
        const score = strategy.score(task, context);
        scores.set(name, score);
        totalScore += score;
      }

      // Create scheduling decision
      const decision: SchedulingDecision = {
        task,
        score: totalScore,
        strategy: this.getBestStrategy(scores),
        estimatedDuration: this.estimateDuration(task),
        resourceRequirements: this.estimateResourceUsage(task)
      };

      decisions.push(decision);
    }

    // Sort by score (highest first)
    decisions.sort((a, b) => b.score - a.score);

    // Filter based on resource availability
    const schedulable = this.filterByResources(decisions, context);

    // Emit scheduling decisions
    this.emit('schedulingComplete', schedulable);

    return schedulable;
  }

  private calculateUnblockBonus(task: Task, context: SchedulingContext): number {
    // Count how many tasks depend on this one
    let dependentCount = 0;
    for (const otherTask of context.pendingTasks) {
      if (otherTask.dependencies.includes(task.id)) {
        dependentCount++;
      }
    }
    return dependentCount * 15;
  }

  private estimateResourceUsage(task: Task): { cpu: number; memory: number } {
    // Use historical data if available
    const historicalData = this.taskHistory.filter(h => h.taskType === task.type);
    
    if (historicalData.length > 0) {
      const avgCpu = historicalData.reduce((sum, h) => sum + h.resources.cpuPeak, 0) / historicalData.length;
      const avgMemory = historicalData.reduce((sum, h) => sum + h.resources.memoryPeak, 0) / historicalData.length;
      return { cpu: avgCpu, memory: avgMemory };
    }

    // Default estimates based on task type
    const defaults: Record<string, { cpu: number; memory: number }> = {
      'research': { cpu: 20, memory: 512 },
      'code': { cpu: 40, memory: 1024 },
      'test': { cpu: 50, memory: 1024 },
      'analysis': { cpu: 60, memory: 2048 },
      'swarm': { cpu: 80, memory: 2048 },
      'hive-mind': { cpu: 100, memory: 4096 }
    };

    return defaults[task.type] || { cpu: 30, memory: 1024 };
  }

  private estimateDuration(task: Task): number {
    // Use historical data if available
    const historicalData = this.taskHistory.filter(h => h.taskType === task.type && h.success);
    
    if (historicalData.length > 0) {
      const avgDuration = historicalData.reduce((sum, h) => sum + h.duration, 0) / historicalData.length;
      return avgDuration;
    }

    // Default estimates (in milliseconds)
    const defaults: Record<string, number> = {
      'research': 300000, // 5 minutes
      'code': 600000, // 10 minutes
      'test': 450000, // 7.5 minutes
      'analysis': 900000, // 15 minutes
      'swarm': 1200000, // 20 minutes
      'hive-mind': 1800000 // 30 minutes
    };

    return defaults[task.type] || 600000;
  }

  private predictTaskPerformance(task: Task): { successRate: number; estimatedDuration: number } {
    const historicalData = this.taskHistory.filter(h => h.taskType === task.type);
    
    if (historicalData.length === 0) {
      return { successRate: 0.8, estimatedDuration: this.estimateDuration(task) };
    }

    const successCount = historicalData.filter(h => h.success).length;
    const successRate = successCount / historicalData.length;
    const estimatedDuration = this.estimateDuration(task);

    return { successRate, estimatedDuration };
  }

  private getBestStrategy(scores: Map<string, number>): string {
    let bestStrategy = 'priority';
    let bestScore = -Infinity;

    for (const [strategy, score] of scores) {
      if (score > bestScore) {
        bestScore = score;
        bestStrategy = strategy;
      }
    }

    return bestStrategy;
  }

  private filterByResources(decisions: SchedulingDecision[], context: SchedulingContext): SchedulingDecision[] {
    const schedulable: SchedulingDecision[] = [];
    let allocatedCpu = 0;
    let allocatedMemory = 0;

    // Account for currently running tasks
    for (const task of context.runningTasks) {
      const resources = this.estimateResourceUsage(task);
      allocatedCpu += resources.cpu;
      allocatedMemory += resources.memory;
    }

    // Schedule tasks that fit within resource limits
    for (const decision of decisions) {
      const requiredCpu = decision.resourceRequirements.cpu;
      const requiredMemory = decision.resourceRequirements.memory;

      if (allocatedCpu + requiredCpu <= context.systemResources.availableCpu &&
          allocatedMemory + requiredMemory <= context.systemResources.availableMemory &&
          context.runningTasks.length + schedulable.length < this.maxConcurrentTasks) {
        
        schedulable.push(decision);
        allocatedCpu += requiredCpu;
        allocatedMemory += requiredMemory;
      }
    }

    return schedulable;
  }

  private async gatherContext(): Promise<SchedulingContext> {
    // In a real implementation, this would gather actual system metrics
    return {
      availableWorkers: 5,
      runningTasks: [],
      pendingTasks: [],
      systemResources: {
        cpuUsage: 30,
        memoryUsage: 2048,
        availableCpu: 70,
        availableMemory: 6144
      },
      taskHistory: this.taskHistory
    };
  }

  recordTaskCompletion(task: Task, duration: number, success: boolean, resourceUsage: { cpuPeak: number; memoryPeak: number }): void {
    const entry: TaskHistoryEntry = {
      taskType: task.type,
      duration,
      success,
      resources: resourceUsage
    };

    this.taskHistory.push(entry);

    // Keep only recent history (last 100 entries)
    if (this.taskHistory.length > 100) {
      this.taskHistory = this.taskHistory.slice(-100);
    }

    // Update learning models if enabled
    if (this.learningEnabled) {
      this.updateLearning(entry);
    }

    this.emit('taskRecorded', entry);
  }

  private updateLearning(entry: TaskHistoryEntry): void {
    // In a real implementation, this could update ML models
    // For now, just emit an event
    this.emit('learningUpdate', entry);
  }

  setMaxConcurrentTasks(max: number): void {
    this.maxConcurrentTasks = max;
  }

  enableLearning(enabled: boolean): void {
    this.learningEnabled = enabled;
  }

  getTaskHistory(): TaskHistoryEntry[] {
    return [...this.taskHistory];
  }

  clearHistory(): void {
    this.taskHistory = [];
  }
}