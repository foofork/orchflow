/**
 * Editor Page Object
 * Handles code editor interactions and operations
 */

import type { Page, Locator } from 'playwright';
import { BasePage } from './BasePage';

export class EditorPage extends BasePage {
  // Selectors
  private readonly editor = '[data-testid="code-editor"]';
  private readonly editorContent = '[data-testid="editor-content"]';
  private readonly tabBar = '[data-testid="editor-tabs"]';
  private readonly activeTab = '[data-testid="editor-tab"].active';
  private readonly statusBar = '[data-testid="status-bar"]';
  private readonly saveButton = '[data-testid="save-button"]';
  private readonly dirtyIndicator = '[data-testid="dirty-indicator"]';
  private readonly errorMessage = '[data-testid="editor-error"]';
  private readonly conflictIndicator = '[data-testid="conflict-indicator"]';
  private readonly autoSaveToggle = '[data-testid="auto-save-toggle"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Check if file is open
   */
  async isFileOpen(fileName: string): Promise<boolean> {
    return await this.elementExists(`[data-testid="editor-tab"][data-file="${fileName}"]`);
  }

  /**
   * Get editor content
   */
  async getContent(): Promise<string> {
    // Handle different editor implementations
    const monacoContent = await this.page.evaluate(() => {
      const monaco = (window as any).monaco;
      if (monaco && monaco.editor) {
        const editors = monaco.editor.getEditors();
        if (editors.length > 0) {
          return editors[0].getValue();
        }
      }
      return null;
    });

    if (monacoContent !== null) {
      return monacoContent;
    }

    // Fallback to textarea or contenteditable
    const editorElement = await this.waitForElement(this.editorContent);
    const tagName = await editorElement.evaluate(el => el.tagName);
    
    if (tagName === 'TEXTAREA' || tagName === 'INPUT') {
      return await editorElement.inputValue();
    } else {
      return await editorElement.textContent() || '';
    }
  }

  /**
   * Set editor content
   */
  async setContent(content: string) {
    // Try Monaco editor API first
    const success = await this.page.evaluate((content) => {
      const monaco = (window as any).monaco;
      if (monaco && monaco.editor) {
        const editors = monaco.editor.getEditors();
        if (editors.length > 0) {
          editors[0].setValue(content);
          return true;
        }
      }
      return false;
    }, content);

    if (!success) {
      // Fallback to direct input
      const editorElement = await this.waitForElement(this.editorContent);
      await editorElement.click();
      await this.page.keyboard.press('Control+A');
      await editorElement.fill(content);
    }
  }

  /**
   * Type text in editor
   */
  async typeText(text: string) {
    const editorElement = await this.waitForElement(this.editorContent);
    await editorElement.click();
    await editorElement.type(text);
  }

  /**
   * Save file
   */
  async save() {
    await this.page.keyboard.press('Control+S');
    // Wait for save to complete
    await this.waitForCondition(async () => !(await this.isDirty()), {
      timeout: 5000,
      interval: 100
    });
  }

  /**
   * Check if file has unsaved changes
   */
  async isDirty(): Promise<boolean> {
    return await this.elementExists(this.dirtyIndicator);
  }

  /**
   * Check if has unsaved indicator
   */
  async hasUnsavedIndicator(): Promise<boolean> {
    const activeTab = await this.waitForElement(this.activeTab);
    const indicator = await activeTab.locator('[data-testid="unsaved-dot"]').count();
    return indicator > 0;
  }

  /**
   * Undo
   */
  async undo() {
    await this.page.keyboard.press('Control+Z');
    await this.page.waitForTimeout(100);
  }

  /**
   * Redo
   */
  async redo() {
    await this.page.keyboard.press('Control+Shift+Z');
    await this.page.waitForTimeout(100);
  }

  /**
   * Enable auto-save
   */
  async enableAutoSave() {
    const isEnabled = await this.page.locator(this.autoSaveToggle).isChecked();
    if (!isEnabled) {
      await this.clickElement(this.autoSaveToggle);
    }
  }

  /**
   * Disable auto-save
   */
  async disableAutoSave() {
    const isEnabled = await this.page.locator(this.autoSaveToggle).isChecked();
    if (isEnabled) {
      await this.clickElement(this.autoSaveToggle);
    }
  }

  /**
   * Get current file name
   */
  async getCurrentFileName(): Promise<string> {
    const activeTab = await this.waitForElement(this.activeTab);
    return await activeTab.getAttribute('data-file') || '';
  }

  /**
   * Get current file path
   */
  async getCurrentFilePath(): Promise<string> {
    const activeTab = await this.waitForElement(this.activeTab);
    return await activeTab.getAttribute('data-file-path') || '';
  }

  /**
   * Save as new file
   */
  async saveAs(newFileName: string) {
    await this.page.keyboard.press('Control+Shift+S');
    const dialog = await this.waitForElement('[data-testid="save-as-dialog"]');
    await this.fillInput('[data-testid="save-as-input"]', newFileName);
    await this.clickElement('[data-testid="save-as-confirm"]');
  }

  /**
   * Get error message
   */
  async getErrorMessage(): Promise<string> {
    try {
      return await this.getTextContent(this.errorMessage);
    } catch {
      return '';
    }
  }

  /**
   * Check for conflict indicator
   */
  async hasConflictIndicator(): Promise<boolean> {
    return await this.elementExists(this.conflictIndicator);
  }

