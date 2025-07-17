import type { Worker, WorkerType } from '../types/index';
import { OrchFlowCore } from '../core/orchflow-core';
import { MCPClient } from '../primary-terminal/mcp-client';
import fetch from 'node-fetch';
import { existsSync, mkdirSync, rmSync } from 'fs';
import path from 'path';

export interface TestConfig {
  port?: number;
  enablePersistence?: boolean;
  persistencePath?: string;
  enableWebSocket?: boolean;
  maxWorkers?: number;
  apiKey?: string;
  security?: {
    enableAuth?: boolean;
    apiKeys?: string[];
    allowedOrigins?: string[];
  };
}

export class TestEnvironment {
  private core: OrchFlowCore | null = null;
  private mcpClient: MCPClient | null = null;
  private testDir: string | null = null;
  public baseUrl: string = '';
  public apiHeaders: any = {};

  constructor(private config: TestConfig = {}) {
    this.config = {
      port: 0,
      enablePersistence: false,
      enableWebSocket: false,
      maxWorkers: 10,
      apiKey: 'test-api-key',
      security: {
        enableAuth: true,
        apiKeys: ['test-api-key'],
        allowedOrigins: ['http://localhost:*']
      },
      ...config
    };
  }

  async setup(): Promise<void> {
    // Create test directory if persistence is enabled
    if (this.config.enablePersistence) {
      this.testDir = path.join(__dirname, `../../test-data-${Date.now()}`);
      if (existsSync(this.testDir)) {
        rmSync(this.testDir, { recursive: true, force: true });
      }
      mkdirSync(this.testDir, { recursive: true });
    }

    // Start OrchFlow core
    this.core = new OrchFlowCore({
      port: this.config.port,
      enablePersistence: this.config.enablePersistence,
      storageDir: this.testDir || undefined,
      enableWebSocket: this.config.enableWebSocket,
      maxWorkers: this.config.maxWorkers,
      security: this.config.security ? {
        enableAuth: this.config.security.enableAuth || false,
        allowedOrigins: this.config.security.allowedOrigins || ['*']
      } : undefined
    });

    await this.core.start();
    const port = (this.core as any).config.port;
    this.baseUrl = `http://localhost:${port}`;

    this.apiHeaders = {
      'Content-Type': 'application/json',
      'X-API-Key': this.config.apiKey
    };

    // Wait for server to be ready
    await this.waitForServer();
  }

  async teardown(): Promise<void> {
    if (this.mcpClient) {
      await this.mcpClient.disconnect();
    }

    if (this.core) {
      await this.core.stop();
    }

    if (this.testDir && existsSync(this.testDir)) {
      rmSync(this.testDir, { recursive: true, force: true });
    }
  }

  async getMCPClient(): Promise<MCPClient> {
    if (!this.mcpClient) {
      this.mcpClient = new MCPClient(this.baseUrl);
      await this.mcpClient.connect();
    }
    return this.mcpClient;
  }

  private async waitForServer(timeout: number = 10000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(`${this.baseUrl}/health`);
        if (response.status === 200) {
          return;
        }
      } catch (error) {
        // Server not ready yet
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error('Server failed to become ready');
  }
}

