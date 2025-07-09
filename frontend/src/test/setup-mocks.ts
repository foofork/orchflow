import { vi } from 'vitest';
import { SvelteComponent } from 'svelte';

// Mock Dialog component
class MockDialog extends SvelteComponent {
  constructor(options: any) {
    super();
    // Simple mock that just renders children when show=true
  }
}

vi.mock('../lib/components/Dialog.svelte', () => ({
  default: MockDialog
}));

// Mock ContextMenu component
class MockContextMenu extends SvelteComponent {
  constructor(options: any) {
    super();
  }
}

vi.mock('../lib/components/ContextMenu.svelte', () => ({
  default: MockContextMenu
}));