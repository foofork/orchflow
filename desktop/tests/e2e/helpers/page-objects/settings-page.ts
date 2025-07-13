import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

export class SettingsPage {
  private page: Page;
  private settingsDialog: Locator;
  private settingsMenu: Locator;
  private generalTab: Locator;
  private editorTab: Locator;
  private terminalTab: Locator;
  private gitTab: Locator;
  private appearanceTab: Locator;
  private extensionsTab: Locator;
  private keybindingsTab: Locator;
  private saveButton: Locator;
  private cancelButton: Locator;
  private resetButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.settingsDialog = page.locator('[data-testid="settings-dialog"]');
    this.settingsMenu = page.locator('[data-testid="settings-menu"]');
    this.generalTab = page.locator('[data-testid="settings-tab-general"]');
    this.editorTab = page.locator('[data-testid="settings-tab-editor"]');
    this.terminalTab = page.locator('[data-testid="settings-tab-terminal"]');
    this.gitTab = page.locator('[data-testid="settings-tab-git"]');
    this.appearanceTab = page.locator('[data-testid="settings-tab-appearance"]');
    this.extensionsTab = page.locator('[data-testid="settings-tab-extensions"]');
    this.keybindingsTab = page.locator('[data-testid="settings-tab-keybindings"]');
    this.saveButton = page.locator('[data-testid="settings-save"]');
    this.cancelButton = page.locator('[data-testid="settings-cancel"]');
    this.resetButton = page.locator('[data-testid="settings-reset"]');
  }

  async open(): Promise<void> {
    // Try multiple ways to open settings
    const shortcuts = ['Control+,', 'Control+Shift+P'];
    
    for (const shortcut of shortcuts) {
      await this.page.keyboard.press(shortcut);
      
      if (shortcut === 'Control+Shift+P') {
        await this.page.keyboard.type('Preferences: Open Settings');
        await this.page.keyboard.press('Enter');
      }
      
      try {
        await this.settingsDialog.waitFor({ state: 'visible', timeout: 2000 });
        return;
      } catch {
        // Try next method
      }
    }
    
    // Fallback to menu
    const menuButton = this.page.locator('[data-testid="menu-button"], [aria-label="Settings"]');
    await menuButton.click();
    
    const settingsMenuItem = this.page.locator('[data-testid="menu-settings"]');
    await settingsMenuItem.click();
    
    await this.settingsDialog.waitFor({ state: 'visible' });
  }

  async close(): Promise<void> {
    const closeButton = this.settingsDialog.locator('[data-testid="close-dialog"]');
    
    if (await closeButton.isVisible()) {
      await closeButton.click();
    } else {
      await this.page.keyboard.press('Escape');
    }
    
    await this.settingsDialog.waitFor({ state: 'hidden' });
  }

  async switchToTab(tabName: 'general' | 'editor' | 'terminal' | 'git' | 'appearance' | 'extensions' | 'keybindings'): Promise<void> {
    const tabMap = {
      general: this.generalTab,
      editor: this.editorTab,
      terminal: this.terminalTab,
      git: this.gitTab,
      appearance: this.appearanceTab,
      extensions: this.extensionsTab,
      keybindings: this.keybindingsTab
    };
    
    await tabMap[tabName].click();
    await this.page.waitForTimeout(100);
  }

  async save(): Promise<void> {
    await this.saveButton.click();
    await this.page.waitForTimeout(200);
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }

  async reset(): Promise<void> {
    await this.resetButton.click();
    
    const confirmButton = this.page.locator('[data-testid="confirm-reset"]');
    await confirmButton.click();
    
    await this.page.waitForTimeout(200);
  }

  // General Settings
  async setAutoSave(enabled: boolean): Promise<void> {
    await this.switchToTab('general');
    const toggle = this.page.locator('[data-testid="auto-save-toggle"]');
    
    const isChecked = await toggle.isChecked();
    if (isChecked !== enabled) {
      await toggle.click();
    }
  }

  async setAutoSaveDelay(seconds: number): Promise<void> {
    await this.switchToTab('general');
    const input = this.page.locator('[data-testid="auto-save-delay"]');
    await input.clear();
    await input.fill(seconds.toString());
  }

  async setDefaultProjectPath(path: string): Promise<void> {
    await this.switchToTab('general');
    const input = this.page.locator('[data-testid="default-project-path"]');
    await input.clear();
    await input.fill(path);
  }

  async setLanguage(language: string): Promise<void> {
    await this.switchToTab('general');
    const select = this.page.locator('[data-testid="language-select"]');
    await select.selectOption(language);
  }

  // Editor Settings
  async setFontSize(size: number): Promise<void> {
    await this.switchToTab('editor');
    const input = this.page.locator('[data-testid="font-size"]');
    await input.clear();
    await input.fill(size.toString());
  }

  async setFontFamily(fontFamily: string): Promise<void> {
    await this.switchToTab('editor');
    const input = this.page.locator('[data-testid="font-family"]');
    await input.clear();
    await input.fill(fontFamily);
  }

  async setTabSize(size: number): Promise<void> {
    await this.switchToTab('editor');
    const input = this.page.locator('[data-testid="tab-size"]');
    await input.clear();
    await input.fill(size.toString());
  }

  async setWordWrap(enabled: boolean): Promise<void> {
    await this.switchToTab('editor');
    const toggle = this.page.locator('[data-testid="word-wrap-toggle"]');
    
    const isChecked = await toggle.isChecked();
    if (isChecked !== enabled) {
      await toggle.click();
    }
  }

  async setLineNumbers(enabled: boolean): Promise<void> {
    await this.switchToTab('editor');
    const toggle = this.page.locator('[data-testid="line-numbers-toggle"]');
    
    const isChecked = await toggle.isChecked();
    if (isChecked !== enabled) {
      await toggle.click();
    }
  }

  async setMinimap(enabled: boolean): Promise<void> {
    await this.switchToTab('editor');
    const toggle = this.page.locator('[data-testid="minimap-toggle"]');
    
    const isChecked = await toggle.isChecked();
    if (isChecked !== enabled) {
      await toggle.click();
    }
  }

  async setBracketMatching(enabled: boolean): Promise<void> {
    await this.switchToTab('editor');
    const toggle = this.page.locator('[data-testid="bracket-matching-toggle"]');
    
    const isChecked = await toggle.isChecked();
    if (isChecked !== enabled) {
      await toggle.click();
    }
  }

  // Terminal Settings
  async setTerminalFontSize(size: number): Promise<void> {
    await this.switchToTab('terminal');
    const input = this.page.locator('[data-testid="terminal-font-size"]');
    await input.clear();
    await input.fill(size.toString());
  }

  async setTerminalFontFamily(fontFamily: string): Promise<void> {
    await this.switchToTab('terminal');
    const input = this.page.locator('[data-testid="terminal-font-family"]');
    await input.clear();
    await input.fill(fontFamily);
  }

  async setShell(shellPath: string): Promise<void> {
    await this.switchToTab('terminal');
    const input = this.page.locator('[data-testid="shell-path"]');
    await input.clear();
    await input.fill(shellPath);
  }

  async setCursorStyle(style: 'block' | 'underline' | 'bar'): Promise<void> {
    await this.switchToTab('terminal');
    const select = this.page.locator('[data-testid="cursor-style"]');
    await select.selectOption(style);
  }

  async setScrollback(lines: number): Promise<void> {
    await this.switchToTab('terminal');
    const input = this.page.locator('[data-testid="scrollback-lines"]');
    await input.clear();
    await input.fill(lines.toString());
  }

  // Git Settings
  async setGitUserName(name: string): Promise<void> {
    await this.switchToTab('git');
    const input = this.page.locator('[data-testid="git-user-name"]');
    await input.clear();
    await input.fill(name);
  }

  async setGitUserEmail(email: string): Promise<void> {
    await this.switchToTab('git');
    const input = this.page.locator('[data-testid="git-user-email"]');
    await input.clear();
    await input.fill(email);
  }

  async setGitAutoFetch(enabled: boolean): Promise<void> {
    await this.switchToTab('git');
    const toggle = this.page.locator('[data-testid="git-auto-fetch-toggle"]');
    
    const isChecked = await toggle.isChecked();
    if (isChecked !== enabled) {
      await toggle.click();
    }
  }

  async setGitAutoFetchPeriod(minutes: number): Promise<void> {
    await this.switchToTab('git');
    const input = this.page.locator('[data-testid="git-auto-fetch-period"]');
    await input.clear();
    await input.fill(minutes.toString());
  }

  async setGitConfirmSync(enabled: boolean): Promise<void> {
    await this.switchToTab('git');
    const toggle = this.page.locator('[data-testid="git-confirm-sync-toggle"]');
    
    const isChecked = await toggle.isChecked();
    if (isChecked !== enabled) {
      await toggle.click();
    }
  }

  // Appearance Settings
  async setTheme(theme: 'light' | 'dark' | 'auto'): Promise<void> {
    await this.switchToTab('appearance');
    const select = this.page.locator('[data-testid="theme-select"]');
    await select.selectOption(theme);
  }

  async setColorScheme(scheme: string): Promise<void> {
    await this.switchToTab('appearance');
    const select = this.page.locator('[data-testid="color-scheme-select"]');
    await select.selectOption(scheme);
  }

  async setIconTheme(theme: string): Promise<void> {
    await this.switchToTab('appearance');
    const select = this.page.locator('[data-testid="icon-theme-select"]');
    await select.selectOption(theme);
  }

  async setActivityBarPosition(position: 'left' | 'right'): Promise<void> {
    await this.switchToTab('appearance');
    const radio = this.page.locator(`[data-testid="activity-bar-${position}"]`);
    await radio.check();
  }

  async setSidebarPosition(position: 'left' | 'right'): Promise<void> {
    await this.switchToTab('appearance');
    const radio = this.page.locator(`[data-testid="sidebar-${position}"]`);
    await radio.check();
  }

  // Extensions Settings
  async enableExtension(extensionId: string): Promise<void> {
    await this.switchToTab('extensions');
    const extension = this.page.locator(`[data-testid="extension-${extensionId}"]`);
    const toggle = extension.locator('[data-testid="extension-toggle"]');
    
    const isEnabled = await toggle.isChecked();
    if (!isEnabled) {
      await toggle.click();
    }
  }

  async disableExtension(extensionId: string): Promise<void> {
    await this.switchToTab('extensions');
    const extension = this.page.locator(`[data-testid="extension-${extensionId}"]`);
    const toggle = extension.locator('[data-testid="extension-toggle"]');
    
    const isEnabled = await toggle.isChecked();
    if (isEnabled) {
      await toggle.click();
    }
  }

  async configureExtension(extensionId: string): Promise<void> {
    await this.switchToTab('extensions');
    const extension = this.page.locator(`[data-testid="extension-${extensionId}"]`);
    const configButton = extension.locator('[data-testid="extension-config"]');
    await configButton.click();
    
    // This would open extension-specific settings
    const extensionSettings = this.page.locator('[data-testid="extension-settings-dialog"]');
    await extensionSettings.waitFor({ state: 'visible' });
  }

  // Keybindings Settings
  async searchKeybinding(search: string): Promise<void> {
    await this.switchToTab('keybindings');
    const searchInput = this.page.locator('[data-testid="keybinding-search"]');
    await searchInput.clear();
    await searchInput.fill(search);
    await searchInput.press('Enter');
  }

  async setKeybinding(command: string, keybinding: string): Promise<void> {
    await this.switchToTab('keybindings');
    await this.searchKeybinding(command);
    
    const row = this.page.locator(`[data-testid="keybinding-${command}"]`);
    const editButton = row.locator('[data-testid="edit-keybinding"]');
    await editButton.click();
    
    const input = row.locator('[data-testid="keybinding-input"]');
    await input.clear();
    
    // Record the keybinding
    await input.click();
    await this.page.keyboard.press(keybinding);
    
    await input.press('Enter');
  }

  async removeKeybinding(command: string): Promise<void> {
    await this.switchToTab('keybindings');
    await this.searchKeybinding(command);
    
    const row = this.page.locator(`[data-testid="keybinding-${command}"]`);
    const removeButton = row.locator('[data-testid="remove-keybinding"]');
    await removeButton.click();
  }

  async resetKeybindings(): Promise<void> {
    await this.switchToTab('keybindings');
    const resetButton = this.page.locator('[data-testid="reset-all-keybindings"]');
    await resetButton.click();
    
    const confirmButton = this.page.locator('[data-testid="confirm-reset-keybindings"]');
    await confirmButton.click();
  }

  // Helper methods
  async getSetting(settingId: string): Promise<string> {
    const input = this.page.locator(`[data-testid="${settingId}"]`);
    
    if (await input.getAttribute('type') === 'checkbox') {
      return (await input.isChecked()).toString();
    }
    
    return await input.inputValue() || await input.textContent() || '';
  }

  async searchSettings(query: string): Promise<void> {
    const searchBox = this.settingsDialog.locator('[data-testid="settings-search"]');
    await searchBox.clear();
    await searchBox.fill(query);
    await searchBox.press('Enter');
    await this.page.waitForTimeout(200);
  }

  async exportSettings(): Promise<void> {
    const exportButton = this.settingsDialog.locator('[data-testid="export-settings"]');
    await exportButton.click();
    
    // Handle file save dialog
    const saveDialog = this.page.locator('[data-testid="save-dialog"]');
    await saveDialog.waitFor({ state: 'visible' });
    
    const saveButton = saveDialog.locator('[data-testid="save-file"]');
    await saveButton.click();
  }

  async importSettings(filePath: string): Promise<void> {
    const importButton = this.settingsDialog.locator('[data-testid="import-settings"]');
    await importButton.click();
    
    const fileInput = this.page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);
    
    await this.page.waitForTimeout(200);
  }

  async isSettingModified(settingId: string): Promise<boolean> {
    const setting = this.page.locator(`[data-testid="${settingId}"]`);
    const parent = setting.locator('..');
    
    return await parent.getAttribute('data-modified') === 'true';
  }

  async getModifiedSettings(): Promise<string[]> {
    const modifiedSettings = await this.settingsDialog.locator('[data-modified="true"]').all();
    const settingIds: string[] = [];
    
    for (const setting of modifiedSettings) {
      const id = await setting.locator('[data-testid]').getAttribute('data-testid');
      if (id) settingIds.push(id);
    }
    
    return settingIds;
  }

  async validateSettings(): Promise<{ valid: boolean; errors: string[] }> {
    const saveButton = this.saveButton;
    const isDisabled = await saveButton.isDisabled();
    
    if (isDisabled) {
      const errors = await this.settingsDialog.locator('[data-testid="validation-error"]').all();
      const errorMessages: string[] = [];
      
      for (const error of errors) {
        const message = await error.textContent();
        if (message) errorMessages.push(message);
      }
      
      return { valid: false, errors: errorMessages };
    }
    
    return { valid: true, errors: [] };
  }
}