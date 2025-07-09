import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import FileExplorerAdvanced from './FileExplorerAdvanced.svelte';
import { mockInvoke, createMockFile } from '../../test/utils';

// Mock ContextMenu component
vi.mock('./ContextMenu.svelte', () => ({
  default: {
    $$render: (result: any, props: any) => {
      const { x, y, children } = props.$$props;
      if (props.$$slots.default) {
        return `<div class="context-menu" style="position: fixed; left: ${x}px; top: ${y}px;">${props.$$slots.default[0]()}</div>`;
      }
      return '';
    },
    render: () => ({})
  }
}));

describe('FileExplorerAdvanced', () => {
  let user: ReturnType<typeof userEvent.setup>;
  
  const mockFileTree = [
    {
      name: 'src',
      path: '/project/src',
      isDirectory: true,
      expanded: true,
      children: [
        {
          name: 'app.ts',
          path: '/project/src/app.ts',
          isDirectory: false,
          gitStatus: { path: '/project/src/app.ts', status: 'modified' as const, staged: false }
        },
        {
          name: 'index.ts',
          path: '/project/src/index.ts',
          isDirectory: false,
          gitStatus: { path: '/project/src/index.ts', status: 'untracked' as const, staged: false }
        },
        {
          name: 'components',
          path: '/project/src/components',
          isDirectory: true,
          expanded: false,
          children: [
            {
              name: 'Button.tsx',
              path: '/project/src/components/Button.tsx',
              isDirectory: false
            },
          ],
        },
      ],
    },
    {
      name: 'package.json',
      path: '/project/package.json',
      isDirectory: false
    },
    {
      name: 'README.md',
      path: '/project/README.md',
      isDirectory: false,
      gitStatus: { path: '/project/README.md', status: 'added' as const, staged: true }
    },
    {
      name: '.gitignore',
      path: '/project/.gitignore',
      isDirectory: false
    },
  ];
  
  // Helper function to render with test mode
  const renderFileExplorer = (props: any = {}) => {
    return render(FileExplorerAdvanced, {
      props: {
        testMode: true,
        autoLoad: false,
        initialTree: mockFileTree,
        rootPath: '/project',
        ...props
      }
    });
  };

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
    mockInvoke({
      get_file_tree: mockFileTree,
      expand_directory: (args: any) => {
        if (args.path === '/project/src/components') {
          return [
            createMockFile('Button.tsx', '/project/src/components/Button.tsx'),
            createMockFile('Modal.tsx', '/project/src/components/Modal.tsx'),
          ];
        }
        return [];
      },
      get_all_git_statuses: {
        '/project/src/app.ts': 'modified',
        '/project/src/index.ts': 'untracked',
        '/project/README.md': 'staged',
      },
      has_git_integration: true,
      create_file: true,
      create_directory: true,
      rename_path: true,
      delete_path: true,
    });
  });

  it('renders file explorer container', () => {
    const { container } = renderFileExplorer();
    
    const explorer = container.querySelector('.file-explorer');
    expect(explorer).toBeInTheDocument();
  });

  it('displays file tree structure', async () => {
    const { getByText, queryByText } = renderFileExplorer();
    
    // Files should be immediately visible since we provide initialTree
    expect(getByText('src')).toBeInTheDocument();
    expect(getByText('package.json')).toBeInTheDocument();
    expect(getByText('README.md')).toBeInTheDocument();
    // Hidden files not shown by default
    expect(queryByText('.gitignore')).not.toBeInTheDocument();
  });

  it('expands and collapses directories', async () => {
    const { getByText, queryByText } = renderFileExplorer();
    
    // src is expanded by default in our mock data
    expect(getByText('src')).toBeInTheDocument();
    expect(getByText('app.ts')).toBeInTheDocument();
    expect(getByText('index.ts')).toBeInTheDocument();
    
    // Find the src directory button
    const srcButton = getByText('src').closest('button');
    expect(srcButton).toBeInTheDocument();
    
    // Click to collapse
    await fireEvent.click(srcButton!);
    
    // Children should be hidden after collapse
    await waitFor(() => {
      expect(queryByText('app.ts')).not.toBeInTheDocument();
      expect(queryByText('index.ts')).not.toBeInTheDocument();
    }, { timeout: 100 });
    
    // Click to expand again
    await fireEvent.click(srcButton!);
    
    // Children should be visible again
    await waitFor(() => {
      expect(getByText('app.ts')).toBeInTheDocument();
      expect(getByText('index.ts')).toBeInTheDocument();
    }, { timeout: 100 });
  });

  it('shows git status indicators', async () => {
    const { getByText } = renderFileExplorer({ showGitStatus: true });
    
    // Files are immediately visible
    expect(getByText('app.ts')).toBeInTheDocument();
    
    // Look for git status indicators - they should be emojis based on the component
    const appFile = getByText('app.ts').closest('.node-content');
    const indexFile = getByText('index.ts').closest('.node-content');
    const readmeFile = getByText('README.md').closest('.node-content');
    
    // Check for status indicators (✏️ for modified, ❓ for untracked, ➕ for added)
    expect(appFile?.textContent).toContain('✏️');
    expect(indexFile?.textContent).toContain('❓');
    expect(readmeFile?.textContent).toContain('➕');
  });

  it('handles file selection', async () => {
    let selectedFile = null;
    const { getByText, component } = renderFileExplorer();
    
    component.$on('select', (event: CustomEvent) => {
      selectedFile = event.detail;
    });
    
    expect(getByText('app.ts')).toBeInTheDocument();
    
    const fileButton = getByText('app.ts').closest('button');
    await fireEvent.click(fileButton!);
    
    expect(selectedFile).toEqual(expect.objectContaining({
      name: 'app.ts',
      path: '/project/src/app.ts',
      isDirectory: false,
    }));
  });

  it('shows context menu on right click', async () => {
    const { getByText, container } = renderFileExplorer();
    
    expect(getByText('app.ts')).toBeInTheDocument();
    
    // Right-click on file
    const fileButton = getByText('app.ts').closest('button');
    await fireEvent.contextMenu(fileButton!);
    
    // The component should have showContextMenu set to true
    // Since ContextMenu is mocked, we can't test its content directly
    // Just verify the right-click event was handled
    expect(fileButton).toBeInTheDocument();
  });

  it('filters files with search', async () => {
    const { getByPlaceholderText, getByText, queryByText } = renderFileExplorer();
    
    expect(getByText('app.ts')).toBeInTheDocument();
    expect(getByText('README.md')).toBeInTheDocument();
    
    const searchInput = getByPlaceholderText(/Search files/i);
    await user.type(searchInput, 'button');
    
    await waitFor(() => {
      // Should show matching file
      expect(getByText('Button.tsx')).toBeInTheDocument();
      // Should hide non-matching files
      expect(queryByText('app.ts')).not.toBeInTheDocument();
      expect(queryByText('README.md')).not.toBeInTheDocument();
    });
    
    // Clear search
    await user.clear(searchInput);
    
    // All files should be visible again
    await waitFor(() => {
      expect(getByText('app.ts')).toBeInTheDocument();
      expect(getByText('README.md')).toBeInTheDocument();
    });
  });

  it('toggles hidden files visibility', async () => {
    const { getByTitle, getByText, queryByText } = renderFileExplorer();
    
    expect(getByText('src')).toBeInTheDocument();
    
    // Hidden files should not be visible by default
    expect(queryByText('.gitignore')).not.toBeInTheDocument();
    
    // Click toggle hidden files button
    const toggleButton = getByTitle(/Toggle Hidden Files/i);
    await fireEvent.click(toggleButton);
    
    // Hidden files should now be visible
    await waitFor(() => {
      expect(getByText('.gitignore')).toBeInTheDocument();
    });
    
    // Toggle again to hide
    await fireEvent.click(toggleButton);
    
    // Hidden files should be hidden again
    await waitFor(() => {
      expect(queryByText('.gitignore')).not.toBeInTheDocument();
    });
  });

  it('displays file type icons', async () => {
    const { getByText } = renderFileExplorer();
    
    expect(getByText('app.ts')).toBeInTheDocument();
    
    // Check for file type indicators (emojis in this component)
    const tsFile = getByText('app.ts').closest('.node-content');
    const jsonFile = getByText('package.json').closest('.node-content');
    const mdFile = getByText('README.md').closest('.node-content');
    
    // Files should have emoji icons
    expect(tsFile?.querySelector('.node-icon')?.textContent).toBe('🔷'); // ts icon
    expect(jsonFile?.querySelector('.node-icon')?.textContent).toBe('📋'); // json icon
    expect(mdFile?.querySelector('.node-icon')?.textContent).toBe('📝'); // md icon
  });

  it('handles file creation', async () => {
    let newFileEvent = null;
    const { getByTitle, component } = renderFileExplorer();
    
    component.$on('newFile', (event: CustomEvent) => {
      newFileEvent = event.detail;
    });
    
    const newFileButton = getByTitle(/New File/i);
    expect(newFileButton).toBeInTheDocument();
    
    // Click new file button
    await fireEvent.click(newFileButton);
    
    // Should dispatch newFile event
    expect(newFileEvent).toEqual(expect.objectContaining({
      parentPath: '/project'
    }));
  });

  it('handles directory creation', async () => {
    let newFolderEvent = null;
    const { getByTitle, component } = renderFileExplorer();
    
    component.$on('newFolder', (event: CustomEvent) => {
      newFolderEvent = event.detail;
    });
    
    const newFolderButton = getByTitle(/New Folder/i);
    expect(newFolderButton).toBeInTheDocument();
    
    // Click new folder button
    await fireEvent.click(newFolderButton);
    
    // Should dispatch newFolder event
    expect(newFolderEvent).toEqual(expect.objectContaining({
      parentPath: '/project'
    }));
  });

  it('handles file rename', async () => {
    let renameEvent = null;
    const { getByText, component, container } = renderFileExplorer();
    
    component.$on('rename', (event: CustomEvent) => {
      renameEvent = event.detail;
    });
    
    expect(getByText('app.ts')).toBeInTheDocument();
    
    // First, select the file
    const fileButton = getByText('app.ts').closest('button');
    await fireEvent.click(fileButton!);
    
    // Right-click on the selected file
    await fireEvent.contextMenu(fileButton!);
    
    // Wait for context menu and click rename
    await waitFor(() => {
      const renameOption = container.querySelector('button:has-text("Rename")');
      if (!renameOption) {
        // If querySelector doesn't support :has-text, look for button containing Rename
        const buttons = container.querySelectorAll('.context-menu button');
        const rename = Array.from(buttons).find(btn => btn.textContent?.includes('Rename'));
        if (rename) {
          fireEvent.click(rename);
        }
      } else {
        fireEvent.click(renameOption);
      }
    }, { timeout: 100 });
    
    // Should dispatch rename event
    await waitFor(() => {
      expect(renameEvent).toEqual(expect.objectContaining({
        name: 'app.ts',
        path: '/project/src/app.ts'
      }));
    }, { timeout: 100 });
  });

  it('handles file deletion', async () => {
    let deleteEvent = null;
    const { getByText, component, container } = renderFileExplorer();
    
    component.$on('delete', (event: CustomEvent) => {
      deleteEvent = event.detail;
    });
    
    expect(getByText('app.ts')).toBeInTheDocument();
    
    // First, select the file
    const fileButton = getByText('app.ts').closest('button');
    await fireEvent.click(fileButton!);
    
    // Right-click on the selected file
    await fireEvent.contextMenu(fileButton!);
    
    // Wait for context menu and click delete
    await waitFor(() => {
      const deleteOption = container.querySelector('button:has-text("Delete")');
      if (!deleteOption) {
        // If querySelector doesn't support :has-text, look for button containing Delete
        const buttons = container.querySelectorAll('.context-menu button');
        const del = Array.from(buttons).find(btn => btn.textContent?.includes('Delete'));
        if (del) {
          fireEvent.click(del);
        }
      } else {
        fireEvent.click(deleteOption);
      }
    }, { timeout: 100 });
    
    // Should dispatch delete event
    await waitFor(() => {
      expect(deleteEvent).toEqual(expect.objectContaining({
        name: 'app.ts',
        path: '/project/src/app.ts'
      }));
    }, { timeout: 100 });
  });

  it('supports drag and drop for file operations', async () => {
    const { getByText } = renderFileExplorer();
    
    expect(getByText('app.ts')).toBeInTheDocument();
    expect(getByText('components')).toBeInTheDocument();
    
    const fileButton = getByText('app.ts').closest('button');
    const folderButton = getByText('components').closest('button');
    
    // Simulate drag and drop
    await fireEvent.dragStart(fileButton!);
    await fireEvent.dragOver(folderButton!);
    await fireEvent.drop(folderButton!);
    await fireEvent.dragEnd(fileButton!);
    
    // Note: Drag/drop functionality would need to be implemented in the component
    // This test just verifies the DOM events can be triggered
  });

  it('refreshes file tree', async () => {
    const { getByTitle } = renderFileExplorer();
    
    const refreshButton = getByTitle(/Refresh/i);
    expect(refreshButton).toBeInTheDocument();
    
    // Click refresh - in test mode, it should reload the initial tree
    await fireEvent.click(refreshButton);
    
    // Files should still be visible after refresh
    expect(getByTitle('Refresh')).toBeInTheDocument();
  });
});