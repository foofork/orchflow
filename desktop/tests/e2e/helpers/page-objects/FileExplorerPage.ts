/**
 * File Explorer Page Object
 * Handles file tree navigation and file management operations
 */

import type { Page, Locator } from 'playwright';
import { BasePage } from './BasePage';

export class FileExplorerPage extends BasePage {
  // Selectors
  private readonly fileTree = '[data-testid="file-tree"]';
  private readonly fileItem = '[data-testid="file-item"]';
  private readonly folderItem = '[data-testid="folder-item"]';
  private readonly contextMenu = '[data-testid="context-menu"]';
  private readonly newFileButton = '[data-testid="new-file-button"]';
  private readonly newFolderButton = '[data-testid="new-folder-button"]';
  private readonly searchInput = '[data-testid="file-search-input"]';
  private readonly errorMessage = '[data-testid="file-error-message"]';
  private readonly warningDialog = '[data-testid="warning-dialog"]';
  private readonly confirmButton = '[data-testid="confirm-button"]';
  private readonly cancelButton = '[data-testid="cancel-button"]';
  private readonly trashView = '[data-testid="trash-view"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Open workspace
   */
  async openWorkspace(path: string) {
    await this.page.evaluate((path) => {
      (window as any).workspace?.open(path);
    }, path);
    await this.waitForElement(this.fileTree);
  }

  /**
   * Create new file
   */
  async createFile(fileName: string): Promise<void> {
    await this.clickElement(this.newFileButton);
    const input = await this.waitForElement('[data-testid="file-name-input"]');
    await input.fill(fileName);
    await input.press('Enter');
    await this.page.waitForTimeout(100);
  }

  /**
   * Create new folder
   */
  async createFolder(folderName: string): Promise<void> {
    await this.clickElement(this.newFolderButton);
    const input = await this.waitForElement('[data-testid="folder-name-input"]');
    await input.fill(folderName);
    await input.press('Enter');
    await this.page.waitForTimeout(100);
  }

  /**
   * Check if file exists
   */
  async fileExists(fileName: string): Promise<boolean> {
    return await this.elementExists(`${this.fileItem}[data-name="${fileName}"]`);
  }

  /**
   * Check if folder exists
   */
  async folderExists(folderName: string): Promise<boolean> {
    return await this.elementExists(`${this.folderItem}[data-name="${folderName}"]`);
  }

  /**
   * Navigate to folder
   */
  async navigateToFolder(path: string) {
    const parts = path.split('/').filter(p => p);
    for (const part of parts) {
      if (part === '..') {
        await this.clickElement('[data-testid="parent-folder"]');
      } else {
        await this.doubleClick(`${this.folderItem}[data-name="${part}"]`);
      }
      await this.page.waitForTimeout(100);
    }
  }

