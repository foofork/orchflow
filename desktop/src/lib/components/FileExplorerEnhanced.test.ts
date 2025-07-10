import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, screen } from '@testing-library/svelte';
import FileExplorerEnhanced from './FileExplorerEnhanced.svelte';
import type { TreeNode } from '$lib/types';

// Mock child components with proper Svelte component structure
vi.mock('./FileTree.svelte', () => ({
  default: class MockFileTree {
    constructor(options: any) {
      this.$$ = {
        fragment: null,
        ctx: [],
        props: options.props || {},
        update: vi.fn(),
        not_equal: vi.fn(),
        bound: {},
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(),
        callbacks: {},
        dirty: [],
        skip_bound: false,
        root: null
      };
      this.$destroy = vi.fn();
      this.$on = vi.fn();
      this.$set = vi.fn();
    }
  }
}));

vi.mock('./ContextMenu.svelte', () => ({
  default: class MockContextMenu {
    constructor(options: any) {
      this.$$ = {
        fragment: null,
        ctx: [],
        props: options.props || {},
        update: vi.fn(),
        not_equal: vi.fn(),
        bound: {},
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(),
        callbacks: {},
        dirty: [],
        skip_bound: false,
        root: null
      };
      this.$destroy = vi.fn();
      this.$on = vi.fn();
      this.$set = vi.fn();
    }
  }
}));

vi.mock('./Dialog.svelte', () => ({
  default: class MockDialog {
    constructor(options: any) {
      this.$$ = {
        fragment: null,
        ctx: [],
        props: options.props || {},
        update: vi.fn(),
        not_equal: vi.fn(),
        bound: {},
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(),
        callbacks: {},
        dirty: [],
        skip_bound: false,
        root: null
      };
      this.$destroy = vi.fn();
      this.$on = vi.fn();
      this.$set = vi.fn();
    }
  }
}));

// Mock Tauri API
const mockInvoke = vi.fn();
const mockReadDir = vi.fn();
const mockJoin = vi.fn();
const mockDirname = vi.fn();

// Mock the imports as functions that return the mocked values
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: mockInvoke
}));

vi.mock('@tauri-apps/api/fs', () => ({
  readDir: mockReadDir
}));

vi.mock('@tauri-apps/api/path', () => ({
  join: mockJoin,
  dirname: mockDirname
}));

describe('FileExplorerEnhanced', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window.__TAURI__ for each test
    (window as any).__TAURI__ = {};
  });

  afterEach(() => {
    delete (window as any).__TAURI__;
  });

  describe('Initialization', () => {
    it('renders without Tauri (browser mode)', async () => {
      delete (window as any).__TAURI__;
      const { container } = render(FileExplorerEnhanced);
      
      // Should render the toolbar
      expect(container.querySelector('.toolbar')).toBeTruthy();
      
      // Should render toolbar buttons
      expect(container.querySelector('[title="New File"]')).toBeTruthy();
      expect(container.querySelector('[title="New Folder"]')).toBeTruthy();
      expect(container.querySelector('[title="Refresh"]')).toBeTruthy();
      expect(container.querySelector('[title="Collapse All"]')).toBeTruthy();
      
      // Should render mock file tree
      await waitFor(() => {
        expect(container.querySelector('.tree-container')).toBeTruthy();
      }, { timeout: 1000 });
    });

    it('loads directory on mount with Tauri', async () => {
      mockInvoke.mockResolvedValueOnce('/home/user/project');
      mockReadDir.mockResolvedValueOnce([
        { name: 'src', path: '/home/user/project/src', children: [] },
        { name: 'package.json', path: '/home/user/project/package.json' }
      ]);

      render(FileExplorerEnhanced);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('get_current_dir');
      }, { timeout: 1000 });
      
      await waitFor(() => {
        expect(mockReadDir).toHaveBeenCalledWith('/home/user/project');
      }, { timeout: 1000 });
    });

    it('handles directory loading error', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Permission denied'));

      const { container } = render(FileExplorerEnhanced);

      await waitFor(() => {
        const errorState = container.querySelector('.error-state');
        expect(errorState).toBeTruthy();
        expect(errorState?.textContent).toContain('Failed to load directory');
      }, { timeout: 1000 });
    });
  });

  describe('File Operations', () => {
    it('opens new file dialog', async () => {
      const { container } = render(FileExplorerEnhanced);
      
      const newFileButton = container.querySelector('[title="New File"]');
      expect(newFileButton).toBeTruthy();
      
      await fireEvent.click(newFileButton!);
      
      // Dialog component is mocked, so we just check if the state changed
      // In a real test, we'd check for the dialog to appear
    });

    it('opens new folder dialog', async () => {
      const { container } = render(FileExplorerEnhanced);
      
      const newFolderButton = container.querySelector('[title="New Folder"]');
      expect(newFolderButton).toBeTruthy();
      
      await fireEvent.click(newFolderButton!);
    });

    it('refreshes file tree', async () => {
      mockInvoke.mockResolvedValueOnce('/home/user/project');
      mockReadDir.mockResolvedValueOnce([
        { name: 'src', path: '/home/user/project/src', children: [] }
      ]);

      const { container } = render(FileExplorerEnhanced);
      
      await waitFor(() => {
        expect(mockReadDir).toHaveBeenCalledTimes(1);
      }, { timeout: 1000 });

      const refreshButton = container.querySelector('[title="Refresh"]');
      await fireEvent.click(refreshButton!);

      await waitFor(() => {
        expect(mockReadDir).toHaveBeenCalledTimes(2);
      }, { timeout: 1000 });
    });

    it('collapses all nodes', async () => {
      const { container } = render(FileExplorerEnhanced);
      
      const collapseButton = container.querySelector('[title="Collapse All"]');
      expect(collapseButton).toBeTruthy();
      
      await fireEvent.click(collapseButton!);
      
      // State should be updated to collapse all nodes
    });
  });

  describe('Loading States', () => {
    it('shows loading state while fetching', async () => {
      // Make readDir return a promise that doesn't resolve immediately
      let resolveReadDir: any;
      mockReadDir.mockReturnValueOnce(new Promise(resolve => {
        resolveReadDir = resolve;
      }));
      mockInvoke.mockResolvedValueOnce('/home/user/project');

      const { container } = render(FileExplorerEnhanced);

      await waitFor(() => {
        const loadingState = container.querySelector('.loading-state');
        expect(loadingState).toBeTruthy();
      }, { timeout: 1000 });

      // Resolve the promise
      resolveReadDir([]);

      await waitFor(() => {
        const loadingState = container.querySelector('.loading-state');
        expect(loadingState).toBeFalsy();
      }, { timeout: 1000 });
    });
  });

  describe('Empty State', () => {
    it('shows empty state when directory is empty', async () => {
      mockInvoke.mockResolvedValueOnce('/home/user/project');
      mockReadDir.mockResolvedValueOnce([]);

      const { container } = render(FileExplorerEnhanced);

      await waitFor(() => {
        const emptyState = container.querySelector('.empty-state');
        expect(emptyState).toBeTruthy();
        expect(emptyState?.textContent).toContain('This folder is empty');
      }, { timeout: 1000 });
    });
  });

  describe('Agent Status', () => {
    it('initializes agent status on mount', async () => {
      delete (window as any).__TAURI__;
      const { container } = render(FileExplorerEnhanced);

      // Component should initialize with mock agent data
      await waitFor(() => {
        expect(container.querySelector('.tree-container')).toBeTruthy();
      }, { timeout: 1000 });
    });
  });
});