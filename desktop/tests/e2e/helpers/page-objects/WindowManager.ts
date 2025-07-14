/**
 * Window Manager Page Object
 * Handles multi-window operations and state management
 */

import type { Page, BrowserContext } from 'playwright';
import { BasePage } from './BasePage';

interface Window {
  id: string;
  page: Page;
  title: string;
  index: number;
}

interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WindowState {
  windows: Array<{
    id: string;
    title: string;
    bounds: WindowBounds;
    workspace?: string;
    layout?: string;
  }>;
}

export class WindowManager extends BasePage {
  private windows: Map<string, Window> = new Map();
  private windowIdCounter = 0;
  private context?: BrowserContext;
  private focusListeners: Array<(windowId: string) => void> = [];
  private closeListeners: Array<(windowId: string) => void> = [];

  constructor(page: Page) {
    super(page);
    this.context = page.context();
    
    // Register initial window
    const windowId = this.generateWindowId();
    this.windows.set(windowId, {
      id: windowId,
      page,
      title: 'Main Window',
      index: 0
    });
  }

  /**
   * Generate unique window ID
   */
  private generateWindowId(): string {
    return `window-${++this.windowIdCounter}`;
  }

  /**
   * Open new window
   */
  async openNewWindow(): Promise<Window> {
    if (!this.context) {
      throw new Error('Browser context not available');
    }

    // Create new page (window)
    const newPage = await this.context.newPage();
    const windowId = this.generateWindowId();
    
    const window: Window = {
      id: windowId,
      page: newPage,
      title: `Window ${this.windows.size + 1}`,
      index: this.windows.size
    };
    
    this.windows.set(windowId, window);
    
    // Set up event handlers
    this.setupWindowEventHandlers(window);
    
    // Navigate to base URL
    const currentUrl = this.page.url();
    if (currentUrl && !currentUrl.includes('about:blank')) {
      await newPage.goto(currentUrl);
    }
    
    // Focus new window
    await this.focusWindow(windowId);
    
    return window;
  }

  /**
   * Set up window event handlers
   */
  private setupWindowEventHandlers(window: Window) {
    // Focus event - using domcontentloaded as focus is not available
    window.page.on('domcontentloaded', () => {
      this.focusListeners.forEach(listener => listener(window.id));
    });
    
    // Close event
    window.page.on('close', () => {
      this.windows.delete(window.id);
      this.closeListeners.forEach(listener => listener(window.id));
    });
  }

  /**
   * Get current window
   */
  async getCurrentWindow(): Promise<Window> {
    // Return the first window (main window)
    const firstWindow = this.windows.values().next().value;
    if (!firstWindow) {
      throw new Error('No windows available');
    }
    return firstWindow;
  }

  /**
   * Get window count
   */
  async getWindowCount(): Promise<number> {
    return this.windows.size;
  }

  /**
   * Get all windows
   */
  async getAllWindows(): Promise<Window[]> {
    return Array.from(this.windows.values());
  }

  /**
   * Check if window is active
   */
  async isWindowActive(windowId: string): Promise<boolean> {
    const window = this.windows.get(windowId);
    if (!window) return false;
    
    // Check if page has focus
    return await window.page.evaluate(() => document.hasFocus());
  }

  /**
   * Switch to window
   */
  async switchToWindow(windowId: string) {
    const window = this.windows.get(windowId);
    if (!window) {
      throw new Error(`Window ${windowId} not found`);
    }
    
    await this.focusWindow(windowId);
  }

  /**
   * Focus window
   */
  async focusWindow(windowId: string) {
    const window = this.windows.get(windowId);
    if (!window) return;
    
    await window.page.bringToFront();
    
    // Simulate focus event
    this.focusListeners.forEach(listener => listener(windowId));
  }

  /**
   * Close window
   */
  async closeWindow(windowId: string) {
    const window = this.windows.get(windowId);
    if (!window) return;
    
    // Prevent closing last window
    if (this.windows.size === 1) {
      console.warn('Cannot close last window');
      return;
    }
    
    await window.page.close();
    this.windows.delete(windowId);
  }

