import { describe, it, expect } from 'vitest';

describe('Minimal Test', () => {
  it('verifies test environment works', () => {
    // Simple test to verify vitest is working
    expect(1 + 1).toBe(2);
    expect('hello').toBe('hello');
    
    // Test DOM manipulation
    const div = document.createElement('div');
    div.className = 'test-component';
    div.textContent = 'Hello Test';
    document.body.appendChild(div);
    
    expect(document.querySelector('.test-component')).toBeInTheDocument();
    expect(document.querySelector('.test-component')?.textContent).toBe('Hello Test');
  });
});