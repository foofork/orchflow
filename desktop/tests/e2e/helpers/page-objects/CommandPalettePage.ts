/**
 * Command Palette Page Object
 * Handles command palette interactions
 */

import type { Page, Locator } from 'playwright';
import { BasePage } from './BasePage';

interface Command {
  name: string;
  category: string;
  keybinding?: string;
  hasConflict?: boolean;
}

interface Symbol {
  name: string;
  type: 'function' | 'class' | 'variable' | 'constant' | 'interface';
  container?: string;
}

export class CommandPalettePage extends BasePage {
  // Selectors
  private readonly commandPalette = '[data-testid="command-palette"]';
  private readonly commandInput = '[data-testid="command-input"]';
  private readonly commandList = '[data-testid="command-list"]';
  private readonly commandItem = '[data-testid="command-item"]';
  private readonly symbolItem = '[data-testid="symbol-item"]';
  private readonly categoryFilter = '[data-testid="category-filter"]';
  private readonly recentSection = '[data-testid="recent-commands"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Open command palette
   */
  async open() {
    await this.page.keyboard.press('Control+Shift+P');
    await this.waitForElement(this.commandPalette);
    await this.waitForElement(this.commandInput);
  }

  /**
   * Close command palette
   */
  async close() {
    await this.pressKey('Escape');
  }

  /**
   * Type in command palette
   */
  async type(text: string) {
    const input = await this.waitForElement(this.commandInput);
    await input.type(text);
    await this.page.waitForTimeout(100); // Allow filtering
  }

  /**
   * Type prefix (>, @, :, etc.)
   */
  async typePrefix(prefix: string) {
    await this.clearInput(this.commandInput);
    await this.type(prefix);
  }

  /**
   * Search commands
   */
  async searchCommands(query: string): Promise<Command[]> {
    await this.clearInput(this.commandInput);
    await this.type(query);
    
    const items = await this.getAllElements(this.commandItem);
    const commands: Command[] = [];
    
    for (const item of items) {
      const name = await item.locator('[data-testid="command-name"]').textContent() || '';
      const category = await item.getAttribute('data-category') || '';
      const keybinding = await item.locator('[data-testid="command-keybinding"]').textContent();
      const hasConflict = await item.locator('[data-testid="conflict-indicator"]').isVisible();
      
      commands.push({
        name,
        category,
        keybinding: keybinding || undefined,
        hasConflict
      });
    }
    
    return commands;
  }

  /**
   * Execute command
   */
  async executeCommand(commandName: string) {
    await this.searchCommands(commandName);
    const commandElement = await this.page.locator(
      `${this.commandItem} [data-testid="command-name"]:has-text("${commandName}")`
    ).locator('..');
    
    await commandElement.click();
  }

  /**
   * Get visible commands
   */
  async getVisibleCommands(): Promise<Command[]> {
    const items = await this.getAllElements(this.commandItem);
    const commands: Command[] = [];
    
    for (const item of items) {
      commands.push({
        name: await item.locator('[data-testid="command-name"]').textContent() || '',
        category: await item.getAttribute('data-category') || '',
        keybinding: await item.locator('[data-testid="command-keybinding"]').textContent() || undefined
      });
    }
    
    return commands;
  }

  /**
   * Get visible symbols
   */
  async getVisibleSymbols(): Promise<Symbol[]> {
    const items = await this.getAllElements(this.symbolItem);
    const symbols: Symbol[] = [];
    
    for (const item of items) {
      symbols.push({
        name: await item.locator('[data-testid="symbol-name"]').textContent() || '',
        type: await item.getAttribute('data-symbol-type') as Symbol['type'],
        container: await item.locator('[data-testid="symbol-container"]').textContent() || undefined
      });
    }
    
    return symbols;
  }

  /**
   * Select first result
   */
  async selectFirstResult() {
    await this.pressKey('Enter');
  }

  /**
   * Navigate to result
   */
  async navigateToResult(index: number) {
    // Navigate down
    for (let i = 0; i < index; i++) {
      await this.pressKey('ArrowDown');
    }
    await this.pressKey('Enter');
  }

  /**
   * Get recent commands
   */
  async getRecentCommands(): Promise<string[]> {
    // Recent commands are shown when palette opens
    const recentItems = await this.page.locator(
      `${this.recentSection} ${this.commandItem}`
    ).all();
    
    const commands: string[] = [];
    for (const item of recentItems) {
      const name = await item.locator('[data-testid="command-name"]').textContent();
      if (name) commands.push(name);
    }
    
    return commands;
  }

  /**
   * Filter by category
   */
  async filterByCategory(category: string) {
    await this.clickElement(this.categoryFilter);
    await this.clickElement(`[data-testid="category-option"][data-category="${category}"]`);
  }

  /**
   * Clear filter
   */
  async clearFilter() {
    await this.clearInput(this.commandInput);
  }

  /**
   * Check if command exists
   */
  async commandExists(commandName: string): Promise<boolean> {
    await this.searchCommands(commandName);
    return await this.elementExists(
      `${this.commandItem} [data-testid="command-name"]:has-text("${commandName}")`
    );
  }

  /**
   * Get command description
   */
  async getCommandDescription(commandName: string): Promise<string> {
    await this.searchCommands(commandName);
    const item = await this.page.locator(
      `${this.commandItem}:has([data-testid="command-name"]:has-text("${commandName}"))`
    );
    
    return await item.locator('[data-testid="command-description"]').textContent() || '';
  }

  /**
   * Check if in symbol mode
   */
  async isInSymbolMode(): Promise<boolean> {
    const inputValue = await this.page.locator(this.commandInput).inputValue();
    return inputValue.startsWith('@');
  }

  /**
   * Check if in line mode
   */
  async isInLineMode(): Promise<boolean> {
    const inputValue = await this.page.locator(this.commandInput).inputValue();
    return inputValue.startsWith(':');
  }

  /**
   * Get current mode
   */
  async getCurrentMode(): Promise<string> {
    const inputValue = await this.page.locator(this.commandInput).inputValue();
    
    if (inputValue.startsWith('>')) return 'command';
    if (inputValue.startsWith('@')) return 'symbol';
    if (inputValue.startsWith(':')) return 'line';
    if (inputValue.startsWith('#')) return 'workspace-symbol';
    if (inputValue.startsWith('?')) return 'help';
    
    return 'file'; // Default mode
  }

  /**
   * Switch to command mode
   */
  async switchToCommandMode() {
    await this.typePrefix('>');
  }

  /**
   * Switch to symbol mode
   */
  async switchToSymbolMode() {
    await this.typePrefix('@');
  }

  /**
   * Switch to line mode
   */
  async switchToLineMode() {
    await this.typePrefix(':');
  }

  /**
   * Get placeholder text
   */
  async getPlaceholder(): Promise<string> {
    const input = await this.waitForElement(this.commandInput);
    return await input.getAttribute('placeholder') || '';
  }

  /**
   * Check if palette is open
   */
  async isOpen(): Promise<boolean> {
    return await this.elementExists(this.commandPalette);
  }

  /**
   * Get result count
   */
  async getResultCount(): Promise<number> {
    const items = await this.getAllElements(`${this.commandItem}, ${this.symbolItem}`);
    return items.length;
  }

  /**
   * Wait for results
   */
  async waitForResults() {
    await this.waitForCondition(
      async () => {
        const count = await this.getResultCount();
        return count > 0;
      },
      { timeout: 5000 }
    );
  }
}