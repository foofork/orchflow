import { TerminalEnvironmentDetector } from '../../terminal-setup/environment-detector';
import { SetupFlowRouter } from '../../terminal-setup/setup-flow-router';
import { UserInteractionManager } from '../../terminal-setup/user-interaction-manager';
import { OrchFlowConfigManager } from '../../terminal-setup/config-manager';
import { TerminalSetupIntegration } from '../../terminal-setup/integration';

// Mock all dependencies
jest.mock('../../terminal-setup/environment-detector');
jest.mock('../../terminal-setup/setup-flow-router');
jest.mock('../../terminal-setup/user-interaction-manager');
jest.mock('../../terminal-setup/config-manager');
jest.mock('child_process');

describe('TerminalSetupIntegration', () => {
  let integration: TerminalSetupIntegration;
  let mockDetector: jest.Mocked<TerminalEnvironmentDetector>;
  let mockRouter: jest.Mocked<SetupFlowRouter>;
  let mockUserInteraction: jest.Mocked<UserInteractionManager>;
  let mockConfigManager: jest.Mocked<OrchFlowConfigManager>;

  beforeEach(() => {
    integration = new TerminalSetupIntegration();
    mockDetector = new TerminalEnvironmentDetector() as jest.Mocked<TerminalEnvironmentDetector>;
    mockRouter = new SetupFlowRouter() as jest.Mocked<SetupFlowRouter>;
    mockUserInteraction = new UserInteractionManager() as jest.Mocked<UserInteractionManager>;
    mockConfigManager = new OrchFlowConfigManager() as jest.Mocked<OrchFlowConfigManager>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('end-to-end setup flows', () => {
    it('should complete tmux setup flow successfully', async () => {
      const mockConfig = {
        hasTmux: true,
        isInsideTmux: false,
        isVSCode: false,
        isCodespaces: false,
        terminalType: 'xterm',
        terminalSize: { width: 80, height: 24 },
        userPreference: null
      };

      mockDetector.detectCapabilities.mockResolvedValue(mockConfig);
      mockRouter.route.mockResolvedValue(undefined);

      const result = await integration.initializeSetup();

      expect(mockDetector.detectCapabilities).toHaveBeenCalled();
      expect(mockRouter.route).toHaveBeenCalledWith(mockConfig);
      expect(result).toEqual({ success: true, mode: 'tmux' });
    });

    it('should complete VS Code setup flow successfully', async () => {
      const mockConfig = {
        hasTmux: true,
        isInsideTmux: false,
        isVSCode: true,
        isCodespaces: false,
        terminalType: 'vscode',
        terminalSize: { width: 120, height: 40 },
        userPreference: null
      };

      mockDetector.detectCapabilities.mockResolvedValue(mockConfig);
      mockRouter.route.mockResolvedValue(undefined);

      const result = await integration.initializeSetup();

      expect(mockDetector.detectCapabilities).toHaveBeenCalled();
      expect(mockRouter.route).toHaveBeenCalledWith(mockConfig);
      expect(result).toEqual({ success: true, mode: 'vscode' });
    });

    it('should complete Codespaces setup flow successfully', async () => {
      const mockConfig = {
        hasTmux: true,
        isInsideTmux: false,
        isVSCode: false,
        isCodespaces: true,
        terminalType: 'xterm',
        terminalSize: { width: 100, height: 30 },
        userPreference: null
      };

      mockDetector.detectCapabilities.mockResolvedValue(mockConfig);
      mockRouter.route.mockResolvedValue(undefined);

      const result = await integration.initializeSetup();

      expect(mockDetector.detectCapabilities).toHaveBeenCalled();
      expect(mockRouter.route).toHaveBeenCalledWith(mockConfig);
      expect(result).toEqual({ success: true, mode: 'codespaces' });
    });

    it('should complete inline setup flow successfully', async () => {
      const mockConfig = {
        hasTmux: false,
        isInsideTmux: false,
        isVSCode: false,
        isCodespaces: false,
        terminalType: 'xterm',
        terminalSize: { width: 80, height: 24 },
        userPreference: null
      };

      mockDetector.detectCapabilities.mockResolvedValue(mockConfig);
      mockRouter.route.mockResolvedValue(undefined);

      const result = await integration.initializeSetup();

      expect(mockDetector.detectCapabilities).toHaveBeenCalled();
      expect(mockRouter.route).toHaveBeenCalledWith(mockConfig);
      expect(result).toEqual({ success: true, mode: 'inline' });
    });

    it('should use saved preferences for repeat users', async () => {
      const mockConfig = {
        hasTmux: true,
        isInsideTmux: false,
        isVSCode: true,
        isCodespaces: false,
        terminalType: 'vscode',
        terminalSize: { width: 120, height: 40 },
        userPreference: { mode: 'tmux', skipSetup: true }
      };

      mockDetector.detectCapabilities.mockResolvedValue(mockConfig);
      mockRouter.route.mockResolvedValue(undefined);

      const startTime = Date.now();
      const result = await integration.initializeSetup();
      const endTime = Date.now();

      expect(mockDetector.detectCapabilities).toHaveBeenCalled();
      expect(mockRouter.route).toHaveBeenCalledWith(mockConfig);
      expect(result).toEqual({ success: true, mode: 'tmux' });
      expect(endTime - startTime).toBeLessThan(100); // Should be fast with preferences
    });
  });

  describe('error handling and recovery', () => {
    it('should handle detection failures gracefully', async () => {
      mockDetector.detectCapabilities.mockRejectedValue(new Error('Detection failed'));

      const result = await integration.initializeSetup();

      expect(result).toEqual({ 
        success: false, 
        error: 'Detection failed',
        fallbackMode: 'inline'
      });
    });

    it('should handle routing failures with fallback', async () => {
      const mockConfig = {
        hasTmux: true,
        isInsideTmux: false,
        isVSCode: false,
        isCodespaces: false,
        terminalType: 'xterm',
        terminalSize: { width: 80, height: 24 },
        userPreference: null
      };

      mockDetector.detectCapabilities.mockResolvedValue(mockConfig);
      mockRouter.route.mockRejectedValue(new Error('Routing failed'));

      const result = await integration.initializeSetup();

      expect(result).toEqual({ 
        success: false, 
        error: 'Routing failed',
        fallbackMode: 'inline'
      });
    });

    it('should handle config save failures during setup', async () => {
      const mockConfig = {
        hasTmux: true,
        isInsideTmux: false,
        isVSCode: true,
        isCodespaces: false,
        terminalType: 'vscode',
        terminalSize: { width: 120, height: 40 },
        userPreference: null
      };

      mockDetector.detectCapabilities.mockResolvedValue(mockConfig);
      mockRouter.route.mockResolvedValue(undefined);
      mockConfigManager.saveUserPreference.mockRejectedValue(new Error('Config save failed'));

      const result = await integration.initializeSetup();

      expect(result).toEqual({ 
        success: true, 
        mode: 'vscode',
        warning: 'Preferences not saved'
      });
    });

    it('should handle tmux command failures', async () => {
      const mockConfig = {
        hasTmux: true,
        isInsideTmux: false,
        isVSCode: false,
        isCodespaces: false,
        terminalType: 'xterm',
        terminalSize: { width: 80, height: 24 },
        userPreference: null
      };

      mockDetector.detectCapabilities.mockResolvedValue(mockConfig);
      mockRouter.route.mockRejectedValue(new Error('tmux: command not found'));

      const result = await integration.initializeSetup();

      expect(result).toEqual({ 
        success: false, 
        error: 'tmux: command not found',
        fallbackMode: 'inline'
      });
    });
  });

  describe('performance requirements', () => {
    it('should complete setup detection within 200ms', async () => {
      const mockConfig = {
        hasTmux: true,
        isInsideTmux: false,
        isVSCode: false,
        isCodespaces: false,
        terminalType: 'xterm',
        terminalSize: { width: 80, height: 24 },
        userPreference: null
      };

      mockDetector.detectCapabilities.mockResolvedValue(mockConfig);
      mockRouter.route.mockResolvedValue(undefined);

      const startTime = Date.now();
      await integration.initializeSetup();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(200);
    });

    it('should handle concurrent setup requests', async () => {
      const mockConfig = {
        hasTmux: true,
        isInsideTmux: false,
        isVSCode: false,
        isCodespaces: false,
        terminalType: 'xterm',
        terminalSize: { width: 80, height: 24 },
        userPreference: null
      };

      mockDetector.detectCapabilities.mockResolvedValue(mockConfig);
      mockRouter.route.mockResolvedValue(undefined);

      const promises = Array(10).fill(null).map(() => integration.initializeSetup());
      const results = await Promise.all(promises);

      expect(results.every(r => r.success)).toBe(true);
    });

    it('should maintain low memory usage during setup', async () => {
      const mockConfig = {
        hasTmux: true,
        isInsideTmux: false,
        isVSCode: false,
        isCodespaces: false,
        terminalType: 'xterm',
        terminalSize: { width: 80, height: 24 },
        userPreference: null
      };

      mockDetector.detectCapabilities.mockResolvedValue(mockConfig);
      mockRouter.route.mockResolvedValue(undefined);

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform multiple setups
      for (let i = 0; i < 50; i++) {
        await integration.initializeSetup();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Should use less than 10MB additional memory
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('cross-platform compatibility', () => {
    it('should work on Linux systems', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true,
      });

      const mockConfig = {
        hasTmux: true,
        isInsideTmux: false,
        isVSCode: false,
        isCodespaces: false,
        terminalType: 'xterm',
        terminalSize: { width: 80, height: 24 },
        userPreference: null
      };

      mockDetector.detectCapabilities.mockResolvedValue(mockConfig);
      mockRouter.route.mockResolvedValue(undefined);

      const result = await integration.initializeSetup();

      expect(result.success).toBe(true);
    });

    it('should work on macOS systems', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true,
      });

      const mockConfig = {
        hasTmux: true,
        isInsideTmux: false,
        isVSCode: false,
        isCodespaces: false,
        terminalType: 'xterm',
        terminalSize: { width: 80, height: 24 },
        userPreference: null
      };

      mockDetector.detectCapabilities.mockResolvedValue(mockConfig);
      mockRouter.route.mockResolvedValue(undefined);

      const result = await integration.initializeSetup();

      expect(result.success).toBe(true);
    });

    it('should work on Windows systems', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });

      const mockConfig = {
        hasTmux: false,
        isInsideTmux: false,
        isVSCode: true,
        isCodespaces: false,
        terminalType: 'cmd',
        terminalSize: { width: 80, height: 24 },
        userPreference: null
      };

      mockDetector.detectCapabilities.mockResolvedValue(mockConfig);
      mockRouter.route.mockResolvedValue(undefined);

      const result = await integration.initializeSetup();

      expect(result.success).toBe(true);
    });
  });

  describe('configuration persistence', () => {
    it('should save user preferences after successful setup', async () => {
      const mockConfig = {
        hasTmux: true,
        isInsideTmux: false,
        isVSCode: true,
        isCodespaces: false,
        terminalType: 'vscode',
        terminalSize: { width: 120, height: 40 },
        userPreference: null
      };

      mockDetector.detectCapabilities.mockResolvedValue(mockConfig);
      mockRouter.route.mockResolvedValue(undefined);
      mockConfigManager.saveUserPreference.mockResolvedValue(undefined);

      await integration.initializeSetup();

      expect(mockConfigManager.saveUserPreference).toHaveBeenCalled();
    });

    it('should migrate old configuration format', async () => {
      const oldConfig = {
        terminal: {
          mode: 'tmux', // Old format
          split: 'horizontal'
        }
      };

      mockConfigManager.loadConfig.mockResolvedValue(oldConfig as any);

      const result = await integration.migrateConfig();

      expect(result.migrated).toBe(true);
      expect(mockConfigManager.saveConfig).toHaveBeenCalled();
    });

    it('should validate configuration structure', async () => {
      const invalidConfig = {
        terminal: {
          preferred_mode: 'invalid_mode',
          auto_setup: 'not_boolean'
        }
      };

      mockConfigManager.loadConfig.mockResolvedValue(invalidConfig as any);

      const result = await integration.validateConfig();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid preferred_mode');
    });
  });

  describe('user experience metrics', () => {
    it('should track setup completion time', async () => {
      const mockConfig = {
        hasTmux: true,
        isInsideTmux: false,
        isVSCode: false,
        isCodespaces: false,
        terminalType: 'xterm',
        terminalSize: { width: 80, height: 24 },
        userPreference: null
      };

      mockDetector.detectCapabilities.mockResolvedValue(mockConfig);
      mockRouter.route.mockResolvedValue(undefined);

      const result = await integration.initializeSetup();

      expect(result.metrics?.setupTime).toBeDefined();
      expect(result.metrics?.setupTime).toBeLessThan(5000); // < 5 seconds
    });

    it('should track user interaction patterns', async () => {
      const mockConfig = {
        hasTmux: true,
        isInsideTmux: false,
        isVSCode: true,
        isCodespaces: false,
        terminalType: 'vscode',
        terminalSize: { width: 120, height: 40 },
        userPreference: null
      };

      mockDetector.detectCapabilities.mockResolvedValue(mockConfig);
      mockRouter.route.mockResolvedValue(undefined);

      const result = await integration.initializeSetup();

      expect(result.metrics?.interactionCount).toBeDefined();
      expect(result.metrics?.choicesMade).toBeDefined();
    });

    it('should measure user satisfaction indicators', async () => {
      const mockConfig = {
        hasTmux: true,
        isInsideTmux: false,
        isVSCode: false,
        isCodespaces: false,
        terminalType: 'xterm',
        terminalSize: { width: 80, height: 24 },
        userPreference: { mode: 'tmux', skipSetup: true }
      };

      mockDetector.detectCapabilities.mockResolvedValue(mockConfig);
      mockRouter.route.mockResolvedValue(undefined);

      const result = await integration.initializeSetup();

      expect(result.metrics?.preferenceUsed).toBe(true);
      expect(result.metrics?.setupSkipped).toBe(true);
    });
  });

  describe('accessibility features', () => {
    it('should provide keyboard navigation support', async () => {
      const mockConfig = {
        hasTmux: true,
        isInsideTmux: false,
        isVSCode: true,
        isCodespaces: false,
        terminalType: 'vscode',
        terminalSize: { width: 120, height: 40 },
        userPreference: null
      };

      mockDetector.detectCapabilities.mockResolvedValue(mockConfig);
      mockUserInteraction.showVSCodeSetupMenu.mockResolvedValue(undefined);

      await integration.initializeSetup();

      expect(mockUserInteraction.showVSCodeSetupMenu).toHaveBeenCalled();
    });

    it('should provide clear error messages', async () => {
      mockDetector.detectCapabilities.mockRejectedValue(new Error('Permission denied'));

      const result = await integration.initializeSetup();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
      expect(result.fallbackMode).toBe('inline');
    });
  });
});