import { OrchFlowFunctionalContext } from '../../context/functional-context';
import { OrchestratorClient } from '../../orchestrator/orchflow-orchestrator';
import { ConversationContext } from '../../primary-terminal/conversation-context';
import { WorkerAccessManager } from '../../primary-terminal/worker-access-manager';
import { Worker } from '../../types';

jest.mock('../../orchestrator/orchflow-orchestrator');
jest.mock('../../primary-terminal/conversation-context');
jest.mock('../../primary-terminal/worker-access-manager');

describe('OrchFlowFunctionalContext', () => {
  let functionalContext: OrchFlowFunctionalContext;
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
  });

  describe('getContext', () => {
    it('should return comprehensive context for user input', async () => {
      const mockWorkers: Worker[] = [
        {
          id: 'worker-1',
          name: 'API Developer',
          type: 'developer',
          status: 'active',
          progress: 75,
          lastActivity: new Date(),
          quickAccessKey: 1,
          conversationHistory: [],
          sharedKnowledge: {}
        },
        {
          id: 'worker-2',
          name: 'React Component Builder',
          type: 'developer',
          status: 'active',
          progress: 50,
          lastActivity: new Date(),
          quickAccessKey: 2,
          conversationHistory: [],
          sharedKnowledge: {}
        }
      ];

      mockOrchestratorClient.listWorkers.mockResolvedValue(mockWorkers);
      mockConversationContext.getRecentHistory.mockReturnValue([
        { timestamp: new Date(), message: 'Create an API' },
        { timestamp: new Date(), message: 'Build components' }
      ]);
      mockWorkerManager.getQuickAccessMapping.mockResolvedValue({
        1: 'worker-1',
        2: 'worker-2'
      });

      const context = await functionalContext.getContext('Create a new React component');

      expect(context).toHaveProperty('workers');
      expect(context).toHaveProperty('currentTask');
      expect(context).toHaveProperty('availableCommands');
      expect(context).toHaveProperty('quickAccessMap');
      expect(context).toHaveProperty('recentHistory');
      expect(context).toHaveProperty('systemCapabilities');

      expect(context.workers).toHaveLength(2);
      expect(context.workers[0]).toMatchObject({
        id: 'worker-1',
        name: 'API Developer',
        progress: 75,
        currentActivity: expect.any(String),
        estimatedCompletion: expect.any(Date)
      });
    });

    it('should provide context-aware command suggestions', async () => {
      mockOrchestratorClient.listWorkers.mockResolvedValue([]);
      mockConversationContext.getRecentHistory.mockReturnValue([]);
      mockWorkerManager.getQuickAccessMapping.mockResolvedValue({});

      const createContext = await functionalContext.getContext('Create a new API');
      expect(createContext.availableCommands).toContain('Create a React component builder to handle UI');
      expect(createContext.availableCommands).toContain('Create an API developer for the backend');

      const connectContext = await functionalContext.getContext('Connect to worker');
      expect(connectContext.availableCommands).toContain('Connect to the React builder');
      expect(connectContext.availableCommands).toContain('Show me all workers');
    });

    it('should handle empty worker list gracefully', async () => {
      mockOrchestratorClient.listWorkers.mockResolvedValue([]);
      mockConversationContext.getRecentHistory.mockReturnValue([]);
      mockWorkerManager.getQuickAccessMapping.mockResolvedValue({});

      const context = await functionalContext.getContext('test input');

      expect(context.workers).toHaveLength(0);
      expect(context.availableCommands).toContain('Tip: Press 1-9 to quickly connect to workers');
    });
  });

  describe('enrichWorkerInfo', () => {
    it('should add estimated completion and activity info', async () => {
      const baseWorkers = [
        {
          id: 'worker-1',
          name: 'Test Worker',
          type: 'developer',
          status: 'active',
          progress: 50,
          lastActivity: new Date(),
          conversationHistory: [
            { timestamp: new Date(), message: 'Working on API' }
          ],
          sharedKnowledge: {}
        }
      ];

      mockOrchestratorClient.listWorkers.mockResolvedValue(baseWorkers);
      mockConversationContext.getRecentHistory.mockReturnValue([]);
      mockWorkerManager.getQuickAccessMapping.mockResolvedValue({});

      const context = await functionalContext.getContext('test');
      const enrichedWorker = context.workers[0];

      expect(enrichedWorker).toHaveProperty('estimatedCompletion');
      expect(enrichedWorker).toHaveProperty('currentActivity');
      expect(enrichedWorker.currentActivity).toBe('Working on API');
    });
  });

  describe('getRelevantCommands', () => {
    it('should return create commands for creation tasks', async () => {
      mockOrchestratorClient.listWorkers.mockResolvedValue([]);
      mockConversationContext.getRecentHistory.mockReturnValue([]);
      mockWorkerManager.getQuickAccessMapping.mockResolvedValue({});

      const context = await functionalContext.getContext('build a new feature');
      const commands = context.availableCommands;

      expect(commands).toContain('Create a React component builder to handle UI');
      expect(commands).toContain('Create an API developer for the backend');
      expect(commands).toContain('Create a test engineer to write unit tests');
    });

    it('should return connect commands for connection tasks', async () => {
      mockOrchestratorClient.listWorkers.mockResolvedValue([]);
      mockConversationContext.getRecentHistory.mockReturnValue([]);
      mockWorkerManager.getQuickAccessMapping.mockResolvedValue({});

      const context = await functionalContext.getContext('check on worker status');
      const commands = context.availableCommands;

      expect(commands).toContain('Connect to the React builder');
      expect(commands).toContain('What is worker 3 doing?');
      expect(commands).toContain('Show me all workers');
    });
  });

  describe('getCurrentTaskContext', () => {
    it('should extract task context from conversation history', async () => {
      mockConversationContext.getRecentHistory.mockReturnValue([
        { timestamp: new Date(), message: 'Build an e-commerce platform' },
        { timestamp: new Date(), message: 'Create user authentication' }
      ]);

      const context = await functionalContext.getContext('test');

      expect(context.currentTask).toMatchObject({
        mainObjective: expect.any(String),
        activeSubtasks: expect.any(Array),
        completedTasks: expect.any(Array)
      });
    });
  });

  describe('getSystemCapabilities', () => {
    it('should return system capabilities info', async () => {
      mockOrchestratorClient.listWorkers.mockResolvedValue([]);
      mockConversationContext.getRecentHistory.mockReturnValue([]);
      mockWorkerManager.getQuickAccessMapping.mockResolvedValue({});

      const context = await functionalContext.getContext('test');

      expect(context.systemCapabilities).toMatchObject({
        maxWorkers: expect.any(Number),
        supportedTypes: expect.any(Array),
        features: expect.any(Array)
      });
    });
  });

  describe('error handling', () => {
    it('should handle orchestrator client errors gracefully', async () => {
      mockOrchestratorClient.listWorkers.mockRejectedValue(new Error('API Error'));
      mockConversationContext.getRecentHistory.mockReturnValue([]);
      mockWorkerManager.getQuickAccessMapping.mockResolvedValue({});

      await expect(functionalContext.getContext('test')).rejects.toThrow('API Error');
    });

    it('should handle conversation context errors gracefully', async () => {
      mockOrchestratorClient.listWorkers.mockResolvedValue([]);
      mockConversationContext.getRecentHistory.mockImplementation(() => {
        throw new Error('Context Error');
      });
      mockWorkerManager.getQuickAccessMapping.mockResolvedValue({});

      await expect(functionalContext.getContext('test')).rejects.toThrow('Context Error');
    });
  });
});