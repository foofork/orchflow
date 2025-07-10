import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Integration tests use more realistic mocks
// but still run in jsdom environment

// Set up Tauri globals with full functionality
(globalThis as any).window = globalThis.window || {};
(globalThis as any).window.__TAURI_IPC__ = vi.fn();
(globalThis as any).window.__TAURI_METADATA__ = { 
  __windows: ['main'], 
  __currentWindow: { label: 'main' } 
};

// More complete Tauri API mocks for integration testing
vi.mock('@tauri-apps/api', () => {
  const eventListeners = new Map<string, Set<Function>>();
  
  return {
    invoke: vi.fn((cmd: string, args?: any) => {
      // Return more realistic responses for integration tests
      switch (cmd) {
        case 'get_sessions':
          return Promise.resolve([
            { id: 'main', name: 'Main Session', pane_count: 3 }
          ]);
        case 'get_panes':
          return Promise.resolve([
            { id: 'pane1', pane_type: 'terminal', title: 'Terminal 1' },
            { id: 'pane2', pane_type: 'editor', title: 'Editor' },
          ]);
        default:
          return Promise.resolve(null);
      }
    }),
    
    window: {
      appWindow: {
        label: 'main',
        emit: vi.fn((event: string, payload?: any) => {
          const listeners = eventListeners.get(event);
          if (listeners) {
            listeners.forEach(fn => fn({ event, payload }));
          }
        }),
        listen: vi.fn((event: string, handler: Function) => {
          if (!eventListeners.has(event)) {
            eventListeners.set(event, new Set());
          }
          eventListeners.get(event)!.add(handler);
          return Promise.resolve(() => {
            eventListeners.get(event)?.delete(handler);
          });
        }),
      },
    },
    
    event: {
      emit: vi.fn(),
      listen: vi.fn(() => Promise.resolve(() => {})),
    },
  };
});

// Mock window.matchMedia for responsive tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Enhanced ResizeObserver for integration tests
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Setup canvas with basic functionality
HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation(
  function(contextType: string) {
    if (contextType === '2d') {
      return {
        fillStyle: '',
        strokeStyle: '',
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        getImageData: vi.fn(() => ({
          data: new Uint8ClampedArray([0, 0, 0, 255]),
        })),
        putImageData: vi.fn(),
        createImageData: vi.fn(),
        setTransform: vi.fn(),
        drawImage: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        scale: vi.fn(),
        rotate: vi.fn(),
        translate: vi.fn(),
        transform: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        bezierCurveTo: vi.fn(),
        quadraticCurveTo: vi.fn(),
        arc: vi.fn(),
        arcTo: vi.fn(),
        ellipse: vi.fn(),
        rect: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        clip: vi.fn(),
        isPointInPath: vi.fn(),
        isPointInStroke: vi.fn(),
        measureText: vi.fn(() => ({ width: 0 })),
        fillText: vi.fn(),
        strokeText: vi.fn(),
      };
    }
    return null;
  }
);