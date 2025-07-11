import { vi } from 'vitest';

// Create mock Terminal class
export class MockTerminal {
  element = document.createElement('div');
  rows = 24;
  cols = 80;
  
  onData = vi.fn((callback) => {
    (this as any)._dataCallback = callback;
    return { dispose: vi.fn() };
  });
  
  onResize = vi.fn(() => ({ dispose: vi.fn() }));
  onBinary = vi.fn(() => ({ dispose: vi.fn() }));
  onTitleChange = vi.fn(() => ({ dispose: vi.fn() }));
  
  open = vi.fn((container) => {
    if (container) {
      container.appendChild(this.element);
    }
  });
  
  write = vi.fn();
  writeln = vi.fn();
  clear = vi.fn();
  dispose = vi.fn();
  focus = vi.fn();
  blur = vi.fn();
  resize = vi.fn();
  loadAddon = vi.fn((addon) => {
    // Simulate the addon activation that XTerm does internally
    if (addon && typeof addon.activate === 'function') {
      addon.activate(this);
    }
  });
}

// Create mock FitAddon
export class MockFitAddon {
  fit = vi.fn();
  proposeDimensions = vi.fn(() => ({ cols: 80, rows: 24 }));
  activate = vi.fn();
  dispose = vi.fn();
  _terminal = null;
  
  constructor() {
    // Prevent real addon behavior in tests
    this.fit = vi.fn();
    this.proposeDimensions = vi.fn(() => ({ cols: 80, rows: 24 }));
  }
}

// Create mock WebLinksAddon
export class MockWebLinksAddon {
  activate = vi.fn();
  dispose = vi.fn();
}

// Create mock SearchAddon
export class MockSearchAddon {
  activate = vi.fn();
  dispose = vi.fn();
  findNext = vi.fn(() => false);
  findPrevious = vi.fn(() => false);
  clearSelection = vi.fn();
  selectAll = vi.fn();
}

// Create mock WebglAddon
export class MockWebglAddon {
  activate = vi.fn();
  dispose = vi.fn();
}

// Setup dynamic import mocks
const mockImports = {
  '@xterm/xterm': {
    Terminal: MockTerminal
  },
  '@xterm/addon-fit': {
    FitAddon: MockFitAddon
  },
  '@xterm/addon-web-links': {
    WebLinksAddon: MockWebLinksAddon
  },
  '@xterm/addon-search': {
    SearchAddon: MockSearchAddon
  },
  '@xterm/addon-webgl': {
    WebglAddon: MockWebglAddon
  },
  '@xterm/xterm/css/xterm.css': {}
};

// Override dynamic imports
(globalThis as any).__mockDynamicImports = mockImports;

// Mock the dynamic import function to return our mocks
const originalImport = (globalThis as any).import;
if (originalImport) {
  (globalThis as any).import = vi.fn(async (path: string) => {
    // Handle our mocked modules
    for (const [modulePath, moduleExports] of Object.entries(mockImports)) {
      if (path.includes(modulePath)) {
        return moduleExports;
      }
    }
    
    // Fall back to original import for other modules
    return originalImport(path);
  });
}

// Also setup static mocks for vi.mock() compatibility
vi.mock('@xterm/xterm', () => ({
  Terminal: MockTerminal
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: MockFitAddon
}));

vi.mock('@xterm/addon-search', () => ({
  SearchAddon: MockSearchAddon
}));

vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: MockWebLinksAddon
}));

vi.mock('@xterm/addon-webgl', () => ({
  WebglAddon: MockWebglAddon
}));