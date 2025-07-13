/**
 * Multi-window Support E2E Tests
 * Tests multiple windows and state synchronization
 */

import { TestContext } from '../helpers/test-context';
import { WindowManager } from '../helpers/page-objects/WindowManager';
import { FileExplorerPage } from '../helpers/page-objects/FileExplorerPage';
import { EditorPage } from '../helpers/page-objects/EditorPage';
import { TerminalPage } from '../helpers/page-objects/TerminalPage';
import { SettingsPage } from '../helpers/page-objects/SettingsPage';
import * as path from 'path';
import * as fs from 'fs/promises';

describe('Multi-window Support Flow', () => {
  let testContext: TestContext;
  let windowManager: WindowManager;
  let testWorkspace: string;

  beforeEach(async () => {
    testContext = new TestContext({
      headless: process.env.CI === 'true',
      trace: true
    });
    await testContext.setup();
    
    const { page } = await testContext.createPage();
    windowManager = new WindowManager(page);
    
    // Create test workspace
    testWorkspace = path.join(testContext.getDataDir() || '', 'multi-window-test');
    await fs.mkdir(testWorkspace, { recursive: true });
    await createTestFiles(testWorkspace);
  });

  afterEach(async () => {
    await testContext.captureState('multi-window-flow');
    await testContext.teardown();
  });

  describe('Window Management', () => {
    test('should open new window', async () => {
      // Act
      const window2 = await windowManager.openNewWindow();

      // Assert
      expect(window2).toBeTruthy();
      expect(await windowManager.getWindowCount()).toBe(2);
      expect(await windowManager.isWindowActive(window2.id)).toBe(true);
    });

    test('should open multiple windows', async () => {
      // Act
      const window2 = await windowManager.openNewWindow();
      const window3 = await windowManager.openNewWindow();
      const window4 = await windowManager.openNewWindow();

      // Assert
      expect(await windowManager.getWindowCount()).toBe(4);
      const windows = await windowManager.getAllWindows();
      expect(windows.map(w => w.id)).toContain(window2.id);
      expect(windows.map(w => w.id)).toContain(window3.id);
      expect(windows.map(w => w.id)).toContain(window4.id);
    });

    test('should switch between windows', async () => {
      // Arrange
      const window1 = await windowManager.getCurrentWindow();
      const window2 = await windowManager.openNewWindow();
      const window3 = await windowManager.openNewWindow();

      // Act
      await windowManager.switchToWindow(window1.id);
      expect(await windowManager.isWindowActive(window1.id)).toBe(true);

      await windowManager.switchToWindow(window2.id);
      expect(await windowManager.isWindowActive(window2.id)).toBe(true);

      await windowManager.switchToWindow(window3.id);
      expect(await windowManager.isWindowActive(window3.id)).toBe(true);
    });

    test('should close window', async () => {
      // Arrange
      const window2 = await windowManager.openNewWindow();
      const window3 = await windowManager.openNewWindow();

      // Act
      await windowManager.closeWindow(window2.id);

      // Assert
      expect(await windowManager.getWindowCount()).toBe(2);
      expect(await windowManager.windowExists(window2.id)).toBe(false);
      expect(await windowManager.windowExists(window3.id)).toBe(true);
    });

    test('should handle window titles', async () => {
      // Arrange
      const window2 = await windowManager.openNewWindow();

      // Act
      await windowManager.setWindowTitle(window2.id, 'Secondary Window');

      // Assert
      expect(await windowManager.getWindowTitle(window2.id)).toBe('Secondary Window');
    });

    test('should arrange windows', async () => {
      // Arrange
      const window2 = await windowManager.openNewWindow();

      // Act
      await windowManager.arrangeWindows('side-by-side');

      // Assert
      const window1Bounds = await windowManager.getWindowBounds(
        (await windowManager.getCurrentWindow()).id
      );
      const window2Bounds = await windowManager.getWindowBounds(window2.id);

      // Windows should be side by side
      expect(window1Bounds.x + window1Bounds.width).toBeLessThanOrEqual(window2Bounds.x + 10);
    });
  });

  describe('State Synchronization', () => {
    test('should sync file changes across windows', async () => {
      // Arrange
      const window1 = await windowManager.getCurrentWindow();
      const fileExplorer1 = new FileExplorerPage(window1.page);
      const editor1 = new EditorPage(window1.page);
      
      await fileExplorer1.openWorkspace(testWorkspace);
      await fileExplorer1.openFile('test.js');

      // Open same file in second window
      const window2 = await windowManager.openNewWindow();
      const fileExplorer2 = new FileExplorerPage(window2.page);
      const editor2 = new EditorPage(window2.page);
      
      await fileExplorer2.openWorkspace(testWorkspace);
      await fileExplorer2.openFile('test.js');

      // Act - Edit in first window
      await windowManager.switchToWindow(window1.id);
      await editor1.typeText('\n// Edit from window 1');
      await editor1.save();

      // Assert - Changes appear in second window
      await windowManager.switchToWindow(window2.id);
      await window2.page.waitForTimeout(1000); // Wait for sync
      const content2 = await editor2.getContent();
      expect(content2).toContain('// Edit from window 1');
    });

    test('should sync settings across windows', async () => {
      // Arrange
      const window1 = await windowManager.getCurrentWindow();
      const settings1 = new SettingsPage(window1.page);
      
      const window2 = await windowManager.openNewWindow();
      const settings2 = new SettingsPage(window2.page);

      // Act - Change settings in first window
      await windowManager.switchToWindow(window1.id);
      await settings1.navigateToSettings();
      await settings1.selectTheme('Dark Plus');
      await settings1.saveSettings();

      // Assert - Settings apply to second window
      await windowManager.switchToWindow(window2.id);
      await window2.page.reload();
      
      const isDark = await window2.page.evaluate(() => {
        return document.documentElement.classList.contains('dark-theme');
      });
      expect(isDark).toBe(true);
    });

    test('should sync terminal sessions', async () => {
      // Arrange
      const window1 = await windowManager.getCurrentWindow();
      const terminal1 = new TerminalPage(window1.page);
      
      await terminal1.navigateToTerminal();
      const terminalId = await terminal1.createNewTerminal();
      await terminal1.setTerminalTitle(terminalId!, 'Shared Terminal');

      // Act - Open terminal view in second window
      const window2 = await windowManager.openNewWindow();
      const terminal2 = new TerminalPage(window2.page);
      await terminal2.navigateToTerminal();

      // Assert - Terminal is accessible from both windows
      expect(await terminal2.isTerminalExists(terminalId!)).toBe(true);
      expect(await terminal2.getTerminalTitle(terminalId!)).toBe('Shared Terminal');

      // Execute command in window 1
      await windowManager.switchToWindow(window1.id);
      await terminal1.executeCommand(terminalId!, 'echo "From window 1"');

      // Check output in window 2
      await windowManager.switchToWindow(window2.id);
      await window2.page.waitForTimeout(500);
      const output = await terminal2.getTerminalOutput(terminalId!);
      expect(output).toContain('From window 1');
    });

    test('should sync workspace state', async () => {
      // Arrange
      const window1 = await windowManager.getCurrentWindow();
      const fileExplorer1 = new FileExplorerPage(window1.page);
      await fileExplorer1.openWorkspace(testWorkspace);

      // Create folders and files
      await fileExplorer1.createFolder('new-folder');
      await fileExplorer1.navigateToFolder('new-folder');
      await fileExplorer1.createFile('new-file.js');

      // Act - Open second window
      const window2 = await windowManager.openNewWindow();
      const fileExplorer2 = new FileExplorerPage(window2.page);

      // Assert - Workspace state is shared
      expect(await fileExplorer2.folderExists('new-folder')).toBe(true);
      await fileExplorer2.navigateToFolder('new-folder');
      expect(await fileExplorer2.fileExists('new-file.js')).toBe(true);
    });

    test('should sync extension state', async () => {
      // Arrange
      const window1 = await windowManager.getCurrentWindow();
      
      // Enable an extension in window 1
      await window1.page.evaluate(() => {
        (window as any).extensionManager?.enable('test-extension');
      });

      // Act - Open second window
      const window2 = await windowManager.openNewWindow();

      // Assert - Extension state is synced
      const isEnabled = await window2.page.evaluate(() => {
        return (window as any).extensionManager?.isEnabled('test-extension');
      });
      expect(isEnabled).toBe(true);
    });
  });

  describe('Window-specific Features', () => {
    test('should support different layouts per window', async () => {
      // Arrange
      const window1 = await windowManager.getCurrentWindow();
      const window2 = await windowManager.openNewWindow();

      // Act - Set different layouts
      await windowManager.switchToWindow(window1.id);
      await windowManager.setWindowLayout(window1.id, 'editor-focus');

      await windowManager.switchToWindow(window2.id);
      await windowManager.setWindowLayout(window2.id, 'terminal-focus');

      // Assert
      expect(await windowManager.getWindowLayout(window1.id)).toBe('editor-focus');
      expect(await windowManager.getWindowLayout(window2.id)).toBe('terminal-focus');
    });

    test('should maintain independent editor groups', async () => {
      // Arrange
      const window1 = await windowManager.getCurrentWindow();
      const editor1 = new EditorPage(window1.page);
      const fileExplorer1 = new FileExplorerPage(window1.page);
      
      await fileExplorer1.openWorkspace(testWorkspace);
      await fileExplorer1.openFile('file1.js');
      await editor1.splitEditor('vertical');
      await fileExplorer1.openFile('file2.js');

      // Act - Open second window with different layout
      const window2 = await windowManager.openNewWindow();
      const editor2 = new EditorPage(window2.page);
      const fileExplorer2 = new FileExplorerPage(window2.page);
      
      await fileExplorer2.openWorkspace(testWorkspace);
      await fileExplorer2.openFile('file3.js');

      // Assert - Layouts are independent
      const groups1 = await windowManager.getEditorGroups(window1.id);
      const groups2 = await windowManager.getEditorGroups(window2.id);
      
      expect(groups1.length).toBe(2); // Split editor
      expect(groups2.length).toBe(1); // Single editor
    });

    test('should support window-specific zoom levels', async () => {
      // Arrange
      const window1 = await windowManager.getCurrentWindow();
      const window2 = await windowManager.openNewWindow();

      // Act
      await windowManager.setZoomLevel(window1.id, 1.2);
      await windowManager.setZoomLevel(window2.id, 0.8);

      // Assert
      expect(await windowManager.getZoomLevel(window1.id)).toBe(1.2);
      expect(await windowManager.getZoomLevel(window2.id)).toBe(0.8);
    });
  });

  describe('Window Events', () => {
    test('should handle window focus events', async () => {
      // Arrange
      const window1 = await windowManager.getCurrentWindow();
      const window2 = await windowManager.openNewWindow();
      
      const focusedWindows: string[] = [];
      await windowManager.onWindowFocus((windowId) => {
        focusedWindows.push(windowId);
      });

      // Act
      await windowManager.focusWindow(window1.id);
      await windowManager.focusWindow(window2.id);
      await windowManager.focusWindow(window1.id);

      // Assert
      expect(focusedWindows).toEqual([window1.id, window2.id, window1.id]);
    });

    test('should handle window close events', async () => {
      // Arrange
      const window2 = await windowManager.openNewWindow();
      
      const closedWindows: string[] = [];
      await windowManager.onWindowClose((windowId) => {
        closedWindows.push(windowId);
      });

      // Act
      await windowManager.closeWindow(window2.id);

      // Assert
      expect(closedWindows).toContain(window2.id);
    });

    test('should prevent closing last window', async () => {
      // Act
      const window1 = await windowManager.getCurrentWindow();
      const canClose = await windowManager.canCloseWindow(window1.id);

      // Assert
      expect(canClose).toBe(false);
      
      // Try to close anyway
      await windowManager.closeWindow(window1.id);
      expect(await windowManager.getWindowCount()).toBe(1);
    });
  });

  describe('Performance', () => {
    test('should handle many windows efficiently', async () => {
      // Act - Open multiple windows
      const windows = [];
      const startTime = Date.now();
      
      for (let i = 0; i < 5; i++) {
        windows.push(await windowManager.openNewWindow());
      }
      
      const openTime = Date.now() - startTime;

      // Assert
      expect(openTime).toBeLessThan(10000); // Should open 5 windows in 10 seconds
      expect(await windowManager.getWindowCount()).toBe(6); // Including original
    });

    test('should sync large files efficiently', async () => {
      // Create large file
      const largeContent = 'x'.repeat(1024 * 1024); // 1MB
      await fs.writeFile(path.join(testWorkspace, 'large.txt'), largeContent);

      // Arrange
      const window1 = await windowManager.getCurrentWindow();
      const fileExplorer1 = new FileExplorerPage(window1.page);
      const editor1 = new EditorPage(window1.page);
      
      await fileExplorer1.openWorkspace(testWorkspace);
      await fileExplorer1.openFile('large.txt');

      const window2 = await windowManager.openNewWindow();
      const fileExplorer2 = new FileExplorerPage(window2.page);
      const editor2 = new EditorPage(window2.page);
      
      await fileExplorer2.openWorkspace(testWorkspace);
      await fileExplorer2.openFile('large.txt');

      // Act - Modify in window 1
      const startTime = Date.now();
      await editor1.goToLine(1);
      await editor1.typeText('// Modified\n');
      await editor1.save();

      // Check sync time
      await windowManager.switchToWindow(window2.id);
      await windowManager.waitForSync();
      const syncTime = Date.now() - startTime;

      // Assert
      expect(syncTime).toBeLessThan(3000); // Should sync within 3 seconds
      const content2 = await editor2.getContent();
      expect(content2.startsWith('// Modified')).toBe(true);
    });
  });

  describe('Window Restoration', () => {
    test('should restore window state', async () => {
      // Arrange - Create window state
      const window2 = await windowManager.openNewWindow();
      await windowManager.setWindowTitle(window2.id, 'Restored Window');
      await windowManager.setWindowBounds(window2.id, {
        x: 100,
        y: 100,
        width: 800,
        height: 600
      });

      // Save state
      const state = await windowManager.saveWindowState();

      // Close all windows
      await windowManager.closeAllWindows();

      // Act - Restore
      await windowManager.restoreWindowState(state);

      // Assert
      const windows = await windowManager.getAllWindows();
      const restoredWindow = windows.find(w => w.title === 'Restored Window');
      
      expect(restoredWindow).toBeTruthy();
      const bounds = await windowManager.getWindowBounds(restoredWindow!.id);
      expect(bounds.width).toBe(800);
      expect(bounds.height).toBe(600);
    });

    test('should restore workspace per window', async () => {
      // Arrange
      const window1 = await windowManager.getCurrentWindow();
      const window2 = await windowManager.openNewWindow();
      
      // Set different workspaces
      const workspace1 = path.join(testContext.getDataDir()!, 'workspace1');
      const workspace2 = path.join(testContext.getDataDir()!, 'workspace2');
      await fs.mkdir(workspace1, { recursive: true });
      await fs.mkdir(workspace2, { recursive: true });

      await windowManager.setWindowWorkspace(window1.id, workspace1);
      await windowManager.setWindowWorkspace(window2.id, workspace2);

      // Save and restore
      const state = await windowManager.saveWindowState();
      await windowManager.closeAllWindows();
      await windowManager.restoreWindowState(state);

      // Assert
      const windows = await windowManager.getAllWindows();
      expect(windows.length).toBe(2);
      
      const workspaces = await Promise.all(
        windows.map(w => windowManager.getWindowWorkspace(w.id))
      );
      expect(workspaces).toContain(workspace1);
      expect(workspaces).toContain(workspace2);
    });
  });
});

// Helper function to create test files
async function createTestFiles(workspace: string) {
  const files = {
    'test.js': 'console.log("test");',
    'file1.js': 'export const var1 = "file1";',
    'file2.js': 'export const var2 = "file2";',
    'file3.js': 'export const var3 = "file3";'
  };

  for (const [name, content] of Object.entries(files)) {
    await fs.writeFile(path.join(workspace, name), content);
  }
}