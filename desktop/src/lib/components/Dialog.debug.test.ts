import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Dialog from './Dialog.svelte';

describe('Dialog Debug', () => {
  it('should render something when show is true', () => {
    const { container, debug } = render(Dialog, {
      props: { show: true, title: 'Test' }
    });
    
    // Debug output to see what's actually rendered
    debug();
    
    // Check if anything is rendered
    expect(container.innerHTML).not.toBe('');
    expect(container.querySelector('*')).toBeTruthy();
  });
  
  it('should render with minimal props', () => {
    const { container } = render(Dialog, {
      props: { show: true }
    });
    
    console.log('Container HTML:', container.innerHTML);
    expect(container.innerHTML).toContain('dialog');
  });
});