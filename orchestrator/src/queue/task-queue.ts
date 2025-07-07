import { EventEmitter } from 'events';
import { Task, Priority } from '../agents/types';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger';

export interface TaskStatus {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  queuedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: any;
  attempts: number;
  agentId?: string;
}

export interface QueueStats {
  totalQueued: number;
  totalRunning: number;
  totalCompleted: number;
  totalFailed: number;
  queuedByPriority: Record<Priority, number>;
  averageWaitTime: number;
  averageExecutionTime: number;
}

export class TaskQueue extends EventEmitter {
  private queues: Map<Priority, Task[]> = new Map([
    [Priority.CRITICAL, []],
    [Priority.HIGH, []],
    [Priority.NORMAL, []],
    [Priority.LOW, []]
  ]);
  
  private taskStatus: Map<string, TaskStatus> = new Map();
  private runningTasks: Set<string> = new Set();
  private completedTasks: Map<string, TaskStatus> = new Map();
  
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second
  private taskTTL = 3600000; // 1 hour
  
  constructor() {
    super();
    this.startCleanupTimer();
  }
  
  /**
   * Enqueue a new task
   */
  async enqueue(task: Task, priority: Priority = Priority.NORMAL): Promise<string> {
    task.id = task.id || uuidv4();
    task.priority = priority;
    task.createdAt = new Date();
    
    // Add to appropriate queue
    const queue = this.queues.get(priority)!;
    queue.push(task);
    
    // Track status
    const status: TaskStatus = {
      id: task.id,
      status: 'queued',
      queuedAt: new Date(),
      attempts: 0
    };
    
    this.taskStatus.set(task.id, status);
    
    logger.info(`Task ${task.id} enqueued with priority ${Priority[priority]}`);
    this.emit('task:enqueued', { task, status });
    
    return task.id;
  }
  
  /**
   * Dequeue next task by priority
   */
  async dequeue(): Promise<Task | null> {
    // Check queues in priority order
    for (const [priority, queue] of Array.from(this.queues.entries()).sort((a, b) => b[0] - a[0])) {
      if (queue.length > 0) {
        const task = queue.shift()!;
        const status = this.taskStatus.get(task.id)!;
        
        status.status = 'running';
        status.startedAt = new Date();
        status.attempts++;
        
        this.runningTasks.add(task.id);
        
        logger.info(`Task ${task.id} dequeued for execution (attempt ${status.attempts})`);
        this.emit('task:dequeued', { task, status });
        
        return task;
      }
    }
    
    return null;
  }
  
  /**
   * Get task status
   */
  getStatus(taskId: string): TaskStatus | undefined {
    return this.taskStatus.get(taskId) || this.completedTasks.get(taskId);
  }
  
  /**
   * Cancel a task
   */
  cancelTask(taskId: string): void {
    const status = this.taskStatus.get(taskId);
    if (!status) {
      throw new Error(`Task ${taskId} not found`);
    }
    
    if (status.status === 'completed' || status.status === 'cancelled') {
      return;
    }
    
    // Remove from queue if still queued
    if (status.status === 'queued') {
      for (const queue of this.queues.values()) {
        const index = queue.findIndex(t => t.id === taskId);
        if (index > -1) {
          queue.splice(index, 1);
          break;
        }
      }
    }
    
    status.status = 'cancelled';
    status.completedAt = new Date();
    
    this.runningTasks.delete(taskId);
    this.moveToCompleted(taskId);
    
    logger.info(`Task ${taskId} cancelled`);
    this.emit('task:cancelled', { taskId, status });
  }
  
  /**
   * Mark task as completed
   */
  markCompleted(taskId: string, result?: any): void {
    const status = this.taskStatus.get(taskId);
    if (!status) {
      throw new Error(`Task ${taskId} not found`);
    }
    
    status.status = 'completed';
    status.completedAt = new Date();
    status.result = result;
    
    this.runningTasks.delete(taskId);
    this.moveToCompleted(taskId);
    
    logger.info(`Task ${taskId} completed successfully`);
    this.emit('task:completed', { taskId, status });
  }
  
