import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

export class TerminalPage {
  private page: Page;
  private terminalContainer: Locator;
  private terminalInput: Locator;
  private terminalOutput: Locator;
  private activeTerminal: Locator;
  private tabsList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.terminalContainer = page.locator('[data-testid="terminal-container"]');
    this.terminalInput = page.locator('[data-testid="terminal-input"], .xterm-helper-textarea');
    this.terminalOutput = page.locator('[data-testid="terminal-output"], .xterm-screen');
    this.activeTerminal = page.locator('[data-testid="terminal-active"], .terminal-tab.active');
    this.tabsList = page.locator('[data-testid="terminal-tabs"]');
  }

  async waitForReady(): Promise<void> {
    await this.terminalContainer.waitFor({ state: 'visible' });
    await this.page.waitForTimeout(500); // Allow terminal to fully initialize
  }

  async executeCommand(command: string): Promise<void> {
    await this.terminalInput.click();
    await this.terminalInput.type(command);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(100); // Small delay for command execution
  }

  async executeCommandAndWaitForOutput(command: string, expectedOutput: string | RegExp, timeout = 5000): Promise<void> {
    await this.executeCommand(command);
    await this.waitForOutput(expectedOutput, timeout);
  }

  async waitForOutput(expectedOutput: string | RegExp, timeout = 5000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const output = await this.getOutput();
      
      if (typeof expectedOutput === 'string') {
        if (output.includes(expectedOutput)) return;
      } else {
        if (expectedOutput.test(output)) return;
      }
      
      await this.page.waitForTimeout(100);
    }
    
    throw new Error(`Timeout waiting for output: ${expectedOutput}`);
  }

  async getOutput(): Promise<string> {
    const outputElements = await this.terminalOutput.locator('.xterm-rows, [data-testid="terminal-line"]').all();
    const lines: string[] = [];
    
    for (const element of outputElements) {
      const text = await element.textContent();
      if (text) lines.push(text.trim());
    }
    
    return lines.join('\n');
  }

  async getLastLine(): Promise<string> {
    const output = await this.getOutput();
    const lines = output.split('\n').filter(line => line.trim());
    return lines[lines.length - 1] || '';
  }

  async clear(): Promise<void> {
    await this.executeCommand('clear');
    await this.page.waitForTimeout(100);
  }

  async createNewTab(): Promise<void> {
    const newTabButton = this.page.locator('[data-testid="terminal-new-tab"], .terminal-new-tab');
    await newTabButton.click();
    await this.waitForReady();
  }

  async switchToTab(index: number): Promise<void> {
    const tabs = await this.tabsList.locator('[data-testid^="terminal-tab-"]').all();
    if (index < tabs.length) {
      await tabs[index].click();
      await this.page.waitForTimeout(100);
    }
  }

  async closeTab(index: number): Promise<void> {
    const tabs = await this.tabsList.locator('[data-testid^="terminal-tab-"]').all();
    if (index < tabs.length) {
      const closeButton = tabs[index].locator('[data-testid="terminal-tab-close"]');
      await closeButton.click();
      await this.page.waitForTimeout(100);
    }
  }

  async getTabCount(): Promise<number> {
    const tabs = await this.tabsList.locator('[data-testid^="terminal-tab-"]').all();
    return tabs.length;
  }

  async getCurrentDirectory(): Promise<string> {
    await this.executeCommand('pwd');
    await this.page.waitForTimeout(200);
    const output = await this.getOutput();
    const lines = output.split('\n').filter(line => line.trim());
    
    // Find the line after 'pwd' command
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('pwd') && i + 1 < lines.length) {
        return lines[i + 1].trim();
      }
    }
    
    return '';
  }

  async waitForPrompt(timeout = 5000): Promise<void> {
    await this.waitForOutput(/[$>#]\s*$/, timeout);
  }

  async isCommandRunning(): Promise<boolean> {
    const lastLine = await this.getLastLine();
    return !lastLine.match(/[$>#]\s*$/);
  }

  async killCurrentProcess(): Promise<void> {
    await this.page.keyboard.press('Control+C');
    await this.waitForPrompt();
  }

  async scrollToBottom(): Promise<void> {
    await this.terminalOutput.evaluate(el => {
      el.scrollTop = el.scrollHeight;
    });
  }

  async scrollToTop(): Promise<void> {
    await this.terminalOutput.evaluate(el => {
      el.scrollTop = 0;
    });
  }

  async searchInOutput(searchTerm: string): Promise<boolean> {
    const output = await this.getOutput();
    return output.includes(searchTerm);
  }

  async copySelection(): Promise<void> {
    await this.page.keyboard.press('Control+C');
  }

  async pasteFromClipboard(): Promise<void> {
    await this.page.keyboard.press('Control+V');
  }

  async selectAll(): Promise<void> {
    await this.page.keyboard.press('Control+A');
  }

  async getSelectedText(): Promise<string> {
    return await this.page.evaluate(() => window.getSelection()?.toString() || '');
  }

  async resizeTerminal(width: number, height: number): Promise<void> {
    await this.terminalContainer.evaluate((el, { w, h }) => {
      (el as HTMLElement).style.width = `${w}px`;
      (el as HTMLElement).style.height = `${h}px`;
    }, { w: width, h: height });
    
    await this.page.waitForTimeout(100); // Allow terminal to adjust
  }

  async getTerminalSize(): Promise<{ width: number; height: number }> {
    return await this.terminalContainer.evaluate(el => ({
      width: (el as HTMLElement).offsetWidth,
      height: (el as HTMLElement).offsetHeight
    }));
  }

  async typeText(text: string, delay = 50): Promise<void> {
    await this.terminalInput.click();
    for (const char of text) {
      await this.page.keyboard.type(char);
      await this.page.waitForTimeout(delay);
    }
  }

  async sendKey(key: string): Promise<void> {
    await this.terminalInput.click();
    await this.page.keyboard.press(key);
  }

  async getTerminalTheme(): Promise<string> {
    return await this.terminalContainer.getAttribute('data-theme') || 'default';
  }

  async setTerminalTheme(theme: string): Promise<void> {
    await this.page.evaluate(theme => {
      // This would interact with your app's theme API
      (window as any).terminalAPI?.setTheme(theme);
    }, theme);
  }

  async takeScreenshot(path?: string): Promise<Buffer> {
    return await this.terminalContainer.screenshot({ path });
  }

  async getColoredOutput(): Promise<Array<{ text: string; color?: string }>> {
    return await this.terminalOutput.evaluate(el => {
      const spans = el.querySelectorAll('span');
      return Array.from(spans).map(span => ({
        text: span.textContent || '',
        color: span.style.color || span.className
      }));
    });
  }

  async waitForIdle(timeout = 1000): Promise<void> {
    const startTime = Date.now();
    let lastOutput = await this.getOutput();
    
    while (Date.now() - startTime < timeout) {
      await this.page.waitForTimeout(100);
      const currentOutput = await this.getOutput();
      
      if (currentOutput === lastOutput) {
        await this.page.waitForTimeout(200); // Extra wait to ensure idle
        return;
      }
      
      lastOutput = currentOutput;
    }
  }

  async getEnvironmentVariables(): Promise<Record<string, string>> {
    await this.executeCommand('env');
    await this.waitForIdle();
    
    const output = await this.getOutput();
    const lines = output.split('\n').filter(line => line.includes('='));
    const env: Record<string, string> = {};
    
    for (const line of lines) {
      const [key, ...valueParts] = line.split('=');
      if (key && !key.includes('env')) { // Skip the 'env' command itself
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
    
    return env;
  }

  async setEnvironmentVariable(key: string, value: string): Promise<void> {
    await this.executeCommand(`export ${key}="${value}"`);
  }

  async assertCommandSuccess(command: string): Promise<void> {
    await this.executeCommand(command);
    await this.executeCommand('echo $?');
    await this.waitForOutput('0');
  }

  async assertCommandFailure(command: string): Promise<void> {
    await this.executeCommand(command);
    await this.executeCommand('echo $?');
    const output = await this.getOutput();
    const exitCode = output.match(/\n(\d+)\s*$/)?.[1];
    
    if (exitCode === '0') {
      throw new Error(`Expected command to fail but it succeeded: ${command}`);
    }
  }
}