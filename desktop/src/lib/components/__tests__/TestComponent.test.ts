import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import TestComponent from './TestComponent.svelte';

describe('TestComponent', () => {
  it('should render when show is true', () => {
    const { queryByTestId } = render(TestComponent, {
      props: { show: true, message: 'Test Message' }
    });
    
    const element = queryByTestId('test-content');
    expect(element).toBeTruthy();
    expect(element?.textContent).toBe('Test Message');
  });

  it('should not render when show is false', () => {
    const { queryByTestId } = render(TestComponent, {
      props: { show: false, message: 'Test Message' }
    });
    
    const element = queryByTestId('test-content');
    expect(element).toBeFalsy();
  });
});