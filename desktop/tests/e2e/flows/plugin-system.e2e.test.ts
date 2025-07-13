/**
 * Plugin System E2E Tests
 * Tests plugin installation, configuration, and usage
 */

import { TestContext } from '../helpers/test-context';
import { PluginPage } from '../helpers/page-objects/PluginPage';
import { EditorPage } from '../helpers/page-objects/EditorPage';
import { SettingsPage } from '../helpers/page-objects/SettingsPage';
import * as path from 'path';
import * as fs from 'fs/promises';

describe('Plugin System Flow', () => {
  let testContext: TestContext;
  let pluginPage: PluginPage;
  let editor: EditorPage;
  let settings: SettingsPage;

  beforeEach(async () => {
    testContext = new TestContext({
      headless: process.env.CI === 'true',
      trace: true
    });
    await testContext.setup();
    
    const { page, baseUrl } = await testContext.createPage();
    pluginPage = new PluginPage(page);
    editor = new EditorPage(page);
    settings = new SettingsPage(page);
    
    await page.goto(baseUrl);
    await pluginPage.navigateToPlugins();
  });

  afterEach(async () => {
    await testContext.captureState('plugin-flow');
    await testContext.teardown();
  });

  describe('Plugin Discovery', () => {
    test('should display available plugins', async () => {
      // Act
      const plugins = await pluginPage.getAvailablePlugins();

      // Assert
      expect(plugins.length).toBeGreaterThan(0);
      expect(plugins.some(p => p.category === 'Language Support')).toBe(true);
      expect(plugins.some(p => p.category === 'Themes')).toBe(true);
      expect(plugins.some(p => p.category === 'Tools')).toBe(true);
    });

    test('should search plugins', async () => {
      // Act
      const results = await pluginPage.searchPlugins('typescript');

      // Assert
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name.toLowerCase()).toContain('typescript');
    });

    test('should filter by category', async () => {
      // Act
      await pluginPage.filterByCategory('Themes');
      const plugins = await pluginPage.getVisiblePlugins();

      // Assert
      expect(plugins.length).toBeGreaterThan(0);
      expect(plugins.every(p => p.category === 'Themes')).toBe(true);
    });

    test('should sort plugins', async () => {
      // Act - Sort by downloads
      await pluginPage.sortBy('downloads');
      const plugins = await pluginPage.getVisiblePlugins();

      // Assert
      for (let i = 1; i < plugins.length; i++) {
        expect(plugins[i-1].downloads).toBeGreaterThanOrEqual(plugins[i].downloads);
      }
    });

    test('should display plugin details', async () => {
      // Arrange
      const plugins = await pluginPage.getAvailablePlugins();
      const firstPlugin = plugins[0];

      // Act
      const details = await pluginPage.viewPluginDetails(firstPlugin.id);

      // Assert
      expect(details.name).toBe(firstPlugin.name);
      expect(details.description).toBeTruthy();
      expect(details.version).toBeTruthy();
      expect(details.author).toBeTruthy();
      expect(details.readme).toBeTruthy();
    });
  });

  describe('Plugin Installation', () => {
    test('should install plugin', async () => {
      // Arrange
      const plugin = {
        id: 'test-formatter',
        name: 'Test Formatter'
      };

      // Act
      await pluginPage.installPlugin(plugin.id);

      // Assert
      expect(await pluginPage.isPluginInstalled(plugin.id)).toBe(true);
      const notification = await pluginPage.getNotification();
      expect(notification).toContain(`${plugin.name} installed successfully`);
    });

    test('should handle installation errors', async () => {
      // Act - Try to install invalid plugin
      await pluginPage.installPlugin('invalid-plugin-id');

      // Assert
      const error = await pluginPage.getErrorMessage();
      expect(error).toContain('Failed to install');
    });

    test('should show installation progress', async () => {
      // Arrange
      const largePlugin = 'large-language-pack';

      // Act
      const installPromise = pluginPage.installPlugin(largePlugin);
      
      // Assert - Check progress during installation
      await pluginPage.page.waitForTimeout(100);
      expect(await pluginPage.hasInstallProgress(largePlugin)).toBe(true);
      
      await installPromise;
      expect(await pluginPage.hasInstallProgress(largePlugin)).toBe(false);
    });

    test('should batch install plugins', async () => {
      // Arrange
      const plugins = ['formatter-1', 'theme-1', 'tool-1'];

      // Act
      await pluginPage.selectPlugins(plugins);
      await pluginPage.installSelected();

      // Assert
      for (const pluginId of plugins) {
        expect(await pluginPage.isPluginInstalled(pluginId)).toBe(true);
      }
    });

    test('should validate plugin compatibility', async () => {
      // Act - Try to install incompatible plugin
      const incompatiblePlugin = 'requires-newer-version';
      await pluginPage.installPlugin(incompatiblePlugin);

      // Assert
      const warning = await pluginPage.getWarningMessage();
      expect(warning).toContain('compatibility');
    });
  });

  describe('Plugin Management', () => {
    beforeEach(async () => {
      // Install a test plugin
      await pluginPage.installPlugin('test-plugin');
    });

    test('should enable/disable plugin', async () => {
      // Act - Disable
      await pluginPage.disablePlugin('test-plugin');
      
      // Assert
      expect(await pluginPage.isPluginEnabled('test-plugin')).toBe(false);

      // Act - Enable
      await pluginPage.enablePlugin('test-plugin');
      
      // Assert
      expect(await pluginPage.isPluginEnabled('test-plugin')).toBe(true);
    });

    test('should update plugin', async () => {
      // Arrange - Simulate available update
      await pluginPage.page.evaluate(() => {
        (window as any).mockPluginUpdate('test-plugin', '2.0.0');
      });

      // Act
      await pluginPage.updatePlugin('test-plugin');

      // Assert
      const version = await pluginPage.getPluginVersion('test-plugin');
      expect(version).toBe('2.0.0');
    });

    test('should uninstall plugin', async () => {
      // Act
      await pluginPage.uninstallPlugin('test-plugin');
      await pluginPage.confirmUninstall();

      // Assert
      expect(await pluginPage.isPluginInstalled('test-plugin')).toBe(false);
    });

    test('should configure plugin settings', async () => {
      // Act
      await pluginPage.openPluginSettings('test-plugin');
      await pluginPage.setPluginOption('enableFeatureX', true);
      await pluginPage.setPluginOption('maxItems', '100');
      await pluginPage.savePluginSettings();

      // Assert
      const config = await pluginPage.getPluginConfig('test-plugin');
      expect(config.enableFeatureX).toBe(true);
      expect(config.maxItems).toBe('100');
    });

    test('should show plugin logs', async () => {
      // Act
      await pluginPage.viewPluginLogs('test-plugin');

      // Assert
      const logs = await pluginPage.getPluginLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0]).toContain('[test-plugin]');
    });
  });

  describe('Plugin Usage', () => {
    test('should apply theme plugin', async () => {
      // Arrange
      await pluginPage.installPlugin('dark-theme-plus');

      // Act
      await settings.navigateToSettings();
      await settings.selectTheme('Dark Theme Plus');

      // Assert
      const appliedTheme = await editor.getTheme();
      expect(appliedTheme).toBe('dark-theme-plus');
    });

    test('should use formatter plugin', async () => {
      // Arrange
      await pluginPage.installPlugin('prettier-formatter');
      
      // Create unformatted code
      await editor.page.goto(testContext.baseUrl + '/editor');
      await editor.setContent('function test(){console.log("hello")}');

      // Act
      await editor.formatDocument();

      // Assert
      const formatted = await editor.getContent();
      expect(formatted).toContain('function test() {');
      expect(formatted).toContain('  console.log("hello")');
      expect(formatted).toContain('}');
    });

    test('should use language support plugin', async () => {
      // Arrange
      await pluginPage.installPlugin('python-language-support');
      
      // Create Python file
      await editor.page.goto(testContext.baseUrl + '/editor');
      await editor.setContent('def hello():\n    print("Hello")');
      await editor.setSyntaxHighlighting('python');

      // Act - Test autocomplete
      await editor.typeText('\nhel');
      await editor.page.keyboard.press('Control+Space');

      // Assert
      const suggestions = await editor.page.locator('[data-testid="autocomplete-suggestions"]').count();
      expect(suggestions).toBeGreaterThan(0);
    });

    test('should use snippet plugin', async () => {
      // Arrange
      await pluginPage.installPlugin('code-snippets');
      await pluginPage.configurePlugin('code-snippets', {
        snippets: {
          'log': 'console.log($1);'
        }
      });

      // Act
      await editor.page.goto(testContext.baseUrl + '/editor');
      await editor.typeText('log');
      await editor.page.keyboard.press('Tab');

      // Assert
      const content = await editor.getContent();
      expect(content).toBe('console.log();');
    });

    test('should handle plugin commands', async () => {
      // Arrange
      await pluginPage.installPlugin('command-palette-plus');

      // Act
      await editor.page.keyboard.press('Control+Shift+P');
      await editor.page.keyboard.type('Plugin: Test Command');
      await editor.page.keyboard.press('Enter');

      // Assert
      const notification = await pluginPage.getNotification();
      expect(notification).toContain('Test command executed');
    });
  });

  describe('Plugin Development', () => {
    test('should load development plugin', async () => {
      // Arrange
      const devPluginPath = path.join(testContext.getDataDir()!, 'dev-plugin');
      await createTestPlugin(devPluginPath);

      // Act
      await pluginPage.loadDevelopmentPlugin(devPluginPath);

      // Assert
      expect(await pluginPage.isPluginInstalled('dev-plugin')).toBe(true);
      expect(await pluginPage.isPluginInDevelopment('dev-plugin')).toBe(true);
    });

    test('should reload development plugin', async () => {
      // Arrange
      const devPluginPath = path.join(testContext.getDataDir()!, 'dev-plugin');
      await createTestPlugin(devPluginPath);
      await pluginPage.loadDevelopmentPlugin(devPluginPath);

      // Modify plugin
      const mainFile = path.join(devPluginPath, 'index.js');
      const content = await fs.readFile(mainFile, 'utf-8');
      await fs.writeFile(mainFile, content.replace('1.0.0', '1.0.1'));

      // Act
      await pluginPage.reloadPlugin('dev-plugin');

      // Assert
      const version = await pluginPage.getPluginVersion('dev-plugin');
      expect(version).toBe('1.0.1');
    });

    test('should debug plugin', async () => {
      // Arrange
      const devPluginPath = path.join(testContext.getDataDir()!, 'dev-plugin');
      await createTestPlugin(devPluginPath);
      await pluginPage.loadDevelopmentPlugin(devPluginPath);

      // Act
      await pluginPage.openPluginDebugger('dev-plugin');

      // Assert
      expect(await pluginPage.isDebuggerOpen()).toBe(true);
      const console = await pluginPage.getDebugConsole();
      expect(console).toContain('[dev-plugin] Loaded');
    });
  });

  describe('Plugin Store', () => {
    test('should publish plugin', async () => {
      // Arrange
      const pluginPath = path.join(testContext.getDataDir()!, 'my-plugin');
      await createTestPlugin(pluginPath);

      // Act
      await pluginPage.publishPlugin(pluginPath, {
        name: 'My Test Plugin',
        description: 'A test plugin',
        keywords: ['test', 'example']
      });

      // Assert
      const publishedInfo = await pluginPage.getPublishedInfo('my-plugin');
      expect(publishedInfo.status).toBe('published');
      expect(publishedInfo.url).toContain('plugin-store');
    });

    test('should rate plugin', async () => {
      // Act
      await pluginPage.ratePlugin('popular-plugin', 5);

      // Assert
      const rating = await pluginPage.getPluginRating('popular-plugin');
      expect(rating.userRating).toBe(5);
    });

    test('should review plugin', async () => {
      // Act
      await pluginPage.reviewPlugin('test-plugin', {
        rating: 4,
        title: 'Great plugin!',
        comment: 'Works perfectly for my use case.'
      });

      // Assert
      const reviews = await pluginPage.getPluginReviews('test-plugin');
      expect(reviews[0].title).toBe('Great plugin!');
    });
  });

  describe('Plugin Security', () => {
    test('should show permission requests', async () => {
      // Act - Install plugin that requires permissions
      await pluginPage.installPlugin('file-access-plugin');

      // Assert
      expect(await pluginPage.hasPermissionDialog()).toBe(true);
      const permissions = await pluginPage.getRequestedPermissions();
      expect(permissions).toContain('fileSystem.read');
      expect(permissions).toContain('fileSystem.write');
    });

    test('should handle permission denial', async () => {
      // Act
      await pluginPage.installPlugin('network-plugin');
      await pluginPage.denyPermissions();

      // Assert
      expect(await pluginPage.isPluginInstalled('network-plugin')).toBe(false);
      const error = await pluginPage.getErrorMessage();
      expect(error).toContain('Required permissions denied');
    });

    test('should sandbox plugin execution', async () => {
      // Act - Install malicious plugin attempt
      await pluginPage.installPlugin('suspicious-plugin');

      // Assert
      const warning = await pluginPage.getSecurityWarning();
      expect(warning).toContain('sandboxed environment');
    });
  });

  describe('Performance', () => {
    test('should load plugin list quickly', async () => {
      // Act
      const startTime = Date.now();
      await pluginPage.navigateToPlugins();
      const plugins = await pluginPage.getAvailablePlugins();
      const loadTime = Date.now() - startTime;

      // Assert
      expect(loadTime).toBeLessThan(2000); // Should load within 2 seconds
      expect(plugins.length).toBeGreaterThan(0);
    });

    test('should handle many installed plugins', async () => {
      // Install multiple plugins
      const pluginIds = Array.from({ length: 20 }, (_, i) => `test-plugin-${i}`);
      
      for (const id of pluginIds) {
        await pluginPage.installPlugin(id);
      }

      // Act
      const startTime = Date.now();
      await pluginPage.navigateToInstalledPlugins();
      const installedCount = await pluginPage.getInstalledCount();
      const renderTime = Date.now() - startTime;

      // Assert
      expect(renderTime).toBeLessThan(1000); // Should render within 1 second
      expect(installedCount).toBe(20);
    });
  });
});

// Helper function to create test plugin
async function createTestPlugin(pluginPath: string) {
  await fs.mkdir(pluginPath, { recursive: true });
  
  // package.json
  await fs.writeFile(
    path.join(pluginPath, 'package.json'),
    JSON.stringify({
      name: 'dev-plugin',
      version: '1.0.0',
      main: 'index.js',
      orchflow: {
        displayName: 'Development Plugin',
        description: 'A test plugin for development',
        category: 'Development'
      }
    }, null, 2)
  );
  
  // index.js
  await fs.writeFile(
    path.join(pluginPath, 'index.js'),
    `
module.exports = {
  activate() {
    console.log('[dev-plugin] Loaded');
  },
  deactivate() {
    console.log('[dev-plugin] Unloaded');
  }
};
    `.trim()
  );
}