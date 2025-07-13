import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import * as path from 'path';

export class FileExplorerPage {
  private page: Page;
  private explorerContainer: Locator;
  private fileTree: Locator;
  private fileItems: Locator;
  private folderItems: Locator;
  private contextMenu: Locator;
  private searchInput: Locator;
  private breadcrumb: Locator;

  constructor(page: Page) {
    this.page = page;
    this.explorerContainer = page.locator('[data-testid="file-explorer"]');
    this.fileTree = page.locator('[data-testid="file-tree"]');
    this.fileItems = page.locator('[data-testid^="file-item-"]');
    this.folderItems = page.locator('[data-testid^="folder-item-"]');
    this.contextMenu = page.locator('[data-testid="context-menu"]');
    this.searchInput = page.locator('[data-testid="file-search-input"]');
    this.breadcrumb = page.locator('[data-testid="breadcrumb"]');
  }

  async waitForReady(): Promise<void> {
    await this.explorerContainer.waitFor({ state: 'visible' });
    await this.fileTree.waitFor({ state: 'visible' });
  }

  async navigateToFolder(folderPath: string): Promise<void> {
    const segments = folderPath.split('/').filter(s => s);
    
    for (const segment of segments) {
      await this.clickFolder(segment);
      await this.page.waitForTimeout(100);
    }
  }

  async clickFile(fileName: string): Promise<void> {
    const fileItem = this.fileItems.filter({ hasText: fileName }).first();
    await fileItem.click();
  }

  async doubleClickFile(fileName: string): Promise<void> {
    const fileItem = this.fileItems.filter({ hasText: fileName }).first();
    await fileItem.dblclick();
  }

  async clickFolder(folderName: string): Promise<void> {
    const folderItem = this.folderItems.filter({ hasText: folderName }).first();
    await folderItem.click();
  }

  async expandFolder(folderName: string): Promise<void> {
    const folderItem = this.folderItems.filter({ hasText: folderName }).first();
    const expandIcon = folderItem.locator('[data-testid="expand-icon"]');
    
    const isExpanded = await expandIcon.getAttribute('data-expanded') === 'true';
    if (!isExpanded) {
      await expandIcon.click();
      await this.page.waitForTimeout(100);
    }
  }

  async collapseFolder(folderName: string): Promise<void> {
    const folderItem = this.folderItems.filter({ hasText: folderName }).first();
    const expandIcon = folderItem.locator('[data-testid="expand-icon"]');
    
    const isExpanded = await expandIcon.getAttribute('data-expanded') === 'true';
    if (isExpanded) {
      await expandIcon.click();
      await this.page.waitForTimeout(100);
    }
  }

  async rightClickFile(fileName: string): Promise<void> {
    const fileItem = this.fileItems.filter({ hasText: fileName }).first();
    await fileItem.click({ button: 'right' });
    await this.contextMenu.waitFor({ state: 'visible' });
  }

  async rightClickFolder(folderName: string): Promise<void> {
    const folderItem = this.folderItems.filter({ hasText: folderName }).first();
    await folderItem.click({ button: 'right' });
    await this.contextMenu.waitFor({ state: 'visible' });
  }

  async selectContextMenuItem(itemText: string): Promise<void> {
    const menuItem = this.contextMenu.locator(`[data-testid="menu-item-${itemText.toLowerCase().replace(/\s+/g, '-')}"]`);
    await menuItem.click();
    await this.contextMenu.waitFor({ state: 'hidden' });
  }

  async createNewFile(fileName: string, inFolder?: string): Promise<void> {
    if (inFolder) {
      await this.rightClickFolder(inFolder);
    } else {
      await this.explorerContainer.click({ button: 'right' });
    }
    
    await this.selectContextMenuItem('New File');
    
    const nameInput = this.page.locator('[data-testid="name-input"]');
    await nameInput.waitFor({ state: 'visible' });
    await nameInput.fill(fileName);
    await nameInput.press('Enter');
    
    await this.page.waitForTimeout(100);
  }

