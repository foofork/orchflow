/**
 * Search Functionality E2E Tests
 * Tests global search, file search, and command palette
 */

import { TestContext } from '../helpers/test-context';
import { SearchPage } from '../helpers/page-objects/SearchPage';
import { FileExplorerPage } from '../helpers/page-objects/FileExplorerPage';
import { EditorPage } from '../helpers/page-objects/EditorPage';
import { CommandPalettePage } from '../helpers/page-objects/CommandPalettePage';
import * as path from 'path';
import * as fs from 'fs/promises';

describe('Search Functionality Flow', () => {
  let testContext: TestContext;
  let search: SearchPage;
  let fileExplorer: FileExplorerPage;
  let editor: EditorPage;
  let commandPalette: CommandPalettePage;
  let testWorkspace: string;

  beforeEach(async () => {
    testContext = new TestContext({
      headless: process.env.CI === 'true',
      trace: true
    });
    await testContext.setup();
    
    const { page, baseUrl } = await testContext.createPage();
    search = new SearchPage(page);
    fileExplorer = new FileExplorerPage(page);
    editor = new EditorPage(page);
    commandPalette = new CommandPalettePage(page);
    
    // Create test workspace with sample files
    testWorkspace = path.join(testContext.getDataDir() || '', 'search-test');
    await createTestFiles(testWorkspace);
    
    await page.goto(baseUrl);
    await fileExplorer.openWorkspace(testWorkspace);
  });

  afterEach(async () => {
    await testContext.captureState('search-flow');
    await testContext.teardown();
  });

  describe('Global Search', () => {
    test('should search across all files', async () => {
      // Act
      await search.openGlobalSearch();
      const results = await search.searchInFiles('TODO');

      // Assert
      expect(results.totalMatches).toBe(3);
      expect(results.fileCount).toBe(3);
      expect(results.files.map(f => f.name)).toContain('index.js');
      expect(results.files.map(f => f.name)).toContain('utils.js');
      expect(results.files.map(f => f.name)).toContain('README.md');
    });

    test('should search with regex', async () => {
      // Act
      await search.openGlobalSearch();
      await search.enableRegex();
      const results = await search.searchInFiles('function\\s+\\w+\\(');

      // Assert
      expect(results.totalMatches).toBeGreaterThan(0);
      const match = results.files[0].matches[0];
      expect(match.text).toMatch(/function\s+\w+\(/);
    });

    test('should search case sensitive', async () => {
      // Act
      await search.openGlobalSearch();
      await search.enableCaseSensitive();
      const results1 = await search.searchInFiles('todo');
      const results2 = await search.searchInFiles('TODO');

      // Assert
      expect(results1.totalMatches).toBe(0);
      expect(results2.totalMatches).toBe(3);
    });

    test('should search whole word', async () => {
      // Act
      await search.openGlobalSearch();
      await search.enableWholeWord();
      const results1 = await search.searchInFiles('test');
      const results2 = await search.searchInFiles('testing');

      // Assert
      expect(results1.files.every(f => {
        return f.matches.every(m => /\btest\b/.test(m.text));
      })).toBe(true);
    });

    test('should exclude files', async () => {
      // Act
      await search.openGlobalSearch();
      await search.setExcludePattern('*.md');
      const results = await search.searchInFiles('TODO');

      // Assert
      expect(results.files.map(f => f.name)).not.toContain('README.md');
      expect(results.totalMatches).toBe(2);
    });

    test('should include only specific files', async () => {
      // Act
      await search.openGlobalSearch();
      await search.setIncludePattern('*.js');
      const results = await search.searchInFiles('TODO');

      // Assert
      expect(results.files.every(f => f.name.endsWith('.js'))).toBe(true);
    });

    test('should navigate search results', async () => {
      // Arrange
      await search.openGlobalSearch();
      const results = await search.searchInFiles('function');

      // Act
      await search.goToResult(0, 0);

      // Assert
      expect(await editor.isFileOpen(results.files[0].name)).toBe(true);
      const cursorPos = await editor.getCursorPosition();
      expect(cursorPos.line).toBe(results.files[0].matches[0].line);
    });

    test('should replace in files', async () => {
      // Act
      await search.openGlobalSearch();
      await search.searchInFiles('oldFunction');
      await search.replaceAll('oldFunction', 'newFunction');

      // Assert
      const content = await fs.readFile(
        path.join(testWorkspace, 'src/legacy.js'),
        'utf-8'
      );
      expect(content).toContain('newFunction');
      expect(content).not.toContain('oldFunction');
    });

    test('should preview replacements', async () => {
      // Act
      await search.openGlobalSearch();
      await search.searchInFiles('TODO');
      const preview = await search.previewReplace('TODO', 'DONE');

      // Assert
      expect(preview.changes).toHaveLength(3);
      expect(preview.changes[0].before).toContain('TODO');
      expect(preview.changes[0].after).toContain('DONE');
    });

    test('should support search history', async () => {
      // Arrange
      await search.openGlobalSearch();
      await search.searchInFiles('first search');
      await search.searchInFiles('second search');
      await search.searchInFiles('third search');

      // Act
      const history = await search.getSearchHistory();

      // Assert
      expect(history).toContain('third search');
      expect(history).toContain('second search');
      expect(history).toContain('first search');
    });
  });

  describe('File Search', () => {
    test('should search by file name', async () => {
      // Act
      await search.openFileSearch();
      const results = await search.searchFiles('util');

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].path).toContain('utils.js');
      expect(results[1].path).toContain('test-utils.js');
    });

    test('should search with fuzzy matching', async () => {
      // Act
      await search.openFileSearch();
      const results = await search.searchFiles('ijs'); // matches index.js

      // Assert
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].path).toContain('index.js');
    });

    test('should search by file path', async () => {
      // Act
      await search.openFileSearch();
      const results = await search.searchFiles('src/comp');

      // Assert
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].path).toContain('src/components');
    });

    test('should sort by relevance', async () => {
      // Act
      await search.openFileSearch();
      const results = await search.searchFiles('test');

      // Assert
      // Exact matches should come first
      const exactMatch = results.findIndex(r => r.name === 'test.js');
      const partialMatch = results.findIndex(r => r.name === 'test-utils.js');
      expect(exactMatch).toBeLessThan(partialMatch);
    });

    test('should show recent files', async () => {
      // Arrange
      await fileExplorer.openFile('src/index.js');
      await fileExplorer.openFile('src/utils.js');

      // Act
      await search.openFileSearch();
      const recent = await search.getRecentFiles();

      // Assert
      expect(recent[0]).toContain('utils.js');
      expect(recent[1]).toContain('index.js');
    });

    test('should navigate to file', async () => {
      // Act
      await search.openFileSearch();
      await search.searchFiles('Button.tsx');
      await search.selectSearchResult(0);

      // Assert
      expect(await editor.isFileOpen('Button.tsx')).toBe(true);
    });

    test('should show file preview', async () => {
      // Act
      await search.openFileSearch();
      await search.searchFiles('utils');
      await search.focusSearchResult(0);

      // Assert
      const preview = await search.getFilePreview();
      expect(preview).toContain('export function');
    });
  });

  describe('Command Palette', () => {
    test('should search commands', async () => {
      // Act
      await commandPalette.open();
      const commands = await commandPalette.searchCommands('save');

      // Assert
      expect(commands.length).toBeGreaterThan(0);
      expect(commands[0].name).toContain('Save');
      expect(commands[0].keybinding).toBe('Ctrl+S');
    });

    test('should execute command', async () => {
      // Arrange
      await fileExplorer.openFile('src/index.js');
      await editor.typeText('// test comment');

      // Act
      await commandPalette.open();
      await commandPalette.executeCommand('File: Save');

      // Assert
      expect(await editor.isDirty()).toBe(false);
    });

    test('should show command categories', async () => {
      // Act
      await commandPalette.open();
      await commandPalette.typePrefix('>'); // Commands
      const commands = await commandPalette.getVisibleCommands();

      // Assert
      expect(commands.length).toBeGreaterThan(0);
      expect(commands.every(c => c.category)).toBe(true);
    });

    test('should search symbols', async () => {
      // Arrange
      await fileExplorer.openFile('src/index.js');

      // Act
      await commandPalette.open();
      await commandPalette.typePrefix('@'); // Symbols
      const symbols = await commandPalette.getVisibleSymbols();

      // Assert
      expect(symbols.length).toBeGreaterThan(0);
      expect(symbols[0].type).toBe('function');
      expect(symbols[0].name).toBe('main');
    });

    test('should go to line', async () => {
      // Arrange
      await fileExplorer.openFile('src/utils.js');

      // Act
      await commandPalette.open();
      await commandPalette.typePrefix(':'); // Go to line
      await commandPalette.type('10');
      await commandPalette.selectFirstResult();

      // Assert
      const position = await editor.getCursorPosition();
      expect(position.line).toBe(10);
    });

    test('should show recent commands', async () => {
      // Arrange
      await commandPalette.open();
      await commandPalette.executeCommand('File: Save');
      await commandPalette.open();
      await commandPalette.executeCommand('File: Save All');

      // Act
      await commandPalette.open();
      const recent = await commandPalette.getRecentCommands();

      // Assert
      expect(recent[0]).toBe('File: Save All');
      expect(recent[1]).toBe('File: Save');
    });

    test('should filter by category', async () => {
      // Act
      await commandPalette.open();
      await commandPalette.filterByCategory('File');
      const commands = await commandPalette.getVisibleCommands();

      // Assert
      expect(commands.every(c => c.category === 'File')).toBe(true);
    });

    test('should show keybinding conflicts', async () => {
      // Act
      await commandPalette.open();
      const commands = await commandPalette.searchCommands('Ctrl+S');

      // Assert
      // Should show all commands with Ctrl+S keybinding
      expect(commands.length).toBeGreaterThanOrEqual(1);
      if (commands.length > 1) {
        expect(commands.some(c => c.hasConflict)).toBe(true);
      }
    });
  });

  describe('Search and Replace in Editor', () => {
    beforeEach(async () => {
      await fileExplorer.openFile('src/index.js');
    });

    test('should find in current file', async () => {
      // Act
      await search.openFindInFile();
      const matches = await search.findInCurrentFile('function');

      // Assert
      expect(matches.count).toBeGreaterThan(0);
      expect(matches.current).toBe(1);
    });

    test('should navigate between matches', async () => {
      // Arrange
      await search.openFindInFile();
      await search.findInCurrentFile('TODO');

      // Act
      await search.goToNextMatch();
      const pos1 = await editor.getCursorPosition();
      
      await search.goToNextMatch();
      const pos2 = await editor.getCursorPosition();

      // Assert
      expect(pos2.line).toBeGreaterThan(pos1.line);
    });

    test('should replace single occurrence', async () => {
      // Act
      await search.openFindInFile();
      await search.findInCurrentFile('oldVar');
      await search.replaceCurrent('oldVar', 'newVar');

      // Assert
      const content = await editor.getContent();
      expect(content).toContain('newVar');
      
      // Should still have other occurrences
      const matches = await search.findInCurrentFile('oldVar');
      expect(matches.count).toBeGreaterThan(0);
    });

    test('should replace all occurrences', async () => {
      // Act
      await search.openFindInFile();
      await search.findInCurrentFile('TODO');
      await search.replaceAllInFile('TODO', 'DONE');

      // Assert
      const content = await editor.getContent();
      expect(content).not.toContain('TODO');
      expect(content).toContain('DONE');
    });

    test('should preserve case when replacing', async () => {
      // Arrange
      await editor.setContent('camelCase CamelCase CAMELCASE');

      // Act
      await search.openFindInFile();
      await search.enablePreserveCase();
      await search.replaceAllInFile('camelcase', 'snakecase');

      // Assert
      const content = await editor.getContent();
      expect(content).toBe('snakeCase SnakeCase SNAKECASE');
    });

    test('should support multiline search', async () => {
      // Act
      await search.openFindInFile();
      await search.enableRegex();
      const matches = await search.findInCurrentFile('function.*\\n.*{');

      // Assert
      expect(matches.count).toBeGreaterThan(0);
    });
  });

  describe('Search Performance', () => {
    test('should handle large files efficiently', async () => {
      // Create large file
      const largeContent = Array(10000).fill('line with searchTerm').join('\n');
      await fs.writeFile(
        path.join(testWorkspace, 'large.txt'),
        largeContent
      );

      // Act
      const startTime = Date.now();
      await search.openGlobalSearch();
      const results = await search.searchInFiles('searchTerm');
      const searchTime = Date.now() - startTime;

      // Assert
      expect(searchTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(results.totalMatches).toBe(10000);
    });

    test('should cancel long-running search', async () => {
      // Create many files
      for (let i = 0; i < 100; i++) {
        await fs.writeFile(
          path.join(testWorkspace, `file${i}.txt`),
          'content to search'
        );
      }

      // Act
      await search.openGlobalSearch();
      const searchPromise = search.searchInFiles('content');
      await search.page.waitForTimeout(100);
      await search.cancelSearch();

      // Assert
      const results = await searchPromise;
      expect(results.cancelled).toBe(true);
    });

    test('should debounce search input', async () => {
      // Act
      await search.openGlobalSearch();
      let searchCount = 0;
      
      // Monitor search requests
      await search.page.on('request', req => {
        if (req.url().includes('search')) searchCount++;
      });

      // Type quickly
      await search.typeSearchQuery('test query');

      // Assert
      await search.page.waitForTimeout(500);
      expect(searchCount).toBe(1); // Should only search once after debounce
    });
  });

  describe('Search Options Persistence', () => {
    test('should remember search options', async () => {
      // Arrange
      await search.openGlobalSearch();
      await search.enableRegex();
      await search.enableCaseSensitive();
      await search.setIncludePattern('*.js');

      // Act - Close and reopen
      await search.closeSearch();
      await search.openGlobalSearch();

      // Assert
      expect(await search.isRegexEnabled()).toBe(true);
      expect(await search.isCaseSensitiveEnabled()).toBe(true);
      expect(await search.getIncludePattern()).toBe('*.js');
    });

    test('should remember search history across sessions', async () => {
      // Arrange
      await search.openGlobalSearch();
      await search.searchInFiles('persistent search 1');
      await search.searchInFiles('persistent search 2');

      // Act - New session
      const { page: newPage } = await testContext.createPage();
      const newSearch = new SearchPage(newPage);
      await newPage.goto(testContext.baseUrl);
      await newSearch.openGlobalSearch();
      const history = await newSearch.getSearchHistory();

      // Assert
      expect(history).toContain('persistent search 2');
      expect(history).toContain('persistent search 1');
    });
  });
});

// Helper function to create test files
async function createTestFiles(workspace: string) {
  const files = {
    'src/index.js': `
// TODO: Implement main function
function main() {
  console.log('Hello World');
  oldVar = 'test';
}

function helper() {
  // TODO: Add implementation
  return oldVar;
}

main();
`,
    'src/utils.js': `
// Utility functions
export function formatDate(date) {
  // TODO: Improve date formatting
  return date.toString();
}

export function parseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}
`,
    'src/components/Button.tsx': `
import React from 'react';

interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
}

export function Button({ onClick, children }: ButtonProps) {
  return (
    <button onClick={onClick}>
      {children}
    </button>
  );
}
`,
    'test/test.js': `
describe('Test Suite', () => {
  it('should pass', () => {
    expect(true).toBe(true);
  });
});
`,
    'test/test-utils.js': `
export function setupTest() {
  // Test setup
}
`,
    'src/legacy.js': `
function oldFunction() {
  console.log('Legacy code');
}

oldFunction();
`,
    'README.md': `
# Project README

TODO: Add project description

## Installation
npm install

## Usage
npm start
`
  };

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(workspace, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content.trim());
  }
}