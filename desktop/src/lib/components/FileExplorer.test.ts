import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import FileExplorer from './FileExplorer.svelte';
import { 
  createAsyncMock, 
  createSyncMock,
  enhancedComponentMocks,
  MockedFunction
} from '@/test/mock-factory';
import {
  buildFileNode,
  buildDirectoryNode,
  testScenarios
} from '@/test/domain-builders';

// Helper to wait for component to initialize
const waitForComponent = async () => {
  await tick();
  await new Promise(resolve => setTimeout(resolve, 100));
};

// Mock browser environment
vi.mock('$app/environment', () => ({ browser: true }));

// Mock Tauri API with typed mocks
const mockInvoke = createAsyncMock<[string, any?], any>();
const mockReadDir = createAsyncMock<[string], any[]>();

// Mock window.__TAURI__ and performance
(global as any).window = {
  __TAURI__: true,
  performance: {
    now: () => Date.now()
  }
};

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke
}));

vi.mock('@tauri-apps/api/fs', () => ({
  readDir: mockReadDir
}));

vi.mock('@tauri-apps/api/path', () => ({
  join: createAsyncMock<[string, string], string>()
    .mockImplementation((base, path) => Promise.resolve(`${base}/${path}`))
}));

describe('FileExplorer Component', () => {
  // Cleanup tracking
  let cleanup: Array<() => void> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup = [];
    
    // Default mock implementations using domain builders
    mockInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_current_dir') {
        return Promise.resolve('/home/user/project');
      }
      return Promise.resolve();
    });
    
    // Use domain builders for file structure
    const defaultFiles = [
      buildDirectoryNode('src', '/home/user/project/src'),
      buildFileNode('package.json', '/home/user/project/package.json'),
      buildFileNode('README.md', '/home/user/project/README.md', {
        gitStatus: 'modified'
      }),
      buildFileNode('.gitignore', '/home/user/project/.gitignore', {
        isHidden: true
      })
    ];
    
    mockReadDir.mockImplementation((path) => {
      if (path === '/home/user/project') {
        return Promise.resolve(defaultFiles);
      }
      return Promise.resolve([]);
    });
  });

  afterEach(() => {
    // Clean up all tracked resources
    cleanup.forEach(fn => fn());
    cleanup = [];
    vi.clearAllMocks();
  });

  describe('Component Initialization', () => {
    it('should render file explorer container', () => {
      const { container, unmount } = render(FileExplorer);
      cleanup.push(unmount);
      
      const explorer = container.querySelector('.file-explorer');
      expect(explorer).toBeTruthy();
    });

    it('should load current directory on mount', async () => {
      const { unmount } = render(FileExplorer);
      cleanup.push(unmount);
      
      await waitForComponent();
      
      expect(mockInvoke).toHaveBeenCalledWith('get_current_dir');
      expect(mockReadDir).toHaveBeenCalledWith('/home/user/project');
    });

    it('should display loaded files and folders', async () => {
      const { unmount } = render(FileExplorer);
      cleanup.push(unmount);
      
      await waitForComponent();
      
      expect(screen.getByText('src')).toBeTruthy();
      expect(screen.getByText('package.json')).toBeTruthy();
      expect(screen.getByText('README.md')).toBeTruthy();
    });

    it('should filter out hidden files', async () => {
      const { unmount } = render(FileExplorer);
      cleanup.push(unmount);
      
      await waitForComponent();
      
      expect(screen.getByText('src')).toBeTruthy();
      // .gitignore should be filtered out
      expect(screen.queryByText('.gitignore')).toBeFalsy();
    });

    it('should sort directories before files', async () => {
      // Use test scenarios for complex file structures
      const mixedFiles = [
        buildFileNode('file1.txt', '/home/user/project/file1.txt'),
        buildDirectoryNode('dir1', '/home/user/project/dir1'),
        buildFileNode('file2.txt', '/home/user/project/file2.txt'),
        buildDirectoryNode('dir2', '/home/user/project/dir2')
      ];
      
      mockReadDir.mockResolvedValue(mixedFiles);
      
      const { container, unmount } = render(FileExplorer);
      cleanup.push(unmount);
      
      await waitForComponent();
      
      const nodes = container.querySelectorAll('.node-item .name');
      expect(nodes[0]?.textContent).toBe('dir1');
      expect(nodes[1]?.textContent).toBe('dir2');
      expect(nodes[2]?.textContent).toBe('file1.txt');
      expect(nodes[3]?.textContent).toBe('file2.txt');
    });

    it('should handle error when loading directory fails', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Permission denied'));
      
      const { unmount } = render(FileExplorer);
      cleanup.push(unmount);
      
      await waitForComponent();
      
      expect(screen.getByText(/Failed to load directory/)).toBeTruthy();
    });

    it('should show empty state when no files in directory', async () => {
      mockReadDir.mockResolvedValue([]);
      
      const { unmount } = render(FileExplorer);
      cleanup.push(unmount);
      
      await waitForComponent();
      
      expect(screen.getByText('No files in directory')).toBeTruthy();
    });
  });

  describe('File and Folder Interaction', () => {
    it('should expand directory when clicked', async () => {
      const { unmount } = render(FileExplorer);
      cleanup.push(unmount);
      
      await waitForComponent();
      
      const srcNode = screen.getByText('src').closest('button');
      
      // Use domain builders for nested structure
      const srcContents = [
        buildFileNode('index.js', '/home/user/project/src/index.js'),
        buildDirectoryNode('components', '/home/user/project/src/components')
      ];
      
      mockReadDir.mockImplementation((path) => {
        if (path === '/home/user/project/src') {
          return Promise.resolve(srcContents);
        }
        return Promise.resolve([]);
      });
      
      await fireEvent.click(srcNode!);
      await waitForComponent();
      
      expect(mockReadDir).toHaveBeenCalledWith('/home/user/project/src');
      expect(screen.getByText('index.js')).toBeTruthy();
      expect(screen.getByText('components')).toBeTruthy();
    });

    it('should collapse directory when clicked again', async () => {
      const result = render(FileExplorer);
      const container = result.container || document.body;
      cleanup.push(result.unmount);
      
      await waitForComponent();
      
      const srcNode = screen.getByText('src').closest('button');
      
      // Use domain builders
      const srcFile = buildFileNode('index.js', '/home/user/project/src/index.js');
      mockReadDir.mockImplementation((path) => {
        if (path === '/home/user/project/src') {
          return Promise.resolve([srcFile]);
        }
        return Promise.resolve([]);
      });
      
      await fireEvent.click(srcNode!);
      await waitForComponent();
      
      expect(screen.getByText('index.js')).toBeTruthy();
      
      // Check that we have an expanded directory with children visible
      let childrenDiv = container.querySelector('.children');
      expect(childrenDiv).toBeTruthy();
      expect(childrenDiv?.querySelector('.name')?.textContent).toBe('index.js');
      
      // Collapse
      await fireEvent.click(srcNode!);
      await waitForComponent();
      
      // After collapsing, the children div should be removed after transition
      await waitFor(() => {
        const childrenDivs = container.querySelectorAll('.children');
        expect(childrenDivs.length).toBe(0);
      }, { timeout: 500 }); // Wait longer for transition
    });

    it('should emit openFile event when file is clicked', async () => {
      const { component, unmount } = render(FileExplorer);
      cleanup.push(unmount);
      
      const openFileHandler = createSyncMock<[any], void>();
      const unsubscribe = component.$on('openFile', (event) => {
        openFileHandler(event.detail);
      });
      cleanup.push(unsubscribe);
      
      await waitForComponent();
      
      const fileNode = screen.getByText('package.json').closest('button');
      await fireEvent.click(fileNode!);
      
      expect(openFileHandler).toHaveBeenCalledWith('/home/user/project/package.json');
    });

    it('should show selected file with different styling', async () => {
      const { unmount } = render(FileExplorer);
      cleanup.push(unmount);
      
      await waitForComponent();
      
      const fileNode = screen.getByText('package.json').closest('button');
      await fireEvent.click(fileNode!);
      
      expect(fileNode).toHaveClass('selected');
    });

    it('should show loading indicator while expanding directory', async () => {
      const result = render(FileExplorer);
      const container = result.container || document.body;
      cleanup.push(result.unmount);
      
      await waitForComponent();
      
      let resolvePromise: (value: any) => void;
      
      // Create a promise that we control
      const delayedPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      
      // Mock readDir to return our controlled promise
      mockReadDir.mockReturnValue(delayedPromise);
      
      const srcNode = screen.getByText('src').closest('button');
      
      // Click to expand - this should set loading = true
      await fireEvent.click(srcNode!);
      
      // Let Svelte render the loading state
      await tick();
      
      // Check for loading indicator
      const loadingIndicator = container.querySelector('.loading');
      expect(loadingIndicator).toBeTruthy();
      expect(loadingIndicator?.textContent).toBe('⟳');
      
      // Now resolve the promise to complete loading
      resolvePromise!([]);
      await waitForComponent();
      
      // Loading indicator should be gone
      const loadingAfter = srcNode?.querySelector('.loading');
      expect(loadingAfter).toBeFalsy();
    });

    it('should handle error when expanding directory fails', async () => {
      const consoleSpy = createSyncMock<[any, any?], void>();
      const originalError = console.error;
      console.error = consoleSpy as any;
      cleanup.push(() => { console.error = originalError; });
      
      const { unmount } = render(FileExplorer);
      cleanup.push(unmount);
      
      await waitForComponent();
      
      const srcNode = screen.getByText('src').closest('button');
      
      mockReadDir.mockRejectedValueOnce(new Error('Permission denied'));
      
      await fireEvent.click(srcNode!);
      await waitForComponent();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to expand directory:',
        expect.any(Error)
      );
    });
  });

  describe('File Icons', () => {
    it('should display appropriate icons for different file types', async () => {
      // Use test scenarios for git repository
      const gitFiles = testScenarios.buildGitRepository([
        { path: '/home/user/project/index.js', status: 'clean' },
        { path: '/home/user/project/styles.css', status: 'modified' },
        { path: '/home/user/project/data.json', status: 'clean' },
        { path: '/home/user/project/README.md', status: 'clean' },
        { path: '/home/user/project/image.png', status: 'clean' }
      ]);
      
      mockReadDir.mockResolvedValue(gitFiles);
      
      const { container, unmount } = render(FileExplorer);
      cleanup.push(unmount);
      
      await waitForComponent();
      
      // Check for file type icons
      const jsIcon = container.querySelector('[data-file="index.js"] .icon');
      const cssIcon = container.querySelector('[data-file="styles.css"] .icon');
      const jsonIcon = container.querySelector('[data-file="data.json"] .icon');
      const mdIcon = container.querySelector('[data-file="README.md"] .icon');
      const imageIcon = container.querySelector('[data-file="image.png"] .icon');
      
      expect(jsIcon?.textContent).toContain('📄'); // Or specific JS icon
      expect(cssIcon?.textContent).toContain('🎨'); // Or specific CSS icon
      expect(jsonIcon?.textContent).toContain('{}'); // Or specific JSON icon
      expect(mdIcon?.textContent).toContain('📝'); // Or specific MD icon
      expect(imageIcon?.textContent).toContain('🖼️'); // Or specific image icon
    });

    it('should show directory icon for folders', async () => {
      const { container, unmount } = render(FileExplorer);
      cleanup.push(unmount);
      
      await waitForComponent();
      
      const dirIcon = container.querySelector('[data-file="src"] .icon');
      expect(dirIcon?.textContent).toContain('📁'); // Or specific folder icon
    });

    it('should show git status indicators', async () => {
      const gitFiles = [
        buildFileNode('modified.js', '/home/user/project/modified.js', {
          gitStatus: 'modified'
        }),
        buildFileNode('added.js', '/home/user/project/added.js', {
          gitStatus: 'added'
        }),
        buildFileNode('deleted.js', '/home/user/project/deleted.js', {
          gitStatus: 'deleted'
        })
      ];
      
      mockReadDir.mockResolvedValue(gitFiles);
      
      const { container, unmount } = render(FileExplorer);
      cleanup.push(unmount);
      
      await waitForComponent();
      
      const modifiedFile = container.querySelector('[data-file="modified.js"]');
      const addedFile = container.querySelector('[data-file="added.js"]');
      const deletedFile = container.querySelector('[data-file="deleted.js"]');
      
      expect(modifiedFile).toHaveClass('git-modified');
      expect(addedFile).toHaveClass('git-added');
      expect(deletedFile).toHaveClass('git-deleted');
    });
  });

  describe('Context Menu', () => {
    it('should show context menu on right click', async () => {
      const { unmount } = render(FileExplorer);
      cleanup.push(unmount);
      
      await waitForComponent();
      
      const fileNode = screen.getByText('package.json').closest('.node-item');
      await fireEvent.contextMenu(fileNode!);
      
      expect(screen.getByText('Open')).toBeTruthy();
      expect(screen.getByText('Rename')).toBeTruthy();
      expect(screen.getByText('Delete')).toBeTruthy();
    });

    it('should handle rename action', async () => {
      const mockRename = createAsyncMock<[string, string], void>();
      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'rename_file') {
          return mockRename(args.oldPath, args.newPath);
        }
        if (cmd === 'get_current_dir') {
          return Promise.resolve('/home/user/project');
        }
        return Promise.resolve();
      });
      
      const { unmount } = render(FileExplorer);
      cleanup.push(unmount);
      
      await waitForComponent();
      
      const fileNode = screen.getByText('package.json').closest('.node-item');
      await fireEvent.contextMenu(fileNode!);
      
      const renameOption = screen.getByText('Rename');
      await fireEvent.click(renameOption);
      
      // Simulate rename dialog
      const input = screen.getByRole('textbox');
      await fireEvent.change(input, { target: { value: 'package-new.json' } });
      await fireEvent.keyDown(input, { key: 'Enter' });
      
      expect(mockRename).toHaveBeenCalledWith(
        '/home/user/project/package.json',
        '/home/user/project/package-new.json'
      );
    });

    it('should handle delete action with confirmation', async () => {
      const mockDelete = createAsyncMock<[string], void>();
      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'delete_file') {
          return mockDelete(args.path);
        }
        if (cmd === 'get_current_dir') {
          return Promise.resolve('/home/user/project');
        }
        return Promise.resolve();
      });
      
      const { unmount } = render(FileExplorer);
      cleanup.push(unmount);
      
      await waitForComponent();
      
      const fileNode = screen.getByText('README.md').closest('.node-item');
      await fireEvent.contextMenu(fileNode!);
      
      const deleteOption = screen.getByText('Delete');
      await fireEvent.click(deleteOption);
      
      // Confirm deletion
      const confirmButton = screen.getByText('Confirm');
      await fireEvent.click(confirmButton);
      
      expect(mockDelete).toHaveBeenCalledWith('/home/user/project/README.md');
    });
  });

  describe('Search and Filter', () => {
    it('should filter files based on search input', async () => {
      const { unmount } = render(FileExplorer);
      cleanup.push(unmount);
      
      await waitForComponent();
      
      const searchInput = screen.getByPlaceholderText('Search files...');
      await fireEvent.input(searchInput, { target: { value: 'json' } });
      
      await waitFor(() => {
        expect(screen.getByText('package.json')).toBeTruthy();
        expect(screen.queryByText('README.md')).toBeFalsy();
      });
    });

    it('should show no results message when search has no matches', async () => {
      const { unmount } = render(FileExplorer);
      cleanup.push(unmount);
      
      await waitForComponent();
      
      const searchInput = screen.getByPlaceholderText('Search files...');
      await fireEvent.input(searchInput, { target: { value: 'nonexistent' } });
      
      await waitFor(() => {
        expect(screen.getByText('No files match your search')).toBeTruthy();
      });
    });

    it('should clear search when clear button is clicked', async () => {
      const { unmount } = render(FileExplorer);
      cleanup.push(unmount);
      
      await waitForComponent();
      
      const searchInput = screen.getByPlaceholderText('Search files...');
      await fireEvent.input(searchInput, { target: { value: 'json' } });
      
      await waitFor(() => {
        expect(screen.queryByText('README.md')).toBeFalsy();
      });
      
      const clearButton = screen.getByTitle('Clear search');
      await fireEvent.click(clearButton);
      
      await waitFor(() => {
        expect(screen.getByText('README.md')).toBeTruthy();
        expect(screen.getByText('package.json')).toBeTruthy();
      });
    });
  });

  describe('Drag and Drop', () => {
    it('should handle file drop for moving files', async () => {
      const mockMove = createAsyncMock<[string, string], void>();
      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'move_file') {
          return mockMove(args.source, args.destination);
        }
        if (cmd === 'get_current_dir') {
          return Promise.resolve('/home/user/project');
        }
        return Promise.resolve();
      });
      
      const { unmount } = render(FileExplorer);
      cleanup.push(unmount);
      
      await waitForComponent();
      
      const fileNode = screen.getByText('README.md').closest('.node-item');
      const dirNode = screen.getByText('src').closest('.node-item');
      
      // Simulate drag and drop
      await fireEvent.dragStart(fileNode!, {
        dataTransfer: {
          setData: createSyncMock(),
          effectAllowed: 'move'
        }
      });
      
      await fireEvent.dragOver(dirNode!, {
        dataTransfer: { dropEffect: 'move' }
      });
      
      await fireEvent.drop(dirNode!, {
        dataTransfer: {
          getData: createSyncMock<[string], string>()
            .mockReturnValue('/home/user/project/README.md')
        }
      });
      
      expect(mockMove).toHaveBeenCalledWith(
        '/home/user/project/README.md',
        '/home/user/project/src/README.md'
      );
    });

    it('should show drop zone indicator during drag over', async () => {
      const { container, unmount } = render(FileExplorer);
      cleanup.push(unmount);
      
      await waitForComponent();
      
      const fileNode = screen.getByText('README.md').closest('.node-item');
      const dirNode = screen.getByText('src').closest('.node-item');
      
      await fireEvent.dragStart(fileNode!);
      await fireEvent.dragEnter(dirNode!);
      
      expect(dirNode).toHaveClass('drag-over');
      
      await fireEvent.dragLeave(dirNode!);
      
      expect(dirNode).not.toHaveClass('drag-over');
    });
  });

  describe('Keyboard Navigation', () => {
    it('should navigate files with arrow keys', async () => {
      const { container, unmount } = render(FileExplorer);
      cleanup.push(unmount);
      
      await waitForComponent();
      
      const explorer = container.querySelector('.file-explorer');
      
      // Focus first item
      await fireEvent.keyDown(explorer!, { key: 'ArrowDown' });
      
      let focusedElement = document.activeElement;
      expect(focusedElement?.textContent).toContain('src');
      
      // Navigate down
      await fireEvent.keyDown(focusedElement!, { key: 'ArrowDown' });
      
      focusedElement = document.activeElement;
      expect(focusedElement?.textContent).toContain('package.json');
    });

    it('should expand/collapse with Enter key', async () => {
      const { unmount } = render(FileExplorer);
      cleanup.push(unmount);
      
      await waitForComponent();
      
      const srcContents = [
        buildFileNode('index.js', '/home/user/project/src/index.js')
      ];
      
      mockReadDir.mockImplementation((path) => {
        if (path === '/home/user/project/src') {
          return Promise.resolve(srcContents);
        }
        return Promise.resolve([]);
      });
      
      const srcNode = screen.getByText('src').closest('button');
      srcNode?.focus();
      
      // Expand with Enter
      await fireEvent.keyDown(srcNode!, { key: 'Enter' });
      await waitForComponent();
      
      expect(screen.getByText('index.js')).toBeTruthy();
      
      // Collapse with Enter
      await fireEvent.keyDown(srcNode!, { key: 'Enter' });
      await waitForComponent();
      
      await waitFor(() => {
        const childrenDivs = document.querySelectorAll('.children');
        expect(childrenDivs.length).toBe(0);
      });
    });

    it('should open file with Enter key', async () => {
      const { component, unmount } = render(FileExplorer);
      cleanup.push(unmount);
      
      const openFileHandler = createSyncMock<[string], void>();
      const unsubscribe = component.$on('openFile', (event) => {
        openFileHandler(event.detail);
      });
      cleanup.push(unsubscribe);
      
      await waitForComponent();
      
      const fileNode = screen.getByText('package.json').closest('button');
      fileNode?.focus();
      
      await fireEvent.keyDown(fileNode!, { key: 'Enter' });
      
      expect(openFileHandler).toHaveBeenCalledWith('/home/user/project/package.json');
    });
  });

  describe('Performance and Large Directories', () => {
    it('should handle large directories efficiently', async () => {
      // Create a large directory structure
      const largeDirectory = Array.from({ length: 1000 }, (_, i) => 
        buildFileNode(`file${i}.txt`, `/home/user/project/file${i}.txt`)
      );
      
      mockReadDir.mockResolvedValue(largeDirectory);
      
      const startTime = performance.now();
      const { unmount } = render(FileExplorer);
      cleanup.push(unmount);
      
      await waitForComponent();
      
      const renderTime = performance.now() - startTime;
      
      // Should render within reasonable time
      expect(renderTime).toBeLessThan(1000); // 1 second
      
      // Should virtualize or paginate large lists
      const visibleNodes = screen.getAllByRole('button');
      expect(visibleNodes.length).toBeLessThanOrEqual(50); // Assuming virtualization
    });

    it('should debounce search input for performance', async () => {
      const { unmount } = render(FileExplorer);
      cleanup.push(unmount);
      
      await waitForComponent();
      
      const searchInput = screen.getByPlaceholderText('Search files...');
      
      // Type quickly
      await fireEvent.input(searchInput, { target: { value: 'p' } });
      await fireEvent.input(searchInput, { target: { value: 'pa' } });
      await fireEvent.input(searchInput, { target: { value: 'pac' } });
      await fireEvent.input(searchInput, { target: { value: 'pack' } });
      
      // Should not update immediately
      expect(screen.getByText('README.md')).toBeTruthy();
      
      // Wait for debounce
      await waitFor(() => {
        expect(screen.queryByText('README.md')).toBeFalsy();
        expect(screen.getByText('package.json')).toBeTruthy();
      }, { timeout: 500 });
    });
  });
});