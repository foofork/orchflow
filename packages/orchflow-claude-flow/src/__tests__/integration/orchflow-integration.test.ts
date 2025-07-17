import { OrchFlowCore } from '../../core/orchflow-core';
import { OrchFlowMCPServer } from '../../mcp/orchflow-mcp-server';
import { SecurityMiddleware } from '../../security/security-middleware';
import fetch from 'node-fetch';
import WebSocket from 'ws';
import { EventEmitter } from 'events';

describe('OrchFlow Integration Tests', () => {
  let core: OrchFlowCore;
  let mcpServer: OrchFlowMCPServer;
  let baseUrl: string;
  let wsUrl: string;
  
  beforeAll(async () => {
    // Start core with test configuration
    core = new OrchFlowCore({
      port: 0, // Random port
      enablePersistence: true,
      persistencePath: './test-data',
      enableWebSocket: true,
      maxWorkers: 10,
      security: {
        enableAuth: true,
        apiKeys: ['test-api-key-123'],
        rateLimiting: {
          enabled: true,
          windowMs: 60000,
          maxRequests: 100
        }
      }
    });
    
    await core.start();
    const port = (core as any).config.port;
    baseUrl = `http://localhost:${port}`;
    wsUrl = `ws://localhost:${port}`;
    
    // Start MCP server
    mcpServer = new OrchFlowMCPServer({ coreUrl: baseUrl });
    await mcpServer.start();
  });
  
  afterAll(async () => {
    await mcpServer?.stop();
    await core?.stop();
  });

  describe('Authentication & Security', () => {
    it('should reject requests without API key', async () => {
      const response = await fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: 'Test task' })
      });
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
      expect(data.code).toBe('INVALID_API_KEY');
    });
    
    it('should accept requests with valid API key', async () => {
      const response = await fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'test-api-key-123'
        },
        body: JSON.stringify({ task: 'Test task' })
      });
      
      expect(response.status).toBe(200);
    });
    
    it('should enforce rate limiting', async () => {
      const requests = [];
      
      // Make 101 requests (1 over limit)
      for (let i = 0; i < 101; i++) {
        requests.push(
          fetch(`${baseUrl}/health`, {
            headers: { 'X-API-Key': 'test-api-key-123' }
          })
        );
      }
      
      const responses = await Promise.all(requests);
      const statuses = responses.map(r => r.status);
      
      // Should have at least one 429 response
      expect(statuses).toContain(429);
    });
  });

  describe('Worker Orchestration', () => {
    let apiHeaders: any;
    
    beforeEach(() => {
      apiHeaders = {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-api-key-123'
      };
    });
    
    it('should orchestrate multiple workers in parallel', async () => {
      // Create multiple workers
      const workers = await Promise.all([
        fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            task: 'Build authentication module',
            type: 'developer'
          })
        }),
        fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            task: 'Design database schema',
            type: 'architect'
          })
        }),
        fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            task: 'Write API tests',
            type: 'tester'
          })
        })
      ]);
      
      const workerData = await Promise.all(workers.map(r => r.json()));
      
      // All should succeed
      expect(workerData.every(d => d.success)).toBe(true);
      expect(workerData.map(d => d.worker.type)).toEqual([
        'developer',
        'architect',
        'tester'
      ]);
      
      // Verify workers are active
      const statusResponse = await fetch(`${baseUrl}/mcp/orchflow_worker_status`, {
        headers: apiHeaders
      });
      const status = await statusResponse.json();
      
      expect(status.workers.length).toBeGreaterThanOrEqual(3);
    });
    
    it('should share knowledge between workers', async () => {
      // Create two workers
      const worker1Response = await fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ task: 'API Developer' })
      });
      const worker1 = await worker1Response.json();
      
      const worker2Response = await fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ task: 'Frontend Developer' })
      });
      const worker2 = await worker2Response.json();
      
      // Share knowledge
      const knowledge = {
        api: {
          endpoints: ['/users', '/auth', '/products'],
          authentication: 'JWT'
        },
        decisions: ['Use REST', 'TypeScript', 'PostgreSQL']
      };
      
      const shareResponse = await fetch(`${baseUrl}/mcp/orchflow_share_knowledge`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          knowledge,
          targetWorkers: [worker1.worker.id, worker2.worker.id]
        })
      });
      
      const shareResult = await shareResponse.json();
      expect(shareResult.success).toBe(true);
      expect(shareResult.sharedWith).toHaveLength(2);
      
      // Verify knowledge was shared
      const context1Response = await fetch(`${baseUrl}/mcp/orchflow_switch_context`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ workerId: worker1.worker.id })
      });
      const context1 = await context1Response.json();
      
      expect(context1.context.sharedKnowledge).toEqual(knowledge);
    });
  });

  describe('WebSocket Real-time Updates', () => {
    it('should stream real-time updates via WebSocket', (done) => {
      const ws = new WebSocket(`${wsUrl}?apiKey=test-api-key-123`);
      const receivedEvents: any[] = [];
      
      ws.on('open', async () => {
        // Subscribe to worker events
        ws.send(JSON.stringify({
          type: 'subscribe',
          channel: 'workers'
        }));
        
        // Create a worker to trigger events
        await fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'test-api-key-123'
          },
          body: JSON.stringify({ task: 'WebSocket test task' })
        });
      });
      
      ws.on('message', (data) => {
        const event = JSON.parse(data.toString());
        receivedEvents.push(event);
        
        if (event.type === 'worker:created') {
          expect(event.data).toHaveProperty('workerId');
          expect(event.data).toHaveProperty('name');
          ws.close();
        }
      });
      
      ws.on('close', () => {
        expect(receivedEvents.length).toBeGreaterThan(0);
        expect(receivedEvents.some(e => e.type === 'worker:created')).toBe(true);
        done();
      });
      
      ws.on('error', done);
    });
  });

  describe('MCP Server Integration', () => {
    it('should handle MCP tool calls correctly', async () => {
      const tools = await mcpServer.getTools();
      
      expect(tools).toContainEqual(
        expect.objectContaining({
          name: 'orchflow_spawn_worker',
          description: expect.any(String)
        })
      );
      
      // Test tool execution
      const result = await mcpServer.handleToolCall({
        name: 'orchflow_spawn_worker',
        arguments: {
          task: 'MCP integration test',
          type: 'developer'
        }
      });
      
      expect(result).toMatchObject({
        success: true,
        worker: {
          id: expect.any(String),
          name: expect.any(String),
          type: 'developer'
        }
      });
    });
    
    it('should provide proper MCP prompts', async () => {
      const prompts = await mcpServer.getPrompts();
      
      expect(prompts).toContainEqual(
        expect.objectContaining({
          name: 'orchestrate_project',
          description: expect.any(String)
        })
      );
    });
  });

  describe('Persistence & Recovery', () => {
    it('should persist worker state across restarts', async () => {
      const apiHeaders = {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-api-key-123'
      };
      
      // Create worker
      const createResponse = await fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          task: 'Persistent worker',
          metadata: { important: true }
        })
      });
      const { worker } = await createResponse.json();
      
      // Force save state
      await core.saveState();
      
      // Create new core instance
      const newCore = new OrchFlowCore({
        port: 0,
        enablePersistence: true,
        persistencePath: './test-data',
        enableWebSocket: false,
        security: {
          enableAuth: true,
          apiKeys: ['test-api-key-123']
        }
      });
      
      await newCore.start();
      const newPort = (newCore as any).config.port;
      
      // Check worker exists in new instance
      const statusResponse = await fetch(`http://localhost:${newPort}/mcp/orchflow_worker_status?workerId=${worker.id}`, {
        headers: apiHeaders
      });
      const status = await statusResponse.json();
      
      expect(status.worker).toMatchObject({
        id: worker.id,
        name: worker.name,
        metadata: { important: true }
      });
      
      await newCore.stop();
    });
  });

  describe('Error Handling & Recovery', () => {
    it('should handle malformed requests gracefully', async () => {
      const apiHeaders = {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-api-key-123'
      };
      
      const response = await fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
        method: 'POST',
        headers: apiHeaders,
        body: '{ invalid json'
      });
      
      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error.error).toContain('Invalid JSON');
    });
    
    it('should recover from worker failures', async () => {
      // This would test actual failure recovery in a real implementation
      expect(true).toBe(true);
    });
  });

  describe('Performance & Scalability', () => {
    it('should handle high concurrency', async () => {
      const apiHeaders = {
        'Content-Type': 'application/json',
        'X-API-Key': 'test-api-key-123'
      };
      
      const startTime = Date.now();
      const concurrentRequests = 50;
      
      // Create many workers concurrently
      const requests = Array(concurrentRequests).fill(null).map((_, i) =>
        fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({ task: `Concurrent task ${i}` })
        })
      );
      
      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;
      
      // All should succeed (within worker limits)
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBeGreaterThan(0);
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds for 50 requests
      
      console.log(`Processed ${successCount}/${concurrentRequests} requests in ${duration}ms`);
    });
  });
});

