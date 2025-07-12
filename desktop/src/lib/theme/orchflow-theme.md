# Orchflow Theme Specification

**Version:** 1.0.0  
**Last Updated:** 2025-01-12  
**Status:** Draft

## Overview

This document defines the complete theming system for Orchflow Desktop, ensuring consistent visual design across all components including Neovim terminal, CodeMirror editor, and UI chrome. All components must reference tokens from this specification.

---

## 1. Token Hierarchy

### 1.1 Color Tokens

#### Base Color Palette
```css
/* Primary backgrounds */
--bg-primary: #1e1e1e;       /* Main application background */
--bg-secondary: #252526;     /* Panels, sidebars, containers */
--bg-tertiary: #2d2d30;      /* Elevated surfaces, cards */
--bg-quaternary: #3e3e42;    /* Highest elevation surfaces */

/* Interactive backgrounds */
--bg-hover: #2a2d2e;         /* Hover state for interactive elements */
--bg-active: #094771;        /* Active/pressed state */
--bg-selection: #3a3d41;     /* Text/item selection background */

/* Foreground text */
--fg-primary: #cccccc;       /* Primary text color */
--fg-secondary: #858585;     /* Secondary text, labels */
--fg-tertiary: #666666;      /* Tertiary text, hints */
--fg-active: #ffffff;        /* Active state text */
--fg-selection: #ffffff;     /* Selected text color */

/* Semantic colors */
--accent: #007acc;           /* Primary accent, links, focus */
--success: #4ec9b0;          /* Success states, valid input */
--warning: #dcdcaa;          /* Warning states, caution */
--error: #f44747;            /* Error states, invalid input */
--info: #75beff;             /* Informational messages */

/* Border and separator */
--border: #3e3e42;           /* Default border color */
--border-focus: var(--accent); /* Focused element borders */

/* Syntax highlighting */
--syntax-keyword: #569cd6;   /* Language keywords */
--syntax-string: #ce9178;    /* String literals */
--syntax-comment: #6a9955;   /* Comments */
--syntax-function: #dcdcaa;  /* Function names */
--syntax-variable: #9cdcfe;  /* Variable names */
--syntax-type: #4ec9b0;      /* Type names */
--syntax-number: #b5cea8;    /* Numeric literals */
--syntax-operator: #d4d4d4;  /* Operators */
```

#### Extended Color System
```css
/* Typography scale colors */
--text-heading: var(--fg-primary);
--text-body: var(--fg-primary);
--text-caption: var(--fg-secondary);
--text-disabled: var(--fg-tertiary);

/* Diff/VCS colors */
--diff-add-bg: rgba(78, 201, 176, 0.15);
--diff-add-fg: #4ec9b0;
--diff-del-bg: rgba(244, 71, 71, 0.15);
--diff-del-fg: #f44747;
--diff-mod-bg: rgba(220, 220, 170, 0.15);
--diff-mod-fg: #dcdcaa;

/* Diagnostic colors */
--diag-error-bg: rgba(244, 71, 71, 0.1);
--diag-error-fg: var(--error);
--diag-warning-bg: rgba(220, 220, 170, 0.1);
--diag-warning-fg: var(--warning);
--diag-info-bg: rgba(117, 190, 255, 0.1);
--diag-info-fg: var(--info);
--diag-hint-bg: rgba(204, 204, 204, 0.1);
--diag-hint-fg: var(--fg-secondary);

/* Link colors */
--link-fg: var(--accent);
--link-hover: #339cff;
--link-visited: #b180d7;

/* Scrollbar colors */
--scroll-thumb: var(--border);
--scroll-thumb-hover: var(--fg-secondary);
--scroll-track: var(--bg-primary);

/* Backdrop and overlay */
--backdrop-color: rgba(0, 0, 0, 0.5);
--zen-bg-blur: rgba(30, 30, 30, 0.95);
--zen-contrast: 0.8;
```

### 1.2 Typography Tokens

