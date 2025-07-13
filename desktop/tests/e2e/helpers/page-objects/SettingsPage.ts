/**
 * Settings Page Object
 * Handles application settings and preferences
 */

import type { Page, Locator } from 'playwright';
import { BasePage } from './BasePage';

interface KeyBinding {
  command: string;
  keys: string[];
  when?: string;
}

export class SettingsPage extends BasePage {
  // Selectors
  private readonly settingsPanel = '[data-testid="settings-panel"]';
  private readonly categoryList = '[data-testid="settings-categories"]';
  private readonly settingsContent = '[data-testid="settings-content"]';
  private readonly searchInput = '[data-testid="settings-search"]';
  private readonly saveButton = '[data-testid="save-settings"]';
  private readonly resetButton = '[data-testid="reset-settings"]';
  private readonly notification = '[data-testid="notification"]';

  // Category selectors
  private readonly generalTab = '[data-testid="category-general"]';
  private readonly editorTab = '[data-testid="category-editor"]';
  private readonly terminalTab = '[data-testid="category-terminal"]';
  private readonly appearanceTab = '[data-testid="category-appearance"]';
  private readonly keybindingsTab = '[data-testid="category-keybindings"]';
  private readonly extensionsTab = '[data-testid="category-extensions"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to settings
   */
  async navigateToSettings() {
    await this.goto('/settings');
    await this.waitForElement(this.settingsPanel);
  }

  /**
   * Navigate to category
   */
  async navigateToCategory(category: 'general' | 'editor' | 'terminal' | 'appearance' | 'keybindings' | 'extensions') {
    const categoryMap = {
      general: this.generalTab,
      editor: this.editorTab,
      terminal: this.terminalTab,
      appearance: this.appearanceTab,
      keybindings: this.keybindingsTab,
      extensions: this.extensionsTab
    };
    
    await this.clickElement(categoryMap[category]);
    await this.waitForElement(this.settingsContent);
  }

  /**
   * Search settings
   */
  async searchSettings(query: string) {
    await this.fillInput(this.searchInput, query);
    await this.page.waitForTimeout(300); // Debounce
  }

  /**
   * Save settings
   */
  async saveSettings() {
    await this.clickElement(this.saveButton);
    await this.waitForCondition(
      async () => await this.elementExists(this.notification),
      { timeout: 5000 }
    );
  }

  /**
   * Reset settings
   */
  async resetSettings() {
    await this.clickElement(this.resetButton);
    await this.clickElement('[data-testid="confirm-reset"]');
  }

  // General Settings
  
  /**
   * Set auto-save
   */
  async setAutoSave(enabled: boolean) {
    await this.navigateToCategory('general');
    const toggle = '[data-testid="auto-save-toggle"]';
    const isEnabled = await this.page.locator(toggle).isChecked();
    
    if (isEnabled !== enabled) {
      await this.clickElement(toggle);
    }
  }

  /**
   * Set auto-save delay
   */
  async setAutoSaveDelay(seconds: number) {
    await this.navigateToCategory('general');
    await this.fillInput('[data-testid="auto-save-delay"]', seconds.toString());
  }

  /**
   * Set language
   */
  async setLanguage(language: string) {
    await this.navigateToCategory('general');
    await this.selectOption('[data-testid="language-select"]', language);
  }

  /**
   * Set workspace
   */
  async setDefaultWorkspace(path: string) {
    await this.navigateToCategory('general');
    await this.fillInput('[data-testid="default-workspace"]', path);
  }

  // Editor Settings
  
  /**
   * Set font size
   */
  async setEditorFontSize(size: number) {
    await this.navigateToCategory('editor');
    await this.fillInput('[data-testid="editor-font-size"]', size.toString());
  }

  /**
   * Set font family
   */
  async setEditorFontFamily(font: string) {
    await this.navigateToCategory('editor');
    await this.fillInput('[data-testid="editor-font-family"]', font);
  }

  /**
   * Set tab size
   */
  async setTabSize(size: number) {
    await this.navigateToCategory('editor');
    await this.fillInput('[data-testid="tab-size"]', size.toString());
  }

