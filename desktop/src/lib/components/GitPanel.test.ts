import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import GitPanel from './GitPanel.svelte';

// Mock Tauri API
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke
}));

describe('GitPanel', () => {
  const mockGitStatus = {
    branch: 'main',
    upstream: 'origin/main',
    ahead: 2,
    behind: 0,
    staged: [
      { 
        path: 'src/components/Header.svelte', 
        status: 'modified' as const, 
        staged: true, 
        additions: 15, 
        deletions: 3 
      }
    ],
    unstaged: [
      { 
        path: 'src/lib/utils.ts', 
        status: 'modified' as const, 
        staged: false, 
        additions: 20, 
        deletions: 5 
      },
      { 
        path: 'README.md', 
        status: 'modified' as const, 
        staged: false, 
        additions: 5, 
        deletions: 2 
      }
    ],
    untracked: [
      { 
        path: 'src/components/NewFeature.svelte', 
        status: 'untracked' as const, 
        staged: false 
      }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock Tauri window object
    (window as any).__TAURI__ = {};
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers(); // Make sure to restore real timers if they were faked
    // Clean up Tauri mock
    delete (window as any).__TAURI__;
  });

  describe('Rendering', () => {
    it('renders when show is true', async () => {
      const { container } = render(GitPanel, { props: { show: true } });
      
      expect(container.querySelector('.git-panel')).toBeTruthy();
      expect(container.querySelector('.git-header')).toBeTruthy();
      expect(container.textContent).toContain('Git');
    });

    it('does not render when show is false', () => {
      const { container } = render(GitPanel, { props: { show: false } });
      
      expect(container.querySelector('.git-panel')).toBeFalsy();
    });

    it('shows loading state initially in browser mode', async () => {
      delete (window as any).__TAURI__;
      const { container } = render(GitPanel, { props: { show: true } });
      
      // Mock data should load
      await waitFor(() => {
        expect(container.textContent).toContain('main');
      });
    });

    it('displays git branch information', async () => {
      mockInvoke.mockResolvedValueOnce(mockGitStatus);
      const { container } = render(GitPanel, { props: { show: true } });
      
      await waitFor(() => {
        expect(container.textContent).toContain('main');
        expect(container.textContent).toContain('origin/main');
        expect(container.textContent).toContain('↑2'); // ahead
      });
    });

    it('displays behind count when behind upstream', async () => {
      mockInvoke.mockResolvedValueOnce({
        ...mockGitStatus,
        ahead: 0,
        behind: 3
      });
      const { container } = render(GitPanel, { props: { show: true } });
      
      await waitFor(() => {
        expect(container.textContent).toContain('↓3'); // behind
      });
    });
  });

  describe('File Lists', () => {
    it('displays staged files', async () => {
      mockInvoke.mockResolvedValueOnce(mockGitStatus);
      const { container } = render(GitPanel, { props: { show: true } });
      
      await waitFor(() => {
        expect(container.textContent).toContain('Staged Changes (1)');
        expect(container.textContent).toContain('src/components/Header.svelte');
        expect(container.textContent).toContain('+15');
        expect(container.textContent).toContain('-3');
      });
    });

    it('displays unstaged files', async () => {
      mockInvoke.mockResolvedValueOnce(mockGitStatus);
      const { container } = render(GitPanel, { props: { show: true } });
      
      await waitFor(() => {
        expect(container.textContent).toContain('Changes (2)');
        expect(container.textContent).toContain('src/lib/utils.ts');
        expect(container.textContent).toContain('README.md');
      });
    });

    it('displays untracked files', async () => {
      mockInvoke.mockResolvedValueOnce(mockGitStatus);
      const { container } = render(GitPanel, { props: { show: true } });
      
      await waitFor(() => {
        expect(container.textContent).toContain('Untracked Files (1)');
        expect(container.textContent).toContain('src/components/NewFeature.svelte');
      });
    });

    it('shows empty state messages', async () => {
      mockInvoke.mockResolvedValueOnce({
        ...mockGitStatus,
        staged: [],
        unstaged: [],
        untracked: []
      });
      const { container } = render(GitPanel, { props: { show: true } });
      
      await waitFor(() => {
        expect(container.textContent).toContain('No staged changes');
        expect(container.textContent).toContain('No changes');
      });
    });

    it('shows correct status icons and colors', async () => {
      mockInvoke.mockResolvedValueOnce({
        ...mockGitStatus,
        unstaged: [
          { path: 'modified.ts', status: 'modified', staged: false },
          { path: 'added.ts', status: 'added', staged: false },
          { path: 'deleted.ts', status: 'deleted', staged: false },
          { path: 'renamed.ts', status: 'renamed', staged: false }
        ]
      });
      const { container } = render(GitPanel, { props: { show: true } });
      
      await waitFor(() => {
        const statuses = container.querySelectorAll('.file-status');
        expect(statuses[1].textContent).toBe('M'); // modified (staged)
        expect(statuses[2].textContent).toBe('A'); // added
        expect(statuses[3].textContent).toBe('D'); // deleted
        expect(statuses[4].textContent).toBe('R'); // renamed
      });
    });
  });

  describe('File Operations', () => {
    it('stages a file when clicking + button', async () => {
      // Setup mock sequence
      mockInvoke
        .mockResolvedValueOnce(mockGitStatus) // Initial load
        .mockResolvedValueOnce(undefined) // git_stage call
        .mockResolvedValueOnce({ ...mockGitStatus, staged: [...mockGitStatus.staged, mockGitStatus.unstaged[0]] }); // Refresh
      
      const { container } = render(GitPanel, { props: { show: true } });
      
      await waitFor(() => {
        const stageButtons = container.querySelectorAll('.file-action[title="Stage"]');
        expect(stageButtons.length).toBeGreaterThan(0);
      });
      
      const firstStageButton = container.querySelector('.file-action[title="Stage"]') as HTMLElement;
      await fireEvent.click(firstStageButton);
      
      // Check that git_stage was called (second call after initial git_status)
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('git_stage', { path: 'src/lib/utils.ts' });
      });
    });

    it('unstages a file when clicking - button', async () => {
      mockInvoke
        .mockResolvedValueOnce(mockGitStatus) // Initial load
        .mockResolvedValueOnce(undefined) // git_unstage call
        .mockResolvedValueOnce({ ...mockGitStatus, staged: [] }); // Refresh
      
      const { container } = render(GitPanel, { props: { show: true } });
      
      await waitFor(() => {
        const unstageButtons = container.querySelectorAll('.file-action[title="Unstage"]');
        expect(unstageButtons.length).toBeGreaterThan(0);
      });
      
      const firstUnstageButton = container.querySelector('.file-action[title="Unstage"]') as HTMLElement;
      await fireEvent.click(firstUnstageButton);
      
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('git_unstage', { path: 'src/components/Header.svelte' });
      });
    });

    it('stages all files', async () => {
      mockInvoke
        .mockResolvedValueOnce(mockGitStatus) // Initial load
        .mockResolvedValueOnce(undefined) // git_stage_all call
        .mockResolvedValueOnce({ ...mockGitStatus, unstaged: [] }); // Refresh
      
      const { container } = render(GitPanel, { props: { show: true } });
      
      await waitFor(() => {
        expect(container.textContent).toContain('Stage All');
      });
      
      // Find the "Stage All" button specifically
      const stageAllBtn = Array.from(container.querySelectorAll('.section-action'))
        .find(btn => btn.textContent?.includes('Stage All')) as HTMLElement;
      expect(stageAllBtn).toBeTruthy();
      
      await fireEvent.click(stageAllBtn);
      
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('git_stage_all');
      });
    });

    it('unstages all files', async () => {
      mockInvoke
        .mockResolvedValueOnce(mockGitStatus) // Initial load
        .mockResolvedValueOnce(undefined) // git_unstage_all call
        .mockResolvedValueOnce({ ...mockGitStatus, staged: [] }); // Refresh
      
      const { container } = render(GitPanel, { props: { show: true } });
      
      await waitFor(() => {
        const unstageAllBtns = Array.from(container.querySelectorAll('.section-action'))
          .find(btn => btn.textContent === 'Unstage All');
        expect(unstageAllBtns).toBeTruthy();
      });
      
      const unstageAllBtn = Array.from(container.querySelectorAll('.section-action'))
        .find(btn => btn.textContent === 'Unstage All') as HTMLElement;
      await fireEvent.click(unstageAllBtn);
      
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('git_unstage_all');
      });
    });
  });

  describe('Diff View', () => {
    it('loads and displays diff when clicking file', async () => {
      const mockDiff = `diff --git a/src/lib/utils.ts b/src/lib/utils.ts
index 1234567..abcdefg 100644
--- a/src/lib/utils.ts
+++ b/src/lib/utils.ts
@@ -10,7 +10,7 @@
-  const version = "1.0.0";
+  const version = "1.1.0";`;

      mockInvoke
        .mockResolvedValueOnce(mockGitStatus)
        .mockResolvedValueOnce(mockDiff); // git_diff
      
      const { container } = render(GitPanel, { props: { show: true } });
      
      await waitFor(() => {
        const filePath = container.querySelector('.file-path') as HTMLElement;
        expect(filePath).toBeTruthy();
      });
      
      const filePath = container.querySelector('.file-path') as HTMLElement;
      await fireEvent.click(filePath);
      
      await waitFor(() => {
        expect(container.querySelector('.diff-view')).toBeTruthy();
        expect(container.textContent).toContain('src/lib/utils.ts');
        expect(container.querySelector('.back-btn')).toBeTruthy();
      });
      
      expect(mockInvoke).toHaveBeenCalledWith('git_diff', {
        path: 'src/components/Header.svelte',
        staged: true
      });
    });

    it('returns to file list when clicking back', async () => {
      mockInvoke
        .mockResolvedValueOnce(mockGitStatus) // Initial load
        .mockResolvedValueOnce('diff content'); // git_diff call
      
      const { container } = render(GitPanel, { props: { show: true } });
      
      // Wait for file list to load
      await waitFor(() => {
        const filePath = container.querySelector('.file-path');
        expect(filePath).toBeTruthy();
      });
      
      const filePath = container.querySelector('.file-path') as HTMLElement;
      await fireEvent.click(filePath);
      
      // Wait for diff view to appear
      await waitFor(() => {
        const diffView = container.querySelector('.diff-view');
        expect(diffView).toBeTruthy();
      });
      
      // Click back button
      const backBtn = container.querySelector('.back-btn') as HTMLElement;
      await fireEvent.click(backBtn);
      
      // Should return to file list view
      await waitFor(() => {
        const fileList = container.querySelector('.file-sections');
        expect(fileList).toBeTruthy();
      });
    });

    it('parses and displays diff lines with correct styling', async () => {
      const mockDiff = `diff --git a/test.ts b/test.ts
--- a/test.ts
+++ b/test.ts
@@ -1,5 +1,5 @@
 context line
-removed line
+added line
 another context`;

      mockInvoke
        .mockResolvedValueOnce(mockGitStatus) // Initial load
        .mockResolvedValueOnce(mockDiff); // git_diff call
      
      const { container } = render(GitPanel, { props: { show: true } });
      
      // Wait for file list to load
      await waitFor(() => {
        const filePath = container.querySelector('.file-path');
        expect(filePath).toBeTruthy();
      });
      
      const filePath = container.querySelector('.file-path') as HTMLElement;
      await fireEvent.click(filePath);
      
      // Wait for diff view to load and check styling
      await waitFor(() => {
        const diffLines = container.querySelectorAll('.diff-line');
        expect(diffLines.length).toBeGreaterThan(0);
        
        const headerLine = container.querySelector('.diff-line.header');
        const addLine = container.querySelector('.diff-line.add');
        const removeLine = container.querySelector('.diff-line.remove');
        const contextLine = container.querySelector('.diff-line.context');
        
        expect(headerLine).toBeTruthy();
        expect(addLine).toBeTruthy();
        expect(removeLine).toBeTruthy();
        expect(contextLine).toBeTruthy();
      }, { timeout: 10000 });
    });
  });

  describe('Commit Operations', () => {
    it('commits with message', async () => {
      mockInvoke
        .mockResolvedValueOnce(mockGitStatus) // Initial load
        .mockResolvedValueOnce(undefined) // git_commit call
        .mockResolvedValueOnce({ ...mockGitStatus, staged: [] }); // Refresh
      
      const { container } = render(GitPanel, { props: { show: true } });
      
      await waitFor(() => {
        const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
        expect(textarea).toBeTruthy();
      });
      
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      await fireEvent.input(textarea, { target: { value: 'feat: add new feature' } });
      
      const commitBtn = container.querySelector('.commit-btn') as HTMLElement;
      await fireEvent.click(commitBtn);
      
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('git_commit', { message: 'feat: add new feature' });
      }, { timeout: 10000 });
    });

    it('prevents commit without message', async () => {
      window.alert = vi.fn();
      mockInvoke.mockResolvedValueOnce(mockGitStatus);
      
      const { container } = render(GitPanel, { props: { show: true } });
      
      await waitFor(() => {
        const commitBtn = container.querySelector('.commit-btn') as HTMLElement;
        expect(commitBtn).toBeTruthy();
      });
      
      const commitBtn = container.querySelector('.commit-btn') as HTMLElement;
      await fireEvent.click(commitBtn);
      
      expect(window.alert).toHaveBeenCalledWith('Please enter a commit message');
      expect(mockInvoke).not.toHaveBeenCalledWith('git_commit', expect.anything());
    });

    it('disables commit button when no staged files', async () => {
      mockInvoke.mockResolvedValueOnce({
        ...mockGitStatus,
        staged: []
      });
      
      const { container } = render(GitPanel, { props: { show: true } });
      
      await waitFor(() => {
        const commitBtn = container.querySelector('.commit-btn') as HTMLButtonElement;
        expect(commitBtn).toBeTruthy();
        expect(commitBtn.disabled).toBe(true);
      });
    });

    it('clears commit message after successful commit', async () => {
      mockInvoke
        .mockResolvedValueOnce(mockGitStatus) // Initial load
        .mockResolvedValueOnce(undefined) // git_commit call
        .mockResolvedValueOnce({ ...mockGitStatus, staged: [] }); // Refresh
      
      const { container } = render(GitPanel, { props: { show: true } });
      
      await waitFor(() => {
        const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
        expect(textarea).toBeTruthy();
      });
      
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      await fireEvent.input(textarea, { target: { value: 'test commit' } });
      
      const commitBtn = container.querySelector('.commit-btn') as HTMLElement;
      await fireEvent.click(commitBtn);
      
      // Check that commit was called and textarea is cleared
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('git_commit', { message: 'test commit' });
        expect(textarea.value).toBe('');
      }, { timeout: 10000 });
    });

    it('commits with Ctrl+Enter shortcut', async () => {
      mockInvoke
        .mockResolvedValueOnce(mockGitStatus) // Initial load
        .mockResolvedValueOnce(undefined) // git_commit call
        .mockResolvedValueOnce({ ...mockGitStatus, staged: [] }); // Refresh
      
      const { container } = render(GitPanel, { props: { show: true } });
      
      await waitFor(() => {
        const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
        expect(textarea).toBeTruthy();
      });
      
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      await fireEvent.input(textarea, { target: { value: 'shortcut commit' } });
      
      await fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
      
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('git_commit', { message: 'shortcut commit' });
      }, { timeout: 10000 });
    });
  });

  describe('Push/Pull Operations', () => {
    it('pushes changes', { timeout: 20000 }, async () => {
      // Clear any previous calls and setup fresh mocks
      vi.clearAllMocks();
      (window as any).__TAURI__ = {};
      mockInvoke
        .mockResolvedValueOnce(mockGitStatus) // Initial load
        .mockResolvedValueOnce(undefined) // git_push call
        .mockResolvedValueOnce(mockGitStatus); // Refresh
      
      const { container } = render(GitPanel, { props: { show: true } });
      
      await waitFor(() => {
        const pushBtn = container.querySelector('.push-btn');
        expect(pushBtn).toBeTruthy();
      });
      
      const pushBtn = container.querySelector('.push-btn') as HTMLElement;
      await fireEvent.click(pushBtn);
      
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('git_push');
      }, { timeout: 10000 });
    });

    it('pulls changes', { timeout: 20000 }, async () => {
      // Clear any previous calls and setup fresh mocks
      vi.clearAllMocks();
      mockInvoke
        .mockResolvedValueOnce(mockGitStatus) // Initial load
        .mockResolvedValueOnce(undefined) // git_pull call
        .mockResolvedValueOnce(mockGitStatus); // Refresh
      
      const { container } = render(GitPanel, { props: { show: true } });
      
      await waitFor(() => {
        const pullBtn = container.querySelector('.pull-btn');
        expect(pullBtn).toBeTruthy();
      });
      
      const pullBtn = container.querySelector('.pull-btn') as HTMLElement;
      await fireEvent.click(pullBtn);
      
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('git_pull');
      }, { timeout: 10000 });
    });

    it('shows error alert on push failure', { timeout: 20000 }, async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      window.alert = vi.fn();
      // Setup fresh mocks
      mockInvoke
        .mockResolvedValueOnce(mockGitStatus) // Initial load
        .mockRejectedValueOnce(new Error('Network error')); // git_push fails
      
      const { container } = render(GitPanel, { props: { show: true } });
      
      await waitFor(() => {
        const pushBtn = container.querySelector('.push-btn');
        expect(pushBtn).toBeTruthy();
      });
      
      const pushBtn = container.querySelector('.push-btn') as HTMLElement;
      await fireEvent.click(pushBtn);
      
      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Push failed: Error: Network error');
      }, { timeout: 10000 });
      
      consoleSpy.mockRestore();
    });
  });

  describe('Panel Behavior', () => {
    it('closes on overlay click', async () => {
      mockInvoke.mockResolvedValue(mockGitStatus);
      
      const { container, component } = render(GitPanel, { props: { show: true } });
      const closeHandler = vi.fn();
      component.$on('close', closeHandler);
      
      const overlay = container.querySelector('.git-panel-overlay') as HTMLElement;
      await fireEvent.click(overlay);
      
      await waitFor(() => {
        expect(closeHandler).toHaveBeenCalled();
      });
    });

    it('does not close on panel click', async () => {
      mockInvoke.mockResolvedValue(mockGitStatus);
      
      const { container, component } = render(GitPanel, { props: { show: true } });
      const closeHandler = vi.fn();
      component.$on('close', closeHandler);
      
      const panel = container.querySelector('.git-panel') as HTMLElement;
      await fireEvent.click(panel);
      
      // Panel should still be visible (no close event)
      expect(closeHandler).not.toHaveBeenCalled();
    });

    it('closes on close button click', async () => {
      mockInvoke.mockResolvedValue(mockGitStatus);
      
      const { container, component } = render(GitPanel, { props: { show: true } });
      const closeHandler = vi.fn();
      component.$on('close', closeHandler);
      
      const closeBtn = container.querySelector('.close-btn') as HTMLElement;
      await fireEvent.click(closeBtn);
      
      await waitFor(() => {
        expect(closeHandler).toHaveBeenCalled();
      });
    });

    it('closes on Escape key', async () => {
      mockInvoke.mockResolvedValue(mockGitStatus);
      
      const { component } = render(GitPanel, { props: { show: true } });
      const closeHandler = vi.fn();
      component.$on('close', closeHandler);
      
      await fireEvent.keyDown(document, { key: 'Escape' });
      
      await waitFor(() => {
        expect(closeHandler).toHaveBeenCalled();
      });
    });

    it('closes diff view on Escape when in diff view', async () => {
      mockInvoke
        .mockResolvedValueOnce(mockGitStatus) // Initial load
        .mockResolvedValueOnce('diff content'); // git_diff call
      
      const { container } = render(GitPanel, { props: { show: true } });
      
      // Wait for file list to load
      await waitFor(() => {
        const filePath = container.querySelector('.file-path');
        expect(filePath).toBeTruthy();
      });
      
      // Enter diff view
      const filePath = container.querySelector('.file-path') as HTMLElement;
      await fireEvent.click(filePath);
      
      // Verify diff view appears
      await waitFor(() => {
        const diffView = container.querySelector('.diff-view');
        expect(diffView).toBeTruthy();
      });
      
      // Press Escape to close diff view
      await fireEvent.keyDown(document, { key: 'Escape' });
      
      // Verify we return to file list view
      await waitFor(() => {
        const fileList = container.querySelector('.file-sections');
        expect(fileList).toBeTruthy();
      });
    });

    it('auto-refreshes status every 5 seconds', async () => {
      vi.useFakeTimers();
      
      // Setup a mock that always resolves to avoid any timing issues
      mockInvoke.mockImplementation(() => Promise.resolve(mockGitStatus));
      
      const { unmount } = render(GitPanel, { props: { show: true } });
      
      // Wait for initial load
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('git_status');
      });
      
      const initialCalls = mockInvoke.mock.calls.length;
      
      // Clear the mock to track only new calls
      mockInvoke.mockClear();
      
      // Fast-forward 5 seconds (this will trigger the interval once)
      await vi.advanceTimersByTimeAsync(5000);
      
      // Should have called git_status again (once more after the interval)
      expect(mockInvoke).toHaveBeenCalledWith('git_status');
      expect(mockInvoke).toHaveBeenCalledTimes(1);
      
      unmount();
      vi.useRealTimers();
    });

    it('cleans up interval on destroy', async () => {
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
      mockInvoke.mockResolvedValue(mockGitStatus);
      
      const { unmount } = render(GitPanel, { props: { show: true } });
      
      unmount();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('handles git status error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockInvoke.mockRejectedValueOnce(new Error('Git not found'));
      
      const { container } = render(GitPanel, { props: { show: true } });
      
      // Component should still render despite error
      await waitFor(() => {
        const panel = container.querySelector('.git-panel');
        expect(panel).toBeTruthy();
      });
      
      consoleSpy.mockRestore();
    });

    it('handles diff loading error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockInvoke
        .mockResolvedValueOnce(mockGitStatus) // Initial load
        .mockRejectedValueOnce(new Error('Diff error')); // git_diff fails
      
      const { container } = render(GitPanel, { props: { show: true } });
      
      // Wait for file list to load
      await waitFor(() => {
        const filePath = container.querySelector('.file-path');
        expect(filePath).toBeTruthy();
      });
      
      const filePath = container.querySelector('.file-path') as HTMLElement;
      await fireEvent.click(filePath);
      
      // Should show error in diff view
      await waitFor(() => {
        const diffView = container.querySelector('.diff-view');
        expect(diffView).toBeTruthy();
        expect(diffView?.textContent).toContain('Failed to load diff');
      });
      
      consoleSpy.mockRestore();
    });

    it('handles stage error', { timeout: 20000 }, async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (window as any).__TAURI__ = {};
      
      // Setup fresh mocks
      mockInvoke
        .mockResolvedValueOnce(mockGitStatus) // Initial load
        .mockRejectedValueOnce(new Error('Stage failed')); // git_stage fails
      
      const { container } = render(GitPanel, { props: { show: true } });
      
      await waitFor(() => {
        const stageBtn = container.querySelector('.file-action[title="Stage"]');
        expect(stageBtn).toBeTruthy();
      });
      
      const stageBtn = container.querySelector('.file-action[title="Stage"]') as HTMLElement;
      await fireEvent.click(stageBtn);
      
      await waitFor(() => {
        // Should log error gracefully
        expect(consoleSpy).toHaveBeenCalledWith('Failed to stage file:', expect.any(Error));
      }, { timeout: 10000 });
      
      consoleSpy.mockRestore();
    });
  });
});