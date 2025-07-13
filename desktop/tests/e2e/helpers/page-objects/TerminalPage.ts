/**
 * Terminal Page Object
 * Comprehensive terminal management for E2E tests
 */

import type { Page, Locator } from 'playwright';
import { BasePage } from './BasePage';

export class TerminalPage extends BasePage {
  // Selectors
  private readonly terminalContainer = '[data-testid="terminal-container"]';
  private readonly terminalTab = '[data-testid="terminal-tab"]';
  private readonly newTerminalButton = '[data-testid="new-terminal-button"]';
  private readonly closeTerminalButton = '[data-testid="close-terminal-button"]';
  private readonly terminalOutput = '[data-testid="terminal-output"]';
  private readonly terminalInput = '[data-testid="terminal-input"]';
  private readonly splitButton = '[data-testid="split-terminal-button"]';
  private readonly terminalSettings = '[data-testid="terminal-settings"]';
  private readonly searchBox = '[data-testid="terminal-search"]';
  private readonly notification = '[data-testid="notification"]';
  private readonly confirmDialog = '[data-testid="confirm-dialog"]';
  private readonly restoreButton = '[data-testid="restore-terminal-button"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to terminal view
   */
  async navigateToTerminal() {
    await this.goto('/terminal');
    await this.waitForElement(this.terminalContainer);
  }

