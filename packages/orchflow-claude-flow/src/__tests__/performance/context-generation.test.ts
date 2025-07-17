import { OrchFlowFunctionalContext } from '../../context/functional-context';
import { DynamicInstructionProvider } from '../../instructions/dynamic-instructions';
import { OrchFlowMemoryContext } from '../../context/memory-context';
import { ClaudeMDManager } from '../../context/claude-md-manager';
import { OrchestratorClient } from '../../orchestrator/orchflow-orchestrator';
import { ConversationContext } from '../../primary-terminal/conversation-context';
import { WorkerAccessManager } from '../../primary-terminal/worker-access-manager';
import { Worker } from '../../types';

jest.mock('../../orchestrator/orchflow-orchestrator');
jest.mock('../../primary-terminal/conversation-context');
jest.mock('../../primary-terminal/worker-access-manager');
jest.mock('../../primary-terminal/mcp-client');

describe('Context Generation Performance Tests', () => {
  let functionalContext: OrchFlowFunctionalContext;
  let instructionProvider: DynamicInstructionProvider;
  let memoryContext: OrchFlowMemoryContext;
  let claudeMDManager: ClaudeMDManager;
  let mockOrchestratorClient: jest.Mocked<OrchestratorClient>;
  let mockConversationContext: jest.Mocked<ConversationContext>;
  let mockWorkerManager: jest.Mocked<WorkerAccessManager>;

  beforeEach(() => {
    mockOrchestratorClient = {
      listWorkers: jest.fn(),
      getWorkerStatus: jest.fn(),
      getSystemStatus: jest.fn(),
    } as any;

    mockConversationContext = {
      getRecentHistory: jest.fn(),
      addEntry: jest.fn(),
      getContext: jest.fn(),
    } as any;

    mockWorkerManager = {
      getQuickAccessMapping: jest.fn(),
      getWorkerByQuickAccess: jest.fn(),
    } as any;

    functionalContext = new OrchFlowFunctionalContext(
      mockOrchestratorClient,
      mockConversationContext,
      mockWorkerManager
    );

    instructionProvider = new DynamicInstructionProvider();
    memoryContext = new OrchFlowMemoryContext({} as any);
    claudeMDManager = new ClaudeMDManager();
  });

  describe('Context Generation Performance', () => {
    it('should generate context within performance threshold', async () => {
      // Create large dataset
      const workers: Worker[] = Array(50).fill(null).map((_, i) => ({
        id: `worker-${i}`,
        name: `Worker ${i}`,
        type: 'developer',
        status: 'active',
        progress: Math.random() * 100,
        lastActivity: new Date(),
        quickAccessKey: i < 9 ? i + 1 : null,
        conversationHistory: Array(10).fill(null).map((_, j) => ({
          timestamp: new Date(),
          message: `Message ${j} from worker ${i}`
        })),
        sharedKnowledge: {
          technologies: ['Node.js', 'React', 'PostgreSQL'],
          decisions: [`Decision ${i}-1`, `Decision ${i}-2`]
        }
      }));

      const history = Array(100).fill(null).map((_, i) => ({
        timestamp: new Date(),
        message: `History message ${i}`
      }));

      const quickAccessMap = Object.fromEntries(
        workers.slice(0, 9).map((w, i) => [i + 1, w.id])
      );

      mockOrchestratorClient.listWorkers.mockResolvedValue(workers);
      mockConversationContext.getRecentHistory.mockReturnValue(history);
      mockWorkerManager.getQuickAccessMapping.mockResolvedValue(quickAccessMap);

      const iterations = 10;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        await functionalContext.getContext('Create a new React component');
        const endTime = performance.now();
        times.push(endTime - startTime);
      }

      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);

      console.log(`Context generation - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);

      // Performance thresholds
      expect(avgTime).toBeLessThan(50); // Average should be under 50ms
      expect(maxTime).toBeLessThan(100); // Maximum should be under 100ms
    });

    it('should handle concurrent context generation efficiently', async () => {
      const workers: Worker[] = Array(20).fill(null).map((_, i) => ({
        id: `worker-${i}`,
        name: `Worker ${i}`,
        type: 'developer',
        status: 'active',
        progress: Math.random() * 100,
        lastActivity: new Date(),
        quickAccessKey: i < 9 ? i + 1 : null,
        conversationHistory: [],
        sharedKnowledge: {}
      }));

      mockOrchestratorClient.listWorkers.mockResolvedValue(workers);
      mockConversationContext.getRecentHistory.mockReturnValue([]);
      mockWorkerManager.getQuickAccessMapping.mockResolvedValue({});

      const concurrentRequests = 20;
      const startTime = performance.now();

      const promises = Array(concurrentRequests).fill(null).map(() =>
        functionalContext.getContext('Create a new component')
      );

      await Promise.all(promises);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      console.log(`Concurrent context generation (${concurrentRequests} requests): ${totalTime.toFixed(2)}ms`);

      // Should complete all requests within reasonable time
      expect(totalTime).toBeLessThan(500);
    });
  });

  describe('Instruction Generation Performance', () => {
    it('should generate instructions within performance threshold', () => {
      const context = {
        currentTask: {
          mainObjective: 'Build complex e-commerce platform',
          activeSubtasks: Array(20).fill(null).map((_, i) => `Subtask ${i}`),
          completedTasks: Array(15).fill(null).map((_, i) => `Completed task ${i}`)
        },
        workers: Array(30).fill(null).map((_, i) => ({
          id: `worker-${i}`,
          name: `Worker ${i}`,
          descriptiveName: `Professional Worker ${i}`,
          status: 'active',
          progress: Math.random() * 100,
          quickAccessKey: i < 9 ? i + 1 : null
        })),
        availableCommands: Array(50).fill(null).map((_, i) => `Command ${i}`)
      };

      const iterations = 100;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        instructionProvider.generateInstructions('web-development', context);
        const endTime = performance.now();
        times.push(endTime - startTime);
      }

      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);

      console.log(`Instruction generation - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);

      // Performance thresholds
      expect(avgTime).toBeLessThan(5); // Average should be under 5ms
      expect(maxTime).toBeLessThan(10); // Maximum should be under 10ms
    });
  });

  describe('CLAUDE.md Generation Performance', () => {
    it('should generate CLAUDE.md content within performance threshold', async () => {
      const context = {
        workers: Array(25).fill(null).map((_, i) => ({
          id: `worker-${i}`,
          name: `Worker ${i}`,
          descriptiveName: `Professional Worker ${i}`,
          status: 'active',
          progress: Math.random() * 100,
          quickAccessKey: i < 9 ? i + 1 : null
        })),
        currentTask: {
          mainObjective: 'Build comprehensive application',
          activeSubtasks: Array(15).fill(null).map((_, i) => `Active subtask ${i}`),
          completedTasks: Array(10).fill(null).map((_, i) => `Completed task ${i}`)
        }
      };

      const iterations = 50;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        await claudeMDManager.generateOrchFlowSection(context);
        const endTime = performance.now();
        times.push(endTime - startTime);
      }

      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);

      console.log(`CLAUDE.md generation - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);

      // Performance thresholds
      expect(avgTime).toBeLessThan(10); // Average should be under 10ms
      expect(maxTime).toBeLessThan(20); // Maximum should be under 20ms
    });
  });

  describe('Memory System Performance', () => {
    it('should handle memory operations efficiently', async () => {
      const mockMcpClient = {
        invokeTool: jest.fn().mockResolvedValue({ success: true, matches: [] })
      };

      const memoryContext = new OrchFlowMemoryContext(mockMcpClient as any);

      const iterations = 50;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        
        // Store context
        await memoryContext.storeWorkerContext(`worker-${i}`, {
          name: `Worker ${i}`,
          task: `Task ${i}`,
          progress: Math.random() * 100,
          decisions: Array(5).fill(null).map((_, j) => `Decision ${i}-${j}`)
        });

        // Get task history
        await memoryContext.getTaskHistory(10);

        const endTime = performance.now();
        times.push(endTime - startTime);
      }

      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);

      console.log(`Memory operations - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);

      // Performance thresholds
      expect(avgTime).toBeLessThan(20); // Average should be under 20ms
      expect(maxTime).toBeLessThan(50); // Maximum should be under 50ms
    });
  });

  describe('Similarity Calculation Performance', () => {
    it('should calculate similarity efficiently', () => {
      const testStrings = [
        'Create a React component for user authentication',
        'Build a Vue.js component for user login',
        'Implement React authentication component',
        'Design user interface for login system',
        'Create database schema for user management',
        'Build API endpoints for authentication',
        'Implement OAuth integration',
        'Create responsive navigation component',
        'Design mobile-first user interface',
        'Build comprehensive testing suite'
      ];

      const iterations = 1000;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        
        for (let j = 0; j < testStrings.length; j++) {
          for (let k = j + 1; k < testStrings.length; k++) {
            memoryContext.calculateSimilarity(testStrings[j], testStrings[k]);
          }
        }

        const endTime = performance.now();
        times.push(endTime - startTime);
      }

      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);

      console.log(`Similarity calculation - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);

      // Performance thresholds
      expect(avgTime).toBeLessThan(5); // Average should be under 5ms
      expect(maxTime).toBeLessThan(10); // Maximum should be under 10ms
    });
  });

  describe('End-to-End Context Pipeline Performance', () => {
    it('should handle complete context pipeline efficiently', async () => {
      const workers: Worker[] = Array(30).fill(null).map((_, i) => ({
        id: `worker-${i}`,
        name: `Worker ${i}`,
        type: 'developer',
        status: 'active',
        progress: Math.random() * 100,
        lastActivity: new Date(),
        quickAccessKey: i < 9 ? i + 1 : null,
        conversationHistory: [],
        sharedKnowledge: {}
      }));

      mockOrchestratorClient.listWorkers.mockResolvedValue(workers);
      mockConversationContext.getRecentHistory.mockReturnValue([]);
      mockWorkerManager.getQuickAccessMapping.mockResolvedValue({});

      const iterations = 20;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();

        // 1. Get functional context
        const context = await functionalContext.getContext('Create a new React component');
        
        // 2. Generate instructions
        const instructions = instructionProvider.generateInstructions('web-development', context);
        
        // 3. Generate CLAUDE.md content
        const claudeMDContent = await claudeMDManager.generateOrchFlowSection(context);

        const endTime = performance.now();
        times.push(endTime - startTime);
      }

      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);

      console.log(`End-to-end pipeline - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);

      // Performance thresholds
      expect(avgTime).toBeLessThan(100); // Average should be under 100ms
      expect(maxTime).toBeLessThan(200); // Maximum should be under 200ms
    });
  });

  describe('Memory Pressure Tests', () => {
    it('should handle large datasets without memory issues', async () => {
      const initialMemory = process.memoryUsage();

      // Create very large dataset
      const workers: Worker[] = Array(100).fill(null).map((_, i) => ({
        id: `worker-${i}`,
        name: `Worker ${i}`,
        type: 'developer',
        status: 'active',
        progress: Math.random() * 100,
        lastActivity: new Date(),
        quickAccessKey: i < 9 ? i + 1 : null,
        conversationHistory: Array(50).fill(null).map((_, j) => ({
          timestamp: new Date(),
          message: `Very long message ${j} from worker ${i} with lots of detailed information about the current task and progress`
        })),
        sharedKnowledge: {
          technologies: Array(20).fill(null).map((_, j) => `Technology ${j}`),
          decisions: Array(30).fill(null).map((_, j) => `Decision ${j} with detailed reasoning`)
        }
      }));

      mockOrchestratorClient.listWorkers.mockResolvedValue(workers);
      mockConversationContext.getRecentHistory.mockReturnValue([]);
      mockWorkerManager.getQuickAccessMapping.mockResolvedValue({});

      // Process multiple times
      for (let i = 0; i < 20; i++) {
        const context = await functionalContext.getContext('Create a new React component');
        const instructions = instructionProvider.generateInstructions('web-development', context);
        const claudeMDContent = await claudeMDManager.generateOrchFlowSection(context);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

      // Should not increase memory by more than 50MB
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });
});