/**
 * Test Data Builders for E2E Tests
 * Provides fluent builders for creating test data
 */

import type { FlowData, FlowStep } from './page-objects/FlowPage';

/**
 * Flow Builder for creating test flows
 */
export class FlowBuilder {
  private flow: FlowData = {
    name: `Test Flow ${Date.now()}`,
    description: '',
    steps: [],
    tags: []
  };
  
  withName(name: string): FlowBuilder {
    this.flow.name = name;
    return this;
  }
  
  withDescription(description: string): FlowBuilder {
    this.flow.description = description;
    return this;
  }
  
  withTag(tag: string): FlowBuilder {
    this.flow.tags = this.flow.tags || [];
    this.flow.tags.push(tag);
    return this;
  }
  
  withTags(tags: string[]): FlowBuilder {
    this.flow.tags = tags;
    return this;
  }
  
  withCommandStep(command: string, options?: Partial<FlowStep>): FlowBuilder {
    this.flow.steps = this.flow.steps || [];
    this.flow.steps.push({
      type: 'command',
      command,
      timeout: 30000,
      continueOnError: false,
      ...options
    });
    return this;
  }
  
  withScriptStep(script: string, options?: Partial<FlowStep>): FlowBuilder {
    this.flow.steps = this.flow.steps || [];
    this.flow.steps.push({
      type: 'script',
      script,
      timeout: 30000,
      continueOnError: false,
      ...options
    });
    return this;
  }
  
  withFlowStep(flowId: string, options?: Partial<FlowStep>): FlowBuilder {
    this.flow.steps = this.flow.steps || [];
    this.flow.steps.push({
      type: 'flow',
      flowId,
      timeout: 60000,
      continueOnError: false,
      ...options
    });
    return this;
  }
  
  withSteps(steps: FlowStep[]): FlowBuilder {
    this.flow.steps = steps;
    return this;
  }
  
  build(): FlowData {
    return { ...this.flow };
  }
  
  /**
   * Create a simple echo flow
   */
  static createEchoFlow(message: string): FlowData {
    return new FlowBuilder()
      .withName(`Echo Flow - ${message}`)
      .withDescription('A simple flow that echoes a message')
      .withCommandStep(`echo "${message}"`)
      .withTag('test')
      .withTag('echo')
      .build();
  }
  
  /**
   * Create a multi-step flow
   */
  static createMultiStepFlow(stepCount: number): FlowData {
    const builder = new FlowBuilder()
      .withName(`Multi-Step Flow (${stepCount} steps)`)
      .withDescription(`A flow with ${stepCount} sequential steps`)
      .withTag('test')
      .withTag('multi-step');
    
    for (let i = 1; i <= stepCount; i++) {
      builder.withCommandStep(`echo "Step ${i} of ${stepCount}"`);
    }
    
    return builder.build();
  }
  
  /**
   * Create a flow with error handling
   */
  static createErrorHandlingFlow(): FlowData {
    return new FlowBuilder()
      .withName('Error Handling Flow')
      .withDescription('Tests error handling and continue on error')
      .withCommandStep('echo "Starting flow"')
      .withCommandStep('exit 1', { continueOnError: true })
      .withCommandStep('echo "This should still run"')
      .withTag('test')
      .withTag('error-handling')
      .build();
  }
  
  /**
   * Create a flow with timeouts
   */
  static createTimeoutFlow(): FlowData {
    return new FlowBuilder()
      .withName('Timeout Test Flow')
      .withDescription('Tests timeout handling')
      .withCommandStep('echo "Quick command"', { timeout: 1000 })
      .withCommandStep('sleep 2', { timeout: 1000, continueOnError: true })
      .withCommandStep('echo "After timeout"')
      .withTag('test')
      .withTag('timeout')
      .build();
  }
}

/**
 * User Builder for creating test users
 */
export class UserBuilder {
  private user = {
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    password: 'TestPassword123!',
    role: 'user',
    settings: {}
  };
  
  withUsername(username: string): UserBuilder {
    this.user.username = username;
    return this;
  }
  
  withEmail(email: string): UserBuilder {
    this.user.email = email;
    return this;
  }
  
  withPassword(password: string): UserBuilder {
    this.user.password = password;
    return this;
  }
  
  withRole(role: 'user' | 'admin' | 'viewer'): UserBuilder {
    this.user.role = role;
    return this;
  }
  
  withSetting(key: string, value: any): UserBuilder {
    this.user.settings[key] = value;
    return this;
  }
  
  build() {
    return { ...this.user };
  }
  
  /**
   * Create a default test user
   */
  static createDefaultUser() {
    return new UserBuilder().build();
  }
  
  /**
   * Create an admin user
   */
  static createAdminUser() {
    return new UserBuilder()
      .withUsername('admin_test')
      .withEmail('admin@test.com')
      .withRole('admin')
      .build();
  }
}

/**
 * Settings Builder for creating test settings
 */
export class SettingsBuilder {
  private settings = {
    theme: 'light',
    language: 'en',
    notifications: true,
    autoSave: true,
    fontSize: 14,
    tabSize: 2,
    wordWrap: true,
    lineNumbers: true,
    minimap: false,
    terminal: {
      fontSize: 12,
      fontFamily: 'monospace',
      cursorStyle: 'block',
      scrollback: 1000
    },
    editor: {
      theme: 'vs-dark',
      formatOnSave: true,
      formatOnPaste: false,
      autoCloseBrackets: true
    }
  };
  
