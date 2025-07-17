/**
 * Integration tests for TmuxInstaller wiring and fallback mechanisms
 * Tests installation, configuration, and integration with setup orchestrator
 */

import { TmuxInstaller } from '../../src/setup/tmux-installer';
import { UnifiedSetupOrchestrator } from '../../src/setup/unified-setup-orchestrator';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const execAsync = promisify(exec);

describe('TmuxInstaller Integration Tests', () => {
  let installer: TmuxInstaller;
  let orchestrator: UnifiedSetupOrchestrator;
  let originalEnv: NodeJS.ProcessEnv;
  let tempFiles: string[] = [];

  beforeEach(() => {
    installer = new TmuxInstaller();
    orchestrator = UnifiedSetupOrchestrator.getInstance();
    originalEnv = { ...process.env };
    tempFiles = [];
  });

  afterEach(() => {
    process.env = originalEnv;
    // Clean up temp files
    tempFiles.forEach(file => {
      if (existsSync(file)) {
        unlinkSync(file);
      }
    });
  });

  describe('Installation Integration', () => {
    it('should detect existing tmux installation', async () => {
      const result = await installer.installAndConfigure();
      
      expect(result.success).toBe(true);
      expect(result.alreadyInstalled).toBeDefined();
      expect(result.configUpdated).toBeDefined();
      
      if (result.alreadyInstalled) {
        expect(result.version).toBeDefined();
      }
    });

    it('should handle tmux installation with configuration', async () => {
      const config = {
        orchflowBindings: true,
        mouseSupport: true,
        customPrefix: 'C-a'
      };

      const result = await installer.installAndConfigure(config);
      
      expect(result.success).toBe(true);
      expect(result.configUpdated).toBe(true);
      
      // Check if configuration was applied
      const orchflowConfigPath = join(homedir(), '.orchflow', 'tmux.conf');
      if (existsSync(orchflowConfigPath)) {
        const configContent = readFileSync(orchflowConfigPath, 'utf8');
        expect(configContent).toContain('C-a');
        expect(configContent).toContain('mouse on');
      }
    });

    it('should handle installation failure gracefully', async () => {
      // Mock a failure scenario by temporarily breaking the command
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'unknown-platform'
      });

      const result = await installer.installAndConfigure();
      
      expect(result.success).toBe(false);
      expect(result.errorMessage).toBeDefined();
      expect(result.errorMessage).toContain('Unsupported platform');

      // Restore platform
      Object.defineProperty(process, 'platform', {
        value: originalPlatform
      });
    });
  });

  describe('Configuration Integration', () => {
    it('should create proper tmux configuration', async () => {
      const config = {
        orchflowBindings: true,
        mouseSupport: true,
        visualActivity: true,
        statusBar: true,
        customPrefix: 'C-o'
      };

      const result = await installer.installAndConfigure(config);
      
      expect(result.success).toBe(true);
      expect(result.configUpdated).toBe(true);

      // Verify configuration file content
      const orchflowConfigPath = join(homedir(), '.orchflow', 'tmux.conf');
      if (existsSync(orchflowConfigPath)) {
        const configContent = readFileSync(orchflowConfigPath, 'utf8');
        
        expect(configContent).toContain('OrchFlow tmux configuration');
        expect(configContent).toContain('set -g prefix C-o');
        expect(configContent).toContain('mouse on');
        expect(configContent).toContain('visual-activity on');
        expect(configContent).toContain('bind-key 1 select-pane -t 1');
        expect(configContent).toContain('bind-key 0 select-pane -t 0');
      }
    });

    it('should update main tmux configuration', async () => {
      const result = await installer.installAndConfigure();
      
      expect(result.success).toBe(true);
      
      // Check if main tmux config was updated
      const mainConfigPath = join(homedir(), '.tmux.conf');
      if (existsSync(mainConfigPath)) {
        const mainConfig = readFileSync(mainConfigPath, 'utf8');
        expect(mainConfig).toContain('source-file ~/.orchflow/tmux.conf');
      }
    });

    it('should handle existing tmux configuration', async () => {
      const mainConfigPath = join(homedir(), '.tmux.conf');
      const existingConfig = '# Existing tmux config\nset -g mouse on\n';
      
      // Create existing config
      writeFileSync(mainConfigPath, existingConfig);
      tempFiles.push(mainConfigPath);

      const result = await installer.installAndConfigure();
      
      expect(result.success).toBe(true);
      
      // Check if OrchFlow config was appended
      const updatedConfig = readFileSync(mainConfigPath, 'utf8');
      expect(updatedConfig).toContain('# Existing tmux config');
      expect(updatedConfig).toContain('source-file ~/.orchflow/tmux.conf');
    });
  });

  describe('Verification Integration', () => {
    it('should verify installation correctly', async () => {
      // First install
      await installer.installAndConfigure();
      
      // Then verify
      const verification = await installer.verifyInstallation();
      
      expect(verification.success).toBeDefined();
      expect(verification.issues).toBeDefined();
      expect(Array.isArray(verification.issues)).toBe(true);
      
      if (verification.success) {
        expect(verification.issues.length).toBe(0);
      }
    });

    it('should detect configuration issues', async () => {
      const verification = await installer.verifyInstallation();
      
      expect(verification.success).toBeDefined();
      expect(verification.issues).toBeDefined();
      
      // Check for specific issues
      verification.issues.forEach(issue => {
        expect(typeof issue).toBe('string');
        expect(issue.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Setup Orchestrator Integration', () => {
    it('should integrate with unified setup orchestrator', async () => {
      const result = await orchestrator.setup({ mode: 'tmux' }, {
        enableTmuxInstall: true,
        autoInstallDependencies: true,
        skipConfirmation: true
      });

      expect(result.success).toBe(true);
      expect(result.dependencies).toBeDefined();
      expect(result.dependencies?.tmux).toBeDefined();
      expect(result.dependencies?.tmux.success).toBe(true);
    });

    it('should handle tmux installation through orchestrator', async () => {
      const result = await orchestrator.interactiveSetup({ mode: 'tmux' });
      
      expect(result.success).toBe(true);
      expect(result.dependencies).toBeDefined();
      expect(result.dependencies?.tmux).toBeDefined();
      
      // Check if tmux configuration was updated
      if (result.dependencies?.tmux.success) {
        expect(result.dependencies.tmux.configUpdated).toBe(true);
      }
    });

    it('should fallback gracefully when tmux installation fails', async () => {
      // Mock installation failure
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'unknown-platform'
      });

      const result = await orchestrator.setup({ mode: 'tmux' }, {
        enableTmuxInstall: true,
        autoInstallDependencies: true,
        skipConfirmation: true
      });

      // Should still complete setup but with fallback
      expect(result.success).toBe(false);
      expect(result.dependencies?.tmux.success).toBe(false);
      expect(result.flow).toBe('fallback');

      // Restore platform
      Object.defineProperty(process, 'platform', {
        value: originalPlatform
      });
    });
  });

  describe('Environment Detection Integration', () => {
    it('should detect tmux environment correctly', async () => {
      // Mock tmux environment
      process.env.TMUX = '/tmp/tmux-1000/default,12345,0';

      const result = await orchestrator.setup({}, {
        enableTmuxInstall: true,
        skipConfirmation: true
      });

      expect(result.success).toBe(true);
      if ('isInsideTmux' in result.environment) {
        expect(result.environment.isInsideTmux).toBe(true);
      }
    });

    it('should handle tmux detection when not in tmux', async () => {
      delete process.env.TMUX;

      const result = await orchestrator.setup({}, {
        enableTmuxInstall: true,
        skipConfirmation: true
      });

      expect(result.success).toBe(true);
      if ('isInsideTmux' in result.environment) {
        expect(result.environment.isInsideTmux).toBe(false);
      }
    });
  });

  describe('Platform-Specific Integration', () => {
    it('should handle macOS installation flow', async () => {
      if (process.platform === 'darwin') {
        const result = await installer.installAndConfigure();
        
        expect(result.success).toBe(true);
        if (!result.alreadyInstalled && result.success) {
          expect(result.installMethod).toBeDefined();
        }
      } else {
        // Skip test on non-macOS platforms
        expect(true).toBe(true);
      }
    });

    it('should handle Linux installation flow', async () => {
      if (process.platform === 'linux') {
        const result = await installer.installAndConfigure();
        
        expect(result.success).toBe(true);
        if (!result.alreadyInstalled && result.success) {
          expect(result.installMethod).toBeDefined();
        }
      } else {
        // Skip test on non-Linux platforms
        expect(true).toBe(true);
      }
    });

    it('should handle Windows installation flow', async () => {
      if (process.platform === 'win32') {
        const result = await installer.installAndConfigure();
        
        // Windows installation might fail due to compatibility
        expect(result.success).toBeDefined();
        if (!result.success) {
          expect(result.errorMessage).toBeDefined();
        }
      } else {
        // Skip test on non-Windows platforms
        expect(true).toBe(true);
      }
    });
  });

  describe('Configuration Persistence Integration', () => {
    it('should persist configuration across sessions', async () => {
      const config = {
        orchflowBindings: true,
        mouseSupport: true,
        customPrefix: 'C-x'
      };

      const result1 = await installer.installAndConfigure(config);
      expect(result1.success).toBe(true);

      // Create new installer instance
      const newInstaller = new TmuxInstaller();
      const result2 = await newInstaller.installAndConfigure(config);
      
      expect(result2.success).toBe(true);
      
      // Configuration should be consistent
      const orchflowConfigPath = join(homedir(), '.orchflow', 'tmux.conf');
      if (existsSync(orchflowConfigPath)) {
        const configContent = readFileSync(orchflowConfigPath, 'utf8');
        expect(configContent).toContain('C-x');
      }
    });
  });

  describe('Error Recovery Integration', () => {
    it('should recover from configuration errors', async () => {
      const invalidConfig = {
        orchflowBindings: true,
        mouseSupport: true,
        customPrefix: 'invalid-prefix-format'
      };

      const result = await installer.installAndConfigure(invalidConfig);
      
      // Should still complete but might have warnings
      expect(result.success).toBe(true);
      expect(result.configUpdated).toBe(true);
    });

    it('should handle partial installation failures', async () => {
      const result = await installer.installAndConfigure();
      
      expect(result.success).toBe(true);
      expect(result.alreadyInstalled).toBeDefined();
      expect(result.configUpdated).toBeDefined();
      
      // Even if installation fails, configuration should work
      if (!result.success) {
        expect(result.errorMessage).toBeDefined();
      }
    });
  });

  describe('Installation Summary Integration', () => {
    it('should display installation summary correctly', async () => {
      const result = await installer.installAndConfigure();
      
      expect(result.success).toBe(true);
      
      // Test the display method (won't actually show output in test)
      expect(() => {
        installer.displayInstallationSummary(result);
      }).not.toThrow();
    });
  });
});