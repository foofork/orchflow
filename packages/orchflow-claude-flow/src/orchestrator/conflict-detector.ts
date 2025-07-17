import { EventEmitter } from 'events';
import { Task } from './orchflow-orchestrator';
import path from 'path';

export interface ConflictInfo {
  type: 'resource' | 'dependency' | 'file' | 'port';
  conflictingTask: string;
  description: string;
  severity: 'warning' | 'error';
  resolution?: string;
}

export interface ResourceAllocation {
  taskId: string;
  resources: {
    files: string[];
    ports: number[];
    services: string[];
    memory: number;
    cpu: number;
  };
}

export class ConflictDetector extends EventEmitter {
  private activeAllocations: Map<string, ResourceAllocation> = new Map();
  private fileAccessMap: Map<string, Set<string>> = new Map(); // file -> taskIds
  private portUsageMap: Map<number, string> = new Map(); // port -> taskId
  private serviceUsageMap: Map<string, Set<string>> = new Map(); // service -> taskIds

  constructor() {
    super();
  }

  async checkConflicts(task: Task, existingTasks?: Task[]): Promise<ConflictInfo[]> {
    const conflicts: ConflictInfo[] = [];

    // Extract potential resources from task
    const resources = this.extractResourcesFromTask(task);

    // Check file conflicts
    const fileConflicts = this.checkFileConflicts(task, resources.files);
    conflicts.push(...fileConflicts);

    // Check port conflicts
    const portConflicts = this.checkPortConflicts(task, resources.ports);
    conflicts.push(...portConflicts);

    // Check service conflicts
    const serviceConflicts = this.checkServiceConflicts(task, resources.services);
    conflicts.push(...serviceConflicts);

    // Check dependency conflicts
    if (existingTasks) {
      const depConflicts = this.checkDependencyConflicts(task, existingTasks);
      conflicts.push(...depConflicts);
    }

    // Check resource capacity conflicts
    const resourceConflicts = this.checkResourceCapacity(task, resources);
    conflicts.push(...resourceConflicts);

    // Emit conflict detection event
    if (conflicts.length > 0) {
      this.emit('conflictsDetected', { task, conflicts });
    }

    return conflicts;
  }