  /**
   * Resolve conflict
   */
  async resolveConflict(resolution: 'mine' | 'theirs' | 'merge') {
    await this.clickElement(this.conflictIndicator);
    await this.clickElement(`[data-testid="resolve-${resolution}"]`);
  }

  /**
   * Close current tab
   */
  async closeCurrentTab() {
    const activeTab = await this.waitForElement(this.activeTab);
    const closeButton = activeTab.locator('[data-testid="close-tab"]');
    await closeButton.click();
  }

  /**
   * Close all tabs
   */
  async closeAllTabs() {
    await this.rightClick(this.tabBar);
    await this.clickElement('[data-testid="close-all-tabs"]');
  }

  /**
   * Go to line
   */
  async goToLine(lineNumber: number) {
    await this.page.keyboard.press('Control+G');
    const input = await this.waitForElement('[data-testid="goto-line-input"]');
    await input.fill(lineNumber.toString());
    await input.press('Enter');
  }

  /**
   * Find in file
   */
  async findInFile(searchTerm: string) {
    await this.page.keyboard.press('Control+F');
    const searchBox = await this.waitForElement('[data-testid="find-input"]');
    await searchBox.fill(searchTerm);
  }

  /**
   * Replace in file
   */
  async replaceInFile(searchTerm: string, replaceTerm: string) {
    await this.page.keyboard.press('Control+H');
    const searchBox = await this.waitForElement('[data-testid="find-input"]');
    const replaceBox = await this.waitForElement('[data-testid="replace-input"]');
    
    await searchBox.fill(searchTerm);
    await replaceBox.fill(replaceTerm);
    
    await this.clickElement('[data-testid="replace-all"]');
  }

  /**
   * Format document
   */
  async formatDocument() {
    await this.page.keyboard.press('Shift+Alt+F');
    await this.page.waitForTimeout(500); // Wait for formatting
  }

  /**
   * Toggle comment
   */
  async toggleComment() {
    await this.page.keyboard.press('Control+/');
  }

  /**
   * Get cursor position
   */
  async getCursorPosition(): Promise<{ line: number; column: number }> {
    const position = await this.getTextContent('[data-testid="cursor-position"]');
    const match = position.match(/Ln (\d+), Col (\d+)/);
    
    if (match) {
      return {
        line: parseInt(match[1]),
        column: parseInt(match[2])
      };
    }
    
    return { line: 1, column: 1 };
  }

  /**
   * Select text
   */
  async selectText(startLine: number, startCol: number, endLine: number, endCol: number) {
    await this.goToLine(startLine);
    
    // Move to start position
    for (let i = 1; i < startCol; i++) {
      await this.page.keyboard.press('ArrowRight');
    }
    
    // Start selection
    await this.page.keyboard.down('Shift');
    
    // Move to end position
    const lineDiff = endLine - startLine;
    for (let i = 0; i < lineDiff; i++) {
      await this.page.keyboard.press('ArrowDown');
    }
    
    if (endLine === startLine) {
      const colDiff = endCol - startCol;
      for (let i = 0; i < colDiff; i++) {
        await this.page.keyboard.press('ArrowRight');
      }
    } else {
      for (let i = 1; i < endCol; i++) {
        await this.page.keyboard.press('ArrowRight');
      }
    }
    
    await this.page.keyboard.up('Shift');
  }

  /**
   * Get selected text
   */
  async getSelectedText(): Promise<string> {
    return await this.page.evaluate(() => window.getSelection()?.toString() || '');
  }

  /**
   * Enable syntax highlighting
   */
  async setSyntaxHighlighting(language: string) {
    await this.clickElement('[data-testid="language-selector"]');
    await this.clickElement(`[data-testid="language-${language}"]`);
  }

  /**
   * Get current language mode
   */
  async getCurrentLanguage(): Promise<string> {
    return await this.getTextContent('[data-testid="current-language"]');
  }

  /**
   * Toggle word wrap
   */
  async toggleWordWrap() {
    await this.clickElement('[data-testid="toggle-word-wrap"]');
  }

  /**
   * Split editor
   */
  async splitEditor(direction: 'horizontal' | 'vertical') {
    await this.rightClick(this.editor);
    await this.clickElement(`[data-testid="split-${direction}"]`);
  }

  /**
   * Get editor theme
   */
  async getTheme(): Promise<string> {
    const editor = await this.waitForElement(this.editor);
    return await editor.getAttribute('data-theme') || 'default';
  }

  /**
   * Set editor theme
   */
  async setTheme(theme: string) {
    await this.clickElement('[data-testid="theme-selector"]');
    await this.clickElement(`[data-testid="theme-${theme}"]`);
  }

  /**
   * Get font size
   */
  async getFontSize(): Promise<number> {
    const editor = await this.waitForElement(this.editor);
    const fontSize = await editor.evaluate(el => {
      return parseInt(window.getComputedStyle(el).fontSize);
    });
    return fontSize;
  }

  /**
   * Increase font size
   */
  async increaseFontSize() {
    await this.page.keyboard.press('Control+Plus');
  }

  /**
   * Decrease font size
   */
  async decreaseFontSize() {
    await this.page.keyboard.press('Control+Minus');
  }

  /**
   * Reset font size
   */
  async resetFontSize() {
    await this.page.keyboard.press('Control+0');
  }
}