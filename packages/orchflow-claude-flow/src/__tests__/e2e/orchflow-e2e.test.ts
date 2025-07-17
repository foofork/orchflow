import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import fetch from 'node-fetch';
import WebSocket from 'ws';
import { promisify } from 'util';
import { existsSync, mkdirSync, rmSync } from 'fs';
import path from 'path';

const sleep = promisify(setTimeout);

describe('OrchFlow E2E Tests', () => {
  let orchflowProcess: ChildProcess;
  let baseUrl: string;
  let testDir: string;

  beforeAll(async () => {
    // Create test directory
    testDir = path.join(__dirname, '../../../test-e2e-data');
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });

    // Start OrchFlow
    orchflowProcess = spawn('node', [
      path.join(__dirname, '../../../dist/cli-injected.js'),
      'start',
      '--port', '0',
      '--data-dir', testDir
    ], {
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ORCHFLOW_API_KEY: 'e2e-test-key',
        LOG_LEVEL: 'debug'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Wait for server to start and get port
    const port = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server failed to start'));
      }, 30000);

      orchflowProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log('OrchFlow:', output);

        const portMatch = output.match(/OrchFlow Core started on port (\d+)/);
        if (portMatch) {
          clearTimeout(timeout);
          resolve(portMatch[1]);
        }
      });

      orchflowProcess.stderr?.on('data', (data) => {
        console.error('OrchFlow Error:', data.toString());
      });

      orchflowProcess.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    baseUrl = `http://localhost:${port}`;

    // Wait for server to be ready
    await waitForServer(baseUrl);
  }, 60000);

  afterAll(async () => {
    if (orchflowProcess) {
      orchflowProcess.kill('SIGTERM');
      await new Promise((resolve) => {
        orchflowProcess.on('exit', resolve);
        setTimeout(resolve, 5000); // Force resolve after 5s
      });
    }

    // Cleanup test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Server Health', () => {
    it('should respond to health checks', async () => {
      const response = await fetch(`${baseUrl}/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        status: 'healthy',
        version: expect.any(String),
        uptime: expect.any(Number),
        workers: expect.any(Number)
      });
    });
  });

  describe('Claude Integration Flow', () => {
    it('should handle the complete Claude conversation flow', async () => {
      const apiHeaders = {
        'Content-Type': 'application/json',
        'X-API-Key': 'e2e-test-key'
      };

      // 1. Simulate Claude calling spawn_worker tool
      const spawnResponse = await fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          task: 'Build a REST API for user management',
          type: 'developer',
          metadata: {
            conversation_id: 'test-conv-123',
            user: 'test-user'
          }
        })
      });

      expect(spawnResponse.status).toBe(200);
      const spawnData = await spawnResponse.json();

      expect(spawnData).toMatchObject({
        success: true,
        worker: {
          id: expect.any(String),
          name: expect.stringMatching(/API.*Developer/),
          type: 'developer',
          status: 'active'
        },
        message: expect.stringContaining('API Developer')
      });

      const workerId = spawnData.worker.id;

      // 2. Simulate Claude switching context
      const contextResponse = await fetch(`${baseUrl}/mcp/orchflow_switch_context`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ workerId })
      });

      expect(contextResponse.status).toBe(200);
      const contextData = await contextResponse.json();

      expect(contextData).toMatchObject({
        success: true,
        context: {
          workerId,
          workerName: expect.any(String),
          conversationHistory: expect.any(Array),
          sharedKnowledge: expect.any(Object)
        }
      });

      // 3. Simulate knowledge sharing
      const knowledgeResponse = await fetch(`${baseUrl}/mcp/orchflow_share_knowledge`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          knowledge: {
            api_design: {
              endpoints: [
                'POST /users',
                'GET /users/:id',
                'PUT /users/:id',
                'DELETE /users/:id'
              ],
              authentication: 'JWT',
              database: 'PostgreSQL'
            }
          },
          targetWorkers: [workerId]
        })
      });

      expect(knowledgeResponse.status).toBe(200);
      const knowledgeData = await knowledgeResponse.json();
      expect(knowledgeData.success).toBe(true);
    });
  });

  describe('WebSocket Communication', () => {
    it('should establish WebSocket connection and receive events', (done) => {
      const ws = new WebSocket(`${baseUrl.replace('http', 'ws')}?apiKey=e2e-test-key`);
      let connected = false;

      ws.on('open', () => {
        connected = true;

        // Subscribe to all events
        ws.send(JSON.stringify({
          type: 'subscribe',
          channel: '*'
        }));

        // Trigger an event by creating a worker
        fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'e2e-test-key'
          },
          body: JSON.stringify({
            task: 'WebSocket test worker'
          })
        });
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'subscribed') {
          expect(message.channel).toBe('*');
        } else if (message.type === 'worker:created') {
          expect(message.data).toHaveProperty('workerId');
          expect(message.data).toHaveProperty('name');
          ws.close();
          done();
        }
      });

      ws.on('error', (err) => {
        done(err);
      });

      // Timeout safety
      setTimeout(() => {
        if (connected) {
          ws.close();
          done(new Error('WebSocket test timeout'));
        }
      }, 10000);
    });
  });

  describe('Parallel Task Execution', () => {
    it('should execute multiple tasks in parallel', async () => {
      const apiHeaders = {
        'Content-Type': 'application/json',
        'X-API-Key': 'e2e-test-key'
      };

      const tasks = [
        { description: 'Create user model', assignTo: 'developer' },
        { description: 'Design database schema', assignTo: 'architect' },
        { description: 'Write unit tests', assignTo: 'tester' },
        { description: 'Setup CI/CD pipeline', assignTo: 'developer' },
        { description: 'Create API documentation', assignTo: 'developer' }
      ];

      const startTime = Date.now();

      const response = await fetch(`${baseUrl}/mcp/orchflow_execute_parallel`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ tasks })
      });

      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.results).toHaveLength(5);
      expect(duration).toBeLessThan(2000); // Should complete quickly in parallel

      // Verify all workers were created
      const statusResponse = await fetch(`${baseUrl}/mcp/orchflow_worker_status`, {
        headers: apiHeaders
      });
      const status = await statusResponse.json();

      expect(status.workers.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Error Recovery', () => {
    it('should handle and recover from errors gracefully', async () => {
      const apiHeaders = {
        'Content-Type': 'application/json',
        'X-API-Key': 'e2e-test-key'
      };

      // Test invalid worker ID
      const invalidResponse = await fetch(`${baseUrl}/mcp/orchflow_switch_context`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ workerId: 'invalid-id-123' })
      });

      expect(invalidResponse.status).toBe(404);
      const errorData = await invalidResponse.json();
      expect(errorData.error).toContain('Worker not found');

      // Server should still be healthy
      const healthResponse = await fetch(`${baseUrl}/health`);
      expect(healthResponse.status).toBe(200);
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain performance under concurrent load', async () => {
      const apiHeaders = {
        'Content-Type': 'application/json',
        'X-API-Key': 'e2e-test-key'
      };

      const concurrentRequests = 20;
      const iterations = 5;
      const results: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        const requests = Array(concurrentRequests).fill(null).map((_, j) =>
          fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
            method: 'POST',
            headers: apiHeaders,
            body: JSON.stringify({
              task: `Load test worker ${i}-${j}`
            })
          })
        );

        const responses = await Promise.all(requests);
        const duration = Date.now() - startTime;
        results.push(duration);

        const successCount = responses.filter(r => r.status === 200).length;
        expect(successCount).toBeGreaterThan(0);

        // Brief pause between iterations
        await sleep(100);
      }

      // Performance should be consistent
      const avgDuration = results.reduce((a, b) => a + b, 0) / results.length;
      const maxDuration = Math.max(...results);

      expect(avgDuration).toBeLessThan(3000);
      expect(maxDuration).toBeLessThan(avgDuration * 2); // No major spikes

      console.log(`Load test results: avg=${avgDuration}ms, max=${maxDuration}ms`);
    });
  });
});

async function waitForServer(url: string, timeout: number = 30000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.status === 200) {
        return;
      }
    } catch (error) {
      // Server not ready yet
    }

    await sleep(1000);
  }

  throw new Error('Server failed to become ready');
}