  /**
   * Create a new terminal
   */
  async createNewTerminal(): Promise<string | null> {
    try {
      const terminalsBefore = await this.getTerminalCount();
      await this.clickElement(this.newTerminalButton);
      
      // Wait for new terminal to be created
      await this.page.waitForFunction(
        (before) => {
          const tabs = document.querySelectorAll('[data-testid="terminal-tab"]');
          return tabs.length > before;
        },
        terminalsBefore,
        { timeout: 5000 }
      );

      const terminalId = await this.getActiveTerminalId();
      return terminalId;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get active terminal ID
   */
  async getActiveTerminalId(): Promise<string> {
    const activeTab = await this.waitForElement(`${this.terminalTab}.active`);
    return await activeTab.getAttribute('data-terminal-id') || '';
  }

  /**
   * Get terminal count
   */
  async getTerminalCount(): Promise<number> {
    const tabs = await this.getAllElements(this.terminalTab);
    return tabs.length;
  }

  /**
   * Check if terminal is active
   */
  async isTerminalActive(terminalId: string): Promise<boolean> {
    const activeId = await this.getActiveTerminalId();
    return activeId === terminalId;
  }

  /**
   * Switch to terminal
   */
  async switchToTerminal(terminalId: string) {
    const tabSelector = `${this.terminalTab}[data-terminal-id="${terminalId}"]`;
    await this.clickElement(tabSelector);
  }

  /**
   * Set terminal title
   */
  async setTerminalTitle(terminalId: string, title: string) {
    await this.switchToTerminal(terminalId);
    const titleElement = `${this.terminalTab}[data-terminal-id="${terminalId}"] [data-testid="terminal-title"]`;
    await this.doubleClick(titleElement);
    await this.fillInput('[data-testid="terminal-title-input"]', title);
    await this.pressKey('Enter');
  }

  /**
   * Get terminal title
   */
  async getTerminalTitle(terminalId: string): Promise<string> {
    const titleSelector = `${this.terminalTab}[data-terminal-id="${terminalId}"] [data-testid="terminal-title"]`;
    return await this.getTextContent(titleSelector);
  }

  /**
   * Split terminal
   */
  async splitTerminal(terminalId: string, direction: 'horizontal' | 'vertical'): Promise<string | null> {
    try {
      await this.switchToTerminal(terminalId);
      const terminalsBefore = await this.getTerminalCount();
      
      // Click split button with modifier
      if (direction === 'horizontal') {
        await this.clickElement(`${this.splitButton}[data-direction="horizontal"]`);
      } else {
        await this.clickElement(`${this.splitButton}[data-direction="vertical"]`);
      }

      // Wait for split
      await this.page.waitForFunction(
        (before) => {
          const terminals = document.querySelectorAll('[data-testid="terminal-pane"]');
          return terminals.length > before;
        },
        terminalsBefore,
        { timeout: 5000 }
      );

      // Get the new terminal ID
      const panes = await this.getAllElements('[data-testid="terminal-pane"]');
      const lastPane = panes[panes.length - 1];
      return await lastPane.getAttribute('data-terminal-id');
    } catch {
      return null;
    }
  }

  /**
   * Check if terminals are split
   */
  async areTerminalsSplit(terminal1: string, terminal2: string): Promise<boolean> {
    const splitContainer = await this.page.locator('[data-testid="split-container"]')
      .filter({ has: this.page.locator(`[data-terminal-id="${terminal1}"]`) })
      .filter({ has: this.page.locator(`[data-terminal-id="${terminal2}"]`) });
    
    return await splitContainer.count() > 0;
  }

  /**
   * Get split direction
   */
  async getSplitDirection(terminal1: string, terminal2: string): Promise<string> {
    const splitContainer = await this.page.locator('[data-testid="split-container"]')
      .filter({ has: this.page.locator(`[data-terminal-id="${terminal1}"]`) })
      .filter({ has: this.page.locator(`[data-terminal-id="${terminal2}"]`) });
    
    return await splitContainer.getAttribute('data-split-direction') || '';
  }

  /**
   * Get layout complexity (depth of splits)
   */
  async getLayoutComplexity(): Promise<number> {
    return await this.page.evaluate(() => {
      const maxDepth = 0;
      const countDepth = (element: Element, depth = 0): number => {
        if (element.getAttribute('data-testid') === 'split-container') {
          depth++;
        }
        let max = depth;
        for (const child of element.children) {
          max = Math.max(max, countDepth(child, depth));
        }
        return max;
      };
      const container = document.querySelector('[data-testid="terminal-container"]');
      return container ? countDepth(container) : 0;
    });
  }

  /**
   * Resize split panel
   */
  async resizeSplitPanel(terminal1: string, terminal2: string, percentage: number) {
    const splitter = await this.page.locator('[data-testid="split-divider"]')
      .locator('near', { locator: this.page.locator(`[data-terminal-id="${terminal1}"]`) });
    
    const box = await splitter.boundingBox();
    if (!box) return;

    const direction = await this.getSplitDirection(terminal1, terminal2);
    const distance = direction === 'horizontal' 
      ? (percentage - 50) * 10  // Approximate pixel calculation
      : (percentage - 50) * 10;

    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.mouse.down();
    
    if (direction === 'horizontal') {
      await this.page.mouse.move(box.x + box.width / 2, box.y + distance);
    } else {
      await this.page.mouse.move(box.x + distance, box.y + box.height / 2);
    }
    
    await this.page.mouse.up();
  }

  /**
   * Get split sizes
   */
  async getSplitSizes(terminal1: string, terminal2: string): Promise<{ panel1: number; panel2: number }> {
    const pane1 = await this.page.locator(`[data-terminal-id="${terminal1}"]`).boundingBox();
    const pane2 = await this.page.locator(`[data-terminal-id="${terminal2}"]`).boundingBox();
    
    if (!pane1 || !pane2) return { panel1: 0, panel2: 0 };

    const direction = await this.getSplitDirection(terminal1, terminal2);
    if (direction === 'horizontal') {
      const total = pane1.height + pane2.height;
      return {
        panel1: (pane1.height / total) * 100,
        panel2: (pane2.height / total) * 100
      };
    } else {
      const total = pane1.width + pane2.width;
      return {
        panel1: (pane1.width / total) * 100,
        panel2: (pane2.width / total) * 100
      };
    }
  }

  /**
   * Execute command in terminal
   */
  async executeCommand(terminalId: string, command: string) {
    await this.switchToTerminal(terminalId);
    const input = await this.waitForElement(`[data-terminal-id="${terminalId}"] ${this.terminalInput}`);
    await input.type(command);
    await input.press('Enter');
    await this.page.waitForTimeout(100); // Allow command to process
  }

  /**
   * Get terminal output
   */
  async getTerminalOutput(terminalId: string): Promise<string> {
    await this.switchToTerminal(terminalId);
    const outputSelector = `[data-terminal-id="${terminalId}"] ${this.terminalOutput}`;
    return await this.getTextContent(outputSelector);
  }

  /**
   * Clear terminal
   */
  async clearTerminal(terminalId: string) {
    await this.switchToTerminal(terminalId);
    await this.page.keyboard.press('Control+L');
    await this.page.waitForTimeout(100);
  }

  /**
   * Select all output
   */
  async selectAllOutput(terminalId: string) {
    await this.switchToTerminal(terminalId);
    const output = await this.waitForElement(`[data-terminal-id="${terminalId}"] ${this.terminalOutput}`);
    await output.click();
    await this.page.keyboard.press('Control+A');
  }

  /**
   * Copy selection
   */
  async copySelection() {
    await this.page.keyboard.press('Control+C');
  }

  /**
   * Get clipboard content
   */
  async getClipboardContent(): Promise<string> {
    return await this.page.evaluate(() => navigator.clipboard.readText());
  }

  /**
   * Set clipboard content
   */
  async setClipboardContent(text: string) {
    await this.page.evaluate((text) => navigator.clipboard.writeText(text), text);
  }

  /**
   * Paste into terminal
   */
  async pasteIntoTerminal(terminalId: string) {
    await this.switchToTerminal(terminalId);
    const input = await this.waitForElement(`[data-terminal-id="${terminalId}"] ${this.terminalInput}`);
    await input.focus();
    await this.page.keyboard.press('Control+V');
  }

  /**
   * Get current input
   */
  async getCurrentInput(terminalId: string): Promise<string> {
    const input = await this.waitForElement(`[data-terminal-id="${terminalId}"] ${this.terminalInput}`);
    return await input.inputValue();
  }

  /**
   * Scroll to bottom
   */
  async scrollToBottom(terminalId: string) {
    const output = await this.waitForElement(`[data-terminal-id="${terminalId}"] ${this.terminalOutput}`);
    await output.evaluate(el => el.scrollTop = el.scrollHeight);
  }

  /**
   * Scroll to top
   */
  async scrollToTop(terminalId: string) {
    const output = await this.waitForElement(`[data-terminal-id="${terminalId}"] ${this.terminalOutput}`);
    await output.evaluate(el => el.scrollTop = 0);
  }

  /**
   * Check if text is visible
   */
  async isTextVisible(terminalId: string, text: string): Promise<boolean> {
    const outputSelector = `[data-terminal-id="${terminalId}"] ${this.terminalOutput}`;
    return await this.page.locator(outputSelector).locator(`text=${text}`).isVisible();
  }

  /**
   * Close terminal
   */
  async closeTerminal(terminalId: string) {
    await this.switchToTerminal(terminalId);
    const closeButton = `${this.terminalTab}[data-terminal-id="${terminalId}"] ${this.closeTerminalButton}`;
    await this.clickElement(closeButton);
  }

  /**
   * Check if confirmation dialog is visible
   */
  async isConfirmationDialogVisible(): Promise<boolean> {
    return await this.elementExists(this.confirmDialog);
  }

  /**
   * Confirm dialog
   */
  async confirmDialog() {
    await this.clickElement('[data-testid="confirm-button"]');
  }

  /**
   * Cancel dialog
   */
  async cancelDialog() {
    await this.clickElement('[data-testid="cancel-button"]');
  }

  /**
   * Check if terminal exists
   */
  async isTerminalExists(terminalId: string): Promise<boolean> {
    return await this.elementExists(`${this.terminalTab}[data-terminal-id="${terminalId}"]`);
  }

  /**
   * Close all terminals
   */
  async closeAllTerminals() {
    await this.clickElement('[data-testid="close-all-terminals"]');
    if (await this.isConfirmationDialogVisible()) {
      await this.confirmDialog();
    }
  }

  /**
   * Restore last closed terminal
   */
  async restoreLastClosedTerminal(): Promise<string | null> {
    try {
      await this.clickElement(this.restoreButton);
      await this.page.waitForTimeout(500);
      return await this.getActiveTerminalId();
    } catch {
      return null;
    }
  }

  /**
   * Open terminal settings
   */
  async openTerminalSettings() {
    await this.clickElement(this.terminalSettings);
    await this.waitForElement('[data-testid="settings-dialog"]');
  }

  /**
   * Set font size
   */
  async setFontSize(size: number) {
    await this.fillInput('[data-testid="font-size-input"]', size.toString());
  }

  /**
   * Apply settings
   */
  async applySettings() {
    await this.clickElement('[data-testid="apply-settings-button"]');
  }

  /**
   * Get terminal font size
   */
  async getTerminalFontSize(terminalId: string): Promise<number> {
    const terminal = await this.waitForElement(`[data-terminal-id="${terminalId}"]`);
    const fontSize = await terminal.evaluate(el => {
      return parseInt(window.getComputedStyle(el).fontSize);
    });
    return fontSize;
  }

  /**
   * Select theme
   */
  async selectTheme(theme: string) {
    await this.selectOption('[data-testid="theme-select"]', theme);
  }

  /**
   * Get terminal theme
   */
  async getTerminalTheme(terminalId: string): Promise<string> {
    const terminal = await this.waitForElement(`[data-terminal-id="${terminalId}"]`);
    return await terminal.getAttribute('data-theme') || '';
  }

  /**
   * Set default shell
   */
  async setDefaultShell(shell: string) {
    await this.fillInput('[data-testid="default-shell-input"]', shell);
  }

  /**
   * Get terminal shell
   */
  async getTerminalShell(terminalId: string): Promise<string> {
    await this.executeCommand(terminalId, 'echo $SHELL');
    const output = await this.getTerminalOutput(terminalId);
    const lines = output.split('\n');
    return lines[lines.length - 2] || ''; // Line before prompt
  }

  /**
   * Open search
   */
  async openSearch(terminalId: string) {
    await this.switchToTerminal(terminalId);
    await this.page.keyboard.press('Control+F');
    await this.waitForElement(this.searchBox);
  }

  /**
   * Search in terminal
   */
  async searchInTerminal(searchTerm: string): Promise<{ total: number; current: number }> {
    await this.fillInput(this.searchBox, searchTerm);
    await this.page.waitForTimeout(200);
    
    const resultsText = await this.getTextContent('[data-testid="search-results"]');
    const match = resultsText.match(/(\d+) of (\d+)/);
    
    return {
      current: match ? parseInt(match[1]) : 0,
      total: match ? parseInt(match[2]) : 0
    };
  }

  /**
   * Get current search match
   */
  async getCurrentSearchMatch(): Promise<number> {
    const results = await this.searchInTerminal('');
    return results.current;
  }

  /**
   * Next search result
   */
  async nextSearchResult() {
    await this.clickElement('[data-testid="search-next"]');
  }

  /**
   * Previous search result
   */
  async previousSearchResult() {
    await this.clickElement('[data-testid="search-previous"]');
  }

  /**
   * Get notification
   */
  async getNotification(): Promise<string> {
    try {
      const element = await this.waitForElement(this.notification, { timeout: 5000 });
      return await element.textContent() || '';
    } catch {
      return '';
    }
  }
}