  async createNewFolder(folderName: string, inFolder?: string): Promise<void> {
    if (inFolder) {
      await this.rightClickFolder(inFolder);
    } else {
      await this.explorerContainer.click({ button: 'right' });
    }
    
    await this.selectContextMenuItem('New Folder');
    
    const nameInput = this.page.locator('[data-testid="name-input"]');
    await nameInput.waitFor({ state: 'visible' });
    await nameInput.fill(folderName);
    await nameInput.press('Enter');
    
    await this.page.waitForTimeout(100);
  }

  async renameFile(oldName: string, newName: string): Promise<void> {
    await this.rightClickFile(oldName);
    await this.selectContextMenuItem('Rename');
    
    const nameInput = this.page.locator('[data-testid="name-input"]');
    await nameInput.waitFor({ state: 'visible' });
    await nameInput.fill(newName);
    await nameInput.press('Enter');
    
    await this.page.waitForTimeout(100);
  }

  async renameFolder(oldName: string, newName: string): Promise<void> {
    await this.rightClickFolder(oldName);
    await this.selectContextMenuItem('Rename');
    
    const nameInput = this.page.locator('[data-testid="name-input"]');
    await nameInput.waitFor({ state: 'visible' });
    await nameInput.fill(newName);
    await nameInput.press('Enter');
    
    await this.page.waitForTimeout(100);
  }

  async deleteFile(fileName: string, confirm = true): Promise<void> {
    await this.rightClickFile(fileName);
    await this.selectContextMenuItem('Delete');
    
    if (confirm) {
      const confirmButton = this.page.locator('[data-testid="confirm-delete"]');
      await confirmButton.click();
    } else {
      const cancelButton = this.page.locator('[data-testid="cancel-delete"]');
      await cancelButton.click();
    }
    
    await this.page.waitForTimeout(100);
  }

  async deleteFolder(folderName: string, confirm = true): Promise<void> {
    await this.rightClickFolder(folderName);
    await this.selectContextMenuItem('Delete');
    
    if (confirm) {
      const confirmButton = this.page.locator('[data-testid="confirm-delete"]');
      await confirmButton.click();
    } else {
      const cancelButton = this.page.locator('[data-testid="cancel-delete"]');
      await cancelButton.click();
    }
    
    await this.page.waitForTimeout(100);
  }

  async copyFile(fileName: string): Promise<void> {
    await this.rightClickFile(fileName);
    await this.selectContextMenuItem('Copy');
  }

  async cutFile(fileName: string): Promise<void> {
    await this.rightClickFile(fileName);
    await this.selectContextMenuItem('Cut');
  }

  async pasteInFolder(folderName?: string): Promise<void> {
    if (folderName) {
      await this.rightClickFolder(folderName);
    } else {
      await this.explorerContainer.click({ button: 'right' });
    }
    
    await this.selectContextMenuItem('Paste');
    await this.page.waitForTimeout(100);
  }

  async searchFiles(searchTerm: string): Promise<void> {
    await this.searchInput.click();
    await this.searchInput.fill(searchTerm);
    await this.searchInput.press('Enter');
    await this.page.waitForTimeout(200);
  }

  async clearSearch(): Promise<void> {
    await this.searchInput.clear();
    await this.searchInput.press('Escape');
  }

  async getFileList(): Promise<string[]> {
    const files = await this.fileItems.all();
    const fileNames: string[] = [];
    
    for (const file of files) {
      const name = await file.textContent();
      if (name) fileNames.push(name.trim());
    }
    
    return fileNames;
  }

  async getFolderList(): Promise<string[]> {
    const folders = await this.folderItems.all();
    const folderNames: string[] = [];
    
    for (const folder of folders) {
      const name = await folder.textContent();
      if (name) folderNames.push(name.trim());
    }
    
    return folderNames;
  }

  async fileExists(fileName: string): Promise<boolean> {
    const files = await this.getFileList();
    return files.includes(fileName);
  }

  async folderExists(folderName: string): Promise<boolean> {
    const folders = await this.getFolderList();
    return folders.includes(folderName);
  }

  async selectMultipleFiles(fileNames: string[]): Promise<void> {
    for (let i = 0; i < fileNames.length; i++) {
      const file = this.fileItems.filter({ hasText: fileNames[i] }).first();
      
      if (i === 0) {
        await file.click();
      } else {
        await file.click({ modifiers: ['Control'] });
      }
    }
  }

