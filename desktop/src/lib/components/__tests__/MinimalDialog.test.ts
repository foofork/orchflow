import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import MinimalDialog from './MinimalDialog.svelte';

describe('MinimalDialog', () => {
  it('should render when show is true', () => {
    const { queryByTestId } = render(MinimalDialog, {
      props: { show: true, title: 'Test Title' }
    });
    
    const dialog = queryByTestId('dialog');
    expect(dialog).toBeTruthy();
  });
  
  it('should not render when show is false', () => {
    const { queryByTestId } = render(MinimalDialog, {
      props: { show: false, title: 'Test Title' }
    });
    
    const dialog = queryByTestId('dialog');
    expect(dialog).toBeFalsy();
  });
});