<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { EditorView, basicSetup } from '@codemirror/basic-setup';
  import { EditorState } from '@codemirror/state';
  import { javascript } from '@codemirror/lang-javascript';
  import { json } from '@codemirror/lang-json';
  import { python } from '@codemirror/lang-python';
  import { rust } from '@codemirror/lang-rust';
  import { oneDark } from '@codemirror/theme-one-dark';
  import { keymap } from '@codemirror/view';
  import { indentWithTab } from '@codemirror/commands';
  
  export let value = '';
  export let language = 'json';
  export let theme = 'dark';
  export let readOnly = false;
  export let lineNumbers = true;
  export let wordWrap = true;
  export let fontSize = 14;
  export let height = '400px';
  
  const dispatch = createEventDispatcher();
  
  let containerEl: HTMLDivElement;
  let view: EditorView | null = null;
  let loading = true;
  let error: string | null = null;
  
  // Language support mapping
  const languages = {
    javascript: javascript(),
    typescript: javascript({ typescript: true }),
    json: json(),
    python: python(),
    rust: rust(),
  };
  
  function getLanguageSupport(lang: string) {
    return languages[lang] || languages.javascript;
  }
  
  onMount(async () => {
    try {
      // Create CodeMirror instance
      const startState = EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          getLanguageSupport(language),
          theme === 'dark' ? oneDark : [],
          EditorView.lineWrapping,
          EditorView.theme({
            '&': { fontSize: fontSize + 'px' },
            '.cm-content': { fontFamily: 'Fira Code, monospace' },
          }),
          EditorState.readOnly.of(readOnly),
          keymap.of([indentWithTab]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              const newValue = update.state.doc.toString();
              value = newValue;
              dispatch('change', newValue);
            }
          }),
        ],
      });
      
      view = new EditorView({
        state: startState,
        parent: containerEl,
      });
      
      loading = false;
      dispatch('ready', { editor: view });
      
    } catch (err) {
      console.error('Failed to load CodeMirror:', err);
      error = 'Failed to load editor';
      loading = false;
    }
  });
  
  onDestroy(() => {
    if (view) {
      view.destroy();
    }
  });
  
  // Reactive updates
  $: if (view && value !== view.state.doc.toString()) {
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: value,
      },
    });
  }
  
  $: if (view) {
    view.dispatch({
      effects: EditorState.readOnly.reconfigure(EditorState.readOnly.of(readOnly))
    });
  }
  
  export function focus() {
    view?.focus();
  }
  
  export function getEditor() {
    return view;
  }
  
  export function format() {
    // CodeMirror doesn't have built-in formatting
    // You could integrate prettier here if needed
    console.log('Formatting not implemented');
  }
  
  export function setLanguage(lang: string) {
    if (view) {
      view.dispatch({
        effects: EditorState.reconfigure.of([
          basicSetup,
          getLanguageSupport(lang),
          theme === 'dark' ? oneDark : [],
          EditorView.lineWrapping,
        ])
      });
    }
  }
</script>

<div class="codemirror-editor-container" style="height: {height}">
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading editor...</p>
    </div>
  {:else if error}
    <div class="error">
      <p>{error}</p>
    </div>
  {/if}
  <div bind:this={containerEl} class="editor-mount" class:loading></div>
</div>

<style>
  .codemirror-editor-container {
    position: relative;
    width: 100%;
    border: 1px solid var(--color-border, #45475a);
    border-radius: 4px;
    overflow: hidden;
    background: var(--color-bg-secondary, #1e1e2e);
  }
  
  .editor-mount {
    width: 100%;
    height: 100%;
  }
  
  .editor-mount.loading {
    opacity: 0;
  }
  
  .loading, .error {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: var(--color-text-secondary, #bac2de);
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    margin: 0 auto 16px;
    border: 3px solid var(--color-border, #45475a);
    border-top-color: var(--color-primary, #89b4fa);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .error {
    color: var(--color-error, #f38ba8);
  }
  
  /* CodeMirror specific styling */
  :global(.cm-editor) {
    height: 100%;
  }
  
  :global(.cm-focused) {
    outline: none;
  }
</style>