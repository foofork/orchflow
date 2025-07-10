import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, screen } from '@testing-library/svelte';
import FileExplorerEnhanced from './FileExplorerEnhanced.svelte';
import type { TreeNode } from '$lib/types';

// Mock child components
vi.mock('./FileTree.svelte', () => ({
  default: vi.fn()
}));

vi.mock('./ContextMenu.svelte', () => ({
  default: vi.fn()
}));

vi.mock('./Dialog.svelte', () => ({
  default: vi.fn()
}));

// Mock Tauri API
const mockInvoke = vi.fn();
const mockReadDir = vi.fn();
const mockJoin = vi.fn();
const mockDirname = vi.fn();

vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: () => mockInvoke
}));

vi.mock('@tauri-apps/api/fs', () => ({
  readDir: () => mockReadDir
}));

vi.mock('@tauri-apps/api/path', () => ({
  join: () => mockJoin,
  dirname: () => mockDirname
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
      });
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
        expect(mockReadDir).toHaveBeenCalledWith('/home/user/project');
      });
    });

    it('handles directory loading error', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Permission denied'));

      const { container } = render(FileExplorerEnhanced);

      await waitFor(() => {
        expect(container.querySelector('.error-state')).toBeTruthy();
        expect(container.textContent).toContain('Failed to load directory');
      });
    });
  });

  describe('File Operations', () => {
    it('creates new file', async () => {
      const { container, component } = render(FileExplorerEnhanced);
      const mockDispatch = vi.fn();
      component.$on('fileCreated', mockDispatch);

      mockJoin.mockResolvedValueOnce('/home/user/project/newfile.txt');
      mockInvoke.mockResolvedValueOnce(undefined); // create_file
      mockReadDir.mockResolvedValueOnce([]); // refresh

      // Click new file button
      const newFileBtn = container.querySelector('[title="New File"]') as HTMLElement;
      await fireEvent.click(newFileBtn);

      // Dialog should show
      await waitFor(() => {
        const dialog = container.querySelector('.dialog-form');
        expect(dialog).toBeTruthy();
      });

      // Enter filename
      const input = container.querySelector('#new-file-name') as HTMLInputElement;
      await fireEvent.input(input, { target: { value: 'newfile.txt' } });

      // Click create
      const createBtn = container.querySelector('.btn-primary') as HTMLElement;
      await fireEvent.click(createBtn);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('create_file', {
          path: '/home/user/project/newfile.txt',
          content: ''
        });
        expect(mockDispatch).toHaveBeenCalledWith(
          expect.objectContaining({
            detail: '/home/user/project/newfile.txt'
          })
        );
      });
    });

    it('creates new folder', async () => {
      const { container, component } = render(FileExplorerEnhanced);
      const mockDispatch = vi.fn();
      component.$on('folderCreated', mockDispatch);

      mockJoin.mockResolvedValueOnce('/home/user/project/newfolder');
      mockInvoke.mockResolvedValueOnce(undefined); // create_directory
      mockReadDir.mockResolvedValueOnce([]); // refresh

      // Click new folder button
      const newFolderBtn = container.querySelector('[title="New Folder"]') as HTMLElement;
      await fireEvent.click(newFolderBtn);

      // Enter folder name
      const input = container.querySelector('#new-folder-name') as HTMLInputElement;
      await fireEvent.input(input, { target: { value: 'newfolder' } });

      // Press Enter to create
      await fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('create_directory', {
          path: '/home/user/project/newfolder'
        });
        expect(mockDispatch).toHaveBeenCalledWith(
          expect.objectContaining({
            detail: '/home/user/project/newfolder'
          })
        );
      });
    });

    it('validates empty file name', async () => {
      const { container } = render(FileExplorerEnhanced);

      // Click new file button
      const newFileBtn = container.querySelector('[title="New File"]') as HTMLElement;
      await fireEvent.click(newFileBtn);

      // Click create without entering name
      const createBtn = container.querySelector('.btn-primary') as HTMLElement;
      await fireEvent.click(createBtn);

      await waitFor(() => {
        expect(container.querySelector('.dialog-error')?.textContent).toBe('File name cannot be empty');
        expect(mockInvoke).not.toHaveBeenCalledWith('create_file', expect.anything());
      });
    });

    it('handles file creation error', async () => {
      const { container } = render(FileExplorerEnhanced);

      mockJoin.mockResolvedValueOnce('/home/user/project/test.txt');
      mockInvoke.mockRejectedValueOnce(new Error('File already exists'));

      // Click new file button
      const newFileBtn = container.querySelector('[title="New File"]') as HTMLElement;
      await fireEvent.click(newFileBtn);

      // Enter filename
      const input = container.querySelector('#new-file-name') as HTMLInputElement;
      await fireEvent.input(input, { target: { value: 'test.txt' } });

      // Click create
      const createBtn = container.querySelector('.btn-primary') as HTMLElement;
      await fireEvent.click(createBtn);

      await waitFor(() => {
        expect(container.querySelector('.dialog-error')?.textContent).toContain('Failed to create file');
      });
    });
  });

  describe('Directory Navigation', () => {
    it('refreshes directory listing', async () => {
      mockInvoke.mockResolvedValueOnce('/home/user/project');
      mockReadDir
        .mockResolvedValueOnce([{ name: 'old.txt', path: '/home/user/project/old.txt' }])
        .mockResolvedValueOnce([{ name: 'new.txt', path: '/home/user/project/new.txt' }]);

      const { container } = render(FileExplorerEnhanced);

      await waitFor(() => {
        expect(mockReadDir).toHaveBeenCalledTimes(1);
      });

      // Click refresh button
      const refreshBtn = container.querySelector('[title="Refresh"]') as HTMLElement;
      await fireEvent.click(refreshBtn);

      await waitFor(() => {
        expect(mockReadDir).toHaveBeenCalledTimes(2);
      });
    });

    it('handles expand event from FileTree', async () => {
      const { component } = render(FileExplorerEnhanced);
      
      const node: TreeNode = {
        name: 'src',
        path: '/home/user/project/src',
        isDirectory: true,
        children: [],
        expanded: false
      };

      mockReadDir.mockResolvedValueOnce([
        { name: 'index.ts', path: '/home/user/project/src/index.ts' }
      ]);

      // Simulate expand event
      await component.$set({ tree: [node] });
      const expandEvent = new CustomEvent('expand', { detail: node });
      component.handleExpand(expandEvent);

      await waitFor(() => {
        expect(mockReadDir).toHaveBeenCalledWith('/home/user/project/src');
        expect(node.children).toHaveLength(1);
        expect(node.children?.[0].name).toBe('index.ts');
      });
    });

    it('filters hidden files except .gitignore', async () => {
      mockInvoke.mockResolvedValueOnce('/home/user/project');
      mockReadDir.mockResolvedValueOnce([
        { name: '.hidden', path: '/home/user/project/.hidden' },
        { name: '.gitignore', path: '/home/user/project/.gitignore' },
        { name: 'visible.txt', path: '/home/user/project/visible.txt' }
      ]);

      const { component } = render(FileExplorerEnhanced);

      await waitFor(() => {
        const tree = component.tree;
        expect(tree).toHaveLength(2);
        expect(tree.find(n => n.name === '.gitignore')).toBeTruthy();
        expect(tree.find(n => n.name === 'visible.txt')).toBeTruthy();
        expect(tree.find(n => n.name === '.hidden')).toBeFalsy();
      });
    });

    it('sorts entries with directories first', async () => {
      mockInvoke.mockResolvedValueOnce('/home/user/project');
      mockReadDir.mockResolvedValueOnce([
        { name: 'z-file.txt', path: '/home/user/project/z-file.txt' },
        { name: 'a-folder', path: '/home/user/project/a-folder', children: [] },
        { name: 'b-file.txt', path: '/home/user/project/b-file.txt' },
        { name: 'z-folder', path: '/home/user/project/z-folder', children: [] }
      ]);

      const { component } = render(FileExplorerEnhanced);

      await waitFor(() => {
        const tree = component.tree;
        expect(tree[0].name).toBe('a-folder');
        expect(tree[1].name).toBe('z-folder');
        expect(tree[2].name).toBe('b-file.txt');
        expect(tree[3].name).toBe('z-file.txt');
      });
    });
  });

  describe('Context Menu Operations', () => {
    it('shows context menu on right click', async () => {
      const { component } = render(FileExplorerEnhanced);
      
      const node: TreeNode = {
        name: 'test.txt',
        path: '/home/user/project/test.txt',
        isDirectory: false
      };

      // Simulate context menu event
      const contextMenuEvent = new CustomEvent('contextMenu', {
        detail: { node, x: 100, y: 200 }
      });
      component.handleContextMenu(contextMenuEvent);

      await waitFor(() => {
        expect(component.contextMenu).toEqual({ node, x: 100, y: 200 });
      });
    });

    it('renames item', async () => {
      const { component } = render(FileExplorerEnhanced);
      const mockDispatch = vi.fn();
      component.$on('itemRenamed', mockDispatch);

      const node: TreeNode = {
        name: 'old.txt',
        path: '/home/user/project/old.txt',
        isDirectory: false
      };

      mockDirname.mockResolvedValueOnce('/home/user/project');
      mockJoin.mockResolvedValueOnce('/home/user/project/new.txt');
      mockInvoke.mockResolvedValueOnce(undefined); // rename_path
      mockReadDir.mockResolvedValueOnce([]); // refresh

      // Set up rename dialog
      component.currentNode = node;
      component.dialogInputValue = 'new.txt';
      component.showRenameDialog = true;

      // Execute rename
      await component.renameItem();

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('rename_path', {
          oldPath: '/home/user/project/old.txt',
          newName: 'new.txt'
        });
        expect(mockDispatch).toHaveBeenCalledWith(
          expect.objectContaining({
            detail: {
              oldPath: '/home/user/project/old.txt',
              newPath: '/home/user/project/new.txt'
            }
          })
        );
      });
    });

    it('deletes item', async () => {
      const { component } = render(FileExplorerEnhanced);
      const mockDispatch = vi.fn();
      component.$on('itemDeleted', mockDispatch);

      const node: TreeNode = {
        name: 'delete-me.txt',
        path: '/home/user/project/delete-me.txt',
        isDirectory: false
      };

      mockInvoke.mockResolvedValueOnce(undefined); // delete_path
      mockReadDir.mockResolvedValueOnce([]); // refresh

      // Set up delete
      component.currentNode = node;
      component.showDeleteDialog = true;

      // Execute delete
      await component.deleteItem();

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('delete_path', {
          path: '/home/user/project/delete-me.txt',
          permanent: false
        });
        expect(mockDispatch).toHaveBeenCalledWith(
          expect.objectContaining({
            detail: '/home/user/project/delete-me.txt'
          })
        );
      });
    });

    it('copies path to clipboard', async () => {
      const mockClipboard = {
        writeText: vi.fn()
      };
      Object.defineProperty(navigator, 'clipboard', {
        value: mockClipboard,
        configurable: true
      });

      const { component } = render(FileExplorerEnhanced);
      
      const node: TreeNode = {
        name: 'copy-path.txt',
        path: '/home/user/project/copy-path.txt',
        isDirectory: false
      };

      component.handleCopyPath(node);

      expect(mockClipboard.writeText).toHaveBeenCalledWith('/home/user/project/copy-path.txt');
    });
  });

  describe('Event Dispatching', () => {
    it('dispatches openFile event', async () => {
      const { component } = render(FileExplorerEnhanced);
      const mockDispatch = vi.fn();
      component.$on('openFile', mockDispatch);

      const openFileEvent = new CustomEvent('openFile', {
        detail: '/home/user/project/file.txt'
      });
      component.handleOpenFile(openFileEvent);

      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: '/home/user/project/file.txt'
        })
      );
    });

    it('dispatches collapseAll event', async () => {
      const { container, component } = render(FileExplorerEnhanced);
      const mockDispatch = vi.fn();
      component.$on('collapseAll', mockDispatch);

      const collapseBtn = container.querySelector('[title="Collapse All"]') as HTMLElement;
      await fireEvent.click(collapseBtn);

      expect(mockDispatch).toHaveBeenCalled();
    });
  });

  describe('Loading States', () => {
    it('shows loading state while loading directory', async () => {
      const { container, component } = render(FileExplorerEnhanced);
      
      component.loading = true;

      await waitFor(() => {
        expect(container.querySelector('.loading-state')).toBeTruthy();
        expect(container.textContent).toContain('Loading...');
      });
    });

    it('shows empty state when no files', async () => {
      mockInvoke.mockResolvedValueOnce('/home/user/project');
      mockReadDir.mockResolvedValueOnce([]);

      const { container } = render(FileExplorerEnhanced);

      await waitFor(() => {
        expect(container.querySelector('.empty-state')).toBeTruthy();
        expect(container.textContent).toContain('No files in directory');
      });
    });
  });

  describe('Agent Status Integration', () => {
    it('initializes with mock agent data', async () => {
      const { component } = render(FileExplorerEnhanced);

      await waitFor(() => {
        expect(component.agents.size).toBeGreaterThan(0);
        expect(component.agents.get('/src/server.js')).toEqual({
          status: 'running',
          pid: 1234
        });
        expect(component.agents.get('/test/runner.js')).toEqual({
          status: 'error',
          pid: 5678
        });
      });
    });
  });

  describe('Dialog Interactions', () => {
    it('closes dialog on cancel', async () => {
      const { container, component } = render(FileExplorerEnhanced);
      
      component.showNewFileDialog = true;

      await waitFor(() => {
        const cancelBtn = container.querySelector('.btn-secondary') as HTMLElement;
        expect(cancelBtn).toBeTruthy();
      });

      const cancelBtn = container.querySelector('.btn-secondary') as HTMLElement;
      await fireEvent.click(cancelBtn);

      expect(component.showNewFileDialog).toBe(false);
    });

    it('validates rename with empty name', async () => {
      const { component } = render(FileExplorerEnhanced);
      
      component.currentNode = {
        name: 'test.txt',
        path: '/test.txt',
        isDirectory: false
      };
      component.dialogInputValue = '';
      component.showRenameDialog = true;

      await component.renameItem();

      expect(component.dialogError).toBe('Name cannot be empty');
    });

    it('skips rename if name unchanged', async () => {
      const { component } = render(FileExplorerEnhanced);
      
      const node: TreeNode = {
        name: 'same.txt',
        path: '/same.txt',
        isDirectory: false
      };
      
      component.currentNode = node;
      component.dialogInputValue = 'same.txt';
      component.showRenameDialog = true;

      await component.renameItem();

      expect(mockInvoke).not.toHaveBeenCalledWith('rename_path', expect.anything());
      expect(component.showRenameDialog).toBe(false);
    });
  });
});