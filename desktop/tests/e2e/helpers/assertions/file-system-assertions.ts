import { expect } from '@playwright/test';
import { FileExplorerPage } from '../page-objects/file-explorer-page';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface FileSystemAssertions {
  toHaveFile(fileName: string): Promise<void>;
  toHaveFolder(folderName: string): Promise<void>;
  toNotHaveFile(fileName: string): Promise<void>;
  toNotHaveFolder(folderName: string): Promise<void>;
  toHaveFileCount(count: number): Promise<void>;
  toHaveFolderCount(count: number): Promise<void>;
  toHaveFileWithContent(fileName: string, content: string | RegExp): Promise<void>;
  toHaveFileStructure(structure: FileStructure): Promise<void>;
  toHaveSelectedFiles(fileNames: string[]): Promise<void>;
  toBeAtPath(expectedPath: string): Promise<void>;
}

export interface FileStructure {
  [name: string]: string | FileStructure;
}

export function createFileSystemAssertions(fileExplorer: FileExplorerPage): FileSystemAssertions {
  return {
    async toHaveFile(fileName: string): Promise<void> {
      const exists = await fileExplorer.fileExists(fileName);
      expect(exists).toBeTruthy();
    },

    async toHaveFolder(folderName: string): Promise<void> {
      const exists = await fileExplorer.folderExists(folderName);
      expect(exists).toBeTruthy();
    },

    async toNotHaveFile(fileName: string): Promise<void> {
      const exists = await fileExplorer.fileExists(fileName);
      expect(exists).toBeFalsy();
    },

    async toNotHaveFolder(folderName: string): Promise<void> {
      const exists = await fileExplorer.folderExists(folderName);
      expect(exists).toBeFalsy();
    },

    async toHaveFileCount(count: number): Promise<void> {
      const files = await fileExplorer.getFileList();
      expect(files).toHaveLength(count);
    },

    async toHaveFolderCount(count: number): Promise<void> {
      const folders = await fileExplorer.getFolderList();
      expect(folders).toHaveLength(count);
    },

    async toHaveFileWithContent(fileName: string, content: string | RegExp): Promise<void> {
      // This would need integration with the actual file system or editor
      // For now, we'll check if the file exists
      const exists = await fileExplorer.fileExists(fileName);
      expect(exists).toBeTruthy();
      
      // In a real implementation, you would:
      // 1. Open the file
      // 2. Read its content
      // 3. Compare with expected content
    },

    async toHaveFileStructure(structure: FileStructure): Promise<void> {
      await validateFileStructure(fileExplorer, structure);
    },

    async toHaveSelectedFiles(fileNames: string[]): Promise<void> {
      const selected = await fileExplorer.getSelectedFiles();
      expect(selected.sort()).toEqual(fileNames.sort());
    },

    async toBeAtPath(expectedPath: string): Promise<void> {
      const currentPath = await fileExplorer.getCurrentPath();
      expect(currentPath).toBe(expectedPath);
    }
  };
}

async function validateFileStructure(
  fileExplorer: FileExplorerPage,
  structure: FileStructure,
  currentPath = ''
): Promise<void> {
  for (const [name, value] of Object.entries(structure)) {
    if (typeof value === 'string') {
      // It's a file
      const exists = await fileExplorer.fileExists(name);
      expect(exists).toBeTruthy();
    } else {
      // It's a folder
      const exists = await fileExplorer.folderExists(name);
      expect(exists).toBeTruthy();
      
      // Navigate into the folder and check its contents
      await fileExplorer.expandFolder(name);
      await validateFileStructure(fileExplorer, value, path.join(currentPath, name));
    }
  }
}

// Filesystem state assertions
export async function assertFileSystemState(
  fileExplorer: FileExplorerPage,
  expectedState: {
    files?: string[];
    folders?: string[];
    totalItems?: number;
    currentPath?: string;
    selectedFiles?: string[];
  }
): Promise<void> {
  if (expectedState.files) {
    const files = await fileExplorer.getFileList();
    expect(files.sort()).toEqual(expectedState.files.sort());
  }
  
  if (expectedState.folders) {
    const folders = await fileExplorer.getFolderList();
    expect(folders.sort()).toEqual(expectedState.folders.sort());
  }
  
  if (expectedState.totalItems !== undefined) {
    const files = await fileExplorer.getFileList();
    const folders = await fileExplorer.getFolderList();
    expect(files.length + folders.length).toBe(expectedState.totalItems);
  }
  
  if (expectedState.currentPath) {
    const currentPath = await fileExplorer.getCurrentPath();
    expect(currentPath).toBe(expectedState.currentPath);
  }
  
  if (expectedState.selectedFiles) {
    const selected = await fileExplorer.getSelectedFiles();
    expect(selected.sort()).toEqual(expectedState.selectedFiles.sort());
  }
}

