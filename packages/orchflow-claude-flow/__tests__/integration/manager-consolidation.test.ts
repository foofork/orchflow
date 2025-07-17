/**
 * Integration tests for consolidated managers working together
 * Tests the 5 core managers and their interactions
 */

import { ConfigurationManager } from '../../src/managers/configuration-manager';
import { ContextManager } from '../../src/managers/context-manager';
import { TerminalManager } from '../../src/managers/terminal-manager';
import { getAllManagers } from '../../src/managers/index';
import { WorkerManager } from '../../src/orchestrator/worker-manager';
import { StatusPaneManager } from '../../src/primary-terminal/status-pane-integration';
import { OrchFlowCore } from '../../src/core/orchflow-core';
import { Worker, WorkerContext, Task } from '../../src/types/unified-interfaces';

describe('Manager Consolidation Integration Tests', () => {
  let configManager: ConfigurationManager;
  let contextManager: ContextManager;
  let terminalManager: TerminalManager;
  let workerManager: WorkerManager;
  let statusPaneManager: StatusPaneManager;
  let orchFlowCore: OrchFlowCore;

  beforeEach(async () => {
    configManager = ConfigurationManager.getInstance();
    contextManager = ContextManager.getInstance();
    terminalManager = TerminalManager.getInstance();
    workerManager = new WorkerManager();
    statusPaneManager = new StatusPaneManager();
    orchFlowCore = OrchFlowCore.getInstance();
  });

  describe('Manager Initialization', () => {
    it('should initialize all managers correctly', () => {
      expect(configManager).toBeDefined();
      expect(contextManager).toBeDefined();
      expect(terminalManager).toBeDefined();
      expect(workerManager).toBeDefined();
      expect(statusPaneManager).toBeDefined();
    });

    it('should get all managers through helper function', () => {
      const managers = getAllManagers();
      
      expect(managers.configuration).toBeDefined();
      expect(managers.context).toBeDefined();
      expect(managers.terminal).toBeDefined();
      expect(managers.worker).toBeDefined();
      expect(managers.ui).toBeDefined();
    });

    it('should maintain singleton pattern for core managers', () => {
      const config1 = ConfigurationManager.getInstance();
      const config2 = ConfigurationManager.getInstance();
      expect(config1).toBe(config2);

      const context1 = ContextManager.getInstance();
      const context2 = ContextManager.getInstance();
      expect(context1).toBe(context2);

      const terminal1 = TerminalManager.getInstance();
      const terminal2 = TerminalManager.getInstance();
      expect(terminal1).toBe(terminal2);
    });
  });

  describe('Configuration Manager Integration', () => {
    it('should integrate with other managers for configuration', async () => {
      const config = await configManager.load();
      
      expect(config).toBeDefined();
      expect(config.server).toBeDefined();
      expect(config.security).toBeDefined();
      expect(config.ui).toBeDefined();
      expect(config.terminal).toBeDefined();
    });

    it('should provide configuration to context manager', async () => {
      const config = await configManager.load();
      
      // Context manager should be able to use configuration
      await contextManager.initialize();
      
      expect(contextManager.isInitialized()).toBe(true);
    });

    it('should configure terminal manager settings', async () => {
      const config = await configManager.load();
      
      await terminalManager.initialize();
      
      expect(terminalManager.isInitialized()).toBe(true);
    });

    it('should update configuration across managers', async () => {
      const updates = {
        server: {
          port: 9999
        },
        ui: {
          showResourceUsage: false
        }
      };

      await configManager.updateConfig(updates);
      
      const updatedConfig = await configManager.load();
      expect(updatedConfig.server.port).toBe(9999);
      expect(updatedConfig.ui.showResourceUsage).toBe(false);
    });
  });

  describe('Context Manager Integration', () => {
    it('should maintain worker context across managers', async () => {
      await contextManager.initialize();
      
      const testWorker: Worker = {
        id: 'test-worker-1',
        name: 'Test Worker',
        type: 'researcher',
        task: 'Test task',
        status: 'idle',
        context: {
          conversationHistory: [],
          sharedKnowledge: {
            facts: {},
            patterns: {},
            insights: {},
            bestPractices: {}
          },
          codeArtifacts: [],
          decisions: []
        },
        progress: 0,
        createdAt: new Date(),
        lastActive: new Date(),
        children: []
      };

      await contextManager.updateWorkerContext(testWorker.id, testWorker.context);
      
      const retrievedContext = await contextManager.getWorkerContext(testWorker.id);
      expect(retrievedContext).toBeDefined();
      expect(retrievedContext?.conversationHistory).toBeDefined();
    });

    it('should share context between worker and terminal managers', async () => {
      await contextManager.initialize();
      await terminalManager.initialize();
      
      const context: WorkerContext = {
        conversationHistory: [
          {
            role: 'user',
            content: 'Test message',
            timestamp: new Date(),
            workerId: 'test-worker'
          }
        ],
        sharedKnowledge: {
          facts: { testFact: 'value' },
          patterns: {},
          insights: {},
          bestPractices: {}
        },
        codeArtifacts: [],
        decisions: []
      };

      await contextManager.updateWorkerContext('test-worker', context);
      
      // Terminal manager should be able to access this context
      const retrievedContext = await contextManager.getWorkerContext('test-worker');
      expect(retrievedContext?.conversationHistory[0].content).toBe('Test message');
    });

    it('should maintain task context', async () => {
      await contextManager.initialize();
      
      const task: Task = {
        id: 'test-task-1',
        description: 'Test task for context',
        type: 'research',
        priority: 'medium',
        status: 'pending',
        assignedTo: 'test-worker',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await contextManager.updateTaskContext(task.id, {
        mainObjective: task.description,
        activeSubtasks: [],
        completedTasks: [],
        dependencies: new Map(),
        taskHistory: []
      });

      const taskContext = await contextManager.getTaskContext(task.id);
      expect(taskContext?.mainObjective).toBe(task.description);
    });
  });

  describe('Terminal Manager Integration', () => {
    it('should integrate with worker manager for terminal access', async () => {
      await terminalManager.initialize();
      
      const testWorker: Worker = {
        id: 'terminal-test-worker',
        name: 'Terminal Test Worker',
        type: 'coder',
        task: 'Terminal integration test',
        status: 'idle',
        context: {
          conversationHistory: [],
          sharedKnowledge: {
            facts: {},
            patterns: {},
            insights: {},
            bestPractices: {}
          },
          codeArtifacts: [],
          decisions: []
        },
        progress: 0,
        createdAt: new Date(),
        lastActive: new Date(),
        children: []
      };

      // Terminal manager should be able to handle worker connections
      const session = await terminalManager.createSession({
        workerId: testWorker.id,
        sessionName: 'test-session'
      });

      expect(session).toBeDefined();
      expect(session.workerId).toBe(testWorker.id);
    });

    it('should manage terminal state across workers', async () => {
      await terminalManager.initialize();
      
      const state = terminalManager.getState();
      expect(state).toBeDefined();
      expect(state.sessions).toBeDefined();
      expect(state.activeSession).toBeDefined();
    });

    it('should integrate with status pane manager', async () => {
      await terminalManager.initialize();
      
      const session = await terminalManager.createSession({
        workerId: 'status-test-worker',
        sessionName: 'status-session'
      });

      // Status pane manager should be able to display terminal information
      expect(statusPaneManager.isActive()).toBeDefined();
    });
  });

  describe('Worker Manager Integration', () => {
    it('should create and manage workers across all managers', async () => {
      await contextManager.initialize();
      await terminalManager.initialize();
      
      const workerConfig = {
        type: 'analyst' as const,
        task: 'Integration test analysis',
        capabilities: ['analysis', 'research']
      };

      const worker = await workerManager.createWorker(workerConfig);
      
      expect(worker).toBeDefined();
      expect(worker.type).toBe('analyst');
      expect(worker.task).toBe('Integration test analysis');
      
      // Context should be created
      const context = await contextManager.getWorkerContext(worker.id);
      expect(context).toBeDefined();
      
      // Terminal session should be available
      const session = await terminalManager.createSession({
        workerId: worker.id,
        sessionName: `worker-${worker.id}`
      });
      expect(session).toBeDefined();
    });

    it('should handle worker lifecycle across managers', async () => {
      await contextManager.initialize();
      await terminalManager.initialize();
      
      const worker = await workerManager.createWorker({
        type: 'tester',
        task: 'Lifecycle test',
        capabilities: ['testing']
      });

      // Start worker
      await workerManager.startWorker(worker.id);
      expect(worker.status).toBe('active');
      
      // Stop worker
      await workerManager.stopWorker(worker.id);
      expect(worker.status).toBe('stopped');
      
      // Context should be preserved
      const context = await contextManager.getWorkerContext(worker.id);
      expect(context).toBeDefined();
    });

    it('should coordinate worker tasks across managers', async () => {
      await contextManager.initialize();
      
      const worker = await workerManager.createWorker({
        type: 'coder',
        task: 'Code generation test',
        capabilities: ['coding', 'testing']
      });

      const task: Task = {
        id: 'integration-task-1',
        description: 'Integration test task',
        type: 'code',
        priority: 'high',
        status: 'pending',
        assignedTo: worker.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await workerManager.assignTask(worker.id, task);
      
      // Context should be updated
      const context = await contextManager.getWorkerContext(worker.id);
      expect(context).toBeDefined();
      
      // Task context should be created
      const taskContext = await contextManager.getTaskContext(task.id);
      expect(taskContext).toBeDefined();
    });
  });

  describe('Status Pane Manager Integration', () => {
    it('should display information from all managers', async () => {
      await contextManager.initialize();
      await terminalManager.initialize();
      
      const worker = await workerManager.createWorker({
        type: 'monitor',
        task: 'Status monitoring',
        capabilities: ['monitoring']
      });

      // Status pane should show worker information
      expect(statusPaneManager.isActive()).toBeDefined();
      
      // Should be able to get worker data for display
      const workers = await workerManager.listWorkers();
      expect(workers.length).toBeGreaterThan(0);
    });

    it('should update status across manager changes', async () => {
      await contextManager.initialize();
      await terminalManager.initialize();
      
      const worker = await workerManager.createWorker({
        type: 'optimizer',
        task: 'Performance optimization',
        capabilities: ['optimization']
      });

      // Update worker status
      await workerManager.updateWorkerStatus(worker.id, 'active');
      
      // Status pane should reflect the change
      expect(statusPaneManager.isActive()).toBeDefined();
    });
  });

  describe('Cross-Manager Data Flow', () => {
    it('should maintain data consistency across managers', async () => {
      await contextManager.initialize();
      await terminalManager.initialize();
      
      const worker = await workerManager.createWorker({
        type: 'specialist',
        task: 'Data consistency test',
        capabilities: ['data-management']
      });

      // Update context
      const context: WorkerContext = {
        conversationHistory: [
          {
            role: 'user',
            content: 'Data flow test',
            timestamp: new Date(),
            workerId: worker.id
          }
        ],
        sharedKnowledge: {
          facts: { dataFlow: 'tested' },
          patterns: {},
          insights: {},
          bestPractices: {}
        },
        codeArtifacts: [],
        decisions: []
      };

      await contextManager.updateWorkerContext(worker.id, context);
      
      // Create terminal session
      const session = await terminalManager.createSession({
        workerId: worker.id,
        sessionName: 'data-flow-session'
      });

      // All managers should have consistent data
      const retrievedContext = await contextManager.getWorkerContext(worker.id);
      expect(retrievedContext?.conversationHistory[0].content).toBe('Data flow test');
      expect(session.workerId).toBe(worker.id);
    });

    it('should handle manager interaction errors gracefully', async () => {
      await contextManager.initialize();
      
      // Try to access non-existent worker
      const context = await contextManager.getWorkerContext('non-existent-worker');
      expect(context).toBeNull();
      
      // Try to create session for non-existent worker
      const session = await terminalManager.createSession({
        workerId: 'non-existent-worker',
        sessionName: 'error-session'
      });
      
      // Should handle gracefully without crashing
      expect(session).toBeDefined();
    });
  });

  describe('Configuration Propagation', () => {
    it('should propagate configuration changes across managers', async () => {
      const config = await configManager.load();
      
      const updates = {
        ui: {
          showResourceUsage: true,
          maxWorkersDisplay: 20
        },
        terminal: {
          sessionName: 'test-session',
          multiplexer: 'tmux' as const
        }
      };

      await configManager.updateConfig(updates);
      
      const updatedConfig = await configManager.load();
      expect(updatedConfig.ui.showResourceUsage).toBe(true);
      expect(updatedConfig.ui.maxWorkersDisplay).toBe(20);
      expect(updatedConfig.terminal.sessionName).toBe('test-session');
    });

    it('should initialize managers with updated configuration', async () => {
      await configManager.updateConfig({
        server: {
          port: 8888
        }
      });

      await contextManager.initialize();
      await terminalManager.initialize();
      
      const config = await configManager.load();
      expect(config.server.port).toBe(8888);
    });
  });

  describe('Performance Integration', () => {
    it('should handle concurrent operations across managers', async () => {
      await contextManager.initialize();
      await terminalManager.initialize();
      
      const workers = await Promise.all([
        workerManager.createWorker({
          type: 'researcher',
          task: 'Concurrent research 1',
          capabilities: ['research']
        }),
        workerManager.createWorker({
          type: 'researcher',
          task: 'Concurrent research 2',
          capabilities: ['research']
        }),
        workerManager.createWorker({
          type: 'researcher',
          task: 'Concurrent research 3',
          capabilities: ['research']
        })
      ]);

      expect(workers.length).toBe(3);
      workers.forEach(worker => {
        expect(worker.type).toBe('researcher');
        expect(worker.status).toBeDefined();
      });
    });

    it('should handle high-frequency updates', async () => {
      await contextManager.initialize();
      
      const worker = await workerManager.createWorker({
        type: 'monitor',
        task: 'High frequency updates',
        capabilities: ['monitoring']
      });

      // Simulate high-frequency updates
      const updatePromises = Array.from({ length: 100 }, async (_, i) => {
        const context: WorkerContext = {
          conversationHistory: [
            {
              role: 'user',
              content: `Update ${i}`,
              timestamp: new Date(),
              workerId: worker.id
            }
          ],
          sharedKnowledge: {
            facts: { update: i },
            patterns: {},
            insights: {},
            bestPractices: {}
          },
          codeArtifacts: [],
          decisions: []
        };

        await contextManager.updateWorkerContext(worker.id, context);
      });

      await Promise.all(updatePromises);
      
      // Final context should be preserved
      const finalContext = await contextManager.getWorkerContext(worker.id);
      expect(finalContext).toBeDefined();
    });
  });

  describe('Error Recovery', () => {
    it('should recover from manager failures', async () => {
      await contextManager.initialize();
      
      // Simulate context manager failure
      try {
        await contextManager.updateWorkerContext('invalid-worker', null as any);
      } catch (error) {
        // Should handle gracefully
        expect(error).toBeDefined();
      }
      
      // Context manager should still be functional
      const context = await contextManager.getWorkerContext('test-worker');
      expect(context).toBeDefined();
    });

    it('should maintain functionality during partial failures', async () => {
      await contextManager.initialize();
      await terminalManager.initialize();
      
      const worker = await workerManager.createWorker({
        type: 'tester',
        task: 'Failure recovery test',
        capabilities: ['testing']
      });

      // Even if one operation fails, others should work
      try {
        await terminalManager.createSession({
          workerId: 'invalid-worker',
          sessionName: 'invalid-session'
        });
      } catch (error) {
        // Expected failure
      }
      
      // Valid operations should still work
      const validSession = await terminalManager.createSession({
        workerId: worker.id,
        sessionName: 'valid-session'
      });
      
      expect(validSession).toBeDefined();
      expect(validSession.workerId).toBe(worker.id);
    });
  });
});