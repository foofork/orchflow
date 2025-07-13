import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import ConfigPanel from './ConfigPanel.svelte';
import { createTypedMock, createSyncMock, createAsyncMock } from '@/test/mock-factory';
import { mockSvelteEvents } from '@/test/svelte5-event-helper';

// Mock the dynamic import of CodeMirrorEditor before any tests run
beforeAll(() => {
  // Override the global import function for CodeMirrorEditor
  const originalImport = (global as any).import;
  (global as any).import = createAsyncMock<[string], any>(async (path: string) => {
    if (path.includes('CodeMirrorEditor.svelte')) {
      // Return a mock component class
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
          const editorContent = document.createElement('div');
          editorContent.className = 'cm-editor';
          editorContent.textContent = props.value || '';
          editorEl.appendChild(editorContent);
          
          if (target) {
            target.appendChild(editorEl);
          }
          
          // Set up Svelte component interface
          this.$$ = {
            fragment: null,
            ctx: [],
            props: props,
            update: createSyncMock<[], void>(),
            not_equal: createSyncMock<[any, any], boolean>(),
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
          
          this.$destroy = createSyncMock<[], void>();
          this.$destroy.mockImplementation(() => {
            if (editorEl.parentNode) {
              editorEl.parentNode.removeChild(editorEl);
            }
          });
          
          this.$on = createTypedMock<(event: string, handler: Function) => () => void>((event: string, handler: Function) => {
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
          
          this.$set = createSyncMock<[any], void>();
          this.$set.mockImplementation((newProps: any) => {
            Object.assign(this.$$.props, newProps);
            if (newProps.value !== undefined) {
              editorContent.textContent = newProps.value;
              // Trigger change event
              if (this.$$.callbacks.change) {
                this.$$.callbacks.change.forEach((handler: Function) => {
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
});

afterAll(() => {
  // Restore original import
  vi.restoreAllMocks();
});

describe('ConfigPanel', () => {
  let cleanup: Array<() => void> = [];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup.forEach(fn => fn());
    cleanup = [];
  });

  describe('Rendering', () => {
    it('should not render when show is false', () => {
      const { container, unmount } = render(ConfigPanel, {
        props: { show: false }
      });
      cleanup.push(unmount);
      
      expect(container.querySelector('.config-panel')).toBeFalsy();
    });

    it('should render when show is true', () => {
      const { container, unmount } = render(ConfigPanel, {
        props: { show: true }
      });
      cleanup.push(unmount);
      
      expect(container.querySelector('.config-panel')).toBeTruthy();
    });

    it('should render with custom title', () => {
      const { getByText, unmount } = render(ConfigPanel, {
        props: { 
          show: true,
          title: 'Custom Configuration'
        }
      });
      cleanup.push(unmount);
      
      expect(getByText('Custom Configuration')).toBeTruthy();
    });

    it('should render mode toggle buttons', () => {
      const { container, unmount } = render(ConfigPanel, {
        props: { show: true }
      });
      cleanup.push(unmount);
      
      const jsonButton = container.querySelector('button[data-mode="json"]');
      const yamlButton = container.querySelector('button[data-mode="yaml"]');
      
      expect(jsonButton).toBeTruthy();
      expect(yamlButton).toBeTruthy();
    });

    it('should highlight active mode', () => {
      const { container, unmount } = render(ConfigPanel, {
        props: { 
          show: true,
          mode: 'json'
        }
      });
      cleanup.push(unmount);
      
      const jsonButton = container.querySelector('button[data-mode="json"]');
      expect(jsonButton?.classList.contains('active')).toBe(true);
    });

    it('should render save and cancel buttons', () => {
      const { getByText, unmount } = render(ConfigPanel, {
        props: { show: true }
      });
      cleanup.push(unmount);
      
      expect(getByText('Save')).toBeTruthy();
      expect(getByText('Cancel')).toBeTruthy();
    });
  });

  describe('Configuration Display', () => {
    it('should display config as formatted JSON', async () => {
      const config = {
        name: 'test',
        value: 123,
        nested: { key: 'value' }
      };
      
      const { container, unmount } = render(ConfigPanel, {
        props: { 
          show: true,
          config,
          mode: 'json'
        }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        const editorContent = container.querySelector('.editor-container');
        expect(editorContent).toBeTruthy();
      });
    });

    it('should handle empty config', () => {
      const { container, unmount } = render(ConfigPanel, {
        props: { 
          show: true,
          config: {}
        }
      });
      cleanup.push(unmount);
      
      expect(container.querySelector('.config-panel')).toBeTruthy();
    });

    it('should handle null config', () => {
      const { container, unmount } = render(ConfigPanel, {
        props: { 
          show: true,
          config: null
        }
      });
      cleanup.push(unmount);
      
      expect(container.querySelector('.config-panel')).toBeTruthy();
    });
  });

  describe('Mode Switching', () => {
    it('should switch between JSON and YAML modes', async () => {
      const { container, unmount } = render(ConfigPanel, {
        props: { 
          show: true,
          mode: 'json'
        }
      });
      cleanup.push(unmount);
      
      const yamlButton = container.querySelector('button[data-mode="yaml"]');
      await fireEvent.click(yamlButton!);
      
      await waitFor(() => {
        expect(yamlButton?.classList.contains('active')).toBe(true);
      });
    });
  });

  describe('Validation', () => {
    it('should show validation errors for invalid JSON', async () => {
      const { container, component, unmount } = render(ConfigPanel, {
        props: { 
          show: true,
          config: { test: 'value' }
        }
      });
      cleanup.push(unmount);
      
      // Simulate editor change with invalid JSON
      const changeEvent = new CustomEvent('change', { detail: '{ invalid json' });
      component.$$.callbacks.change?.[0]?.(changeEvent);
      
      await waitFor(() => {
        const errorContainer = container.querySelector('.validation-errors');
        expect(errorContainer).toBeTruthy();
      });
    });

    it('should validate against schema if provided', async () => {
      const schema = {
        name: { required: true, type: 'string' },
        port: { required: true, type: 'number' }
      };
      
      const { container, component, unmount } = render(ConfigPanel, {
        props: { 
          show: true,
          config: {},
          schema
        }
      });
      cleanup.push(unmount);
      
      // Simulate editor change with missing required fields
      const changeEvent = new CustomEvent('change', { detail: '{}' });
      component.$$.callbacks.change?.[0]?.(changeEvent);
      
      await waitFor(() => {
        const errors = container.querySelector('.validation-errors');
        expect(errors?.textContent).toContain('Missing required field');
      });
    });

    it('should clear validation errors on valid input', async () => {
      const { container, component, unmount } = render(ConfigPanel, {
        props: { 
          show: true,
          config: { test: 'value' }
        }
      });
      cleanup.push(unmount);
      
      // First set invalid JSON
      let changeEvent = new CustomEvent('change', { detail: '{ invalid' });
      component.$$.callbacks.change?.[0]?.(changeEvent);
      
      await waitFor(() => {
        expect(container.querySelector('.validation-errors')).toBeTruthy();
      });
      
      // Then set valid JSON
      changeEvent = new CustomEvent('change', { detail: '{ "valid": true }' });
      component.$$.callbacks.change?.[0]?.(changeEvent);
      
      await waitFor(() => {
        expect(container.querySelector('.validation-errors')).toBeFalsy();
      });
    });
  });

  describe('Save and Cancel', () => {
    it('should emit save event with valid config', async () => {
      const { getByText, component, unmount } = render(ConfigPanel, {
        props: { 
          show: true,
          config: { test: 'value' }
        }
      });
      cleanup.push(unmount);
      
      const saveHandler = createSyncMock<[any], void>();
      const mockComponent = mockSvelteEvents(component);
      mockComponent.$on('save', saveHandler);
      
      const saveButton = getByText('Save');
      await fireEvent.click(saveButton);
      
      expect(saveHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            test: 'value'
          })
        })
      );
    });

    it('should not save with validation errors', async () => {
      const { getByText, component, unmount } = render(ConfigPanel, {
        props: { 
          show: true,
          config: { test: 'value' }
        }
      });
      cleanup.push(unmount);
      
      const saveHandler = createSyncMock<[any], void>();
      const mockComponent = mockSvelteEvents(component);
      mockComponent.$on('save', saveHandler);
      
      // Simulate invalid JSON
      const changeEvent = new CustomEvent('change', { detail: '{ invalid' });
      component.$$.callbacks.change?.[0]?.(changeEvent);
      
      const saveButton = getByText('Save');
      await fireEvent.click(saveButton);
      
      expect(saveHandler).not.toHaveBeenCalled();
    });

    it('should emit close event on cancel', async () => {
      const { getByText, component, unmount } = render(ConfigPanel, {
        props: { 
          show: true,
          config: {}
        }
      });
      cleanup.push(unmount);
      
      const closeHandler = createSyncMock<[any], void>();
      const mockComponent = mockSvelteEvents(component);
      mockComponent.$on('close', closeHandler);
      
      const cancelButton = getByText('Cancel');
      await fireEvent.click(cancelButton);
      
      expect(closeHandler).toHaveBeenCalled();
    });

    it('should show unsaved changes warning', async () => {
      const { container, component, unmount } = render(ConfigPanel, {
        props: { 
          show: true,
          config: { test: 'value' }
        }
      });
      cleanup.push(unmount);
      
      // Simulate editor change
      const changeEvent = new CustomEvent('change', { detail: '{ "test": "newvalue" }' });
      component.$$.callbacks.change?.[0]?.(changeEvent);
      
      await waitFor(() => {
        const indicator = container.querySelector('.unsaved-indicator');
        expect(indicator).toBeTruthy();
      });
    });

    it('should disable save button while saving', async () => {
      const { getByText, component, unmount } = render(ConfigPanel, {
        props: { 
          show: true,
          config: { test: 'value' }
        }
      });
      cleanup.push(unmount);
      
      // Create a promise that we can control
      let resolveSave: () => void;
      const savePromise = new Promise<void>(resolve => {
        resolveSave = resolve;
      });
      
      const saveHandler = createSyncMock<[any], Promise<void>>(savePromise);
      const mockComponent = mockSvelteEvents(component);
      mockComponent.$on('save', saveHandler);
      
      const saveButton = getByText('Save') as HTMLButtonElement;
      await fireEvent.click(saveButton);
      
      // Button should be disabled while saving
      expect(saveButton.disabled).toBe(true);
      expect(saveButton.textContent).toBe('Saving...');
      
      // Resolve the save
      resolveSave!();
      
      await waitFor(() => {
        expect(saveButton.disabled).toBe(false);
        expect(saveButton.textContent).toBe('Save');
      });
    });
  });

  describe('Reset Functionality', () => {
    it('should reset to original config', async () => {
      const originalConfig = { test: 'original' };
      const { getByText, container, component, unmount } = render(ConfigPanel, {
        props: { 
          show: true,
          config: originalConfig
        }
      });
      cleanup.push(unmount);
      
      // Make changes
      const changeEvent = new CustomEvent('change', { detail: '{ "test": "modified" }' });
      component.$$.callbacks.change?.[0]?.(changeEvent);
      
      await waitFor(() => {
        expect(container.querySelector('.unsaved-indicator')).toBeTruthy();
      });
      
      // Click reset
      const resetButton = getByText('Reset');
      await fireEvent.click(resetButton);
      
      await waitFor(() => {
        expect(container.querySelector('.unsaved-indicator')).toBeFalsy();
      });
    });
  });

  describe('Import/Export', () => {
    it('should export config as file', async () => {
      const config = { test: 'value', nested: { key: 'data' } };
      const { getByText, unmount } = render(ConfigPanel, {
        props: { 
          show: true,
          config
        }
      });
      cleanup.push(unmount);
      
      // Mock creating and clicking download link
      const createElementSpy = vi.spyOn(document, 'createElement');
      const clickSpy = createSyncMock<[], void>();
      
      createElementSpy.mockImplementation((tagName) => {
        if (tagName === 'a') {
          return { click: clickSpy } as any;
        }
        return document.createElement(tagName);
      });
      
      const exportButton = getByText('Export');
      await fireEvent.click(exportButton);
      
      expect(clickSpy).toHaveBeenCalled();
      
      createElementSpy.mockRestore();
    });

    it('should handle import file', async () => {
      const { container, component, unmount } = render(ConfigPanel, {
        props: { 
          show: true,
          config: {}
        }
      });
      cleanup.push(unmount);
      
      const fileInput = container.querySelector('input[type="file"]');
      expect(fileInput).toBeTruthy();
      
      // Simulate file selection
      const file = new File(['{ "imported": true }'], 'config.json', { type: 'application/json' });
      const changeEvent = new Event('change', { bubbles: true });
      Object.defineProperty(changeEvent, 'target', {
        value: { files: [file] },
        enumerable: true
      });
      
      await fireEvent(fileInput!, changeEvent);
      
      // Would need to mock FileReader to fully test this
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should save on Ctrl+S', async () => {
      const { component, container, unmount } = render(ConfigPanel, {
        props: { 
          show: true,
          config: { test: 'value' }
        }
      });
      cleanup.push(unmount);
      
      const saveHandler = createSyncMock<[any], void>();
      const mockComponent = mockSvelteEvents(component);
      mockComponent.$on('save', saveHandler);
      
      await fireEvent.keyDown(container.querySelector('.config-panel')!, {
        key: 's',
        ctrlKey: true
      });
      
      expect(saveHandler).toHaveBeenCalled();
    });

    it('should close on Escape', async () => {
      const { component, container, unmount } = render(ConfigPanel, {
        props: { 
          show: true,
          config: {}
        }
      });
      cleanup.push(unmount);
      
      const closeHandler = createSyncMock<[any], void>();
      const mockComponent = mockSvelteEvents(component);
      mockComponent.$on('close', closeHandler);
      
      await fireEvent.keyDown(container.querySelector('.config-panel')!, {
        key: 'Escape'
      });
      
      expect(closeHandler).toHaveBeenCalled();
    });
  });
});