/**
 * Unified Context Manager
 * Combines OrchFlowMemoryContext, ConversationContextManager, and general ContextManager
 * Provides centralized context and memory management for all components
 */

import type { MCPClient } from '../primary-terminal/mcp-client';
import { EventEmitter } from 'events';

export interface WorkerContext {
  workerId: string;
  workerName: string;
  taskDescription: string;
  progress: number;
  startTime: Date;
  lastUpdate: Date;
  decisions: string[];
  currentFocus: string;
  dependencies: string[];
  completedMilestones: string[];
}

export interface TaskContext {
  taskId: string;
  input: string;
  taskType: string;
  assignedWorker: string;
  startTime: Date;
  completionTime?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  successfulCommand?: string;
  context: any;
}

export interface ConversationContext {
  sessionId: string;
  startTime: Date;
  lastUpdate: Date;
  messages: ConversationMessage[];
  currentTopic?: string;
  decisions: string[];
  artifacts: any[];
}

export interface ConversationMessage {
  timestamp: Date;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: any;
}

export interface MemorySearchResult {
  key: string;
  value: any;
  timestamp: Date;
  similarity: number;
}

export interface ContextManagerOptions {
  mcpClient?: MCPClient;
  memoryNamespace?: string;
  defaultTTL?: number;
  enablePersistence?: boolean;
}

/**
 * Unified ContextManager that handles all context and memory operations
 */
export class ContextManager extends EventEmitter {
  private static instance: ContextManager;
  private mcpClient?: MCPClient;
  private memoryNamespace: string;
  private defaultTTL: number;
  private enablePersistence: boolean;

  // In-memory caches
  private workerContexts: Map<string, WorkerContext> = new Map();
  private taskContexts: Map<string, TaskContext> = new Map();
  private conversationContexts: Map<string, ConversationContext> = new Map();
  private currentSessionId?: string;

  private constructor(options: ContextManagerOptions = {}) {
    super();
    this.mcpClient = options.mcpClient;
    this.memoryNamespace = options.memoryNamespace || 'orchflow';
    this.defaultTTL = options.defaultTTL || 3600; // 1 hour default
    this.enablePersistence = options.enablePersistence ?? true;
  }

  static getInstance(options?: ContextManagerOptions): ContextManager {
    if (!ContextManager.instance) {
      ContextManager.instance = new ContextManager(options);
    }
    return ContextManager.instance;
  }

  /**
   * Set MCP client for persistence
   */
  setMCPClient(mcpClient: MCPClient): void {
    this.mcpClient = mcpClient;
  }

  /**
   * Initialize a new session
   */
  async initializeSession(sessionId?: string): Promise<string> {
    this.currentSessionId = sessionId || `session-${Date.now()}`;

    const context: ConversationContext = {
      sessionId: this.currentSessionId,
      startTime: new Date(),
      lastUpdate: new Date(),
      messages: [],
      decisions: [],
      artifacts: []
    };

    this.conversationContexts.set(this.currentSessionId, context);

    if (this.enablePersistence && this.mcpClient) {
      await this.persistConversationContext(this.currentSessionId, context);
    }

    this.emit('session:initialized', this.currentSessionId);
    return this.currentSessionId;
  }

  /**
   * Store worker context
   */
  async storeWorkerContext(workerId: string, context: WorkerContext): Promise<void> {
    // Update in-memory cache
    this.workerContexts.set(workerId, context);

    // Persist if enabled
    if (this.enablePersistence && this.mcpClient) {
      try {
        const memoryKey = `${this.memoryNamespace}/workers/${workerId}/context`;
        const memoryValue = {
          ...context,
          timestamp: new Date().toISOString(),
          lastUpdate: new Date().toISOString()
        };

        await this.mcpClient.invokeTool('mcp__claude-flow__memory_usage', {
          action: 'store',
          key: memoryKey,
          value: JSON.stringify(memoryValue),
          namespace: this.memoryNamespace,
          ttl: this.defaultTTL * 8 // 8 hours for worker context
        });

        this.emit('worker:context:stored', workerId);
      } catch (error) {
        console.warn('Failed to persist worker context:', error);
        this.emit('worker:context:persist:error', { workerId, error });
      }
    }
  }

  /**
   * Get worker context
   */
  async getWorkerContext(workerId: string): Promise<WorkerContext | null> {
    // Check in-memory cache first
    const cached = this.workerContexts.get(workerId);
    if (cached) {
      return cached;
    }

    // Try to retrieve from persistence
    if (this.enablePersistence && this.mcpClient) {
      try {
        const memoryKey = `${this.memoryNamespace}/workers/${workerId}/context`;
        const result = await this.mcpClient.invokeTool('mcp__claude-flow__memory_usage', {
          action: 'retrieve',
          key: memoryKey,
          namespace: this.memoryNamespace
        });

        if (result.value) {
          const context = JSON.parse(result.value);
          this.workerContexts.set(workerId, context);
          return context;
        }
      } catch (error) {
        console.warn('Failed to retrieve worker context:', error);
      }
    }

    return null;
  }