  withTheme(theme: 'light' | 'dark' | 'auto'): SettingsBuilder {
    this.settings.theme = theme;
    return this;
  }
  
  withLanguage(language: string): SettingsBuilder {
    this.settings.language = language;
    return this;
  }
  
  withNotifications(enabled: boolean): SettingsBuilder {
    this.settings.notifications = enabled;
    return this;
  }
  
  withAutoSave(enabled: boolean): SettingsBuilder {
    this.settings.autoSave = enabled;
    return this;
  }
  
  withFontSize(size: number): SettingsBuilder {
    this.settings.fontSize = size;
    return this;
  }
  
  withTerminalSettings(settings: Partial<typeof this.settings.terminal>): SettingsBuilder {
    this.settings.terminal = { ...this.settings.terminal, ...settings };
    return this;
  }
  
  withEditorSettings(settings: Partial<typeof this.settings.editor>): SettingsBuilder {
    this.settings.editor = { ...this.settings.editor, ...settings };
    return this;
  }
  
  build() {
    return { ...this.settings };
  }
  
  /**
   * Create dark theme settings
   */
  static createDarkThemeSettings() {
    return new SettingsBuilder()
      .withTheme('dark')
      .withEditorSettings({ theme: 'vs-dark' })
      .build();
  }
  
  /**
   * Create minimal settings
   */
  static createMinimalSettings() {
    return new SettingsBuilder()
      .withNotifications(false)
      .withAutoSave(false)
      .withTerminalSettings({ scrollback: 100 })
      .build();
  }
}

/**
 * Terminal Command Builder
 */
export class CommandBuilder {
  private commands: string[] = [];
  
  addCommand(command: string): CommandBuilder {
    this.commands.push(command);
    return this;
  }
  
  addEcho(message: string): CommandBuilder {
    this.commands.push(`echo "${message}"`);
    return this;
  }
  
  addSleep(seconds: number): CommandBuilder {
    this.commands.push(`sleep ${seconds}`);
    return this;
  }
  
  addExitCode(code: number): CommandBuilder {
    this.commands.push(`exit ${code}`);
    return this;
  }
  
  addChangeDirectory(path: string): CommandBuilder {
    this.commands.push(`cd "${path}"`);
    return this;
  }
  
  addCreateFile(filename: string, content?: string): CommandBuilder {
    if (content) {
      this.commands.push(`echo "${content}" > "${filename}"`);
    } else {
      this.commands.push(`touch "${filename}"`);
    }
    return this;
  }
  
  addCreateDirectory(dirname: string): CommandBuilder {
    this.commands.push(`mkdir -p "${dirname}"`);
    return this;
  }
  
  addListFiles(path = '.'): CommandBuilder {
    this.commands.push(`ls -la "${path}"`);
    return this;
  }
  
  build(): string[] {
    return [...this.commands];
  }
  
  buildAsScript(): string {
    return this.commands.join(' && ');
  }
  
  /**
   * Create a test file structure
   */
  static createTestFileStructure() {
    return new CommandBuilder()
      .addCreateDirectory('test-project')
      .addChangeDirectory('test-project')
      .addCreateDirectory('src')
      .addCreateDirectory('tests')
      .addCreateFile('README.md', '# Test Project')
      .addCreateFile('src/index.js', 'console.log("Hello World");')
      .addCreateFile('tests/test.js', '// Test file')
      .addListFiles()
      .build();
  }
}

/**
 * Test Scenario Builder
 */
export class ScenarioBuilder {
  private scenario = {
    name: 'Test Scenario',
    description: '',
    preconditions: [] as string[],
    steps: [] as { action: string; expected: string }[],
    postconditions: [] as string[]
  };
  
  withName(name: string): ScenarioBuilder {
    this.scenario.name = name;
    return this;
  }
  
  withDescription(description: string): ScenarioBuilder {
    this.scenario.description = description;
    return this;
  }
  
  withPrecondition(condition: string): ScenarioBuilder {
    this.scenario.preconditions.push(condition);
    return this;
  }
  
  withStep(action: string, expected: string): ScenarioBuilder {
    this.scenario.steps.push({ action, expected });
    return this;
  }
  
  withPostcondition(condition: string): ScenarioBuilder {
    this.scenario.postconditions.push(condition);
    return this;
  }
  
  build() {
    return { ...this.scenario };
  }
  
  /**
   * Create a login scenario
   */
  static createLoginScenario() {
    return new ScenarioBuilder()
      .withName('User Login')
      .withDescription('Test user login functionality')
      .withPrecondition('User account exists')
      .withPrecondition('User is on login page')
      .withStep('Enter valid username', 'Username field accepts input')
      .withStep('Enter valid password', 'Password field accepts input')
      .withStep('Click login button', 'User is redirected to dashboard')
      .withPostcondition('User session is created')
      .withPostcondition('User can access protected resources')
      .build();
  }
}

/**
 * Random data generators
 */
export class TestDataGenerators {
  static generateRandomString(length: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
  
  static generateRandomEmail(): string {
    return `test_${this.generateRandomString(8)}@example.com`;
  }
  
  static generateRandomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  static generateRandomBoolean(): boolean {
    return Math.random() < 0.5;
  }
  
  static generateRandomDate(start: Date, end: Date): Date {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  }
  
  static generateRandomFromArray<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }
}