  private extractResourcesFromTask(task: Task): { files: string[]; ports: number[]; services: string[] } {
    const files: string[] = [];
    const ports: number[] = [];
    const services: string[] = [];

    // Analyze task description for file patterns
    const filePatterns = [
      /(?:modify|edit|update|create|write|read)\s+(?:the\s+)?(?:file\s+)?([^\s]+\.[a-z]{2,4})/gi,
      /(?:in|to|from)\s+([^\s]+\.[a-z]{2,4})/gi,
      /([^\s]+\/[^\s]+\.[a-z]{2,4})/gi
    ];

    for (const pattern of filePatterns) {
      const matches = task.description.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          files.push(match[1]);
        }
      }
    }

    // Analyze for port usage
    const portPattern = /(?:port|listen|bind)\s*(?:on\s*)?(\d{2,5})/gi;
    const portMatches = task.description.matchAll(portPattern);
    for (const match of portMatches) {
      const port = parseInt(match[1]);
      if (port > 0 && port < 65536) {
        ports.push(port);
      }
    }

    // Analyze for service usage
    const servicePatterns = [
      /(?:start|stop|restart|connect to|use)\s+([a-z]+(?:-[a-z]+)*)\s*(?:service|server|database)?/gi,
      /(?:redis|postgres|mysql|mongodb|elasticsearch|rabbitmq|kafka)/gi
    ];

    for (const pattern of servicePatterns) {
      const matches = task.description.matchAll(pattern);
      for (const match of matches) {
        services.push(match[1] || match[0]);
      }
    }

    // Also check task parameters
    if (task.parameters) {
      if (task.parameters.files) {
        files.push(...(Array.isArray(task.parameters.files) ? task.parameters.files : [task.parameters.files]));
      }
      if (task.parameters.ports) {
        ports.push(...(Array.isArray(task.parameters.ports) ? task.parameters.ports : [task.parameters.ports]));
      }
      if (task.parameters.services) {
        services.push(...(Array.isArray(task.parameters.services) ? task.parameters.services : [task.parameters.services]));
      }
    }

    return { files: [...new Set(files)], ports: [...new Set(ports)], services: [...new Set(services)] };
  }

  private checkFileConflicts(task: Task, files: string[]): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];

    for (const file of files) {
      const normalizedPath = path.normalize(file);
      const accessingTasks = this.fileAccessMap.get(normalizedPath);

      if (accessingTasks && accessingTasks.size > 0) {
        // Check if any accessing task might modify the file
        const isWrite = this.isWriteOperation(task.description);
        const conflictingTaskId = Array.from(accessingTasks)[0];

        conflicts.push({
          type: 'file',
          conflictingTask: conflictingTaskId,
          description: `File "${file}" is being accessed by another task`,
          severity: isWrite ? 'error' : 'warning',
          resolution: isWrite ? 'Wait for other task to complete or use file locking' : 'Ensure read-only access'
        });
      }
    }

    return conflicts;
  }

  private checkPortConflicts(task: Task, ports: number[]): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];

    for (const port of ports) {
      const usingTask = this.portUsageMap.get(port);
      
      if (usingTask) {
        conflicts.push({
          type: 'port',
          conflictingTask: usingTask,
          description: `Port ${port} is already in use`,
          severity: 'error',
          resolution: `Use a different port or stop the conflicting task`
        });
      }
    }

    return conflicts;
  }

  private checkServiceConflicts(task: Task, services: string[]): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];

    for (const service of services) {
      const usingTasks = this.serviceUsageMap.get(service);
      
      if (usingTasks && usingTasks.size > 0) {
        // Some services can be shared, others cannot
        const isExclusive = this.isExclusiveService(service);
        
        if (isExclusive) {
          conflicts.push({
            type: 'resource',
            conflictingTask: Array.from(usingTasks)[0],
            description: `Service "${service}" requires exclusive access`,
            severity: 'error',
            resolution: 'Wait for service to be available or use a different instance'
          });
        } else if (usingTasks.size >= this.getServiceCapacity(service)) {
          conflicts.push({
            type: 'resource',
            conflictingTask: Array.from(usingTasks)[0],
            description: `Service "${service}" has reached capacity`,
            severity: 'warning',
            resolution: 'Consider scaling the service or queueing the task'
          });
        }
      }
    }

    return conflicts;
  }

  private checkDependencyConflicts(task: Task, existingTasks: Task[]): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];

    // Check for circular dependencies
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    if (this.hasCircularDependency(task, existingTasks, visited, recursionStack)) {
      conflicts.push({
        type: 'dependency',
        conflictingTask: task.id,
        description: 'Circular dependency detected',
        severity: 'error',
        resolution: 'Remove circular dependencies from task graph'
      });
    }

    // Check for missing dependencies
    for (const depId of task.dependencies) {
      const depTask = existingTasks.find(t => t.id === depId);
      if (!depTask) {
        conflicts.push({
          type: 'dependency',
          conflictingTask: depId,
          description: `Dependency "${depId}" not found`,
          severity: 'error',
          resolution: 'Ensure all dependencies are defined'
        });
      } else if (depTask.status === 'failed') {
        conflicts.push({
          type: 'dependency',
          conflictingTask: depId,
          description: `Dependency "${depId}" has failed`,
          severity: 'error',
          resolution: 'Fix or retry the failed dependency'
        });
      }
    }

    return conflicts;
  }

  private checkResourceCapacity(task: Task, resources: any): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];

    // Calculate total resource usage
    let totalCpu = 0;
    let totalMemory = 0;

    for (const allocation of this.activeAllocations.values()) {
      totalCpu += allocation.resources.cpu;
      totalMemory += allocation.resources.memory;
    }

    // Estimate task resource needs
    const estimatedCpu = this.estimateCpuUsage(task);
    const estimatedMemory = this.estimateMemoryUsage(task);

    // Check against limits (these would be configurable)
    const cpuLimit = 100; // percentage
    const memoryLimit = 8192; // MB

    if (totalCpu + estimatedCpu > cpuLimit) {
      conflicts.push({
        type: 'resource',
        conflictingTask: 'system',
        description: `CPU usage would exceed limit (${totalCpu + estimatedCpu}% > ${cpuLimit}%)`,
        severity: 'warning',
        resolution: 'Wait for CPU resources or optimize task'
      });
    }

    if (totalMemory + estimatedMemory > memoryLimit) {
      conflicts.push({
        type: 'resource',
        conflictingTask: 'system',
        description: `Memory usage would exceed limit (${totalMemory + estimatedMemory}MB > ${memoryLimit}MB)`,
        severity: 'warning',
        resolution: 'Wait for memory resources or optimize task'
      });
    }

    return conflicts;
  }

  allocateResources(taskId: string, resources: any): void {
    const allocation: ResourceAllocation = {
      taskId,
      resources: {
        files: resources.files || [],
        ports: resources.ports || [],
        services: resources.services || [],
        memory: resources.memory || 0,
        cpu: resources.cpu || 0
      }
    };

    // Update allocation maps
    this.activeAllocations.set(taskId, allocation);

    // Update file access map
    for (const file of allocation.resources.files) {
      if (!this.fileAccessMap.has(file)) {
        this.fileAccessMap.set(file, new Set());
      }
      this.fileAccessMap.get(file)!.add(taskId);
    }

    // Update port usage map
    for (const port of allocation.resources.ports) {
      this.portUsageMap.set(port, taskId);
    }

    // Update service usage map
    for (const service of allocation.resources.services) {
      if (!this.serviceUsageMap.has(service)) {
        this.serviceUsageMap.set(service, new Set());
      }
      this.serviceUsageMap.get(service)!.add(taskId);
    }

    this.emit('resourcesAllocated', { taskId, allocation });
  }

  releaseResources(taskId: string): void {
    const allocation = this.activeAllocations.get(taskId);
    if (!allocation) return;

    // Release file access
    for (const file of allocation.resources.files) {
      this.fileAccessMap.get(file)?.delete(taskId);
      if (this.fileAccessMap.get(file)?.size === 0) {
        this.fileAccessMap.delete(file);
      }
    }

    // Release ports
    for (const port of allocation.resources.ports) {
      if (this.portUsageMap.get(port) === taskId) {
        this.portUsageMap.delete(port);
      }
    }

    // Release services
    for (const service of allocation.resources.services) {
      this.serviceUsageMap.get(service)?.delete(taskId);
      if (this.serviceUsageMap.get(service)?.size === 0) {
        this.serviceUsageMap.delete(service);
      }
    }

    // Remove allocation
    this.activeAllocations.delete(taskId);

    this.emit('resourcesReleased', { taskId });
  }

  private isWriteOperation(description: string): boolean {
    const writeKeywords = ['write', 'modify', 'update', 'create', 'delete', 'save', 'edit', 'append'];
    const lowerDesc = description.toLowerCase();
    return writeKeywords.some(keyword => lowerDesc.includes(keyword));
  }

  private isExclusiveService(service: string): boolean {
    const exclusiveServices = ['mysql', 'postgres', 'sqlite'];
    return exclusiveServices.includes(service.toLowerCase());
  }

  private getServiceCapacity(service: string): number {
    const capacities: Record<string, number> = {
      'redis': 100,
      'elasticsearch': 50,
      'mongodb': 50,
      'rabbitmq': 100,
      'kafka': 50
    };
    return capacities[service.toLowerCase()] || 10;
  }

  private estimateCpuUsage(task: Task): number {
    const cpuEstimates: Record<string, number> = {
      'research': 20,
      'code': 40,
      'test': 50,
      'analysis': 60,
      'swarm': 80,
      'hive-mind': 100
    };
    return cpuEstimates[task.type] || 30;
  }

  private estimateMemoryUsage(task: Task): number {
    const memoryEstimates: Record<string, number> = {
      'research': 512,
      'code': 1024,
      'test': 1024,
      'analysis': 2048,
      'swarm': 2048,
      'hive-mind': 4096
    };
    return memoryEstimates[task.type] || 1024;
  }

  private hasCircularDependency(
    task: Task, 
    existingTasks: Task[], 
    visited: Set<string>, 
    recursionStack: Set<string>
  ): boolean {
    visited.add(task.id);
    recursionStack.add(task.id);

    for (const depId of task.dependencies) {
      if (!visited.has(depId)) {
        const depTask = existingTasks.find(t => t.id === depId);
        if (depTask && this.hasCircularDependency(depTask, existingTasks, visited, recursionStack)) {
          return true;
        }
      } else if (recursionStack.has(depId)) {
        return true;
      }
    }

    recursionStack.delete(task.id);
    return false;
  }

  getActiveAllocations(): Map<string, ResourceAllocation> {
    return new Map(this.activeAllocations);
  }

  clearAllocations(): void {
    this.activeAllocations.clear();
    this.fileAccessMap.clear();
    this.portUsageMap.clear();
    this.serviceUsageMap.clear();
  }
}