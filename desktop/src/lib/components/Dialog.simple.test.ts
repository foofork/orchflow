import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
// Direct import to bypass any mocking issues
import Dialog from './Dialog.svelte';

describe('Dialog Simple Test', () => {
  it('should render when show is true - no async', () => {
    const result = render(Dialog, {
      props: { 
        show: true, 
        title: 'Test Dialog',
        testMode: true // Disable focus management
      }
    });
    
    // Check the raw HTML
    console.log('HTML:', result.container.innerHTML);
    
    // Check if anything exists
    const anyElement = result.container.querySelector('*');
    console.log('Any element found:', anyElement);
    
    // Try to find by class instead of data-testid
    const backdrop = result.container.querySelector('.dialog-backdrop');
    console.log('Backdrop found:', backdrop);
    
    expect(result.container.innerHTML).not.toBe('');
  });
  
  it('component instance check', async () => {
    const result = render(Dialog, {
      props: { show: false, title: 'Test' }
    });
    
    console.log('Component:', result.component);
    console.log('Component type:', typeof result.component);
    
    // In Svelte 5, use rerender to update props
    expect(result.container.querySelector('.dialog-backdrop')).not.toBeInTheDocument();
    
    // Update props using rerender
    await result.rerender({ show: true, title: 'Updated Test' });
    console.log('After rerender - HTML:', result.container.innerHTML);
    
    // Now dialog should be visible
    expect(result.container.querySelector('.dialog-backdrop')).toBeInTheDocument();
  });
});