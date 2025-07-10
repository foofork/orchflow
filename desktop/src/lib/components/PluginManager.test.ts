import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import PluginManager from './PluginManager.svelte';
import { plugins, loadedPlugins } from '$lib/stores/manager';
import { managerClient } from '$lib/api/manager-client';

// Mock the stores
vi.mock('$lib/stores/manager', () => {
  const { writable } = require('svelte/store');
  const pluginsStore = writable([]);
  const loadedPluginsStore = writable([]);
  
  return {
    plugins: pluginsStore,
    loadedPlugins: loadedPluginsStore
  };
});

// Mock the manager client
vi.mock('$lib/api/manager-client', () => ({
  managerClient: {
    getPluginMetadata: vi.fn()
  }
}));

// Create a mock manager global
const mockManager = {
  refreshPlugins: vi.fn(),
  loadPlugin: vi.fn(),
  unloadPlugin: vi.fn()
};
global.manager = mockManager;

describe('PluginManager', () => {
  const mockPlugins = [
    {
      id: 'git-integration',
      name: 'Git Integration',
      version: '1.0.0',
      description: 'Git version control integration',
      author: { name: 'Orchflow Team' },
      loaded: true,
      status: 'loaded'
    },
    {
      id: 'docker-tools',
      name: 'Docker Tools',
      version: '2.1.0',
      description: 'Docker container management',
      author: { name: 'Docker Community' },
      loaded: false,
      status: 'unloaded'
    },
    {
      id: 'k8s-manager',
      name: 'Kubernetes Manager',
      version: '1.5.0',
      description: 'Kubernetes cluster management',
      author: { name: 'K8s Team' },
      loaded: false,
      status: 'unloaded'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    plugins.set([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render plugin manager header', () => {
      const { getByText } = render(PluginManager);
      expect(getByText('Plugin Manager')).toBeTruthy();
    });

    it('should render refresh button', () => {
      const { getByText } = render(PluginManager);
      expect(getByText('Refresh')).toBeTruthy();
    });

    it('should render empty state when no plugins', () => {
      const { getByText } = render(PluginManager);
      expect(getByText('No plugins installed')).toBeTruthy();
      expect(getByText('Install plugins to extend Orchflow\'s functionality')).toBeTruthy();
    });

    it('should render plugin cards when plugins exist', async () => {
      plugins.set(mockPlugins);
      
      const { getByText, container } = render(PluginManager);
      
      await waitFor(() => {
        expect(getByText('Git Integration')).toBeTruthy();
        expect(getByText('Docker Tools')).toBeTruthy();
        expect(getByText('Kubernetes Manager')).toBeTruthy();
      });
      
      const pluginCards = container.querySelectorAll('.plugin-card');
      expect(pluginCards.length).toBe(3);
    });

    it('should show version and author information', async () => {
      plugins.set([mockPlugins[0]]);
      
      const { getByText } = render(PluginManager);
      
      await waitFor(() => {
        expect(getByText('v1.0.0')).toBeTruthy();
        expect(getByText('by Orchflow Team')).toBeTruthy();
      });
    });

    it('should apply enabled class to loaded plugins', async () => {
      plugins.set(mockPlugins);
      
      const { container } = render(PluginManager);
      
      await waitFor(() => {
        const pluginCards = container.querySelectorAll('.plugin-card');
        expect(pluginCards[0]?.classList.contains('enabled')).toBe(true);
        expect(pluginCards[1]?.classList.contains('enabled')).toBe(false);
      });
    });
  });

  describe('Plugin Icons', () => {
    it('should show appropriate icons for different plugin types', async () => {
      plugins.set(mockPlugins);
      
      const { container } = render(PluginManager);
      
      await waitFor(() => {
        const icons = container.querySelectorAll('.plugin-icon');
        expect(icons[0]?.textContent).toBe('🔀'); // git
        expect(icons[1]?.textContent).toBe('🐳'); // docker
        expect(icons[2]?.textContent).toBe('☸️'); // k8s
      });
    });

    it('should show default icon for unknown plugin types', async () => {
      plugins.set([{
        ...mockPlugins[0],
        id: 'unknown-plugin',
        name: 'Unknown Plugin'
      }]);
      
      const { container } = render(PluginManager);
      
      await waitFor(() => {
        const icon = container.querySelector('.plugin-icon');
        expect(icon?.textContent).toBe('🔌');
      });
    });
  });

  describe('Plugin Actions', () => {
    it('should refresh plugins on button click', async () => {
      const { getByText } = render(PluginManager);
      
      const refreshButton = getByText('Refresh');
      await fireEvent.click(refreshButton);
      
      expect(mockManager.refreshPlugins).toHaveBeenCalled();
    });

    it('should disable refresh button while loading', async () => {
      mockManager.refreshPlugins.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      const { getByText } = render(PluginManager);
      
      const refreshButton = getByText('Refresh') as HTMLButtonElement;
      await fireEvent.click(refreshButton);
      
      expect(refreshButton.disabled).toBe(true);
      
      await waitFor(() => {
        expect(refreshButton.disabled).toBe(false);
      });
    });

    it('should toggle plugin on toggle button click', async () => {
      plugins.set(mockPlugins);
      
      const { container } = render(PluginManager);
      
      await waitFor(() => {
        const toggleButtons = container.querySelectorAll('.toggle-button');
        expect(toggleButtons.length).toBe(3);
      });
      
      // Click on loaded plugin (should unload)
      const toggleButtons = container.querySelectorAll('.toggle-button');
      await fireEvent.click(toggleButtons[0]);
      
      expect(mockManager.unloadPlugin).toHaveBeenCalledWith('git-integration');
      
      // Click on unloaded plugin (should load)
      await fireEvent.click(toggleButtons[1]);
      
      expect(mockManager.loadPlugin).toHaveBeenCalledWith('docker-tools');
    });

    it('should show error when plugin toggle fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockManager.loadPlugin.mockRejectedValue(new Error('Failed to load'));
      
      plugins.set([mockPlugins[1]]);
      
      const { container } = render(PluginManager);
      
      await waitFor(() => {
        const toggleButton = container.querySelector('.toggle-button');
        expect(toggleButton).toBeTruthy();
      });
      
      const toggleButton = container.querySelector('.toggle-button');
      await fireEvent.click(toggleButton!);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to toggle plugin docker-tools:',
          expect.any(Error)
        );
        const error = container.querySelector('.error-message');
        expect(error?.textContent).toBe('Failed to load plugin');
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('Plugin Details Modal', () => {
    it('should open details modal on details button click', async () => {
      plugins.set([mockPlugins[0]]);
      managerClient.getPluginMetadata.mockResolvedValue({
        ...mockPlugins[0],
        capabilities: ['file-access', 'terminal-control'],
        description: 'Full Git integration with staging, commits, and history'
      });
      
      const { getByText, container } = render(PluginManager);
      
      await waitFor(() => {
        const detailsButton = getByText('Details');
        expect(detailsButton).toBeTruthy();
      });
      
      const detailsButton = getByText('Details');
      await fireEvent.click(detailsButton);
      
      await waitFor(() => {
        const modal = container.querySelector('.modal');
        expect(modal).toBeTruthy();
        expect(getByText('Git Integration')).toBeTruthy();
      });
    });

    it('should load and display plugin metadata', async () => {
      plugins.set([mockPlugins[0]]);
      managerClient.getPluginMetadata.mockResolvedValue({
        ...mockPlugins[0],
        author: 'Extended Author Info',
        capabilities: ['file-access', 'terminal-control'],
        description: 'Extended description with more details'
      });
      
      const { getByText, container } = render(PluginManager);
      
      const detailsButton = getByText('Details');
      await fireEvent.click(detailsButton);
      
      await waitFor(() => {
        expect(managerClient.getPluginMetadata).toHaveBeenCalledWith('git-integration');
        expect(getByText('Extended Author Info')).toBeTruthy();
        expect(getByText('file-access')).toBeTruthy();
        expect(getByText('terminal-control')).toBeTruthy();
        expect(getByText('Extended description with more details')).toBeTruthy();
      });
    });

    it('should close modal on close button click', async () => {
      plugins.set([mockPlugins[0]]);
      
      const { getByText, container, queryByText } = render(PluginManager);
      
      const detailsButton = getByText('Details');
      await fireEvent.click(detailsButton);
      
      await waitFor(() => {
        const closeButton = container.querySelector('.close-button');
        expect(closeButton).toBeTruthy();
      });
      
      const closeButton = container.querySelector('.close-button');
      await fireEvent.click(closeButton!);
      
      await waitFor(() => {
        const modal = container.querySelector('.modal');
        expect(modal).toBeFalsy();
      });
    });

    it('should close modal on overlay click', async () => {
      plugins.set([mockPlugins[0]]);
      
      const { getByText, container } = render(PluginManager);
      
      const detailsButton = getByText('Details');
      await fireEvent.click(detailsButton);
      
      await waitFor(() => {
        const overlay = container.querySelector('.modal-overlay');
        expect(overlay).toBeTruthy();
      });
      
      const overlay = container.querySelector('.modal-overlay');
      await fireEvent.click(overlay!);
      
      await waitFor(() => {
        const modal = container.querySelector('.modal');
        expect(modal).toBeFalsy();
      });
    });

    it('should toggle plugin from modal', async () => {
      plugins.set([mockPlugins[0]]);
      
      const { getByText, container } = render(PluginManager);
      
      const detailsButton = getByText('Details');
      await fireEvent.click(detailsButton);
      
      await waitFor(() => {
        const actionButton = getByText('Disable Plugin');
        expect(actionButton).toBeTruthy();
      });
      
      const actionButton = getByText('Disable Plugin');
      await fireEvent.click(actionButton);
      
      expect(mockManager.unloadPlugin).toHaveBeenCalledWith('git-integration');
    });
  });

  describe('Loading States', () => {
    it('should show loading spinner when refreshing empty plugins', async () => {
      mockManager.refreshPlugins.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      const { container, getByText } = render(PluginManager);
      
      const refreshButton = getByText('Refresh');
      await fireEvent.click(refreshButton);
      
      const loading = container.querySelector('.loading');
      expect(loading).toBeTruthy();
      expect(getByText('Loading plugins...')).toBeTruthy();
    });

    it('should show spinning icon on refresh button', async () => {
      mockManager.refreshPlugins.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      const { container, getByText } = render(PluginManager);
      
      const refreshButton = getByText('Refresh');
      await fireEvent.click(refreshButton);
      
      const icon = container.querySelector('.icon.spinning');
      expect(icon).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when refresh fails', async () => {
      mockManager.refreshPlugins.mockRejectedValue(new Error('Network error'));
      
      const { getByText, container } = render(PluginManager);
      
      const refreshButton = getByText('Refresh');
      await fireEvent.click(refreshButton);
      
      await waitFor(() => {
        const error = container.querySelector('.error-message');
        expect(error?.textContent).toBe('Failed to refresh plugins');
      });
    });

    it('should handle metadata loading failure gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      plugins.set([mockPlugins[0]]);
      managerClient.getPluginMetadata.mockRejectedValue(new Error('Failed to load metadata'));
      
      const { getByText, container } = render(PluginManager);
      
      const detailsButton = getByText('Details');
      await fireEvent.click(detailsButton);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to load plugin metadata:', expect.any(Error));
        // Modal should still open even if metadata fails
        const modal = container.querySelector('.modal');
        expect(modal).toBeTruthy();
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('Status Indicators', () => {
    it('should show correct status colors', async () => {
      plugins.set([
        { ...mockPlugins[0], status: 'loaded' },
        { ...mockPlugins[1], status: 'error' },
        { ...mockPlugins[2], status: 'unloaded' }
      ]);
      
      const { container } = render(PluginManager);
      
      await waitFor(() => {
        const indicators = container.querySelectorAll('.status-indicator');
        expect(indicators.length).toBe(3);
      });
      
      const indicators = container.querySelectorAll('.status-indicator') as NodeListOf<HTMLElement>;
      expect(indicators[0].style.backgroundColor).toBe('#10b981'); // green
      expect(indicators[1].style.backgroundColor).toBe('#ef4444'); // red
      expect(indicators[2].style.backgroundColor).toBe('#6b7280'); // gray
    });
  });
});