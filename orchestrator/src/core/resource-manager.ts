import { EventBus, OrchflowEvents } from './event-bus';

export interface Resource {
  id: string;
  type: 'file' | 'port' | 'terminal' | 'process' | 'custom';
  name: string;
  metadata?: Record<string, any>;
}

export interface ResourceLock {
  resourceId: string;
  ownerId: string;
  lockType: 'shared' | 'exclusive';
  acquiredAt: Date;
  priority: number;
  timeout?: number;
}

export interface WaitingRequest {
  resourceId: string;
  requesterId: string;
  lockType: 'shared' | 'exclusive';
  priority: number;
  requestedAt: Date;
  callback: (granted: boolean) => void;
}

export class ResourceManager {
  private resources: Map<string, Resource> = new Map();
  private locks: Map<string, ResourceLock[]> = new Map();
  private waitQueue: WaitingRequest[] = [];
  private deadlockCheckInterval: NodeJS.Timer;
  
  constructor() {
    // Periodically check for deadlocks
    this.deadlockCheckInterval = setInterval(() => {
      this.detectAndResolveDeadlocks();
    }, 5000);
  }
  
  registerResource(resource: Resource): void {
    this.resources.set(resource.id, resource);
    this.locks.set(resource.id, []);
    
    console.log(`Resource registered: ${resource.name} (${resource.type})`);
  }
  
  async acquireLock(
    resourceId: string,
    ownerId: string,
    lockType: 'shared' | 'exclusive' = 'exclusive',
    priority: number = 0,
    timeout?: number
  ): Promise<boolean> {
    const resource = this.resources.get(resourceId);
    if (!resource) {
      throw new Error(`Resource not found: ${resourceId}`);
    }
    
    // Check if lock can be granted immediately
    if (this.canGrantLock(resourceId, ownerId, lockType)) {
      this.grantLock(resourceId, ownerId, lockType, priority, timeout);
      return true;
    }
    
    // Add to wait queue
    return new Promise((resolve) => {
      const request: WaitingRequest = {
        resourceId,
        requesterId: ownerId,
        lockType,
        priority,
        requestedAt: new Date(),
        callback: resolve,
      };
      
      this.waitQueue.push(request);
      this.waitQueue.sort((a, b) => b.priority - a.priority);
      
      // Set timeout if specified
      if (timeout) {
        setTimeout(() => {
          this.removeFromWaitQueue(request);
          resolve(false);
        }, timeout);
      }
    });
  }
  
  releaseLock(resourceId: string, ownerId: string): boolean {
    const resourceLocks = this.locks.get(resourceId);
    if (!resourceLocks) return false;
    
    const index = resourceLocks.findIndex(lock => lock.ownerId === ownerId);
    if (index === -1) return false;
    
    resourceLocks.splice(index, 1);
    
    EventBus.emit(OrchflowEvents.SYSTEM_READY, undefined);
    
    // Process wait queue
    this.processWaitQueue();
    
    return true;
  }
  
  releaseAllLocks(ownerId: string): void {
    for (const [resourceId, resourceLocks] of this.locks) {
      const filtered = resourceLocks.filter(lock => lock.ownerId !== ownerId);
      if (filtered.length < resourceLocks.length) {
        this.locks.set(resourceId, filtered);
      }
    }
    
    this.processWaitQueue();
  }
  
  private canGrantLock(
    resourceId: string,
    ownerId: string,
    lockType: 'shared' | 'exclusive'
  ): boolean {
    const resourceLocks = this.locks.get(resourceId) || [];
    
    if (resourceLocks.length === 0) return true;
    
    // Check if owner already has a lock
    const existingLock = resourceLocks.find(lock => lock.ownerId === ownerId);
    if (existingLock) return false; // Already has a lock
    
    if (lockType === 'exclusive') {
      // Exclusive lock requires no other locks
      return resourceLocks.length === 0;
    } else {
      // Shared lock can coexist with other shared locks
      return resourceLocks.every(lock => lock.lockType === 'shared');
    }
  }
  
  private grantLock(
    resourceId: string,
    ownerId: string,
    lockType: 'shared' | 'exclusive',
    priority: number,
    timeout?: number
  ): void {
    const lock: ResourceLock = {
      resourceId,
      ownerId,
      lockType,
      acquiredAt: new Date(),
      priority,
      timeout,
    };
    
    const resourceLocks = this.locks.get(resourceId) || [];
    resourceLocks.push(lock);
    this.locks.set(resourceId, resourceLocks);
    
    // Set timeout for automatic release
    if (timeout) {
      setTimeout(() => {
        this.releaseLock(resourceId, ownerId);
      }, timeout);
    }
  }
  
