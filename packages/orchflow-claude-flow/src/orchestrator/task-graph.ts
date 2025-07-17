import type { Task } from './orchflow-orchestrator';

export interface TaskGraphStatus {
  totalTasks: number;
  pendingTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
  dependencies: Map<string, string[]>;
}

export class TaskGraph {
  private tasks: Map<string, Task> = new Map();
  private dependencies: Map<string, Set<string>> = new Map();
  private dependents: Map<string, Set<string>> = new Map();

  addTask(task: Task): void {
    this.tasks.set(task.id, task);

    // Initialize dependency tracking
    if (!this.dependencies.has(task.id)) {
      this.dependencies.set(task.id, new Set());
    }
    if (!this.dependents.has(task.id)) {
      this.dependents.set(task.id, new Set());
    }

    // Add dependencies
    task.dependencies.forEach(depId => {
      this.addDependency(task.id, depId);
    });
  }

  addDependency(taskId: string, dependsOn: string): void {
    // taskId depends on dependsOn
    if (!this.dependencies.has(taskId)) {
      this.dependencies.set(taskId, new Set());
    }
    this.dependencies.get(taskId)!.add(dependsOn);

    // dependsOn has taskId as a dependent
    if (!this.dependents.has(dependsOn)) {
      this.dependents.set(dependsOn, new Set());
    }
    this.dependents.get(dependsOn)!.add(taskId);

    // Check for cycles
    if (this.hasCycle(taskId)) {
      // Remove the dependency to prevent the cycle
      this.dependencies.get(taskId)!.delete(dependsOn);
      this.dependents.get(dependsOn)!.delete(taskId);
      throw new Error(`Adding dependency would create a cycle: ${taskId} -> ${dependsOn}`);
    }
  }

  getExecutableTasks(): Task[] {
    const executableTasks: Task[] = [];

    for (const [taskId, task] of this.tasks) {
      if (task.status === 'pending' && this.canExecute(taskId)) {
        executableTasks.push(task);
      }
    }

    // Sort by priority (higher priority first)
    executableTasks.sort((a, b) => b.priority - a.priority);

    return executableTasks;
  }

  private canExecute(taskId: string): boolean {
    const deps = this.dependencies.get(taskId);
    if (!deps || deps.size === 0) {
      return true; // No dependencies
    }

    // Check if all dependencies are completed
    for (const depId of deps) {
      const depTask = this.tasks.get(depId);
      if (!depTask || depTask.status !== 'completed') {
        return false;
      }
    }

    return true;
  }

  markCompleted(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'completed';
      this.emit('taskCompleted', task);
    }
  }

  markFailed(taskId: string, error?: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'failed';
      if (error) {
        task.error = error;
      }
      this.emit('taskFailed', task);

      // Mark dependent tasks as blocked
      this.markDependentsBlocked(taskId);
    }
  }

  private markDependentsBlocked(taskId: string): void {
    const deps = this.dependents.get(taskId);
    if (!deps) {return;}

    for (const depId of deps) {
      const depTask = this.tasks.get(depId);
      if (depTask && depTask.status === 'pending') {
        depTask.status = 'blocked';
        // Recursively mark their dependents
        this.markDependentsBlocked(depId);
      }
    }
  }

  getStatus(): TaskGraphStatus {
    let pendingTasks = 0;
    let runningTasks = 0;
    let completedTasks = 0;
    let failedTasks = 0;

    for (const task of this.tasks.values()) {
      switch (task.status) {
        case 'pending': pendingTasks++; break;
        case 'running': runningTasks++; break;
        case 'completed': completedTasks++; break;
        case 'failed': failedTasks++; break;
      }
    }

    // Convert dependencies to serializable format
    const deps = new Map<string, string[]>();
    for (const [taskId, depSet] of this.dependencies) {
      deps.set(taskId, Array.from(depSet));
    }

    return {
      totalTasks: this.tasks.size,
      pendingTasks,
      runningTasks,
      completedTasks,
      failedTasks,
      dependencies: deps
    };
  }

  detectConflicts(newTask: Task): Promise<ConflictInfo[]> {
    const conflicts: ConflictInfo[] = [];

    // Check for resource conflicts
    for (const [taskId, task] of this.tasks) {
      if (task.status === 'running' || task.status === 'pending') {
        // Check if tasks might conflict
        if (this.tasksConflict(newTask, task)) {
          conflicts.push({
            type: 'resource',
            conflictingTask: taskId,
            description: `Task conflicts with ${task.description}`,
            severity: 'warning'
          });
        }
      }
    }

    return Promise.resolve(conflicts);
  }

  private tasksConflict(task1: Task, task2: Task): boolean {
    // Simple conflict detection based on task types
    // In a real implementation, this would be more sophisticated
    if (task1.type === 'code' && task2.type === 'code') {
      // Check if they might modify the same files
      return this.mightModifySameFiles(task1, task2);
    }

    return false;
  }

  private mightModifySameFiles(task1: Task, task2: Task): boolean {
    // Simplified check - in reality would analyze task descriptions
    const desc1 = task1.description.toLowerCase();
    const desc2 = task2.description.toLowerCase();

    // Look for common keywords that might indicate file conflicts
    const keywords = ['api', 'database', 'auth', 'user', 'config', 'package'];

    for (const keyword of keywords) {
      if (desc1.includes(keyword) && desc2.includes(keyword)) {
        return true;
      }
    }

    return false;
  }

  private hasCycle(startTask: string): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    return this.hasCycleDFS(startTask, visited, recursionStack);
  }

  private hasCycleDFS(
    taskId: string,
    visited: Set<string>,
    recursionStack: Set<string>
  ): boolean {
    visited.add(taskId);
    recursionStack.add(taskId);

    const deps = this.dependencies.get(taskId);
    if (deps) {
      for (const depId of deps) {
        if (!visited.has(depId)) {
          if (this.hasCycleDFS(depId, visited, recursionStack)) {
            return true;
          }
        } else if (recursionStack.has(depId)) {
          return true; // Found a cycle
        }
      }
    }

    recursionStack.delete(taskId);
    return false;
  }

  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  removeTask(taskId: string): void {
    // Remove task and clean up dependencies
    this.tasks.delete(taskId);

    // Remove from dependencies
    const deps = this.dependencies.get(taskId);
    if (deps) {
      deps.forEach(depId => {
        const dependents = this.dependents.get(depId);
        if (dependents) {
          dependents.delete(taskId);
        }
      });
    }
    this.dependencies.delete(taskId);

    // Remove from dependents
    const dependents = this.dependents.get(taskId);
    if (dependents) {
      dependents.forEach(depId => {
        const deps = this.dependencies.get(depId);
        if (deps) {
          deps.delete(taskId);
        }
      });
    }
    this.dependents.delete(taskId);
  }

  clear(): void {
    this.tasks.clear();
    this.dependencies.clear();
    this.dependents.clear();
  }

  // Event emitter functionality (simplified)
  private emit(event: string, data: any): void {
    // In a real implementation, this would use EventEmitter
    // For now, just log
    console.log(`TaskGraph event: ${event}`, data);
  }
}

export interface ConflictInfo {
  type: 'resource' | 'dependency' | 'file' | 'port';
  conflictingTask: string;
  description: string;
  severity: 'warning' | 'error';
}