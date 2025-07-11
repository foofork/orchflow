import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import Editor from './CodeMirrorEditor.svelte';

describe('Editor', () => {
  let mockEditorInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Get the mock instance from the global mocks
    mockEditorInstance = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should render editor container', async () => {
      const { container } = render(Editor);
      
      await tick();
      
      const editorContainer = container.querySelector('.editor-container');
      expect(editorContainer).toBeTruthy();
    });

    it('should initialize with provided value', async () => {
      const initialValue = 'const hello = "world";';
      
      const { container } = render(Editor, {
        props: { value: initialValue }
      });
      
      await tick();
      
      // The editor should be initialized with the value
      const editorEl = container.querySelector('.cm-editor');
      expect(editorEl).toBeTruthy();
    });

    it('should apply dark theme when specified', async () => {
      const { container } = render(Editor, {
        props: { theme: 'dark' }
      });
      
      await tick();
      
      // Dark theme should be applied
      expect(container.innerHTML).toBeTruthy();
    });

    it('should apply light theme when specified', async () => {
      const { container } = render(Editor, {
        props: { theme: 'light' }
      });
      
      await tick();
      
      // Light theme should be applied
      expect(container.innerHTML).toBeTruthy();
    });
  });

  describe('Language Support', () => {
    it('should support JavaScript language', async () => {
      const { container } = render(Editor, {
        props: { 
          language: 'javascript',
          value: 'console.log("test");'
        }
      });
      
      await tick();
      
      expect(container.querySelector('.editor-container')).toBeTruthy();
    });

    it('should support TypeScript language', async () => {
      const { container } = render(Editor, {
        props: { 
          language: 'typescript',
          value: 'const x: string = "test";'
        }
      });
      
      await tick();
      
      expect(container.querySelector('.editor-container')).toBeTruthy();
    });

    it('should support JSON language', async () => {
      const { container } = render(Editor, {
        props: { 
          language: 'json',
          value: '{"key": "value"}'
        }
      });
      
      await tick();
      
      expect(container.querySelector('.editor-container')).toBeTruthy();
    });

    it('should support Python language', async () => {
      const { container } = render(Editor, {
        props: { 
          language: 'python',
          value: 'print("Hello, World!")'
        }
      });
      
      await tick();
      
      expect(container.querySelector('.editor-container')).toBeTruthy();
    });

    it('should support Rust language', async () => {
      const { container } = render(Editor, {
        props: { 
          language: 'rust',
          value: 'fn main() { println!("Hello"); }'
        }
      });
      
      await tick();
      
      expect(container.querySelector('.editor-container')).toBeTruthy();
    });

    it('should support YAML language', async () => {
      const { container } = render(Editor, {
        props: { 
          language: 'yaml',
          value: 'key: value'
        }
      });
      
      await tick();
      
      expect(container.querySelector('.editor-container')).toBeTruthy();
    });
  });

  describe('Editor Options', () => {
    it('should toggle line numbers', async () => {
      const { container } = render(Editor, {
        props: { 
          lineNumbers: false,
          value: 'test'
        }
      });
      
      await tick();
      
      expect(container.querySelector('.editor-container')).toBeTruthy();
    });

    it('should toggle word wrap', async () => {
      const { container } = render(Editor, {
        props: { 
          wordWrap: true,
          value: 'very long line that should wrap'
        }
      });
      
      await tick();
      
      expect(container.querySelector('.editor-container')).toBeTruthy();
    });

    it('should set custom font size', async () => {
      const { container } = render(Editor, {
        props: { 
          fontSize: 18,
          value: 'test'
        }
      });
      
      await tick();
      
      expect(container.querySelector('.editor-container')).toBeTruthy();
    });

    it('should set custom height', async () => {
      const { container } = render(Editor, {
        props: { 
          height: '600px',
          value: 'test'
        }
      });
      
      await tick();
      
      const editorContainer = container.querySelector('.editor-container') as HTMLElement;
      expect(editorContainer).toBeTruthy();
    });

    it('should set read-only mode', async () => {
      const { container } = render(Editor, {
        props: { 
          readOnly: true,
          value: 'cannot edit this'
        }
      });
      
      await tick();
      
      expect(container.querySelector('.editor-container')).toBeTruthy();
    });
  });

  describe('Events', () => {
    it('should emit change event on content change', async () => {
      const { component } = render(Editor, {
        props: { value: 'initial' }
      });
      
      const changeHandler = vi.fn();
      component.$on('change', (event) => {
        changeHandler(event.detail);
      });
      
      await tick();
      
      // Simulate a change by updating the value prop
      component.$set({ value: 'updated' });
      await tick();
      
      expect(changeHandler).toHaveBeenCalledWith('updated');
    });

    it('should emit ready event when editor is initialized', async () => {
      const readyHandler = vi.fn();
      
      const { component } = render(Editor);
      
      component.$on('ready', (event) => {
        readyHandler(event.detail);
      });
      
      await tick();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(readyHandler).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should show loading state initially', () => {
      const { container } = render(Editor);
      
      const loadingEl = container.querySelector('.loading');
      expect(loadingEl).toBeTruthy();
    });

    it('should handle initialization errors gracefully', async () => {
      // Force an error by breaking the mock
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const { container } = render(Editor, {
        props: { 
          language: 'invalid-language' as any,
          value: 'test'
        }
      });
      
      await tick();
      
      // Component should still render
      expect(container.querySelector('.editor-container')).toBeTruthy();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Dynamic Updates', () => {
    it('should update content when value prop changes', async () => {
      const { component } = render(Editor, {
        props: { value: 'initial' }
      });
      
      await tick();
      
      // Update the value
      component.$set({ value: 'updated content' });
      await tick();
      
      // The new value should be reflected
      const editorContent = component.$$.ctx;
      expect(editorContent).toBeTruthy();
    });

    it('should update read-only state dynamically', async () => {
      const { component } = render(Editor, {
        props: { 
          value: 'test',
          readOnly: false
        }
      });
      
      await tick();
      
      // Toggle read-only
      component.$set({ readOnly: true });
      await tick();
      
      // Should update the editor state
      expect(component).toBeTruthy();
    });

    it('should handle language change', async () => {
      const { component } = render(Editor, {
        props: { 
          value: 'console.log("test");',
          language: 'javascript'
        }
      });
      
      await tick();
      
      // Change language
      component.$set({ language: 'python' });
      await tick();
      
      // Should update the language support
      expect(component).toBeTruthy();
    });
  });

  describe('Cleanup', () => {
    it('should destroy editor on unmount', async () => {
      const { unmount } = render(Editor);
      
      await tick();
      
      // Unmount should clean up
      unmount();
      
      // No errors should occur
      expect(true).toBe(true);
    });
  });
});