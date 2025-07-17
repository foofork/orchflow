import { OrchFlowCore } from '../../core/orchflow-core';
import { OrchFlowFunctionalContext } from '../../context/functional-context';
import { DynamicInstructionProvider } from '../../instructions/dynamic-instructions';
import { ContextManager } from '../../managers/context-manager';
import { ClaudeMDManager } from '../../context/claude-md-manager';
import fetch from 'node-fetch';

describe('MCP Tool Integration Tests', () => {
  let core: OrchFlowCore;
  let baseUrl: string;
  let apiHeaders: any;

  beforeAll(async () => {
    core = new OrchFlowCore({
      port: 0,
      enablePersistence: false,
      enableWebSocket: false,
      maxWorkers: 10,
      security: {
        enableAuth: true,
        apiKeys: ['integration-test-key']
      }
    });

    await core.start();
    const port = (core as any).config.port;
    baseUrl = `http://localhost:${port}`;

    apiHeaders = {
      'Content-Type': 'application/json',
      'X-API-Key': 'integration-test-key'
    };
  });

  afterAll(async () => {
    await core?.stop();
  });

  describe('Enhanced MCP Tool Integration', () => {
    it('should handle orchflow_natural_task with rich context', async () => {
      // Create some workers first for context
      await fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          task: 'Build authentication system',
          type: 'developer'
        })
      });

      const response = await fetch(`${baseUrl}/mcp/orchflow_natural_task`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          naturalLanguageInput: 'Create a React component for user profiles',
          context: [
            { timestamp: new Date(), message: 'Working on user management' },
            { timestamp: new Date(), message: 'Need UI components' }
          ],
          orchflowContext: {
            workers: [
              {
                id: 'worker-1',
                name: 'Auth Developer',
                descriptiveName: 'Authentication Developer',
                status: 'active',
                progress: 75,
                quickAccessKey: 1
              }
            ],
            quickAccessMap: { 1: 'worker-1' },
            availableCommands: [
              'Create a React component builder',
              'Connect to Auth Developer'
            ],
            currentTask: {
              mainObjective: 'Build user management system',
              activeSubtasks: ['Authentication', 'User profiles'],
              completedTasks: ['Database setup']
            }
          },
          instructions: 'Focus on creating UI components for user management'
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toMatchObject({
        success: true,
        workerId: expect.any(String),
        workerName: expect.stringMatching(/React.*Component.*Builder/),
        quickAccessKey: expect.any(Number),
        description: expect.stringContaining('React'),
        instructions: expect.stringContaining('OrchFlow'),
        nextSteps: expect.any(Array)
      });
    });

    it('should handle orchflow_smart_connect with context awareness', async () => {
      // Create a worker to connect to
      const createResponse = await fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          task: 'Database management',
          type: 'developer'
        })
      });

      const { worker } = await createResponse.json();

      const connectResponse = await fetch(`${baseUrl}/mcp/orchflow_smart_connect`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          target: 'database',
          orchflowContext: {
            workers: [worker],
            quickAccessMap: { 1: worker.id },
            availableCommands: ['Connect to database developer']
          }
        })
      });

      expect(connectResponse.status).toBe(200);
      const connectData = await connectResponse.json();

      expect(connectData).toMatchObject({
        success: true,
        workerId: worker.id,
        workerName: worker.name,
        context: expect.any(Object),
        instructions: expect.stringContaining('database')
      });
    });

    it('should handle orchflow_status_rich with comprehensive information', async () => {
      // Create multiple workers for rich status
      const workers = await Promise.all([
        fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({ task: 'API development', type: 'developer' })
        }),
        fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({ task: 'Testing', type: 'tester' })
        })
      ]);

      const statusResponse = await fetch(`${baseUrl}/mcp/orchflow_status_rich`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          format: 'detailed',
          orchflowContext: {
            currentTask: {
              mainObjective: 'Build full-stack application',
              activeSubtasks: ['API', 'Testing'],
              completedTasks: ['Planning']
            }
          }
        })
      });

      expect(statusResponse.status).toBe(200);
      const statusData = await statusResponse.json();

      expect(statusData).toMatchObject({
        success: true,
        workers: expect.any(Array),
        summary: expect.objectContaining({
          totalWorkers: expect.any(Number),
          activeWorkers: expect.any(Number),
          byType: expect.any(Object)
        }),
        currentTask: expect.objectContaining({
          mainObjective: 'Build full-stack application'
        }),
        instructions: expect.stringContaining('OrchFlow'),
        quickAccessMap: expect.any(Object)
      });

      expect(statusData.workers.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle orchflow_quick_access with proper key management', async () => {
      // Create worker to assign quick access
      const createResponse = await fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          task: 'Frontend development',
          type: 'developer'
        })
      });

      const { worker } = await createResponse.json();

      const quickAccessResponse = await fetch(`${baseUrl}/mcp/orchflow_quick_access`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          action: 'assign',
          workerId: worker.id,
          key: 3,
          orchflowContext: {
            workers: [worker],
            quickAccessMap: { 1: 'other-worker' }
          }
        })
      });

      expect(quickAccessResponse.status).toBe(200);
      const quickAccessData = await quickAccessResponse.json();

      expect(quickAccessData).toMatchObject({
        success: true,
        workerId: worker.id,
        assignedKey: 3,
        quickAccessMap: expect.objectContaining({
          3: worker.id
        }),
        instructions: expect.stringContaining('Press 3')
      });
    });
  });

  describe('Context Integration Flow', () => {
    it('should provide consistent context across multiple tool calls', async () => {
      // 1. Create initial worker
      const createResponse = await fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          task: 'Build user authentication',
          type: 'developer'
        })
      });

      const { worker } = await createResponse.json();

      // 2. Get status to build context
      const statusResponse = await fetch(`${baseUrl}/mcp/orchflow_status_rich`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ format: 'detailed' })
      });

      const statusData = await statusResponse.json();

      // 3. Use context for natural task creation
      const naturalTaskResponse = await fetch(`${baseUrl}/mcp/orchflow_natural_task`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          naturalLanguageInput: 'Create a UI component for login',
          orchflowContext: {
            workers: statusData.workers,
            quickAccessMap: statusData.quickAccessMap,
            availableCommands: [
              'Create a React component builder',
              'Connect to authentication developer'
            ],
            currentTask: {
              mainObjective: 'Build authentication system',
              activeSubtasks: ['Backend auth', 'Frontend UI'],
              completedTasks: ['Database schema']
            }
          }
        })
      });

      expect(naturalTaskResponse.status).toBe(200);
      const naturalTaskData = await naturalTaskResponse.json();

      // 4. Verify context consistency
      expect(naturalTaskData.instructions).toContain('authentication');
      expect(naturalTaskData.nextSteps).toContain('Connect to authentication developer');
    });
  });

  describe('Memory Integration', () => {
    it('should store and retrieve context through memory system', async () => {
      // Create worker and context
      const createResponse = await fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          task: 'Data processing',
          type: 'developer'
        })
      });

      const { worker } = await createResponse.json();

      // Store context in memory
      const memoryStoreResponse = await fetch(`${baseUrl}/mcp/mcp__claude-flow__memory_usage`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          action: 'store',
          key: `orchflow/workers/${worker.id}/context`,
          value: JSON.stringify({
            name: worker.name,
            task: 'Data processing',
            progress: 25,
            decisions: ['Use Python', 'Pandas library']
          }),
          namespace: 'orchflow',
          ttl: 3600
        })
      });

      expect(memoryStoreResponse.status).toBe(200);

      // Retrieve context from memory
      const memoryRetrieveResponse = await fetch(`${baseUrl}/mcp/mcp__claude-flow__memory_usage`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          action: 'retrieve',
          key: `orchflow/workers/${worker.id}/context`,
          namespace: 'orchflow'
        })
      });

      expect(memoryRetrieveResponse.status).toBe(200);
      const memoryData = await memoryRetrieveResponse.json();

      const storedContext = JSON.parse(memoryData.value);
      expect(storedContext).toMatchObject({
        name: worker.name,
        task: 'Data processing',
        progress: 25,
        decisions: ['Use Python', 'Pandas library']
      });
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle invalid context gracefully', async () => {
      const response = await fetch(`${baseUrl}/mcp/orchflow_natural_task`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          naturalLanguageInput: 'Create something',
          orchflowContext: {
            workers: 'invalid-format',
            quickAccessMap: null
          }
        })
      });

      expect(response.status).toBe(400);
      const errorData = await response.json();
      expect(errorData.error).toContain('Invalid context format');
    });

    it('should handle missing workers in context', async () => {
      const response = await fetch(`${baseUrl}/mcp/orchflow_smart_connect`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          target: 'nonexistent-worker',
          orchflowContext: {
            workers: [],
            quickAccessMap: {}
          }
        })
      });

      expect(response.status).toBe(404);
      const errorData = await response.json();
      expect(errorData.error).toContain('Worker not found');
    });
  });

  describe('Performance Integration', () => {
    it('should handle context processing efficiently', async () => {
      // Create many workers for performance testing
      const workers = await Promise.all(
        Array(5).fill(null).map((_, i) =>
          fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
            method: 'POST',
            headers: apiHeaders,
            body: JSON.stringify({
              task: `Performance test worker ${i}`,
              type: 'developer'
            })
          })
        )
      );

      const workerData = await Promise.all(workers.map(r => r.json()));

      const startTime = Date.now();

      // Process large context
      const response = await fetch(`${baseUrl}/mcp/orchflow_status_rich`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          format: 'detailed',
          orchflowContext: {
            workers: workerData.map(w => w.worker),
            currentTask: {
              mainObjective: 'Performance testing',
              activeSubtasks: Array(10).fill(null).map((_, i) => `Task ${i}`),
              completedTasks: Array(5).fill(null).map((_, i) => `Completed ${i}`)
            }
          }
        })
      });

      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second

      const data = await response.json();
      expect(data.workers).toHaveLength(5);
    });
  });

  describe('CLAUDE.md Integration', () => {
    it('should generate proper CLAUDE.md content', async () => {
      // Create workers for CLAUDE.md generation
      const workers = await Promise.all([
        fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            task: 'API development',
            type: 'developer'
          })
        }),
        fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            task: 'Testing',
            type: 'tester'
          })
        })
      ]);

      const workerData = await Promise.all(workers.map(r => r.json()));

      // Test CLAUDE.md generation endpoint
      const claudeMDResponse = await fetch(`${baseUrl}/mcp/orchflow_generate_claude_md`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          orchflowContext: {
            workers: workerData.map(w => w.worker),
            currentTask: {
              mainObjective: 'Build testing framework',
              activeSubtasks: ['API tests', 'UI tests'],
              completedTasks: ['Test setup']
            }
          }
        })
      });

      expect(claudeMDResponse.status).toBe(200);
      const claudeMDData = await claudeMDResponse.json();

      expect(claudeMDData.content).toContain('## OrchFlow Terminal Commands');
      expect(claudeMDData.content).toContain('### Current Worker Status:');
      expect(claudeMDData.content).toContain('### Active Task Context:');
      expect(claudeMDData.content).toContain('Build testing framework');
    });
  });
});