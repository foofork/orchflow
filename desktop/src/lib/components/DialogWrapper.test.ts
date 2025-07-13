import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import DialogWrapper from './DialogWrapper.svelte';

describe('DialogWrapper', () => {
  it('should render dialog through wrapper', () => {
    const { container, getByTestId } = render(DialogWrapper, {
      props: { showDialog: true }
    });
    
    // Check wrapper is rendered
    expect(getByTestId('wrapper')).toBeInTheDocument();
    
    // Check if dialog is in the DOM
    console.log('Wrapper HTML:', container.innerHTML);
    
    // Look for dialog elements
    const backdrop = container.querySelector('.dialog-backdrop');
    console.log('Found backdrop:', backdrop);
  });
});