  async dragAndDropFile(fileName: string, targetFolder: string): Promise<void> {
    const fileItem = this.fileItems.filter({ hasText: fileName }).first();
    const folderItem = this.folderItems.filter({ hasText: targetFolder }).first();
    
    await fileItem.dragTo(folderItem);
    await this.page.waitForTimeout(100);
  }

  async getCurrentPath(): Promise<string> {
    const breadcrumbItems = await this.breadcrumb.locator('[data-testid="breadcrumb-item"]').all();
    const pathSegments: string[] = [];
    
    for (const item of breadcrumbItems) {
      const text = await item.textContent();
      if (text) pathSegments.push(text.trim());
    }
    
    return pathSegments.join('/');
  }

  async navigateUp(): Promise<void> {
    const upButton = this.page.locator('[data-testid="navigate-up"]');
    await upButton.click();
    await this.page.waitForTimeout(100);
  }

  async navigateToHome(): Promise<void> {
    const homeButton = this.page.locator('[data-testid="navigate-home"]');
    await homeButton.click();
    await this.page.waitForTimeout(100);
  }

  async refreshExplorer(): Promise<void> {
    const refreshButton = this.page.locator('[data-testid="refresh-explorer"]');
    await refreshButton.click();
    await this.page.waitForTimeout(200);
  }

  async getFileIcon(fileName: string): Promise<string> {
    const fileItem = this.fileItems.filter({ hasText: fileName }).first();
    const icon = fileItem.locator('[data-testid="file-icon"]');
    return await icon.getAttribute('data-icon-type') || '';
  }

  async getFileSize(fileName: string): Promise<string> {
    const fileItem = this.fileItems.filter({ hasText: fileName }).first();
    const size = fileItem.locator('[data-testid="file-size"]');
    return await size.textContent() || '';
  }

  async getFileModifiedDate(fileName: string): Promise<string> {
    const fileItem = this.fileItems.filter({ hasText: fileName }).first();
    const date = fileItem.locator('[data-testid="file-modified"]');
    return await date.textContent() || '';
  }

  async sortBy(sortType: 'name' | 'size' | 'date'): Promise<void> {
    const sortButton = this.page.locator(`[data-testid="sort-by-${sortType}"]`);
    await sortButton.click();
    await this.page.waitForTimeout(100);
  }

  async toggleViewMode(mode: 'list' | 'grid' | 'tree'): Promise<void> {
    const viewButton = this.page.locator(`[data-testid="view-mode-${mode}"]`);
    await viewButton.click();
    await this.page.waitForTimeout(100);
  }

  async toggleHiddenFiles(): Promise<void> {
    const toggleButton = this.page.locator('[data-testid="toggle-hidden-files"]');
    await toggleButton.click();
    await this.page.waitForTimeout(100);
  }

  async getSelectedFiles(): Promise<string[]> {
    const selectedItems = this.fileItems.filter({ has: this.page.locator('[data-selected="true"]') });
    const files = await selectedItems.all();
    const fileNames: string[] = [];
    
    for (const file of files) {
      const name = await file.textContent();
      if (name) fileNames.push(name.trim());
    }
    
    return fileNames;
  }

  async openFileProperties(fileName: string): Promise<void> {
    await this.rightClickFile(fileName);
    await this.selectContextMenuItem('Properties');
    
    const propertiesDialog = this.page.locator('[data-testid="properties-dialog"]');
    await propertiesDialog.waitFor({ state: 'visible' });
  }

  async waitForFileOperation(timeout = 5000): Promise<void> {
    const spinner = this.page.locator('[data-testid="operation-spinner"]');
    
    try {
      await spinner.waitFor({ state: 'visible', timeout: 1000 });
      await spinner.waitFor({ state: 'hidden', timeout });
    } catch {
      // No operation in progress
    }
  }

  async isFileOpen(fileName: string): Promise<boolean> {
    const fileItem = this.fileItems.filter({ hasText: fileName }).first();
    const openIndicator = fileItem.locator('[data-testid="open-indicator"]');
    return await openIndicator.isVisible();
  }

  async closeAllOpenFiles(): Promise<void> {
    const closeAllButton = this.page.locator('[data-testid="close-all-files"]');
    if (await closeAllButton.isVisible()) {
      await closeAllButton.click();
      await this.page.waitForTimeout(100);
    }
  }
}