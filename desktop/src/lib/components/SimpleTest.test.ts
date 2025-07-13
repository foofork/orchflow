import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import SimpleTest from './SimpleTest.svelte';

describe('SimpleTest', () => {
  it('should render when show is true', () => {
    const { getByTestId } = render(SimpleTest, {
      props: { show: true }
    });
    
    expect(getByTestId('simple-test')).toBeInTheDocument();
    expect(getByTestId('simple-test').textContent).toBe('Hello World');
  });
  
  it('should not render when show is false', () => {
    const { queryByTestId } = render(SimpleTest, {
      props: { show: false }
    });
    
    expect(queryByTestId('simple-test')).toBeNull();
  });
});