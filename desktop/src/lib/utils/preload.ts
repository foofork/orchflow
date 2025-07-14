/**
 * Preload strategy for components and modules
 */

import { browser } from '$app/environment';

interface PreloadItem {
  id: string;
  loader: () => Promise<any>;
  priority: number;
  loaded: boolean;
  loading: boolean;
  error?: Error;
}

const preloadQueue: PreloadItem[] = [];
const loadedModules = new Map<string, any>();
let processing = false;

/**
 * Add a module to the preload queue
 */
export function addToPreload(id: string, loader: () => Promise<any>, priority: number = 5) {
  if (!browser) return;
  
  // Check if already added
  const existing = preloadQueue.find(item => item.id === id);
  if (existing) {
    existing.priority = Math.min(existing.priority, priority);
    return;
  }
  
  preloadQueue.push({
    id,
    loader,
    priority,
    loaded: false,
    loading: false
  });
  
  // Sort by priority (lower number = higher priority)
  preloadQueue.sort((a, b) => a.priority - b.priority);
  
  // Start processing if not already doing so
  if (!processing) {
    processQueue();
  }
}

/**
 * Process the preload queue
 */
async function processQueue() {
  if (processing || preloadQueue.length === 0) return;
  
  processing = true;
  
  // Use requestIdleCallback for better performance
  while (preloadQueue.length > 0) {
    const item = preloadQueue.find(item => !item.loaded && !item.loading);
    if (!item) break;
    
    item.loading = true;
    
    try {
      await new Promise(resolve => {
        if ('requestIdleCallback' in window) {
          requestIdleCallback(resolve, { timeout: 1000 });
        } else {
          setTimeout(resolve, 10);
        }
      });
      
      const module = await item.loader();
      loadedModules.set(item.id, module);
      item.loaded = true;
      item.loading = false;
      
      // Remove from queue
      const index = preloadQueue.indexOf(item);
      if (index >= 0) {
        preloadQueue.splice(index, 1);
      }
      
    } catch (error) {
      item.error = error as Error;
      item.loading = false;
      console.warn(`Failed to preload ${item.id}:`, error);
    }
  }
  
  processing = false;
}

/**
 * Get a preloaded module
 */
export function getPreloaded(id: string): any | null {
  return loadedModules.get(id) || null;
}

/**
 * Check if a module is preloaded
 */
export function isPreloaded(id: string): boolean {
  return loadedModules.has(id);
}

/**
 * Clear preload cache
 */
export function clearPreloadCache() {
  loadedModules.clear();
  preloadQueue.length = 0;
}

/**
 * Preload critical components immediately
 */
export function preloadCritical() {
  if (!browser) return;
  
  // Terminal components (high priority)
  addToPreload('terminal-core', () => import('@xterm/xterm'), 1);
  addToPreload('terminal-fit', () => import('@xterm/addon-fit'), 1);
  
  // Essential UI components
  addToPreload('command-palette', () => import('$lib/components/CommandPalette.svelte'), 2);
  addToPreload('settings-modal', () => import('$lib/components/SettingsModal.svelte'), 2);
  
  // Frequently used utilities
  addToPreload('search-util', () => import('fuse.js'), 3);
}

/**
 * Preload components based on user activity
 */
export function preloadOnActivity() {
  if (!browser) return;
  
  // Editor components (medium priority)
  addToPreload('editor-core', () => import('@codemirror/state'), 4);
  addToPreload('editor-view', () => import('@codemirror/view'), 4);
  addToPreload('editor-js', () => import('@codemirror/lang-javascript'), 5);
  
  // Git panel
  addToPreload('git-panel', () => import('$lib/components/GitPanelLazy.svelte'), 6);
  
  // Dashboard
  addToPreload('dashboard', () => import('$lib/components/DashboardEnhanced.svelte'), 7);
}

/**
 * Preload based on user preferences
 */
export function preloadByPreferences(preferences: any) {
  if (!browser) return;
  
  // Preload based on frequently used features
  if (preferences.frequentlyUsed?.includes('terminal')) {
    addToPreload('terminal-addons', () => import('@xterm/addon-web-links'), 3);
    addToPreload('terminal-search', () => import('@xterm/addon-search'), 4);
  }
  
  if (preferences.frequentlyUsed?.includes('editor')) {
    addToPreload('editor-autocomplete', () => import('@codemirror/autocomplete'), 3);
    addToPreload('editor-lint', () => import('@codemirror/lint'), 4);
  }
  
  if (preferences.frequentlyUsed?.includes('git')) {
    addToPreload('git-panel', () => import('$lib/components/GitPanelLazy.svelte'), 2);
  }
  
  // Language-specific preloading
  if (preferences.languages?.includes('python')) {
    addToPreload('editor-python', () => import('@codemirror/lang-python'), 4);
  }
  
  if (preferences.languages?.includes('rust')) {
    addToPreload('editor-rust', () => import('@codemirror/lang-rust'), 4);
  }
}

/**
 * Smart preloader that adapts to user behavior
 */
export class SmartPreloader {
  private usage = new Map<string, number>();
  private lastUsed = new Map<string, number>();
  
  recordUsage(componentId: string) {
    const current = this.usage.get(componentId) || 0;
    this.usage.set(componentId, current + 1);
    this.lastUsed.set(componentId, Date.now());
    
    // Adjust preload priorities based on usage
    this.updatePreloadPriorities();
  }
  
  private updatePreloadPriorities() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    // Find frequently used components
    const frequentComponents = Array.from(this.usage.entries())
      .filter(([id, count]) => {
        const lastUsed = this.lastUsed.get(id) || 0;
        return count > 3 && (now - lastUsed) < oneHour;
      })
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    // Preload frequently used components with higher priority
    frequentComponents.forEach(([id, count], index) => {
      const priority = index + 1;
      
      // Map component IDs to loaders
      const loaders = this.getLoaderById(id);
      if (loaders) {
        loaders.forEach(loader => {
          addToPreload(id, loader, priority);
        });
      }
    });
  }
  
  private getLoaderById(id: string): Array<() => Promise<any>> | null {
    const loaderMap: Record<string, Array<() => Promise<any>>> = {
      'terminal': [
        () => import('$lib/components/Terminal.svelte'),
        () => import('@xterm/xterm'),
        () => import('@xterm/addon-fit')
      ],
      'editor': [
        () => import('$lib/components/NeovimEditor.svelte'),
        () => import('@codemirror/state'),
        () => import('@codemirror/view')
      ],
      'git': [
        () => import('$lib/components/GitPanelLazy.svelte')
      ],
      'settings': [
        () => import('$lib/components/SettingsModal.svelte')
      ],
      'dashboard': [
        () => import('$lib/components/DashboardEnhanced.svelte')
      ]
    };
    
    return loaderMap[id] || null;
  }
}

// Global instance
export const smartPreloader = new SmartPreloader();

/**
 * Initialize preloading strategy
 */
export function initializePreloading() {
  if (!browser) return;
  
  // Preload critical components immediately
  preloadCritical();
  
  // Preload other components after initial load
  setTimeout(() => {
    preloadOnActivity();
  }, 1000);
  
  // Listen for idle periods to preload more
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      preloadOnActivity();
    }, { timeout: 5000 });
  }
}