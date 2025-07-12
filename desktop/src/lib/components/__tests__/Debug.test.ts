import { describe, it, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';
import StatusBarEnhanced from '../StatusBarEnhanced.svelte';
import { createTypedMock, createSyncMock, createAsyncMock } from '@/test/mock-factory';

describe('Debug', () => {
  let cleanup: Array<() => void> = [];

  afterEach(() => {
    cleanup.forEach(fn => fn());
    cleanup.length = 0;
  });

  it('shows what renders', () => {
    const { container, unmount } = render(StatusBarEnhanced, {
      props: {
        currentFile: { path: '/test.ts', line: 1, column: 1 },
      }
    });
    cleanup.push(unmount);
    
    console.log('HTML:', container.innerHTML);
    console.log('Text content:', container.textContent);
  });
});