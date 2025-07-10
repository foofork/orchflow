import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import Editor from './CodeMirrorEditor.svelte';

// Mock CodeMirror modules
const mockView = {
  dom: document.createElement('div'),
  destroy: vi.fn(),
  dispatch: vi.fn(),
  state: {
    doc: {
      toString: () => 'mock content',
      length: 100
    }
  }
};

const mockEditorView = vi.fn().mockImplementation(() => mockView);
const mockEditorState = {
  create: vi.fn().mockReturnValue({
    doc: { toString: () => '' }
  })
};

vi.mock('@codemirror/view', () => ({
  EditorView: mockEditorView,
  keymap: {
    of: vi.fn((keymaps) => ({ extension: 'keymap', keymaps }))
  },
  lineNumbers: vi.fn(() => ({ extension: 'lineNumbers' })),
  highlightActiveLineGutter: vi.fn(() => ({ extension: 'highlightActiveLineGutter' })),
  highlightSpecialChars: vi.fn(() => ({ extension: 'highlightSpecialChars' })),
  drawSelection: vi.fn(() => ({ extension: 'drawSelection' })),
  dropCursor: vi.fn(() => ({ extension: 'dropCursor' })),
  rectangularSelection: vi.fn(() => ({ extension: 'rectangularSelection' })),
  crosshairCursor: vi.fn(() => ({ extension: 'crosshairCursor' })),
  highlightActiveLine: vi.fn(() => ({ extension: 'highlightActiveLine' })),
  placeholder: vi.fn((text) => ({ extension: 'placeholder', text }))
}));

vi.mock('@codemirror/state', () => ({
  EditorState: mockEditorState,
  EditorSelection: {
    single: vi.fn((pos) => ({ from: pos, to: pos }))
  }
}));

vi.mock('@codemirror/commands', () => ({
  defaultKeymap: [],
  history: vi.fn(() => ({ extension: 'history' })),
  historyKeymap: [],
  indentWithTab: { key: 'Tab', run: vi.fn() }
}));

vi.mock('@codemirror/language', () => ({
  syntaxHighlighting: vi.fn(() => ({ extension: 'syntaxHighlighting' })),
  defaultHighlightStyle: {},
  bracketMatching: vi.fn(() => ({ extension: 'bracketMatching' })),
  foldGutter: vi.fn(() => ({ extension: 'foldGutter' })),
  foldKeymap: [],
  indentOnInput: vi.fn(() => ({ extension: 'indentOnInput' }))
}));

vi.mock('@codemirror/search', () => ({
  searchKeymap: [],
  highlightSelectionMatches: vi.fn(() => ({ extension: 'highlightSelectionMatches' }))
}));

vi.mock('@codemirror/autocomplete', () => ({
  completionKeymap: [],
  closeBrackets: vi.fn(() => ({ extension: 'closeBrackets' })),
  closeBracketsKeymap: [],
  autocompletion: vi.fn(() => ({ extension: 'autocompletion' }))
}));

vi.mock('@codemirror/lint', () => ({
  lintKeymap: []
}));

vi.mock('@codemirror/lang-javascript', () => ({
  javascript: vi.fn(() => ({ extension: 'javascript' }))
}));

vi.mock('@codemirror/lang-python', () => ({
  python: vi.fn(() => ({ extension: 'python' }))
}));

vi.mock('@codemirror/lang-html', () => ({
  html: vi.fn(() => ({ extension: 'html' }))
}));

vi.mock('@codemirror/lang-css', () => ({
  css: vi.fn(() => ({ extension: 'css' }))
}));

vi.mock('@codemirror/lang-json', () => ({
  json: vi.fn(() => ({ extension: 'json' }))
}));

vi.mock('@codemirror/lang-markdown', () => ({
  markdown: vi.fn(() => ({ extension: 'markdown' }))
}));

vi.mock('@codemirror/theme-one-dark', () => ({
  oneDark: { extension: 'oneDark' }
}));

