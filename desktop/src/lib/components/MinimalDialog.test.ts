import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import MinimalDialog from './MinimalDialog.svelte';

describe('MinimalDialog', () => {
  it('should render when show is true', () => {
    const { getByTestId } = render(MinimalDialog, {
      props: { show: true, title: 'Test' }
    });
    
    expect(getByTestId('backdrop')).toBeInTheDocument();
    expect(getByTestId('dialog')).toBeInTheDocument();
    expect(getByTestId('content')).toBeInTheDocument();
  });
});