import { vi } from 'vitest';

// File reserved for component mocks if needed
// Currently empty to allow testing actual components

// Mock PluginStatusBar component to avoid import issues
vi.mock('$lib/components/PluginStatusBar.svelte', () => {
  return {
    default: vi.fn(() => ({
      // Mock component
    }))
  };
});