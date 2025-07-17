import { OrchFlowCore } from '../../core/orchflow-core';
import { Worker, WorkerType } from '../../types';
import fetch from 'node-fetch';

jest.mock('node-fetch');
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('OrchFlowCore', () => {
  let core: OrchFlowCore;
  
  beforeEach(() => {
    core = new OrchFlowCore({
      port: 0, // Random port
      enablePersistence: false,
      enableWebSocket: false
    });
  });

  afterEach(async () => {
    await core.stop();
  });

  describe('Core Functionality', () => {
    it('should start and stop properly', async () => {
      await expect(core.start()).resolves.not.toThrow();
      await expect(core.stop()).resolves.not.toThrow();
    });

    it('should handle health check', async () => {
      await core.start();
      
      const response = await fetch(`http://localhost:${(core as any).config.port}/health`);
      const data = await response.json();
      
      expect(data).toMatchObject({
        status: 'healthy',
        workers: 0,
        uptime: expect.any(Number)
      });
    });
  });

  describe('Worker Management', () => {
    beforeEach(async () => {
      await core.start();
    });

    it('should create a worker via MCP endpoint', async () => {
      const response = await fetch(`http://localhost:${(core as any).config.port}/mcp/orchflow_spawn_worker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'Build authentication system',
          type: 'developer'
        })
      });
      
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(data.worker).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        status: 'active'
      });
    });

    it('should enforce worker limits', async () => {
      const coreWithLimit = new OrchFlowCore({
        port: 0,
        maxWorkers: 2,
        enablePersistence: false,
        enableWebSocket: false
      });
      
      await coreWithLimit.start();
      
      // Create max workers
      for (let i = 0; i < 2; i++) {
        await fetch(`http://localhost:${(coreWithLimit as any).config.port}/mcp/orchflow_spawn_worker`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task: `Task ${i}` })
        });
      }
      
      // Try to create one more
      const response = await fetch(`http://localhost:${(coreWithLimit as any).config.port}/mcp/orchflow_spawn_worker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: 'Overflow task' })
      });
      
      expect(response.status).toBe(500);
      const error = await response.json();
      expect(error.error).toContain('Maximum worker limit');
      
      await coreWithLimit.stop();
    });

    it('should get worker status', async () => {
      // Create a worker
      const createResponse = await fetch(`http://localhost:${(core as any).config.port}/mcp/orchflow_spawn_worker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: 'Test task' })
      });
      
      const { worker } = await createResponse.json();
      
      // Get specific worker status
      const statusResponse = await fetch(`http://localhost:${(core as any).config.port}/mcp/orchflow_worker_status?workerId=${worker.id}`);
      const statusData = await statusResponse.json();
      
      expect(statusData.worker).toMatchObject({
        id: worker.id,
        name: worker.name,
        status: 'active'
      });
    });

    it('should list all workers', async () => {
      // Create multiple workers
      for (let i = 0; i < 3; i++) {
        await fetch(`http://localhost:${(core as any).config.port}/mcp/orchflow_spawn_worker`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task: `Task ${i}` })
        });
      }
      
      // List all workers
      const response = await fetch(`http://localhost:${(core as any).config.port}/mcp/orchflow_worker_status`);
      const data = await response.json();
      
      expect(data.workers).toHaveLength(3);
      expect(data.workers[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        type: expect.any(String),
        status: expect.any(String),
        progress: expect.any(Number)
      });
    });
  });

  describe('Context Management', () => {
    let workerId: string;
    
    beforeEach(async () => {
      await core.start();
      
      const response = await fetch(`http://localhost:${(core as any).config.port}/mcp/orchflow_spawn_worker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: 'Test task' })
      });
      
      const data = await response.json();
      workerId = data.worker.id;
    });

    it('should switch context to a worker', async () => {
      const response = await fetch(`http://localhost:${(core as any).config.port}/mcp/orchflow_switch_context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId })
      });
      
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(data.context).toMatchObject({
        workerId,
        workerName: expect.any(String),
        conversationHistory: expect.any(Array),
        sharedKnowledge: expect.any(Object)
      });
    });

    it('should share knowledge between workers', async () => {
      // Create another worker
      const response2 = await fetch(`http://localhost:${(core as any).config.port}/mcp/orchflow_spawn_worker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: 'Another task' })
      });
      
      const worker2 = await response2.json();
      
      // Share knowledge
      const knowledge = {
        interfaces: { User: { id: 'string', name: 'string' } },
        decisions: ['Use TypeScript', 'REST API']
      };
      
      const shareResponse = await fetch(`http://localhost:${(core as any).config.port}/mcp/orchflow_share_knowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          knowledge,
          targetWorkers: [workerId, worker2.worker.id]
        })
      });
      
      const shareData = await shareResponse.json();
      expect(shareData.success).toBe(true);
      expect(shareData.sharedWith).toHaveLength(2);
    });
  });

  describe('Parallel Execution', () => {
    beforeEach(async () => {
      await core.start();
    });

    it('should execute tasks in parallel', async () => {
      const tasks = [
        { description: 'Build API', assignTo: 'developer' },
        { description: 'Write tests', assignTo: 'tester' },
        { description: 'Create docs', assignTo: 'developer' }
      ];
      
      const response = await fetch(`http://localhost:${(core as any).config.port}/mcp/orchflow_execute_parallel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks })
      });
      
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(data.results).toHaveLength(3);
      data.results.forEach(result => {
        expect(result).toMatchObject({
          taskId: expect.any(String),
          workerName: expect.any(String),
          status: 'started'
        });
      });
    });
  });

  describe('Worker Naming', () => {
    beforeEach(async () => {
      await core.start();
    });

    const testCases = [
      { task: 'Build React component', expectedPattern: /React.*Developer|Builder/ },
      { task: 'Create API endpoints', expectedPattern: /API.*Developer|Engineer/ },
      { task: 'Test authentication', expectedPattern: /Auth.*Test/ },
      { task: 'Design database schema', expectedPattern: /Database.*Architect|Designer/ }
    ];

    test.each(testCases)('should generate descriptive names for "$task"', async ({ task, expectedPattern }) => {
      const response = await fetch(`http://localhost:${(core as any).config.port}/mcp/orchflow_spawn_worker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task })
      });
      
      const data = await response.json();
      expect(data.worker.name).toMatch(expectedPattern);
    });
  });
});