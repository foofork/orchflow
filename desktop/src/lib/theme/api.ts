/**
 * Orchflow Theme API
 * 
 * Provides a unified interface for theme management, including
 * registration of custom themes, theme switching, and editor integration.
 */

export interface ThemeDefinition {
  name: string;
  displayName: string;
  tokens: Record<string, string>;
  modes?: ('dark' | 'light' | 'high-contrast' | 'colorblind-friendly')[];
  description?: string;
  author?: string;
  version?: string;
}

export interface TerminalTheme {
  background: string;
  foreground: string;
  cursor: string;
  selection: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export class ThemeAPI {
  private themes = new Map<string, ThemeDefinition>();
  private currentTheme: string = 'orchflow';
  private currentMode: string = 'dark';
  private listeners = new Set<(theme: string, mode: string) => void>();

  constructor() {
    this.registerDefaultThemes();
  }

  /**
   * Register a new theme
   */
  registerTheme(theme: ThemeDefinition): void {
    this.themes.set(theme.name, theme);
  }

  /**
   * Get all registered themes
   */
  getThemes(): ThemeDefinition[] {
    return Array.from(this.themes.values());
  }

  /**
   * Get a specific theme by name
   */
  getTheme(name: string): ThemeDefinition | undefined {
    return this.themes.get(name);
  }

  /**
   * Apply a theme with optional mode
   */
  applyTheme(themeName: string, mode?: string): void {
    const theme = this.themes.get(themeName);
    if (!theme) {
      throw new Error(`Theme "${themeName}" not found`);
    }

    const root = document.documentElement;
    
    // Apply base tokens if it's a custom theme
    if (themeName !== 'orchflow') {
      Object.entries(theme.tokens).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
    }
    
    // Set theme attributes
    const themeMode = mode || this.currentMode;
    root.setAttribute('data-theme', themeMode);
    root.setAttribute('data-theme-name', themeName);
    
    this.currentTheme = themeName;
    this.currentMode = themeMode;
    
    // Notify listeners
    this.listeners.forEach(listener => listener(themeName, themeMode));
  }

  /**
   * Get current theme info
   */
  getCurrentTheme(): { name: string; mode: string } {
    return {
      name: this.currentTheme,
      mode: this.currentMode
    };
  }

  /**
   * Toggle between light and dark modes
   */
  toggleMode(): void {
    const newMode = this.currentMode === 'dark' ? 'light' : 'dark';
    this.applyTheme(this.currentTheme, newMode);
  }

  /**
   * Create a new theme based on an existing one
   */
  createTheme(
    base: ThemeDefinition, 
    overrides: Partial<ThemeDefinition>
  ): ThemeDefinition {
    return {
      ...base,
      ...overrides,
      tokens: { ...base.tokens, ...overrides.tokens },
    };
  }

  /**
   * Add theme change listener
   */
  onThemeChange(listener: (theme: string, mode: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Create terminal theme from current CSS variables
   */
  createTerminalTheme(): TerminalTheme {
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

  /**
   * Watch for theme changes and update terminal/editors
   */
  watchThemeChanges(callback: (terminalTheme: TerminalTheme) => void): () => void {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === 'attributes' && 
          (mutation.attributeName === 'data-theme' || mutation.attributeName === 'data-theme-name')
        ) {
          callback(this.createTerminalTheme());
        }
      });
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-theme-name']
    });
    
    return () => observer.disconnect();
  }

  /**
   * Register default Orchflow themes
   */
  private registerDefaultThemes(): void {
    // Base Orchflow theme (uses CSS variables)
    this.registerTheme({
      name: 'orchflow',
      displayName: 'Orchflow',
      tokens: {}, // Uses CSS variables from app.css
      modes: ['dark', 'light', 'high-contrast', 'colorblind-friendly'],
      description: 'Default Orchflow theme with VS Code-inspired colors',
      author: 'Orchflow Team',
      version: '1.0.0'
    });

    // GitHub Dark theme example
    this.registerTheme({
      name: 'github-dark',
      displayName: 'GitHub Dark',
      tokens: {
        '--bg-primary': '#0d1117',
        '--bg-secondary': '#161b22',
        '--bg-tertiary': '#21262d',
        '--fg-primary': '#f0f6fc',
        '--fg-secondary': '#7d8590',
        '--fg-tertiary': '#656d76',
        '--accent': '#58a6ff',
        '--success': '#3fb950',
        '--warning': '#d29922',
        '--error': '#f85149',
        '--border': '#30363d',
      },
      modes: ['dark'],
      description: 'GitHub\'s dark theme',
      author: 'GitHub',
      version: '1.0.0'
    });

    // Monokai theme example
    this.registerTheme({
      name: 'monokai',
      displayName: 'Monokai',
      tokens: {
        '--bg-primary': '#272822',
        '--bg-secondary': '#3e3d32',
        '--bg-tertiary': '#49483e',
        '--fg-primary': '#f8f8f2',
        '--fg-secondary': '#75715e',
        '--fg-tertiary': '#66d9ef',
        '--accent': '#fd971f',
        '--success': '#a6e22e',
        '--warning': '#e6db74',
        '--error': '#f92672',
        '--border': '#49483e',
        '--syntax-keyword': '#f92672',
        '--syntax-string': '#e6db74',
        '--syntax-comment': '#75715e',
        '--syntax-function': '#a6e22e',
      },
      modes: ['dark'],
      description: 'Classic Monokai color scheme',
      author: 'Wimer Hazenberg',
      version: '1.0.0'
    });
  }
}

// Global theme API instance
export const themeAPI = new ThemeAPI();

// Convenience functions
export function applyTheme(name: string, mode?: string): void {
  themeAPI.applyTheme(name, mode);
}

export function toggleThemeMode(): void {
  themeAPI.toggleMode();
}

export function getCurrentTheme(): { name: string; mode: string } {
  return themeAPI.getCurrentTheme();
}

export function createTerminalTheme(): TerminalTheme {
  return themeAPI.createTerminalTheme();
}

export function onThemeChange(callback: (theme: string, mode: string) => void): () => void {
  return themeAPI.onThemeChange(callback);
}

export function watchThemeChanges(callback: (terminalTheme: TerminalTheme) => void): () => void {
  return themeAPI.watchThemeChanges(callback);
}