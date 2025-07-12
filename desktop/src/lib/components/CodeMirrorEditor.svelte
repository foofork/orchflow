<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { EditorView, keymap, lineNumbers as lineNumbersExt, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine, placeholder } from '@codemirror/view';
  import { EditorState, Compartment, StateEffect } from '@codemirror/state';
  import { javascript } from '@codemirror/lang-javascript';
  import { json } from '@codemirror/lang-json';
  import { python } from '@codemirror/lang-python';
  import { rust } from '@codemirror/lang-rust';
  import { yaml } from '@codemirror/lang-yaml';
  import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
  import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
  import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
  import { bracketMatching, indentOnInput, syntaxHighlighting, defaultHighlightStyle, foldGutter } from '@codemirror/language';
  import { lintKeymap } from '@codemirror/lint';
  import { createCodeMirrorTheme } from '$lib/theme/codemirror-theme';
  import { onThemeChange } from '$lib/theme/api';
  
  export let value = '';
  export let language = 'json';
  export let readOnly = false;
  export let lineNumbers = true;
  export let wordWrap = true;
  export let height = '400px';
  export let variant: 'default' | 'compact' | 'comfortable' = 'default';
  
  const dispatch = createEventDispatcher();
  
  let containerEl: HTMLDivElement;
  let view: EditorView | null = null;
  let loading = true;
  let error: string | null = null;
  let themeUnsubscribe: (() => void) | null = null;
  
  // Compartments for reactive configurations
  const readOnlyCompartment = new Compartment();
  const languageCompartment = new Compartment();
  const themeCompartment = new Compartment();
  const lineWrappingCompartment = new Compartment();
  
  // Language support mapping
  const languages = {
    javascript: javascript(),
    typescript: javascript({ typescript: true }),
    json: json(),
    python: python(),
    rust: rust(),
    yaml: yaml(),
  };
  
  function getLanguageSupport(lang: string) {
    return languages[lang as keyof typeof languages] || languages.javascript;
  }
  
  onMount(async () => {
    try {
      // Create CodeMirror instance with unified theme
      const basicExtensions = [
        lineNumbers ? lineNumbersExt() : [],
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...completionKeymap,
          ...lintKeymap,
          indentWithTab
        ])
      ];

      // Create theme based on design tokens
      const orchflowTheme = createCodeMirrorTheme({
        variant,
        showLineNumbers: lineNumbers,
        highlightActiveLine: true
      });

      const startState = EditorState.create({
        doc: value,
        extensions: [
          ...basicExtensions,
          languageCompartment.of(getLanguageSupport(language)),
          themeCompartment.of(orchflowTheme),
          lineWrappingCompartment.of(wordWrap ? EditorView.lineWrapping : []),
          readOnlyCompartment.of(EditorState.readOnly.of(readOnly)),
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
      
      // Watch for theme changes and update editor
      themeUnsubscribe = onThemeChange(() => {
        if (view) {
          const newTheme = createCodeMirrorTheme({
            variant,
            showLineNumbers: lineNumbers,
            highlightActiveLine: true
          });
          view.dispatch({
            effects: themeCompartment.reconfigure(newTheme)
          });
        }
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
    if (themeUnsubscribe) {
      themeUnsubscribe();
    }
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
      effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(readOnly))
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
      // Recreate basic extensions like in onMount
      const basicExtensions = [
        lineNumbers ? lineNumbersExt() : [],
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...completionKeymap,
          ...lintKeymap,
          indentWithTab
        ])
      ];

      view.dispatch({
        effects: languageCompartment.reconfigure(getLanguageSupport(lang))
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
    border: 1px solid var(--editor-border);
    border-radius: var(--radius-sm);
    overflow: hidden;
    background: var(--editor-bg);
  }
  
  .editor-mount {
    width: 100%;
    height: 100%;
  }
  
  .editor-mount.loading {
    opacity: 0;
    transition: opacity var(--duration-normal) var(--ease-out);
  }
  
  .loading, .error {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: var(--fg-secondary);
    font-family: var(--font-family);
    font-size: var(--font-body-sm);
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    margin: 0 auto var(--space-lg);
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin var(--duration-slow) linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .error {
    color: var(--error);
  }
  
  /* CodeMirror specific styling is handled by the theme system */
  :global(.cm-editor) {
    height: 100%;
    font-family: var(--font-mono);
    font-size: var(--font-body);
  }
  
  :global(.cm-focused) {
    outline: var(--state-focus-outline);
    outline-offset: var(--state-focus-outline-offset);
  }
</style>