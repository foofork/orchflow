/**
 * Dashboard Page Object
 * Handles dashboard and authenticated user interactions
 */

import type { Page } from 'playwright';
import { BasePage } from './BasePage';

export class DashboardPage extends BasePage {
  // Selectors
  private readonly userMenu = '[data-testid="user-menu"]';
  private readonly usernameDisplay = '[data-testid="username-display"]';
  private readonly logoutButton = '[data-testid="logout-button"]';
  private readonly dashboardContainer = '[data-testid="dashboard-container"]';
  private readonly notification = '[data-testid="notification"]';
  private readonly profileLink = '[data-testid="profile-link"]';
  private readonly settingsLink = '[data-testid="settings-link"]';
  
  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to dashboard
   */
  async navigateToDashboard() {
    await this.goto('/dashboard');
  }

  /**
   * Wait for dashboard to load
   */
  async waitForLoad() {
    await this.waitForElement(this.dashboardContainer);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      // Check multiple indicators
      const hasUserMenu = await this.elementExists(this.userMenu);
      const hasUsername = await this.elementExists(this.usernameDisplay);
      const url = this.getCurrentUrl();
      
      return hasUserMenu && hasUsername && !url.includes('/login');
    } catch {
      return false;
    }
  }

  /**
   * Get displayed username
   */
  async getUsername(): Promise<string> {
    try {
      return await this.getTextContent(this.usernameDisplay);
    } catch {
      return '';
    }
  }

  /**
   * Open user menu
   */
  async openUserMenu() {
    await this.clickElement(this.userMenu);
    await this.waitForElement('[data-testid="user-menu-dropdown"]');
  }

  /**
   * Logout user
   */
  async logout() {
    await this.openUserMenu();
    await this.clickElement(this.logoutButton);
    
    // Wait for redirect to login
    await this.page.waitForURL('**/login', { timeout: 10000 });
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
   * Navigate to profile
   */
  async navigateToProfile() {
    await this.openUserMenu();
    await this.clickElement(this.profileLink);
  }

  /**
   * Navigate to settings
   */
  async navigateToSettings() {
    await this.openUserMenu();
    await this.clickElement(this.settingsLink);
  }

  /**
   * Perform an authenticated action
   */
  async performAuthenticatedAction() {
    // Try to access a protected resource
    await this.page.evaluate(async () => {
      await fetch('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
    });
  }

  /**
   * Check session validity
   */
  async checkSessionValidity(): Promise<boolean> {
    const response = await this.page.evaluate(async () => {
      const res = await fetch('/api/auth/check', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      return { status: res.status };
    });
    
    return response.status === 200;
  }

  /**
   * Get auth token from storage
   */
  async getAuthToken(): Promise<string | null> {
    return await this.page.evaluate(() => {
      return localStorage.getItem('authToken');
    });
  }

  /**
   * Clear session data
   */
  async clearSession() {
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }

  /**
   * Check if user menu is visible
   */
  async isUserMenuVisible(): Promise<boolean> {
    return await this.isVisible(this.userMenu);
  }

  /**
   * Get user role
   */
  async getUserRole(): Promise<string> {
    const roleSelector = '[data-testid="user-role"]';
    try {
      return await this.getTextContent(roleSelector);
    } catch {
      return '';
    }
  }

  /**
   * Check for session expiry warning
   */
  async hasSessionExpiryWarning(): Promise<boolean> {
    return await this.elementExists('[data-testid="session-expiry-warning"]');
  }

  /**
   * Extend session
   */
  async extendSession() {
    const extendButton = '[data-testid="extend-session-button"]';
    if (await this.elementExists(extendButton)) {
      await this.clickElement(extendButton);
    }
  }
}