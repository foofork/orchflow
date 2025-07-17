import { OrchFlowConfigManager } from '../../terminal-setup/config-manager';
import type { OrchFlowConfigData } from '../../types';
import { join } from 'path';
import { homedir } from 'os';

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

// Mock yaml
jest.mock('js-yaml', () => ({
  load: jest.fn(),
  dump: jest.fn(),
}));

describe('OrchFlowConfigManager', () => {
  let configManager: OrchFlowConfigManager;
  let mockFs: any;
  let mockYaml: any;

  beforeEach(() => {
    configManager = new OrchFlowConfigManager();
    mockFs = require('fs');
    mockYaml = require('js-yaml');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('loadConfig', () => {
    const mockConfigPath = join(homedir(), '.orchflow', 'config.yml');

    it('should load existing config file', async () => {
      const mockConfig: OrchFlowConfigData = {
        terminal: {
          preferred_mode: 'tmux',
          auto_setup: true,
          tmux: {
            split_direction: 'horizontal',
            split_size: 30,
            status_position: 'right',
            respect_layout: false
          },
          status: {
            update_interval: 1000,
            show_resources: true,
            show_details: true,
            max_workers_display: 10
          },
          vscode: {
            status_location: 'terminal',
            use_terminal_api: true
          }
        }
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('mock yaml content');
      mockYaml.load.mockReturnValue(mockConfig);

      const result = await configManager.loadConfig();

      expect(mockFs.existsSync).toHaveBeenCalledWith(mockConfigPath);
      expect(mockFs.readFileSync).toHaveBeenCalledWith(mockConfigPath, 'utf8');
      expect(mockYaml.load).toHaveBeenCalledWith('mock yaml content');
      expect(result).toEqual(mockConfig);
    });

    it('should return default config when file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = await configManager.loadConfig();

      expect(result.terminal.preferred_mode).toBe('auto');
      expect(result.terminal.auto_setup).toBe(false);
      expect(result.terminal.tmux.split_direction).toBe('horizontal');
    });

    it('should return default config when file is corrupted', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid yaml');
      mockYaml.load.mockImplementation(() => {
        throw new Error('Invalid YAML');
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await configManager.loadConfig();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load config')
      );
      expect(result.terminal.preferred_mode).toBe('auto');

      consoleSpy.mockRestore();
    });

    it('should complete loading within 50ms', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('mock yaml');
      mockYaml.load.mockReturnValue({ terminal: {} });

      const startTime = Date.now();
      await configManager.loadConfig();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(50);
    });
  });

  describe('saveConfig', () => {
    const mockConfigPath = join(homedir(), '.orchflow', 'config.yml');
    const mockConfigDir = join(homedir(), '.orchflow');

    it('should save config to file', async () => {
      const config: OrchFlowConfigData = {
        terminal: {
          preferred_mode: 'tmux',
          auto_setup: true,
          tmux: {
            split_direction: 'horizontal',
            split_size: 30,
            status_position: 'right',
            respect_layout: false
          },
          status: {
            update_interval: 1000,
            show_resources: true,
            show_details: true,
            max_workers_display: 10
          },
          vscode: {
            status_location: 'terminal',
            use_terminal_api: true
          }
        }
      };

      mockFs.existsSync.mockReturnValue(true);
      mockYaml.dump.mockReturnValue('dumped yaml content');

      await configManager.saveConfig(config);

      expect(mockYaml.dump).toHaveBeenCalledWith(config, {
        indent: 2,
        lineWidth: 80,
        noRefs: true
      });
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        mockConfigPath,
        'dumped yaml content'
      );
    });

    it('should create config directory if it does not exist', async () => {
      const config: OrchFlowConfigData = {
        terminal: {
          preferred_mode: 'auto',
          auto_setup: false,
          tmux: {
            split_direction: 'horizontal',
            split_size: 30,
            status_position: 'right',
            respect_layout: false
          },
          status: {
            update_interval: 1000,
            show_resources: true,
            show_details: true,
            max_workers_display: 10
          },
          vscode: {
            status_location: 'terminal',
            use_terminal_api: true
          }
        }
      };

      mockFs.existsSync.mockReturnValue(false);
      mockYaml.dump.mockReturnValue('dumped yaml content');

      await configManager.saveConfig(config);

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(mockConfigDir, { recursive: true });
    });

    it('should handle save errors gracefully', async () => {
      const config: OrchFlowConfigData = {
        terminal: {
          preferred_mode: 'auto',
          auto_setup: false,
          tmux: {
            split_direction: 'horizontal',
            split_size: 30,
            status_position: 'right',
            respect_layout: false
          },
          status: {
            update_interval: 1000,
            show_resources: true,
            show_details: true,
            max_workers_display: 10
          },
          vscode: {
            status_location: 'terminal',
            use_terminal_api: true
          }
        }
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Write failed');
      });

      await expect(configManager.saveConfig(config)).rejects.toThrow('Write failed');
    });
  });

  describe('saveUserPreference', () => {
    it('should save tmux preference', async () => {
      const mockExistingConfig: OrchFlowConfigData = {
        terminal: {
          preferred_mode: 'auto',
          auto_setup: false,
          tmux: {
            split_direction: 'vertical',
            split_size: 40,
            status_position: 'left',
            respect_layout: true
          },
          status: {
            update_interval: 500,
            show_resources: false,
            show_details: false,
            max_workers_display: 5
          },
          vscode: {
            status_location: 'statusbar',
            use_terminal_api: false
          }
        }
      };

      jest.spyOn(configManager, 'loadConfig').mockResolvedValue(mockExistingConfig);
      const saveSpy = jest.spyOn(configManager, 'saveConfig').mockResolvedValue();

      await configManager.saveUserPreference('tmux', {
        tmux: { split_direction: 'horizontal', split_size: 30 }
      });

      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          terminal: expect.objectContaining({
            preferred_mode: 'tmux',
            auto_setup: true,
            tmux: expect.objectContaining({
              split_direction: 'horizontal',
              split_size: 30
            })
          })
        })
      );
    });

    it('should save vscode preference', async () => {
      const mockExistingConfig: OrchFlowConfigData = {
        terminal: {
          preferred_mode: 'auto',
          auto_setup: false,
          tmux: {
            split_direction: 'horizontal',
            split_size: 30,
            status_position: 'right',
            respect_layout: false
          },
          status: {
            update_interval: 1000,
            show_resources: true,
            show_details: true,
            max_workers_display: 10
          },
          vscode: {
            status_location: 'terminal',
            use_terminal_api: true
          }
        }
      };

      jest.spyOn(configManager, 'loadConfig').mockResolvedValue(mockExistingConfig);
      const saveSpy = jest.spyOn(configManager, 'saveConfig').mockResolvedValue();

      await configManager.saveUserPreference('vscode', {
        vscode: { status_location: 'statusbar', use_terminal_api: false }
      });

      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          terminal: expect.objectContaining({
            preferred_mode: 'vscode',
            auto_setup: true,
            vscode: expect.objectContaining({
              status_location: 'statusbar',
              use_terminal_api: false
            })
          })
        })
      );
    });

    it('should handle preference save errors', async () => {
      jest.spyOn(configManager, 'loadConfig').mockRejectedValue(new Error('Load failed'));

      await expect(
        configManager.saveUserPreference('tmux', {})
      ).rejects.toThrow('Load failed');
    });
  });

  describe('default configuration', () => {
    it('should provide correct default values', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const config = await configManager.loadConfig();

      expect(config.terminal.preferred_mode).toBe('auto');
      expect(config.terminal.auto_setup).toBe(false);
      expect(config.terminal.tmux.split_direction).toBe('horizontal');
      expect(config.terminal.tmux.split_size).toBe(30);
      expect(config.terminal.tmux.status_position).toBe('right');
      expect(config.terminal.tmux.respect_layout).toBe(false);
      expect(config.terminal.status.update_interval).toBe(1000);
      expect(config.terminal.status.show_resources).toBe(true);
      expect(config.terminal.status.show_details).toBe(true);
      expect(config.terminal.status.max_workers_display).toBe(10);
      expect(config.terminal.vscode.status_location).toBe('terminal');
      expect(config.terminal.vscode.use_terminal_api).toBe(true);
    });
  });

  describe('validation', () => {
    it('should validate config structure', async () => {
      const invalidConfig = {
        terminal: {
          preferred_mode: 'invalid_mode',
          auto_setup: 'not_boolean',
          tmux: {
            split_direction: 'diagonal', // invalid
            split_size: 'large' // invalid
          }
        }
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('yaml content');
      mockYaml.load.mockReturnValue(invalidConfig);

      const config = await configManager.loadConfig();

      // Should fallback to defaults for invalid values
      expect(config.terminal.preferred_mode).toBe('auto');
      expect(config.terminal.auto_setup).toBe(false);
    });
  });

  describe('memory usage', () => {
    it('should maintain low memory footprint', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform multiple operations
      for (let i = 0; i < 100; i++) {
        mockFs.existsSync.mockReturnValue(false);
        await configManager.loadConfig();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Should use less than 10MB additional memory
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});