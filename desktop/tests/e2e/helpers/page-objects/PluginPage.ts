/**
 * Plugin Page Object
 * Handles plugin marketplace and management interactions
 */

import type { Page, Locator } from 'playwright';
import { BasePage } from './BasePage';

interface PluginInfo {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  downloads: number;
  rating: number;
  category: string;
}

interface PluginDetails extends PluginInfo {
  readme: string;
  changelog: string;
  dependencies: string[];
  size: string;
}

interface PluginReview {
  author: string;
  rating: number;
  title: string;
  comment: string;
  date: string;
}

export class PluginPage extends BasePage {
  // Selectors
  private readonly pluginList = '[data-testid="plugin-list"]';
  private readonly pluginCard = '[data-testid="plugin-card"]';
  private readonly searchInput = '[data-testid="plugin-search"]';
  private readonly categoryFilter = '[data-testid="category-filter"]';
  private readonly sortDropdown = '[data-testid="sort-dropdown"]';
  private readonly installButton = '[data-testid="install-button"]';
  private readonly installedTab = '[data-testid="installed-tab"]';
  private readonly notification = '[data-testid="notification"]';
  private readonly errorMessage = '[data-testid="error-message"]';
  private readonly warningMessage = '[data-testid="warning-message"]';
  private readonly pluginSettings = '[data-testid="plugin-settings"]';
  private readonly permissionDialog = '[data-testid="permission-dialog"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to plugins page
   */
  async navigateToPlugins() {
    await this.goto('/plugins');
    await this.waitForElement(this.pluginList);
  }

  /**
   * Navigate to installed plugins
   */
  async navigateToInstalledPlugins() {
    await this.navigateToPlugins();
    await this.clickElement(this.installedTab);
  }

  /**
   * Get available plugins
   */
  async getAvailablePlugins(): Promise<PluginInfo[]> {
    await this.waitForElement(this.pluginCard);
    const cards = await this.getAllElements(this.pluginCard);
    const plugins: PluginInfo[] = [];

    for (const card of cards) {
      plugins.push({
        id: await card.getAttribute('data-plugin-id') || '',
        name: await card.locator('[data-testid="plugin-name"]').textContent() || '',
        description: await card.locator('[data-testid="plugin-description"]').textContent() || '',
        version: await card.locator('[data-testid="plugin-version"]').textContent() || '',
        author: await card.locator('[data-testid="plugin-author"]').textContent() || '',
        downloads: parseInt(await card.locator('[data-testid="plugin-downloads"]').textContent() || '0'),
        rating: parseFloat(await card.locator('[data-testid="plugin-rating"]').textContent() || '0'),
        category: await card.getAttribute('data-category') || ''
      });
    }

    return plugins;
  }

  /**
   * Get visible plugins
   */
  async getVisiblePlugins(): Promise<PluginInfo[]> {
    return await this.getAvailablePlugins();
  }

  /**
   * Search plugins
   */
  async searchPlugins(query: string): Promise<PluginInfo[]> {
    await this.fillInput(this.searchInput, query);
    await this.page.waitForTimeout(500); // Debounce
    return await this.getAvailablePlugins();
  }

  /**
   * Filter by category
   */
  async filterByCategory(category: string) {
    await this.selectOption(this.categoryFilter, category);
    await this.page.waitForTimeout(300);
  }

  /**
   * Sort plugins
   */
  async sortBy(criteria: 'downloads' | 'rating' | 'name' | 'updated') {
    await this.selectOption(this.sortDropdown, criteria);
    await this.page.waitForTimeout(300);
  }