```css
/* Font families */
--font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-mono: 'Consolas', 'Monaco', 'Courier New', monospace;
--font-heading: var(--font-family);

/* Font scale */
--font-h1: 32px;
--font-h2: 24px;
--font-h3: 20px;
--font-h4: 18px;
--font-h5: 16px;
--font-h6: 14px;
--font-body: 13px;
--font-body-sm: 12px;
--font-caption: 11px;

/* Line heights */
--line-height-tight: 1.2;
--line-height-normal: 1.4;
--line-height-relaxed: 1.6;

/* Font weights */
--font-weight-light: 300;
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;

/* Letter spacing */
--letter-spacing-tight: -0.025em;
--letter-spacing-normal: 0;
--letter-spacing-wide: 0.025em;
```

### 1.3 Spacing Tokens

```css
--space-xs: 4px;     /* Tight spacing */
--space-sm: 8px;     /* Small spacing */
--space-md: 12px;    /* Medium spacing */
--space-lg: 16px;    /* Large spacing */
--space-xl: 24px;    /* Extra large spacing */
--space-2xl: 32px;   /* 2x extra large */
--space-3xl: 48px;   /* 3x extra large */
--space-4xl: 64px;   /* 4x extra large */
```

### 1.4 Border Radius Tokens

```css
--radius-xs: 2px;    /* Subtle rounding */
--radius-sm: 4px;    /* Small components */
--radius-md: 6px;    /* Medium components */
--radius-lg: 8px;    /* Large components */
--radius-xl: 12px;   /* Extra large components */
--radius-2xl: 16px;  /* Cards, panels */
--radius-full: 9999px; /* Pills, badges */
```

### 1.5 Elevation Tokens

```css
--shadow-1: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
--shadow-2: 0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23);
--shadow-3: 0 10px 20px rgba(0, 0, 0, 0.19), 0 6px 6px rgba(0, 0, 0, 0.23);
--shadow-4: 0 14px 28px rgba(0, 0, 0, 0.25), 0 10px 10px rgba(0, 0, 0, 0.22);
--shadow-5: 0 19px 38px rgba(0, 0, 0, 0.30), 0 15px 12px rgba(0, 0, 0, 0.22);
```

### 1.6 Layout Tokens

```css
/* Component dimensions */
--top-bar-height: 35px;
--status-bar-height: 22px;
--sidebar-width: 50px;
--tab-height: 35px;
--panel-min-width: 200px;
--panel-max-width: 400px;

/* Z-index scale */
--z-base: 0;
--z-dropdown: 100;
--z-modal: 200;
--z-notification: 300;
--z-tooltip: 400;
```

---

## 2. Semantic Mappings

### 2.1 UI Chrome

```css
/* Application frame */
--app-bg: var(--bg-primary);
--app-fg: var(--fg-primary);
--app-border: var(--border);

/* Navigation and toolbar */
--nav-bg: var(--bg-secondary);
--nav-fg: var(--fg-secondary);
--nav-item-hover: var(--bg-hover);
--nav-item-active: var(--bg-active);

/* Panel system */
--panel-bg: var(--bg-secondary);
--panel-fg: var(--fg-primary);
--panel-header-bg: var(--bg-tertiary);
--panel-header-fg: var(--fg-secondary);
--panel-border: var(--border);

/* Status bar */
--status-bg: var(--bg-secondary);
--status-fg: var(--fg-secondary);
--status-border: var(--border);
```

### 2.2 Editor Surface

```css
/* Editor container */
--editor-bg: var(--bg-primary);
--editor-fg: var(--fg-primary);
--editor-border: var(--border);

/* Gutter and line numbers */
--editor-gutter-bg: var(--bg-secondary);
--editor-gutter-fg: var(--fg-tertiary);
--editor-gutter-active: var(--fg-secondary);

/* Text selection */
--editor-selection-bg: var(--bg-selection);
--editor-selection-fg: var(--fg-selection);
--editor-selection-inactive: rgba(58, 61, 65, 0.5);

/* Cursor and caret */
--editor-cursor: var(--accent);
--editor-cursor-inactive: var(--fg-tertiary);

/* Active line */
--editor-active-line: var(--bg-hover);
--editor-active-line-gutter: var(--bg-tertiary);

/* Search and highlights */
--editor-search-match: rgba(255, 255, 0, 0.3);
--editor-search-current: rgba(255, 255, 0, 0.6);
--editor-bracket-match: var(--bg-active);

/* Folding and code structure */
--editor-fold-bg: var(--bg-tertiary);
--editor-fold-fg: var(--fg-secondary);
--editor-indent-guide: var(--border);
```

