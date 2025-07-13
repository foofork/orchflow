import { expect } from '@playwright/test';
import { TerminalPage } from '../page-objects/terminal-page';

export interface TerminalAssertions {
  toHaveOutput(expected: string | RegExp): Promise<void>;
  toHaveOutputContaining(substring: string): Promise<void>;
  toHavePrompt(): Promise<void>;
  toBeRunningCommand(): Promise<void>;
  toHaveExitCode(code: number): Promise<void>;
  toHaveDirectory(path: string): Promise<void>;
  toHaveEnvironmentVariable(name: string, value?: string): Promise<void>;
  toHaveCommandInHistory(command: string): Promise<void>;
  toHaveTabCount(count: number): Promise<void>;
  toBeIdle(): Promise<void>;
}

export function createTerminalAssertions(terminal: TerminalPage): TerminalAssertions {
  return {
    async toHaveOutput(expected: string | RegExp): Promise<void> {
      const output = await terminal.getOutput();
      
      if (typeof expected === 'string') {
        expect(output).toContain(expected);
      } else {
        expect(output).toMatch(expected);
      }
    },

    async toHaveOutputContaining(substring: string): Promise<void> {
      const output = await terminal.getOutput();
      expect(output).toContain(substring);
    },

    async toHavePrompt(): Promise<void> {
      const lastLine = await terminal.getLastLine();
      expect(lastLine).toMatch(/[$>#]\s*$/);
    },

    async toBeRunningCommand(): Promise<void> {
      const isRunning = await terminal.isCommandRunning();
      expect(isRunning).toBeTruthy();
    },

    async toHaveExitCode(code: number): Promise<void> {
      await terminal.executeCommand('echo $?');
      await terminal.waitForOutput(code.toString());
      const output = await terminal.getOutput();
      const lines = output.split('\n').filter(line => line.trim());
      const exitCodeLine = lines[lines.length - 1];
      expect(exitCodeLine).toBe(code.toString());
    },

    async toHaveDirectory(path: string): Promise<void> {
      const currentDir = await terminal.getCurrentDirectory();
      expect(currentDir).toBe(path);
    },

    async toHaveEnvironmentVariable(name: string, value?: string): Promise<void> {
      const envVars = await terminal.getEnvironmentVariables();
      
      if (value !== undefined) {
        expect(envVars[name]).toBe(value);
      } else {
        expect(envVars).toHaveProperty(name);
      }
    },

    async toHaveCommandInHistory(command: string): Promise<void> {
      await terminal.executeCommand('history | tail -20');
      await terminal.waitForIdle();
      const output = await terminal.getOutput();
      expect(output).toContain(command);
    },

    async toHaveTabCount(count: number): Promise<void> {
      const tabCount = await terminal.getTabCount();
      expect(tabCount).toBe(count);
    },

    async toBeIdle(): Promise<void> {
      const isRunning = await terminal.isCommandRunning();
      expect(isRunning).toBeFalsy();
    }
  };
}

// Custom matchers
export const terminalMatchers = {
  async toHaveTerminalOutput(
    terminal: TerminalPage,
    expected: string | RegExp
  ): Promise<{ pass: boolean; message: () => string }> {
    const output = await terminal.getOutput();
    const pass = typeof expected === 'string' 
      ? output.includes(expected)
      : expected.test(output);

    return {
      pass,
      message: () => pass
        ? `Expected terminal not to have output matching ${expected}`
        : `Expected terminal to have output matching ${expected}, but got:\n${output}`
    };
  },

  async toHaveTerminalPrompt(
    terminal: TerminalPage
  ): Promise<{ pass: boolean; message: () => string }> {
    const lastLine = await terminal.getLastLine();
    const pass = /[$>#]\s*$/.test(lastLine);

    return {
      pass,
      message: () => pass
        ? `Expected terminal not to have a prompt`
        : `Expected terminal to have a prompt, but last line was: "${lastLine}"`
    };
  },

  async toHaveCommandSucceeded(
    terminal: TerminalPage
  ): Promise<{ pass: boolean; message: () => string }> {
    await terminal.executeCommand('echo $?');
    await terminal.waitForIdle();
    const output = await terminal.getOutput();
    const lines = output.split('\n').filter(line => line.trim());
    const exitCode = lines[lines.length - 1];
    const pass = exitCode === '0';

    return {
      pass,
      message: () => pass
        ? `Expected command to have failed`
        : `Expected command to succeed with exit code 0, but got ${exitCode}`
    };
  },

  async toHaveCommandFailed(
    terminal: TerminalPage
  ): Promise<{ pass: boolean; message: () => string }> {
    await terminal.executeCommand('echo $?');
    await terminal.waitForIdle();
    const output = await terminal.getOutput();
    const lines = output.split('\n').filter(line => line.trim());
    const exitCode = lines[lines.length - 1];
    const pass = exitCode !== '0';

    return {
      pass,
      message: () => pass
        ? `Expected command to have succeeded`
        : `Expected command to fail with non-zero exit code, but got ${exitCode}`
    };
  }
};

// Extend expect with custom matchers
declare global {
  namespace PlaywrightTest {
    interface Matchers<R> {
      toHaveTerminalOutput(expected: string | RegExp): Promise<R>;
      toHaveTerminalPrompt(): Promise<R>;
      toHaveCommandSucceeded(): Promise<R>;
      toHaveCommandFailed(): Promise<R>;
    }
  }
}

// Helper function to assert command output
export async function assertCommandOutput(
  terminal: TerminalPage,
  command: string,
  expectedOutput: string | RegExp,
  options?: {
    timeout?: number;
    ignoreCase?: boolean;
    partial?: boolean;
  }
): Promise<void> {
  await terminal.executeCommandAndWaitForOutput(command, expectedOutput, options?.timeout);
  
  const output = await terminal.getOutput();
  const commandIndex = output.indexOf(command);
  const outputAfterCommand = output.substring(commandIndex + command.length).trim();
  
  if (typeof expectedOutput === 'string') {
    if (options?.ignoreCase) {
      expect(outputAfterCommand.toLowerCase()).toContain(expectedOutput.toLowerCase());
    } else if (options?.partial) {
      expect(outputAfterCommand).toContain(expectedOutput);
    } else {
      const lines = outputAfterCommand.split('\n');
      expect(lines[0]).toBe(expectedOutput);
    }
  } else {
    expect(outputAfterCommand).toMatch(expectedOutput);
  }
}

// Helper function to assert command sequence
export async function assertCommandSequence(
  terminal: TerminalPage,
  commands: Array<{ command: string; expectedOutput?: string | RegExp; shouldSucceed?: boolean }>
): Promise<void> {
  for (const { command, expectedOutput, shouldSucceed } of commands) {
    await terminal.executeCommand(command);
    
    if (expectedOutput) {
      await terminal.waitForOutput(expectedOutput);
    }
    
    if (shouldSucceed !== undefined) {
      await terminal.executeCommand('echo $?');
      await terminal.waitForIdle();
      const output = await terminal.getOutput();
      const lines = output.split('\n').filter(line => line.trim());
      const exitCode = lines[lines.length - 1];
      
      if (shouldSucceed) {
        expect(exitCode).toBe('0');
      } else {
        expect(exitCode).not.toBe('0');
      }
    }
    
    await terminal.waitForPrompt();
  }
}

// Helper function to assert terminal state
export async function assertTerminalState(
  terminal: TerminalPage,
  state: {
    directory?: string;
    environmentVariables?: Record<string, string>;
    tabCount?: number;
    isIdle?: boolean;
  }
): Promise<void> {
  if (state.directory !== undefined) {
    const currentDir = await terminal.getCurrentDirectory();
    expect(currentDir).toBe(state.directory);
  }
  
  if (state.environmentVariables) {
    const envVars = await terminal.getEnvironmentVariables();
    for (const [key, value] of Object.entries(state.environmentVariables)) {
      expect(envVars[key]).toBe(value);
    }
  }
  
  if (state.tabCount !== undefined) {
    const tabCount = await terminal.getTabCount();
    expect(tabCount).toBe(state.tabCount);
  }
  
  if (state.isIdle !== undefined) {
    const isRunning = await terminal.isCommandRunning();
    expect(isRunning).toBe(!state.isIdle);
  }
}