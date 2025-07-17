/**
 * Terminal Environment Detector Tests
 */

import { TerminalEnvironmentDetector } from '../../setup/terminal-environment-detector';

describe('TerminalEnvironmentDetector', () => {
  let detector: TerminalEnvironmentDetector;

  beforeEach(() => {
    detector = TerminalEnvironmentDetector.getInstance();
    detector.clearCache();
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = TerminalEnvironmentDetector.getInstance();
      const instance2 = TerminalEnvironmentDetector.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('environment detection', () => {
    it('should detect platform correctly', async () => {
      const environment = await detector.detect();
      expect(environment.platform).toBeDefined();
      expect(['linux', 'darwin', 'win32', 'unknown']).toContain(environment.platform);
    });

    it('should detect terminal type', async () => {
      const environment = await detector.detect();
      expect(environment.terminal).toBeDefined();
      expect(typeof environment.terminal).toBe('string');
    });

    it('should detect multiplexer', async () => {
      const environment = await detector.detect();
      expect(environment.multiplexer).toBeDefined();
      expect(['tmux', 'screen', 'zellij', 'none']).toContain(environment.multiplexer);
    });

    it('should detect shell', async () => {
      const environment = await detector.detect();
      expect(environment.shell).toBeDefined();
      expect(typeof environment.shell).toBe('string');
    });

    it('should detect capabilities', async () => {
      const environment = await detector.detect();
      expect(environment.capabilities).toBeDefined();
      expect(typeof environment.capabilities.splitPanes).toBe('boolean');
      expect(typeof environment.capabilities.colors).toBe('boolean');
      expect(typeof environment.capabilities.unicode).toBe('boolean');
    });
  });

  describe('caching', () => {
    it('should cache results when requested', async () => {
      const env1 = await detector.detect(true);
      const env2 = await detector.detect(true);
      expect(env1).toBe(env2);
    });

    it('should skip cache when requested', async () => {
      await detector.detect(true);
      const env1 = await detector.detect(false);
      const env2 = await detector.detect(false);
      expect(env1).not.toBe(env2);
    });

    it('should clear cache', async () => {
      await detector.detect(true);
      detector.clearCache();
      const cached = detector.getCachedEnvironment();
      expect(cached).toBeUndefined();
    });
  });

  describe('performance metrics', () => {
    it('should provide detection time metrics', async () => {
      await detector.detect();
      const metrics = detector.getPerformanceMetrics();
      expect(metrics).toBeDefined();
      expect(typeof metrics!.detectionTime).toBe('number');
      expect(metrics!.detectionTime).toBeGreaterThan(0);
    });

    it('should return null metrics when no detection performed', () => {
      const metrics = detector.getPerformanceMetrics();
      expect(metrics).toBeNull();
    });
  });

  describe('tmux detection', () => {
    it('should detect tmux session when in tmux', async () => {
      const originalTmux = process.env.TMUX;
      process.env.TMUX = 'test-session';

      try {
        const environment = await detector.detect(false);
        expect(environment.multiplexer).toBe('tmux');
      } finally {
        if (originalTmux) {
          process.env.TMUX = originalTmux;
        } else {
          delete process.env.TMUX;
        }
      }
    });
  });

  describe('screen detection', () => {
    it('should detect screen session when in screen', async () => {
      const originalSTY = process.env.STY;
      process.env.STY = 'test-session';

      try {
        const environment = await detector.detect(false);
        expect(environment.multiplexer).toBe('screen');
      } finally {
        if (originalSTY) {
          process.env.STY = originalSTY;
        } else {
          delete process.env.STY;
        }
      }
    });
  });

  describe('error handling', () => {
    it('should handle detection errors gracefully', async () => {
      // Mock execSync to throw error
      const mockExecSync = jest.fn().mockImplementation(() => {
        throw new Error('Command failed');
      });

      jest.doMock('child_process', () => ({
        execSync: mockExecSync
      }));

      const environment = await detector.detect(false);
      expect(environment).toBeDefined();
      expect(environment.terminal).toBeDefined();
    });
  });

  describe('capability detection', () => {
    it('should detect colors based on environment', async () => {
      const originalTerm = process.env.TERM;
      process.env.TERM = 'xterm-256color';

      try {
        const environment = await detector.detect(false);
        expect(environment.capabilities.colors).toBe(true);
      } finally {
        if (originalTerm) {
          process.env.TERM = originalTerm;
        } else {
          delete process.env.TERM;
        }
      }
    });

    it('should detect unicode support', async () => {
      const originalLang = process.env.LANG;
      process.env.LANG = 'en_US.UTF-8';

      try {
        const environment = await detector.detect(false);
        expect(environment.capabilities.unicode).toBe(true);
      } finally {
        if (originalLang) {
          process.env.LANG = originalLang;
        } else {
          delete process.env.LANG;
        }
      }
    });
  });
});