import { vi } from 'vitest';

// Mock EditorState with proper structure
const mockEditorState = {
  create: vi.fn((config) => ({
    doc: {
      toString: vi.fn(() => config?.doc || ''),
      length: config?.doc?.length || 0,
      sliceString: vi.fn((from, to) => (config?.doc || '').slice(from, to)),
      line: vi.fn(() => ({ from: 0, to: 0, number: 1, text: '' })),
      lineAt: vi.fn(() => ({ from: 0, to: 0, number: 1, text: '' }))
    },
    selection: {
      main: { from: 0, to: 0, head: 0, anchor: 0 },
      ranges: [{ from: 0, to: 0, head: 0, anchor: 0 }]
    },
    field: vi.fn(),
    facet: vi.fn(),
    toJSON: vi.fn(() => ({})),
    update: vi.fn((spec) => ({
      state: mockEditorState.create(spec),
      changes: spec.changes || { from: 0, to: 0, insert: '' },
      transactions: [],
      view: null,
      docChanged: true,
      startState: mockEditorState.create(spec)
    }))
  })),
  readOnly: {
    of: vi.fn((value) => ({
      extension: { readOnly: value }
    })),
    reconfigure: vi.fn((extension) => ({
      effect: { reconfigure: extension }
    }))
  },
  reconfigure: {
    of: vi.fn((extensions) => ({
      effect: { reconfigure: extensions }
    }))
  },
  Facet: {
    define: vi.fn()
  },
  StateField: {
    define: vi.fn()
  },
  StateEffect: {
    define: vi.fn()
  },
  Compartment: vi.fn().mockImplementation(() => ({
    of: vi.fn((value) => ({ compartment: true, value })),
    reconfigure: vi.fn((value) => ({ reconfigure: true, value })),
    get: vi.fn()
  })),
  EditorSelection: {
    cursor: vi.fn((pos) => ({ from: pos, to: pos, head: pos, anchor: pos })),
    range: vi.fn((from, to) => ({ from, to, head: to, anchor: from }))
  },
  Transaction: {
    time: Date.now()
  }
};

// Mock EditorView with proper structure
const createMockEditorView = () => {
  const mockView = {
    state: mockEditorState.create({ doc: '' }),
    dispatch: vi.fn((transaction) => {
      // Update internal state when dispatch is called
      if (transaction.changes) {
        const newDoc = transaction.changes.insert || '';
        mockView.state = mockEditorState.create({ doc: newDoc });
      }
      if (transaction.effects) {
        // Handle effects like reconfigure
      }
    }),
    dom: document.createElement('div'),
    contentDOM: document.createElement('div'),
    scrollDOM: document.createElement('div'),
    destroy: vi.fn(),
    focus: vi.fn(),
    hasFocus: vi.fn(() => false),
    docView: {
      posFromDOM: vi.fn(() => 0),
      domFromPos: vi.fn(() => ({ node: null, offset: 0 }))
    },
    posAtCoords: vi.fn(() => 0),
    coordsAtPos: vi.fn(() => ({ left: 0, right: 0, top: 0, bottom: 0 })),
    requestMeasure: vi.fn(),
    plugin: vi.fn(),
    themeClasses: '',
    updateState: vi.fn()
  };
  
  // Add the mock view to its dom for testing
  mockView.dom.appendChild(mockView.contentDOM);
  
  return mockView;
};

const MockEditorView = vi.fn().mockImplementation((config) => {
  const view = createMockEditorView();
  if (config?.state) {
    view.state = config.state;
  }
  if (config?.parent) {
    config.parent.appendChild(view.dom);
  }
  return view;
});

// Add static properties to EditorView
Object.assign(MockEditorView, {
  lineWrapping: { extension: 'lineWrapping' },
  theme: vi.fn((spec, options) => ({
    extension: { theme: spec, options }
  })),
  updateListener: {
    of: vi.fn((callback) => ({
      extension: {
        update: callback
      }
    }))
  },
  darkTheme: { extension: 'darkTheme' },
  baseTheme: vi.fn((spec) => ({ extension: { baseTheme: spec } })),
  contentAttributes: {
    of: vi.fn((attrs) => ({ extension: { contentAttributes: attrs } }))
  },
  editorAttributes: {
    of: vi.fn((attrs) => ({ extension: { editorAttributes: attrs } }))
  },
  decorations: {
    of: vi.fn((value) => ({ extension: { decorations: value } }))
  },
  atomicRanges: {
    of: vi.fn((value) => ({ extension: { atomicRanges: value } }))
  },
  scrollIntoView: vi.fn((pos) => ({ effect: { scrollIntoView: pos } }))
});

