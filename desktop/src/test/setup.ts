import '@testing-library/jest-dom';
import { vi } from 'vitest';
import './setup-mocks';

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

vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn(() => Promise.resolve()),
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

// Mock ResizeObserver
const MockResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

global.ResizeObserver = MockResizeObserver;

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

// Mock CodeMirror modules
vi.mock('@codemirror/state', () => ({
  EditorState: {
    create: vi.fn(() => ({
      doc: { toString: () => '' },
      selection: { main: { from: 0, to: 0 } },
      update: vi.fn()
    }))
  },
  StateField: {
    define: vi.fn()
  },
  StateEffect: {
    define: vi.fn()
  },
  Compartment: vi.fn(() => ({
    of: vi.fn(),
    reconfigure: vi.fn()
  }))
}));

vi.mock('@codemirror/view', () => ({
  EditorView: vi.fn(() => ({
    state: { doc: { toString: () => '' } },
    dispatch: vi.fn(),
    destroy: vi.fn(),
    dom: document.createElement('div'),
    contentDOM: document.createElement('div')
  })),
  keymap: {
    of: vi.fn()
  },
  drawSelection: vi.fn(),
  dropCursor: vi.fn(),
  rectangularSelection: vi.fn(),
  crosshairCursor: vi.fn(),
  lineNumbers: vi.fn(),
  highlightActiveLineGutter: vi.fn(),
  highlightSpecialChars: vi.fn(),
  ViewUpdate: vi.fn()
}));

vi.mock('@codemirror/language', () => ({
  defaultHighlightStyle: { extension: vi.fn() },
  bracketMatching: vi.fn(),
  foldGutter: vi.fn(),
  indentOnInput: vi.fn(),
  syntaxHighlighting: vi.fn(),
  LanguageSupport: vi.fn(),
  StreamLanguage: {
    define: vi.fn()
  }
}));

vi.mock('@codemirror/commands', () => ({
  defaultKeymap: [],
  history: vi.fn(),
  historyKeymap: [],
  indentWithTab: vi.fn()
}));

vi.mock('@codemirror/search', () => ({
  searchKeymap: [],
  search: vi.fn(),
  highlightSelectionMatches: vi.fn()
}));

vi.mock('@codemirror/autocomplete', () => ({
  autocompletion: vi.fn(),
  completionKeymap: [],
  closeBrackets: vi.fn(),
  closeBracketsKeymap: []
}));

vi.mock('@codemirror/lint', () => ({
  lintKeymap: [],
  linter: vi.fn()
}));

vi.mock('@codemirror/lang-json', () => ({
  json: vi.fn(() => ({ extension: vi.fn() }))
}));

vi.mock('@codemirror/lang-yaml', () => ({
  yaml: vi.fn(() => ({ extension: vi.fn() }))
}));

// Mock dynamic imports for components
const originalImport = global.import;
global.import = vi.fn(async (path: string) => {
  if (path.includes('CodeMirrorEditor.svelte')) {
    return {
      default: vi.fn().mockImplementation(() => ({
        $$: {
          fragment: null,
          ctx: [],
          props: {},
          update: vi.fn(),
          not_equal: vi.fn(),
          bound: {},
          on_mount: [],
          on_destroy: [],
          on_disconnect: [],
          before_update: [],
          after_update: [],
          context: new Map(),
          callbacks: {},
          dirty: [],
          skip_bound: false,
          root: null
        },
        $destroy: vi.fn(),
        $on: vi.fn(),
        $set: vi.fn(),
        getValue: vi.fn(() => '{}'),
        setValue: vi.fn()
      }))
    };
  }
  return originalImport(path);
});

