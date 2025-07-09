import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import StatusBarEnhanced from '../StatusBarEnhanced.svelte';

/**
 * Example of properly isolated unit test
 * Tests only the component logic without environment dependencies
 */
describe('StatusBarEnhanced - Simple Unit Test', () => {
  it('renders and displays basic information', () => {
    const { getByText, container } = render(StatusBarEnhanced, {
      props: {
        currentFile: { path: '/src/main.ts', line: 10, column: 5 },
        encoding: 'UTF-8',
        language: 'TypeScript',
      }
    });
    
    // Test basic rendering
    expect(container.querySelector('.status-bar')).toBeInTheDocument();
    expect(getByText(/main\.ts/)).toBeInTheDocument();
    expect(getByText(/Ln 10, Col 5/)).toBeInTheDocument();
    expect(getByText(/UTF-8/)).toBeInTheDocument();
    expect(getByText(/TypeScript/)).toBeInTheDocument();
  });

  it('handles click events', async () => {
    const { getByText, component } = render(StatusBarEnhanced, {
      props: {
        currentFile: { path: '/src/main.ts', line: 1, column: 1 },
        encoding: 'UTF-8',
      }
    });
    
    const handleAction = vi.fn();
    component.$on('action', handleAction);
    
    // Click on file info
    await getByText(/main\.ts/).click();
    expect(handleAction).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          type: 'revealInExplorer',
          path: '/src/main.ts'
        })
      })
    );
  });

  it('shows counts when provided', () => {
    const { getByText } = render(StatusBarEnhanced, {
      props: {
        runningProcesses: 3,
        activePlugins: 5,
        notifications: [
          { id: '1', message: 'Test notification', type: 'info' }
        ],
        showNotifications: true
      }
    });
    
    expect(getByText('3 running')).toBeInTheDocument();
    expect(getByText('5 plugins')).toBeInTheDocument();
    expect(getByText('🔔 1')).toBeInTheDocument();
  });
});