import '@testing-library/jest-dom';
import { vi } from 'vitest';
import './setup-mocks';
import './setup-codemirror';
import './setup-xterm';
import { setupTestEnvironment } from './utils';
import { mockRegistry, createMock } from './utils/mock-registry';

// Initialize MockRegistry for the test session
beforeEach(() => {
  mockRegistry.createSnapshot('test-start');
});

afterEach(() => {
  mockRegistry.reset();
  mockRegistry.clearCalls();
});

// Set up Tauri globals
(globalThis as any).window = globalThis.window || {};
(globalThis as any).window.__TAURI_IPC__ = vi.fn();
(globalThis as any).window.__TAURI_METADATA__ = { __windows: [], __currentWindow: { label: 'main' } };

// Mock Tauri API modules
vi.mock('@tauri-apps/api', () => ({
  invoke: vi.fn(() => Promise.resolve()),
  window: {
    appWindow: {
      label: 'main',
      emit: vi.fn(),
      listen: vi.fn(() => Promise.resolve(() => {})),
      once: vi.fn(() => Promise.resolve(() => {})),
    },
    getCurrent: vi.fn(() => ({ label: 'main' })),
    getAll: vi.fn(() => [{ label: 'main' }]),
  },
  event: {
    emit: vi.fn(),
    listen: vi.fn(() => Promise.resolve(() => {})),
    once: vi.fn(() => Promise.resolve(() => {})),
  },
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve()),
  convertFileSrc: vi.fn((src: string) => src),
  transformCallback: vi.fn(),
  isTauri: vi.fn(() => true),
}));

vi.mock('@tauri-apps/api/window', () => ({
  appWindow: {
    label: 'main',
    emit: vi.fn(),
    listen: vi.fn(() => Promise.resolve(() => {})),
    once: vi.fn(() => Promise.resolve(() => {})),
  },
  getCurrent: vi.fn(() => ({ label: 'main' })),
  getAll: vi.fn(() => [{ label: 'main' }]),
}));

vi.mock('@tauri-apps/api/event', () => ({
  emit: vi.fn(),
  listen: vi.fn(() => Promise.resolve(() => {})),
  once: vi.fn(() => Promise.resolve(() => {})),
  invoke: vi.fn(() => Promise.resolve()), // Add invoke here too
}));

// Mock Tauri plugins
vi.mock('@tauri-apps/plugin-fs', () => ({
  readDir: vi.fn(() => Promise.resolve([])),
  readFile: vi.fn(() => Promise.resolve(new Uint8Array())),
  writeFile: vi.fn(() => Promise.resolve()),
  exists: vi.fn(() => Promise.resolve(false)),
  createDir: vi.fn(() => Promise.resolve()),
  removeFile: vi.fn(() => Promise.resolve()),
  removeDir: vi.fn(() => Promise.resolve()),
}));

vi.mock('@tauri-apps/plugin-shell', () => ({
  Command: vi.fn(() => ({
    execute: vi.fn(() => Promise.resolve({ code: 0, signal: null, stdout: '', stderr: '' })),
    spawn: vi.fn(() => Promise.resolve({ code: 0, signal: null, stdout: '', stderr: '' })),
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
  })),
  open: vi.fn(() => Promise.resolve()),
}));

vi.mock('@tauri-apps/plugin-process', () => ({
  exit: vi.fn(),
  relaunch: vi.fn(() => Promise.resolve()),
}));

vi.mock('@tauri-apps/plugin-os', () => ({
  platform: vi.fn(() => 'darwin'),
  version: vi.fn(() => Promise.resolve('1.0.0')),
  type: vi.fn(() => Promise.resolve('Darwin')),
  arch: vi.fn(() => Promise.resolve('x86_64')),
  tempdir: vi.fn(() => Promise.resolve('/tmp')),
}));

vi.mock('@tauri-apps/plugin-updater', () => ({
  checkUpdate: vi.fn(() => Promise.resolve(null)),
  installUpdate: vi.fn(() => Promise.resolve()),
  onUpdaterEvent: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(() => Promise.resolve(null)),
  save: vi.fn(() => Promise.resolve(null)),
  message: vi.fn(() => Promise.resolve()),
  ask: vi.fn(() => Promise.resolve(true)),
  confirm: vi.fn(() => Promise.resolve(true)),
}));

// Mock window.matchMedia
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

// Mock WebSocket for jsdom environment
class MockWebSocket {
  url: string;
  protocol: string | string[] | undefined;
  readyState: number = 0; // CONNECTING
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  
  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocol = protocols;
    
    // Simulate connection opening
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
  }
  
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  });
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn();
}

global.WebSocket = MockWebSocket as any;

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  
  constructor(callback: ResizeObserverCallback) {
    // Store the callback if needed for tests
    (this as any).callback = callback;
  }
}

global.ResizeObserver = MockResizeObserver as any;