export class WorkerFactory {
  static createWorker(overrides: Partial<Worker> = {}): Worker {
    const defaults: Worker = {
      id: `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: 'Test Worker',
      type: 'developer',
      task: 'Test task',
      status: 'active',
      context: {
        conversationHistory: [],
        sharedKnowledge: {
          facts: {},
          patterns: {},
          insights: {},
          bestPractices: {}
        },
        codeArtifacts: [],
        decisions: []
      },
      progress: 0,
      createdAt: new Date(),
      lastActive: new Date(),
      children: [],
      ...overrides
    };

    return defaults;
  }

  static createWorkers(count: number, overrides: Partial<Worker> = {}): Worker[] {
    return Array(count).fill(null).map((_, i) =>
      WorkerFactory.createWorker({
        name: `Test Worker ${i + 1}`,
        ...overrides
      })
    );
  }

  static createWorkersByType(types: WorkerType[]): Worker[] {
    return types.map((type, i) =>
      WorkerFactory.createWorker({
        name: `${type.charAt(0).toUpperCase() + type.slice(1)} Worker ${i + 1}`,
        type
      })
    );
  }
}

export class APITestHelpers {
  constructor(private baseUrl: string, private apiHeaders: any) {}

  async createWorker(task: string, type: WorkerType = 'developer'): Promise<any> {
    const response = await fetch(`${this.baseUrl}/mcp/orchflow_spawn_worker`, {
      method: 'POST',
      headers: this.apiHeaders,
      body: JSON.stringify({ task, type })
    });

    expect(response.status).toBe(200);
    return response.json();
  }

  async createMultipleWorkers(tasks: Array<{task: string, type?: WorkerType}>): Promise<any[]> {
    const promises = tasks.map(({ task, type = 'developer' }) =>
      this.createWorker(task, type)
    );

    const results = await Promise.all(promises);
    return results;
  }

  async processNaturalLanguageTask(input: string, context: any = {}): Promise<any> {
    const response = await fetch(`${this.baseUrl}/mcp/orchflow_natural_task`, {
      method: 'POST',
      headers: this.apiHeaders,
      body: JSON.stringify({
        naturalLanguageInput: input,
        context: [],
        orchflowContext: {
          workers: [],
          quickAccessMap: {},
          availableCommands: [],
          currentTask: null,
          ...context
        }
      })
    });

    expect(response.status).toBe(200);
    return response.json();
  }

  async smartConnect(target: string, context: any = {}): Promise<any> {
    const response = await fetch(`${this.baseUrl}/mcp/orchflow_smart_connect`, {
      method: 'POST',
      headers: this.apiHeaders,
      body: JSON.stringify({
        target,
        orchflowContext: {
          workers: [],
          quickAccessMap: {},
          availableCommands: [],
          ...context
        }
      })
    });

    expect(response.status).toBe(200);
    return response.json();
  }

  async getRichStatus(format: 'summary' | 'detailed' = 'detailed', context: any = {}): Promise<any> {
    const response = await fetch(`${this.baseUrl}/mcp/orchflow_status_rich`, {
      method: 'POST',
      headers: this.apiHeaders,
      body: JSON.stringify({
        format,
        orchflowContext: {
          currentTask: null,
          ...context
        }
      })
    });

    expect(response.status).toBe(200);
    return response.json();
  }

  async storeMemory(key: string, value: any, namespace: string = 'orchflow', ttl: number = 3600): Promise<any> {
    const response = await fetch(`${this.baseUrl}/mcp/mcp__claude-flow__memory_usage`, {
      method: 'POST',
      headers: this.apiHeaders,
      body: JSON.stringify({
        action: 'store',
        key,
        value: JSON.stringify(value),
        namespace,
        ttl
      })
    });

    expect(response.status).toBe(200);
    return response.json();
  }

  async retrieveMemory(key: string, namespace: string = 'orchflow'): Promise<any> {
    const response = await fetch(`${this.baseUrl}/mcp/mcp__claude-flow__memory_usage`, {
      method: 'POST',
      headers: this.apiHeaders,
      body: JSON.stringify({
        action: 'retrieve',
        key,
        namespace
      })
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    return (data as any).value ? JSON.parse((data as any).value) : null;
  }

  async searchMemory(pattern: string, namespace: string = 'orchflow', limit: number = 10): Promise<any> {
    const response = await fetch(`${this.baseUrl}/mcp/mcp__claude-flow__memory_search`, {
      method: 'POST',
      headers: this.apiHeaders,
      body: JSON.stringify({
        pattern,
        namespace,
        limit
      })
    });

    expect(response.status).toBe(200);
    return response.json();
  }
}

export class ContextTestHelpers {
  static createBasicContext(workers: Worker[] = [], currentTask: any = null): any {
    return {
      workers,
      quickAccessMap: [],
      availableCommands: [
        'Create a React component builder',
        'Create an API developer',
        'Create a test engineer',
        'Connect to existing workers',
        'Show all workers'
      ],
      currentTask,
      systemCapabilities: {
        maxWorkers: 10,
        supportedTypes: ['developer', 'architect', 'tester', 'coordinator'],
        features: ['natural-language', 'smart-connect', 'memory-persistence']
      }
    };
  }

  static createTaskContext(objective: string, activeSubtasks: string[] = [], completedTasks: string[] = []): any {
    return {
      mainObjective: objective,
      activeSubtasks,
      completedTasks,
      dependencies: {},
      taskHistory: []
    };
  }

  static createConversationHistory(messages: string[], count: number = 5): any[] {
    return Array(count).fill(null).map((_, i) => ({
      timestamp: new Date(Date.now() - (count - i) * 60000),
      message: messages[i % messages.length]
    }));
  }
}

export class AssertionHelpers {
  static expectValidWorker(worker: any): void {
    expect(worker).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      type: expect.any(String),
      status: expect.any(String),
      progress: expect.any(Number),
      lastActive: expect.any(String),
      conversationHistory: expect.any(Array),
      sharedKnowledge: expect.any(Object)
    });
  }

  static expectValidContext(context: any): void {
    expect(context).toMatchObject({
      workers: expect.any(Array),
      quickAccessMap: expect.any(Object),
      availableCommands: expect.any(Array),
      systemCapabilities: expect.any(Object)
    });
  }

  static expectValidInstructions(instructions: string): void {
    expect(instructions).toContain('# OrchFlow Task Context');
    expect(instructions).toContain('## Relevant OrchFlow Commands:');
    expect(instructions).toContain('Press 1-9');
  }

  static expectValidClaudeMD(content: string): void {
    expect(content).toContain('## OrchFlow Terminal Commands');
    expect(content).toContain('### Available OrchFlow Commands:');
    expect(content).toContain('### Current Worker Status:');
    expect(content).toContain('### Active Task Context:');
  }

  static expectWorkerNaming(workerName: string, expectedPattern: RegExp): void {
    expect(workerName).toMatch(expectedPattern);
  }

  static expectQuickAccessKey(key: any): void {
    expect(key).toBeGreaterThan(0);
    expect(key).toBeLessThan(10);
  }

  static expectMemoryStructure(data: any): void {
    expect(data).toHaveProperty('timestamp');
    expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  }
}

export class PerformanceTestHelpers {
  static async measureExecutionTime<T>(operation: () => Promise<T>): Promise<{result: T, duration: number}> {
    const startTime = performance.now();
    const result = await operation();
    const endTime = performance.now();

    return {
      result,
      duration: endTime - startTime
    };
  }

  static async measureMultipleExecutions<T>(
    operation: () => Promise<T>,
    iterations: number = 10
  ): Promise<{results: T[], avgDuration: number, maxDuration: number}> {
    const results: T[] = [];
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const { result, duration } = await PerformanceTestHelpers.measureExecutionTime(operation);
      results.push(result);
      durations.push(duration);
    }

    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const maxDuration = Math.max(...durations);

    return { results, avgDuration, maxDuration };
  }

  static expectPerformanceThreshold(duration: number, threshold: number, operation: string): void {
    if (duration > threshold) {
      console.warn(`Performance warning: ${operation} took ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`);
    }
    expect(duration).toBeLessThan(threshold);
  }
}

export class MockDataGenerator {
  static generateLargeWorkerDataset(count: number = 50): Worker[] {
    return Array(count).fill(null).map((_, i) => ({
      id: `worker-${i}`,
      name: `Worker ${i}`,
      type: ['developer', 'architect', 'tester', 'coordinator'][i % 4] as WorkerType,
      task: `Task ${i}`,
      status: ['active', 'busy', 'completed'][i % 3] as any,
      context: {
        conversationHistory: Array(Math.floor(Math.random() * 20)).fill(null).map((_, j) => ({
          role: 'user' as const,
          content: `Message ${j} from worker ${i}`,
          timestamp: new Date(Date.now() - Math.random() * 3600000),
          workerId: `worker-${i}`
        })),
        sharedKnowledge: {
          facts: {
            technologies: ['React', 'Node.js', 'PostgreSQL', 'Docker'].slice(0, Math.floor(Math.random() * 4) + 1),
            files: [`src/worker${i}.ts`, `tests/worker${i}.test.ts`]
          },
          patterns: {
            decisions: [`Decision ${i}-1`, `Decision ${i}-2`]
          },
          insights: {},
          bestPractices: {}
        },
        codeArtifacts: [],
        decisions: []
      },
      progress: Math.random() * 100,
      createdAt: new Date(Date.now() - Math.random() * 86400000),
      lastActive: new Date(Date.now() - Math.random() * 86400000),
      children: []
    }));
  }

  static generateComplexTaskContext(): any {
    return {
      mainObjective: 'Build comprehensive e-commerce platform',
      activeSubtasks: [
        'User authentication system',
        'Product catalog management',
        'Shopping cart functionality',
        'Payment processing',
        'Order management',
        'Inventory tracking',
        'Customer support system',
        'Analytics dashboard',
        'Mobile app development',
        'Performance optimization'
      ],
      completedTasks: [
        'Project setup and configuration',
        'Database schema design',
        'API architecture planning',
        'UI/UX wireframes',
        'Development environment setup'
      ],
      dependencies: {
        'Shopping cart functionality': ['User authentication system', 'Product catalog management'],
        'Payment processing': ['Shopping cart functionality', 'User authentication system'],
        'Order management': ['Payment processing', 'Inventory tracking'],
        'Analytics dashboard': ['Order management', 'Customer support system']
      },
      taskHistory: Array(50).fill(null).map((_, i) => ({
        task: `Historical task ${i}`,
        status: ['completed', 'failed', 'cancelled'][i % 3],
        timestamp: new Date(Date.now() - Math.random() * 86400000 * 7),
        duration: Math.random() * 3600000
      }))
    };
  }
}

// Global test configuration
export const TEST_CONFIG = {
  DEFAULT_TIMEOUT: 30000,
  PERFORMANCE_THRESHOLDS: {
    CONTEXT_GENERATION: 50,
    INSTRUCTION_GENERATION: 5,
    CLAUDE_MD_GENERATION: 10,
    MEMORY_OPERATION: 20,
    API_RESPONSE: 1000
  },
  MOCK_DATA_SIZES: {
    SMALL: 10,
    MEDIUM: 50,
    LARGE: 100
  }
};

// Export assertion helpers for Jest
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidWorker(): R;
      toBeValidContext(): R;
      toBeValidInstructions(): R;
      toBeValidClaudeMD(): R;
    }
  }
}

// Custom Jest matchers
if (typeof expect !== 'undefined') {
  expect.extend({
    toBeValidWorker(received) {
      try {
        AssertionHelpers.expectValidWorker(received);
        return {
          message: () => `Expected ${received} to be a valid worker`,
          pass: true
        };
      } catch (error) {
        return {
          message: () => `Expected ${received} to be a valid worker: ${error instanceof Error ? error.message : String(error)}`,
          pass: false
        };
      }
    },
    toBeValidContext(received) {
      try {
        AssertionHelpers.expectValidContext(received);
        return {
          message: () => `Expected ${received} to be a valid context`,
          pass: true
        };
      } catch (error) {
        return {
          message: () => `Expected ${received} to be a valid context: ${error instanceof Error ? error.message : String(error)}`,
          pass: false
        };
      }
    },
    toBeValidInstructions(received) {
      try {
        AssertionHelpers.expectValidInstructions(received);
        return {
          message: () => `Expected ${received} to be valid instructions`,
          pass: true
        };
      } catch (error) {
        return {
          message: () => `Expected ${received} to be valid instructions: ${error instanceof Error ? error.message : String(error)}`,
          pass: false
        };
      }
    },
    toBeValidClaudeMD(received) {
      try {
        AssertionHelpers.expectValidClaudeMD(received);
        return {
          message: () => `Expected ${received} to be valid CLAUDE.md content`,
          pass: true
        };
      } catch (error) {
        return {
          message: () => `Expected ${received} to be valid CLAUDE.md content: ${error instanceof Error ? error.message : String(error)}`,
          pass: false
        };
      }
    }
  });
}