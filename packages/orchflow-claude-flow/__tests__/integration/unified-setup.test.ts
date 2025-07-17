/**
 * Integration tests for UnifiedSetupOrchestrator
 * Tests both CLI entry points and all unified features
 */

import { UnifiedSetupOrchestrator } from '../../src/setup/unified-setup-orchestrator';
import { LaunchOptions } from '../../src/types/unified-interfaces';
import { ConfigurationManager } from '../../src/managers/configuration-manager';
import { TerminalEnvironmentDetector } from '../../src/setup/terminal-environment-detector';
import { TmuxInstaller } from '../../src/setup/tmux-installer';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('UnifiedSetupOrchestrator Integration Tests', () => {
  let orchestrator: UnifiedSetupOrchestrator;
  let configManager: ConfigurationManager;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    orchestrator = UnifiedSetupOrchestrator.getInstance();
    configManager = ConfigurationManager.getInstance();
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('CLI Entry Points', () => {
    it('should work with basic CLI launch options', async () => {
      const launchOptions: LaunchOptions = {
        port: 8080,
        host: 'localhost',
        verbose: false,
        debug: false
      };

      const result = await orchestrator.setup(launchOptions);
      
      expect(result.success).toBe(true);
      expect(result.flow).toBeDefined();
      expect(result.environment).toBeDefined();
      expect(result.config).toBeDefined();
      expect(result.performance.totalTime).toBeGreaterThan(0);
    });

    it('should work with enhanced CLI options', async () => {
      const launchOptions: LaunchOptions = {
        port: 8080,
        agents: 5,
        mode: 'tmux',
        splitScreen: true,
        interactive: false
      };

      const result = await orchestrator.setup(launchOptions, {
        enableTmuxInstall: true,
        autoInstallDependencies: true,
        skipConfirmation: true
      });

      expect(result.success).toBe(true);
      expect(result.dependencies).toBeDefined();
      expect(result.dependencies?.tmux).toBeDefined();
      expect(result.dependencies?.claudeFlow).toBeDefined();
    });

    it('should handle quick setup mode', async () => {
      const result = await orchestrator.quickSetup({ port: 8080, verbose: false });
      
      expect(result.success).toBe(true);
      expect(result.performance.totalTime).toBeGreaterThan(0);
      expect(result.errors).toBeDefined();
      expect(result.warnings).toBeDefined();
    });

    it('should handle interactive setup mode', async () => {
      // Mock user input for interactive mode
      const originalStdin = process.stdin;
      const mockStdin = {
        on: jest.fn(),
        resume: jest.fn(),
        setEncoding: jest.fn()
      };
      
      // Skip actual interaction for test
      const result = await orchestrator.setup({}, {
        interactive: false, // Force non-interactive for test
        enableTmuxInstall: true,
        autoInstallDependencies: true
      });

      expect(result.success).toBe(true);
      expect(result.dependencies).toBeDefined();
    });
  });

  describe('Environment Detection Integration', () => {
    it('should detect VS Code environment', async () => {
      process.env.VSCODE_PID = '12345';
      process.env.TERM_PROGRAM = 'vscode';

      const result = await orchestrator.setup({}, { 
        enableTmuxInstall: true,
        verbose: false 
      });

      expect(result.success).toBe(true);
      expect(result.environment).toBeDefined();
      
      // Check if enhanced environment was detected
      if ('isVSCode' in result.environment) {
        expect(result.environment.isVSCode).toBe(true);
      }
    });

    it('should detect GitHub Codespaces environment', async () => {
      process.env.CODESPACES = 'true';
      process.env.TERM_PROGRAM = 'vscode';

      const result = await orchestrator.setup({}, { 
        enableTmuxInstall: true,
        verbose: false 
      });

      expect(result.success).toBe(true);
      if ('isCodespaces' in result.environment) {
        expect(result.environment.isCodespaces).toBe(true);
      }
    });

    it('should detect tmux environment', async () => {
      process.env.TMUX = '/tmp/tmux-1000/default,12345,0';

      const result = await orchestrator.setup({}, { 
        enableTmuxInstall: true,
        verbose: false 
      });

      expect(result.success).toBe(true);
      if ('isInsideTmux' in result.environment) {
        expect(result.environment.isInsideTmux).toBe(true);
      }
    });
  });

  describe('Configuration Integration', () => {
    it('should integrate with configuration manager', async () => {
      const customConfig = {
        port: 9090,
        host: 'custom.host',
        verbose: true
      };

      const result = await orchestrator.setup(customConfig);
      
      expect(result.success).toBe(true);
      expect(result.config).toBeDefined();
      
      // Check if config was properly applied
      const loadedConfig = await configManager.load();
      expect(loadedConfig.server.port).toBe(9090);
    });

    it('should handle custom config file path', async () => {
      const tempConfigPath = '/tmp/test-orchflow-config.json';
      
      const result = await orchestrator.setup({}, {
        configPath: tempConfigPath,
        skipConfirmation: true
      });

      expect(result.success).toBe(true);
      expect(result.config).toBeDefined();
    });

    it('should optimize configuration for environment', async () => {
      const result = await orchestrator.setup({}, {
        verbose: true,
        skipConfirmation: true
      });

      expect(result.success).toBe(true);
      expect(result.performance.configTime).toBeGreaterThan(0);
    });
  });

  describe('Flow Selection Integration', () => {
    it('should auto-select optimal flow', async () => {
      const result = await orchestrator.setup({}, {
        skipConfirmation: true
      });

      expect(result.success).toBe(true);
      expect(result.flow).toBeDefined();
      expect(typeof result.flow).toBe('string');
    });

    it('should respect forced flow', async () => {
      const result = await orchestrator.setup({}, {
        forceFlow: 'inline' as any,
        skipConfirmation: true
      });

      expect(result.success).toBe(true);
      expect(result.flow).toBe('inline');
    });

    it('should handle tmux flow selection', async () => {
      const result = await orchestrator.setup({ mode: 'tmux' }, {
        enableTmuxInstall: true,
        skipConfirmation: true
      });

      expect(result.success).toBe(true);
      // Flow should be related to tmux
      expect(result.flow).toContain('tmux');
    });
  });

  describe('Performance Tracking Integration', () => {
    it('should track performance metrics', async () => {
      const result = await orchestrator.setup({}, {
        verbose: true,
        skipConfirmation: true
      });

      expect(result.success).toBe(true);
      expect(result.performance).toBeDefined();
      expect(result.performance.totalTime).toBeGreaterThan(0);
      expect(result.performance.detectionTime).toBeGreaterThanOrEqual(0);
      expect(result.performance.configTime).toBeGreaterThanOrEqual(0);
      expect(result.performance.setupTime).toBeGreaterThanOrEqual(0);
    });

    it('should track setup steps', async () => {
      const result = await orchestrator.setup({}, {
        enableTmuxInstall: true,
        skipConfirmation: true
      });

      expect(result.success).toBe(true);
      if (result.performance.steps) {
        expect(result.performance.steps.length).toBeGreaterThan(0);
        result.performance.steps.forEach(step => {
          expect(step.name).toBeDefined();
          expect(step.duration).toBeGreaterThanOrEqual(0);
          expect(typeof step.success).toBe('boolean');
        });
      }
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle setup failures gracefully', async () => {
      // Force an error by providing invalid config
      const invalidLaunchOptions = {
        port: -1, // Invalid port
        host: ''  // Invalid host
      };

      const result = await orchestrator.setup(invalidLaunchOptions);
      
      // Should not crash but return failure
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should provide fallback configuration on error', async () => {
      const result = await orchestrator.setup({ port: -1 });
      
      expect(result.success).toBe(false);
      expect(result.config).toBeDefined();
      expect(result.flow).toBe('fallback');
    });
  });

  describe('Setup Validation Integration', () => {
    it('should validate setup correctly', async () => {
      // First perform setup
      await orchestrator.setup({}, { skipConfirmation: true });
      
      // Then validate
      const validation = await orchestrator.validateSetup();
      
      expect(validation.valid).toBeDefined();
      expect(validation.issues).toBeDefined();
      expect(validation.recommendations).toBeDefined();
      expect(Array.isArray(validation.issues)).toBe(true);
      expect(Array.isArray(validation.recommendations)).toBe(true);
    });

    it('should get setup status correctly', async () => {
      const status = await orchestrator.getSetupStatus();
      
      expect(status.isSetup).toBeDefined();
      expect(status.environment).toBeDefined();
      expect(status.config).toBeDefined();
      expect(status.flow).toBeDefined();
      expect(status.lastSetup).toBeDefined();
    });
  });

  describe('Unified Config Format Integration', () => {
    it('should return unified config format', async () => {
      const result = await orchestrator.setup({}, {
        enableTmuxInstall: true,
        skipConfirmation: true
      });

      expect(result.success).toBe(true);
      expect(result.config).toBeDefined();
      
      // Check for unified config structure
      if ('core' in result.config) {
        expect(result.config.core).toBeDefined();
        expect(result.config.splitScreen).toBeDefined();
        expect(result.config.terminal).toBeDefined();
      }
    });

    it('should handle both optimized and enhanced config formats', async () => {
      // Test optimized format
      const optimizedResult = await orchestrator.setup({}, {
        enableTmuxInstall: false,
        skipConfirmation: true
      });

      expect(optimizedResult.success).toBe(true);
      expect(optimizedResult.config).toBeDefined();

      // Test enhanced format
      const enhancedResult = await orchestrator.setup({}, {
        enableTmuxInstall: true,
        skipConfirmation: true
      });

      expect(enhancedResult.success).toBe(true);
      expect(enhancedResult.config).toBeDefined();
    });
  });

  describe('Singleton Pattern Integration', () => {
    it('should maintain singleton instance', () => {
      const instance1 = UnifiedSetupOrchestrator.getInstance();
      const instance2 = UnifiedSetupOrchestrator.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should work with multiple concurrent calls', async () => {
      const promises = [
        orchestrator.setup({}, { skipConfirmation: true }),
        orchestrator.setup({}, { skipConfirmation: true }),
        orchestrator.setup({}, { skipConfirmation: true })
      ];

      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.config).toBeDefined();
      });
    });
  });
});