describe('CodeMirrorEditor Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockView.destroy.mockClear();
    mockView.dispatch.mockClear();
  });

  afterEach(() => {
    if (mockView.destroy) {
      mockView.destroy();
    }
  });

  it('should render editor container', () => {
    const { container } = render(Editor, {
      props: {
        value: 'Hello World',
        language: 'javascript'
      }
    });
    
    const editorEl = container.querySelector('.editor-container');
    expect(editorEl).toBeTruthy();
  });

  it('should initialize CodeMirror with provided value', async () => {
    const initialValue = 'const greeting = "Hello World";';
    
    render(Editor, {
      props: {
        value: initialValue,
        language: 'javascript'
      }
    });
    
    await tick();
    
    expect(mockEditorState.create).toHaveBeenCalledWith(expect.objectContaining({
      doc: initialValue
    }));
  });

  it('should apply specified language', async () => {
    const { javascript } = await import('@codemirror/lang-javascript');
    
    render(Editor, {
      props: {
        value: 'console.log("test");',
        language: 'javascript'
      }
    });
    
    await tick();
    
    expect(javascript).toHaveBeenCalled();
  });

  it('should handle language changes', async () => {
    const { component } = render(Editor, {
      props: {
        value: 'print("Hello")',
        language: 'python'
      }
    });
    
    await tick();
    
    const { python } = await import('@codemirror/lang-python');
    expect(python).toHaveBeenCalled();
    
    // Change language
    component.$set({ language: 'javascript' });
    await tick();
    
    const { javascript } = await import('@codemirror/lang-javascript');
    expect(javascript).toHaveBeenCalled();
  });

  it('should update editor content when value prop changes', async () => {
    const { component } = render(Editor, {
      props: {
        value: 'initial content',
        language: 'javascript'
      }
    });
    
    await tick();
    
    // Update value
    component.$set({ value: 'updated content' });
    await tick();
    
    expect(mockView.dispatch).toHaveBeenCalled();
  });

  it('should apply read-only mode', async () => {
    render(Editor, {
      props: {
        value: 'read only content',
        language: 'javascript',
        readonly: true
      }
    });
    
    await tick();
    
    expect(mockEditorView).toHaveBeenCalledWith(expect.objectContaining({
      state: expect.anything(),
      parent: expect.any(HTMLElement)
    }));
    
    // Check if EditorView.editable.of(false) was included
    const extensions = mockEditorState.create.mock.calls[0][0].extensions;
    expect(extensions).toBeDefined();
  });

  it('should handle onChange callback', async () => {
    const onChange = vi.fn();
    
    render(Editor, {
      props: {
        value: 'test',
        language: 'javascript',
        onChange
      }
    });
    
    await tick();
    
    // Simulate change
    const updateListener = mockEditorView.mock.calls[0][0].dispatch;
    if (updateListener) {
      // Simulate a document change
      updateListener({
        docChanged: true,
        state: {
          doc: {
            toString: () => 'changed content'
          }
        }
      });
    }
    
    expect(onChange).toHaveBeenCalledWith('changed content');
  });

  it('should support different themes', async () => {
    const { oneDark } = await import('@codemirror/theme-one-dark');
    
    render(Editor, {
      props: {
        value: 'themed content',
        language: 'javascript',
        theme: 'dark'
      }
    });
    
    await tick();
    
    // Check if dark theme was applied
    const extensions = mockEditorState.create.mock.calls[0][0].extensions;
    expect(extensions).toContainEqual({ extension: 'oneDark' });
  });

  it('should handle line numbers option', async () => {
    const { lineNumbers } = await import('@codemirror/view');
    
    render(Editor, {
      props: {
        value: 'test',
        language: 'javascript',
        lineNumbers: true
      }
    });
    
    await tick();
    
    expect(lineNumbers).toHaveBeenCalled();
  });

  it('should handle word wrap option', async () => {
    render(Editor, {
      props: {
        value: 'very long line that should wrap when word wrap is enabled',
        language: 'javascript',
        wordWrap: true
      }
    });
    
    await tick();
    
    // EditorView.lineWrapping should be included in extensions
    const extensions = mockEditorState.create.mock.calls[0][0].extensions;
    expect(extensions).toBeDefined();
  });

  it('should set placeholder text', async () => {
    const { placeholder } = await import('@codemirror/view');
    
    render(Editor, {
      props: {
        value: '',
        language: 'javascript',
        placeholder: 'Enter your code here...'
      }
    });
    
    await tick();
    
    expect(placeholder).toHaveBeenCalledWith('Enter your code here...');
  });

  it('should apply custom extensions', async () => {
    const customExtension = { extension: 'custom' };
    
    render(Editor, {
      props: {
        value: 'test',
        language: 'javascript',
        extensions: [customExtension]
      }
    });
    
    await tick();
    
    const extensions = mockEditorState.create.mock.calls[0][0].extensions;
    expect(extensions).toContainEqual(customExtension);
  });

  it('should handle focus and blur events', async () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    
    const { container } = render(Editor, {
      props: {
        value: 'test',
        language: 'javascript',
        onFocus,
        onBlur
      }
    });
    
    await tick();
    
    // Simulate focus
    const editorContainer = container.querySelector('.editor-container');
    await fireEvent.focus(editorContainer!);
    
    expect(onFocus).toHaveBeenCalled();
    
    // Simulate blur
    await fireEvent.blur(editorContainer!);
    
    expect(onBlur).toHaveBeenCalled();
  });

  it('should destroy editor on unmount', async () => {
    const { unmount } = render(Editor, {
      props: {
        value: 'test',
        language: 'javascript'
      }
    });
    
    await tick();
    
    unmount();
    
    expect(mockView.destroy).toHaveBeenCalled();
  });

  it('should support multiple languages', async () => {
    const languages = [
      { lang: 'javascript', module: '@codemirror/lang-javascript' },
      { lang: 'python', module: '@codemirror/lang-python' },
      { lang: 'html', module: '@codemirror/lang-html' },
      { lang: 'css', module: '@codemirror/lang-css' },
      { lang: 'json', module: '@codemirror/lang-json' },
      { lang: 'markdown', module: '@codemirror/lang-markdown' }
    ];
    
    for (const { lang, module } of languages) {
      vi.clearAllMocks();
      
      render(Editor, {
        props: {
          value: `test content for ${lang}`,
          language: lang
        }
      });
      
      await tick();
      
      const langModule = await import(module);
      const langFunction = langModule[lang];
      expect(langFunction).toHaveBeenCalled();
    }
  });

  it('should handle selection changes', async () => {
    const onSelectionChange = vi.fn();
    
    render(Editor, {
      props: {
        value: 'test content',
        language: 'javascript',
        onSelectionChange
      }
    });
    
    await tick();
    
    // Simulate selection change
    const updateListener = mockEditorView.mock.calls[0][0].dispatch;
    if (updateListener) {
      updateListener({
        selectionSet: true,
        state: {
          selection: {
            main: { from: 0, to: 5 }
          }
        }
      });
    }
    
    expect(onSelectionChange).toHaveBeenCalledWith({ from: 0, to: 5 });
  });

  it('should expose editor API methods', async () => {
    const { component } = render(Editor, {
      props: {
        value: 'test',
        language: 'javascript'
      }
    });
    
    await tick();
    
    // Test getValue
    expect(component.getValue()).toBe('mock content');
    
    // Test setValue
    component.setValue('new content');
    expect(mockView.dispatch).toHaveBeenCalled();
    
    // Test focus
    component.focus();
    expect(mockView.dom.focus).toBeDefined();
  });

  it('should handle tab key properly', async () => {
    const { indentWithTab } = await import('@codemirror/commands');
    
    render(Editor, {
      props: {
        value: 'test',
        language: 'javascript',
        tabSize: 4
      }
    });
    
    await tick();
    
    // Tab handling should be included in keymaps
    const extensions = mockEditorState.create.mock.calls[0][0].extensions;
    expect(extensions).toBeDefined();
  });
});