  /**
   * View plugin details
   */
  async viewPluginDetails(pluginId: string): Promise<PluginDetails> {
    await this.clickElement(`${this.pluginCard}[data-plugin-id="${pluginId}"]`);
    await this.waitForElement('[data-testid="plugin-details"]');

    const details: PluginDetails = {
      id: pluginId,
      name: await this.getTextContent('[data-testid="detail-name"]'),
      description: await this.getTextContent('[data-testid="detail-description"]'),
      version: await this.getTextContent('[data-testid="detail-version"]'),
      author: await this.getTextContent('[data-testid="detail-author"]'),
      downloads: parseInt(await this.getTextContent('[data-testid="detail-downloads"]')),
      rating: parseFloat(await this.getTextContent('[data-testid="detail-rating"]')),
      category: await this.getTextContent('[data-testid="detail-category"]'),
      readme: await this.getTextContent('[data-testid="detail-readme"]'),
      changelog: await this.getTextContent('[data-testid="detail-changelog"]'),
      dependencies: [],
      size: await this.getTextContent('[data-testid="detail-size"]')
    };

    const deps = await this.getAllElements('[data-testid="dependency-item"]');
    for (const dep of deps) {
      details.dependencies.push(await dep.textContent() || '');
    }

    return details;
  }

  /**
   * Install plugin
   */
  async installPlugin(pluginId: string) {
    const card = `${this.pluginCard}[data-plugin-id="${pluginId}"]`;
    await this.hover(card);
    await this.clickElement(`${card} ${this.installButton}`);
    
    // Wait for installation to complete
    await this.waitForCondition(
      async () => {
        const installing = await this.elementExists(`${card} [data-testid="installing"]`);
        return !installing;
      },
      { timeout: 30000 }
    );
  }

  /**
   * Check if plugin is installed
   */
  async isPluginInstalled(pluginId: string): Promise<boolean> {
    const card = `${this.pluginCard}[data-plugin-id="${pluginId}"]`;
    return await this.elementExists(`${card} [data-testid="installed-badge"]`);
  }

  /**
   * Check if plugin is enabled
   */
  async isPluginEnabled(pluginId: string): Promise<boolean> {
    await this.navigateToInstalledPlugins();
    const card = `${this.pluginCard}[data-plugin-id="${pluginId}"]`;
    const toggle = await this.page.locator(`${card} [data-testid="enable-toggle"]`);
    return await toggle.isChecked();
  }

  /**
   * Enable plugin
   */
  async enablePlugin(pluginId: string) {
    await this.navigateToInstalledPlugins();
    const toggle = `${this.pluginCard}[data-plugin-id="${pluginId}"] [data-testid="enable-toggle"]`;
    const isEnabled = await this.page.locator(toggle).isChecked();
    if (!isEnabled) {
      await this.clickElement(toggle);
    }
  }

  /**
   * Disable plugin
   */
  async disablePlugin(pluginId: string) {
    await this.navigateToInstalledPlugins();
    const toggle = `${this.pluginCard}[data-plugin-id="${pluginId}"] [data-testid="enable-toggle"]`;
    const isEnabled = await this.page.locator(toggle).isChecked();
    if (isEnabled) {
      await this.clickElement(toggle);
    }
  }

  /**
   * Update plugin
   */
  async updatePlugin(pluginId: string) {
    await this.navigateToInstalledPlugins();
    const card = `${this.pluginCard}[data-plugin-id="${pluginId}"]`;
    await this.clickElement(`${card} [data-testid="update-button"]`);
    
    // Wait for update to complete
    await this.waitForCondition(
      async () => !await this.elementExists(`${card} [data-testid="updating"]`),
      { timeout: 30000 }
    );
  }

  /**
   * Uninstall plugin
   */
  async uninstallPlugin(pluginId: string) {
    await this.navigateToInstalledPlugins();
    const card = `${this.pluginCard}[data-plugin-id="${pluginId}"]`;
    await this.clickElement(`${card} [data-testid="uninstall-button"]`);
  }

  /**
   * Confirm uninstall
   */
  async confirmUninstall() {
    await this.clickElement('[data-testid="confirm-uninstall"]');
  }

  /**
   * Get plugin version
   */
  async getPluginVersion(pluginId: string): Promise<string> {
    const card = `${this.pluginCard}[data-plugin-id="${pluginId}"]`;
    return await this.getTextContent(`${card} [data-testid="plugin-version"]`);
  }

  /**
   * Open plugin settings
   */
  async openPluginSettings(pluginId: string) {
    await this.navigateToInstalledPlugins();
    const card = `${this.pluginCard}[data-plugin-id="${pluginId}"]`;
    await this.clickElement(`${card} [data-testid="settings-button"]`);
    await this.waitForElement(this.pluginSettings);
  }