  /**
   * Mark task as failed
   */
  markFailed(taskId: string, error: string): void {
    const status = this.taskStatus.get(taskId);
    if (!status) {
      throw new Error(`Task ${taskId} not found`);
    }
    
    status.error = error;
    this.runningTasks.delete(taskId);
    
    // Check if we should retry
    if (status.attempts < this.maxRetries) {
      // Re-queue for retry
      const task = this.findTask(taskId);
      if (task) {
        status.status = 'queued';
        delete status.startedAt;
        
        const queue = this.queues.get(task.priority)!;
        queue.push(task);
        
        logger.info(`Task ${taskId} failed, retrying (attempt ${status.attempts}/${this.maxRetries})`);
        this.emit('task:retry', { taskId, status, delay: this.retryDelay });
        
        // Add delay before retry
        setTimeout(() => {
          this.emit('task:ready', { taskId });
        }, this.retryDelay * status.attempts);
        
        return;
      }
    }
    
    // Max retries exceeded
    status.status = 'failed';
    status.completedAt = new Date();
    
    this.moveToCompleted(taskId);
    
    logger.error(`Task ${taskId} failed after ${status.attempts} attempts: ${error}`);
    this.emit('task:failed', { taskId, status });
  }
  
  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const stats: QueueStats = {
      totalQueued: 0,
      totalRunning: this.runningTasks.size,
      totalCompleted: 0,
      totalFailed: 0,
      queuedByPriority: {
        [Priority.CRITICAL]: 0,
        [Priority.HIGH]: 0,
        [Priority.NORMAL]: 0,
        [Priority.LOW]: 0
      },
      averageWaitTime: 0,
      averageExecutionTime: 0
    };
    
    // Count queued tasks
    for (const [priority, queue] of this.queues) {
      stats.queuedByPriority[priority] = queue.length;
      stats.totalQueued += queue.length;
    }
    
    // Count completed and failed
    let totalWaitTime = 0;
    let totalExecutionTime = 0;
    let completedCount = 0;
    
    for (const status of this.completedTasks.values()) {
      if (status.status === 'completed') {
        stats.totalCompleted++;
        completedCount++;
        
        if (status.startedAt && status.queuedAt) {
          totalWaitTime += status.startedAt.getTime() - status.queuedAt.getTime();
        }
        
        if (status.completedAt && status.startedAt) {
          totalExecutionTime += status.completedAt.getTime() - status.startedAt.getTime();
        }
      } else if (status.status === 'failed') {
        stats.totalFailed++;
      }
    }
    
    // Calculate averages
    if (completedCount > 0) {
      stats.averageWaitTime = totalWaitTime / completedCount;
      stats.averageExecutionTime = totalExecutionTime / completedCount;
    }
    
    return stats;
  }
  
  /**
   * Clear completed tasks older than TTL
   */
  clearOldTasks(): number {
    const now = Date.now();
    const cutoff = now - this.taskTTL;
    let cleared = 0;
    
    for (const [taskId, status] of this.completedTasks) {
      if (status.completedAt && status.completedAt.getTime() < cutoff) {
        this.completedTasks.delete(taskId);
        cleared++;
      }
    }
    
    if (cleared > 0) {
      logger.info(`Cleared ${cleared} old completed tasks`);
    }
    
    return cleared;
  }
  
  private findTask(taskId: string): Task | undefined {
    for (const queue of this.queues.values()) {
      const task = queue.find(t => t.id === taskId);
      if (task) return task;
    }
    return undefined;
  }
  
  private moveToCompleted(taskId: string): void {
    const status = this.taskStatus.get(taskId);
    if (status) {
      this.completedTasks.set(taskId, status);
      this.taskStatus.delete(taskId);
    }
  }
  
  private startCleanupTimer(): void {
    // Clean up old tasks every hour
    setInterval(() => {
      this.clearOldTasks();
    }, 3600000);
  }
}