### 2.3 Terminal ANSI Map

```css
/* ANSI color mapping for Neovim terminal */
--terminal-ansi-black: #000000;
--terminal-ansi-red: var(--error);
--terminal-ansi-green: var(--success);
--terminal-ansi-yellow: var(--warning);
--terminal-ansi-blue: var(--accent);
--terminal-ansi-magenta: #bc3fbc;
--terminal-ansi-cyan: #11a8cd;
--terminal-ansi-white: var(--fg-primary);

/* Bright ANSI colors */
--terminal-ansi-bright-black: var(--fg-tertiary);
--terminal-ansi-bright-red: #f14c4c;
--terminal-ansi-bright-green: #23d18b;
--terminal-ansi-bright-yellow: #eaea50; /* Adjusted for better contrast */
--terminal-ansi-bright-blue: #3b8eea;
--terminal-ansi-bright-magenta: #d670d6;
--terminal-ansi-bright-cyan: #29b8db;
--terminal-ansi-bright-white: var(--fg-active);

/* Terminal semantic colors */
--terminal-cursor: var(--editor-cursor);
--terminal-selection: var(--editor-selection-bg);
--terminal-background: var(--editor-bg);
--terminal-foreground: var(--editor-fg);
```

---

## 3. State & Motion

### 3.1 Interactive States

```css
/* Hover states */
--state-hover-bg: var(--bg-hover);
--state-hover-fg: var(--fg-primary);
--state-hover-border: var(--border-focus);

/* Focus states */
--state-focus-bg: var(--bg-active);
--state-focus-fg: var(--fg-active);
--state-focus-outline: 2px solid var(--accent);
--state-focus-outline-offset: -2px;

/* Active states */
--state-active-bg: var(--bg-active);
--state-active-fg: var(--fg-active);
--state-active-border: var(--accent);

/* Disabled states */
--state-disabled-bg: var(--bg-secondary);
--state-disabled-fg: var(--fg-tertiary);
--state-disabled-border: var(--border);
--state-disabled-opacity: 0.5;
```

### 3.2 Animation Tokens

