import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import TestDialog from './TestDialog.svelte';

describe('TestDialog', () => {
  it('should log and render based on show prop', () => {
    const { getByTestId, getByText } = render(TestDialog, {
      props: { show: true, title: 'Test Title' }
    });
    
    expect(getByTestId('test-dialog-root')).toBeInTheDocument();
    expect(getByText('Show value: true')).toBeInTheDocument();
    expect(getByTestId('test-dialog')).toBeInTheDocument();
  });
  
  it('should show not-shown message when show is false', () => {
    const { getByTestId, getByText } = render(TestDialog, {
      props: { show: false, title: 'Test Title' }
    });
    
    expect(getByTestId('test-dialog-root')).toBeInTheDocument();
    expect(getByText('Show value: false')).toBeInTheDocument();
    expect(getByTestId('not-shown')).toBeInTheDocument();
  });
});