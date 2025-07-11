import { vi } from 'vitest';

// Mock invoke function
export const invoke = vi.fn(() => Promise.resolve());

// Mock event functions
export const emit = vi.fn(() => Promise.resolve());
export const listen = vi.fn(() => Promise.resolve(() => {}));
export const once = vi.fn(() => Promise.resolve(() => {}));

// Mock window
export const appWindow = {
  label: 'main',
  emit: vi.fn(),
  listen: vi.fn(() => Promise.resolve(() => {})),
  once: vi.fn(() => Promise.resolve(() => {})),
};

export const getCurrent = vi.fn(() => ({ label: 'main' }));
export const getAll = vi.fn(() => [{ label: 'main' }]);

// Export event module
export const event = {
  emit,
  listen,
  once,
};

// Export window module
export const window = {
  appWindow,
  getCurrent,
  getAll,
};

// Default export
export default {
  invoke,
  event,
  window,
};