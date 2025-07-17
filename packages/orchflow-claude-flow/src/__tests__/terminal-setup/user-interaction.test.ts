import { UserInteractionManager } from '../../terminal-setup/user-interaction-manager';
import { OrchFlowConfigManager } from '../../terminal-setup/config-manager';
import { MenuOption } from '../../types';

// Mock readline
jest.mock('readline', () => ({
  createInterface: jest.fn(),
}));

describe('UserInteractionManager', () => {
  let userInteraction: UserInteractionManager;
  let mockReadline: any;
  let mockConfigManager: jest.Mocked<OrchFlowConfigManager>;
  let mockConsole: jest.SpyInstance;

  beforeEach(() => {
    userInteraction = new UserInteractionManager();
    mockReadline = require('readline');
    mockConfigManager = new OrchFlowConfigManager() as jest.Mocked<OrchFlowConfigManager>;
    mockConsole = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockConsole.mockRestore();
  });

  describe('promptUser', () => {
    it('should prompt user and return response', async () => {
      const mockRl = {
        question: jest.fn((prompt, callback) => {
          callback('test response');
        }),
        close: jest.fn(),
      };

      mockReadline.createInterface.mockReturnValue(mockRl);

      const response = await userInteraction.promptUser('Enter choice: ');

      expect(mockRl.question).toHaveBeenCalledWith('Enter choice: ', expect.any(Function));
      expect(mockRl.close).toHaveBeenCalled();
      expect(response).toBe('test response');
    });

    it('should trim whitespace from response', async () => {
      const mockRl = {
        question: jest.fn((prompt, callback) => {
          callback('  test response  ');
        }),
        close: jest.fn(),
      };

      mockReadline.createInterface.mockReturnValue(mockRl);

      const response = await userInteraction.promptUser('Enter choice: ');

      expect(response).toBe('test response');
    });

    it('should handle empty responses', async () => {
      const mockRl = {
        question: jest.fn((prompt, callback) => {
          callback('');
        }),
        close: jest.fn(),
      };

      mockReadline.createInterface.mockReturnValue(mockRl);

      const response = await userInteraction.promptUser('Enter choice: ');

      expect(response).toBe('');
    });

    it('should respond within 100ms for typical input', async () => {
      const mockRl = {
        question: jest.fn((prompt, callback) => {
          setTimeout(() => callback('response'), 10);
        }),
        close: jest.fn(),
      };

      mockReadline.createInterface.mockReturnValue(mockRl);

      const startTime = Date.now();
      await userInteraction.promptUser('Enter choice: ');
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('showChoiceMenu', () => {
    it('should display menu options and return user choice', async () => {
      const options: MenuOption[] = [
        { id: '1', label: 'Option 1', description: 'First option' },
        { id: '2', label: 'Option 2', description: 'Second option' },
        { id: '3', label: 'Option 3', description: 'Third option' },
      ];

      const mockRl = {
        question: jest.fn((prompt, callback) => {
          callback('2');
        }),
        close: jest.fn(),
      };

      mockReadline.createInterface.mockReturnValue(mockRl);

      const choice = await userInteraction.showChoiceMenu(options);

      expect(choice).toBe(2);
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('2. Option 2')
      );
    });

    it('should handle invalid choice and prompt again', async () => {
      const options: MenuOption[] = [
        { id: '1', label: 'Option 1', description: 'First option' },
        { id: '2', label: 'Option 2', description: 'Second option' },
      ];

      const mockRl = {
        question: jest.fn()
          .mockImplementationOnce((prompt, callback) => {
            callback('5'); // Invalid choice
          })
          .mockImplementationOnce((prompt, callback) => {
            callback('1'); // Valid choice
          }),
        close: jest.fn(),
      };

      mockReadline.createInterface.mockReturnValue(mockRl);

      const choice = await userInteraction.showChoiceMenu(options);

      expect(choice).toBe(1);
      expect(mockRl.question).toHaveBeenCalledTimes(2);
    });

    it('should handle empty choice and use default', async () => {
      const options: MenuOption[] = [
        { id: '1', label: 'Option 1', description: 'First option', isDefault: true },
        { id: '2', label: 'Option 2', description: 'Second option' },
      ];

      const mockRl = {
        question: jest.fn((prompt, callback) => {
          callback('');
        }),
        close: jest.fn(),
      };

      mockReadline.createInterface.mockReturnValue(mockRl);

      const choice = await userInteraction.showChoiceMenu(options);

      expect(choice).toBe(1);
    });

    it('should handle non-numeric input', async () => {
      const options: MenuOption[] = [
        { id: '1', label: 'Option 1', description: 'First option' },
        { id: '2', label: 'Option 2', description: 'Second option' },
      ];

      const mockRl = {
        question: jest.fn()
          .mockImplementationOnce((prompt, callback) => {
            callback('abc'); // Non-numeric
          })
          .mockImplementationOnce((prompt, callback) => {
            callback('2'); // Valid choice
          }),
        close: jest.fn(),
      };

      mockReadline.createInterface.mockReturnValue(mockRl);

      const choice = await userInteraction.showChoiceMenu(options);

      expect(choice).toBe(2);
      expect(mockRl.question).toHaveBeenCalledTimes(2);
    });
  });

  describe('confirmAction', () => {
    it('should return true for positive responses', async () => {
      const positiveResponses = ['y', 'Y', 'yes', 'YES', 'Yes'];

      for (const response of positiveResponses) {
        const mockRl = {
          question: jest.fn((prompt, callback) => {
            callback(response);
          }),
          close: jest.fn(),
        };

        mockReadline.createInterface.mockReturnValue(mockRl);

        const result = await userInteraction.confirmAction('Continue?');
        expect(result).toBe(true);
      }
    });

    it('should return false for negative responses', async () => {
      const negativeResponses = ['n', 'N', 'no', 'NO', 'No'];

      for (const response of negativeResponses) {
        const mockRl = {
          question: jest.fn((prompt, callback) => {
            callback(response);
          }),
          close: jest.fn(),
        };

        mockReadline.createInterface.mockReturnValue(mockRl);

        const result = await userInteraction.confirmAction('Continue?');
        expect(result).toBe(false);
      }
    });

    it('should return false for empty response', async () => {
      const mockRl = {
        question: jest.fn((prompt, callback) => {
          callback('');
        }),
        close: jest.fn(),
      };

      mockReadline.createInterface.mockReturnValue(mockRl);

      const result = await userInteraction.confirmAction('Continue?');
      expect(result).toBe(false);
    });

    it('should handle invalid input and prompt again', async () => {
      const mockRl = {
        question: jest.fn()
          .mockImplementationOnce((prompt, callback) => {
            callback('maybe'); // Invalid
          })
          .mockImplementationOnce((prompt, callback) => {
            callback('yes'); // Valid
          }),
        close: jest.fn(),
      };

      mockReadline.createInterface.mockReturnValue(mockRl);

      const result = await userInteraction.confirmAction('Continue?');
      expect(result).toBe(true);
      expect(mockRl.question).toHaveBeenCalledTimes(2);
    });
  });

  describe('showVSCodeSetupMenu', () => {
    it('should display VS Code setup menu with tmux option', async () => {
      const mockRl = {
        question: jest.fn((prompt, callback) => {
          callback('1');
        }),
        close: jest.fn(),
      };

      mockReadline.createInterface.mockReturnValue(mockRl);

      jest.spyOn(userInteraction as any, 'executeSetupMode').mockResolvedValue(undefined);
      mockConfigManager.saveUserPreference.mockResolvedValue(undefined);

      await userInteraction.showVSCodeSetupMenu(true);

      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('VS Code Detected')
      );
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('Split Terminal')
      );
    });

    it('should display VS Code setup menu without tmux option', async () => {
      const mockRl = {
        question: jest.fn((prompt, callback) => {
          callback('2');
        }),
        close: jest.fn(),
      };

      mockReadline.createInterface.mockReturnValue(mockRl);

      jest.spyOn(userInteraction as any, 'executeSetupMode').mockResolvedValue(undefined);
      mockConfigManager.saveUserPreference.mockResolvedValue(undefined);

      await userInteraction.showVSCodeSetupMenu(false);

      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('VS Code Detected')
      );
    });

    it('should save user preference after choice', async () => {
      const mockRl = {
        question: jest.fn((prompt, callback) => {
          callback('1');
        }),
        close: jest.fn(),
      };

      mockReadline.createInterface.mockReturnValue(mockRl);

      jest.spyOn(userInteraction as any, 'executeSetupMode').mockResolvedValue(undefined);
      mockConfigManager.saveUserPreference.mockResolvedValue(undefined);

      await userInteraction.showVSCodeSetupMenu(true);

      expect(mockConfigManager.saveUserPreference).toHaveBeenCalledWith('tmux', {
        environment: 'vscode',
        hasTmux: true
      });
    });

    it('should handle default choice when no input', async () => {
      const mockRl = {
        question: jest.fn((prompt, callback) => {
          callback('');
        }),
        close: jest.fn(),
      };

      mockReadline.createInterface.mockReturnValue(mockRl);

      jest.spyOn(userInteraction as any, 'executeSetupMode').mockResolvedValue(undefined);
      jest.spyOn(userInteraction as any, 'parseVSCodeChoice').mockReturnValue('tmux');
      mockConfigManager.saveUserPreference.mockResolvedValue(undefined);

      await userInteraction.showVSCodeSetupMenu(true);

      expect(mockConfigManager.saveUserPreference).toHaveBeenCalledWith('tmux', {
        environment: 'vscode',
        hasTmux: true
      });
    });
  });

  describe('parseVSCodeChoice', () => {
    it('should parse valid numeric choices', () => {
      const parseChoice = (userInteraction as any).parseVSCodeChoice;

      expect(parseChoice('1', true)).toBe('tmux');
      expect(parseChoice('2', true)).toBe('inline');
      expect(parseChoice('3', true)).toBe('statusbar');
      expect(parseChoice('4', true)).toBe('window');
    });

    it('should handle default choice based on tmux availability', () => {
      const parseChoice = (userInteraction as any).parseVSCodeChoice;

      expect(parseChoice('', true)).toBe('tmux');
      expect(parseChoice('', false)).toBe('inline');
    });

    it('should handle invalid choices with fallback', () => {
      const parseChoice = (userInteraction as any).parseVSCodeChoice;

      expect(parseChoice('99', true)).toBe('tmux');
      expect(parseChoice('99', false)).toBe('inline');
      expect(parseChoice('abc', true)).toBe('tmux');
      expect(parseChoice('abc', false)).toBe('inline');
    });
  });

  describe('validateInput', () => {
    it('should validate choice input correctly', () => {
      const validateInput = (userInteraction as any).validateInput;

      expect(validateInput('1', 'choice')).toBe(true);
      expect(validateInput('2', 'choice')).toBe(true);
      expect(validateInput('abc', 'choice')).toBe(false);
      expect(validateInput('', 'choice')).toBe(true); // Empty is valid for default
    });

    it('should validate confirm input correctly', () => {
      const validateInput = (userInteraction as any).validateInput;

      expect(validateInput('y', 'confirm')).toBe(true);
      expect(validateInput('yes', 'confirm')).toBe(true);
      expect(validateInput('n', 'confirm')).toBe(true);
      expect(validateInput('no', 'confirm')).toBe(true);
      expect(validateInput('maybe', 'confirm')).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle readline interface creation errors', async () => {
      mockReadline.createInterface.mockImplementation(() => {
        throw new Error('Interface creation failed');
      });

      await expect(userInteraction.promptUser('Test: ')).rejects.toThrow(
        'Interface creation failed'
      );
    });

    it('should handle config manager errors gracefully', async () => {
      const mockRl = {
        question: jest.fn((prompt, callback) => {
          callback('1');
        }),
        close: jest.fn(),
      };

      mockReadline.createInterface.mockReturnValue(mockRl);

      jest.spyOn(userInteraction as any, 'executeSetupMode').mockResolvedValue(undefined);
      mockConfigManager.saveUserPreference.mockRejectedValue(new Error('Config save failed'));

      await expect(userInteraction.showVSCodeSetupMenu(true)).rejects.toThrow(
        'Config save failed'
      );
    });
  });

  describe('accessibility', () => {
    it('should provide clear menu descriptions', async () => {
      const mockRl = {
        question: jest.fn((prompt, callback) => {
          callback('1');
        }),
        close: jest.fn(),
      };

      mockReadline.createInterface.mockReturnValue(mockRl);

      jest.spyOn(userInteraction as any, 'executeSetupMode').mockResolvedValue(undefined);
      mockConfigManager.saveUserPreference.mockResolvedValue(undefined);

      await userInteraction.showVSCodeSetupMenu(true);

      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('70/30 split with live status pane')
      );
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('Status updates in main terminal')
      );
    });

    it('should handle keyboard navigation hints', async () => {
      const mockRl = {
        question: jest.fn((prompt, callback) => {
          callback('1');
        }),
        close: jest.fn(),
      };

      mockReadline.createInterface.mockReturnValue(mockRl);

      jest.spyOn(userInteraction as any, 'executeSetupMode').mockResolvedValue(undefined);
      mockConfigManager.saveUserPreference.mockResolvedValue(undefined);

      await userInteraction.showVSCodeSetupMenu(true);

      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('Choose [1-4] or Enter for recommended')
      );
    });
  });
});