import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentManager } from './agent-manager';
import { TerminalAdapter } from './terminal/terminal-adapter';
import { EventBus, OrchflowEvents } from './core/event-bus';

// Mock terminal adapter
class MockTerminalAdapter implements TerminalAdapter {
  private panes = new Map<string, { sessionName: string; command: string }>();
  private nextPaneId = 1;

  async initialize(): Promise<void> {}
  
  async createSession(sessionName: string): Promise<void> {}
  
  async createPane(sessionName: string, command?: string): Promise<string> {
    const paneId = `pane-${this.nextPaneId++}`;
    this.panes.set(paneId, { sessionName, command: command || '' });
    return paneId;
  }
  
  async sendKeys(paneId: string, keys: string): Promise<void> {}
  
  async killPane(paneId: string): Promise<void> {
    this.panes.delete(paneId);
  }
  
  async capturePane(paneId: string, lines?: number): Promise<string> {
    return 'Mock output';
  }
  
  async listPanes(): Promise<Array<{ id: string; sessionName: string }>> {
    return Array.from(this.panes.entries()).map(([id, info]) => ({
      id,
      sessionName: info.sessionName,
    }));
  }
  
  async sessionExists(sessionName: string): Promise<boolean> {
    return true;
  }
  
  async killSession(sessionName: string): Promise<void> {}
}

describe('AgentManager', () => {
  let agentManager: AgentManager;
  let mockAdapter: MockTerminalAdapter;

  beforeEach(async () => {
    mockAdapter = new MockTerminalAdapter();
    agentManager = new AgentManager('test-session');
    // Replace the adapter with mock
    (agentManager as any).adapter = mockAdapter;
    await agentManager.initialize();
  });

  afterEach(async () => {
    await agentManager.shutdown();
  });

  describe('Agent Creation', () => {
    it('should create agents without tmux dependency', async () => {
      const agent = await agentManager.createAgent({
        name: 'test-agent',
        type: 'command',
        command: 'echo test',
      });

      expect(agent).toBeDefined();
      expect(agent.name).toBe('test-agent');
      expect(agent.type).toBe('command');
      expect(agent.status).toBe('running');
      expect(agent.terminalId).toBeDefined();
    });

    it('should emit agent created event', async () => {
      let eventFired = false;
      EventBus.once(OrchflowEvents.AGENT_CREATED, (data) => {
        eventFired = true;
        expect(data.name).toBe('test-agent');
      });

      await agentManager.createAgent({
        name: 'test-agent',
        type: 'command',
      });

      expect(eventFired).toBe(true);
    });

    it('should create different types of agents', async () => {
      const commandAgent = await agentManager.createAgent({
        name: 'command-agent',
        type: 'command',
      });
      expect(commandAgent.type).toBe('command');

      const fileAgent = await agentManager.createAgent({
        name: 'file-agent',
        type: 'file',
      });
      expect(fileAgent.type).toBe('file');

      const webAgent = await agentManager.createAgent({
        name: 'web-agent',
        type: 'web',
      });
      expect(webAgent.type).toBe('web');
    });
  });

  describe('Agent Management', () => {
    it('should list all agents', async () => {
      await agentManager.createAgent({ name: 'agent1', type: 'command' });
      await agentManager.createAgent({ name: 'agent2', type: 'file' });

      const agents = await agentManager.listAgents();
      expect(agents.length).toBe(2);
      expect(agents.some(a => a.name === 'agent1')).toBe(true);
      expect(agents.some(a => a.name === 'agent2')).toBe(true);
    });

    it('should get agent by id', async () => {
      const created = await agentManager.createAgent({
        name: 'test-agent',
        type: 'command',
      });

      const agent = agentManager.getAgent(created.id);
      expect(agent).toBeDefined();
      expect(agent?.name).toBe('test-agent');
    });

    it('should stop agent', async () => {
      const agent = await agentManager.createAgent({
        name: 'test-agent',
        type: 'command',
      });

      let eventFired = false;
      EventBus.once(OrchflowEvents.AGENT_STOPPED, (data) => {
        eventFired = true;
        expect(data.agentId).toBe(agent.id);
      });

      await agentManager.stopAgent(agent.id);
      
      expect(eventFired).toBe(true);
      const stoppedAgent = agentManager.getAgent(agent.id);
      expect(stoppedAgent?.status).toBe('stopped');
    });
  });

  describe('Agent Communication', () => {
    it('should send commands to agents', async () => {
      const agent = await agentManager.createAgent({
        name: 'test-agent',
        type: 'command',
      });

      // Should not throw
      await expect(
        agentManager.sendCommand(agent.id, 'echo hello')
      ).resolves.not.toThrow();
    });

    it('should get agent output', async () => {
      const agent = await agentManager.createAgent({
        name: 'test-agent',
        type: 'command',
      });

      const output = await agentManager.getOutput(agent.id);
      expect(output).toBe('Mock output');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid agent id', async () => {
      await expect(
        agentManager.stopAgent('invalid-id')
      ).rejects.toThrow('Agent not found');
    });

    it('should handle agent creation failure gracefully', async () => {
      // Mock adapter to throw error
      mockAdapter.createPane = vi.fn().mockRejectedValue(new Error('Creation failed'));

      const agent = await agentManager.createAgent({
        name: 'failing-agent',
        type: 'command',
      });

      expect(agent.status).toBe('failed');
      expect(agent.error).toContain('Creation failed');
    });
  });
});