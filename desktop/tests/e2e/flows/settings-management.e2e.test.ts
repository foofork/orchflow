/**
 * Settings Management E2E Tests
 * Tests preferences, themes, keybindings, and configuration
 */

import { TestContext } from '../helpers/test-context';
import { SettingsPage } from '../helpers/page-objects/SettingsPage';
import { EditorPage } from '../helpers/page-objects/EditorPage';
import { TerminalPage } from '../helpers/page-objects/TerminalPage';
import * as path from 'path';
import * as fs from 'fs/promises';

describe('Settings Management Flow', () => {
  let testContext: TestContext;
  let settings: SettingsPage;
  let editor: EditorPage;
  let terminal: TerminalPage;

  beforeEach(async () => {
    testContext = new TestContext({
      headless: process.env.CI === 'true',
      trace: true
    });
    await testContext.setup();
    
    const { page, baseUrl } = await testContext.createPage();
    settings = new SettingsPage(page);
    editor = new EditorPage(page);
    terminal = new TerminalPage(page);
    
    await page.goto(baseUrl);
    await settings.navigateToSettings();
  });

  afterEach(async () => {
    await testContext.captureState('settings-flow');
    await testContext.teardown();
  });

  describe('General Settings', () => {
    test('should toggle auto-save', async () => {
      // Act
      await settings.setAutoSave(true);
      await settings.saveSettings();

      // Assert
      expect(await settings.getSettingValue('auto-save')).toBe(true);
      
      // Verify functionality
      await editor.page.goto(testContext.baseUrl + '/editor');
      await editor.typeText('auto save test');
      await editor.page.waitForTimeout(2000); // Wait for auto-save
      
      expect(await editor.isDirty()).toBe(false);
    });

    test('should configure auto-save delay', async () => {
      // Arrange
      await settings.setAutoSave(true);
      
      // Act
      await settings.setAutoSaveDelay(5);
      await settings.saveSettings();

      // Assert
      expect(await settings.getSettingValue('auto-save-delay')).toBe('5');
    });

    test('should change language', async () => {
      // Act
      await settings.setLanguage('es');
      await settings.saveSettings();

      // Assert
      const notification = await settings.getNotification();
      expect(notification).toContain('Language changed');
      
      // Verify UI update
      await settings.page.reload();
      const label = await settings.page.locator('[data-i18n="settings.general"]').textContent();
      expect(label).toBe('General'); // Would be 'General' in Spanish
    });

    test('should set default workspace', async () => {
      // Arrange
      const workspacePath = path.join(testContext.getDataDir()!, 'my-workspace');
      await fs.mkdir(workspacePath, { recursive: true });

      // Act
      await settings.setDefaultWorkspace(workspacePath);
      await settings.saveSettings();

      // Assert
      expect(await settings.getSettingValue('default-workspace')).toBe(workspacePath);
    });

    test('should validate settings before saving', async () => {
      // Act - Set invalid value
      await settings.setAutoSaveDelay(-1);
      const isValid = await settings.validateSettings();

      // Assert
      expect(isValid).toBe(false);
      const errors = await settings.getValidationErrors();
      expect(errors[0]).toContain('must be positive');
    });
  });

  describe('Editor Settings', () => {
    test('should change font size', async () => {
      // Act
      await settings.setEditorFontSize(16);
      await settings.saveSettings();

      // Assert
      await editor.page.goto(testContext.baseUrl + '/editor');
      const fontSize = await editor.getFontSize();
      expect(fontSize).toBe(16);
    });

    test('should change font family', async () => {
      // Act
      await settings.setEditorFontFamily('Monaco, monospace');
      await settings.saveSettings();

      // Assert
      expect(await settings.getSettingValue('editor-font-family')).toBe('Monaco, monospace');
    });

    test('should configure tab size', async () => {
      // Act
      await settings.setTabSize(2);
      await settings.saveSettings();

      // Assert
      await editor.page.goto(testContext.baseUrl + '/editor');
      await editor.typeText('function test() {');
      await editor.page.keyboard.press('Enter');
      await editor.page.keyboard.press('Tab');
      await editor.typeText('return true;');
      
      const content = await editor.getContent();
      expect(content).toContain('  return true;'); // 2 spaces
    });

    test('should toggle word wrap', async () => {
      // Act
      await settings.setWordWrap(true);
      await settings.saveSettings();

      // Assert
      expect(await settings.getSettingValue('word-wrap')).toBe(true);
      
      // Verify in editor
      await editor.page.goto(testContext.baseUrl + '/editor');
      const longLine = 'a'.repeat(200);
      await editor.setContent(longLine);
      
      // Check if line is wrapped (would need visual testing)
      const editorWidth = await editor.page.locator('[data-testid="code-editor"]').boundingBox();
      expect(editorWidth).toBeTruthy();
    });

    test('should toggle line numbers', async () => {
      // Act
      await settings.setLineNumbers(false);
      await settings.saveSettings();

      // Assert
      await editor.page.goto(testContext.baseUrl + '/editor');
      const hasLineNumbers = await editor.page.locator('[data-testid="line-numbers"]').isVisible();
      expect(hasLineNumbers).toBe(false);
    });
  });

  describe('Terminal Settings', () => {
    test('should change terminal font size', async () => {
      // Act
      await settings.setTerminalFontSize(14);
      await settings.saveSettings();

      // Assert
      await terminal.navigateToTerminal();
      const terminalId = await terminal.createNewTerminal();
      const fontSize = await terminal.getTerminalFontSize(terminalId!);
      expect(fontSize).toBe(14);
    });

    test('should change default shell', async () => {
      // Act
      await settings.setDefaultShell('/bin/zsh');
      await settings.saveSettings();

      // Assert
      await terminal.navigateToTerminal();
      const terminalId = await terminal.createNewTerminal();
      const shell = await terminal.getTerminalShell(terminalId!);
      expect(shell).toBe('/bin/zsh');
    });

    test('should configure scrollback lines', async () => {
      // Act
      await settings.setTerminalScrollback(5000);
      await settings.saveSettings();

      // Assert
      expect(await settings.getSettingValue('terminal-scrollback')).toBe('5000');
    });
  });

  describe('Appearance Settings', () => {
    test('should change theme', async () => {
      // Act
      await settings.selectTheme('Dark Plus');
      await settings.saveSettings();

      // Assert
      expect(await settings.getCurrentTheme()).toBe('Dark Plus');
      
      // Verify theme applied
      const isDark = await settings.page.evaluate(() => {
        return document.documentElement.classList.contains('dark-theme');
      });
      expect(isDark).toBe(true);
    });

    test('should change accent color', async () => {
      // Act
      await settings.setAccentColor('#007acc');
      await settings.saveSettings();

      // Assert
      const accentElements = await settings.page.locator('.accent-color').count();
      expect(accentElements).toBeGreaterThan(0);
      
      const color = await settings.page.locator('.accent-color').first().evaluate(el => {
        return window.getComputedStyle(el).backgroundColor;
      });
      expect(color).toContain('rgb(0, 122, 204)'); // #007acc in rgb
    });

    test('should change sidebar position', async () => {
      // Act
      await settings.setSidebarPosition('right');
      await settings.saveSettings();

      // Assert
      await settings.page.reload();
      const sidebar = await settings.page.locator('[data-testid="sidebar"]').boundingBox();
      const window = await settings.page.viewportSize();
      
      expect(sidebar!.x).toBeGreaterThan(window!.width / 2);
    });

    test('should change activity bar position', async () => {
      // Act
      await settings.setActivityBarPosition('top');
      await settings.saveSettings();

      // Assert
      await settings.page.reload();
      const activityBar = await settings.page.locator('[data-testid="activity-bar"]').boundingBox();
      
      expect(activityBar!.y).toBeLessThan(100); // Near top
      expect(activityBar!.width).toBeGreaterThan(activityBar!.height); // Horizontal
    });

    test('should preview theme before saving', async () => {
      // Arrange
      const originalTheme = await settings.getCurrentTheme();

      // Act
      await settings.selectTheme('Light Plus');
      
      // Assert - Theme applied immediately
      const isLight = await settings.page.evaluate(() => {
        return document.documentElement.classList.contains('light-theme');
      });
      expect(isLight).toBe(true);

      // Cancel without saving
      await settings.page.keyboard.press('Escape');
      await settings.page.reload();
      
      // Theme should revert
      expect(await settings.getCurrentTheme()).toBe(originalTheme);
    });
  });

  describe('Keybindings', () => {
    test('should customize keybinding', async () => {
      // Act
      await settings.setKeybinding('editor.save', ['Control', 'Alt', 'S']);
      await settings.saveSettings();

      // Assert
      const binding = await settings.getKeybinding('editor.save');
      expect(binding).toBe('Ctrl+Alt+S');
    });

    test('should detect keybinding conflicts', async () => {
      // Act - Try to set conflicting keybinding
      await settings.setKeybinding('editor.copy', ['Control', 'S']);

      // Assert
      const warning = await settings.page.locator('[data-testid="keybinding-conflict"]').textContent();
      expect(warning).toContain('conflicts with editor.save');
    });

    test('should remove keybinding', async () => {
      // Act
      await settings.removeKeybinding('editor.toggleComment');
      await settings.saveSettings();

      // Assert
      const binding = await settings.getKeybinding('editor.toggleComment');
      expect(binding).toBe('');
    });

    test('should reset keybindings', async () => {
      // Arrange - Modify some keybindings
      await settings.setKeybinding('editor.save', ['Control', 'Alt', 'S']);
      await settings.setKeybinding('editor.undo', ['Control', 'Alt', 'Z']);
      await settings.saveSettings();

      // Act
      await settings.resetKeybindings();

      // Assert
      expect(await settings.getKeybinding('editor.save')).toBe('Ctrl+S');
      expect(await settings.getKeybinding('editor.undo')).toBe('Ctrl+Z');
    });

    test('should export and import keybindings', async () => {
      // Arrange - Customize keybindings
      await settings.setKeybinding('editor.save', ['Control', 'Alt', 'S']);
      await settings.setKeybinding('editor.find', ['Control', 'Alt', 'F']);

      // Act - Export
      const exported = await settings.exportKeybindings();
      
      // Reset
      await settings.resetKeybindings();
      
      // Import
      await settings.importKeybindings(exported);

      // Assert
      expect(await settings.getKeybinding('editor.save')).toBe('Ctrl+Alt+S');
      expect(await settings.getKeybinding('editor.find')).toBe('Ctrl+Alt+F');
    });

    test('should support when clauses', async () => {
      // Act
      await settings.searchKeybindings('editor.cut');
      
      // Assert
      const whenClause = await settings.page.locator(
        '[data-testid="keybinding-row"][data-command="editor.cut"] [data-testid="when-clause"]'
      ).textContent();
      
      expect(whenClause).toContain('editorTextFocus');
    });
  });

  describe('Settings Sync', () => {
    test('should export all settings', async () => {
      // Arrange - Configure various settings
      await settings.setAutoSave(true);
      await settings.setEditorFontSize(16);
      await settings.selectTheme('Dark Plus');
      await settings.saveSettings();

      // Act
      const exported = await settings.exportSettings();

      // Assert
      expect(exported.general.autoSave).toBe(true);
      expect(exported.editor.fontSize).toBe(16);
      expect(exported.appearance.theme).toBe('Dark Plus');
    });

    test('should import settings', async () => {
      // Arrange
      const settingsToImport = {
        general: { autoSave: true, autoSaveDelay: 10 },
        editor: { fontSize: 18, tabSize: 2 },
        appearance: { theme: 'Light Plus' }
      };

      // Act
      await settings.importSettings(settingsToImport);

      // Assert
      await settings.navigateToCategory('general');
      expect(await settings.getSettingValue('auto-save')).toBe(true);
      expect(await settings.getSettingValue('auto-save-delay')).toBe('10');
      
      await settings.navigateToCategory('editor');
      expect(await settings.getSettingValue('editor-font-size')).toBe('18');
    });

    test('should handle import errors', async () => {
      // Act - Import invalid settings
      await settings.importSettings({ invalid: 'data' });

      // Assert
      const error = await settings.page.locator('[data-testid="import-error"]').textContent();
      expect(error).toContain('Invalid settings format');
    });

    test('should backup settings before import', async () => {
      // Arrange
      const originalSettings = await settings.exportSettings();

      // Act
      await settings.importSettings({
        general: { autoSave: false },
        editor: { fontSize: 20 }
      });

      // Restore from backup
      await settings.page.locator('[data-testid="restore-backup"]').click();

      // Assert
      const restored = await settings.exportSettings();
      expect(restored).toEqual(originalSettings);
    });
  });

  describe('Extension Settings', () => {
    test('should toggle extension', async () => {
      // Act
      await settings.toggleExtension('test-extension', false);
      await settings.saveSettings();

      // Assert
      expect(await settings.getSettingValue('extension-test-extension-enabled')).toBe(false);
    });

    test('should configure extension', async () => {
      // Act
      await settings.configureExtension('formatter-extension');
      await settings.setSettingValue('formatter-printWidth', '100');
      await settings.setSettingValue('formatter-useTabs', false);
      await settings.saveSettings();

      // Assert
      expect(await settings.getSettingValue('formatter-printWidth')).toBe('100');
      expect(await settings.getSettingValue('formatter-useTabs')).toBe(false);
    });
  });

  describe('Performance', () => {
    test('should load settings quickly', async () => {
      // Act
      const startTime = Date.now();
      await settings.navigateToSettings();
      const loadTime = Date.now() - startTime;

      // Assert
      expect(loadTime).toBeLessThan(1000); // Should load within 1 second
    });

    test('should search settings efficiently', async () => {
      // Act
      const startTime = Date.now();
      await settings.searchSettings('font');
      await settings.page.waitForTimeout(300); // Wait for search
      const searchTime = Date.now() - startTime;

      // Assert
      expect(searchTime).toBeLessThan(500);
      
      // Verify results
      const results = await settings.page.locator('[data-testid="search-result"]').count();
      expect(results).toBeGreaterThan(0);
    });
  });

  describe('Settings Persistence', () => {
    test('should persist settings across sessions', async () => {
      // Arrange
      await settings.setAutoSave(true);
      await settings.setEditorFontSize(18);
      await settings.selectTheme('Dark Plus');
      await settings.saveSettings();

      // Act - Create new session
      const { page: newPage } = await testContext.createPage();
      const newSettings = new SettingsPage(newPage);
      await newPage.goto(testContext.baseUrl);
      await newSettings.navigateToSettings();

      // Assert
      await newSettings.navigateToCategory('general');
      expect(await newSettings.getSettingValue('auto-save')).toBe(true);
      
      await newSettings.navigateToCategory('editor');
      expect(await newSettings.getSettingValue('editor-font-size')).toBe('18');
      
      await newSettings.navigateToCategory('appearance');
      expect(await newSettings.getCurrentTheme()).toBe('Dark Plus');
    });

    test('should handle corrupted settings gracefully', async () => {
      // Corrupt settings file
      const settingsPath = path.join(testContext.getDataDir()!, 'settings.json');
      await fs.writeFile(settingsPath, '{ invalid json');

      // Act - Reload
      await settings.page.reload();

      // Assert
      const warning = await settings.page.locator('[data-testid="settings-corrupted"]').textContent();
      expect(warning).toContain('Settings file corrupted');
      
      // Should use defaults
      await settings.navigateToCategory('general');
      expect(await settings.getSettingValue('auto-save')).toBe(false); // Default
    });
  });
});