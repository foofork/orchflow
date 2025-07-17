import type { MCPClient } from '../primary-terminal/mcp-client';

export interface WorkerMemoryContext {
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

export interface TaskMemoryEntry {
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

export interface MemorySearchResult {
  key: string;
  value: any;
  timestamp: Date;
  similarity: number;
}

/**
 * OrchFlowMemoryContext manages persistent memory for worker context, task history,
 * and pattern learning using claude-flow's memory infrastructure.
 */
export class OrchFlowMemoryContext {
  private mcpClient: MCPClient;
  private memoryNamespace = 'orchflow';
  private defaultTTL = 3600; // 1 hour

  constructor(mcpClient: MCPClient) {
    this.mcpClient = mcpClient;
  }

  /**
   * Store worker context in persistent memory
   */
  async storeWorkerContext(workerId: string, context: WorkerMemoryContext): Promise<void> {
    try {
      const memoryKey = `orchflow/workers/${workerId}/context`;
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
    } catch (error) {
      console.warn('Failed to store worker context:', error);
    }
  }

  /**
   * Retrieve worker context from memory
   */
  async getWorkerContext(workerId: string): Promise<WorkerMemoryContext | null> {
    try {
      const memoryKey = `orchflow/workers/${workerId}/context`;
      const result = await this.mcpClient.invokeTool('mcp__claude-flow__memory_usage', {
        action: 'retrieve',
        key: memoryKey,
        namespace: this.memoryNamespace
      });

      if (result.value) {
        return JSON.parse(result.value);
      }
      return null;
    } catch (error) {
      console.warn('Failed to retrieve worker context:', error);
      return null;
    }
  }

  /**
   * Store task completion information for learning
   */
  async storeTaskHistory(taskEntry: TaskMemoryEntry): Promise<void> {
    try {
      const memoryKey = `orchflow/tasks/${taskEntry.taskId}`;
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
    } catch (error) {
      console.warn('Failed to store task history:', error);
    }
  }

  /**
   * Get task history for pattern learning
   */
  async getTaskHistory(limit: number = 10): Promise<TaskMemoryEntry[]> {
    try {
      const result = await this.mcpClient.invokeTool('mcp__claude-flow__memory_search', {
        pattern: 'orchflow/tasks/*',
        namespace: this.memoryNamespace,
        limit
      });

      if (result.matches && Array.isArray(result.matches)) {
        return result.matches
          .map((match: any) => {
            try {
              return JSON.parse(match.value);
            } catch (error) {
              console.warn('Failed to parse task history entry:', error);
              return null;
            }
          })
          .filter(Boolean)
          .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }
      return [];
    } catch (error) {
      console.warn('Failed to get task history:', error);
      return [];
    }
  }

  /**
   * Suggest commands based on historical success patterns
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
   * Store worker decision for learning
   */
  async storeWorkerDecision(
    workerId: string,
    decision: string,
    context: any,
    outcome: 'success' | 'failure' | 'partial'
  ): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const memoryKey = `orchflow/workers/${workerId}/decisions/${timestamp}`;
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
    } catch (error) {
      console.warn('Failed to store worker decision:', error);
    }
  }

  /**
   * Get successful patterns for a specific worker type
   */
  async getWorkerPatterns(workerType: string): Promise<any[]> {
    try {
      const result = await this.mcpClient.invokeTool('mcp__claude-flow__memory_search', {
        pattern: 'orchflow/workers/*/decisions/*',
        namespace: this.memoryNamespace,
        limit: 20
      });

      if (result.matches && Array.isArray(result.matches)) {
        return result.matches
          .map((match: any) => {
            try {
              const data = JSON.parse(match.value);
              return data.outcome === 'success' ? data : null;
            } catch (error) {
              return null;
            }
          })
          .filter(Boolean)
          .filter((decision: any) => decision.context?.workerType === workerType);
      }
      return [];
    } catch (error) {
      console.warn('Failed to get worker patterns:', error);
      return [];
    }
  }

  /**
   * Store system performance metrics
   */
  async storePerformanceMetrics(metrics: any): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const memoryKey = `orchflow/metrics/${timestamp}`;

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
    } catch (error) {
      console.warn('Failed to store performance metrics:', error);
    }
  }

  /**
   * Get performance trends over time
   */
  async getPerformanceTrends(timeframe: '1h' | '24h' | '7d' = '24h'): Promise<any[]> {
    try {
      const result = await this.mcpClient.invokeTool('mcp__claude-flow__memory_search', {
        pattern: 'orchflow/metrics/*',
        namespace: this.memoryNamespace,
        limit: this.getTimeframeLimiter(timeframe)
      });

      if (result.matches && Array.isArray(result.matches)) {
        return result.matches
          .map((match: any) => {
            try {
              return JSON.parse(match.value);
            } catch (error) {
              return null;
            }
          })
          .filter(Boolean)
          .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }
      return [];
    } catch (error) {
      console.warn('Failed to get performance trends:', error);
      return [];
    }
  }

  /**
   * Clean up old memory entries
   */
  async cleanupOldEntries(): Promise<void> {
    try {
      const cutoffTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

      // Get all entries
      const result = await this.mcpClient.invokeTool('mcp__claude-flow__memory_search', {
        pattern: 'orchflow/*',
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
      }
    } catch (error) {
      console.warn('Failed to cleanup old entries:', error);
    }
  }

  /**
   * Calculate similarity between two strings (simple implementation)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {return 1.0;}

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
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

  /**
   * Get limit based on timeframe
   */
  private getTimeframeLimiter(timeframe: '1h' | '24h' | '7d'): number {
    switch (timeframe) {
      case '1h': return 10;
      case '24h': return 50;
      case '7d': return 200;
      default: return 50;
    }
  }
}