import { SetupFlowRouter } from '../../terminal-setup/setup-flow-router';
import { UserInteractionManager } from '../../terminal-setup/user-interaction-manager';
import { OrchFlowConfigManager } from '../../terminal-setup/config-manager';
import type { TerminalConfig } from '../../types';

// Mock dependencies
jest.mock('../../terminal-setup/user-interaction-manager');
jest.mock('../../terminal-setup/config-manager');
jest.mock('child_process');

describe('SetupFlowRouter', () => {
  let router: SetupFlowRouter;
  let mockUserInteraction: jest.Mocked<UserInteractionManager>;
  let mockConfigManager: jest.Mocked<OrchFlowConfigManager>;
  let mockConsole: jest.SpyInstance;

  beforeEach(() => {
    router = new SetupFlowRouter();
    mockUserInteraction = new UserInteractionManager() as jest.Mocked<UserInteractionManager>;
    mockConfigManager = new OrchFlowConfigManager() as jest.Mocked<OrchFlowConfigManager>;
    mockConsole = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockConsole.mockRestore();
  });

  describe('route', () => {
    it('should use saved preference when skipSetup is true', async () => {
      const config: TerminalConfig = {
        hasTmux: true,
        isInsideTmux: false,
        isVSCode: false,
        isCodespaces: false,
        terminalType: 'xterm',
        terminalSize: { width: 80, height: 24 },
        userPreference: { mode: 'tmux', skipSetup: true }
      };

      const launchSpy = jest.spyOn(router as any, 'launchWithMode')
        .mockResolvedValue(undefined);

      await router.route(config);

      expect(launchSpy).toHaveBeenCalledWith('tmux');
    });

    it('should launch tmux mode when inside tmux', async () => {
      const config: TerminalConfig = {
        hasTmux: true,
        isInsideTmux: true,
        isVSCode: false,
        isCodespaces: false,
        terminalType: 'tmux',
        terminalSize: { width: 80, height: 24 },
        userPreference: null
      };

      const tmuxSpy = jest.spyOn(router as any, 'launchTmuxMode')
        .mockResolvedValue(undefined);

      await router.route(config);

      expect(tmuxSpy).toHaveBeenCalled();
    });

    it('should launch Codespaces mode when in Codespaces', async () => {
      const config: TerminalConfig = {
        hasTmux: true,
        isInsideTmux: false,
        isVSCode: false,
        isCodespaces: true,
        terminalType: 'xterm',
        terminalSize: { width: 80, height: 24 },
        userPreference: null
      };

      const codespacesSpy = jest.spyOn(router as any, 'launchCodespacesMode')
        .mockResolvedValue(undefined);

      await router.route(config);

      expect(codespacesSpy).toHaveBeenCalled();
    });

    it('should launch VS Code mode when in VS Code', async () => {
      const config: TerminalConfig = {
        hasTmux: false,
        isInsideTmux: false,
        isVSCode: true,
        isCodespaces: false,
        terminalType: 'vscode',
        terminalSize: { width: 80, height: 24 },
        userPreference: null
      };

      const vscodeSpy = jest.spyOn(router as any, 'launchVSCodeMode')
        .mockResolvedValue(undefined);

      await router.route(config);

      expect(vscodeSpy).toHaveBeenCalledWith(false);
    });

    it('should offer tmux setup when tmux is available but not inside tmux', async () => {
      const config: TerminalConfig = {
        hasTmux: true,
        isInsideTmux: false,
        isVSCode: false,
        isCodespaces: false,
        terminalType: 'xterm',
        terminalSize: { width: 80, height: 24 },
        userPreference: null
      };

      const offerSpy = jest.spyOn(router as any, 'offerTmuxSetup')
        .mockResolvedValue(undefined);

      await router.route(config);

      expect(offerSpy).toHaveBeenCalled();
    });

    it('should launch inline mode when tmux is not available', async () => {
      const config: TerminalConfig = {
        hasTmux: false,
        isInsideTmux: false,
        isVSCode: false,
        isCodespaces: false,
        terminalType: 'xterm',
        terminalSize: { width: 80, height: 24 },
        userPreference: null
      };

      const inlineSpy = jest.spyOn(router as any, 'launchInlineMode')
        .mockResolvedValue(undefined);

      await router.route(config);

      expect(inlineSpy).toHaveBeenCalled();
    });
  });

  describe('launchTmuxMode', () => {
    it('should setup tmux split and display success message', async () => {
      const setupSpy = jest.spyOn(router as any, 'setupTmuxSplit')
        .mockResolvedValue(undefined);

      await (router as any).launchTmuxMode();

      expect(setupSpy).toHaveBeenCalled();
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('Tmux session detected')
      );
    });
  });

  describe('launchCodespacesMode', () => {
    it('should setup optimized Codespaces configuration', async () => {
      const setupSpy = jest.spyOn(router as any, 'setupTmuxSplit')
        .mockResolvedValue(undefined);

      await (router as any).launchCodespacesMode();

      expect(setupSpy).toHaveBeenCalled();
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('Codespaces Edition')
      );
    });
  });

  describe('launchVSCodeMode', () => {
    it('should show VS Code setup menu', async () => {
      mockUserInteraction.showVSCodeSetupMenu.mockResolvedValue(undefined);

      await (router as any).launchVSCodeMode(true);

      expect(mockUserInteraction.showVSCodeSetupMenu).toHaveBeenCalledWith(true);
    });
  });

  describe('launchInlineMode', () => {
    it('should display inline mode setup and prompt to continue', async () => {
      const promptSpy = jest.spyOn(router as any, 'promptContinue')
        .mockResolvedValue(undefined);

      await (router as any).launchInlineMode();

      expect(promptSpy).toHaveBeenCalled();
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('Tmux not found')
      );
    });
  });

  describe('offerTmuxSetup', () => {
    it('should prompt user for tmux setup choice', async () => {
      mockUserInteraction.promptUser.mockResolvedValue('y');
      const setupSpy = jest.spyOn(router as any, 'setupTmuxSplit')
        .mockResolvedValue(undefined);

      await (router as any).offerTmuxSetup();

      expect(mockUserInteraction.promptUser).toHaveBeenCalledWith(
        expect.stringContaining('Start tmux session?')
      );
      expect(setupSpy).toHaveBeenCalled();
    });

    it('should fallback to inline mode when user declines tmux', async () => {
      mockUserInteraction.promptUser.mockResolvedValue('n');
      const inlineSpy = jest.spyOn(router as any, 'launchInlineMode')
        .mockResolvedValue(undefined);

      await (router as any).offerTmuxSetup();

      expect(inlineSpy).toHaveBeenCalled();
    });
  });

  describe('setupTmuxSplit', () => {
    it('should execute tmux split commands', async () => {
      const mockExec = jest.fn().mockResolvedValue({ stdout: '', stderr: '' });
      jest.doMock('child_process', () => ({
        exec: mockExec
      }));

      await (router as any).setupTmuxSplit();

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('tmux')
      );
    });

    it('should handle tmux command failures gracefully', async () => {
      const mockExec = jest.fn().mockRejectedValue(new Error('tmux failed'));
      jest.doMock('child_process', () => ({
        exec: mockExec
      }));

      await expect((router as any).setupTmuxSplit()).rejects.toThrow('tmux failed');
    });
  });

  describe('performance tests', () => {
    it('should complete routing within 100ms for cached preferences', async () => {
      const config: TerminalConfig = {
        hasTmux: true,
        isInsideTmux: false,
        isVSCode: false,
        isCodespaces: false,
        terminalType: 'xterm',
        terminalSize: { width: 80, height: 24 },
        userPreference: { mode: 'inline', skipSetup: true }
      };

      jest.spyOn(router as any, 'launchWithMode').mockResolvedValue(undefined);

      const startTime = Date.now();
      await router.route(config);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should handle multiple concurrent routing requests', async () => {
      const config: TerminalConfig = {
        hasTmux: true,
        isInsideTmux: true,
        isVSCode: false,
        isCodespaces: false,
        terminalType: 'tmux',
        terminalSize: { width: 80, height: 24 },
        userPreference: null
      };

      jest.spyOn(router as any, 'launchTmuxMode').mockResolvedValue(undefined);

      const promises = Array(5).fill(null).map(() => router.route(config));
      await Promise.all(promises);

      expect(true).toBe(true); // Should not throw
    });
  });

  describe('error handling', () => {
    it('should handle setup failures gracefully', async () => {
      const config: TerminalConfig = {
        hasTmux: true,
        isInsideTmux: true,
        isVSCode: false,
        isCodespaces: false,
        terminalType: 'tmux',
        terminalSize: { width: 80, height: 24 },
        userPreference: null
      };

      jest.spyOn(router as any, 'launchTmuxMode')
        .mockRejectedValue(new Error('Setup failed'));

      await expect(router.route(config)).rejects.toThrow('Setup failed');
    });

    it('should validate terminal config before routing', async () => {
      const invalidConfig = {} as TerminalConfig;

      await expect(router.route(invalidConfig)).rejects.toThrow();
    });
  });
});