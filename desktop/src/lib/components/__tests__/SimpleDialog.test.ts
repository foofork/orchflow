import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/svelte/vitest';
import { tick } from 'svelte';
import Dialog from '../Dialog.svelte';

describe('Simple Dialog Test', () => {
  let cleanup: Array<() => void> = [];

  afterEach(() => {
    cleanup.forEach(fn => fn());
    cleanup = [];
    vi.clearAllMocks();
  });

  it('should render when show is true', async () => {
    console.log('Starting simple dialog test...');
    
    const { container, debug, unmount } = render(Dialog, {
      props: { 
        show: true, 
        title: 'Test Dialog'
      }
    });
    
    cleanup.push(unmount);
    
    // Debug output
    console.log('Container HTML:', container.innerHTML);
    debug();
    
    // Check if anything rendered
    const hasContent = container.innerHTML.length > 0;
    console.log('Has content:', hasContent);
    
    // Try different selectors
    const dialogByClass = container.querySelector('.dialog');
    const dialogByTestId = container.querySelector('[data-testid="dialog"]');
    const anyDiv = container.querySelector('div');
    
    console.log('Dialog by class:', !!dialogByClass);
    console.log('Dialog by test id:', !!dialogByTestId);
    console.log('Any div:', !!anyDiv);
    
    // Just check if something rendered
    expect(hasContent).toBe(true);
  });

  it('should not render when show is false', () => {
    const { container, unmount } = render(Dialog, {
      props: { 
        show: false, 
        title: 'Test Dialog'
      }
    });
    
    cleanup.push(unmount);
    
    expect(container.innerHTML).toBe('');
  });
});