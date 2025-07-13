/**
 * Authentication Page Object
 * Handles login, logout, and authentication-related interactions
 */

import type { Page, Locator } from 'playwright';
import { BasePage } from './BasePage';

export class AuthPage extends BasePage {
  // Selectors
  private readonly usernameInput = '[data-testid="username-input"]';
  private readonly passwordInput = '[data-testid="password-input"]';
  private readonly loginButton = '[data-testid="login-button"]';
  private readonly rememberMeCheckbox = '[data-testid="remember-me-checkbox"]';
  private readonly errorMessage = '[data-testid="auth-error-message"]';
  private readonly fieldError = '[data-testid="field-error"]';
  private readonly forgotPasswordLink = '[data-testid="forgot-password-link"]';
  private readonly signupLink = '[data-testid="signup-link"]';
  private readonly notification = '[data-testid="notification"]';
  private readonly loginForm = '[data-testid="login-form"]';
  private readonly rememberedUserBadge = '[data-testid="remembered-user"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to login page
   */
  async navigateToLogin() {
    await this.goto('/login');
  }

  /**
   * Fill username field
   */
  async fillUsername(username: string) {
    await this.fillInput(this.usernameInput, username);
  }

  /**
   * Fill password field
   */
  async fillPassword(password: string) {
    await this.fillInput(this.passwordInput, password);
  }

  /**
   * Click login button
   */
  async clickLoginButton() {
    await this.clickElement(this.loginButton);
  }

  /**
   * Toggle remember me checkbox
   */
  async toggleRememberMe() {
    await this.clickElement(this.rememberMeCheckbox);
  }

  /**
   * Perform complete login
   */
  async login(username: string, password: string) {
    await this.fillUsername(username);
    await this.fillPassword(password);
    await this.clickLoginButton();
    
    // Wait for either dashboard or error
    await this.page.waitForFunction(
      () => {
        const url = window.location.pathname;
        const hasError = document.querySelector('[data-testid="auth-error-message"]');
        return url !== '/login' || hasError !== null;
      },
      { timeout: 10000 }
    );
  }

  /**
   * Get error message
   */
  async getErrorMessage(): Promise<string> {
    try {
      const element = await this.waitForElement(this.errorMessage, { timeout: 5000 });
      return await element.textContent() || '';
    } catch {
      return '';
    }
  }

  /**
   * Get field-specific error
   */
  async getFieldError(field: 'username' | 'password'): Promise<string> {
    const selector = field === 'username' 
      ? `${this.usernameInput} ~ ${this.fieldError}`
      : `${this.passwordInput} ~ ${this.fieldError}`;
    
    try {
      const element = await this.waitForElement(selector, { timeout: 2000 });
      return await element.textContent() || '';
    } catch {
      return '';
    }
  }

  /**
   * Clear login form
   */
  async clearForm() {
    await this.clearInput(this.usernameInput);
    await this.clearInput(this.passwordInput);
  }

  /**
   * Check if on login page
   */
  async isOnLoginPage(): Promise<boolean> {
    const url = this.getCurrentUrl();
    const hasForm = await this.elementExists(this.loginForm);
    return url.includes('/login') && hasForm;
  }

  /**
   * Check if user is remembered
   */
  async isRememberedUser(): Promise<boolean> {
    return await this.elementExists(this.rememberedUserBadge);
  }

  /**
   * Get remembered username
   */
  async getRememberedUsername(): Promise<string> {
    if (await this.isRememberedUser()) {
      return await this.getTextContent(this.rememberedUserBadge);
    }
    return '';
  }

  /**
   * Click forgot password link
   */
  async clickForgotPassword() {
    await this.clickElement(this.forgotPasswordLink);
  }

  /**
   * Click signup link
   */
  async clickSignup() {
    await this.clickElement(this.signupLink);
  }

  /**
   * Get notification message
   */
  async getNotification(): Promise<string> {
    try {
      const element = await this.waitForElement(this.notification, { timeout: 5000 });
      return await element.textContent() || '';
    } catch {
      return '';
    }
  }

  /**
   * Wait for login form to be ready
   */
  async waitForLoginForm() {
    await this.waitForElement(this.loginForm);
    await this.waitForElement(this.usernameInput);
    await this.waitForElement(this.passwordInput);
    await this.waitForElement(this.loginButton);
  }

  /**
   * Check if login button is enabled
   */
  async isLoginButtonEnabled(): Promise<boolean> {
    const button = await this.waitForElement(this.loginButton);
    return await button.isEnabled();
  }

  /**
   * Get username input value
   */
  async getUsernameValue(): Promise<string> {
    const input = await this.waitForElement(this.usernameInput);
    return await input.inputValue();
  }

  /**
   * Submit form using Enter key
   */
  async submitWithEnter() {
    await this.page.locator(this.passwordInput).press('Enter');
  }

  /**
   * Check password visibility toggle
   */
  async togglePasswordVisibility() {
    const toggleButton = '[data-testid="password-visibility-toggle"]';
    await this.clickElement(toggleButton);
  }

  /**
   * Get password input type
   */
  async getPasswordInputType(): Promise<string> {
    return await this.getAttribute(this.passwordInput, 'type') || 'password';
  }

  /**
   * Simulate OAuth login
   */
  async loginWithOAuth(provider: 'google' | 'github' | 'microsoft') {
    const oauthButton = `[data-testid="oauth-${provider}"]`;
    await this.clickElement(oauthButton);
    
    // Wait for OAuth redirect
    await this.page.waitForURL(/oauth|auth/, { timeout: 10000 });
  }

  /**
   * Check if two-factor authentication is required
   */
  async is2FARequired(): Promise<boolean> {
    return await this.elementExists('[data-testid="2fa-input"]');
  }

  /**
   * Enter 2FA code
   */
  async enter2FACode(code: string) {
    const twoFAInput = '[data-testid="2fa-input"]';
    await this.fillInput(twoFAInput, code);
    
    const submit2FAButton = '[data-testid="2fa-submit"]';
    await this.clickElement(submit2FAButton);
  }

  /**
   * Get login attempts remaining
   */
  async getAttemptsRemaining(): Promise<number> {
    const attemptsText = await this.getTextContent('[data-testid="attempts-remaining"]');
    const match = attemptsText.match(/(\d+)/);
    return match ? parseInt(match[1]) : -1;
  }
}