// Mock Web Animations API for tests
if (typeof Element.prototype.animate === 'undefined') {
  Element.prototype.animate = vi.fn().mockImplementation(function(keyframes, options) {
    const animationInstance: any = {
      play: vi.fn(),
      pause: vi.fn(),
      cancel: vi.fn(),
      finish: vi.fn(),
      reverse: vi.fn(),
      updatePlaybackRate: vi.fn(),
      effect: null,
      timeline: null,
      playState: 'running',
      pending: false,
      ready: null as any,
      finished: null as any,
      onfinish: null,
      oncancel: null,
      onremove: null,
      id: '',
      playbackRate: 1,
      startTime: null,
      currentTime: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
    
    // Set promises after animation object is created
    animationInstance.ready = Promise.resolve(animationInstance);
    animationInstance.finished = Promise.resolve(animationInstance);
    
    // Simulate animation finishing
    if (typeof options === 'number') {
      setTimeout(() => {
        animationInstance.playState = 'finished';
        if (animationInstance.onfinish) animationInstance.onfinish();
      }, options);
    } else if (options && typeof options.duration === 'number') {
      setTimeout(() => {
        animationInstance.playState = 'finished';
        if (animationInstance.onfinish) animationInstance.onfinish();
      }, options.duration);
    }
    
    return animationInstance;
  });
}

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock canvas getContext
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
        measureText: vi.fn(() => ({ width: 0 })),
        fillText: vi.fn(),
        strokeText: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        scale: vi.fn(),
        rotate: vi.fn(),
        translate: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arc: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
      };
    }
    return null;
  }
);

// Mock xterm modules
class MockTerminal {
  rows = 24;
  cols = 80;
  element = document.createElement('div');
  buffer = { active: { type: 'normal' } };
  
  loadAddon = vi.fn();
  open = vi.fn((element) => {
    if (element) element.appendChild(this.element);
  });
  write = vi.fn();
  writeln = vi.fn();
  clear = vi.fn();
  focus = vi.fn();
  blur = vi.fn();
  dispose = vi.fn();
  onData = vi.fn(() => ({ dispose: vi.fn() }));
  onResize = vi.fn(() => ({ dispose: vi.fn() }));
  onBinary = vi.fn(() => ({ dispose: vi.fn() }));
  onTitleChange = vi.fn(() => ({ dispose: vi.fn() }));
  resize = vi.fn();
}

vi.mock('@xterm/xterm', () => ({
  Terminal: MockTerminal,
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit = vi.fn();
    proposeDimensions = vi.fn(() => ({ cols: 80, rows: 24 }));
    activate = vi.fn();
    dispose = vi.fn();
  },
}));

vi.mock('@xterm/addon-webgl', () => ({
  WebglAddon: class {
    onContextLoss = vi.fn();
    dispose = vi.fn();
    activate = vi.fn();
  },
}));

vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: vi.fn(),
}));

vi.mock('@xterm/addon-search', () => ({
  SearchAddon: vi.fn(),
}));

vi.mock('@xterm/xterm/css/xterm.css', () => ({}));

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock browser environment check
(globalThis as any).browser = true;

// Mock self global for xterm.js addons
(globalThis as any).self = globalThis;


// Mock dynamic imports for components
const originalImport = (global as any).import;
(global as any).import = vi.fn(async (path: string) => {
  if (path.includes('CodeMirrorEditor.svelte')) {
    // Return a mock Svelte component constructor
    const MockCodeMirrorEditor = class {
      $$: any;
      $destroy: any;
      $on: any;
      $set: any;
      
      constructor(options: any) {
        const props = options?.props || {};
        const target = options?.target;
        
        // Create a mock editor element
        const editorEl = document.createElement('div');
        editorEl.className = 'editor-container';
        editorEl.innerHTML = `<div class="cm-editor">${props.value || ''}</div>`;
        
        if (target) {
          target.appendChild(editorEl);
        }
        
        // Set up Svelte component interface
        this.$$ = {
          fragment: null,
          ctx: [],
          props: props,
          update: vi.fn(),
          not_equal: vi.fn(),
          bound: {},
          on_mount: [],
          on_destroy: [],
          on_disconnect: [],
          before_update: [],
          after_update: [],
          context: new Map(),
          callbacks: {
            change: []
          },
          dirty: [],
          skip_bound: false,
          root: editorEl
        };
        
        this.$destroy = vi.fn(() => {
          if (editorEl.parentNode) {
            editorEl.parentNode.removeChild(editorEl);
          }
        });
        
        this.$on = vi.fn((event: string, handler: (...args: any[]) => void) => {
          if (!this.$$.callbacks[event]) {
            this.$$.callbacks[event] = [];
          }
          this.$$.callbacks[event].push(handler);
          
          // Return unsubscribe function
          return () => {
            const idx = this.$$.callbacks[event].indexOf(handler);
            if (idx > -1) {
              this.$$.callbacks[event].splice(idx, 1);
            }
          };
        });
        
        this.$set = vi.fn((newProps: any) => {
          Object.assign(this.$$.props, newProps);
          if (newProps.value !== undefined) {
            const editorContent = editorEl.querySelector('.cm-editor');
            if (editorContent) {
              editorContent.textContent = newProps.value;
            }
            // Trigger change event
            if (this.$$.callbacks.change) {
              this.$$.callbacks.change.forEach((handler: (...args: any[]) => void) => {
                handler({ detail: newProps.value });
              });
            }
          }
        });
      }
    };
    
    return {
      default: MockCodeMirrorEditor
    };
  }
  return originalImport(path);
});

// Setup test environment with performance mocks and other utilities
setupTestEnvironment();