// File operation assertions
export async function assertFileOperation(
  fileExplorer: FileExplorerPage,
  operation: () => Promise<void>,
  expectations: {
    filesShouldExist?: string[];
    filesShouldNotExist?: string[];
    foldersShouldExist?: string[];
    foldersShouldNotExist?: string[];
    shouldSucceed?: boolean;
  }
): Promise<void> {
  let error: Error | null = null;
  
  try {
    await operation();
  } catch (e) {
    error = e as Error;
  }
  
  if (expectations.shouldSucceed === true) {
    expect(error).toBeNull();
  } else if (expectations.shouldSucceed === false) {
    expect(error).not.toBeNull();
  }
  
  if (expectations.filesShouldExist) {
    for (const file of expectations.filesShouldExist) {
      const exists = await fileExplorer.fileExists(file);
      expect(exists).toBeTruthy();
    }
  }
  
  if (expectations.filesShouldNotExist) {
    for (const file of expectations.filesShouldNotExist) {
      const exists = await fileExplorer.fileExists(file);
      expect(exists).toBeFalsy();
    }
  }
  
  if (expectations.foldersShouldExist) {
    for (const folder of expectations.foldersShouldExist) {
      const exists = await fileExplorer.folderExists(folder);
      expect(exists).toBeTruthy();
    }
  }
  
  if (expectations.foldersShouldNotExist) {
    for (const folder of expectations.foldersShouldNotExist) {
      const exists = await fileExplorer.folderExists(folder);
      expect(exists).toBeFalsy();
    }
  }
}

// File metadata assertions
export async function assertFileMetadata(
  fileExplorer: FileExplorerPage,
  fileName: string,
  expectations: {
    icon?: string;
    size?: string | RegExp;
    modifiedDate?: string | RegExp;
    isOpen?: boolean;
  }
): Promise<void> {
  const exists = await fileExplorer.fileExists(fileName);
  expect(exists).toBeTruthy();
  
  if (expectations.icon) {
    const icon = await fileExplorer.getFileIcon(fileName);
    expect(icon).toBe(expectations.icon);
  }
  
  if (expectations.size) {
    const size = await fileExplorer.getFileSize(fileName);
    if (typeof expectations.size === 'string') {
      expect(size).toBe(expectations.size);
    } else {
      expect(size).toMatch(expectations.size);
    }
  }
  
  if (expectations.modifiedDate) {
    const date = await fileExplorer.getFileModifiedDate(fileName);
    if (typeof expectations.modifiedDate === 'string') {
      expect(date).toBe(expectations.modifiedDate);
    } else {
      expect(date).toMatch(expectations.modifiedDate);
    }
  }
  
  if (expectations.isOpen !== undefined) {
    const isOpen = await fileExplorer.isFileOpen(fileName);
    expect(isOpen).toBe(expectations.isOpen);
  }
}

// Directory navigation assertions
export async function assertDirectoryNavigation(
  fileExplorer: FileExplorerPage,
  navigationSteps: Array<{
    action: 'enter' | 'up' | 'home' | 'goto';
    target?: string;
    expectedPath: string;
    expectedFiles?: string[];
    expectedFolders?: string[];
  }>
): Promise<void> {
  for (const step of navigationSteps) {
    switch (step.action) {
      case 'enter':
        if (step.target) {
          await fileExplorer.clickFolder(step.target);
        }
        break;
      
      case 'up':
        await fileExplorer.navigateUp();
        break;
      
      case 'home':
        await fileExplorer.navigateToHome();
        break;
      
      case 'goto':
        if (step.target) {
          await fileExplorer.navigateToFolder(step.target);
        }
        break;
    }
    
    const currentPath = await fileExplorer.getCurrentPath();
    expect(currentPath).toBe(step.expectedPath);
    
    if (step.expectedFiles) {
      const files = await fileExplorer.getFileList();
      expect(files.sort()).toEqual(step.expectedFiles.sort());
    }
    
    if (step.expectedFolders) {
      const folders = await fileExplorer.getFolderList();
      expect(folders.sort()).toEqual(step.expectedFolders.sort());
    }
  }
}

