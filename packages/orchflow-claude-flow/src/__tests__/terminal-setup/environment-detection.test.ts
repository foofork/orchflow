import { TerminalEnvironmentDetector } from '../../terminal-setup/environment-detector';
import { OrchFlowConfigManager } from '../../terminal-setup/config-manager';
import { TerminalConfig, UserPreference } from '../../types';

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

describe('TerminalEnvironmentDetector', () => {
  let detector: TerminalEnvironmentDetector;
  let mockExec: jest.Mock;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    detector = new TerminalEnvironmentDetector();
    mockExec = require('child_process').exec;
    originalEnv = process.env;

    // Mock stdout columns and rows
    Object.defineProperty(process.stdout, 'columns', {
      value: 120,
      writable: true,
    });
    Object.defineProperty(process.stdout, 'rows', {
      value: 40,
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.env = originalEnv;
  });

  describe('detectCapabilities', () => {
    it('should detect tmux availability', async () => {
      // Mock tmux available
      mockExec.mockImplementationOnce((cmd, callback) => {
        if (cmd === 'which tmux') {
          callback(null, '/usr/bin/tmux');
        }
      });

      const config = await detector.detectCapabilities();
      expect(config.hasTmux).toBe(true);
    });

    it('should detect when tmux is not available', async () => {
      // Mock tmux not available
      mockExec.mockImplementationOnce((cmd, callback) => {
        if (cmd === 'which tmux') {
          callback(new Error('Command not found'));
        }
      });

      const config = await detector.detectCapabilities();
      expect(config.hasTmux).toBe(false);
    });

    it('should detect when inside tmux session', async () => {
      process.env.TMUX = '/tmp/tmux-1000/default,12345,0';

      mockExec.mockImplementationOnce((cmd, callback) => {
        callback(null, '/usr/bin/tmux');
      });

      const config = await detector.detectCapabilities();
      expect(config.isInsideTmux).toBe(true);
    });

    it('should detect VS Code environment', async () => {
      process.env.VSCODE_PID = '12345';
      process.env.TERM_PROGRAM = 'vscode';

      mockExec.mockImplementationOnce((cmd, callback) => {
        callback(null, '/usr/bin/tmux');
      });

      const config = await detector.detectCapabilities();
      expect(config.isVSCode).toBe(true);
      expect(config.terminalType).toBe('vscode');
    });

    it('should detect GitHub Codespaces environment', async () => {
      process.env.CODESPACES = 'true';
      process.env.CODESPACE_NAME = 'test-codespace';

      mockExec.mockImplementationOnce((cmd, callback) => {
        callback(null, '/usr/bin/tmux');
      });

      const config = await detector.detectCapabilities();
      expect(config.isCodespaces).toBe(true);
    });

    it('should detect terminal size correctly', async () => {
      mockExec.mockImplementationOnce((cmd, callback) => {
        callback(null, '/usr/bin/tmux');
      });

      const config = await detector.detectCapabilities();
      expect(config.terminalSize).toEqual({ width: 120, height: 40 });
    });

    it('should fallback to default terminal size when unavailable', async () => {
      Object.defineProperty(process.stdout, 'columns', {
        value: undefined,
        writable: true,
      });
      Object.defineProperty(process.stdout, 'rows', {
        value: undefined,
        writable: true,
      });

      mockExec.mockImplementationOnce((cmd, callback) => {
        callback(null, '/usr/bin/tmux');
      });

      const config = await detector.detectCapabilities();
      expect(config.terminalSize).toEqual({ width: 80, height: 24 });
    });

    it('should load user preferences when available', async () => {
      const mockConfig = {
        terminal: {
          preferred_mode: 'tmux',
          auto_setup: true,
          tmux: { split_direction: 'horizontal', split_size: 30 },
          status: { update_interval: 1000 },
          vscode: { status_location: 'terminal' }
        }
      };

      // Mock config manager
      jest.spyOn(OrchFlowConfigManager.prototype, 'loadConfig')
        .mockResolvedValueOnce(mockConfig);

      mockExec.mockImplementationOnce((cmd, callback) => {
        callback(null, '/usr/bin/tmux');
      });

      const config = await detector.detectCapabilities();
      expect(config.userPreference).toEqual({
        mode: 'tmux',
        skipSetup: true
      });
    });

    it('should return null preference when auto_setup is false', async () => {
      const mockConfig = {
        terminal: {
          preferred_mode: 'auto',
          auto_setup: false,
          tmux: { split_direction: 'horizontal', split_size: 30 },
          status: { update_interval: 1000 },
          vscode: { status_location: 'terminal' }
        }
      };

      jest.spyOn(OrchFlowConfigManager.prototype, 'loadConfig')
        .mockResolvedValueOnce(mockConfig);

      mockExec.mockImplementationOnce((cmd, callback) => {
        callback(null, '/usr/bin/tmux');
      });

      const config = await detector.detectCapabilities();
      expect(config.userPreference).toBeNull();
    });
  });

  describe('performance tests', () => {
    it('should complete detection within 200ms', async () => {
      mockExec.mockImplementationOnce((cmd, callback) => {
        setTimeout(() => callback(null, '/usr/bin/tmux'), 50);
      });

      const startTime = Date.now();
      await detector.detectCapabilities();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(200);
    });

    it('should handle command timeouts gracefully', async () => {
      mockExec.mockImplementationOnce((cmd, callback) => {
        // Simulate timeout
        setTimeout(() => callback(new Error('Command timeout')), 300);
      });

      const config = await detector.detectCapabilities();
      expect(config.hasTmux).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle missing dependencies gracefully', async () => {
      mockExec.mockImplementation(() => {
        throw new Error('exec not available');
      });

      const config = await detector.detectCapabilities();
      expect(config.hasTmux).toBe(false);
    });

    it('should handle config loading errors', async () => {
      jest.spyOn(OrchFlowConfigManager.prototype, 'loadConfig')
        .mockRejectedValueOnce(new Error('Config read error'));

      mockExec.mockImplementationOnce((cmd, callback) => {
        callback(null, '/usr/bin/tmux');
      });

      const config = await detector.detectCapabilities();
      expect(config.userPreference).toBeNull();
    });
  });

  describe('platform compatibility', () => {
    it('should work on Linux', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true,
      });

      mockExec.mockImplementationOnce((cmd, callback) => {
        callback(null, '/usr/bin/tmux');
      });

      const config = await detector.detectCapabilities();
      expect(config.hasTmux).toBe(true);
    });

    it('should work on macOS', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true,
      });

      mockExec.mockImplementationOnce((cmd, callback) => {
        callback(null, '/opt/homebrew/bin/tmux');
      });

      const config = await detector.detectCapabilities();
      expect(config.hasTmux).toBe(true);
    });

    it('should work on Windows', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });

      mockExec.mockImplementationOnce((cmd, callback) => {
        callback(new Error('Command not found'));
      });

      const config = await detector.detectCapabilities();
      expect(config.hasTmux).toBe(false);
    });
  });

  describe('environment edge cases', () => {
    it('should handle SSH sessions', async () => {
      process.env.SSH_CLIENT = '192.168.1.1 55555 22';
      process.env.SSH_TTY = '/dev/pts/0';

      mockExec.mockImplementationOnce((cmd, callback) => {
        callback(null, '/usr/bin/tmux');
      });

      const config = await detector.detectCapabilities();
      expect(config.hasTmux).toBe(true);
    });

    it('should handle docker containers', async () => {
      process.env.DOCKER_CONTAINER = 'true';

      mockExec.mockImplementationOnce((cmd, callback) => {
        callback(null, '/usr/bin/tmux');
      });

      const config = await detector.detectCapabilities();
      expect(config.hasTmux).toBe(true);
    });

    it('should handle nested tmux sessions', async () => {
      process.env.TMUX = '/tmp/tmux-1000/default,12345,0';
      process.env.TMUX_PANE = '%1';

      mockExec.mockImplementationOnce((cmd, callback) => {
        callback(null, '/usr/bin/tmux');
      });

      const config = await detector.detectCapabilities();
      expect(config.isInsideTmux).toBe(true);
      expect(config.hasTmux).toBe(true);
    });
  });
});