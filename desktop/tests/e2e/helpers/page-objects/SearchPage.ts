/**
 * Search Page Object
 * Handles search functionality across the application
 */

import type { Page, Locator } from 'playwright';
import { BasePage } from './BasePage';

interface SearchResult {
  path: string;
  name: string;
  matches: Array<{
    line: number;
    column: number;
    text: string;
  }>;
}

interface SearchResults {
  files: SearchResult[];
  totalMatches: number;
  fileCount: number;
  cancelled?: boolean;
}

interface ReplacePreview {
  changes: Array<{
    file: string;
    line: number;
    before: string;
    after: string;
  }>;
}

interface FileSearchResult {
  path: string;
  name: string;
  score: number;
}

export class SearchPage extends BasePage {
  // Selectors
  private readonly searchPanel = '[data-testid="search-panel"]';
  private readonly searchInput = '[data-testid="search-input"]';
  private readonly replaceInput = '[data-testid="replace-input"]';
  private readonly searchResults = '[data-testid="search-results"]';
  private readonly resultItem = '[data-testid="search-result-item"]';
  private readonly matchItem = '[data-testid="match-item"]';
  
  // Search options
  private readonly caseSensitiveToggle = '[data-testid="case-sensitive"]';
  private readonly wholeWordToggle = '[data-testid="whole-word"]';
  private readonly regexToggle = '[data-testid="use-regex"]';
  private readonly preserveCaseToggle = '[data-testid="preserve-case"]';
  
  // File patterns
  private readonly includeInput = '[data-testid="include-pattern"]';
  private readonly excludeInput = '[data-testid="exclude-pattern"]';
  
  // Actions
  private readonly replaceAllButton = '[data-testid="replace-all"]';
  private readonly replaceButton = '[data-testid="replace"]';
  private readonly cancelButton = '[data-testid="cancel-search"]';
  
  // File search
  private readonly fileSearchInput = '[data-testid="file-search-input"]';
  private readonly fileSearchResults = '[data-testid="file-search-results"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Open global search
   */
  async openGlobalSearch() {
    await this.page.keyboard.press('Control+Shift+F');
    await this.waitForElement(this.searchPanel);
  }

  /**
   * Open file search
   */
  async openFileSearch() {
    await this.page.keyboard.press('Control+P');
    await this.waitForElement(this.fileSearchInput);
  }

  /**
   * Open find in file
   */
  async openFindInFile() {
    await this.page.keyboard.press('Control+F');
    await this.waitForElement('[data-testid="find-widget"]');
  }

  /**
   * Close search
   */
  async closeSearch() {
    await this.pressKey('Escape');
  }

  /**
   * Search in files
   */
  async searchInFiles(query: string): Promise<SearchResults> {
    await this.fillInput(this.searchInput, query);
    await this.pressKey('Enter');
    
    // Wait for search to complete
    await this.waitForCondition(
      async () => {
        const isSearching = await this.elementExists('[data-testid="searching"]');
        return !isSearching;
      },
      { timeout: 10000 }
    );

    // Check if cancelled
    if (await this.elementExists('[data-testid="search-cancelled"]')) {
      return { files: [], totalMatches: 0, fileCount: 0, cancelled: true };
    }

    // Parse results
    const fileElements = await this.getAllElements(this.resultItem);
    const files: SearchResult[] = [];

    for (const fileElement of fileElements) {
      const path = await fileElement.getAttribute('data-file-path') || '';
      const name = path.split('/').pop() || '';
      
      const matchElements = await fileElement.locator(this.matchItem).all();
      const matches = [];
      
      for (const matchElement of matchElements) {
        matches.push({
          line: parseInt(await matchElement.getAttribute('data-line') || '0'),
          column: parseInt(await matchElement.getAttribute('data-column') || '0'),
          text: await matchElement.textContent() || ''
        });
      }
      
      files.push({ path, name, matches });
    }

    const totalMatches = files.reduce((sum, f) => sum + f.matches.length, 0);
    
    return {
      files,
      totalMatches,
      fileCount: files.length
    };
  }