  /**
   * Close all windows except main
   */
  async closeAllWindows() {
    const mainWindow = this.windows.values().next().value;
    
    for (const [windowId, window] of this.windows) {
      if (mainWindow && windowId !== mainWindow.id) {
        await window.page.close();
        this.windows.delete(windowId);
      }
    }
  }

  /**
   * Check if window exists
   */
  async windowExists(windowId: string): Promise<boolean> {
    return this.windows.has(windowId);
  }

  /**
   * Set window title
   */
  async setWindowTitle(windowId: string, title: string) {
    const window = this.windows.get(windowId);
    if (!window) return;
    
    window.title = title;
    
    // Update window title in app
    await window.page.evaluate((title) => {
      document.title = title;
    }, title);
  }

  /**
   * Get window title
   */
  async getWindowTitle(windowId: string): Promise<string> {
    const window = this.windows.get(windowId);
    return window?.title || '';
  }

  /**
   * Arrange windows
   */
  async arrangeWindows(layout: 'side-by-side' | 'stacked' | 'grid') {
    const windows = Array.from(this.windows.values());
    const screenSize = await this.getScreenSize();
    
    switch (layout) {
      case 'side-by-side': {
        const width = Math.floor(screenSize.width / windows.length);
        for (let i = 0; i < windows.length; i++) {
          await this.setWindowBounds(windows[i].id, {
            x: i * width,
            y: 0,
            width,
            height: screenSize.height
          });
        }
        break;
      }
        
      case 'stacked': {
        const height = Math.floor(screenSize.height / windows.length);
        for (let i = 0; i < windows.length; i++) {
          await this.setWindowBounds(windows[i].id, {
            x: 0,
            y: i * height,
            width: screenSize.width,
            height
          });
        }
        break;
      }
        
      case 'grid': {
        const cols = Math.ceil(Math.sqrt(windows.length));
        const rows = Math.ceil(windows.length / cols);
        const cellWidth = Math.floor(screenSize.width / cols);
        const cellHeight = Math.floor(screenSize.height / rows);
        
        for (let i = 0; i < windows.length; i++) {
          const col = i % cols;
          const row = Math.floor(i / cols);
          
          await this.setWindowBounds(windows[i].id, {
            x: col * cellWidth,
            y: row * cellHeight,
            width: cellWidth,
            height: cellHeight
          });
        }
        break;
      }
    }
  }

  /**
   * Get screen size
   */
  private async getScreenSize(): Promise<{ width: number; height: number }> {
    // Get from first window
    const window = this.windows.values().next().value;
    if (!window) {
      throw new Error('No windows available to get screen size');
    }
    return await window.page.evaluate(() => ({
      width: screen.availWidth,
      height: screen.availHeight
    }));
  }

  /**
   * Set window bounds
   */
  async setWindowBounds(windowId: string, bounds: WindowBounds) {
    const window = this.windows.get(windowId);
    if (!window) return;
    
    // Playwright doesn't directly support window positioning,
    // so we simulate it through viewport and app-specific APIs
    await window.page.setViewportSize({
      width: bounds.width,
      height: bounds.height
    });
    
    // App-specific window positioning
    await window.page.evaluate((bounds) => {
      if ((window as any).electronAPI) {
        (window as any).electronAPI.setWindowBounds(bounds);
      }
    }, bounds);
  }

  /**
   * Get window bounds
   */
  async getWindowBounds(windowId: string): Promise<WindowBounds> {
    const window = this.windows.get(windowId);
    if (!window) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    
    const viewport = window.page.viewportSize();
    
    // Try to get actual window bounds from app
    const bounds = await window.page.evaluate(() => {
      if ((window as any).electronAPI) {
        return (window as any).electronAPI.getWindowBounds();
      }
      return null;
    });
    
    return bounds || {
      x: 0,
      y: 0,
      width: viewport?.width || 1280,
      height: viewport?.height || 720
    };
  }

