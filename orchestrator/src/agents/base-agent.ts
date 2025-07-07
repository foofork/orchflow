import { 
  AgentHandler, 
  AgentManifest, 
  AgentResponse, 
  Task,
  Permission,
  ResourceLimits 
} from './types';
import { logger } from '../logger';

/**
 * Base class for all agents
 */
export abstract class BaseAgent implements AgentHandler {
  protected initialized = false;
  
  constructor(public manifest: AgentManifest) {}
  
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error(`Agent ${this.manifest.id} already initialized`);
    }
    
    logger.info(`Initializing agent: ${this.manifest.name}`);
    
    // Perform common initialization
    await this.validatePermissions();
    await this.setupResources();
    
    // Agent-specific initialization
    await this.onInitialize();
    
    this.initialized = true;
    logger.info(`Agent initialized: ${this.manifest.name}`);
  }
  
  async execute(task: Task): Promise<AgentResponse> {
    if (!this.initialized) {
      throw new Error(`Agent ${this.manifest.id} not initialized`);
    }
    
    const startTime = Date.now();
    
    try {
      // Validate task
      this.validateTask(task);
      
      // Execute agent-specific logic
      const result = await this.onExecute(task);
      
      return {
        taskId: task.id,
        status: 'success',
        result,
        metrics: {
          executionTime: Date.now() - startTime,
          memoryUsed: process.memoryUsage().heapUsed
        }
      };
      
    } catch (error: any) {
      logger.error(`Agent ${this.manifest.id} task failed:`, error);
      
      return {
        taskId: task.id,
        status: 'failure',
        error: error.message || 'Unknown error',
        metrics: {
          executionTime: Date.now() - startTime,
          memoryUsed: process.memoryUsage().heapUsed
        }
      };
    }
  }
  
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }
    
    logger.info(`Shutting down agent: ${this.manifest.name}`);
    
    // Agent-specific cleanup
    await this.onShutdown();
    
    // Common cleanup
    await this.cleanupResources();
    
    this.initialized = false;
    logger.info(`Agent shut down: ${this.manifest.name}`);
  }
  
  // Abstract methods to be implemented by subclasses
  protected abstract onInitialize(): Promise<void>;
  protected abstract onExecute(task: Task): Promise<any>;
  protected abstract onShutdown(): Promise<void>;
  
  // Common helper methods
  protected validateTask(task: Task): void {
    if (!this.manifest.capabilities.includes(task.type)) {
      throw new Error(`Agent does not support task type: ${task.type}`);
    }
  }
  
  private async validatePermissions(): Promise<void> {
    // TODO: Implement permission validation
    // Check if agent has required permissions in the current context
  }
  
  private async setupResources(): Promise<void> {
    // TODO: Set up resource limits
    // Configure memory limits, CPU quotas, etc.
  }
  
  private async cleanupResources(): Promise<void> {
    // TODO: Clean up any allocated resources
  }
}

/**
 * Simple example agent for file operations
 */
export class FileAgent extends BaseAgent {
  constructor() {
    super({
      id: 'file-agent',
      name: 'File Operations Agent',
      version: '1.0.0',
      description: 'Handles file read/write operations',
      capabilities: ['file:read', 'file:write', 'file:list'],
      requiredPermissions: [Permission.FILE_READ, Permission.FILE_WRITE],
      resourceLimits: {
        maxMemoryMB: 128,
        maxCpuPercent: 25,
        maxExecutionTime: 30000,
        maxConcurrentTasks: 10
      }
    });
  }
  
  protected async onInitialize(): Promise<void> {
    // File agent specific initialization
  }
  
  protected async onExecute(task: Task): Promise<any> {
    switch (task.type) {
      case 'file:read':
        return this.readFile(task.payload.path);
      case 'file:write':
        return this.writeFile(task.payload.path, task.payload.content);
      case 'file:list':
        return this.listDirectory(task.payload.path);
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }
  
  protected async onShutdown(): Promise<void> {
    // Cleanup any open file handles
  }
  
  private async readFile(path: string): Promise<string> {
    const fs = await import('fs/promises');
    return fs.readFile(path, 'utf-8');
  }
  
  private async writeFile(path: string, content: string): Promise<void> {
    const fs = await import('fs/promises');
    await fs.writeFile(path, content, 'utf-8');
  }
  
  private async listDirectory(path: string): Promise<string[]> {
    const fs = await import('fs/promises');
    return fs.readdir(path);
  }
}