  /**
   * Replace all occurrences
   */
  async replaceAll(search: string, replace: string) {
    await this.fillInput(this.searchInput, search);
    await this.fillInput(this.replaceInput, replace);
    await this.clickElement(this.replaceAllButton);
    
    // Confirm replacement
    await this.clickElement('[data-testid="confirm-replace-all"]');
    
    // Wait for completion
    await this.waitForCondition(
      async () => !await this.elementExists('[data-testid="replacing"]'),
      { timeout: 30000 }
    );
  }

  /**
   * Preview replacements
   */
  async previewReplace(search: string, replace: string): Promise<ReplacePreview> {
    await this.fillInput(this.searchInput, search);
    await this.fillInput(this.replaceInput, replace);
    await this.clickElement('[data-testid="preview-replace"]');
    
    await this.waitForElement('[data-testid="replace-preview"]');
    
    const changeElements = await this.getAllElements('[data-testid="preview-change"]');
    const changes = [];
    
    for (const changeElement of changeElements) {
      changes.push({
        file: await changeElement.getAttribute('data-file') || '',
        line: parseInt(await changeElement.getAttribute('data-line') || '0'),
        before: await changeElement.locator('[data-testid="before"]').textContent() || '',
        after: await changeElement.locator('[data-testid="after"]').textContent() || ''
      });
    }
    
    return { changes };
  }

  /**
   * Enable regex search
   */
  async enableRegex() {
    const isEnabled = await this.page.locator(this.regexToggle).getAttribute('aria-pressed');
    if (isEnabled !== 'true') {
      await this.clickElement(this.regexToggle);
    }
  }

  /**
   * Enable case sensitive search
   */
  async enableCaseSensitive() {
    const isEnabled = await this.page.locator(this.caseSensitiveToggle).getAttribute('aria-pressed');
    if (isEnabled !== 'true') {
      await this.clickElement(this.caseSensitiveToggle);
    }
  }

  /**
   * Enable whole word search
   */
  async enableWholeWord() {
    const isEnabled = await this.page.locator(this.wholeWordToggle).getAttribute('aria-pressed');
    if (isEnabled !== 'true') {
      await this.clickElement(this.wholeWordToggle);
    }
  }

  /**
   * Enable preserve case
   */
  async enablePreserveCase() {
    const isEnabled = await this.page.locator(this.preserveCaseToggle).getAttribute('aria-pressed');
    if (isEnabled !== 'true') {
      await this.clickElement(this.preserveCaseToggle);
    }
  }

  /**
   * Set exclude pattern
   */
  async setExcludePattern(pattern: string) {
    await this.fillInput(this.excludeInput, pattern);
  }

  /**
   * Set include pattern
   */
  async setIncludePattern(pattern: string) {
    await this.fillInput(this.includeInput, pattern);
  }

  /**
   * Go to search result
   */
  async goToResult(fileIndex: number, matchIndex: number) {
    const fileElement = (await this.getAllElements(this.resultItem))[fileIndex];
    const matchElement = (await fileElement.locator(this.matchItem).all())[matchIndex];
    await matchElement.click();
  }

  /**
   * Get search history
   */
  async getSearchHistory(): Promise<string[]> {
    await this.clickElement('[data-testid="search-history-button"]');
    const historyItems = await this.getAllElements('[data-testid="history-item"]');
    const history = [];
    
    for (const item of historyItems) {
      history.push(await item.textContent() || '');
    }
    
    await this.pressKey('Escape'); // Close history
    return history;
  }

