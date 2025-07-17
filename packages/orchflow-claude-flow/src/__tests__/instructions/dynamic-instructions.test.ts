import { DynamicInstructionProvider } from '../../instructions/dynamic-instructions';

describe('DynamicInstructionProvider', () => {
  let instructionProvider: DynamicInstructionProvider;

  beforeEach(() => {
    instructionProvider = new DynamicInstructionProvider();
  });

  describe('generateInstructions', () => {
    it('should generate instructions with current objective', () => {
      const context = {
        currentTask: {
          mainObjective: 'Build an e-commerce platform',
          activeSubtasks: ['Create user auth', 'Design product catalog']
        },
        workers: [],
        availableCommands: []
      };

      const instructions = instructionProvider.generateInstructions('web-development', context);

      expect(instructions).toContain('# OrchFlow Task Context');
      expect(instructions).toContain('## Current Objective: Build an e-commerce platform');
    });

    it('should include web-development patterns', () => {
      const context = {
        currentTask: null,
        workers: [],
        availableCommands: []
      };

      const instructions = instructionProvider.generateInstructions('web-development', context);

      expect(instructions).toContain('## Relevant OrchFlow Commands:');
      expect(instructions).toContain('"Create a React component builder" - for UI components');
      expect(instructions).toContain('"Create an API developer" - for backend services');
      expect(instructions).toContain('"Create a database designer" - for data modeling');
      expect(instructions).toContain('"Create a test engineer" - for unit/integration tests');
    });

    it('should include api-development patterns', () => {
      const context = {
        currentTask: null,
        workers: [],
        availableCommands: []
      };

      const instructions = instructionProvider.generateInstructions('api-development', context);

      expect(instructions).toContain('"Create a REST API designer" - for endpoint planning');
      expect(instructions).toContain('"Create a GraphQL developer" - for GraphQL schemas');
      expect(instructions).toContain('"Create an API tester" - for endpoint testing');
      expect(instructions).toContain('"Create a documentation writer" - for API docs');
    });

    it('should include general patterns for unknown task types', () => {
      const context = {
        currentTask: null,
        workers: [],
        availableCommands: []
      };

      const instructions = instructionProvider.generateInstructions('unknown-type', context);

      expect(instructions).toContain('"Create a [role] to [task]" - spawn a specialized worker');
      expect(instructions).toContain('"Connect to [worker name or number]" - switch to a worker');
      expect(instructions).toContain('"What is [worker] doing?" - check worker status');
      expect(instructions).toContain('"Pause/Resume [worker]" - control worker execution');
    });

    it('should include active worker information', () => {
      const context = {
        currentTask: null,
        workers: [
          {
            id: 'worker-1',
            name: 'API Developer',
            descriptiveName: 'API Developer',
            status: 'active',
            progress: 75,
            quickAccessKey: 1
          },
          {
            id: 'worker-2',
            name: 'React Builder',
            descriptiveName: 'React Component Builder',
            status: 'paused',
            progress: 50,
            quickAccessKey: 2
          }
        ],
        availableCommands: []
      };

      const instructions = instructionProvider.generateInstructions('web-development', context);

      expect(instructions).toContain('## Active Workers:');
      expect(instructions).toContain('[1] API Developer: active (75%)');
      expect(instructions).toContain('[2] React Component Builder: paused (50%)');
      expect(instructions).toContain('Tip: Use number keys 1-9 or worker names to connect');
    });

    it('should handle workers without quick access keys', () => {
      const context = {
        currentTask: null,
        workers: [
          {
            id: 'worker-1',
            name: 'API Developer',
            descriptiveName: 'API Developer',
            status: 'active',
            progress: 75,
            quickAccessKey: null
          }
        ],
        availableCommands: []
      };

      const instructions = instructionProvider.generateInstructions('web-development', context);

      expect(instructions).toContain('[--] API Developer: active (75%)');
    });

    it('should handle workers without progress', () => {
      const context = {
        currentTask: null,
        workers: [
          {
            id: 'worker-1',
            name: 'API Developer',
            descriptiveName: 'API Developer',
            status: 'active',
            progress: null,
            quickAccessKey: 1
          }
        ],
        availableCommands: []
      };

      const instructions = instructionProvider.generateInstructions('web-development', context);

      expect(instructions).toContain('[1] API Developer: active');
      expect(instructions).not.toContain('%)');
    });

    it('should handle empty context gracefully', () => {
      const context = {
        currentTask: null,
        workers: [],
        availableCommands: []
      };

      const instructions = instructionProvider.generateInstructions('web-development', context);

      expect(instructions).toContain('# OrchFlow Task Context');
      expect(instructions).toContain('## Relevant OrchFlow Commands:');
      expect(instructions).not.toContain('## Current Objective:');
      expect(instructions).not.toContain('## Active Workers:');
    });
  });

  describe('getTaskPatterns', () => {
    it('should return web-development patterns', () => {
      const patterns = instructionProvider.getTaskPatterns('web-development');
      
      expect(patterns).toContain('"Create a React component builder" - for UI components');
      expect(patterns).toContain('"Create an API developer" - for backend services');
      expect(patterns).toContain('"Create a database designer" - for data modeling');
      expect(patterns).toContain('"Create a test engineer" - for unit/integration tests');
    });

    it('should return api-development patterns', () => {
      const patterns = instructionProvider.getTaskPatterns('api-development');
      
      expect(patterns).toContain('"Create a REST API designer" - for endpoint planning');
      expect(patterns).toContain('"Create a GraphQL developer" - for GraphQL schemas');
      expect(patterns).toContain('"Create an API tester" - for endpoint testing');
      expect(patterns).toContain('"Create a documentation writer" - for API docs');
    });

    it('should return general patterns for unknown types', () => {
      const patterns = instructionProvider.getTaskPatterns('unknown-type');
      
      expect(patterns).toContain('"Create a [role] to [task]" - spawn a specialized worker');
      expect(patterns).toContain('"Connect to [worker name or number]" - switch to a worker');
      expect(patterns).toContain('"What is [worker] doing?" - check worker status');
      expect(patterns).toContain('"Pause/Resume [worker]" - control worker execution');
    });
  });

  describe('formatWorkerStatus', () => {
    it('should format worker status correctly', () => {
      const context = {
        currentTask: null,
        workers: [
          {
            id: 'worker-1',
            name: 'API Developer',
            descriptiveName: 'API Developer',
            status: 'active',
            progress: 75,
            quickAccessKey: 1
          }
        ],
        availableCommands: []
      };

      const instructions = instructionProvider.generateInstructions('general', context);
      const workerSection = instructions.split('## Active Workers:')[1];

      expect(workerSection).toContain('[1] API Developer: active (75%)');
    });
  });

  describe('formatTaskContext', () => {
    it('should format task context with objective and subtasks', () => {
      const context = {
        currentTask: {
          mainObjective: 'Build e-commerce platform',
          activeSubtasks: ['Create authentication', 'Design database'],
          completedTasks: ['Setup project structure']
        },
        workers: [],
        availableCommands: []
      };

      const instructions = instructionProvider.generateInstructions('general', context);

      expect(instructions).toContain('## Current Objective: Build e-commerce platform');
    });
  });
});