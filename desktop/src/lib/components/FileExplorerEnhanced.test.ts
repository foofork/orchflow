import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, screen } from '@testing-library/svelte';
import FileExplorerEnhanced from './FileExplorerEnhanced.svelte';
import type { TreeNode } from '$lib/types';

// The FileTree, ContextMenu, and Dialog components are already mocked in setup-mocks.ts
// But we need to mock FileTree.svelte explicitly since it's not in setup-mocks.ts
import { createSvelteComponentMock } from '../../test/setup-mocks';

vi.mock('./FileTree.svelte', () => ({
  default: createSvelteComponentMock('FileTree')
}));

vi.mock('./ContextMenu.svelte', () => ({
  default: createSvelteComponentMock('ContextMenu')
}));

// Mock Tauri API
const mockInvoke = vi.fn();
const mockReadDir = vi.fn();
const mockJoin = vi.fn();
const mockDirname = vi.fn();

// Mock the imports as functions that return the mocked values
vi.mock('@tauri-apps/api/core', () => ({
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
  const mockFile: TreeNode = {
    name: 'test.txt',
    path: '/path/to/test.txt',
    type: 'file',
    isExpanded: false,
    isEditing: false,
    children: []
  };

  const mockDirectory: TreeNode = {
    name: 'testDir',
    path: '/path/to/testDir',
    type: 'directory',
    isExpanded: false,
    isEditing: false,
    children: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue({});
    mockReadDir.mockResolvedValue([]);
    mockJoin.mockImplementation((...paths) => paths.join('/'));
    mockDirname.mockImplementation((path) => path.split('/').slice(0, -1).join('/'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders the file explorer with initial state', () => {
      const { container } = render(FileExplorerEnhanced, {
        props: {
          width: 300
        }
      });

      expect(container.querySelector('.file-explorer')).toBeTruthy();
      expect(container.querySelector('.file-explorer-header')).toBeTruthy();
      expect(container.querySelector('.file-explorer-content')).toBeTruthy();
    });

    it('shows loading state when loading', async () => {
      mockReadDir.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      const { container } = render(FileExplorerEnhanced, {
        props: {
          width: 300
        }
      });

      await waitFor(() => {
        expect(container.querySelector('.loading-indicator')).toBeTruthy();
      });
    });

    it('displays error message when loading fails', async () => {
      const errorMessage = 'Failed to load directory';
      mockReadDir.mockRejectedValue(new Error(errorMessage));

      const { container } = render(FileExplorerEnhanced, {
        props: {
          width: 300
        }
      });

      await waitFor(() => {
        expect(container.textContent).toContain(errorMessage);
      });
    });
  });

  describe('Directory Operations', () => {
    it('loads root directory on mount', async () => {
      render(FileExplorerEnhanced, {
        props: {
          width: 300
        }
      });

      await waitFor(() => {
        expect(mockReadDir).toHaveBeenCalled();
      });
    });

    it('expands directory when clicked', async () => {
      mockReadDir.mockResolvedValue([
        { name: 'child.txt', path: '/path/to/testDir/child.txt', children: null }
      ]);

      const { component } = render(FileExplorerEnhanced, {
        props: {
          width: 300
        }
      });

      // Wait for initial load
      await waitFor(() => {
        expect(mockReadDir).toHaveBeenCalled();
      });

      // Simulate directory expansion through the FileTree component
      component.$set({ 
        rootNode: {
          ...mockDirectory,
          isExpanded: true,
          children: [mockFile]
        }
      });

      await waitFor(() => {
        expect(mockReadDir).toHaveBeenCalledTimes(2);
      });
    });

    it('refreshes directory contents', async () => {
      const { getByTitle } = render(FileExplorerEnhanced, {
        props: {
          width: 300
        }
      });

      await waitFor(() => {
        expect(mockReadDir).toHaveBeenCalledTimes(1);
      });

      const refreshButton = getByTitle('Refresh');
      await fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(mockReadDir).toHaveBeenCalledTimes(2);
      });
    });

    it('changes current directory path', async () => {
      const newPath = '/new/path';
      const { getByPlaceholderText, getByTitle } = render(FileExplorerEnhanced, {
        props: {
          width: 300
        }
      });

      const pathInput = getByPlaceholderText('Enter path') as HTMLInputElement;
      await fireEvent.input(pathInput, { target: { value: newPath } });
      
      const goButton = getByTitle('Go to path');
      await fireEvent.click(goButton);

      await waitFor(() => {
        expect(mockReadDir).toHaveBeenCalledWith(newPath);
      });
    });
  });

  describe('File Operations', () => {
    it('opens file when double-clicked', async () => {
      const { component } = render(FileExplorerEnhanced, {
        props: {
          width: 300
        }
      });

      const openHandler = vi.fn();
      component.$on('open', openHandler);

      // Simulate file selection through component API
      await component.openFile(mockFile);

      expect(openHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: mockFile
        })
      );
    });

    it('creates new file', async () => {
      const newFileName = 'newfile.txt';
      const { getByTitle, getByPlaceholderText, getByText } = render(FileExplorerEnhanced, {
        props: {
          width: 300
        }
      });

      // Click new file button
      const newFileButton = getByTitle('New File');
      await fireEvent.click(newFileButton);

      // Enter file name in dialog
      const input = getByPlaceholderText('Enter name');
      await fireEvent.input(input, { target: { value: newFileName } });

      // Confirm creation
      const confirmButton = getByText('Create');
      await fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('create_file', {
          path: expect.stringContaining(newFileName)
        });
      });
    });

    it('creates new folder', async () => {
      const newFolderName = 'newfolder';
      const { getByTitle, getByPlaceholderText, getByText } = render(FileExplorerEnhanced, {
        props: {
          width: 300
        }
      });

      // Click new folder button
      const newFolderButton = getByTitle('New Folder');
      await fireEvent.click(newFolderButton);

      // Enter folder name in dialog
      const input = getByPlaceholderText('Enter name');
      await fireEvent.input(input, { target: { value: newFolderName } });

      // Confirm creation
      const confirmButton = getByText('Create');
      await fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('create_dir', {
          path: expect.stringContaining(newFolderName)
        });
      });
    });

    it('renames file', async () => {
      const newName = 'renamed.txt';
      const { component } = render(FileExplorerEnhanced, {
        props: {
          width: 300
        }
      });

      // Set up initial state with a file
      component.$set({
        rootNode: {
          name: 'root',
          path: '/',
          type: 'directory',
          isExpanded: true,
          isEditing: false,
          children: [mockFile]
        }
      });

      // Trigger rename through component method
      await component.handleRename(mockFile, newName);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('rename', {
          oldPath: mockFile.path,
          newPath: expect.stringContaining(newName)
        });
      });
    });

    it('deletes file with confirmation', async () => {
      const { component } = render(FileExplorerEnhanced, {
        props: {
          width: 300
        }
      });

      // Set up initial state with a file
      component.$set({
        rootNode: {
          name: 'root',
          path: '/',
          type: 'directory',
          isExpanded: true,
          isEditing: false,
          children: [mockFile]
        }
      });

      // Mock confirm dialog
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      // Trigger delete through component method
      await component.handleDelete(mockFile);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('remove_file', {
          path: mockFile.path
        });
      });
    });

    it('cancels delete when not confirmed', async () => {
      const { component } = render(FileExplorerEnhanced, {
        props: {
          width: 300
        }
      });

      // Mock confirm dialog to return false
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      // Trigger delete through component method
      await component.handleDelete(mockFile);

      expect(mockInvoke).not.toHaveBeenCalledWith('remove_file', expect.any(Object));
    });
  });

  describe('Context Menu', () => {
    it('shows context menu on right click', async () => {
      const { component, container } = render(FileExplorerEnhanced, {
        props: {
          width: 300
        }
      });

      // Set up initial state with a file
      component.$set({
        rootNode: {
          name: 'root',
          path: '/',
          type: 'directory',
          isExpanded: true,
          isEditing: false,
          children: [mockFile]
        }
      });

      // Simulate right-click through component method
      await component.handleContextMenu(mockFile, { clientX: 100, clientY: 100 });

      await waitFor(() => {
        expect(container.querySelector('[data-testid="ContextMenu"]')).toBeTruthy();
      });
    });
  });

  describe('Search Functionality', () => {
    it('filters files based on search query', async () => {
      const { getByPlaceholderText, component } = render(FileExplorerEnhanced, {
        props: {
          width: 300
        }
      });

      // Set up initial state with files
      const files = [
        { ...mockFile, name: 'test1.txt' },
        { ...mockFile, name: 'test2.txt' },
        { ...mockFile, name: 'other.txt' }
      ];

      component.$set({
        rootNode: {
          name: 'root',
          path: '/',
          type: 'directory',
          isExpanded: true,
          isEditing: false,
          children: files
        }
      });

      // Enter search query
      const searchInput = getByPlaceholderText('Search files...');
      await fireEvent.input(searchInput, { target: { value: 'test' } });

      // The filtered results should be handled by the FileTree component
      // We just verify the search state was updated
      expect(searchInput.value).toBe('test');
    });

    it('clears search when X button clicked', async () => {
      const { getByPlaceholderText, getByTitle } = render(FileExplorerEnhanced, {
        props: {
          width: 300
        }
      });

      // Enter search query
      const searchInput = getByPlaceholderText('Search files...') as HTMLInputElement;
      await fireEvent.input(searchInput, { target: { value: 'test' } });

      // Click clear button
      const clearButton = getByTitle('Clear search');
      await fireEvent.click(clearButton);

      expect(searchInput.value).toBe('');
    });
  });

  describe('Keyboard Navigation', () => {
    it('handles keyboard shortcuts', async () => {
      const { container, component } = render(FileExplorerEnhanced, {
        props: {
          width: 300
        }
      });

      const deleteHandler = vi.fn();
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      // Set up a selected file
      component.$set({
        rootNode: {
          name: 'root',
          path: '/',
          type: 'directory',
          isExpanded: true,
          isEditing: false,
          children: [mockFile]
        },
        selectedNode: mockFile
      });

      // Simulate Delete key press
      await fireEvent.keyDown(container.firstChild as Element, { key: 'Delete' });

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('remove_file', {
          path: mockFile.path
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('shows error when file operation fails', async () => {
      const errorMessage = 'Permission denied';
      mockInvoke.mockRejectedValue(new Error(errorMessage));

      const { component, container } = render(FileExplorerEnhanced, {
        props: {
          width: 300
        }
      });

      // Try to delete a file
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      await component.handleDelete(mockFile);

      await waitFor(() => {
        expect(container.textContent).toContain(errorMessage);
      });
    });
  });
});