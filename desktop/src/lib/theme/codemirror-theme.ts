/**
 * CodeMirror Theme Integration
 * 
 * Creates CodeMirror themes that use Orchflow design tokens
 * for consistent styling across all editors.
 */

import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';

export interface CodeMirrorThemeOptions {
  variant?: 'default' | 'compact' | 'comfortable';
  showLineNumbers?: boolean;
  highlightActiveLine?: boolean;
}

/**
 * Create a CodeMirror theme that uses CSS custom properties
 * This ensures the editor automatically adapts to theme changes
 */
export function createCodeMirrorTheme(options: CodeMirrorThemeOptions = {}): Extension {
  const {
    variant = 'default',
    showLineNumbers = true,
    highlightActiveLine = true
  } = options;

  const baseTheme = EditorView.theme({
    // Editor container
    '&': {
      color: 'var(--editor-fg)',
      backgroundColor: 'var(--editor-bg)',
      fontSize: 'var(--font-body)',
      fontFamily: 'var(--font-mono)',
      lineHeight: 'var(--line-height-normal)',
      height: '100%',
    },
    
    // Content area
    '.cm-content': {
      padding: variant === 'compact' ? 'var(--space-xs)' : 'var(--space-sm)',
      caretColor: 'var(--editor-cursor)',
      minHeight: '100%',
    },
    
    // Focus state
    '.cm-focused': {
      outline: 'var(--state-focus-outline)',
      outlineOffset: 'var(--state-focus-outline-offset)',
    },
    
    // Text selection
    '.cm-selectionBackground': {
      backgroundColor: 'var(--editor-selection-bg) !important',
    },
    
    '.cm-selectionBackground.cm-selectionBackground': {
      backgroundColor: 'var(--editor-selection-bg) !important',
    },
    
    // Active line highlighting
    ...(highlightActiveLine && {
      '.cm-activeLine': {
        backgroundColor: 'var(--editor-active-line)',
      },
      
      '.cm-activeLineGutter': {
        backgroundColor: 'var(--editor-active-line-gutter)',
        color: 'var(--editor-gutter-active)',
      },
    }),
    
    // Gutters
    '.cm-gutters': {
      backgroundColor: 'var(--editor-gutter-bg)',
      color: 'var(--editor-gutter-fg)',
      border: 'none',
      borderRight: '1px solid var(--editor-border)',
    },
    
    // Line numbers
    ...(showLineNumbers && {
      '.cm-lineNumbers': {
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--font-body-sm)',
      },
      
      '.cm-lineNumbers .cm-gutterElement': {
        color: 'var(--editor-gutter-fg)',
        padding: `0 var(--space-sm) 0 var(--space-xs)`,
        minWidth: '3ch',
        textAlign: 'right',
      },
    }),
    
    // Folding
    '.cm-foldPlaceholder': {
      backgroundColor: 'var(--editor-fold-bg)',
      color: 'var(--editor-fold-fg)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      padding: '0 var(--space-xs)',
      margin: '0 var(--space-xs)',
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--font-body-sm)',
    },
    
    '.cm-foldGutter .cm-gutterElement': {
      color: 'var(--editor-gutter-fg)',
      cursor: 'pointer',
    },
    
    '.cm-foldGutter .cm-gutterElement:hover': {
      color: 'var(--editor-gutter-active)',
    },
    
    // Search highlighting
    '.cm-searchMatch': {
      backgroundColor: 'var(--editor-search-match)',
      borderRadius: 'var(--radius-xs)',
    },
    
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: 'var(--editor-search-current)',
    },
    
    // Bracket matching
    '.cm-matchingBracket': {
      backgroundColor: 'var(--editor-bracket-match)',
      borderRadius: 'var(--radius-xs)',
      outline: '1px solid var(--accent)',
    },
    
    '.cm-nonmatchingBracket': {
      backgroundColor: 'var(--diag-error-bg)',
      color: 'var(--diag-error-fg)',
      borderRadius: 'var(--radius-xs)',
    },
    
    // Cursor
    '.cm-cursor': {
      borderLeft: '2px solid var(--editor-cursor)',
    },
    
    '.cm-cursor.cm-cursor-secondary': {
      borderLeft: '1px solid var(--editor-cursor-inactive)',
    },
    
    // Indent guides (if extension is loaded)
    '.cm-indent-guides .cm-indent-guide': {
      borderLeft: '1px solid var(--editor-indent-guide)',
    },
    
    '.cm-indent-guides .cm-indent-guide.cm-indent-guide-active': {
      borderLeft: '1px solid var(--accent)',
    },
    
    // Panels (search, goto line, etc.)
    '.cm-panels': {
      backgroundColor: 'var(--bg-secondary)',
      color: 'var(--fg-primary)',
      border: '1px solid var(--border)',
    },
    
    '.cm-panel.cm-search': {
      padding: 'var(--space-sm)',
      gap: 'var(--space-sm)',
    },
    
    '.cm-textfield': {
      backgroundColor: 'var(--bg-primary)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      color: 'var(--fg-primary)',
      padding: 'var(--space-xs) var(--space-sm)',
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--font-body-sm)',
    },
    
    '.cm-textfield:focus': {
      outline: 'var(--state-focus-outline)',
      outlineOffset: 'var(--state-focus-outline-offset)',
      borderColor: 'var(--accent)',
    },
    
    '.cm-button': {
      backgroundColor: 'var(--accent)',
      color: 'var(--state-focus-fg)',
      border: 'none',
      borderRadius: 'var(--radius-sm)',
      padding: 'var(--space-xs) var(--space-sm)',
      fontFamily: 'var(--font-family)',
      fontSize: 'var(--font-body-sm)',
      cursor: 'pointer',
      transition: 'background-color var(--duration-fast) var(--ease-out)',
    },
    
    '.cm-button:hover': {
      backgroundColor: 'var(--link-hover)',
    },
    
    '.cm-button:active': {
      backgroundColor: 'var(--state-active-bg)',
    },
    
    // Tooltips
    '.cm-tooltip': {
      backgroundColor: 'var(--bg-tertiary)',
      color: 'var(--fg-primary)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-sm)',
      boxShadow: 'var(--shadow-2)',
      fontFamily: 'var(--font-family)',
      fontSize: 'var(--font-body-sm)',
      maxWidth: '300px',
    },
    
    // Completion popup
    '.cm-completionLabel': {
      color: 'var(--fg-primary)',
    },
    
    '.cm-completionDetail': {
      color: 'var(--fg-secondary)',
      fontStyle: 'italic',
    },
    
    '.cm-completionInfo': {
      backgroundColor: 'var(--bg-tertiary)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      padding: 'var(--space-sm)',
      color: 'var(--fg-primary)',
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--font-body-sm)',
    },
    
    // Error and diagnostic styling
    '.cm-diagnostic-error': {
      borderBottom: '2px wavy var(--diag-error-fg)',
    },
    
    '.cm-diagnostic-warning': {
      borderBottom: '2px wavy var(--diag-warning-fg)',
    },
    
    '.cm-diagnostic-info': {
      borderBottom: '2px wavy var(--diag-info-fg)',
    },
    
    '.cm-diagnostic-hint': {
      borderBottom: '1px dotted var(--diag-hint-fg)',
    },
  });

  const syntaxTheme = EditorView.theme({
    // Syntax highlighting using design tokens
    '.cm-keyword': { 
      color: 'var(--syntax-keyword)',
      fontWeight: 'var(--font-weight-medium)' 
    },
    '.cm-string': { 
      color: 'var(--syntax-string)' 
    },
    '.cm-comment': { 
      color: 'var(--syntax-comment)',
      fontStyle: 'italic' 
    },
    '.cm-variableName': { 
      color: 'var(--syntax-variable)' 
    },
    '.cm-typeName': { 
      color: 'var(--syntax-type)',
      fontWeight: 'var(--font-weight-medium)' 
    },
    '.cm-number': { 
      color: 'var(--syntax-number)' 
    },
    '.cm-operator': { 
      color: 'var(--syntax-operator)' 
    },
    '.cm-function': { 
      color: 'var(--syntax-function)',
      fontWeight: 'var(--font-weight-medium)' 
    },
    '.cm-propertyName': { 
      color: 'var(--syntax-variable)' 
    },
    '.cm-literal': { 
      color: 'var(--syntax-number)' 
    },
    '.cm-definition': { 
      color: 'var(--syntax-function)',
      fontWeight: 'var(--font-weight-medium)' 
    },
    '.cm-className': { 
      color: 'var(--syntax-type)',
      fontWeight: 'var(--font-weight-medium)' 
    },
    '.cm-namespace': { 
      color: 'var(--syntax-type)' 
    },
    '.cm-meta': { 
      color: 'var(--fg-secondary)' 
    },
    '.cm-tag': { 
      color: 'var(--syntax-keyword)' 
    },
    '.cm-attribute': { 
      color: 'var(--syntax-variable)' 
    },
    '.cm-url': { 
      color: 'var(--link-fg)',
      textDecoration: 'underline' 
    },
    '.cm-link': { 
      color: 'var(--link-fg)',
      textDecoration: 'underline' 
    },
  });

  return [baseTheme, syntaxTheme];
}

/**
 * Create a minimal theme for inline code editors
 */
export function createInlineCodeMirrorTheme(): Extension {
  return EditorView.theme({
    '&': {
      fontSize: 'var(--font-body-sm)',
      fontFamily: 'var(--font-mono)',
    },
    
    '.cm-content': {
      padding: 'var(--space-xs)',
      minHeight: 'auto',
    },
    
    '.cm-focused': {
      outline: 'none',
    },
    
    '.cm-gutters': {
      display: 'none',
    },
    
    '.cm-activeLine': {
      backgroundColor: 'transparent',
    },
  });
}

/**
 * Get theme configuration for different editor contexts
 */
export function getCodeMirrorThemeForContext(context: 'main' | 'inline' | 'modal'): Extension {
  switch (context) {
    case 'inline':
      return createInlineCodeMirrorTheme();
    case 'modal':
      return createCodeMirrorTheme({ variant: 'compact' });
    default:
      return createCodeMirrorTheme();
  }
}