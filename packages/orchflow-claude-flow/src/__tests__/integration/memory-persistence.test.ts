import { OrchFlowCore } from '../../core/orchflow-core';
import { OrchFlowMemoryContext } from '../../context/memory-context';
import { MCPClient } from '../../primary-terminal/mcp-client';
import fetch from 'node-fetch';
import { existsSync, mkdirSync, rmSync } from 'fs';
import path from 'path';

describe('Memory Persistence Integration Tests', () => {
  let core: OrchFlowCore;
  let baseUrl: string;
  let apiHeaders: any;
  let testDir: string;
  let memoryContext: OrchFlowMemoryContext;
  let mcpClient: MCPClient;

  beforeAll(async () => {
    // Create test directory
    testDir = path.join(__dirname, '../../../test-memory-data');
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });

    // Start core with persistence enabled
    core = new OrchFlowCore({
      port: 0,
      enablePersistence: true,
      persistencePath: testDir,
      enableWebSocket: false,
      maxWorkers: 10,
      security: {
        enableAuth: true,
        apiKeys: ['memory-test-key']
      }
    });

    await core.start();
    const port = (core as any).config.port;
    baseUrl = `http://localhost:${port}`;

    apiHeaders = {
      'Content-Type': 'application/json',
      'X-API-Key': 'memory-test-key'
    };

    // Initialize memory context
    mcpClient = new MCPClient();
    await mcpClient.connect();
    memoryContext = new OrchFlowMemoryContext(mcpClient);
  });

  afterAll(async () => {
    await mcpClient?.disconnect();
    await core?.stop();
    
    // Cleanup test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Worker Context Persistence', () => {
    it('should persist worker context across sessions', async () => {
      const workerId = 'test-worker-123';
      const workerContext = {
        name: 'API Developer',
        task: 'Build REST API endpoints',
        progress: 75,
        decisions: ['Use Express.js', 'PostgreSQL database', 'JWT authentication'],
        technologies: ['Node.js', 'Express', 'PostgreSQL', 'JWT'],
        currentFile: 'src/routes/users.js',
        lastActivity: new Date().toISOString()
      };

      // Store worker context
      await memoryContext.storeWorkerContext(workerId, workerContext);

      // Retrieve worker context
      const retrievedContext = await memoryContext.getWorkerContext(workerId);

      expect(retrievedContext).toMatchObject({
        name: 'API Developer',
        task: 'Build REST API endpoints',
        progress: 75,
        decisions: ['Use Express.js', 'PostgreSQL database', 'JWT authentication'],
        technologies: ['Node.js', 'Express', 'PostgreSQL', 'JWT'],
        currentFile: 'src/routes/users.js',
        timestamp: expect.any(String)
      });
    });

    it('should handle worker context updates', async () => {
      const workerId = 'test-worker-456';
      
      // Initial context
      const initialContext = {
        name: 'Frontend Developer',
        task: 'Build React components',
        progress: 25,
        decisions: ['Use React hooks', 'CSS modules']
      };

      await memoryContext.storeWorkerContext(workerId, initialContext);

      // Updated context
      const updatedContext = {
        name: 'Frontend Developer',
        task: 'Build React components',
        progress: 60,
        decisions: ['Use React hooks', 'CSS modules', 'Add TypeScript'],
        currentComponent: 'UserProfile'
      };

      await memoryContext.storeWorkerContext(workerId, updatedContext);

      // Retrieve updated context
      const retrievedContext = await memoryContext.getWorkerContext(workerId);

      expect(retrievedContext.progress).toBe(60);
      expect(retrievedContext.decisions).toContain('Add TypeScript');
      expect(retrievedContext.currentComponent).toBe('UserProfile');
    });

    it('should handle worker context expiration', async () => {
      const workerId = 'test-worker-expired';
      const context = {
        name: 'Test Worker',
        task: 'Test task',
        progress: 50
      };

      // Store context with very short TTL
      await fetch(`${baseUrl}/mcp/mcp__claude-flow__memory_usage`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          action: 'store',
          key: `orchflow/workers/${workerId}/context`,
          value: JSON.stringify({
            ...context,
            timestamp: new Date().toISOString()
          }),
          namespace: 'orchflow',
          ttl: 1 // 1 second TTL
        })
      });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Try to retrieve expired context
      const retrievedContext = await memoryContext.getWorkerContext(workerId);
      expect(retrievedContext).toBeNull();
    });
  });

  describe('Task History Persistence', () => {
    it('should persist task history and patterns', async () => {
      const tasks = [
        {
          id: 'task-1',
          input: 'Create React component',
          workerId: 'worker-1',
          status: 'completed',
          duration: 5000,
          successfulCommand: 'Create a React component builder'
        },
        {
          id: 'task-2',
          input: 'Build API endpoint',
          workerId: 'worker-2',
          status: 'completed',
          duration: 3000,
          successfulCommand: 'Create an API developer'
        },
        {
          id: 'task-3',
          input: 'Write unit tests',
          workerId: 'worker-3',
          status: 'active',
          duration: 2000,
          successfulCommand: 'Create a test engineer'
        }
      ];

      // Store multiple tasks
      for (const task of tasks) {
        await memoryContext.storeTaskResult(task.id, task);
      }

      // Retrieve task history
      const history = await memoryContext.getTaskHistory(5);

      expect(history).toHaveLength(3);
      expect(history.map(h => h.input)).toEqual([
        'Create React component',
        'Build API endpoint',
        'Write unit tests'
      ]);
    });

    it('should provide suggestions based on historical patterns', async () => {
      // Store successful patterns
      const patterns = [
        {
          id: 'pattern-1',
          input: 'Build React application',
          workerId: 'worker-1',
          status: 'completed',
          successfulCommand: 'Create a React component builder'
        },
        {
          id: 'pattern-2',
          input: 'Create React components',
          workerId: 'worker-2',
          status: 'completed',
          successfulCommand: 'Create a React component builder'
        },
        {
          id: 'pattern-3',
          input: 'Design user interface',
          workerId: 'worker-3',
          status: 'completed',
          successfulCommand: 'Create a React component builder'
        }
      ];

      for (const pattern of patterns) {
        await memoryContext.storeTaskResult(pattern.id, pattern);
      }

      // Test suggestion based on similar input
      const suggestions = await memoryContext.suggestBasedOnHistory('Build React user interface');

      expect(suggestions).toContain('Create a React component builder');
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Knowledge Sharing Persistence', () => {
    it('should persist shared knowledge between workers', async () => {
      const sharedKnowledge = {
        architecture: {
          patterns: ['MVC', 'Repository', 'Dependency Injection'],
          technologies: ['Node.js', 'Express', 'PostgreSQL', 'Redis'],
          decisions: ['Use TypeScript', 'REST API', 'JWT authentication']
        },
        database: {
          schema: {
            users: ['id', 'email', 'password_hash', 'created_at'],
            posts: ['id', 'user_id', 'title', 'content', 'created_at'],
            comments: ['id', 'post_id', 'user_id', 'content', 'created_at']
          },
          indexes: ['users.email', 'posts.user_id', 'comments.post_id']
        },
        api: {
          endpoints: [
            'POST /auth/login',
            'POST /auth/register',
            'GET /users/:id',
            'GET /posts',
            'POST /posts',
            'GET /posts/:id/comments'
          ],
          authentication: 'JWT Bearer tokens',
          rateLimit: '100 requests per minute'
        }
      };

      // Store shared knowledge
      await fetch(`${baseUrl}/mcp/mcp__claude-flow__memory_usage`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          action: 'store',
          key: 'orchflow/shared-knowledge/project-architecture',
          value: JSON.stringify({
            ...sharedKnowledge,
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }),
          namespace: 'orchflow',
          ttl: 7200 // 2 hours
        })
      });

      // Retrieve shared knowledge
      const retrieveResponse = await fetch(`${baseUrl}/mcp/mcp__claude-flow__memory_usage`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          action: 'retrieve',
          key: 'orchflow/shared-knowledge/project-architecture',
          namespace: 'orchflow'
        })
      });

      const retrieveData = await retrieveResponse.json();
      const retrievedKnowledge = JSON.parse(retrieveData.value);

      expect(retrievedKnowledge.architecture.patterns).toEqual(['MVC', 'Repository', 'Dependency Injection']);
      expect(retrievedKnowledge.database.schema.users).toContain('email');
      expect(retrievedKnowledge.api.endpoints).toContain('POST /auth/login');
    });

    it('should handle knowledge versioning', async () => {
      const knowledgeV1 = {
        api: {
          version: '1.0.0',
          endpoints: ['GET /users', 'POST /users'],
          authentication: 'Basic Auth'
        }
      };

      const knowledgeV2 = {
        api: {
          version: '2.0.0',
          endpoints: ['GET /users', 'POST /users', 'PUT /users/:id', 'DELETE /users/:id'],
          authentication: 'JWT Bearer tokens',
          rateLimit: '100 requests per minute'
        }
      };

      // Store version 1
      await fetch(`${baseUrl}/mcp/mcp__claude-flow__memory_usage`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          action: 'store',
          key: 'orchflow/knowledge/api-v1',
          value: JSON.stringify(knowledgeV1),
          namespace: 'orchflow',
          ttl: 3600
        })
      });

      // Store version 2
      await fetch(`${baseUrl}/mcp/mcp__claude-flow__memory_usage`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          action: 'store',
          key: 'orchflow/knowledge/api-v2',
          value: JSON.stringify(knowledgeV2),
          namespace: 'orchflow',
          ttl: 3600
        })
      });

      // Search for API knowledge
      const searchResponse = await fetch(`${baseUrl}/mcp/mcp__claude-flow__memory_search`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          pattern: 'orchflow/knowledge/api-*',
          namespace: 'orchflow',
          limit: 10
        })
      });

      const searchData = await searchResponse.json();
      expect(searchData.matches).toHaveLength(2);
      
      const versions = searchData.matches.map(m => JSON.parse(m.value).api.version);
      expect(versions).toContain('1.0.0');
      expect(versions).toContain('2.0.0');
    });
  });

  describe('Memory Cleanup and Optimization', () => {
    it('should clean up expired entries', async () => {
      // Store entries with different TTLs
      const entries = [
        { key: 'short-lived', ttl: 1 },
        { key: 'medium-lived', ttl: 5 },
        { key: 'long-lived', ttl: 3600 }
      ];

      for (const entry of entries) {
        await fetch(`${baseUrl}/mcp/mcp__claude-flow__memory_usage`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            action: 'store',
            key: `orchflow/cleanup-test/${entry.key}`,
            value: JSON.stringify({ data: `test-${entry.key}` }),
            namespace: 'orchflow',
            ttl: entry.ttl
          })
        });
      }

      // Wait for short-lived entry to expire
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Trigger cleanup
      await memoryContext.clearExpiredEntries();

      // Check which entries still exist
      const searchResponse = await fetch(`${baseUrl}/mcp/mcp__claude-flow__memory_search`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          pattern: 'orchflow/cleanup-test/*',
          namespace: 'orchflow',
          limit: 10
        })
      });

      const searchData = await searchResponse.json();
      const existingKeys = searchData.matches.map(m => m.key);

      expect(existingKeys).not.toContain('orchflow/cleanup-test/short-lived');
      expect(existingKeys).toContain('orchflow/cleanup-test/medium-lived');
      expect(existingKeys).toContain('orchflow/cleanup-test/long-lived');
    });

    it('should handle memory optimization for large datasets', async () => {
      // Store many entries
      const entries = Array(100).fill(null).map((_, i) => ({
        key: `large-dataset-${i}`,
        data: {
          id: i,
          content: `Large content block ${i} with lots of text data that takes up memory space`,
          metadata: {
            tags: [`tag-${i}`, `category-${i % 10}`],
            created: new Date().toISOString(),
            size: 1000 + i * 10
          }
        }
      }));

      // Store all entries
      for (const entry of entries) {
        await fetch(`${baseUrl}/mcp/mcp__claude-flow__memory_usage`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            action: 'store',
            key: `orchflow/large-dataset/${entry.key}`,
            value: JSON.stringify(entry.data),
            namespace: 'orchflow',
            ttl: 3600
          })
        });
      }

      // Search and verify all entries exist
      const searchResponse = await fetch(`${baseUrl}/mcp/mcp__claude-flow__memory_search`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          pattern: 'orchflow/large-dataset/*',
          namespace: 'orchflow',
          limit: 150
        })
      });

      const searchData = await searchResponse.json();
      expect(searchData.matches).toHaveLength(100);
    });
  });

  describe('Cross-Session Persistence', () => {
    it('should persist data across core restarts', async () => {
      const testData = {
        workerId: 'persistent-worker',
        context: {
          name: 'Persistent Worker',
          task: 'Long-running task',
          progress: 80,
          decisions: ['Use React', 'TypeScript', 'Jest for testing'],
          files: ['src/App.tsx', 'src/components/Header.tsx']
        }
      };

      // Store data
      await memoryContext.storeWorkerContext(testData.workerId, testData.context);

      // Force save state
      await core.saveState();

      // Stop current core
      await core.stop();

      // Start new core instance
      const newCore = new OrchFlowCore({
        port: 0,
        enablePersistence: true,
        persistencePath: testDir,
        enableWebSocket: false,
        security: {
          enableAuth: true,
          apiKeys: ['memory-test-key']
        }
      });

      await newCore.start();
      const newPort = (newCore as any).config.port;

      // Retrieve data from new instance
      const retrieveResponse = await fetch(`http://localhost:${newPort}/mcp/mcp__claude-flow__memory_usage`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          action: 'retrieve',
          key: `orchflow/workers/${testData.workerId}/context`,
          namespace: 'orchflow'
        })
      });

      const retrieveData = await retrieveResponse.json();
      const retrievedContext = JSON.parse(retrieveData.value);

      expect(retrievedContext.name).toBe('Persistent Worker');
      expect(retrievedContext.progress).toBe(80);
      expect(retrievedContext.decisions).toContain('Use React');
      expect(retrievedContext.files).toContain('src/App.tsx');

      await newCore.stop();
    });
  });

  describe('Memory Performance Under Load', () => {
    it('should handle concurrent memory operations efficiently', async () => {
      const concurrentOps = 50;
      const promises = [];

      const startTime = Date.now();

      // Concurrent store operations
      for (let i = 0; i < concurrentOps; i++) {
        promises.push(
          fetch(`${baseUrl}/mcp/mcp__claude-flow__memory_usage`, {
            method: 'POST',
            headers: apiHeaders,
            body: JSON.stringify({
              action: 'store',
              key: `orchflow/concurrent-test/item-${i}`,
              value: JSON.stringify({
                id: i,
                data: `Concurrent test data ${i}`,
                timestamp: new Date().toISOString()
              }),
              namespace: 'orchflow',
              ttl: 3600
            })
          })
        );
      }

      // Concurrent retrieve operations
      for (let i = 0; i < concurrentOps / 2; i++) {
        promises.push(
          fetch(`${baseUrl}/mcp/mcp__claude-flow__memory_usage`, {
            method: 'POST',
            headers: apiHeaders,
            body: JSON.stringify({
              action: 'retrieve',
              key: `orchflow/concurrent-test/item-${i}`,
              namespace: 'orchflow'
            })
          })
        );
      }

      const responses = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // All operations should succeed
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBe(promises.length);

      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000);

      console.log(`Concurrent memory operations (${promises.length} ops): ${duration}ms`);
    });
  });
});