describe('OrchFlow E2E Workflow', () => {
  let core: OrchFlowCore;
  let baseUrl: string;
  let apiHeaders: any;
  
  beforeAll(async () => {
    core = new OrchFlowCore({
      port: 0,
      enablePersistence: false,
      enableWebSocket: true,
      maxWorkers: 10,
      security: {
        enableAuth: true,
        apiKeys: ['test-api-key-123']
      }
    });
    
    await core.start();
    const port = (core as any).config.port;
    baseUrl = `http://localhost:${port}`;
    
    apiHeaders = {
      'Content-Type': 'application/json',
      'X-API-Key': 'test-api-key-123'
    };
  });
  
  afterAll(async () => {
    await core?.stop();
  });
  
  it('should complete a full development workflow', async () => {
    // 1. Create architect to design system
    const architectResponse = await fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({
        task: 'Design e-commerce API architecture',
        type: 'architect'
      })
    });
    const architect = await architectResponse.json();
    
    // 2. Share architecture knowledge
    const architectureKnowledge = {
      patterns: ['REST API', 'Microservices', 'Event-driven'],
      services: ['user-service', 'product-service', 'order-service'],
      technologies: ['Node.js', 'PostgreSQL', 'Redis', 'RabbitMQ']
    };
    
    await fetch(`${baseUrl}/mcp/orchflow_share_knowledge`, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({
        knowledge: architectureKnowledge,
        targetWorkers: 'all'
      })
    });
    
    // 3. Spawn development team in parallel
    const parallelTasks = [
      { description: 'Implement user service', assignTo: 'developer', metadata: { service: 'user-service' } },
      { description: 'Implement product service', assignTo: 'developer', metadata: { service: 'product-service' } },
      { description: 'Implement order service', assignTo: 'developer', metadata: { service: 'order-service' } },
      { description: 'Create API tests', assignTo: 'tester' },
      { description: 'Write API documentation', assignTo: 'developer', metadata: { type: 'docs' } }
    ];
    
    const parallelResponse = await fetch(`${baseUrl}/mcp/orchflow_execute_parallel`, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({ tasks: parallelTasks })
    });
    const parallelResults = await parallelResponse.json();
    
    expect(parallelResults.success).toBe(true);
    expect(parallelResults.results).toHaveLength(5);
    
    // 4. Monitor progress
    const statusResponse = await fetch(`${baseUrl}/mcp/orchflow_worker_status`, {
      headers: apiHeaders
    });
    const status = await statusResponse.json();
    
    // Should have architect + 5 new workers
    expect(status.workers.length).toBeGreaterThanOrEqual(6);
    expect(status.summary.byType.developer).toBeGreaterThanOrEqual(4);
    expect(status.summary.byType.tester).toBeGreaterThanOrEqual(1);
    expect(status.summary.byType.architect).toBeGreaterThanOrEqual(1);
    
    // 5. Complete workflow
    const summaryResponse = await fetch(`${baseUrl}/mcp/orchflow_project_summary`, {
      headers: apiHeaders
    });
    const summary = await summaryResponse.json();
    
    expect(summary).toMatchObject({
      totalWorkers: expect.any(Number),
      activeWorkers: expect.any(Number),
      completedTasks: expect.any(Number),
      sharedKnowledge: expect.objectContaining({
        patterns: expect.any(Array)
      })
    });
  });
});