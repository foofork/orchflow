<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { EditorView, keymap, lineNumbers as lineNumbersExt, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine } from '@codemirror/view';
  import { EditorState, Compartment } from '@codemirror/state';
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
  export let showFormatButton = true;
  
  const dispatch = createEventDispatcher();
  
  let containerEl: HTMLDivElement;
  let view: EditorView | null = null;
  let loading = true;
  let error: string | null = null;
  let themeUnsubscribe: (() => void) | null = null;
  let formatting = false;
  
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
          indentWithTab,
          // Custom format keybinding
          {
            key: 'Shift-Alt-f',
            run: () => {
              format();
              return true;
            }
          }
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
  
  export async function format() {
    if (!view || formatting) return;

    formatting = true;
    try {
      const doc = view.state.doc.toString();
      let formatted: string;

      // Format based on language
      switch (language) {
        case 'javascript':
        case 'typescript':
          formatted = await formatWithPrettier(doc, 'javascript');
          break;
        case 'json':
          try {
            // For JSON, use native JSON.parse/stringify for basic formatting
            formatted = JSON.stringify(JSON.parse(doc), null, 2);
          } catch {
            // If invalid JSON, try prettier
            formatted = await formatWithPrettier(doc, 'json');
          }
          break;
        case 'yaml':
          formatted = await formatWithPrettier(doc, 'yaml');
          break;
        case 'rust':
          // For Rust, we could integrate rustfmt in the future
          formatted = doc;
          break;
        case 'python':
          // For Python, we could integrate black/autopep8 in the future
          formatted = doc;
          break;
        default:
          formatted = doc;
      }

      if (formatted !== doc) {
        view.dispatch({
          changes: {
            from: 0,
            to: view.state.doc.length,
            insert: formatted,
          },
          selection: { anchor: 0 }
        });
        dispatch('format', { language, original: doc, formatted });
      }
    } catch (error) {
      console.error('Formatting failed:', error);
      dispatch('formatError', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      formatting = false;
    }
  }

  async function formatWithPrettier(code: string, parser: string): Promise<string> {
    try {
      // Dynamic import of prettier to keep bundle size down
      const prettier = await import('prettier/standalone');
      const plugins = await Promise.all([
        import('prettier/plugins/babel'),
        import('prettier/plugins/estree'),
        import('prettier/plugins/typescript'),
        import('prettier/plugins/yaml')
      ]);

      const parserMap: Record<string, string> = {
        'javascript': 'babel',
        'typescript': 'typescript',
        'json': 'json',
        'yaml': 'yaml'
      };

      return await prettier.format(code, {
        parser: parserMap[parser] || 'babel',
        plugins: plugins.map(p => p.default),
        semi: true,
        singleQuote: true,
        tabWidth: 2,
        trailingComma: 'es5',
        printWidth: 80,
        bracketSpacing: true,
        arrowParens: 'avoid',
      });
    } catch (error) {
      console.error('Prettier formatting failed:', error);
      return code; // Return original if formatting fails
    }
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
          indentWithTab,
          // Custom format keybinding
          {
            key: 'Shift-Alt-f',
            run: () => {
              format();
              return true;
            }
          }
        ])
      ];

      view.dispatch({
        effects: languageCompartment.reconfigure(getLanguageSupport(lang))
      });
    }
  }
</script>

<div class="codemirror-editor-container" style="height: {height}">
  {#if showFormatButton && !readOnly}
    <div class="editor-toolbar">
      <button
        class="format-button"
        on:click={format}
        disabled={formatting || loading}
        title="Format Code (Shift+Alt+F)"
        aria-label="Format code"
      >
        {#if formatting}
          <div class="format-spinner"></div>
        {:else}
          <div class="format-icon">⚡</div>
        {/if}
        Format
      </button>
    </div>
  {/if}
  
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

  .editor-toolbar {
    display: flex;
    justify-content: flex-end;
    padding: 8px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    gap: 8px;
  }

  .format-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--accent);
    color: var(--accent-fg);
    border: none;
    border-radius: var(--radius-sm);
    font-size: var(--font-body-xs);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-out);
  }

  .format-button:hover:not(:disabled) {
    background: var(--accent-hover);
    transform: translateY(-1px);
  }

  .format-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .format-icon {
    font-size: 14px;
  }

  .format-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin var(--duration-normal) linear infinite;
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