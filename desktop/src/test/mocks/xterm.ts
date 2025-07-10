import { vi } from 'vitest';

// Mock Terminal class
export class Terminal {
  rows = 24;
  cols = 80;
  element = document.createElement('div');
  
  constructor(options?: any) {
    // Store options if needed
  }
  
  loadAddon = vi.fn();
  open = vi.fn((element) => {
    element.appendChild(this.element);
  });
  write = vi.fn();
  writeln = vi.fn();
  clear = vi.fn();
  focus = vi.fn();
  blur = vi.fn();
  dispose = vi.fn();
  onData = vi.fn((callback) => {
    // Return unsubscribe function
    return () => {};
  });
  onResize = vi.fn((callback) => {
    return () => {};
  });
  onBinary = vi.fn((callback) => {
    return () => {};
  });
  onTitleChange = vi.fn((callback) => {
    return () => {};
  });
  resize = vi.fn((cols: number, rows: number) => {
    this.cols = cols;
    this.rows = rows;
  });
}

// Mock addons
export class FitAddon {
  fit = vi.fn();
  proposeDimensions = vi.fn(() => ({ cols: 80, rows: 24 }));
  activate = vi.fn();
  dispose = vi.fn();
}

export class WebglAddon {
  onContextLoss = vi.fn();
  dispose = vi.fn();
  activate = vi.fn();
}

export class WebLinksAddon {
  activate = vi.fn();
  dispose = vi.fn();
}

export class SearchAddon {
  findNext = vi.fn();
  findPrevious = vi.fn();
  activate = vi.fn();
  dispose = vi.fn();
}

// Mock the modules
vi.mock('@xterm/xterm', () => ({
  Terminal,
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon,
}));

vi.mock('@xterm/addon-webgl', () => ({
  WebglAddon,
}));

vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon,
}));

vi.mock('@xterm/addon-search', () => ({
  SearchAddon,
}));

// Mock the CSS import
vi.mock('@xterm/xterm/css/xterm.css', () => ({}));