  /**
   * Set word wrap
   */
  async setWordWrap(enabled: boolean) {
    await this.navigateToCategory('editor');
    const toggle = '[data-testid="word-wrap-toggle"]';
    const isEnabled = await this.page.locator(toggle).isChecked();
    
    if (isEnabled !== enabled) {
      await this.clickElement(toggle);
    }
  }

  /**
   * Set line numbers
   */
  async setLineNumbers(enabled: boolean) {
    await this.navigateToCategory('editor');
    const toggle = '[data-testid="line-numbers-toggle"]';
    const isEnabled = await this.page.locator(toggle).isChecked();
    
    if (isEnabled !== enabled) {
      await this.clickElement(toggle);
    }
  }

  // Terminal Settings
  
  /**
   * Set terminal font size
   */
  async setTerminalFontSize(size: number) {
    await this.navigateToCategory('terminal');
    await this.fillInput('[data-testid="terminal-font-size"]', size.toString());
  }

  /**
   * Set default shell
   */
  async setDefaultShell(shell: string) {
    await this.navigateToCategory('terminal');
    await this.selectOption('[data-testid="default-shell"]', shell);
  }

  /**
   * Set terminal scrollback
   */
  async setTerminalScrollback(lines: number) {
    await this.navigateToCategory('terminal');
    await this.fillInput('[data-testid="terminal-scrollback"]', lines.toString());
  }

  // Appearance Settings
  
  /**
   * Select theme
   */
  async selectTheme(theme: string) {
    await this.navigateToCategory('appearance');
    await this.clickElement(`[data-testid="theme-option"][data-theme="${theme}"]`);
  }

  /**
   * Get current theme
   */
  async getCurrentTheme(): Promise<string> {
    await this.navigateToCategory('appearance');
    const activeTheme = await this.waitForElement('[data-testid="theme-option"].active');
    return await activeTheme.getAttribute('data-theme') || '';
  }

  /**
   * Set accent color
   */
  async setAccentColor(color: string) {
    await this.navigateToCategory('appearance');
    await this.fillInput('[data-testid="accent-color"]', color);
  }

  /**
   * Set sidebar position
   */
  async setSidebarPosition(position: 'left' | 'right') {
    await this.navigateToCategory('appearance');
    await this.clickElement(`[data-testid="sidebar-position-${position}"]`);
  }

  /**
   * Set activity bar position
   */
  async setActivityBarPosition(position: 'side' | 'top') {
    await this.navigateToCategory('appearance');
    await this.clickElement(`[data-testid="activity-bar-${position}"]`);
  }

  // Keybindings Settings
  
  /**
   * Search keybindings
   */
  async searchKeybindings(query: string) {
    await this.navigateToCategory('keybindings');
    await this.fillInput('[data-testid="keybinding-search"]', query);
    await this.page.waitForTimeout(300);
  }

  /**
   * Get keybinding
   */
  async getKeybinding(command: string): Promise<string> {
    await this.searchKeybindings(command);
    const binding = await this.waitForElement(`[data-testid="keybinding-row"][data-command="${command}"]`);
    return await binding.locator('[data-testid="keybinding-keys"]').textContent() || '';
  }

  /**
   * Set keybinding
   */
  async setKeybinding(command: string, keys: string[]) {
    await this.searchKeybindings(command);
    const row = `[data-testid="keybinding-row"][data-command="${command}"]`;
    await this.doubleClick(`${row} [data-testid="keybinding-keys"]`);
    
    // Record new keybinding
    for (const key of keys) {
      await this.page.keyboard.press(key);
    }
    
    await this.clickElement('[data-testid="accept-keybinding"]');
  }

  /**
   * Remove keybinding
   */
  async removeKeybinding(command: string) {
    await this.searchKeybindings(command);
    const row = `[data-testid="keybinding-row"][data-command="${command}"]`;
    await this.clickElement(`${row} [data-testid="remove-keybinding"]`);
  }

