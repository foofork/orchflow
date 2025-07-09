import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';

// Inline simple component for testing
import { SvelteComponent } from 'svelte';

class SimpleComponent extends SvelteComponent {
  constructor(options: any) {
    super();
    const { target, props = {} } = options;
    const div = document.createElement('div');
    div.className = 'test-component';
    div.textContent = `Hello ${props.name || 'World'}`;
    target.appendChild(div);
  }
}

describe('Minimal Test', () => {
  it('verifies test environment works', () => {
    const { container, getByText } = render(SimpleComponent, {
      props: { name: 'Test' }
    });
    
    console.log('Container:', container.innerHTML);
    expect(container.querySelector('.test-component')).toBeInTheDocument();
    expect(getByText('Hello Test')).toBeInTheDocument();
  });
});