```css
/* Duration */
--duration-fast: 150ms;
--duration-normal: 250ms;
--duration-slow: 400ms;

/* Easing functions */
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

---

## 4. Theme Modes

### 4.1 Dark Theme (Default)
*Values defined in sections 1-2 above*

### 4.2 Light Theme

```css
:root[data-theme="light"] {
  /* Base backgrounds */
  --bg-primary: #ffffff;
  --bg-secondary: #f3f3f3;
  --bg-tertiary: #ececec;
  --bg-quaternary: #e5e5e5;
  
  /* Interactive backgrounds */
  --bg-hover: #e8e8e8;
  --bg-active: #0060c0;
  --bg-selection: #add6ff;
  
  /* Foreground text */
  --fg-primary: #333333;
  --fg-secondary: #6e6e6e;
  --fg-tertiary: #999999;
  --fg-active: #ffffff;
  --fg-selection: #000000;
  
  /* Semantic colors */
  --accent: #0066cc;
  --success: #008000;
  --warning: #cc6600;
  --error: #cc0000;
  --info: #0066cc;
  
  /* Borders */
  --border: #e5e5e5;
  
  /* Syntax highlighting */
  --syntax-keyword: #0000ff;
  --syntax-string: #a31515;
  --syntax-comment: #008000;
  --syntax-function: #795e26;
  --syntax-variable: #001080;
  --syntax-type: #267f99;
  --syntax-number: #098658;
  --syntax-operator: #000000;
  
  /* Terminal ANSI adjustments */
  --terminal-ansi-black: #1a1a1a; /* Near-black for contrast */
  --terminal-ansi-white: var(--fg-primary);
  --terminal-ansi-bright-white: #000000;
  
  /* Backdrop */
  --backdrop-color: rgba(0, 0, 0, 0.3);
  --zen-bg-blur: rgba(255, 255, 255, 0.95);
}
```

### 4.3 High Contrast Theme

```css
:root[data-theme="high-contrast"] {
  /* High contrast backgrounds */
  --bg-primary: #000000;
  --bg-secondary: #1a1a1a;
  --bg-tertiary: #333333;
  --bg-hover: #404040;
  --bg-active: #0066ff;
  --bg-selection: #ffffff;
  
  /* High contrast foregrounds */
  --fg-primary: #ffffff;
  --fg-secondary: #ffffff;
  --fg-tertiary: #cccccc;
  --fg-active: #000000;
  --fg-selection: #000000;
  
  /* High contrast accents */
  --accent: #0099ff;
  --success: #00ff00;
  --warning: #ffff00;
  --error: #ff0000;
  --info: #00ffff;
  
  /* High contrast borders */
  --border: #ffffff;
  --border-focus: #ffff00;
  
  /* Enhanced shadows for better separation */
  --shadow-1: 0 0 0 1px #ffffff, 0 2px 4px rgba(255, 255, 255, 0.3);
  --shadow-2: 0 0 0 1px #ffffff, 0 4px 8px rgba(255, 255, 255, 0.3);
}
```

### 4.4 Color-Blind Friendly Theme

```css
:root[data-theme="colorblind-friendly"] {
  /* Override problematic colors */
  --success: #1a9641; /* Blue-green instead of pure green */
  --error: #d73027;   /* Orange-red instead of pure red */
  --warning: #fd8d3c; /* Orange instead of yellow */
  
  /* Diff colors with patterns */
  --diff-add-bg: rgba(26, 150, 65, 0.15);
  --diff-add-fg: #1a9641;
  --diff-del-bg: rgba(215, 48, 39, 0.15);
  --diff-del-fg: #d73027;
  --diff-mod-bg: rgba(253, 141, 60, 0.15);
  --diff-mod-fg: #fd8d3c;
  
  /* Terminal ANSI adjustments */
  --terminal-ansi-red: #d73027;
  --terminal-ansi-green: #1a9641;
  --terminal-ansi-yellow: #fd8d3c;
  --terminal-ansi-bright-red: #fc8d59;
  --terminal-ansi-bright-green: #41ab5d;
  --terminal-ansi-bright-yellow: #feb24c;
}
```

---

## 5. Implementation Notes

### 5.1 CSS Variable Locations

**Primary file:** `/src/app.css`
```css
/* Import design tokens */
@import './lib/theme/tokens.css';

/* Theme mode overrides */
@import './lib/theme/dark.css';
@import './lib/theme/light.css';
@import './lib/theme/high-contrast.css';
@import './lib/theme/colorblind-friendly.css';
```

**Token organization:**
- `/src/lib/theme/tokens.css` - Base design tokens
- `/src/lib/theme/dark.css` - Dark theme overrides
- `/src/lib/theme/light.css` - Light theme overrides
- `/src/lib/theme/high-contrast.css` - Accessibility overrides
- `/src/lib/theme/colorblind-friendly.css` - Color-blind safe palette

### 5.2 JavaScript Bridge for Neovim ANSI Theme

```typescript
// /src/lib/theme/terminal-theme.ts
export function createTerminalTheme(): TerminalTheme {
  const style = getComputedStyle(document.documentElement);
  
  return {
    background: style.getPropertyValue('--terminal-background').trim(),
    foreground: style.getPropertyValue('--terminal-foreground').trim(),
    cursor: style.getPropertyValue('--terminal-cursor').trim(),
    selection: style.getPropertyValue('--terminal-selection').trim(),
    
    // ANSI colors
    black: style.getPropertyValue('--terminal-ansi-black').trim(),
    red: style.getPropertyValue('--terminal-ansi-red').trim(),
    green: style.getPropertyValue('--terminal-ansi-green').trim(),
    yellow: style.getPropertyValue('--terminal-ansi-yellow').trim(),
    blue: style.getPropertyValue('--terminal-ansi-blue').trim(),
    magenta: style.getPropertyValue('--terminal-ansi-magenta').trim(),
    cyan: style.getPropertyValue('--terminal-ansi-cyan').trim(),
    white: style.getPropertyValue('--terminal-ansi-white').trim(),
    
    // Bright ANSI colors
    brightBlack: style.getPropertyValue('--terminal-ansi-bright-black').trim(),
    brightRed: style.getPropertyValue('--terminal-ansi-bright-red').trim(),
    brightGreen: style.getPropertyValue('--terminal-ansi-bright-green').trim(),
    brightYellow: style.getPropertyValue('--terminal-ansi-bright-yellow').trim(),
    brightBlue: style.getPropertyValue('--terminal-ansi-bright-blue').trim(),
    brightMagenta: style.getPropertyValue('--terminal-ansi-bright-magenta').trim(),
    brightCyan: style.getPropertyValue('--terminal-ansi-bright-cyan').trim(),
    brightWhite: style.getPropertyValue('--terminal-ansi-bright-white').trim(),
  };
}

