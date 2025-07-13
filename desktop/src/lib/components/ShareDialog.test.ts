import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import ShareDialog from './ShareDialog.svelte';
import { createTypedMock, createAsyncMock } from '@/test/mock-factory';
import { mockSvelteEvents } from '@/test/svelte5-event-helper';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
// Mock Tauri APIs with proper factory functions
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn()
}));

describe('ShareDialog', () => {
  let cleanup: Array<() => void> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup = [];
  });

  afterEach(() => {
    cleanup.forEach(fn => fn());
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when show is false', () => {
      const { container, unmount } = render(ShareDialog, {
        props: { show: false }
      });
      cleanup.push(unmount);
      
      const dialog = container.querySelector('.share-dialog-overlay');
      expect(dialog).toBeFalsy();
    });

    it('should render when show is true', () => {
      const { container, unmount } = render(ShareDialog, {
        props: { show: true }
      });
      cleanup.push(unmount);
      
      const dialog = container.querySelector('.share-dialog-overlay');
      expect(dialog).toBeTruthy();
    });

    it('should render create mode by default', () => {
      const { getByText, unmount } = render(ShareDialog, {
        props: { show: true }
      });
      cleanup.push(unmount);
      
      expect(getByText('Create Share Package')).toBeTruthy();
    });

    it('should render import mode when specified', () => {
      const { getByText, unmount } = render(ShareDialog, {
        props: { show: true, mode: 'import' }
      });
      cleanup.push(unmount);
      
      expect(getByText('Import Share Package')).toBeTruthy();
    });
  });

  describe('Create Mode', () => {
    it('should render create form fields', () => {
      const { container, unmount } = render(ShareDialog, {
        props: { show: true, mode: 'create' }
      });
      cleanup.push(unmount);
      
      const nameInput = container.querySelector('input[placeholder*="Package name"]');
      const descriptionTextarea = container.querySelector('textarea[placeholder*="Description"]');
      
      expect(nameInput).toBeTruthy();
      expect(descriptionTextarea).toBeTruthy();
    });

    it('should allow selecting files', async () => {
      vi.mocked(open).mockResolvedValue(['file1.txt', 'file2.js']);
      
      const { getByText, container, unmount } = render(ShareDialog, {
        props: { show: true, mode: 'create' }
      });
      cleanup.push(unmount);
      
      const selectButton = getByText('Add Files');
      await fireEvent.click(selectButton);
      
      await waitFor(() => {
        expect(vi.mocked(open)).toHaveBeenCalledWith({
          multiple: true,
          title: 'Select files to share'
        });
      });
      
      await waitFor(() => {
        const fileItems = container.querySelectorAll('.file-item');
        expect(fileItems.length).toBe(2);
      });
    });

    it('should handle single file selection', async () => {
      vi.mocked(open).mockResolvedValue('single-file.txt');
      
      const { getByText, container, unmount } = render(ShareDialog, {
        props: { show: true, mode: 'create' }
      });
      cleanup.push(unmount);
      
      const selectButton = getByText('Add Files');
      await fireEvent.click(selectButton);
      
      await waitFor(() => {
        const fileItems = container.querySelectorAll('.file-item');
        expect(fileItems.length).toBe(1);
      });
    });

    it('should remove files from selection', async () => {
      vi.mocked(open).mockResolvedValue(['file1.txt', 'file2.js']);
      
      const { getByText, container, unmount } = render(ShareDialog, {
        props: { show: true, mode: 'create' }
      });
      cleanup.push(unmount);
      
      const selectButton = getByText('Add Files');
      await fireEvent.click(selectButton);
      
      await waitFor(() => {
        const fileItems = container.querySelectorAll('.file-item');
        expect(fileItems.length).toBe(2);
      });
      
      // Click remove button on first file
      const removeButtons = container.querySelectorAll('.remove-file');
      await fireEvent.click(removeButtons[0]);
      
      await waitFor(() => {
        const fileItems = container.querySelectorAll('.file-item');
        expect(fileItems.length).toBe(1);
      });
    });

    it('should create package with valid data', async () => {
      vi.mocked(open).mockResolvedValue(['file1.txt']);
      vi.mocked(invoke).mockResolvedValue({ success: true, path: '/tmp/package.share' });
      
      const { getByText, container, unmount } = render(ShareDialog, {
        props: { show: true, mode: 'create' }
      });
      cleanup.push(unmount);
      
      // Fill in form
      const nameInput = container.querySelector('input[placeholder*="Package name"]') as HTMLInputElement;
      const descriptionTextarea = container.querySelector('textarea[placeholder*="Description"]') as HTMLTextAreaElement;
      
      await fireEvent.input(nameInput, { target: { value: 'My Package' } });
      await fireEvent.input(descriptionTextarea, { target: { value: 'Test description' } });
      
      // Select files
      const selectButton = getByText('Add Files');
      await fireEvent.click(selectButton);
      
      await waitFor(() => {
        const fileItems = container.querySelectorAll('.file-item');
        expect(fileItems.length).toBe(1);
      });
      
      // Create package
      const createButton = getByText('Create Package');
      await fireEvent.click(createButton);
      
      await waitFor(() => {
        expect(vi.mocked(invoke)).toHaveBeenCalledWith('create_share_package', {
          name: 'My Package',
          description: 'Test description',
          files: ['file1.txt']
        });
      });
    });

    it('should show error when creating without name or files', async () => {
      const { getByText, container, unmount } = render(ShareDialog, {
        props: { show: true, mode: 'create' }
      });
      cleanup.push(unmount);
      
      const createButton = getByText('Create Package');
      await fireEvent.click(createButton);
      
      await waitFor(() => {
        const error = container.querySelector('.error');
        expect(error?.textContent).toContain('Please provide a name and select files');
      });
    });

    it('should handle create package error', async () => {
      vi.mocked(open).mockResolvedValue(['file1.txt']);
      vi.mocked(invoke).mockRejectedValue(new Error('Failed to create package'));
      
      const { getByText, container, unmount } = render(ShareDialog, {
        props: { show: true, mode: 'create' }
      });
      cleanup.push(unmount);
      
      // Fill in minimal data
      const nameInput = container.querySelector('input[placeholder*="Package name"]') as HTMLInputElement;
      await fireEvent.input(nameInput, { target: { value: 'My Package' } });
      
      // Select files
      const selectButton = getByText('Add Files');
      await fireEvent.click(selectButton);
      
      // Create package
      const createButton = getByText('Create Package');
      await fireEvent.click(createButton);
      
      await waitFor(() => {
        const error = container.querySelector('.error');
        expect(error?.textContent).toContain('Failed to create package');
      });
    });
  });

  describe('Import Mode', () => {
    it('should render import form fields', () => {
      const { container, unmount } = render(ShareDialog, {
        props: { show: true, mode: 'import' }
      });
      cleanup.push(unmount);
      
      const pathInput = container.querySelector('input[placeholder*="package path"]');
      const directoryInput = container.querySelector('input[placeholder*="target directory"]');
      
      expect(pathInput).toBeTruthy();
      expect(directoryInput).toBeTruthy();
    });

    it('should browse for package file', async () => {
      vi.mocked(open).mockResolvedValue('/path/to/package.share');
      
      const { getByText, container, unmount } = render(ShareDialog, {
        props: { show: true, mode: 'import' }
      });
      cleanup.push(unmount);
      
      const browseButton = getByText('Browse');
      await fireEvent.click(browseButton);
      
      await waitFor(() => {
        expect(vi.mocked(open)).toHaveBeenCalledWith({
          filters: [{
            name: 'Share Package',
            extensions: ['share']
          }],
          multiple: false
        });
      });
      
      const pathInput = container.querySelector('input[placeholder*="package path"]') as HTMLInputElement;
      expect(pathInput.value).toBe('/path/to/package.share');
    });

    it('should import package with valid data', async () => {
      vi.mocked(invoke).mockResolvedValue({ success: true });
      
      const { getByText, container, unmount } = render(ShareDialog, {
        props: { show: true, mode: 'import' }
      });
      cleanup.push(unmount);
      
      // Fill in form
      const pathInput = container.querySelector('input[placeholder*="package path"]') as HTMLInputElement;
      const directoryInput = container.querySelector('input[placeholder*="target directory"]') as HTMLInputElement;
      
      await fireEvent.input(pathInput, { target: { value: '/path/to/package.share' } });
      await fireEvent.input(directoryInput, { target: { value: '/home/user/project' } });
      
      // Import package
      const importButton = getByText('Import Package');
      await fireEvent.click(importButton);
      
      await waitFor(() => {
        expect(vi.mocked(invoke)).toHaveBeenCalledWith('import_share_package', {
          path: '/path/to/package.share',
          targetDirectory: '/home/user/project'
        });
      });
    });

    it('should show error when importing without path', async () => {
      const { getByText, container, unmount } = render(ShareDialog, {
        props: { show: true, mode: 'import' }
      });
      cleanup.push(unmount);
      
      const importButton = getByText('Import Package');
      await fireEvent.click(importButton);
      
      await waitFor(() => {
        const error = container.querySelector('.error');
        expect(error?.textContent).toContain('Please provide package path');
      });
    });
  });

  describe('Recent Packages', () => {
    it('should load recent packages on show', async () => {
      const mockPackages = [
        {
          id: '1',
          name: 'Package 1',
          description: 'Test package',
          created_at: '2024-01-01',
          author: 'Test User',
          version: '1.0.0',
          files: []
        }
      ];
      vi.mocked(invoke).mockResolvedValue(mockPackages);
      
      const { unmount } = render(ShareDialog, {
        props: { show: true }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(vi.mocked(invoke)).toHaveBeenCalledWith('list_share_packages');
      });
    });

    it('should handle recent packages load error', async () => {
      const consoleSpy = createTypedMock<(message: string, error: Error) => void>();
      vi.spyOn(console, 'error').mockImplementation(consoleSpy);
      vi.mocked(invoke).mockRejectedValue(new Error('Failed to load'));
      
      const { unmount } = render(ShareDialog, {
        props: { show: true }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to load recent packages:', expect.any(Error));
      });
      
      vi.restoreAllMocks();
    });
  });

  describe('Dialog Behavior', () => {
    it('should close on cancel button', async () => {
      const { getByText, component, unmount } = render(ShareDialog, {
        props: { show: true }
      });
      cleanup.push(unmount);
      
      const closeHandler = createTypedMock<() => void>();
      const mockComponent = mockSvelteEvents(component);
      mockComponent.$on('close', closeHandler);
      
      const cancelButton = getByText('Cancel');
      await fireEvent.click(cancelButton);
      
      expect(closeHandler).toHaveBeenCalled();
    });

    it('should close on overlay click', async () => {
      const { container, component, unmount } = render(ShareDialog, {
        props: { show: true }
      });
      cleanup.push(unmount);
      
      const closeHandler = createTypedMock<() => void>();
      const mockComponent = mockSvelteEvents(component);
      mockComponent.$on('close', closeHandler);
      
      const overlay = container.querySelector('.share-overlay');
      await fireEvent.click(overlay!);
      
      expect(closeHandler).toHaveBeenCalled();
    });

    it('should not close on dialog content click', async () => {
      const { container, component, unmount } = render(ShareDialog, {
        props: { show: true }
      });
      cleanup.push(unmount);
      
      const closeHandler = createTypedMock<() => void>();
      const mockComponent = mockSvelteEvents(component);
      mockComponent.$on('close', closeHandler);
      
      const dialog = container.querySelector('.share-dialog');
      await fireEvent.click(dialog!);
      
      expect(closeHandler).not.toHaveBeenCalled();
    });

    it('should disable buttons while loading', async () => {
      vi.mocked(open).mockResolvedValue(['file1.txt']);
      
      // Create a delayed promise to control loading state
      let resolvePromise: () => void;
      const delayedPromise = new Promise((resolve) => {
        resolvePromise = () => resolve({ success: true });
      });
      vi.mocked(invoke).mockReturnValue(delayedPromise);
      
      const { getByText, container, unmount } = render(ShareDialog, {
        props: { show: true, mode: 'create' }
      });
      cleanup.push(unmount);
      
      // Wait for component to be ready
      await waitFor(() => {
        const nameInput = container.querySelector('input[placeholder*="Package name"]');
        expect(nameInput).toBeTruthy();
      });
      
      // Setup minimal valid data
      const nameInput = container.querySelector('input[placeholder*="Package name"]') as HTMLInputElement;
      await fireEvent.input(nameInput, { target: { value: 'Test' } });
      
      // The button text is "Add Files" not "Add Files"
      const selectButton = container.querySelector('button.btn.secondary.small');
      if (selectButton) {
        await fireEvent.click(selectButton);
      }
      
      // Click create
      const createButton = getByText('Create Package') as HTMLButtonElement;
      await fireEvent.click(createButton);
      
      // Should be disabled while loading
      expect(createButton.disabled).toBe(true);
      
      // Resolve the promise
      resolvePromise!();
      await waitFor(() => {
        expect(createButton.disabled).toBe(false);
      });
    });
  });
});