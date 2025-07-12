import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import LazyComponent from './LazyComponent.svelte';
import TestHelpers from './TestHelpers.svelte';
import { createAsyncMock, createTypedMock } from '@/test/mock-factory';

describe('LazyComponent', () => {
  let consoleErrorSpy: any;
  let cleanup: Array<() => void> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup = [];
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup.forEach(fn => fn());
    cleanup = [];
    consoleErrorSpy.mockRestore();
  });

  it('should display loading state initially', () => {
    const loader = createAsyncMock(() => new Promise(() => {})); // Never resolves
    const { unmount } = render(LazyComponent, { props: { loader } });
    cleanup.push(unmount);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(document.querySelector('.lazy-loading')).toBeInTheDocument();
    expect(document.querySelector('.spinner')).toBeInTheDocument();
  });

  it('should display custom placeholder text', () => {
    const loader = createAsyncMock(() => new Promise(() => {}));
    const placeholder = 'Please wait...';
    const { unmount } = render(LazyComponent, { props: { loader, placeholder } });
    cleanup.push(unmount);

    expect(screen.getByText(placeholder)).toBeInTheDocument();
  });

  it('should load and display the component successfully', async () => {
    const loader = createAsyncMock(async () => ({ default: TestHelpers }));
    const testProps = { name: 'Test', value: 42 };
    
    const { unmount } = render(LazyComponent, { props: { loader, props: testProps } });
    cleanup.push(unmount);

    // Initially shows loading
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Wait for component to load
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Component should be loaded
    expect(loader).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Name: Test, Value: 42')).toBeInTheDocument();
  });

  it('should handle loading errors gracefully', async () => {
    const errorMessage = 'Failed to import module';
    const loader = createAsyncMock(async () => {
      throw new Error(errorMessage);
    });

    const { unmount } = render(LazyComponent, { props: { loader } });
    cleanup.push(unmount);

    // Initially shows loading
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Wait for error
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Should display error
    expect(screen.getByText('Failed to load component')).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(document.querySelector('.lazy-error')).toBeInTheDocument();
    
    // Should log error to console
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to load component:',
      expect.any(Error)
    );
  });

  it('should handle null/undefined module gracefully', async () => {
    const loader = createAsyncMock(async () => ({ default: null }));
    
    const { unmount } = render(LazyComponent, { props: { loader } });
    cleanup.push(unmount);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Should not render anything if component is null
    expect(document.querySelector('.lazy-loading')).not.toBeInTheDocument();
    expect(document.querySelector('.lazy-error')).not.toBeInTheDocument();
  });

  it('should handle immediate resolution', async () => {
    const loader = createAsyncMock(() => Promise.resolve({ default: TestHelpers }));
    
    const { unmount } = render(LazyComponent, { props: { loader, props: { name: 'Quick', value: 100 } } });
    cleanup.push(unmount);

    // Should still show loading initially
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Then load component
    await waitFor(() => {
      expect(screen.getByText('Name: Quick, Value: 100')).toBeInTheDocument();
    });
  });

  it('should work with empty props object by default', async () => {
    const loader = createAsyncMock(async () => ({ default: TestHelpers }));
    
    // Don't pass props at all
    const { unmount } = render(LazyComponent, { props: { loader } });
    cleanup.push(unmount);

    await waitFor(() => {
      expect(screen.getByText('Name: , Value: 0')).toBeInTheDocument();
    });

    // Should work fine without props
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('should handle loader rejection with non-Error objects', async () => {
    const loader = createAsyncMock(async () => {
      throw 'String error';
    });

    const { unmount } = render(LazyComponent, { props: { loader } });
    cleanup.push(unmount);

    await waitFor(() => {
      expect(screen.getByText('Failed to load component')).toBeInTheDocument();
    });

    // Should still display error even if not Error instance
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to load component:',
      'String error'
    );
  });

  it('should use error message for non-Error objects', async () => {
    const loader = createAsyncMock(async () => {
      throw { message: 'Custom error message' };
    });

    const { unmount } = render(LazyComponent, { props: { loader } });
    cleanup.push(unmount);

    await waitFor(() => {
      expect(screen.getByText('Failed to load component')).toBeInTheDocument();
      expect(screen.getByText('Custom error message')).toBeInTheDocument();
    });
  });

  it('should display placeholder when thrown error is not an Error instance without message', async () => {
    const loader = createAsyncMock(async () => {
      throw { someOtherProp: 'not a message' };
    });

    const { unmount } = render(LazyComponent, { props: { loader } });
    cleanup.push(unmount);

    await waitFor(() => {
      expect(screen.getByText('Failed to load component')).toBeInTheDocument();
    });

    // Should show the stringified error
    const errorText = document.querySelector('.lazy-error small')?.textContent;
    expect(errorText).toBeTruthy();
  });
});