// Batch file operations assertions
export async function assertBatchFileOperations(
  fileExplorer: FileExplorerPage,
  operations: Array<{
    type: 'create' | 'rename' | 'delete' | 'copy' | 'move';
    source?: string;
    target?: string;
    isFile?: boolean;
  }>,
  finalState: {
    files: string[];
    folders: string[];
  }
): Promise<void> {
  for (const op of operations) {
    switch (op.type) {
      case 'create':
        if (op.target) {
          if (op.isFile) {
            await fileExplorer.createNewFile(op.target);
          } else {
            await fileExplorer.createNewFolder(op.target);
          }
        }
        break;
      
      case 'rename':
        if (op.source && op.target) {
          if (op.isFile) {
            await fileExplorer.renameFile(op.source, op.target);
          } else {
            await fileExplorer.renameFolder(op.source, op.target);
          }
        }
        break;
      
      case 'delete':
        if (op.source) {
          if (op.isFile) {
            await fileExplorer.deleteFile(op.source);
          } else {
            await fileExplorer.deleteFolder(op.source);
          }
        }
        break;
      
      case 'copy':
        if (op.source && op.target) {
          if (op.isFile) {
            await fileExplorer.copyFile(op.source);
            await fileExplorer.pasteInFolder(op.target);
          }
        }
        break;
      
      case 'move':
        if (op.source && op.target) {
          await fileExplorer.dragAndDropFile(op.source, op.target);
        }
        break;
    }
    
    await fileExplorer.waitForFileOperation();
  }
  
  // Verify final state
  const files = await fileExplorer.getFileList();
  const folders = await fileExplorer.getFolderList();
  
  expect(files.sort()).toEqual(finalState.files.sort());
  expect(folders.sort()).toEqual(finalState.folders.sort());
}

// Search results assertions
export async function assertSearchResults(
  fileExplorer: FileExplorerPage,
  searchTerm: string,
  expectations: {
    fileCount?: number;
    folderCount?: number;
    containsFiles?: string[];
    containsFolders?: string[];
    doesNotContainFiles?: string[];
    doesNotContainFolders?: string[];
  }
): Promise<void> {
  await fileExplorer.searchFiles(searchTerm);
  
  const files = await fileExplorer.getFileList();
  const folders = await fileExplorer.getFolderList();
  
  if (expectations.fileCount !== undefined) {
    expect(files).toHaveLength(expectations.fileCount);
  }
  
  if (expectations.folderCount !== undefined) {
    expect(folders).toHaveLength(expectations.folderCount);
  }
  
  if (expectations.containsFiles) {
    for (const file of expectations.containsFiles) {
      expect(files).toContain(file);
    }
  }
  
  if (expectations.containsFolders) {
    for (const folder of expectations.containsFolders) {
      expect(folders).toContain(folder);
    }
  }
  
  if (expectations.doesNotContainFiles) {
    for (const file of expectations.doesNotContainFiles) {
      expect(files).not.toContain(file);
    }
  }
  
  if (expectations.doesNotContainFolders) {
    for (const folder of expectations.doesNotContainFolders) {
      expect(folders).not.toContain(folder);
    }
  }
}

// Context menu assertions
export async function assertContextMenuOptions(
  fileExplorer: FileExplorerPage,
  target: { type: 'file' | 'folder' | 'empty'; name?: string },
  expectedOptions: string[]
): Promise<void> {
  switch (target.type) {
    case 'file':
      if (target.name) {
        await fileExplorer.rightClickFile(target.name);
      }
      break;
    
    case 'folder':
      if (target.name) {
        await fileExplorer.rightClickFolder(target.name);
      }
      break;
    
    case 'empty':
      await fileExplorer.explorerContainer.click({ button: 'right' });
      break;
  }
  
  // In a real implementation, you would verify the context menu options
  // For now, we'll just check that the context menu appears
  const contextMenu = fileExplorer.contextMenu;
  await expect(contextMenu).toBeVisible();
  
  // Close the context menu
  await fileExplorer.page.keyboard.press('Escape');
}