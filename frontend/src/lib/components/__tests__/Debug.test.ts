import { describe, it } from 'vitest';
import { render } from '@testing-library/svelte';
import StatusBarEnhanced from '../StatusBarEnhanced.svelte';

describe('Debug', () => {
  it('shows what renders', () => {
    const { container } = render(StatusBarEnhanced, {
      props: {
        currentFile: { path: '/test.ts', line: 1, column: 1 },
      }
    });
    
    console.log('HTML:', container.innerHTML);
    console.log('Text content:', container.textContent);
  });
});