  /**
   * Set plugin option
   */
  async setPluginOption(key: string, value: string | boolean) {
    const input = `[data-testid="option-${key}"]`;
    
    if (typeof value === 'boolean') {
      const isChecked = await this.page.locator(input).isChecked();
      if (isChecked !== value) {
        await this.clickElement(input);
      }
    } else {
      await this.fillInput(input, value);
    }
  }

  /**
   * Save plugin settings
   */
  async savePluginSettings() {
    await this.clickElement('[data-testid="save-settings"]');
  }

  /**
   * Get plugin config
   */
  async getPluginConfig(pluginId: string): Promise<any> {
    return await this.page.evaluate((id) => {
      return (window as any).pluginManager?.getConfig(id) || {};
    }, pluginId);
  }

  /**
   * Configure plugin
   */
  async configurePlugin(pluginId: string, config: any) {
    await this.page.evaluate(({ id, config }) => {
      (window as any).pluginManager?.setConfig(id, config);
    }, { id: pluginId, config });
  }

  /**
   * View plugin logs
   */
  async viewPluginLogs(pluginId: string) {
    await this.navigateToInstalledPlugins();
    const card = `${this.pluginCard}[data-plugin-id="${pluginId}"]`;
    await this.clickElement(`${card} [data-testid="view-logs"]`);
  }

  /**
   * Get plugin logs
   */
  async getPluginLogs(): Promise<string[]> {
    await this.waitForElement('[data-testid="plugin-logs"]');
    const logEntries = await this.getAllElements('[data-testid="log-entry"]');
    const logs: string[] = [];
    
    for (const entry of logEntries) {
      logs.push(await entry.textContent() || '');
    }
    
    return logs;
  }

  /**
   * Get notification
   */
  async getNotification(): Promise<string> {
    try {
      return await this.getTextContent(this.notification);
    } catch {
      return '';
    }
  }

  /**
   * Get error message
   */
  async getErrorMessage(): Promise<string> {
    try {
      return await this.getTextContent(this.errorMessage);
    } catch {
      return '';
    }
  }

  /**
   * Get warning message
   */
  async getWarningMessage(): Promise<string> {
    try {
      return await this.getTextContent(this.warningMessage);
    } catch {
      return '';
    }
  }

  /**
   * Check if has install progress
   */
  async hasInstallProgress(pluginId: string): Promise<boolean> {
    const card = `${this.pluginCard}[data-plugin-id="${pluginId}"]`;
    return await this.elementExists(`${card} [data-testid="install-progress"]`);
  }

  /**
   * Select multiple plugins
   */
  async selectPlugins(pluginIds: string[]) {
    for (const id of pluginIds) {
      const checkbox = `${this.pluginCard}[data-plugin-id="${id}"] [data-testid="select-checkbox"]`;
      await this.clickElement(checkbox);
    }
  }

  /**
   * Install selected plugins
   */
  async installSelected() {
    await this.clickElement('[data-testid="install-selected"]');
    
    // Wait for all installations
    await this.waitForCondition(
      async () => {
        const installing = await this.page.locator('[data-testid="installing"]').count();
        return installing === 0;
      },
      { timeout: 60000 }
    );
  }

  /**
   * Load development plugin
   */
  async loadDevelopmentPlugin(path: string) {
    await this.clickElement('[data-testid="dev-mode-button"]');
    await this.clickElement('[data-testid="load-dev-plugin"]');
    await this.fillInput('[data-testid="plugin-path"]', path);
    await this.clickElement('[data-testid="load-button"]');
  }

  /**
   * Check if plugin is in development
   */
  async isPluginInDevelopment(pluginId: string): Promise<boolean> {
    const card = `${this.pluginCard}[data-plugin-id="${pluginId}"]`;
    return await this.elementExists(`${card} [data-testid="dev-badge"]`);
  }

  /**
   * Reload plugin
   */
  async reloadPlugin(pluginId: string) {
    const card = `${this.pluginCard}[data-plugin-id="${pluginId}"]`;
    await this.clickElement(`${card} [data-testid="reload-button"]`);
  }

  /**
   * Open plugin debugger
   */
  async openPluginDebugger(pluginId: string) {
    const card = `${this.pluginCard}[data-plugin-id="${pluginId}"]`;
    await this.clickElement(`${card} [data-testid="debug-button"]`);
  }