  /**
   * Search files by name
   */
  async searchFiles(query: string): Promise<FileSearchResult[]> {
    await this.fillInput(this.fileSearchInput, query);
    await this.page.waitForTimeout(300); // Debounce
    
    const resultElements = await this.getAllElements('[data-testid="file-result"]');
    const results: FileSearchResult[] = [];
    
    for (const element of resultElements) {
      results.push({
        path: await element.getAttribute('data-path') || '',
        name: await element.locator('[data-testid="file-name"]').textContent() || '',
        score: parseFloat(await element.getAttribute('data-score') || '0')
      });
    }
    
    return results;
  }

  /**
   * Get recent files
   */
  async getRecentFiles(): Promise<string[]> {
    const recentElements = await this.getAllElements('[data-testid="recent-file"]');
    const recent = [];
    
    for (const element of recentElements) {
      recent.push(await element.getAttribute('data-path') || '');
    }
    
    return recent;
  }

  /**
   * Select search result
   */
  async selectSearchResult(index: number) {
    const results = await this.getAllElements('[data-testid="file-result"]');
    await results[index].click();
  }

  /**
   * Focus search result
   */
  async focusSearchResult(index: number) {
    const results = await this.getAllElements('[data-testid="file-result"]');
    await results[index].hover();
  }

  /**
   * Get file preview
   */
  async getFilePreview(): Promise<string> {
    await this.waitForElement('[data-testid="file-preview"]');
    return await this.getTextContent('[data-testid="file-preview"]');
  }

  /**
   * Find in current file
   */
  async findInCurrentFile(query: string): Promise<{ count: number; current: number }> {
    await this.fillInput('[data-testid="find-input"]', query);
    await this.page.waitForTimeout(200);
    
    const countText = await this.getTextContent('[data-testid="match-count"]');
    const match = countText.match(/(\d+) of (\d+)/);
    
    return {
      current: match ? parseInt(match[1]) : 0,
      count: match ? parseInt(match[2]) : 0
    };
  }

  /**
   * Go to next match
   */
  async goToNextMatch() {
    await this.clickElement('[data-testid="find-next"]');
  }

  /**
   * Go to previous match
   */
  async goToPreviousMatch() {
    await this.clickElement('[data-testid="find-previous"]');
  }

  /**
   * Replace current match
   */
  async replaceCurrent(search: string, replace: string) {
    await this.fillInput('[data-testid="find-input"]', search);
    await this.fillInput('[data-testid="replace-input"]', replace);
    await this.clickElement('[data-testid="replace-one"]');
  }

  /**
   * Replace all in file
   */
  async replaceAllInFile(search: string, replace: string) {
    await this.fillInput('[data-testid="find-input"]', search);
    await this.fillInput('[data-testid="replace-input"]', replace);
    await this.clickElement('[data-testid="replace-all-in-file"]');
  }

  /**
   * Cancel search
   */
  async cancelSearch() {
    await this.clickElement(this.cancelButton);
  }

  /**
   * Type search query
   */
  async typeSearchQuery(query: string) {
    await this.clearInput(this.searchInput);
    for (const char of query) {
      await this.page.keyboard.type(char);
      await this.page.waitForTimeout(50);
    }
  }

  /**
   * Check if regex is enabled
   */
  async isRegexEnabled(): Promise<boolean> {
    const isPressed = await this.page.locator(this.regexToggle).getAttribute('aria-pressed');
    return isPressed === 'true';
  }

  /**
   * Check if case sensitive is enabled
   */
  async isCaseSensitiveEnabled(): Promise<boolean> {
    const isPressed = await this.page.locator(this.caseSensitiveToggle).getAttribute('aria-pressed');
    return isPressed === 'true';
  }

  /**
   * Get include pattern
   */
  async getIncludePattern(): Promise<string> {
    const input = await this.waitForElement(this.includeInput);
    return await input.inputValue();
  }

  /**
   * Get exclude pattern
   */
  async getExcludePattern(): Promise<string> {
    const input = await this.waitForElement(this.excludeInput);
    return await input.inputValue();
  }
}