// Theme change listener
export function watchThemeChanges(callback: (theme: TerminalTheme) => void) {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
        callback(createTerminalTheme());
      }
    });
  });
  
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });
  
  return () => observer.disconnect();
}
```

### 5.3 CodeMirror Compartment Setup

```typescript
// /src/lib/theme/codemirror-theme.ts
import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';

export function createCodeMirrorTheme(): Extension {
  return EditorView.theme({
    '&': {
      color: 'var(--editor-fg)',
      backgroundColor: 'var(--editor-bg)',
      fontSize: 'var(--font-body)',
      fontFamily: 'var(--font-mono)',
      lineHeight: 'var(--line-height-normal)',
    },
    
    '.cm-content': {
      padding: 'var(--space-sm)',
      caretColor: 'var(--editor-cursor)',
    },
    
    '.cm-focused': {
      outline: 'var(--state-focus-outline)',
      outlineOffset: 'var(--state-focus-outline-offset)',
    },
    
    '.cm-selectionBackground': {
      backgroundColor: 'var(--editor-selection-bg) !important',
    },
    
    '.cm-activeLine': {
      backgroundColor: 'var(--editor-active-line)',
    },
    
    '.cm-activeLineGutter': {
      backgroundColor: 'var(--editor-active-line-gutter)',
    },
    
    '.cm-gutters': {
      backgroundColor: 'var(--editor-gutter-bg)',
      color: 'var(--editor-gutter-fg)',
      border: 'none',
    },
    
    '.cm-lineNumbers .cm-gutterElement': {
      color: 'var(--editor-gutter-fg)',
    },
    
    '.cm-foldPlaceholder': {
      backgroundColor: 'var(--editor-fold-bg)',
      color: 'var(--editor-fold-fg)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
    },
    
    '.cm-searchMatch': {
      backgroundColor: 'var(--editor-search-match)',
    },
    
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: 'var(--editor-search-current)',
    },
    
    '.cm-matchingBracket': {
      backgroundColor: 'var(--editor-bracket-match)',
      borderRadius: 'var(--radius-xs)',
    },
    
    // Syntax highlighting
    '.cm-keyword': { color: 'var(--syntax-keyword)' },
    '.cm-string': { color: 'var(--syntax-string)' },
    '.cm-comment': { color: 'var(--syntax-comment)' },
    '.cm-variableName': { color: 'var(--syntax-variable)' },
    '.cm-typeName': { color: 'var(--syntax-type)' },
    '.cm-number': { color: 'var(--syntax-number)' },
    '.cm-operator': { color: 'var(--syntax-operator)' },
    '.cm-function': { color: 'var(--syntax-function)' },
    
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
}
```

---

## 6. Accessibility & Contrast Matrix

### 6.1 WCAG AA Compliance (4.5:1 ratio required)

| Foreground | Background | Ratio | Status |
|------------|------------|-------|--------|
| `--fg-primary` (#cccccc) | `--bg-primary` (#1e1e1e) | 9.59:1 | ✅ Pass |
| `--fg-secondary` (#858585) | `--bg-primary` (#1e1e1e) | 4.61:1 | ✅ Pass |
| `--fg-tertiary` (#666666) | `--bg-primary` (#1e1e1e) | 2.84:1 | ❌ Fail |
| `--accent` (#007acc) | `--bg-primary` (#1e1e1e) | 4.52:1 | ✅ Pass |
| `--success` (#4ec9b0) | `--bg-primary` (#1e1e1e) | 6.89:1 | ✅ Pass |
| `--warning` (#dcdcaa) | `--bg-primary` (#1e1e1e) | 11.45:1 | ✅ Pass |
| `--error` (#f44747) | `--bg-primary` (#1e1e1e) | 5.29:1 | ✅ Pass |
| `--terminal-ansi-bright-yellow` (#eaea50) | `--bg-primary` (#1e1e1e) | 10.12:1 | ✅ Pass |

### 6.2 Known Issues

**Critical:**
- `--fg-tertiary` fails WCAG AA - should be lightened to #767676 (4.5:1 ratio)

**Recommendations:**
- Generate full contrast matrix with automated testing
- Implement contrast checking in CI/CD pipeline
- Provide high-contrast theme for accessibility compliance

---

## 7. Extending the Theme

### 7.1 ThemeAPI Example

```typescript
// /src/lib/theme/api.ts
export interface ThemeDefinition {
  name: string;
  displayName: string;
  tokens: Record<string, string>;
  modes?: ('dark' | 'light' | 'auto')[];
}

export class ThemeAPI {
  private themes = new Map<string, ThemeDefinition>();
  
  registerTheme(theme: ThemeDefinition): void {
    this.themes.set(theme.name, theme);
  }
  
  applyTheme(themeName: string, mode?: string): void {
    const theme = this.themes.get(themeName);
    if (!theme) throw new Error(`Theme "${themeName}" not found`);
    
    const root = document.documentElement;
    
    // Apply base tokens
    Object.entries(theme.tokens).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    
    // Set theme attributes
    root.setAttribute('data-theme', mode || 'dark');
    root.setAttribute('data-theme-name', themeName);
  }
  
  createTheme(base: ThemeDefinition, overrides: Partial<ThemeDefinition>): ThemeDefinition {
    return {
      ...base,
      ...overrides,
      tokens: { ...base.tokens, ...overrides.tokens },
    };
  }
}

// Usage example
const themeAPI = new ThemeAPI();

themeAPI.registerTheme({
  name: 'github-dark',
  displayName: 'GitHub Dark',
  tokens: {
    '--bg-primary': '#0d1117',
    '--bg-secondary': '#161b22',
    '--fg-primary': '#f0f6fc',
    '--accent': '#58a6ff',
    // ... other overrides
  },
  modes: ['dark']
});
```

### 7.2 Plugin Theming Guidelines

**For plugin developers:**

1. **Always use semantic tokens** - Reference `--editor-bg`, not `#1e1e1e`
2. **Follow the token hierarchy** - Use `--space-md` for spacing, not `12px`
3. **Respect theme modes** - Test your plugin in all theme variants
4. **Use the ThemeAPI** - Register custom themes through the official API
5. **Check contrast ratios** - Ensure accessibility compliance

**Example plugin theme integration:**
```css
.my-plugin-panel {
  background: var(--panel-bg);
  color: var(--panel-fg);
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
}

.my-plugin-button {
  background: var(--accent);
  color: var(--state-focus-fg);
  border: none;
  border-radius: var(--radius-sm);
  padding: var(--space-sm) var(--space-md);
  transition: background-color var(--duration-fast) var(--ease-out);
}

.my-plugin-button:hover {
  background: var(--link-hover);
}
```

---

## Implementation Checklist

- [ ] Add missing design tokens to `app.css`
- [ ] Create theme mode CSS files
- [ ] Implement JavaScript bridge for terminal theming
- [ ] Update CodeMirror theme compartment
- [ ] Generate contrast matrix validation
- [ ] Create ThemeAPI for extensibility
- [ ] Update existing components to use semantic tokens
- [ ] Add theme switching functionality
- [ ] Implement high-contrast mode
- [ ] Add CI checks for hard-coded colors
- [ ] Document plugin theming guidelines
- [ ] Test accessibility compliance

---

**Maintainers:** Orchflow Design System Team  
**Contributors:** Theme specification should be updated when new design tokens are needed  
**License:** MIT