  private processWaitQueue(): void {
    const processed: WaitingRequest[] = [];
    
    for (const request of this.waitQueue) {
      if (this.canGrantLock(request.resourceId, request.requesterId, request.lockType)) {
        this.grantLock(
          request.resourceId,
          request.requesterId,
          request.lockType,
          request.priority
        );
        request.callback(true);
        processed.push(request);
      }
    }
    
    // Remove processed requests
    this.waitQueue = this.waitQueue.filter(req => !processed.includes(req));
  }
  
  private removeFromWaitQueue(request: WaitingRequest): void {
    const index = this.waitQueue.indexOf(request);
    if (index !== -1) {
      this.waitQueue.splice(index, 1);
    }
  }
  
  // Deadlock detection using cycle detection in wait-for graph
  private detectAndResolveDeadlocks(): void {
    const waitForGraph = this.buildWaitForGraph();
    const cycles = this.findCycles(waitForGraph);
    
    if (cycles.length > 0) {
      console.warn(`Deadlock detected! ${cycles.length} cycles found`);
      EventBus.emit(OrchflowEvents.SYSTEM_ERROR, {
        error: `Deadlock detected: ${cycles.length} cycles`,
      });
      
      // Resolve deadlocks by releasing locks from lowest priority owners
      for (const cycle of cycles) {
        this.resolveDeadlock(cycle);
      }
    }
  }
  
  private buildWaitForGraph(): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();
    
    // For each waiting request, add edge from requester to lock owners
    for (const request of this.waitQueue) {
      const resourceLocks = this.locks.get(request.resourceId) || [];
      
      if (!graph.has(request.requesterId)) {
        graph.set(request.requesterId, new Set());
      }
      
      for (const lock of resourceLocks) {
        graph.get(request.requesterId)!.add(lock.ownerId);
      }
    }
    
    return graph;
  }
  
  private findCycles(graph: Map<string, Set<string>>): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];
    
    const dfs = (node: string): void => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);
      
      const neighbors = graph.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        } else if (recursionStack.has(neighbor)) {
          // Found a cycle
          const cycleStart = path.indexOf(neighbor);
          const cycle = path.slice(cycleStart);
          cycles.push([...cycle]);
        }
      }
      
      path.pop();
      recursionStack.delete(node);
    };
    
    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }
    
    return cycles;
  }
  
  private resolveDeadlock(cycle: string[]): void {
    // Find the participant with lowest priority locks
    let lowestPriority = Infinity;
    let victimOwnerId: string | null = null;
    
    for (const ownerId of cycle) {
      for (const [_, resourceLocks] of this.locks) {
        const ownerLocks = resourceLocks.filter(lock => lock.ownerId === ownerId);
        for (const lock of ownerLocks) {
          if (lock.priority < lowestPriority) {
            lowestPriority = lock.priority;
            victimOwnerId = ownerId;
          }
        }
      }
    }
    
    if (victimOwnerId) {
      console.log(`Resolving deadlock by releasing locks from: ${victimOwnerId}`);
      this.releaseAllLocks(victimOwnerId);
      
      // Notify waiting requests from victim
      const victimRequests = this.waitQueue.filter(
        req => req.requesterId === victimOwnerId
      );
      for (const request of victimRequests) {
        request.callback(false);
        this.removeFromWaitQueue(request);
      }
    }
  }
  
  // Get current state for monitoring
  getState(): {
    resources: Resource[];
    locks: Array<ResourceLock & { resourceName: string }>;
    waitQueue: Array<WaitingRequest & { resourceName: string }>;
  } {
    const state = {
      resources: Array.from(this.resources.values()),
      locks: [] as Array<ResourceLock & { resourceName: string }>,
      waitQueue: [] as Array<WaitingRequest & { resourceName: string }>,
    };
    
    // Add resource names to locks
    for (const [resourceId, resourceLocks] of this.locks) {
      const resource = this.resources.get(resourceId);
      for (const lock of resourceLocks) {
        state.locks.push({
          ...lock,
          resourceName: resource?.name || 'Unknown',
        });
      }
    }
    
    // Add resource names to wait queue
    for (const request of this.waitQueue) {
      const resource = this.resources.get(request.resourceId);
      state.waitQueue.push({
        ...request,
        resourceName: resource?.name || 'Unknown',
      });
    }
    
    return state;
  }
  
  destroy(): void {
    clearInterval(this.deadlockCheckInterval);
    this.resources.clear();
    this.locks.clear();
    this.waitQueue = [];
  }
}

// Global resource manager instance
export const resourceManager = new ResourceManager();