  /**
   * Set window layout
   */
  async setWindowLayout(windowId: string, layout: string) {
    const window = this.windows.get(windowId);
    if (!window) return;
    
    await window.page.evaluate((layout) => {
      (window as any).workspace?.setLayout(layout);
    }, layout);
  }

  /**
   * Get window layout
   */
  async getWindowLayout(windowId: string): Promise<string> {
    const window = this.windows.get(windowId);
    if (!window) return '';
    
    return await window.page.evaluate(() => {
      return (window as any).workspace?.getLayout() || 'default';
    });
  }

  /**
   * Get editor groups for window
   */
  async getEditorGroups(windowId: string): Promise<any[]> {
    const window = this.windows.get(windowId);
    if (!window) return [];
    
    return await window.page.evaluate(() => {
      return (window as any).editor?.getGroups() || [];
    });
  }

  /**
   * Set zoom level
   */
  async setZoomLevel(windowId: string, level: number) {
    const window = this.windows.get(windowId);
    if (!window) return;
    
    await window.page.evaluate((level) => {
      if ((window as any).electronAPI) {
        (window as any).electronAPI.setZoomLevel(level);
      }
    }, level);
  }

  /**
   * Get zoom level
   */
  async getZoomLevel(windowId: string): Promise<number> {
    const window = this.windows.get(windowId);
    if (!window) return 1;
    
    return await window.page.evaluate(() => {
      if ((window as any).electronAPI) {
        return (window as any).electronAPI.getZoomLevel();
      }
      return 1;
    });
  }

  /**
   * Register window focus listener
   */
  async onWindowFocus(callback: (windowId: string) => void) {
    this.focusListeners.push(callback);
  }

  /**
   * Register window close listener
   */
  async onWindowClose(callback: (windowId: string) => void) {
    this.closeListeners.push(callback);
  }

  /**
   * Check if window can be closed
   */
  async canCloseWindow(_windowId: string): Promise<boolean> {
    return this.windows.size > 1;
  }

  /**
   * Wait for sync across windows
   */
  async waitForSync() {
    // Wait for all windows to sync
    await this.page.waitForTimeout(1000);
  }

  /**
   * Save window state
   */
  async saveWindowState(): Promise<WindowState> {
    const state: WindowState = { windows: [] };
    
    for (const [windowId, window] of this.windows) {
      const bounds = await this.getWindowBounds(windowId);
      const workspace = await this.getWindowWorkspace(windowId);
      const layout = await this.getWindowLayout(windowId);
      
      state.windows.push({
        id: windowId,
        title: window.title,
        bounds,
        workspace,
        layout
      });
    }
    
    return state;
  }

  /**
   * Restore window state
   */
  async restoreWindowState(state: WindowState) {
    // Close all windows except main
    await this.closeAllWindows();
    
    // Restore windows
    for (let i = 1; i < state.windows.length; i++) {
      const windowState = state.windows[i];
      const window = await this.openNewWindow();
      
      await this.setWindowTitle(window.id, windowState.title);
      await this.setWindowBounds(window.id, windowState.bounds);
      
      if (windowState.workspace) {
        await this.setWindowWorkspace(window.id, windowState.workspace);
      }
      
      if (windowState.layout) {
        await this.setWindowLayout(window.id, windowState.layout);
      }
    }
  }

  /**
   * Set window workspace
   */
  async setWindowWorkspace(windowId: string, workspace: string) {
    const window = this.windows.get(windowId);
    if (!window) return;
    
    await window.page.evaluate((workspace) => {
      (window as any).workspace?.open(workspace);
    }, workspace);
  }

  /**
   * Get window workspace
   */
  async getWindowWorkspace(windowId: string): Promise<string> {
    const window = this.windows.get(windowId);
    if (!window) return '';
    
    return await window.page.evaluate(() => {
      return (window as any).workspace?.getPath() || '';
    });
  }
}