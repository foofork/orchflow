import { ClaudeMDManager } from '../../context/claude-md-manager';
import { promises as fs } from 'fs';
import path from 'path';

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    appendFile: jest.fn(),
    existsSync: jest.fn(),
    access: jest.fn(),
  }
}));

describe('ClaudeMDManager', () => {
  let claudeMDManager: ClaudeMDManager;
  let mockFs: jest.Mocked<typeof fs>;

  beforeEach(() => {
    claudeMDManager = new ClaudeMDManager();
    mockFs = fs as jest.Mocked<typeof fs>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateOrchFlowSection', () => {
    it('should generate OrchFlow section with worker status', async () => {
      const context = {
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
        currentTask: {
          mainObjective: 'Build e-commerce platform',
          activeSubtasks: ['Create user auth', 'Design catalog'],
          completedTasks: ['Setup project structure']
        }
      };

      const section = await claudeMDManager.generateOrchFlowSection(context);

      expect(section).toContain('## OrchFlow Terminal Commands');
      expect(section).toContain('### Available OrchFlow Commands:');
      expect(section).toContain('Press 1-9 to instantly connect to workers');
      expect(section).toContain('### Current Worker Status:');
      expect(section).toContain('[1] API Developer: active (75%)');
      expect(section).toContain('[2] React Component Builder: paused (50%)');
      expect(section).toContain('### Active Task Context:');
      expect(section).toContain('Main Objective: Build e-commerce platform');
      expect(section).toContain('Active Subtasks: Create user auth, Design catalog');
      expect(section).toContain('Completed Tasks: Setup project structure');
    });

    it('should handle empty worker list', async () => {
      const context = {
        workers: [],
        currentTask: null
      };

      const section = await claudeMDManager.generateOrchFlowSection(context);

      expect(section).toContain('### Current Worker Status:');
      expect(section).toContain('No active workers');
      expect(section).toContain('### Active Task Context:');
      expect(section).toContain('No active task');
    });

    it('should handle workers without quick access keys', async () => {
      const context = {
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
        currentTask: null
      };

      const section = await claudeMDManager.generateOrchFlowSection(context);

      expect(section).toContain('[--] API Developer: active (75%)');
    });

    it('should handle workers without progress', async () => {
      const context = {
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
        currentTask: null
      };

      const section = await claudeMDManager.generateOrchFlowSection(context);

      expect(section).toContain('[1] API Developer: active');
      expect(section).not.toContain('%)');
    });
  });

  describe('formatWorkerStatus', () => {
    it('should format worker status correctly', () => {
      const workers = [
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
      ];

      const formatted = claudeMDManager.formatWorkerStatus(workers);

      expect(formatted).toContain('[1] API Developer: active (75%)');
      expect(formatted).toContain('[2] React Component Builder: paused (50%)');
    });

    it('should handle empty worker list', () => {
      const formatted = claudeMDManager.formatWorkerStatus([]);
      expect(formatted).toBe('No active workers');
    });
  });

  describe('formatTaskContext', () => {
    it('should format task context with all fields', () => {
      const task = {
        mainObjective: 'Build e-commerce platform',
        activeSubtasks: ['Create user auth', 'Design catalog'],
        completedTasks: ['Setup project structure']
      };

      const formatted = claudeMDManager.formatTaskContext(task);

      expect(formatted).toContain('Main Objective: Build e-commerce platform');
      expect(formatted).toContain('Active Subtasks: Create user auth, Design catalog');
      expect(formatted).toContain('Completed Tasks: Setup project structure');
    });

    it('should handle null task', () => {
      const formatted = claudeMDManager.formatTaskContext(null);
      expect(formatted).toBe('No active task');
    });

    it('should handle empty subtasks and completed tasks', () => {
      const task = {
        mainObjective: 'Build e-commerce platform',
        activeSubtasks: [],
        completedTasks: []
      };

      const formatted = claudeMDManager.formatTaskContext(task);

      expect(formatted).toContain('Main Objective: Build e-commerce platform');
      expect(formatted).toContain('Active Subtasks: None');
      expect(formatted).toContain('Completed Tasks: None');
    });
  });

  describe('appendToClaudeMD', () => {
    it('should append OrchFlow section to CLAUDE.md', async () => {
      const existingContent = '# Existing Claude Config\n\nSome content...';
      const orchFlowContent = '## OrchFlow Terminal Commands\n\nOrchFlow content...';

      mockFs.readFile.mockResolvedValue(existingContent);
      mockFs.appendFile.mockResolvedValue(undefined);

      await claudeMDManager.appendToClaudeMD(orchFlowContent);

      expect(mockFs.readFile).toHaveBeenCalledWith(
        path.join(process.cwd(), 'CLAUDE.md'),
        'utf-8'
      );
      expect(mockFs.appendFile).toHaveBeenCalledWith(
        path.join(process.cwd(), 'CLAUDE.md'),
        '\n\n' + orchFlowContent
      );
    });

    it('should not append if OrchFlow section already exists', async () => {
      const existingContent = '# Existing Claude Config\n\n## OrchFlow Terminal Commands\n\nAlready exists...';
      const orchFlowContent = '## OrchFlow Terminal Commands\n\nNew content...';

      mockFs.readFile.mockResolvedValue(existingContent);

      await claudeMDManager.appendToClaudeMD(orchFlowContent);

      expect(mockFs.readFile).toHaveBeenCalled();
      expect(mockFs.appendFile).not.toHaveBeenCalled();
    });

    it('should handle file read errors', async () => {
      const orchFlowContent = '## OrchFlow Terminal Commands\n\nContent...';

      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      await expect(claudeMDManager.appendToClaudeMD(orchFlowContent))
        .rejects.toThrow('File not found');
    });
  });

  describe('generateWorkerSpecificClaudeMD', () => {
    it('should generate worker-specific CLAUDE.md content', () => {
      const taskInfo = {
        workerId: 'worker-123',
        assignedWorkerName: 'API Developer',
        description: 'Build REST API endpoints',
        taskType: 'api-development',
        specificInstructions: 'Focus on authentication and user management'
      };

      const content = claudeMDManager.generateWorkerSpecificClaudeMD(taskInfo);

      expect(content).toContain('## Worker Identity: API Developer');
      expect(content).toContain('### Your Role:');
      expect(content).toContain('- **Identity**: API Developer');
      expect(content).toContain('- **Task**: Build REST API endpoints');
      expect(content).toContain('### OrchFlow Coordination:');
      expect(content).toContain('orchflow/workers/worker-123/*');
      expect(content).toContain('### Your Specific Instructions:');
      expect(content).toContain('Focus on authentication and user management');
    });

    it('should handle missing specific instructions', () => {
      const taskInfo = {
        workerId: 'worker-123',
        assignedWorkerName: 'API Developer',
        description: 'Build REST API endpoints',
        taskType: 'api-development',
        specificInstructions: null
      };

      const content = claudeMDManager.generateWorkerSpecificClaudeMD(taskInfo);

      expect(content).toContain('Focus on completing your assigned task efficiently.');
    });
  });

  describe('updateClaudeMDSection', () => {
    it('should update existing OrchFlow section', async () => {
      const existingContent = `# Claude Config

## OrchFlow Terminal Commands

Old content here

## Other Section

Other content`;

      const newOrchFlowContent = `## OrchFlow Terminal Commands

New content here`;

      mockFs.readFile.mockResolvedValue(existingContent);
      mockFs.writeFile.mockResolvedValue(undefined);

      await claudeMDManager.updateClaudeMDSection(newOrchFlowContent);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(process.cwd(), 'CLAUDE.md'),
        expect.stringContaining('New content here')
      );
    });

    it('should append if no existing OrchFlow section', async () => {
      const existingContent = `# Claude Config

## Other Section

Other content`;

      const newOrchFlowContent = `## OrchFlow Terminal Commands

New content here`;

      mockFs.readFile.mockResolvedValue(existingContent);
      mockFs.appendFile.mockResolvedValue(undefined);

      await claudeMDManager.updateClaudeMDSection(newOrchFlowContent);

      expect(mockFs.appendFile).toHaveBeenCalledWith(
        path.join(process.cwd(), 'CLAUDE.md'),
        '\n\n' + newOrchFlowContent
      );
    });
  });

  describe('removeOrchFlowSection', () => {
    it('should remove OrchFlow section from CLAUDE.md', async () => {
      const existingContent = `# Claude Config

## OrchFlow Terminal Commands

OrchFlow content here

## Other Section

Other content`;

      mockFs.readFile.mockResolvedValue(existingContent);
      mockFs.writeFile.mockResolvedValue(undefined);

      await claudeMDManager.removeOrchFlowSection();

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(process.cwd(), 'CLAUDE.md'),
        expect.not.stringContaining('OrchFlow Terminal Commands')
      );
    });
  });

  describe('error handling', () => {
    it('should handle file system errors gracefully', async () => {
      mockFs.readFile.mockRejectedValue(new Error('Permission denied'));

      await expect(claudeMDManager.appendToClaudeMD('test content'))
        .rejects.toThrow('Permission denied');
    });

    it('should handle write errors gracefully', async () => {
      mockFs.readFile.mockResolvedValue('existing content');
      mockFs.appendFile.mockRejectedValue(new Error('Disk full'));

      await expect(claudeMDManager.appendToClaudeMD('test content'))
        .rejects.toThrow('Disk full');
    });
  });
});