// Mock view module
vi.mock('@codemirror/view', () => ({
  EditorView: MockEditorView,
  keymap: {
    of: vi.fn((bindings) => ({
      extension: { keymap: bindings }
    }))
  },
  drawSelection: vi.fn(() => ({ extension: 'drawSelection' })),
  dropCursor: vi.fn(() => ({ extension: 'dropCursor' })),
  rectangularSelection: vi.fn(() => ({ extension: 'rectangularSelection' })),
  crosshairCursor: vi.fn(() => ({ extension: 'crosshairCursor' })),
  lineNumbers: vi.fn(() => ({ extension: 'lineNumbers' })),
  highlightActiveLineGutter: vi.fn(() => ({ extension: 'highlightActiveLineGutter' })),
  highlightSpecialChars: vi.fn(() => ({ extension: 'highlightSpecialChars' })),
  highlightActiveLine: vi.fn(() => ({ extension: 'highlightActiveLine' })),
  placeholder: vi.fn((text) => ({ extension: { placeholder: text } })),
  ViewPlugin: {
    define: vi.fn(),
    fromClass: vi.fn()
  },
  ViewUpdate: vi.fn(),
  Decoration: {
    none: [],
    set: vi.fn(),
    mark: vi.fn(),
    widget: vi.fn(),
    replace: vi.fn(),
    line: vi.fn()
  },
  WidgetType: vi.fn()
}));

// Mock state module
vi.mock('@codemirror/state', () => ({
  ...mockEditorState,
  EditorState: mockEditorState
}));

// Mock basic-setup - not used anymore but keep for compatibility
vi.mock('@codemirror/basic-setup', () => ({
  basicSetup: [
    { extension: 'lineNumbers' },
    { extension: 'highlightActiveLineGutter' },
    { extension: 'highlightSpecialChars' },
    { extension: 'history' },
    { extension: 'foldGutter' },
    { extension: 'drawSelection' },
    { extension: 'dropCursor' },
    { extension: 'allowMultipleSelections' },
    { extension: 'indentOnInput' },
    { extension: 'syntaxHighlighting' },
    { extension: 'bracketMatching' },
    { extension: 'closeBrackets' },
    { extension: 'autocompletion' },
    { extension: 'rectangularSelection' },
    { extension: 'crosshairCursor' },
    { extension: 'highlightActiveLine' },
    { extension: 'searchKeymap' },
    { extension: 'defaultKeymap' },
  ]
}));

// Mock language support
const createLanguageSupport = (name: string) => ({
  extension: { language: name },
  language: { name },
  support: []
});

vi.mock('@codemirror/language', () => ({
  defaultHighlightStyle: {
    extension: 'defaultHighlightStyle'
  },
  syntaxHighlighting: vi.fn((highlighter, options) => ({
    extension: { syntaxHighlighting: { highlighter, options } }
  })),
  bracketMatching: vi.fn((config) => ({
    extension: { bracketMatching: config }
  })),
  foldGutter: vi.fn((config) => ({
    extension: { foldGutter: config }
  })),
  indentOnInput: vi.fn(() => ({
    extension: 'indentOnInput'
  })),
  indentUnit: {
    of: vi.fn((value) => ({
      extension: { indentUnit: value }
    }))
  },
  LanguageSupport: vi.fn((language, support = []) => ({
    extension: { language: language.name, support }
  })),
  StreamLanguage: {
    define: vi.fn()
  },
  foldService: {
    of: vi.fn()
  },
  codeFolding: vi.fn((config) => ({
    extension: { codeFolding: config }
  })),
  Language: {
    define: vi.fn()
  }
}));

// Mock language modules
vi.mock('@codemirror/lang-javascript', () => ({
  javascript: vi.fn((config) => 
    createLanguageSupport(config?.typescript ? 'typescript' : 'javascript')
  ),
  javascriptLanguage: {
    name: 'javascript',
    parser: {}
  },
  typescriptLanguage: {
    name: 'typescript',
    parser: {}
  },
  jsxLanguage: {
    name: 'jsx',
    parser: {}
  },
  tsxLanguage: {
    name: 'tsx',
    parser: {}
  }
}));

vi.mock('@codemirror/lang-json', () => ({
  json: vi.fn(() => createLanguageSupport('json')),
  jsonLanguage: {
    name: 'json',
    parser: {}
  }
}));

vi.mock('@codemirror/lang-python', () => ({
  python: vi.fn(() => createLanguageSupport('python')),
  pythonLanguage: {
    name: 'python',
    parser: {}
  }
}));

