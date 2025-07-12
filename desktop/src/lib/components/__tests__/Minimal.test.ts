import { describe, it, expect, afterEach } from 'vitest';
import { createTypedMock, createSyncMock, createAsyncMock } from '@/test/mock-factory';

describe('Minimal Test', () => {
  let cleanup: Array<() => void> = [];

  afterEach(() => {
    cleanup.forEach(fn => fn());
    cleanup = [];
  });
  it('verifies test environment works', () => {
    // Simple test to verify vitest is working
    expect(1 + 1).toBe(2);
    expect('hello').toBe('hello');
    
    // Test DOM manipulation
    const div = document.createElement('div');
    div.className = 'test-component';
    div.textContent = 'Hello Test';
    document.body.appendChild(div);
    
    // Add cleanup for DOM element
    cleanup.push(() => {
      if (div.parentNode) {
        div.parentNode.removeChild(div);
      }
    });
    
    expect(document.querySelector('.test-component')).toBeInTheDocument();
    expect(document.querySelector('.test-component')?.textContent).toBe('Hello Test');
  });
});