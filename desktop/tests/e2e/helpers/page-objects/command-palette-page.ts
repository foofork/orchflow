import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

export class CommandPalettePage {
  private page: Page;
  private commandPalette: Locator;
  private searchInput: Locator;
  private commandList: Locator;
  private commandItems: Locator;
  private selectedCommand: Locator;
  private commandDescription: Locator;
  private quickPickList: Locator;
  private quickPickItems: Locator;

  constructor(page: Page) {
    this.page = page;
    this.commandPalette = page.locator('[data-testid="command-palette"]');
    this.searchInput = page.locator('[data-testid="command-palette-input"]');
    this.commandList = page.locator('[data-testid="command-list"]');
    this.commandItems = page.locator('[data-testid^="command-item-"]');
    this.selectedCommand = page.locator('[data-testid="command-item-selected"]');
    this.commandDescription = page.locator('[data-testid="command-description"]');
    this.quickPickList = page.locator('[data-testid="quick-pick-list"]');
    this.quickPickItems = page.locator('[data-testid^="quick-pick-item-"]');
  }

  async open(): Promise<void> {
    await this.page.keyboard.press('Control+Shift+P');
    await this.commandPalette.waitFor({ state: 'visible' });
    await this.searchInput.waitFor({ state: 'visible' });
  }

  async openWithPrefix(prefix: string): Promise<void> {
    await this.open();
    await this.searchInput.fill(prefix);
  }

  async close(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await this.commandPalette.waitFor({ state: 'hidden' });
  }

  async searchCommand(query: string): Promise<void> {
    await this.searchInput.clear();
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(100); // Allow search to filter results
  }

  async executeCommand(commandName: string): Promise<void> {
    await this.searchCommand(commandName);
    
    const command = this.commandItems.filter({ hasText: commandName }).first();
    await command.click();
    
    // Wait for command to execute
    await this.page.waitForTimeout(200);
  }

  async executeCommandByKeyboard(commandName: string): Promise<void> {
    await this.searchCommand(commandName);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(200);
  }

  async selectCommand(index: number): Promise<void> {
    for (let i = 0; i < index; i++) {
      await this.page.keyboard.press('ArrowDown');
    }
  }

  async getVisibleCommands(): Promise<string[]> {
    const commands = await this.commandItems.all();
    const commandNames: string[] = [];
    
    for (const command of commands) {
      const name = await command.locator('[data-testid="command-name"]').textContent();
      if (name) commandNames.push(name.trim());
    }
    
    return commandNames;
  }

  async getSelectedCommandName(): Promise<string> {
    return await this.selectedCommand.locator('[data-testid="command-name"]').textContent() || '';
  }

  async getSelectedCommandDescription(): Promise<string> {
    return await this.selectedCommand.locator('[data-testid="command-description"]').textContent() || '';
  }

  async isCommandVisible(commandName: string): Promise<boolean> {
    const commands = await this.getVisibleCommands();
    return commands.includes(commandName);
  }

  async getCommandCount(): Promise<number> {
    const commands = await this.commandItems.all();
    return commands.length;
  }

  async clearInput(): Promise<void> {
    await this.searchInput.clear();
  }

  async navigateUp(): Promise<void> {
    await this.page.keyboard.press('ArrowUp');
  }

  async navigateDown(): Promise<void> {
    await this.page.keyboard.press('ArrowDown');
  }

  async navigateToFirst(): Promise<void> {
    await this.page.keyboard.press('Home');
  }

  async navigateToLast(): Promise<void> {
    await this.page.keyboard.press('End');
  }

  async getRecentCommands(): Promise<string[]> {
    const recentSection = this.commandList.locator('[data-testid="recent-commands"]');
    
    if (await recentSection.isVisible()) {
      const items = await recentSection.locator('[data-testid^="command-item-"]').all();
      const commands: string[] = [];
      
      for (const item of items) {
        const name = await item.locator('[data-testid="command-name"]').textContent();
        if (name) commands.push(name.trim());
      }
      
      return commands;
    }
    
    return [];
  }

  async getCommandCategories(): Promise<string[]> {
    const categories = await this.commandList.locator('[data-testid^="category-"]').all();
    const categoryNames: string[] = [];
    
    for (const category of categories) {
      const name = await category.getAttribute('data-category-name');
      if (name) categoryNames.push(name);
    }
    
    return categoryNames;
  }

  async filterByCategory(category: string): Promise<void> {
    const categoryPrefix = this.getCategoryPrefix(category);
    await this.searchInput.fill(categoryPrefix);
  }

  private getCategoryPrefix(category: string): string {
    const prefixes: Record<string, string> = {
      'files': '>',
      'symbols': '@',
      'commands': '>',
      'go to line': ':',
      'debug': 'debug ',
      'task': 'task ',
      'view': 'view:',
      'help': '?'
    };
    
    return prefixes[category.toLowerCase()] || '>';
  }

  async openQuickOpen(): Promise<void> {
    await this.page.keyboard.press('Control+P');
    await this.commandPalette.waitFor({ state: 'visible' });
  }

  async openGoToLine(): Promise<void> {
    await this.page.keyboard.press('Control+G');
    await this.commandPalette.waitFor({ state: 'visible' });
  }

  async openGoToSymbol(): Promise<void> {
    await this.page.keyboard.press('Control+Shift+O');
    await this.commandPalette.waitFor({ state: 'visible' });
  }

