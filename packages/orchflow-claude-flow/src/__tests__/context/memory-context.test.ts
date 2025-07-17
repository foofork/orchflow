import { ContextManager } from '../../managers/context-manager';
import type { MCPClient } from '../../primary-terminal/mcp-client';

jest.mock('../../primary-terminal/mcp-client');

describe('OrchFlowMemoryContext', () => {
  let memoryContext: OrchFlowMemoryContext;
  let mockMcpClient: jest.Mocked<MCPClient>;

  beforeEach(() => {
    mockMcpClient = {
      invokeTool: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      isConnected: jest.fn(),
    } as any;

    memoryContext = new OrchFlowMemoryContext(mockMcpClient);
  });

  describe('storeWorkerContext', () => {
    it('should store worker context with correct parameters', async () => {
      const workerId = 'worker-123';
      const context = {
        name: 'API Developer',
        task: 'Build REST API',
        progress: 75,
        status: 'active'
      };

      mockMcpClient.invokeTool.mockResolvedValue({ success: true });

      await memoryContext.storeWorkerContext(workerId, context);

      expect(mockMcpClient.invokeTool).toHaveBeenCalledWith('mcp__claude-flow__memory_usage', {
        action: 'store',
        key: 'orchflow/workers/worker-123/context',
        value: JSON.stringify({
          ...context,
          timestamp: expect.any(String)
        }),
        namespace: 'orchflow',
        ttl: 3600
      });
    });

    it('should handle storage errors gracefully', async () => {
      const workerId = 'worker-123';
      const context = { name: 'Test Worker' };

      mockMcpClient.invokeTool.mockRejectedValue(new Error('Storage error'));

      await expect(memoryContext.storeWorkerContext(workerId, context))
        .rejects.toThrow('Storage error');
    });
  });

  describe('getTaskHistory', () => {
    it('should retrieve task history with default limit', async () => {
      const mockMatches = [
        { key: 'orchflow/tasks/task-1', value: JSON.stringify({ input: 'Build API', status: 'completed' }) },
        { key: 'orchflow/tasks/task-2', value: JSON.stringify({ input: 'Create tests', status: 'active' }) }
      ];

      mockMcpClient.invokeTool.mockResolvedValue({ matches: mockMatches });

      const history = await memoryContext.getTaskHistory();

      expect(mockMcpClient.invokeTool).toHaveBeenCalledWith('mcp__claude-flow__memory_search', {
        pattern: 'orchflow/tasks/*',
        namespace: 'orchflow',
        limit: 10
      });

      expect(history).toHaveLength(2);
      expect(history[0]).toEqual({ input: 'Build API', status: 'completed' });
      expect(history[1]).toEqual({ input: 'Create tests', status: 'active' });
    });

    it('should use custom limit when provided', async () => {
      mockMcpClient.invokeTool.mockResolvedValue({ matches: [] });

      await memoryContext.getTaskHistory(5);

      expect(mockMcpClient.invokeTool).toHaveBeenCalledWith('mcp__claude-flow__memory_search', {
        pattern: 'orchflow/tasks/*',
        namespace: 'orchflow',
        limit: 5
      });
    });

    it('should handle empty results', async () => {
      mockMcpClient.invokeTool.mockResolvedValue({ matches: [] });

      const history = await memoryContext.getTaskHistory();

      expect(history).toHaveLength(0);
    });
  });

  describe('suggestBasedOnHistory', () => {
    it('should suggest similar commands based on history', async () => {
      const mockHistory = [
        { input: 'Create API endpoint', successfulCommand: 'Create an API developer' },
        { input: 'Build user interface', successfulCommand: 'Create a React component builder' },
        { input: 'Create REST API', successfulCommand: 'Create an API developer' }
      ];

      jest.spyOn(memoryContext, 'getTaskHistory').mockResolvedValue(mockHistory);
      jest.spyOn(memoryContext, 'calculateSimilarity').mockImplementation((a, b) => {
        if (a.includes('API') && b.includes('API')) {return 0.8;}
        if (a.includes('interface') && b.includes('UI')) {return 0.7;}
        return 0.3;
      });

      const suggestions = await memoryContext.suggestBasedOnHistory('Build API service');

      expect(suggestions).toContain('Create an API developer');
      expect(suggestions).toHaveLength(2); // Two similar API-related commands
    });

    it('should return empty array when no similar commands found', async () => {
      const mockHistory = [
        { input: 'Create database schema', successfulCommand: 'Create a database designer' }
      ];

      jest.spyOn(memoryContext, 'getTaskHistory').mockResolvedValue(mockHistory);
      jest.spyOn(memoryContext, 'calculateSimilarity').mockReturnValue(0.5); // Below threshold

      const suggestions = await memoryContext.suggestBasedOnHistory('Build mobile app');

      expect(suggestions).toHaveLength(0);
    });
  });

  describe('calculateSimilarity', () => {
    it('should calculate similarity correctly', () => {
      const similarity1 = memoryContext.calculateSimilarity('Create API endpoint', 'Create REST API');
      const similarity2 = memoryContext.calculateSimilarity('Build UI component', 'Create database schema');

      expect(similarity1).toBeGreaterThan(0.5);
      expect(similarity2).toBeLessThan(0.5);
    });

    it('should handle identical strings', () => {
      const similarity = memoryContext.calculateSimilarity('Create API', 'Create API');
      expect(similarity).toBe(1);
    });

    it('should handle empty strings', () => {
      const similarity = memoryContext.calculateSimilarity('', '');
      expect(similarity).toBe(1);
    });
  });

  describe('storeTaskResult', () => {
    it('should store task result with correct parameters', async () => {
      const taskId = 'task-123';
      const result = {
        input: 'Create API',
        workerId: 'worker-123',
        status: 'completed',
        duration: 5000
      };

      mockMcpClient.invokeTool.mockResolvedValue({ success: true });

      await memoryContext.storeTaskResult(taskId, result);

      expect(mockMcpClient.invokeTool).toHaveBeenCalledWith('mcp__claude-flow__memory_usage', {
        action: 'store',
        key: 'orchflow/tasks/task-123',
        value: JSON.stringify({
          ...result,
          timestamp: expect.any(String)
        }),
        namespace: 'orchflow',
        ttl: 7200 // 2 hours
      });
    });
  });

  describe('getWorkerContext', () => {
    it('should retrieve worker context', async () => {
      const workerId = 'worker-123';
      const storedContext = {
        name: 'API Developer',
        task: 'Build REST API',
        progress: 75,
        timestamp: new Date().toISOString()
      };

      mockMcpClient.invokeTool.mockResolvedValue({
        value: JSON.stringify(storedContext)
      });

      const context = await memoryContext.getWorkerContext(workerId);

      expect(mockMcpClient.invokeTool).toHaveBeenCalledWith('mcp__claude-flow__memory_usage', {
        action: 'retrieve',
        key: 'orchflow/workers/worker-123/context',
        namespace: 'orchflow'
      });

      expect(context).toEqual(storedContext);
    });

    it('should return null when worker context not found', async () => {
      mockMcpClient.invokeTool.mockResolvedValue({ value: null });

      const context = await memoryContext.getWorkerContext('worker-123');

      expect(context).toBeNull();
    });
  });

  describe('clearExpiredEntries', () => {
    it('should clear expired entries', async () => {
      mockMcpClient.invokeTool.mockResolvedValue({ success: true });

      await memoryContext.clearExpiredEntries();

      expect(mockMcpClient.invokeTool).toHaveBeenCalledWith('mcp__claude-flow__memory_usage', {
        action: 'cleanup',
        namespace: 'orchflow'
      });
    });
  });

  describe('error handling', () => {
    it('should handle MCP client errors in storeWorkerContext', async () => {
      mockMcpClient.invokeTool.mockRejectedValue(new Error('MCP Error'));

      await expect(memoryContext.storeWorkerContext('worker-123', {}))
        .rejects.toThrow('MCP Error');
    });

    it('should handle JSON parsing errors in getTaskHistory', async () => {
      mockMcpClient.invokeTool.mockResolvedValue({
        matches: [{ key: 'test', value: 'invalid json' }]
      });

      await expect(memoryContext.getTaskHistory()).rejects.toThrow();
    });
  });
});