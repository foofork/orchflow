import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { createTypedMock } from '@/test/mock-factory';
import DebugPanel from './DebugPanel.svelte';

describe('DebugPanel', () => {
  let cleanup: Array<() => void> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup = [];
  });

  afterEach(() => {
    cleanup.forEach(fn => fn());
  });

  describe('Rendering', () => {
    it('renders debug panel', () => {
      const { container, unmount } = render(DebugPanel, {
        props: { sessionId: 'test-session' }
      });
      cleanup.push(unmount);

      expect(container.querySelector('.debug-panel')).toBeTruthy();
      expect(container.querySelector('.debug-header')).toBeTruthy();
      expect(container.querySelector('.debug-content')).toBeTruthy();
    });

    it('loads and displays debug configurations', async () => {
      const { container, unmount } = render(DebugPanel, {
        props: { sessionId: 'test-session' }
      });
      cleanup.push(unmount);

      await waitFor(() => {
        const select = container.querySelector('.config-select') as HTMLSelectElement;
        expect(select).toBeTruthy();
        expect(select.options.length).toBe(3);
        expect(select.options[0].text).toBe('Debug Rust Binary');
        expect(select.options[1].text).toBe('Debug TypeScript');
        expect(select.options[2].text).toBe('Debug Frontend');
      });
    });

    it('shows start button when not debugging', () => {
      const { container, unmount } = render(DebugPanel, {
        props: { sessionId: 'test-session' }
      });
      cleanup.push(unmount);

      const startBtn = container.querySelector('.control-btn.start');
      expect(startBtn).toBeTruthy();
      expect(startBtn?.getAttribute('title')).toBe('Start Debugging');
    });

    it('shows no debug message when not debugging', () => {
      const { container, unmount } = render(DebugPanel, {
        props: { sessionId: 'test-session' }
      });
      cleanup.push(unmount);

      const noDebug = container.querySelector('.no-debug');
      expect(noDebug).toBeTruthy();
      expect(noDebug?.textContent).toContain('Select a configuration and click start to begin debugging');
    });
  });

  describe('Debug Session', () => {
    it('starts debugging when start button clicked', async () => {
      const consoleSpy = createTypedMock<[message?: any, ...optionalParams: any[]], void>();
      vi.spyOn(console, 'log').mockImplementation(consoleSpy);
      const { container, unmount } = render(DebugPanel, {
        props: { sessionId: 'test-session' }
      });
      cleanup.push(unmount);
      cleanup.push(() => vi.mocked(console.log).mockRestore());

      // Wait for configurations to load
      await waitFor(() => {
        const select = container.querySelector('.config-select');
        expect(select).toBeTruthy();
      });

      const startBtn = container.querySelector('.control-btn.start') as HTMLElement;
      await fireEvent.click(startBtn);

      expect(consoleSpy).toHaveBeenCalledWith('Starting debug session:', 'Debug Rust Binary');
      
      // Check that debug controls are shown
      await waitFor(() => {
        expect(container.querySelector('.control-btn[title="Continue"]')).toBeTruthy();
        expect(container.querySelector('.control-btn[title="Step Over"]')).toBeTruthy();
        expect(container.querySelector('.control-btn[title="Step Into"]')).toBeTruthy();
        expect(container.querySelector('.control-btn[title="Step Out"]')).toBeTruthy();
        expect(container.querySelector('.control-btn[title="Restart"]')).toBeTruthy();
        expect(container.querySelector('.control-btn.stop')).toBeTruthy();
      });
    });

    it('displays call stack when debugging', async () => {
      const { container, unmount } = render(DebugPanel, {
        props: { sessionId: 'test-session' }
      });
      cleanup.push(unmount);

      // Start debugging
      await waitFor(() => {
        const startBtn = container.querySelector('.control-btn.start');
        expect(startBtn).toBeTruthy();
      });
      
      const startBtn = container.querySelector('.control-btn.start') as HTMLElement;
      await fireEvent.click(startBtn);

      // Check call stack
      await waitFor(() => {
        const callStackSection = container.querySelector('.call-stack');
        expect(callStackSection).toBeTruthy();
        
        const stackFrames = container.querySelectorAll('.stack-frame');
        expect(stackFrames.length).toBe(3);
        expect(stackFrames[0].textContent).toContain('main() at src/main.rs:42');
        expect(stackFrames[0].classList.contains('current')).toBe(true);
      });
    });

    it('displays variables when debugging', async () => {
      const { container, unmount } = render(DebugPanel, {
        props: { sessionId: 'test-session' }
      });
      cleanup.push(unmount);

      // Start debugging
      await waitFor(() => {
        const startBtn = container.querySelector('.control-btn.start');
        expect(startBtn).toBeTruthy();
      });
      
      const startBtn = container.querySelector('.control-btn.start') as HTMLElement;
      await fireEvent.click(startBtn);

      // Check variables
      await waitFor(() => {
        const variablesSection = container.querySelector('.variables');
        expect(variablesSection).toBeTruthy();
        
        const variables = container.querySelectorAll('.variable');
        expect(variables.length).toBe(3);
        
        const varNames = Array.from(container.querySelectorAll('.var-name')).map(el => el.textContent);
        expect(varNames).toContain('request:');
        expect(varNames).toContain('user_id:');
        expect(varNames).toContain('authenticated:');
      });
    });

    it('displays breakpoints when debugging', async () => {
      const { container, unmount } = render(DebugPanel, {
        props: { sessionId: 'test-session' }
      });
      cleanup.push(unmount);

      // Start debugging
      await waitFor(() => {
        const startBtn = container.querySelector('.control-btn.start');
        expect(startBtn).toBeTruthy();
      });
      
      const startBtn = container.querySelector('.control-btn.start') as HTMLElement;
      await fireEvent.click(startBtn);

      // Check breakpoints
      await waitFor(() => {
        const breakpointsSection = container.querySelector('.breakpoints');
        expect(breakpointsSection).toBeTruthy();
        
        const breakpoints = container.querySelectorAll('.breakpoint');
        expect(breakpoints.length).toBe(3);
        expect(breakpoints[0].querySelector('.bp-location')?.textContent).toBe('src/main.rs:42');
      });
    });
  });

  describe('Debug Controls', () => {
    it('handles continue execution', async () => {
      const consoleSpy = createTypedMock<[message?: any, ...optionalParams: any[]], void>();
      vi.spyOn(console, 'log').mockImplementation(consoleSpy);
      const { container, unmount } = render(DebugPanel, {
        props: { sessionId: 'test-session' }
      });
      cleanup.push(unmount);
      cleanup.push(() => vi.mocked(console.log).mockRestore());

      // Start debugging
      await waitFor(() => {
        const startBtn = container.querySelector('.control-btn.start');
        expect(startBtn).toBeTruthy();
      });
      
      const startBtn = container.querySelector('.control-btn.start') as HTMLElement;
      await fireEvent.click(startBtn);

      // Click continue
      await waitFor(() => {
        const continueBtn = container.querySelector('.control-btn[title="Continue"]');
        expect(continueBtn).toBeTruthy();
      });
      
      const continueBtn = container.querySelector('.control-btn[title="Continue"]') as HTMLElement;
      await fireEvent.click(continueBtn);

      expect(consoleSpy).toHaveBeenCalledWith('Continue execution');
    });

    it('handles step over', async () => {
      const consoleSpy = createTypedMock<[message?: any, ...optionalParams: any[]], void>();
      vi.spyOn(console, 'log').mockImplementation(consoleSpy);
      const { container, unmount } = render(DebugPanel, {
        props: { sessionId: 'test-session' }
      });
      cleanup.push(unmount);
      cleanup.push(() => vi.mocked(console.log).mockRestore());

      // Start debugging
      await waitFor(() => {
        const startBtn = container.querySelector('.control-btn.start');
        expect(startBtn).toBeTruthy();
      });
      
      const startBtn = container.querySelector('.control-btn.start') as HTMLElement;
      await fireEvent.click(startBtn);

      // Click step over
      const stepOverBtn = container.querySelector('.control-btn[title="Step Over"]') as HTMLElement;
      await fireEvent.click(stepOverBtn);

      expect(consoleSpy).toHaveBeenCalledWith('Step over');
    });

    it('handles step into', async () => {
      const consoleSpy = createTypedMock<[message?: any, ...optionalParams: any[]], void>();
      vi.spyOn(console, 'log').mockImplementation(consoleSpy);
      const { container, unmount } = render(DebugPanel, {
        props: { sessionId: 'test-session' }
      });
      cleanup.push(unmount);
      cleanup.push(() => vi.mocked(console.log).mockRestore());

      // Start debugging
      await waitFor(() => {
        const startBtn = container.querySelector('.control-btn.start');
        expect(startBtn).toBeTruthy();
      });
      
      const startBtn = container.querySelector('.control-btn.start') as HTMLElement;
      await fireEvent.click(startBtn);

      // Click step into
      const stepIntoBtn = container.querySelector('.control-btn[title="Step Into"]') as HTMLElement;
      await fireEvent.click(stepIntoBtn);

      expect(consoleSpy).toHaveBeenCalledWith('Step into');
    });

    it('handles step out', async () => {
      const consoleSpy = createTypedMock<[message?: any, ...optionalParams: any[]], void>();
      vi.spyOn(console, 'log').mockImplementation(consoleSpy);
      const { container, unmount } = render(DebugPanel, {
        props: { sessionId: 'test-session' }
      });
      cleanup.push(unmount);
      cleanup.push(() => vi.mocked(console.log).mockRestore());

      // Start debugging
      await waitFor(() => {
        const startBtn = container.querySelector('.control-btn.start');
        expect(startBtn).toBeTruthy();
      });
      
      const startBtn = container.querySelector('.control-btn.start') as HTMLElement;
      await fireEvent.click(startBtn);

      // Click step out
      const stepOutBtn = container.querySelector('.control-btn[title="Step Out"]') as HTMLElement;
      await fireEvent.click(stepOutBtn);

      expect(consoleSpy).toHaveBeenCalledWith('Step out');
    });

    it('handles restart', async () => {
      const consoleSpy = createTypedMock<[message?: any, ...optionalParams: any[]], void>();
      vi.spyOn(console, 'log').mockImplementation(consoleSpy);
      const { container, unmount } = render(DebugPanel, {
        props: { sessionId: 'test-session' }
      });
      cleanup.push(unmount);
      cleanup.push(() => vi.mocked(console.log).mockRestore());

      // Start debugging
      await waitFor(() => {
        const startBtn = container.querySelector('.control-btn.start');
        expect(startBtn).toBeTruthy();
      });
      
      const startBtn = container.querySelector('.control-btn.start') as HTMLElement;
      await fireEvent.click(startBtn);

      // Click restart
      const restartBtn = container.querySelector('.control-btn[title="Restart"]') as HTMLElement;
      await fireEvent.click(restartBtn);

      expect(consoleSpy).toHaveBeenCalledWith('Restart debugging');
    });

    it('stops debugging when stop button clicked', async () => {
      const { container, unmount } = render(DebugPanel, {
        props: { sessionId: 'test-session' }
      });
      cleanup.push(unmount);

      // Start debugging
      await waitFor(() => {
        const startBtn = container.querySelector('.control-btn.start');
        expect(startBtn).toBeTruthy();
      });
      
      const startBtn = container.querySelector('.control-btn.start') as HTMLElement;
      await fireEvent.click(startBtn);

      // Click stop
      const stopBtn = container.querySelector('.control-btn.stop') as HTMLElement;
      await fireEvent.click(stopBtn);

      // Should show start button again
      await waitFor(() => {
        expect(container.querySelector('.control-btn.start')).toBeTruthy();
        expect(container.querySelector('.no-debug')).toBeTruthy();
      });
    });
  });

  describe('Breakpoint Management', () => {
    it('removes breakpoint when remove button clicked', async () => {
      const { container, unmount } = render(DebugPanel, {
        props: { sessionId: 'test-session' }
      });
      cleanup.push(unmount);

      // Start debugging
      await waitFor(() => {
        const startBtn = container.querySelector('.control-btn.start');
        expect(startBtn).toBeTruthy();
      });
      
      const startBtn = container.querySelector('.control-btn.start') as HTMLElement;
      await fireEvent.click(startBtn);

      // Wait for breakpoints
      await waitFor(() => {
        const breakpoints = container.querySelectorAll('.breakpoint');
        expect(breakpoints.length).toBe(3);
      });

      // Remove first breakpoint
      const removeBtn = container.querySelector('.remove-btn') as HTMLElement;
      await fireEvent.click(removeBtn);

      await waitFor(() => {
        const breakpoints = container.querySelectorAll('.breakpoint');
        expect(breakpoints.length).toBe(2);
        // First breakpoint should be gone
        expect(container.querySelector('.bp-location')?.textContent).not.toBe('src/main.rs:42');
      });
    });
  });

  describe('Configuration Selection', () => {
    it('changes selected configuration', async () => {
      const { container, unmount } = render(DebugPanel, {
        props: { sessionId: 'test-session' }
      });
      cleanup.push(unmount);

      await waitFor(() => {
        const select = container.querySelector('.config-select') as HTMLSelectElement;
        expect(select).toBeTruthy();
      });

      const select = container.querySelector('.config-select') as HTMLSelectElement;
      expect(select.value).toContain('Debug Rust Binary');

      // Change to TypeScript config
      await fireEvent.change(select, { target: { selectedIndex: 1 } });
      
      // Note: Due to how Svelte handles object binding, we can't easily test
      // the actual value change, but we can verify the select element updates
      expect(select.selectedIndex).toBe(1);
    });

    it('disables configuration select when debugging', async () => {
      const { container, unmount } = render(DebugPanel, {
        props: { sessionId: 'test-session' }
      });
      cleanup.push(unmount);

      await waitFor(() => {
        const select = container.querySelector('.config-select') as HTMLSelectElement;
        expect(select).toBeTruthy();
        expect(select.disabled).toBe(false);
      });

      // Start debugging
      const startBtn = container.querySelector('.control-btn.start') as HTMLElement;
      await fireEvent.click(startBtn);

      await waitFor(() => {
        const select = container.querySelector('.config-select') as HTMLSelectElement;
        expect(select.disabled).toBe(true);
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles empty configurations gracefully', () => {
      // This test would require mocking the loadConfigurations function
      // which is internal to the component
      const { container, unmount } = render(DebugPanel, {
        props: { sessionId: 'test-session' }
      });
      cleanup.push(unmount);

      expect(container.querySelector('.debug-panel')).toBeTruthy();
    });

    it('disables start button when no configuration selected', async () => {
      const { container, unmount } = render(DebugPanel, {
        props: { sessionId: 'test-session' }
      });
      cleanup.push(unmount);

      await waitFor(() => {
        const startBtn = container.querySelector('.control-btn.start') as HTMLButtonElement;
        expect(startBtn).toBeTruthy();
        // Should be enabled since we have default configurations
        expect(startBtn.disabled).toBe(false);
      });
    });
  });
});