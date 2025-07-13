import { render } from '@testing-library/svelte';
import Dialog from './src/lib/components/Dialog.svelte';

// Simple test to check if Dialog renders
console.log('Testing Dialog component...');

try {
  const { container } = render(Dialog, {
    props: { show: true, title: 'Test' },
    target: document.body
  });
  
  console.log('Dialog rendered successfully');
  console.log('HTML:', container.innerHTML);
  
  const dialog = container.querySelector('[data-testid="dialog"]');
  console.log('Dialog element found:', !!dialog);
} catch (error) {
  console.error('Error rendering Dialog:', error);
}