  /**
   * Store task context
   */
  async storeTaskContext(taskEntry: TaskContext): Promise<void> {
    // Update in-memory cache
    this.taskContexts.set(taskEntry.taskId, taskEntry);

    // Persist if enabled
    if (this.enablePersistence && this.mcpClient) {
      try {
        const memoryKey = `${this.memoryNamespace}/tasks/${taskEntry.taskId}`;
        const memoryValue = {
          ...taskEntry,
          timestamp: new Date().toISOString()
        };

        await this.mcpClient.invokeTool('mcp__claude-flow__memory_usage', {
          action: 'store',
          key: memoryKey,
          value: JSON.stringify(memoryValue),
          namespace: this.memoryNamespace,
          ttl: this.defaultTTL * 24 // 24 hours for task history
        });

        this.emit('task:context:stored', taskEntry.taskId);
      } catch (error) {
        console.warn('Failed to store task history:', error);
      }
    }
  }

  /**
   * Get task history
   */
  async getTaskHistory(limit: number = 10): Promise<TaskContext[]> {
    // Combine in-memory and persisted data
    const inMemoryTasks = Array.from(this.taskContexts.values());

    if (this.enablePersistence && this.mcpClient) {
      try {
        const result = await this.mcpClient.invokeTool('mcp__claude-flow__memory_search', {
          pattern: `${this.memoryNamespace}/tasks/*`,
          namespace: this.memoryNamespace,
          limit
        });

        if (result.matches && Array.isArray(result.matches)) {
          const persistedTasks = result.matches
            .map((match: any) => {
              try {
                return JSON.parse(match.value);
              } catch (error) {
                console.warn('Failed to parse task history entry:', error);
                return null;
              }
            })
            .filter(Boolean);

          // Merge and deduplicate
          const allTasks = [...inMemoryTasks, ...persistedTasks];
          const uniqueTasks = Array.from(
            new Map(allTasks.map(task => [task.taskId, task])).values()
          );

          return uniqueTasks
            .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, limit);
        }
      } catch (error) {
        console.warn('Failed to get task history:', error);
      }
    }

