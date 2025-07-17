/**
 * Setup Flow Router Tests
 */

import { SetupFlowRouter } from '../../setup/setup-flow-router';
import { TerminalEnvironment } from '../../setup/terminal-environment-detector';

describe('SetupFlowRouter', () => {
  let router: SetupFlowRouter;
  let mockEnvironment: TerminalEnvironment;

  beforeEach(() => {
    router = SetupFlowRouter.getInstance();
    mockEnvironment = {
      terminal: 'unknown',
      multiplexer: 'none',
      shell: 'bash',
      platform: 'linux',
      capabilities: {
        splitPanes: false,
        tabs: false,
        sessions: false,
        colors: true,
        unicode: true,
        mouse: false,
        clipboard: false,
        scrollback: true,
        quickCommands: false,
        statusBar: false
      }
    };
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = SetupFlowRouter.getInstance();
      const instance2 = SetupFlowRouter.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('flow routing', () => {
    it('should route to tmux when tmux is available', () => {
      mockEnvironment.multiplexer = 'tmux';
      mockEnvironment.capabilities.splitPanes = true;
      mockEnvironment.capabilities.sessions = true;
      
      const flowConfig = router.route(mockEnvironment);
      expect(flowConfig.flow).toBe('tmux');
    });

    it('should route to screen when screen is available', () => {
      mockEnvironment.multiplexer = 'screen';
      mockEnvironment.capabilities.splitPanes = true;
      mockEnvironment.capabilities.sessions = true;
      
      const flowConfig = router.route(mockEnvironment);
      expect(flowConfig.flow).toBe('screen');
    });

    it('should route to zellij when zellij is available', () => {
      mockEnvironment.multiplexer = 'zellij';
      mockEnvironment.capabilities.splitPanes = true;
      mockEnvironment.capabilities.sessions = true;
      
      const flowConfig = router.route(mockEnvironment);
      expect(flowConfig.flow).toBe('zellij');
    });

    it('should route to native when no multiplexer available', () => {
      mockEnvironment.multiplexer = 'none';
      
      const flowConfig = router.route(mockEnvironment);
      expect(flowConfig.flow).toBe('native');
    });

    it('should route to fallback as last resort', () => {
      mockEnvironment.multiplexer = 'none';
      mockEnvironment.capabilities.colors = false;
      mockEnvironment.capabilities.unicode = false;
      
      const flowConfig = router.route(mockEnvironment);
      expect(['native', 'fallback']).toContain(flowConfig.flow);
    });
  });

  describe('flow validation', () => {
    it('should validate tmux flow requires tmux multiplexer', () => {
      mockEnvironment.multiplexer = 'tmux';
      expect(router.validateFlow('tmux', mockEnvironment)).toBe(true);
      
      mockEnvironment.multiplexer = 'none';
      expect(router.validateFlow('tmux', mockEnvironment)).toBe(false);
    });

    it('should validate screen flow requires screen multiplexer', () => {
      mockEnvironment.multiplexer = 'screen';
      expect(router.validateFlow('screen', mockEnvironment)).toBe(true);
      
      mockEnvironment.multiplexer = 'none';
      expect(router.validateFlow('screen', mockEnvironment)).toBe(false);
    });

    it('should validate zellij flow requires zellij multiplexer', () => {
      mockEnvironment.multiplexer = 'zellij';
      expect(router.validateFlow('zellij', mockEnvironment)).toBe(true);
      
      mockEnvironment.multiplexer = 'none';
      expect(router.validateFlow('zellij', mockEnvironment)).toBe(false);
    });

    it('should validate native flow accepts any environment', () => {
      expect(router.validateFlow('native', mockEnvironment)).toBe(true);
      
      mockEnvironment.multiplexer = 'tmux';
      expect(router.validateFlow('native', mockEnvironment)).toBe(true);
    });

    it('should validate fallback flow accepts any environment', () => {
      expect(router.validateFlow('fallback', mockEnvironment)).toBe(true);
      
      mockEnvironment.multiplexer = 'tmux';
      expect(router.validateFlow('fallback', mockEnvironment)).toBe(true);
    });
  });

  describe('flow configuration', () => {
    it('should return flow configuration for tmux', () => {
      const config = router.getFlowConfig('tmux');
      expect(config).toBeDefined();
      expect(config!.flow).toBe('tmux');
      expect(config!.steps).toBeInstanceOf(Array);
      expect(config!.steps.length).toBeGreaterThan(0);
      expect(config!.requirements).toContain('tmux');
    });

    it('should return flow configuration for screen', () => {
      const config = router.getFlowConfig('screen');
      expect(config).toBeDefined();
      expect(config!.flow).toBe('screen');
      expect(config!.requirements).toContain('screen');
    });

    it('should return flow configuration for zellij', () => {
      const config = router.getFlowConfig('zellij');
      expect(config).toBeDefined();
      expect(config!.flow).toBe('zellij');
      expect(config!.requirements).toContain('zellij');
    });

    it('should return flow configuration for native', () => {
      const config = router.getFlowConfig('native');
      expect(config).toBeDefined();
      expect(config!.flow).toBe('native');
      expect(config!.requirements).toHaveLength(0);
    });

    it('should return flow configuration for fallback', () => {
      const config = router.getFlowConfig('fallback');
      expect(config).toBeDefined();
      expect(config!.flow).toBe('fallback');
      expect(config!.requirements).toHaveLength(0);
    });

    it('should return undefined for unknown flow', () => {
      const config = router.getFlowConfig('unknown' as any);
      expect(config).toBeUndefined();
    });
  });

  describe('available flows', () => {
    it('should return all available flows', () => {
      const flows = router.getAvailableFlows();
      expect(flows).toBeInstanceOf(Array);
      expect(flows.length).toBeGreaterThan(0);
      expect(flows).toContain('tmux');
      expect(flows).toContain('screen');
      expect(flows).toContain('zellij');
      expect(flows).toContain('native');
      expect(flows).toContain('fallback');
    });
  });

  describe('flow customization', () => {
    it('should customize flow for macOS', () => {
      mockEnvironment.platform = 'darwin';
      mockEnvironment.multiplexer = 'tmux';
      
      const flowConfig = router.route(mockEnvironment);
      expect(flowConfig.flow).toBe('tmux');
      
      // Check if clipboard commands are customized for macOS
      const setupStep = flowConfig.steps.find(step => step.environment);
      if (setupStep?.environment) {
        expect(setupStep.environment.variables.ORCHFLOW_CLIPBOARD).toBe('pbcopy');
        expect(setupStep.environment.variables.ORCHFLOW_PASTE).toBe('pbpaste');
      }
    });

    it('should customize flow for Linux', () => {
      mockEnvironment.platform = 'linux';
      mockEnvironment.multiplexer = 'tmux';
      
      const flowConfig = router.route(mockEnvironment);
      expect(flowConfig.flow).toBe('tmux');
      
      // Check if clipboard commands are customized for Linux
      const setupStep = flowConfig.steps.find(step => step.environment);
      if (setupStep?.environment) {
        expect(setupStep.environment.variables.ORCHFLOW_CLIPBOARD).toBe('xclip -selection clipboard');
        expect(setupStep.environment.variables.ORCHFLOW_PASTE).toBe('xclip -selection clipboard -o');
      }
    });
  });

  describe('performance metrics', () => {
    it('should include performance estimates', () => {
      const flowConfig = router.route(mockEnvironment);
      expect(flowConfig.performance).toBeDefined();
      expect(typeof flowConfig.performance.estimatedTime).toBe('number');
      expect(flowConfig.performance.estimatedTime).toBeGreaterThan(0);
      expect(['low', 'medium', 'high']).toContain(flowConfig.performance.complexity);
    });

    it('should have different performance characteristics per flow', () => {
      const tmuxConfig = router.getFlowConfig('tmux');
      const fallbackConfig = router.getFlowConfig('fallback');
      
      expect(tmuxConfig!.performance.estimatedTime).toBeGreaterThan(
        fallbackConfig!.performance.estimatedTime
      );
      expect(tmuxConfig!.performance.complexity).not.toBe('low');
      expect(fallbackConfig!.performance.complexity).toBe('low');
    });
  });

  describe('step dependencies', () => {
    it('should validate step dependencies in tmux flow', () => {
      const config = router.getFlowConfig('tmux');
      expect(config).toBeDefined();
      
      const stepsWithDeps = config!.steps.filter(step => step.dependencies);
      expect(stepsWithDeps.length).toBeGreaterThan(0);
      
      // Check that dependencies reference valid step IDs
      stepsWithDeps.forEach(step => {
        step.dependencies!.forEach(dep => {
          const depStep = config!.steps.find(s => s.id === dep);
          expect(depStep).toBeDefined();
        });
      });
    });
  });

  describe('step validation', () => {
    it('should include validation functions where appropriate', () => {
      const config = router.getFlowConfig('tmux');
      expect(config).toBeDefined();
      
      const checkStep = config!.steps.find(step => step.id === 'check-tmux');
      expect(checkStep).toBeDefined();
      expect(checkStep!.validation).toBeDefined();
      expect(typeof checkStep!.validation).toBe('function');
    });
  });
});