  async goToLine(lineNumber: number): Promise<void> {
    await this.openGoToLine();
    await this.searchInput.fill(lineNumber.toString());
    await this.page.keyboard.press('Enter');
  }

  async selectQuickPickItem(itemText: string): Promise<void> {
    const item = this.quickPickItems.filter({ hasText: itemText }).first();
    await item.click();
  }

  async getQuickPickItems(): Promise<string[]> {
    const items = await this.quickPickItems.all();
    const itemTexts: string[] = [];
    
    for (const item of items) {
      const text = await item.textContent();
      if (text) itemTexts.push(text.trim());
    }
    
    return itemTexts;
  }

  async waitForQuickPick(): Promise<void> {
    await this.quickPickList.waitFor({ state: 'visible' });
  }

  async selectMultipleQuickPickItems(items: string[]): Promise<void> {
    for (const itemText of items) {
      const item = this.quickPickItems.filter({ hasText: itemText }).first();
      const checkbox = item.locator('[data-testid="quick-pick-checkbox"]');
      await checkbox.click();
    }
    
    await this.page.keyboard.press('Enter');
  }

  async acceptQuickPick(): Promise<void> {
    await this.page.keyboard.press('Enter');
  }

  async cancelQuickPick(): Promise<void> {
    await this.page.keyboard.press('Escape');
  }

  async typeInQuickInput(text: string): Promise<void> {
    await this.searchInput.fill(text);
  }

  async getQuickInputValue(): Promise<string> {
    return await this.searchInput.inputValue();
  }

  async getQuickInputPlaceholder(): Promise<string> {
    return await this.searchInput.getAttribute('placeholder') || '';
  }

  async isValidationMessageVisible(): Promise<boolean> {
    const validationMessage = this.commandPalette.locator('[data-testid="validation-message"]');
    return await validationMessage.isVisible();
  }

  async getValidationMessage(): Promise<string> {
    const validationMessage = this.commandPalette.locator('[data-testid="validation-message"]');
    return await validationMessage.textContent() || '';
  }

  async waitForCommandExecution(timeout = 5000): Promise<void> {
    const spinner = this.commandPalette.locator('[data-testid="command-spinner"]');
    
    try {
      await spinner.waitFor({ state: 'visible', timeout: 1000 });
      await spinner.waitFor({ state: 'hidden', timeout });
    } catch {
      // Command executed quickly or no spinner shown
    }
  }

  async getCommandHistory(): Promise<string[]> {
    // Open command history
    await this.open();
    await this.page.keyboard.press('ArrowUp');
    
    const history: string[] = [];
    let lastValue = '';
    
    for (let i = 0; i < 10; i++) {
      const value = await this.searchInput.inputValue();
      
      if (value && value !== lastValue) {
        history.push(value);
        lastValue = value;
      } else {
        break;
      }
      
      await this.page.keyboard.press('ArrowUp');
    }
    
    await this.close();
    return history;
  }

  async hasKeybindingHint(commandName: string): Promise<boolean> {
    const command = this.commandItems.filter({ hasText: commandName }).first();
    const keybinding = command.locator('[data-testid="command-keybinding"]');
    return await keybinding.isVisible();
  }

  async getKeybindingHint(commandName: string): Promise<string> {
    const command = this.commandItems.filter({ hasText: commandName }).first();
    const keybinding = command.locator('[data-testid="command-keybinding"]');
    return await keybinding.textContent() || '';
  }

  async executeQuickAction(action: string, ...args: string[]): Promise<void> {
    await this.open();
    await this.searchInput.fill(`${action} ${args.join(' ')}`);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(200);
  }

  async isLoading(): Promise<boolean> {
    const loadingIndicator = this.commandPalette.locator('[data-testid="loading-indicator"]');
    return await loadingIndicator.isVisible();
  }

  async waitForLoading(): Promise<void> {
    const loadingIndicator = this.commandPalette.locator('[data-testid="loading-indicator"]');
    
    try {
      await loadingIndicator.waitFor({ state: 'visible', timeout: 1000 });
      await loadingIndicator.waitFor({ state: 'hidden', timeout: 5000 });
    } catch {
      // Not loading or already loaded
    }
  }

  async getNoResultsMessage(): Promise<string> {
    const noResults = this.commandPalette.locator('[data-testid="no-results"]');
    
    if (await noResults.isVisible()) {
      return await noResults.textContent() || '';
    }
    
    return '';
  }

  async isOpen(): Promise<boolean> {
    return await this.commandPalette.isVisible();
  }

  async toggleCommandPalette(): Promise<void> {
    if (await this.isOpen()) {
      await this.close();
    } else {
      await this.open();
    }
  }

  async getInputMode(): Promise<string> {
    const mode = await this.searchInput.getAttribute('data-mode');
    return mode || 'command';
  }

  async switchToFileMode(): Promise<void> {
    await this.open();
    await this.searchInput.clear();
    await this.page.keyboard.press('Backspace'); // Clear any prefix
  }

  async switchToSymbolMode(): Promise<void> {
    await this.open();
    await this.searchInput.fill('@');
  }

  async switchToCommandMode(): Promise<void> {
    await this.open();
    await this.searchInput.fill('>');
  }

  async switchToLineMode(): Promise<void> {
    await this.open();
    await this.searchInput.fill(':');
  }

  async getPrefixIcon(): Promise<string> {
    const icon = this.commandPalette.locator('[data-testid="prefix-icon"]');
    return await icon.getAttribute('data-icon') || '';
  }
}