  /**
   * Check if debugger is open
   */
  async isDebuggerOpen(): Promise<boolean> {
    return await this.elementExists('[data-testid="plugin-debugger"]');
  }

  /**
   * Get debug console
   */
  async getDebugConsole(): Promise<string> {
    return await this.getTextContent('[data-testid="debug-console"]');
  }

  /**
   * Publish plugin
   */
  async publishPlugin(path: string, metadata: any) {
    await this.clickElement('[data-testid="publish-plugin"]');
    await this.fillInput('[data-testid="publish-path"]', path);
    await this.fillInput('[data-testid="publish-name"]', metadata.name);
    await this.fillInput('[data-testid="publish-description"]', metadata.description);
    await this.fillInput('[data-testid="publish-keywords"]', metadata.keywords.join(', '));
    await this.clickElement('[data-testid="publish-button"]');
  }

  /**
   * Get published info
   */
  async getPublishedInfo(pluginId: string): Promise<any> {
    return await this.page.evaluate((id) => {
      return (window as any).pluginStore?.getPublishedInfo(id) || {};
    }, pluginId);
  }

  /**
   * Rate plugin
   */
  async ratePlugin(pluginId: string, rating: number) {
    await this.viewPluginDetails(pluginId);
    const star = `[data-testid="rating-star-${rating}"]`;
    await this.clickElement(star);
  }

  /**
   * Get plugin rating
   */
  async getPluginRating(pluginId: string): Promise<any> {
    await this.viewPluginDetails(pluginId);
    return {
      average: parseFloat(await this.getTextContent('[data-testid="average-rating"]')),
      total: parseInt(await this.getTextContent('[data-testid="total-ratings"]')),
      userRating: parseInt(await this.getAttribute('[data-testid="user-rating"]', 'data-rating') || '0')
    };
  }

  /**
   * Review plugin
   */
  async reviewPlugin(pluginId: string, review: any) {
    await this.viewPluginDetails(pluginId);
    await this.clickElement('[data-testid="write-review"]');
    await this.ratePlugin(pluginId, review.rating);
    await this.fillInput('[data-testid="review-title"]', review.title);
    await this.fillInput('[data-testid="review-comment"]', review.comment);
    await this.clickElement('[data-testid="submit-review"]');
  }

  /**
   * Get plugin reviews
   */
  async getPluginReviews(pluginId: string): Promise<PluginReview[]> {
    await this.viewPluginDetails(pluginId);
    await this.clickElement('[data-testid="reviews-tab"]');
    
    const reviewElements = await this.getAllElements('[data-testid="review-item"]');
    const reviews: PluginReview[] = [];
    
    for (const element of reviewElements) {
      reviews.push({
        author: await element.locator('[data-testid="review-author"]').textContent() || '',
        rating: parseInt(await element.getAttribute('data-rating') || '0'),
        title: await element.locator('[data-testid="review-title"]').textContent() || '',
        comment: await element.locator('[data-testid="review-comment"]').textContent() || '',
        date: await element.locator('[data-testid="review-date"]').textContent() || ''
      });
    }
    
    return reviews;
  }

  /**
   * Check if has permission dialog
   */
  async hasPermissionDialog(): Promise<boolean> {
    return await this.elementExists(this.permissionDialog);
  }

  /**
   * Get requested permissions
   */
  async getRequestedPermissions(): Promise<string[]> {
    const permissions = await this.getAllElements('[data-testid="permission-item"]');
    const list: string[] = [];
    
    for (const perm of permissions) {
      list.push(await perm.getAttribute('data-permission') || '');
    }
    
    return list;
  }

  /**
   * Deny permissions
   */
  async denyPermissions() {
    await this.clickElement('[data-testid="deny-permissions"]');
  }

  /**
   * Get security warning
   */
  async getSecurityWarning(): Promise<string> {
    return await this.getTextContent('[data-testid="security-warning"]');
  }

  /**
   * Get installed count
   */
  async getInstalledCount(): Promise<number> {
    const count = await this.getTextContent('[data-testid="installed-count"]');
    return parseInt(count) || 0;
  }
}