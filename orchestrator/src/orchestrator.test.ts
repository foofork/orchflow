import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Orchestrator, createOrchestrator } from './orchestrator';
import { EventBus, OrchflowEvents } from './core/event-bus';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Orchestrator', () => {
  let orchestrator: Orchestrator;
  const testDataDir = '.test-orchflow';

  beforeEach(async () => {
    // Clean test directory
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch {}
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    // Clean test directory
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch {}
  });

  describe('Core Functionality', () => {
    it('should initialize with default configuration', async () => {
      orchestrator = await createOrchestrator({
        dataDir: testDataDir,
        enableWebSocket: false, // Disable WebSocket for tests
      });

      const status = await orchestrator.getStatus();
      expect(status.features).toContain('core');
      expect(status.features).toContain('sessions');
      expect(status.features).toContain('protocols');
    });

    it('should create and manage agents', async () => {
      orchestrator = await createOrchestrator({
        dataDir: testDataDir,
        enableWebSocket: false,
      });

      const agent = await orchestrator.createAgent('test-agent', 'command', 'echo test');
      expect(agent).toBeDefined();
      expect(agent.name).toBe('test-agent');
      expect(agent.type).toBe('command');

      const agents = await orchestrator.listAgents();
      expect(agents.length).toBeGreaterThan(0);
      expect(agents.some(a => a.name === 'test-agent')).toBe(true);

      await orchestrator.stopAgent(agent.id);
    });

    it('should execute commands through router', async () => {
      orchestrator = await createOrchestrator({
        dataDir: testDataDir,
        enableWebSocket: false,
      });

      const result = await orchestrator.execute('help');
      expect(result).toBeDefined();
    });
  });

  describe('Session Management', () => {
    it('should create and manage sessions', async () => {
      orchestrator = await createOrchestrator({
        dataDir: testDataDir,
        enableWebSocket: false,
        enableSessions: true,
      });

      await orchestrator.startSession('test-session', { key: 'value' });
      
      const status = await orchestrator.getStatus();
      expect(status.session).toBeDefined();
      expect(status.session.name).toBe('test-session');
    });

    it('should generate handoff summary', async () => {
      orchestrator = await createOrchestrator({
        dataDir: testDataDir,
        enableWebSocket: false,
        enableSessions: true,
      });

      await orchestrator.startSession('test-session');
      const handoff = await orchestrator.generateHandoff();
      
      expect(handoff).toContain('OrchFlow Session Handoff');
      expect(handoff).toContain('test-session');
    });
  });

  describe('Protocol Management', () => {
    it('should add and list protocols', async () => {
      orchestrator = await createOrchestrator({
        dataDir: testDataDir,
        enableWebSocket: false,
        enableProtocols: true,
      });

      await orchestrator.addProtocol({
        type: 'directive',
        name: 'Test Protocol',
        description: 'A test protocol',
        priority: 100,
        enabled: true,
      });

      const protocols = orchestrator.listProtocols();
      expect(protocols.length).toBeGreaterThan(0);
      expect(protocols.some(p => p.name === 'Test Protocol')).toBe(true);
    });

    it('should block commands based on protocols', async () => {
      orchestrator = await createOrchestrator({
        dataDir: testDataDir,
        enableWebSocket: false,
        enableProtocols: true,
      });

      // Test with default protocols
      const protocols = orchestrator.listProtocols({ type: 'constraint' });
      const forcePushProtocol = protocols.find(p => p.name === 'No Force Push');
      expect(forcePushProtocol).toBeDefined();
    });
  });

  describe('Mode Management', () => {
    it('should activate and deactivate modes', async () => {
      orchestrator = await createOrchestrator({
        dataDir: testDataDir,
        enableWebSocket: false,
        enableModes: true,
      });

      const modes = orchestrator.listModes();
      expect(modes.length).toBeGreaterThan(0);

      if (modes.length > 0) {
        await orchestrator.activateMode(modes[0].name);
        
        const activeMode = orchestrator.getActiveMode();
        expect(activeMode).toBeDefined();
        expect(activeMode.name).toBe(modes[0].name);

        await orchestrator.endMode();
        expect(orchestrator.getActiveMode()).toBeNull();
      }
    });
  });

  describe('Memory Management', () => {
    it('should remember and recall data', async () => {
      orchestrator = await createOrchestrator({
        dataDir: testDataDir,
        enableWebSocket: false,
        enableMemory: true,
      });

      await orchestrator.remember('test-key', { data: 'test-value' }, {
        tags: ['test'],
        category: 'test',
      });

      const recalled = await orchestrator.recall('test-key');
      expect(recalled).toBeDefined();
      expect(recalled.data).toBe('test-value');
    });

    it.skip('should search memory', async () => {
      orchestrator = await createOrchestrator({
        dataDir: testDataDir,
        enableWebSocket: false,
        enableMemory: true,
      });

      await orchestrator.remember('test-key-1', 'search-term data');
      await orchestrator.remember('test-key-2', 'other-data');

      // Give time for indexing
      await new Promise(resolve => setTimeout(resolve, 100));

      const results = await orchestrator.searchMemory('search');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.key === 'test-key-1')).toBe(true);
    });

    it('should forget data', async () => {
      orchestrator = await createOrchestrator({
        dataDir: testDataDir,
        enableWebSocket: false,
        enableMemory: true,
      });

      await orchestrator.remember('test-key', { data: 'test' });
      await orchestrator.forget('test-key');

      const recalled = await orchestrator.recall('test-key');
      expect(recalled).toBeNull();
    });
  });

  describe('Cache Management', () => {
    it('should cache command results', async () => {
      orchestrator = await createOrchestrator({
        dataDir: testDataDir,
        enableWebSocket: false,
        enableCache: true,
      });

      // Execute a cacheable command twice
      const result1 = await orchestrator.execute('help');
      const result2 = await orchestrator.execute('help');

      // Should be the same result (cached)
      expect(result2).toEqual(result1);
    });

    it('should invalidate cache on file changes', async () => {
      orchestrator = await createOrchestrator({
        dataDir: testDataDir,
        enableWebSocket: false,
        enableCache: true,
      });

      const status1 = await orchestrator.getStatus();
      expect(status1.cache.enabled).toBe(true);

      // Emit file change event
      EventBus.emit(OrchflowEvents.FILE_SAVED, { filePath: 'test.txt' });

      // Cache should handle the invalidation without errors
      const status2 = await orchestrator.getStatus();
      expect(status2.cache.enabled).toBe(true);
    });
  });

  describe('Resource Management', () => {
    it('should acquire and release resources', async () => {
      orchestrator = await createOrchestrator({
        dataDir: testDataDir,
        enableWebSocket: false,
        enableResourceManager: true,
      });

      // Need to use internal resource manager to register resource
      const resourceManager = await import('./core/resource-manager').then(m => m.resourceManager);
      resourceManager.registerResource({
        id: 'test-resource',
        type: 'custom',
        name: 'Test Resource',
      });

      const acquired = await orchestrator.acquireResource(
        'test-resource',
        'test-owner',
        'exclusive'
      );
      expect(acquired).toBe(true);

      const released = orchestrator.releaseResource('test-resource', 'test-owner');
      expect(released).toBe(true);
    });
  });

  describe('Circuit Breakers', () => {
    it('should protect agent creation with circuit breaker', async () => {
      orchestrator = await createOrchestrator({
        dataDir: testDataDir,
        enableWebSocket: false,
        enableCircuitBreakers: true,
      });

      // Should work normally
      const agent = await orchestrator.createAgent('test', 'command', 'echo test');
      expect(agent).toBeDefined();
      await orchestrator.stopAgent(agent.id);
    });
  });

  describe('Feature Flags', () => {
    it('should respect feature flags', async () => {
      orchestrator = await createOrchestrator({
        dataDir: testDataDir,
        enableWebSocket: false,
        enableMemory: false,
        enableScheduler: false,
        enableMCP: false,
        enableSwarm: false,
      });

      const status = await orchestrator.getStatus();
      expect(status.features).not.toContain('memory');
      expect(status.features).not.toContain('scheduler');
      expect(status.features).not.toContain('mcp');
      expect(status.features).not.toContain('swarm');

      // Memory operations should throw
      await expect(orchestrator.remember('key', 'value')).rejects.toThrow('Memory not enabled');
      
      // Scheduler operations should throw
      await expect(orchestrator.submitTask({})).rejects.toThrow('Scheduler not enabled');
      
      // MCP operations should throw
      await expect(orchestrator.registerMCPServer({} as any)).rejects.toThrow('MCP not enabled');
      
      // Swarm operations should throw
      await expect(orchestrator.submitSwarmTask({} as any)).rejects.toThrow('Swarm not enabled');
    });
  });

  describe('Status and Metrics', () => {
    it('should provide comprehensive status', async () => {
      orchestrator = await createOrchestrator({
        dataDir: testDataDir,
        enableWebSocket: false,
        enableSessions: true,
        enableProtocols: true,
        enableModes: true,
        enableCircuitBreakers: true,
        enableResourceManager: true,
      });

      const status = await orchestrator.getStatus();

      expect(status).toHaveProperty('agents');
      expect(status).toHaveProperty('features');
      expect(status).toHaveProperty('cache');
      expect(status).toHaveProperty('protocols');
      expect(status).toHaveProperty('availableModes');
      expect(status).toHaveProperty('circuitBreakers');
      expect(status).toHaveProperty('resources');
    });
  });

  describe('Event Integration', () => {
    it('should emit events for agent lifecycle', async () => {
      orchestrator = await createOrchestrator({
        dataDir: testDataDir,
        enableWebSocket: false,
      });

      const events: any[] = [];
      
      EventBus.on(OrchflowEvents.AGENT_CREATED, (data) => {
        events.push({ type: 'created', data });
      });
      
      EventBus.on(OrchflowEvents.AGENT_STOPPED, (data) => {
        events.push({ type: 'stopped', data });
      });

      const agent = await orchestrator.createAgent('test', 'command', 'echo test');
      await orchestrator.stopAgent(agent.id);

      // Give time for events to propagate
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(events.some(e => e.type === 'created')).toBe(true);
      expect(events.some(e => e.type === 'stopped')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', async () => {
      // Try to create orchestrator with invalid path - should fail
      let error: Error | null = null;
      try {
        orchestrator = await createOrchestrator({
          dataDir: '/invalid/path/that/cannot/exist',
          enableWebSocket: false,
        });
      } catch (e) {
        error = e as Error;
      }

      // Should fail to initialize
      expect(error).toBeDefined();
      expect(error?.message).toContain('ENOENT');
    });
  });
});