  /**
   * Open file
   */
  async openFile(fileName: string) {
    await this.doubleClick(`${this.fileItem}[data-name="${fileName}"]`);
    await this.page.waitForTimeout(200);
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
   * Dismiss error
   */
  async dismissError() {
    const dismissButton = '[data-testid="dismiss-error"]';
    if (await this.elementExists(dismissButton)) {
      await this.clickElement(dismissButton);
    }
  }

  /**
   * Create file with template
   */
  async createFileWithTemplate(fileName: string, template: string) {
    await this.rightClick(this.fileTree);
    await this.clickElement('[data-testid="new-from-template"]');
    await this.selectOption('[data-testid="template-select"]', template);
    await this.fillInput('[data-testid="file-name-input"]', fileName);
    await this.clickElement('[data-testid="create-button"]');
  }

  /**
   * Delete file
   */
  async deleteFile(fileName: string) {
    await this.rightClick(`${this.fileItem}[data-name="${fileName}"]`);
    await this.clickElement('[data-testid="delete-file"]');
  }

  /**
   * Confirm delete
   */
  async confirmDelete() {
    await this.clickElement(this.confirmButton);
    await this.page.waitForTimeout(100);
  }

  /**
   * Select multiple files
   */
  async selectFiles(fileNames: string[]) {
    // Clear previous selection
    await this.clickElement(this.fileTree);
    
    for (const fileName of fileNames) {
      const fileSelector = `${this.fileItem}[data-name="${fileName}"]`;
      await this.page.locator(fileSelector).click({ modifiers: ['Control'] });
    }
  }

  /**
   * Delete selected files
   */
  async deleteSelected() {
    await this.pressKey('Delete');
  }

  /**
   * Open trash
   */
  async openTrash() {
    await this.clickElement('[data-testid="open-trash"]');
    await this.waitForElement(this.trashView);
  }

  /**
   * Check if file exists in trash
   */
  async fileExistsInTrash(fileName: string): Promise<boolean> {
    return await this.elementExists(`${this.trashView} ${this.fileItem}[data-name="${fileName}"]`);
  }

  /**
   * Restore from trash
   */
  async restoreFromTrash(fileName: string) {
    await this.rightClick(`${this.trashView} ${this.fileItem}[data-name="${fileName}"]`);
    await this.clickElement('[data-testid="restore-file"]');
  }

  /**
   * Close trash
   */
  async closeTrash() {
    await this.clickElement('[data-testid="close-trash"]');
  }

  /**
   * Check for warning dialog
   */
  async hasWarningDialog(): Promise<boolean> {
    return await this.elementExists(this.warningDialog);
  }

  /**
   * Get warning message
   */
  async getWarningMessage(): Promise<string> {
    return await this.getTextContent(`${this.warningDialog} [data-testid="warning-message"]`);
  }

  /**
   * Rename file
   */
  async renameFile(oldName: string, newName: string) {
    await this.rightClick(`${this.fileItem}[data-name="${oldName}"]`);
    await this.clickElement('[data-testid="rename-file"]');
    const input = await this.waitForElement('[data-testid="rename-input"]');
    await input.fill(newName);
    await input.press('Enter');
  }

  /**
   * Copy file
   */
  async copyFile(fileName: string) {
    await this.rightClick(`${this.fileItem}[data-name="${fileName}"]`);
    await this.clickElement('[data-testid="copy-file"]');
  }

  /**
   * Paste
   */
  async paste() {
    await this.rightClick(this.fileTree);
    await this.clickElement('[data-testid="paste"]');
  }

  /**
   * Move file
   */
  async moveFile(fileName: string, targetFolder: string) {
    await this.dragAndDrop(
      `${this.fileItem}[data-name="${fileName}"]`,
      `${this.folderItem}[data-name="${targetFolder}"]`
    );
  }

  /**
   * Duplicate file
   */
  async duplicateFile(fileName: string) {
    await this.rightClick(`${this.fileItem}[data-name="${fileName}"]`);
    await this.clickElement('[data-testid="duplicate-file"]');
  }

  /**
   * Search files
   */
  async searchFiles(query: string): Promise<string[]> {
    await this.fillInput(this.searchInput, query);
    await this.page.waitForTimeout(500); // Debounce
    
    const results = await this.getAllElements('[data-testid="search-result"]');
    const fileNames: string[] = [];
    
    for (const result of results) {
      const name = await result.getAttribute('data-file-path');
      if (name) fileNames.push(name);
    }
    
    return fileNames;
  }

  /**
   * Search in files
   */
  async searchInFiles(query: string): Promise<Array<{ file: string; matches: number }>> {
    await this.clickElement('[data-testid="search-in-files"]');
    await this.fillInput('[data-testid="search-content-input"]', query);
    await this.clickElement('[data-testid="search-button"]');
    
    await this.waitForElement('[data-testid="search-results"]');
    
    const results = await this.getAllElements('[data-testid="file-match"]');
    const matches: Array<{ file: string; matches: number }> = [];
    
    for (const result of results) {
      const file = await result.getAttribute('data-file') || '';
      const matchCount = await result.getAttribute('data-matches');
      matches.push({ file, matches: parseInt(matchCount || '0') });
    }
    
    return matches;
  }

  /**
   * Refresh file tree
   */
  async refresh() {
    await this.clickElement('[data-testid="refresh-tree"]');
    await this.page.waitForTimeout(100);
  }

  /**
   * Get file count
   */
  async getFileCount(): Promise<number> {
    const files = await this.getAllElements(this.fileItem);
    return files.length;
  }

  /**
   * Collapse all folders
   */
  async collapseAll() {
    await this.clickElement('[data-testid="collapse-all"]');
  }

  /**
   * Expand all folders
   */
  async expandAll() {
    await this.clickElement('[data-testid="expand-all"]');
  }

  /**
   * Get file size
   */
  async getFileSize(fileName: string): Promise<string> {
    const fileElement = await this.waitForElement(`${this.fileItem}[data-name="${fileName}"]`);
    await this.hover(`${this.fileItem}[data-name="${fileName}"]`);
    const tooltip = await this.waitForElement('[data-testid="file-tooltip"]');
    const sizeText = await tooltip.locator('[data-testid="file-size"]').textContent();
    return sizeText || '';
  }

  /**
   * Sort files
   */
  async sortBy(criteria: 'name' | 'size' | 'modified') {
    await this.clickElement('[data-testid="sort-button"]');
    await this.clickElement(`[data-testid="sort-${criteria}"]`);
  }

  /**
   * Filter files
   */
  async filterByType(type: string) {
    await this.clickElement('[data-testid="filter-button"]');
    await this.clickElement(`[data-testid="filter-${type}"]`);
  }
}