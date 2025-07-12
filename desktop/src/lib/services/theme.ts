import { get } from 'svelte/store';
import { settings } from '$lib/stores/settings';
import { themeAPI } from '$lib/theme/api';

export function initTheme() {
  // Apply theme from settings on initialization
  const currentSettings = get(settings);
  applyTheme(currentSettings.theme);
  
  // Subscribe to theme changes and sync with ThemeAPI
  settings.subscribe(($settings) => {
    applyTheme($settings.theme);
  });
}

export function applyTheme(theme: 'dark' | 'light' | 'high-contrast' | 'colorblind-friendly') {
  // Use the unified ThemeAPI to apply themes
  themeAPI.applyTheme('orchflow', theme);
}

export function toggleTheme() {
  const currentSettings = get(settings);
  const newTheme = currentSettings.theme === 'dark' ? 'light' : 'dark';
  settings.update(s => ({ ...s, theme: newTheme }));
}

// Extended theme switching functions
export function setTheme(theme: 'dark' | 'light' | 'high-contrast' | 'colorblind-friendly') {
  settings.update(s => ({ ...s, theme }));
}

export function getAvailableThemes() {
  return themeAPI.getThemes();
}

export function getCurrentThemeInfo() {
  return themeAPI.getCurrentTheme();
}

// Keyboard shortcut handler for Cmd-K D
export function setupThemeShortcut() {
  window.addEventListener('keydown', (e) => {
    // Check for Cmd-K (Mac) or Ctrl-K (Windows/Linux)
    const isModKey = e.metaKey || e.ctrlKey;
    
    if (isModKey && e.key === 'k') {
      // Store that K was pressed
      window.__themeShortcutKPressed = true;
      
      // Clear after 1 second if D is not pressed
      setTimeout(() => {
        window.__themeShortcutKPressed = false;
      }, 1000);
    } else if (window.__themeShortcutKPressed && e.key === 'd') {
      // Toggle theme when D is pressed after K
      e.preventDefault();
      toggleTheme();
      window.__themeShortcutKPressed = false;
    }
  });
}

// Extend window type for the flag
declare global {
  interface Window {
    __themeShortcutKPressed?: boolean;
  }
}