import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTypedMock, createAsyncMock, createSyncMock } from '@/test/mock-factory';
import UpdateNotification from './UpdateNotification.svelte';

// Cleanup array for proper test cleanup
let cleanup: Array<() => void> = [];

// Mock Tauri APIs
const mockInvoke = createAsyncMock<[cmd: string, args?: any], any>();
const mockListen = createAsyncMock<[event: string, handler: Function], () => void>();

// Mock the Tauri modules
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: mockListen
}));

describe('UpdateNotification', () => {
  beforeEach(() => {
    cleanup = [];
    
    // Setup default mock behaviors
    mockInvoke.mockResolvedValue('1.0.0'); // Default version
    mockListen.mockResolvedValue(() => {}); // Default unlisten function
  });

  afterEach(() => {
    cleanup.forEach(fn => fn());
    vi.clearAllMocks();
  });

  it('should render without crashing', async () => {
    const { unmount } = render(UpdateNotification);
    cleanup.push(unmount);
    
    // Component should render without errors
    expect(document.body).toBeTruthy();
  });

  it('should not show notification initially', async () => {
    const { unmount } = render(UpdateNotification);
    cleanup.push(unmount);
    
    // Should not show update notification by default
    const notification = document.querySelector('.update-notification');
    expect(notification).toBeNull();
  });

  it('should call get_current_version on mount', async () => {
    const { unmount } = render(UpdateNotification);
    cleanup.push(unmount);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_current_version');
    });
  });

  it('should setup event listeners on mount', async () => {
    const { unmount } = render(UpdateNotification);
    cleanup.push(unmount);
    
    await waitFor(() => {
      expect(mockListen).toHaveBeenCalledWith('update-available', expect.any(Function));
      expect(mockListen).toHaveBeenCalledWith('update-progress', expect.any(Function));
      expect(mockListen).toHaveBeenCalledWith('update-downloaded', expect.any(Function));
      expect(mockListen).toHaveBeenCalledWith('update-error', expect.any(Function));
    });
  });

  it('should check for updates on mount', async () => {
    const { unmount } = render(UpdateNotification);
    cleanup.push(unmount);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('check_for_update');
    });
  });

  it('should show notification when update is available', async () => {
    let updateAvailableHandler: Function;
    
    mockListen.mockImplementation((event: string, handler: Function) => {
      if (event === 'update-available') {
        updateAvailableHandler = handler;
      }
      return Promise.resolve(() => {});
    });
    
    const { unmount, component } = render(UpdateNotification);
    cleanup.push(unmount);
    
    // Wait for component to mount and setup listeners
    await waitFor(() => {
      expect(mockListen).toHaveBeenCalledWith('update-available', expect.any(Function));
    });
    
    // Simulate update available event
    const updateStatus = {
      available: true,
      version: '2.0.0',
      notes: 'New features and bug fixes',
      pub_date: '2024-01-01'
    };
    
    updateAvailableHandler(createEventMock('update-available', { payload: updateStatus }));
    
    await waitFor(() => {
      const notification = document.querySelector('.update-notification');
      expect(notification).toBeTruthy();
    });
  });

  it('should handle download button click', async () => {
    let updateAvailableHandler: Function;
    
    mockListen.mockImplementation((event: string, handler: Function) => {
      if (event === 'update-available') {
        updateAvailableHandler = handler;
      }
      return Promise.resolve(() => {});
    });
    
    const { unmount } = render(UpdateNotification);
    cleanup.push(unmount);
    
    // Wait for component to mount
    await waitFor(() => {
      expect(mockListen).toHaveBeenCalledWith('update-available', expect.any(Function));
    });
    
    // Trigger update available
    const updateStatus = {
      available: true,
      version: '2.0.0',
      notes: 'New features'
    };
    
    updateAvailableHandler(createEventMock('update-available', { payload: updateStatus }));
    
    await waitFor(() => {
      const downloadBtn = document.querySelector('.update-btn.primary');
      expect(downloadBtn).toBeTruthy();
    });
    
    // Click download button
    const downloadBtn = document.querySelector('.update-btn.primary') as HTMLElement;
    fireEvent.click(downloadBtn);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('download_and_install_update');
    });
  });

  it('should handle close button click', async () => {
    let updateAvailableHandler: Function;
    
    mockListen.mockImplementation((event: string, handler: Function) => {
      if (event === 'update-available') {
        updateAvailableHandler = handler;
      }
      return Promise.resolve(() => {});
    });
    
    const { unmount } = render(UpdateNotification);
    cleanup.push(unmount);
    
    // Wait for setup
    await waitFor(() => {
      expect(mockListen).toHaveBeenCalledWith('update-available', expect.any(Function));
    });
    
    // Trigger update available
    updateAvailableHandler(createEventMock('update-available', { 
      payload: { available: true, version: '2.0.0' }
    }));
    
    await waitFor(() => {
      const closeBtn = document.querySelector('.close-btn');
      expect(closeBtn).toBeTruthy();
    });
    
    // Click close button
    const closeBtn = document.querySelector('.close-btn') as HTMLElement;
    fireEvent.click(closeBtn);
    
    await waitFor(() => {
      const notification = document.querySelector('.update-notification');
      expect(notification).toBeNull();
    });
  });

  it('should display version information correctly', async () => {
    let updateAvailableHandler: Function;
    
    mockInvoke.mockResolvedValueOnce('1.0.0'); // Current version
    mockListen.mockImplementation((event: string, handler: Function) => {
      if (event === 'update-available') {
        updateAvailableHandler = handler;
      }
      return Promise.resolve(() => {});
    });
    
    const { unmount } = render(UpdateNotification);
    cleanup.push(unmount);
    
    await waitFor(() => {
      expect(mockListen).toHaveBeenCalledWith('update-available', expect.any(Function));
    });
    
    // Trigger update with version info
    updateAvailableHandler(createEventMock('update-available', {
      payload: {
        available: true,
        version: '2.0.0',
        pub_date: '2024-01-01'
      }
    }));
    
    await waitFor(() => {
      const versionInfo = document.querySelector('.version-info');
      expect(versionInfo?.textContent).toContain('Version 2.0.0 is available');
      expect(versionInfo?.textContent).toContain('(current: 1.0.0)');
    });
  });

  it('should show progress during download', async () => {
    let updateAvailableHandler: Function;
    let progressHandler: Function;
    
    mockListen.mockImplementation((event: string, handler: Function) => {
      if (event === 'update-available') {
        updateAvailableHandler = handler;
      } else if (event === 'update-progress') {
        progressHandler = handler;
      }
      return Promise.resolve(() => {});
    });
    
    const { unmount } = render(UpdateNotification);
    cleanup.push(unmount);
    
    await waitFor(() => {
      expect(mockListen).toHaveBeenCalledWith('update-progress', expect.any(Function));
    });
    
    // Show update notification
    updateAvailableHandler(createEventMock('update-available', {
      payload: { available: true, version: '2.0.0' }
    }));
    
    // Start download
    const downloadBtn = await waitFor(() => {
      const btn = document.querySelector('.update-btn.primary') as HTMLElement;
      expect(btn).toBeTruthy();
      return btn;
    });
    
    fireEvent.click(downloadBtn);
    
    // Simulate progress update
    progressHandler(createEventMock('update-progress', {
      payload: { downloaded: 50, total: 100, percentage: 50 }
    }));
    
    await waitFor(() => {
      const progressText = document.querySelector('.progress-text');
      expect(progressText?.textContent).toBe('50%');
    });
  });

  it('should handle download errors', async () => {
    let updateAvailableHandler: Function;
    let errorHandler: Function;
    
    mockListen.mockImplementation((event: string, handler: Function) => {
      if (event === 'update-available') {
        updateAvailableHandler = handler;
      } else if (event === 'update-error') {
        errorHandler = handler;
      }
      return Promise.resolve(() => {});
    });
    
    const { unmount } = render(UpdateNotification);
    cleanup.push(unmount);
    
    await waitFor(() => {
      expect(mockListen).toHaveBeenCalledWith('update-error', expect.any(Function));
    });
    
    // Show update notification
    updateAvailableHandler(createEventMock('update-available', {
      payload: { available: true, version: '2.0.0' }
    }));
    
    // Simulate error
    errorHandler(createEventMock('update-error', {
      payload: 'Download failed'
    }));
    
    await waitFor(() => {
      const errorMessage = document.querySelector('.error-message');
      expect(errorMessage?.textContent).toContain('Download failed');
    });
  });
});

// Helper function to create mock event objects
function createEventMock(type: string, properties: any = {}) {
  return {
    type,
    ...properties
  };
}