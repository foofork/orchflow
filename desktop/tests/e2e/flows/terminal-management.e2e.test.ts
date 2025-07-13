/**
 * Terminal Management E2E Tests
 * Tests terminal creation, splitting, resizing, and management
 */

import { TestContext } from '../helpers/test-context';
import { TerminalPage } from '../helpers/page-objects/TerminalPage';
import { DashboardPage } from '../helpers/page-objects/DashboardPage';

describe('Terminal Management Flow', () => {
  let testContext: TestContext;
  let terminalPage: TerminalPage;
  let dashboardPage: DashboardPage;

  beforeEach(async () => {
    testContext = new TestContext({
      headless: process.env.CI === 'true',
      trace: true
    });
    await testContext.setup();
    
    const { page, baseUrl } = await testContext.createPage();
    terminalPage = new TerminalPage(page);
    dashboardPage = new DashboardPage(page);
    
    // Login and navigate to terminal
    await page.goto(baseUrl);
    // Assume already authenticated for terminal tests
    await terminalPage.navigateToTerminal();
  });

  afterEach(async () => {
    await testContext.captureState('terminal-flow');
    await testContext.teardown();
  });

  describe('Terminal Creation', () => {
    test('should create a new terminal', async () => {
      // Act
      const terminalId = await terminalPage.createNewTerminal();

      // Assert
      expect(terminalId).toBeTruthy();
      expect(terminalId).not.toBeNull();
      expect(await terminalPage.isTerminalActive(terminalId!)).toBe(true);
      expect(await terminalPage.getTerminalCount()).toBe(1);
    });

    test('should create multiple terminals', async () => {
      // Act
      const terminal1 = await terminalPage.createNewTerminal();
      const terminal2 = await terminalPage.createNewTerminal();
      const terminal3 = await terminalPage.createNewTerminal();

      // Assert
      expect(await terminalPage.getTerminalCount()).toBe(3);
      expect(terminal3).not.toBeNull();
      expect(await terminalPage.isTerminalActive(terminal3!)).toBe(true);
      
      // Verify tab switching
      expect(terminal1).not.toBeNull();
      await terminalPage.switchToTerminal(terminal1!);
      expect(await terminalPage.isTerminalActive(terminal1!)).toBe(true);
    });

    test('should set custom terminal titles', async () => {
      // Arrange
      const customTitle = 'Development Server';
      
      // Act
      const terminalId = await terminalPage.createNewTerminal();
      expect(terminalId).not.toBeNull();
      await terminalPage.setTerminalTitle(terminalId!, customTitle);

      // Assert
      expect(await terminalPage.getTerminalTitle(terminalId!)).toBe(customTitle);
    });

    test('should handle terminal creation limits', async () => {
      // Act - Create maximum allowed terminals
      const maxTerminals = 10;
      const terminals = [];
      
      for (let i = 0; i < maxTerminals; i++) {
        terminals.push(await terminalPage.createNewTerminal());
      }

      // Try to create one more
      const extraTerminal = await terminalPage.createNewTerminal();

      // Assert
      expect(extraTerminal).toBeNull();
      const notification = await terminalPage.getNotification();
      expect(notification).toContain('Maximum terminals reached');
    });
  });

  describe('Terminal Splitting', () => {
    test('should split terminal horizontally', async () => {
      // Arrange
      const terminal1 = await terminalPage.createNewTerminal();
      expect(terminal1).not.toBeNull();

      // Act
      const terminal2 = await terminalPage.splitTerminal(terminal1!, 'horizontal');

      // Assert
      expect(terminal2).toBeTruthy();
      expect(terminal2).not.toBeNull();
      expect(await terminalPage.areTerminalsSplit(terminal1!, terminal2!)).toBe(true);
      expect(await terminalPage.getSplitDirection(terminal1!, terminal2!)).toBe('horizontal');
    });

    test('should split terminal vertically', async () => {
      // Arrange
      const terminal1 = await terminalPage.createNewTerminal();
      expect(terminal1).not.toBeNull();

      // Act
      const terminal2 = await terminalPage.splitTerminal(terminal1!, 'vertical');

      // Assert
      expect(terminal2).toBeTruthy();
      expect(terminal2).not.toBeNull();
      expect(await terminalPage.areTerminalsSplit(terminal1!, terminal2!)).toBe(true);
      expect(await terminalPage.getSplitDirection(terminal1!, terminal2!)).toBe('vertical');
    });

    test('should support nested splits', async () => {
      // Arrange
      const terminal1 = await terminalPage.createNewTerminal();
      expect(terminal1).not.toBeNull();
      
      // Act - Create complex split layout
      const terminal2 = await terminalPage.splitTerminal(terminal1!, 'horizontal');
      expect(terminal2).not.toBeNull();
      const terminal3 = await terminalPage.splitTerminal(terminal2!, 'vertical');
      expect(terminal3).not.toBeNull();
      const terminal4 = await terminalPage.splitTerminal(terminal1!, 'vertical');

      // Assert
      expect(await terminalPage.getTerminalCount()).toBe(4);
      expect(await terminalPage.getLayoutComplexity()).toBeGreaterThan(1);
    });

    test('should resize split panels', async () => {
      // Arrange
      const terminal1 = await terminalPage.createNewTerminal();
      expect(terminal1).not.toBeNull();
      const terminal2 = await terminalPage.splitTerminal(terminal1!, 'horizontal');
      expect(terminal2).not.toBeNull();

      // Act
      await terminalPage.resizeSplitPanel(terminal1!, terminal2!, 70); // 70% for terminal1

      // Assert
      const sizes = await terminalPage.getSplitSizes(terminal1!, terminal2!);
      expect(sizes.panel1).toBeCloseTo(70, 1);
      expect(sizes.panel2).toBeCloseTo(30, 1);
    });
  });

  describe('Terminal Operations', () => {
    test('should execute commands', async () => {
      // Arrange
      const terminalId = await terminalPage.createNewTerminal();
      expect(terminalId).not.toBeNull();

      // Act
      await terminalPage.executeCommand(terminalId!, 'echo "Hello World"');

      // Assert
      const output = await terminalPage.getTerminalOutput(terminalId!);
      expect(output).toContain('Hello World');
    });

    test('should clear terminal output', async () => {
      // Arrange
      const terminalId = await terminalPage.createNewTerminal();
      expect(terminalId).not.toBeNull();
      await terminalPage.executeCommand(terminalId!, 'echo "Test output"');

      // Act
      await terminalPage.clearTerminal(terminalId!);

      // Assert
      const output = await terminalPage.getTerminalOutput(terminalId!);
      expect(output.trim()).toBe('');
    });

    test('should copy terminal output', async () => {
      // Arrange
      const terminalId = await terminalPage.createNewTerminal();
      expect(terminalId).not.toBeNull();
      await terminalPage.executeCommand(terminalId!, 'echo "Copy this text"');

      // Act
      await terminalPage.selectAllOutput(terminalId!);
      await terminalPage.copySelection();

      // Assert
      const clipboard = await terminalPage.getClipboardContent();
      expect(clipboard).toContain('Copy this text');
    });

    test('should paste into terminal', async () => {
      // Arrange
      const terminalId = await terminalPage.createNewTerminal();
      expect(terminalId).not.toBeNull();
      const textToPaste = 'ls -la';

      // Act
      await terminalPage.setClipboardContent(textToPaste);
      await terminalPage.pasteIntoTerminal(terminalId!);

      // Assert
      const currentInput = await terminalPage.getCurrentInput(terminalId!);
      expect(currentInput).toBe(textToPaste);
    });

    test('should handle terminal scrolling', async () => {
      // Arrange
      const terminalId = await terminalPage.createNewTerminal();
      expect(terminalId).not.toBeNull();
      
      // Generate long output
      for (let i = 0; i < 100; i++) {
        await terminalPage.executeCommand(terminalId!, `echo "Line ${i}"`);
      }

      // Act
      await terminalPage.scrollToBottom(terminalId!);
      const bottomVisible = await terminalPage.isTextVisible(terminalId!, 'Line 99');
      
      await terminalPage.scrollToTop(terminalId!);
      const topVisible = await terminalPage.isTextVisible(terminalId!, 'Line 0');

      // Assert
      expect(bottomVisible).toBe(true);
      expect(topVisible).toBe(true);
    });
  });

  describe('Terminal Closing', () => {
    test('should close terminal with confirmation', async () => {
      // Arrange
      const terminalId = await terminalPage.createNewTerminal();
      expect(terminalId).not.toBeNull();
      await terminalPage.executeCommand(terminalId!, 'sleep 1000'); // Long running process

      // Act
      await terminalPage.closeTerminal(terminalId!);

      // Assert
      expect(await terminalPage.isConfirmationDialogVisible()).toBe(true);
      await terminalPage.confirmDialog();
      expect(await terminalPage.isTerminalExists(terminalId!)).toBe(false);
    });

    test('should close terminal without confirmation when idle', async () => {
      // Arrange
      const terminalId = await terminalPage.createNewTerminal();
      expect(terminalId).not.toBeNull();

      // Act
      await terminalPage.closeTerminal(terminalId!);

      // Assert
      expect(await terminalPage.isTerminalExists(terminalId!)).toBe(false);
      expect(await terminalPage.getTerminalCount()).toBe(0);
    });

    test('should close all terminals', async () => {
      // Arrange
      await terminalPage.createNewTerminal();
      await terminalPage.createNewTerminal();
      await terminalPage.createNewTerminal();

      // Act
      await terminalPage.closeAllTerminals();

      // Assert
      expect(await terminalPage.getTerminalCount()).toBe(0);
    });

    test('should restore closed terminal', async () => {
      // Arrange
      const terminalId = await terminalPage.createNewTerminal();
      expect(terminalId).not.toBeNull();
      const title = 'Important Terminal';
      await terminalPage.setTerminalTitle(terminalId!, title);
      await terminalPage.executeCommand(terminalId!, 'echo "Important work"');

      // Act
      await terminalPage.closeTerminal(terminalId!);
      const restoredId = await terminalPage.restoreLastClosedTerminal();

      // Assert
      expect(restoredId).toBeTruthy();
      expect(restoredId).not.toBeNull();
      expect(await terminalPage.getTerminalTitle(restoredId!)).toBe(title);
      const output = await terminalPage.getTerminalOutput(restoredId!);
      expect(output).toContain('Important work');
    });
  });

  describe('Terminal Settings', () => {
    test('should change terminal font size', async () => {
      // Arrange
      const terminalId = await terminalPage.createNewTerminal();
      expect(terminalId).not.toBeNull();

      // Act
      await terminalPage.openTerminalSettings();
      await terminalPage.setFontSize(16);
      await terminalPage.applySettings();

      // Assert
      const fontSize = await terminalPage.getTerminalFontSize(terminalId!);
      expect(fontSize).toBe(16);
    });

    test('should change terminal theme', async () => {
      // Arrange
      const terminalId = await terminalPage.createNewTerminal();
      expect(terminalId).not.toBeNull();

      // Act
      await terminalPage.openTerminalSettings();
      await terminalPage.selectTheme('solarized-dark');
      await terminalPage.applySettings();

      // Assert
      const theme = await terminalPage.getTerminalTheme(terminalId!);
      expect(theme).toBe('solarized-dark');
    });

    test('should configure shell', async () => {
      // Act
      await terminalPage.openTerminalSettings();
      await terminalPage.setDefaultShell('/bin/zsh');
      await terminalPage.applySettings();
      
      const terminalId = await terminalPage.createNewTerminal();
      expect(terminalId).not.toBeNull();

      // Assert
      const shell = await terminalPage.getTerminalShell(terminalId!);
      expect(shell).toBe('/bin/zsh');
    });
  });

  describe('Terminal Search', () => {
    test('should search within terminal output', async () => {
      // Arrange
      const terminalId = await terminalPage.createNewTerminal();
      expect(terminalId).not.toBeNull();
      await terminalPage.executeCommand(terminalId!, 'echo "Find this text"');
      await terminalPage.executeCommand(terminalId!, 'echo "Other output"');
      await terminalPage.executeCommand(terminalId!, 'echo "Find this too"');

      // Act
      await terminalPage.openSearch(terminalId!);
      const matches = await terminalPage.searchInTerminal('Find this');

      // Assert
      expect(matches.total).toBe(2);
      expect(matches.current).toBe(1);
    });

    test('should navigate search results', async () => {
      // Arrange
      const terminalId = await terminalPage.createNewTerminal();
      expect(terminalId).not.toBeNull();
      await terminalPage.executeCommand(terminalId!, 'echo "match 1"');
      await terminalPage.executeCommand(terminalId!, 'echo "match 2"');

      // Act
      await terminalPage.openSearch(terminalId!);
      await terminalPage.searchInTerminal('match');
      
      const firstMatch = await terminalPage.getCurrentSearchMatch();
      await terminalPage.nextSearchResult();
      const secondMatch = await terminalPage.getCurrentSearchMatch();

      // Assert
      expect(firstMatch).toBe(1);
      expect(secondMatch).toBe(2);
    });
  });

  describe('Performance', () => {
    test('should handle large output efficiently', async () => {
      // Arrange
      const terminalId = await terminalPage.createNewTerminal();
      expect(terminalId).not.toBeNull();
      const startTime = Date.now();

      // Act - Generate large output
      await terminalPage.executeCommand(terminalId!, 'seq 1 10000');

      // Assert
      const renderTime = Date.now() - startTime;
      expect(renderTime).toBeLessThan(5000); // Should render within 5 seconds
      
      // Terminal should remain responsive
      await terminalPage.executeCommand(terminalId!, 'echo "Still responsive"');
      const output = await terminalPage.getTerminalOutput(terminalId!);
      expect(output).toContain('Still responsive');
    });

    test('should handle rapid terminal creation', async () => {
      // Act - Create terminals rapidly
      const terminals = [];
      const startTime = Date.now();
      
      for (let i = 0; i < 5; i++) {
        terminals.push(await terminalPage.createNewTerminal());
      }

      // Assert
      const creationTime = Date.now() - startTime;
      expect(creationTime).toBeLessThan(3000); // 5 terminals in 3 seconds
      expect(terminals.every(t => t !== null)).toBe(true);
    });
  });
});