vi.mock('@codemirror/lang-rust', () => ({
  rust: vi.fn(() => createLanguageSupport('rust')),
  rustLanguage: {
    name: 'rust',
    parser: {}
  }
}));

vi.mock('@codemirror/lang-yaml', () => ({
  yaml: vi.fn(() => createLanguageSupport('yaml')),
  yamlLanguage: {
    name: 'yaml',
    parser: {}
  }
}));

// Mock commands
vi.mock('@codemirror/commands', () => ({
  defaultKeymap: [
    { key: 'Enter', run: vi.fn() }
  ],
  standardKeymap: [
    { key: 'Enter', run: vi.fn() }
  ],
  historyKeymap: [
    { key: 'Mod-z', run: vi.fn() },
    { key: 'Mod-y', run: vi.fn() }
  ],
  history: vi.fn((config) => ({
    extension: { history: config }
  })),
  undo: vi.fn(),
  redo: vi.fn(),
  undoSelection: vi.fn(),
  redoSelection: vi.fn(),
  indentWithTab: { key: 'Tab', run: vi.fn() },
  insertTab: vi.fn(),
  indentMore: vi.fn(),
  indentLess: vi.fn(),
  insertNewlineAndIndent: vi.fn(),
  selectLine: vi.fn(),
  selectParentSyntax: vi.fn(),
  simplifySelection: vi.fn(),
  deleteCharBackward: vi.fn(),
  deleteCharForward: vi.fn(),
  deleteGroupBackward: vi.fn(),
  deleteGroupForward: vi.fn(),
  deleteToLineStart: vi.fn(),
  deleteToLineEnd: vi.fn(),
  splitLine: vi.fn(),
  transposeChars: vi.fn(),
  moveLineDown: vi.fn(),
  moveLineUp: vi.fn(),
  copyLineDown: vi.fn(),
  copyLineUp: vi.fn(),
  deleteLine: vi.fn(),
  cursorMatchingBracket: vi.fn(),
  selectAll: vi.fn()
}));

// Mock theme
vi.mock('@codemirror/theme-one-dark', () => ({
  oneDark: {
    extension: 'oneDark'
  }
}));

// Mock search
vi.mock('@codemirror/search', () => ({
  searchKeymap: [
    { key: 'Mod-f', run: vi.fn() },
    { key: 'F3', run: vi.fn() },
    { key: 'Mod-g', run: vi.fn() }
  ],
  search: vi.fn((config) => ({
    extension: { search: config }
  })),
  searchConfig: vi.fn((config) => ({
    extension: { searchConfig: config }
  })),
  highlightSelectionMatches: vi.fn((config) => ({
    extension: { highlightSelectionMatches: config }
  })),
  findNext: vi.fn(),
  findPrevious: vi.fn(),
  selectNextMatch: vi.fn(),
  selectPreviousMatch: vi.fn(),
  replaceNext: vi.fn(),
  replaceAll: vi.fn(),
  openSearchPanel: vi.fn(),
  closeSearchPanel: vi.fn()
}));

// Mock autocomplete
vi.mock('@codemirror/autocomplete', () => ({
  autocompletion: vi.fn((config) => ({
    extension: { autocompletion: config }
  })),
  completionKeymap: [
    { key: 'Ctrl-Space', run: vi.fn() },
    { key: 'Escape', run: vi.fn() }
  ],
  closeBrackets: vi.fn(() => ({
    extension: 'closeBrackets'
  })),
  closeBracketsKeymap: [
    { key: 'Backspace', run: vi.fn() }
  ],
  acceptCompletion: vi.fn(),
  startCompletion: vi.fn(),
  closeCompletion: vi.fn(),
  moveCompletionSelection: vi.fn(),
  completeFromList: vi.fn(),
  ifNotIn: vi.fn(),
  snippetCompletion: vi.fn()
}));

// Mock lint
vi.mock('@codemirror/lint', () => ({
  lintKeymap: [
    { key: 'Mod-Shift-m', run: vi.fn() }
  ],
  linter: vi.fn((source, config) => ({
    extension: { linter: { source, config } }
  })),
  lintGutter: vi.fn((config) => ({
    extension: { lintGutter: config }
  })),
  setDiagnostics: vi.fn(),
  openLintPanel: vi.fn(),
  closeLintPanel: vi.fn(),
  nextDiagnostic: vi.fn()
}));

// Export mocks for use in tests
export {
  mockEditorState,
  MockEditorView,
  createMockEditorView
};

// Also make the mocks available globally for tests that need them
(globalThis as any).__mockEditorState = mockEditorState;
(globalThis as any).__MockEditorView = MockEditorView;
(globalThis as any).__createMockEditorView = createMockEditorView;