  /**
   * Reset keybindings
   */
  async resetKeybindings() {
    await this.navigateToCategory('keybindings');
    await this.clickElement('[data-testid="reset-keybindings"]');
    await this.clickElement('[data-testid="confirm-reset"]');
  }

  /**
   * Export keybindings
   */
  async exportKeybindings(): Promise<KeyBinding[]> {
    await this.navigateToCategory('keybindings');
    await this.clickElement('[data-testid="export-keybindings"]');
    
    return await this.page.evaluate(() => {
      return (window as any).exportedKeybindings || [];
    });
  }

  /**
   * Import keybindings
   */
  async importKeybindings(keybindings: KeyBinding[]) {
    await this.navigateToCategory('keybindings');
    await this.clickElement('[data-testid="import-keybindings"]');
    
    await this.page.evaluate((bindings) => {
      (window as any).importKeybindings(bindings);
    }, keybindings);
  }

  // Extension Settings
  
  /**
   * Toggle extension
   */
  async toggleExtension(extensionId: string, enabled: boolean) {
    await this.navigateToCategory('extensions');
    const toggle = `[data-testid="extension-toggle"][data-extension="${extensionId}"]`;
    const isEnabled = await this.page.locator(toggle).isChecked();
    
    if (isEnabled !== enabled) {
      await this.clickElement(toggle);
    }
  }

  /**
   * Configure extension
   */
  async configureExtension(extensionId: string) {
    await this.navigateToCategory('extensions');
    const row = `[data-testid="extension-row"][data-extension="${extensionId}"]`;
    await this.clickElement(`${row} [data-testid="configure-extension"]`);
  }

  // Settings Import/Export
  
  /**
   * Export settings
   */
  async exportSettings(): Promise<any> {
    await this.clickElement('[data-testid="export-settings"]');
    
    return await this.page.evaluate(() => {
      return (window as any).exportedSettings || {};
    });
  }

  /**
   * Import settings
   */
  async importSettings(settings: any) {
    await this.clickElement('[data-testid="import-settings"]');
    
    await this.page.evaluate((settings) => {
      (window as any).importSettings(settings);
    }, settings);
  }

  /**
   * Get notification
   */
  async getNotification(): Promise<string> {
    try {
      return await this.getTextContent(this.notification);
    } catch {
      return '';
    }
  }

  /**
   * Get setting value
   */
  async getSettingValue(settingId: string): Promise<any> {
    const input = `[data-testid="setting-${settingId}"]`;
    const element = await this.waitForElement(input);
    const tagName = await element.evaluate(el => el.tagName);
    
    if (tagName === 'INPUT') {
      const type = await element.getAttribute('type');
      if (type === 'checkbox') {
        return await element.isChecked();
      }
      return await element.inputValue();
    } else if (tagName === 'SELECT') {
      return await element.inputValue();
    }
    
    return await element.textContent();
  }

  /**
   * Set setting value
   */
  async setSettingValue(settingId: string, value: any) {
    const input = `[data-testid="setting-${settingId}"]`;
    const element = await this.waitForElement(input);
    const tagName = await element.evaluate(el => el.tagName);
    
    if (tagName === 'INPUT') {
      const type = await element.getAttribute('type');
      if (type === 'checkbox') {
        const isChecked = await element.isChecked();
        if (isChecked !== value) {
          await element.click();
        }
      } else {
        await element.fill(value.toString());
      }
    } else if (tagName === 'SELECT') {
      await element.selectOption(value);
    }
  }

  /**
   * Validate settings
   */
  async validateSettings(): Promise<boolean> {
    await this.clickElement('[data-testid="validate-settings"]');
    await this.page.waitForTimeout(500);
    
    return !await this.elementExists('[data-testid="validation-error"]');
  }

  /**
   * Get validation errors
   */
  async getValidationErrors(): Promise<string[]> {
    const errors = await this.getAllElements('[data-testid="validation-error"]');
    const messages: string[] = [];
    
    for (const error of errors) {
      messages.push(await error.textContent() || '');
    }
    
    return messages;
  }
}