    return inMemoryTasks.slice(0, limit);
  }

  /**
   * Add message to conversation
   */
  async addConversationMessage(message: ConversationMessage, sessionId?: string): Promise<void> {
    const sid = sessionId || this.currentSessionId;
    if (!sid) {
      throw new Error('No active session');
    }

    const context = this.conversationContexts.get(sid);
    if (!context) {
      throw new Error('Session context not found');
    }

    context.messages.push(message);
    context.lastUpdate = new Date();

    if (this.enablePersistence && this.mcpClient) {
      await this.persistConversationContext(sid, context);
    }

    this.emit('conversation:message:added', { sessionId: sid, message });
  }

  /**
   * Get conversation context
   */
  async getConversationContext(sessionId?: string): Promise<ConversationContext | null> {
    const sid = sessionId || this.currentSessionId;
    if (!sid) {return null;}

    // Check in-memory first
    const cached = this.conversationContexts.get(sid);
    if (cached) {return cached;}

    // Try to retrieve from persistence
    if (this.enablePersistence && this.mcpClient) {
      try {
        const memoryKey = `${this.memoryNamespace}/conversations/${sid}`;
        const result = await this.mcpClient.invokeTool('mcp__claude-flow__memory_usage', {
          action: 'retrieve',
          key: memoryKey,
          namespace: this.memoryNamespace
        });

        if (result.value) {
          const context = JSON.parse(result.value);
          this.conversationContexts.set(sid, context);
          return context;
        }
      } catch (error) {
        console.warn('Failed to retrieve conversation context:', error);
      }
    }

    return null;
  }

  /**
   * Store worker decision
   */
  async storeWorkerDecision(
    workerId: string,
    decision: string,
    context: any,
    outcome: 'success' | 'failure' | 'partial'
  ): Promise<void> {
    const workerContext = await this.getWorkerContext(workerId);
    if (workerContext) {
      workerContext.decisions.push(decision);
      await this.storeWorkerContext(workerId, workerContext);
    }

    if (this.enablePersistence && this.mcpClient) {
      try {
        const timestamp = new Date().toISOString();
        const memoryKey = `${this.memoryNamespace}/workers/${workerId}/decisions/${timestamp}`;
        const memoryValue = {
          decision,
          context,
          outcome,
          timestamp
        };

        await this.mcpClient.invokeTool('mcp__claude-flow__memory_usage', {
          action: 'store',
          key: memoryKey,
          value: JSON.stringify(memoryValue),
          namespace: this.memoryNamespace,
          ttl: this.defaultTTL * 12 // 12 hours for decisions
        });

        this.emit('worker:decision:stored', { workerId, decision, outcome });
      } catch (error) {
        console.warn('Failed to store worker decision:', error);
      }
    }
  }

  /**
   * Suggest based on history
   */
  async suggestBasedOnHistory(currentInput: string): Promise<string[]> {
    try {
      const history = await this.getTaskHistory(50);

      // Find similar tasks based on input similarity
      const similarTasks = history.filter(task =>
        task.status === 'completed' &&
        task.successfulCommand &&
        this.calculateSimilarity(task.input, currentInput) > 0.6
      );

      // Extract successful commands
      const successfulCommands = similarTasks
        .map(task => task.successfulCommand)
        .filter(Boolean) as string[];

      // Remove duplicates and return top suggestions
      const uniqueCommands = [...new Set(successfulCommands)];
      return uniqueCommands.slice(0, 3);
    } catch (error) {
      console.warn('Failed to generate suggestions:', error);
      return [];
    }
  }

  /**
   * Store performance metrics
   */
  async storePerformanceMetrics(metrics: any): Promise<void> {
    if (this.enablePersistence && this.mcpClient) {
      try {
        const timestamp = new Date().toISOString();
        const memoryKey = `${this.memoryNamespace}/metrics/${timestamp}`;

        await this.mcpClient.invokeTool('mcp__claude-flow__memory_usage', {
          action: 'store',
          key: memoryKey,
          value: JSON.stringify({
            ...metrics,
            timestamp
          }),
          namespace: this.memoryNamespace,
          ttl: this.defaultTTL * 48 // 48 hours for metrics
        });

        this.emit('metrics:stored', metrics);
      } catch (error) {
        console.warn('Failed to store performance metrics:', error);
      }
    }
  }

  /**
   * Clear all contexts
   */
  async clearAllContexts(): Promise<void> {
    this.workerContexts.clear();
    this.taskContexts.clear();
    this.conversationContexts.clear();
    this.currentSessionId = undefined;

    this.emit('contexts:cleared');
  }

  /**
   * Clean up old entries
   */
  async cleanupOldEntries(): Promise<void> {
    if (this.enablePersistence && this.mcpClient) {
      try {
        const cutoffTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

        // Get all entries
        const result = await this.mcpClient.invokeTool('mcp__claude-flow__memory_search', {
          pattern: `${this.memoryNamespace}/*`,
          namespace: this.memoryNamespace,
          limit: 1000
        });

        if (result.matches && Array.isArray(result.matches)) {
          const oldEntries = result.matches.filter((match: any) => {
            try {
              const data = JSON.parse(match.value);
              return new Date(data.timestamp) < cutoffTime;
            } catch (error) {
              return false;
            }
          });

          // Delete old entries
          for (const entry of oldEntries) {
            await this.mcpClient.invokeTool('mcp__claude-flow__memory_usage', {
              action: 'delete',
              key: entry.key,
              namespace: this.memoryNamespace
            });
          }

          this.emit('cleanup:completed', { entriesRemoved: oldEntries.length });
        }
      } catch (error) {
        console.warn('Failed to cleanup old entries:', error);
      }
    }
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string | undefined {
    return this.currentSessionId;
  }

  /**
   * Export session data
   */
  async exportSession(sessionId?: string): Promise<any> {
    const sid = sessionId || this.currentSessionId;
    if (!sid) {return null;}

    const conversationContext = await this.getConversationContext(sid);
    const workerContexts = Array.from(this.workerContexts.entries());
    const taskContexts = Array.from(this.taskContexts.entries());

    return {
      sessionId: sid,
      conversation: conversationContext,
      workers: Object.fromEntries(workerContexts),
      tasks: Object.fromEntries(taskContexts),
      exportTime: new Date().toISOString()
    };
  }

  private async persistConversationContext(sessionId: string, context: ConversationContext): Promise<void> {
    if (!this.mcpClient) {return;}

    try {
      const memoryKey = `${this.memoryNamespace}/conversations/${sessionId}`;
      await this.mcpClient.invokeTool('mcp__claude-flow__memory_usage', {
        action: 'store',
        key: memoryKey,
        value: JSON.stringify(context),
        namespace: this.memoryNamespace,
        ttl: this.defaultTTL * 24 // 24 hours for conversations
      });
    } catch (error) {
      console.warn('Failed to persist conversation context:', error);
    }
  }

  /**
   * Calculate similarity between two strings
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {return 1.0;}

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}

export default ContextManager;