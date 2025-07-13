/**
 * File Operations E2E Tests
 * Tests file creation, editing, saving, and deletion
 */

import { TestContext } from '../helpers/test-context';
import { FileExplorerPage } from '../helpers/page-objects/FileExplorerPage';
import { EditorPage } from '../helpers/page-objects/EditorPage';
import * as path from 'path';
import * as fs from 'fs/promises';

describe('File Operations Flow', () => {
  let testContext: TestContext;
  let fileExplorer: FileExplorerPage;
  let editor: EditorPage;
  let testWorkspace: string;

  beforeEach(async () => {
    testContext = new TestContext({
      headless: process.env.CI === 'true',
      trace: true
    });
    await testContext.setup();
    
    const { page, baseUrl } = await testContext.createPage();
    fileExplorer = new FileExplorerPage(page);
    editor = new EditorPage(page);
    
    // Create test workspace
    testWorkspace = path.join(testContext.getDataDir() || '', 'test-workspace');
    await fs.mkdir(testWorkspace, { recursive: true });
    
    await page.goto(baseUrl);
    await fileExplorer.openWorkspace(testWorkspace);
  });

  afterEach(async () => {
    await testContext.captureState('file-operations');
    // Clean up test workspace
    if (testWorkspace) {
      await fs.rm(testWorkspace, { recursive: true, force: true }).catch(() => {});
    }
    await testContext.teardown();
  });

  describe('File Creation', () => {
    test('should create a new file', async () => {
      // Act
      const fileName = 'test-file.js';
      await fileExplorer.createFile(fileName);

      // Assert
      expect(await fileExplorer.fileExists(fileName)).toBe(true);
      expect(await editor.isFileOpen(fileName)).toBe(true);
      expect(await editor.getContent()).toBe('');
    });

    test('should create nested files', async () => {
      // Arrange
      await fileExplorer.createFolder('src');
      await fileExplorer.createFolder('src/components');

      // Act
      await fileExplorer.navigateToFolder('src/components');
      await fileExplorer.createFile('Button.tsx');

      // Assert
      expect(await fileExplorer.fileExists('Button.tsx')).toBe(true);
      const fullPath = await editor.getCurrentFilePath();
      expect(fullPath).toContain('src/components/Button.tsx');
    });

    test('should handle duplicate file names', async () => {
      // Arrange
      await fileExplorer.createFile('duplicate.js');

      // Act
      await fileExplorer.createFile('duplicate.js');

      // Assert
      const error = await fileExplorer.getErrorMessage();
      expect(error).toContain('already exists');
    });

    test('should create files with templates', async () => {
      // Act
      await fileExplorer.createFileWithTemplate('Component.tsx', 'react-component');

      // Assert
      expect(await editor.isFileOpen('Component.tsx')).toBe(true);
      const content = await editor.getContent();
      expect(content).toContain('import React');
      expect(content).toContain('export default');
    });

    test('should validate file names', async () => {
      // Test invalid file names
      const invalidNames = [
        'file/with/slash.js',
        'file:with:colon.js',
        'file|with|pipe.js',
        'file<with>brackets.js',
        '..',
        '.'
      ];

      for (const name of invalidNames) {
        await fileExplorer.createFile(name);
        const error = await fileExplorer.getErrorMessage();
        expect(error).toContain('Invalid file name');
        await fileExplorer.dismissError();
      }
    });
  });

  describe('File Editing', () => {
    beforeEach(async () => {
      await fileExplorer.createFile('edit-test.js');
    });

    test('should edit and save file content', async () => {
      // Arrange
      const content = `
function helloWorld() {
  console.log("Hello, World!");
}

helloWorld();
      `.trim();

      // Act
      await editor.setContent(content);
      await editor.save();

      // Assert
      expect(await editor.isDirty()).toBe(false);
      const savedContent = await fs.readFile(
        path.join(testWorkspace, 'edit-test.js'), 
        'utf-8'
      );
      expect(savedContent).toBe(content);
    });

    test('should show dirty indicator for unsaved changes', async () => {
      // Act
      await editor.typeText('const x = 42;');

      // Assert
      expect(await editor.isDirty()).toBe(true);
      expect(await editor.hasUnsavedIndicator()).toBe(true);
    });

    test('should support undo/redo', async () => {
      // Arrange
      const originalContent = 'original';
      const newContent = 'modified';

      // Act
      await editor.setContent(originalContent);
      await editor.setContent(newContent);
      await editor.undo();

      // Assert
      expect(await editor.getContent()).toBe(originalContent);

      // Redo
      await editor.redo();
      expect(await editor.getContent()).toBe(newContent);
    });

    test('should auto-save changes', async () => {
      // Enable auto-save
      await editor.enableAutoSave();

      // Act
      await editor.typeText('auto-saved content');
      await editor.page.waitForTimeout(2000); // Wait for auto-save

      // Assert
      const savedContent = await fs.readFile(
        path.join(testWorkspace, 'edit-test.js'), 
        'utf-8'
      );
      expect(savedContent).toContain('auto-saved content');
    });

    test('should handle concurrent edits', async () => {
      // Open file in second tab
      const { page: page2 } = await testContext.createPage();
      const editor2 = new EditorPage(page2);
      await page2.goto(testContext.baseUrl);
      await new FileExplorerPage(page2).openFile('edit-test.js');

      // Act - Edit in both tabs
      await editor.typeText('Edit from tab 1\n');
      await editor2.typeText('Edit from tab 2\n');

      // Save both
      await editor.save();
      await editor2.save();

      // Assert - Should handle conflict
      const hasConflict = await editor2.hasConflictIndicator();
      expect(hasConflict).toBe(true);
    });
  });

  describe('File Saving', () => {
    test('should save with keyboard shortcut', async () => {
      // Arrange
      await fileExplorer.createFile('shortcut-test.js');
      await editor.typeText('saved with shortcut');

      // Act
      await editor.page.keyboard.press('Control+S');

      // Assert
      expect(await editor.isDirty()).toBe(false);
      const content = await fs.readFile(
        path.join(testWorkspace, 'shortcut-test.js'), 
        'utf-8'
      );
      expect(content).toBe('saved with shortcut');
    });

    test('should save as new file', async () => {
      // Arrange
      await fileExplorer.createFile('original.js');
      await editor.typeText('content to copy');

      // Act
      await editor.saveAs('copy.js');

      // Assert
      expect(await editor.getCurrentFileName()).toBe('copy.js');
      expect(await fileExplorer.fileExists('original.js')).toBe(true);
      expect(await fileExplorer.fileExists('copy.js')).toBe(true);
    });

    test('should handle save errors gracefully', async () => {
      // Arrange
      await fileExplorer.createFile('readonly.js');
      
      // Make file read-only
      await fs.chmod(path.join(testWorkspace, 'readonly.js'), 0o444);

      // Act
      await editor.typeText('cannot save this');
      await editor.save();

      // Assert
      const error = await editor.getErrorMessage();
      expect(error).toContain('Permission denied');
      expect(await editor.isDirty()).toBe(true);
    });

    test('should create backup before saving', async () => {
      // Arrange
      await fileExplorer.createFile('backup-test.js');
      await editor.setContent('original content');
      await editor.save();

      // Act
      await editor.setContent('new content');
      await editor.save();

      // Assert
      const backupExists = await fileExplorer.fileExists('.backup-test.js~');
      expect(backupExists).toBe(true);
    });
  });

  describe('File Deletion', () => {
    test('should delete single file', async () => {
      // Arrange
      await fileExplorer.createFile('to-delete.js');

      // Act
      await fileExplorer.deleteFile('to-delete.js');
      await fileExplorer.confirmDelete();

      // Assert
      expect(await fileExplorer.fileExists('to-delete.js')).toBe(false);
      expect(await editor.isFileOpen('to-delete.js')).toBe(false);
    });

    test('should delete multiple files', async () => {
      // Arrange
      await fileExplorer.createFile('file1.js');
      await fileExplorer.createFile('file2.js');
      await fileExplorer.createFile('file3.js');

      // Act
      await fileExplorer.selectFiles(['file1.js', 'file2.js', 'file3.js']);
      await fileExplorer.deleteSelected();
      await fileExplorer.confirmDelete();

      // Assert
      expect(await fileExplorer.fileExists('file1.js')).toBe(false);
      expect(await fileExplorer.fileExists('file2.js')).toBe(false);
      expect(await fileExplorer.fileExists('file3.js')).toBe(false);
    });

    test('should move files to trash', async () => {
      // Arrange
      await fileExplorer.createFile('trash-test.js');
      await editor.setContent('important content');
      await editor.save();

      // Act
      await fileExplorer.deleteFile('trash-test.js');
      await fileExplorer.confirmDelete();

      // Assert
      expect(await fileExplorer.fileExists('trash-test.js')).toBe(false);
      
      // Check trash
      await fileExplorer.openTrash();
      expect(await fileExplorer.fileExistsInTrash('trash-test.js')).toBe(true);
    });

    test('should restore from trash', async () => {
      // Arrange
      await fileExplorer.createFile('restore-test.js');
      await fileExplorer.deleteFile('restore-test.js');
      await fileExplorer.confirmDelete();

      // Act
      await fileExplorer.openTrash();
      await fileExplorer.restoreFromTrash('restore-test.js');

      // Assert
      await fileExplorer.closeTrash();
      expect(await fileExplorer.fileExists('restore-test.js')).toBe(true);
    });

    test('should handle deletion of open files', async () => {
      // Arrange
      await fileExplorer.createFile('open-file.js');
      await editor.typeText('unsaved changes');

      // Act
      await fileExplorer.deleteFile('open-file.js');

      // Assert
      expect(await fileExplorer.hasWarningDialog()).toBe(true);
      const warning = await fileExplorer.getWarningMessage();
      expect(warning).toContain('unsaved changes');
    });
  });

  describe('File Operations', () => {
    test('should rename file', async () => {
      // Arrange
      await fileExplorer.createFile('old-name.js');

      // Act
      await fileExplorer.renameFile('old-name.js', 'new-name.js');

      // Assert
      expect(await fileExplorer.fileExists('old-name.js')).toBe(false);
      expect(await fileExplorer.fileExists('new-name.js')).toBe(true);
      expect(await editor.getCurrentFileName()).toBe('new-name.js');
    });

    test('should copy and paste files', async () => {
      // Arrange
      await fileExplorer.createFile('source.js');
      await editor.setContent('content to copy');
      await editor.save();

      // Act
      await fileExplorer.copyFile('source.js');
      await fileExplorer.createFolder('destination');
      await fileExplorer.navigateToFolder('destination');
      await fileExplorer.paste();

      // Assert
      expect(await fileExplorer.fileExists('source.js')).toBe(true);
      await fileExplorer.navigateToFolder('..');
      expect(await fileExplorer.fileExists('source.js')).toBe(true);
    });

    test('should move files', async () => {
      // Arrange
      await fileExplorer.createFile('to-move.js');
      await fileExplorer.createFolder('target');

      // Act
      await fileExplorer.moveFile('to-move.js', 'target');

      // Assert
      expect(await fileExplorer.fileExists('to-move.js')).toBe(false);
      await fileExplorer.navigateToFolder('target');
      expect(await fileExplorer.fileExists('to-move.js')).toBe(true);
    });

    test('should duplicate file', async () => {
      // Arrange
      await fileExplorer.createFile('original.js');
      await editor.setContent('duplicate me');
      await editor.save();

      // Act
      await fileExplorer.duplicateFile('original.js');

      // Assert
      expect(await fileExplorer.fileExists('original.js')).toBe(true);
      expect(await fileExplorer.fileExists('original (copy).js')).toBe(true);
    });
  });

  describe('File Search', () => {
    beforeEach(async () => {
      // Create test file structure
      await fileExplorer.createFolder('src');
      await fileExplorer.createFile('src/index.js');
      await fileExplorer.createFile('src/utils.js');
      await fileExplorer.createFolder('test');
      await fileExplorer.createFile('test/index.test.js');
    });

    test('should search files by name', async () => {
      // Act
      const results = await fileExplorer.searchFiles('index');

      // Assert
      expect(results.length).toBe(2);
      expect(results).toContain('src/index.js');
      expect(results).toContain('test/index.test.js');
    });

    test('should search with glob patterns', async () => {
      // Act
      const results = await fileExplorer.searchFiles('**/*.test.js');

      // Assert
      expect(results.length).toBe(1);
      expect(results[0]).toBe('test/index.test.js');
    });

    test('should search file contents', async () => {
      // Arrange
      await fileExplorer.openFile('src/index.js');
      await editor.setContent('const searchMe = "findThis"');
      await editor.save();

      // Act
      const results = await fileExplorer.searchInFiles('findThis');

      // Assert
      expect(results.length).toBe(1);
      expect(results[0].file).toBe('src/index.js');
      expect(results[0].matches).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    test('should handle large files efficiently', async () => {
      // Create large file (1MB)
      const largeContent = 'x'.repeat(1024 * 1024);
      await fs.writeFile(path.join(testWorkspace, 'large.txt'), largeContent);

      // Act
      const startTime = Date.now();
      await fileExplorer.openFile('large.txt');
      const loadTime = Date.now() - startTime;

      // Assert
      expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
      expect(await editor.isFileOpen('large.txt')).toBe(true);
    });

    test('should handle many files efficiently', async () => {
      // Create many files
      for (let i = 0; i < 100; i++) {
        await fs.writeFile(
          path.join(testWorkspace, `file-${i}.txt`), 
          `content ${i}`
        );
      }

      // Act
      const startTime = Date.now();
      await fileExplorer.refresh();
      const refreshTime = Date.now() - startTime;

      // Assert
      expect(refreshTime).toBeLessThan(2000); // Should refresh within 2 seconds
      const fileCount = await fileExplorer.getFileCount();
      expect(fileCount).toBe(100);
    });
  });
});