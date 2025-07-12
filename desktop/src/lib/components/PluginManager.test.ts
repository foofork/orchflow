import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import PluginManager from './PluginManager.svelte';
import { createMockManagerStore, createMockPlugin } from '$test/utils/mock-manager-store';
import { managerClient } from '$lib/api/manager-client';

// Create mock stores
const mockManagerStore = createMockManagerStore();
const { plugins, loadedPlugins, manager } = mockManagerStore;

// Mock the stores module
vi.mock('$lib/stores/manager', () => ({
  plugins: mockManagerStore.plugins,
  loadedPlugins: mockManagerStore.loadedPlugins,
  manager: mockManagerStore.manager
}));

// Mock the manager client
vi.mock('$lib/api/manager-client', () => ({
  managerClient: {
    getPluginMetadata: vi.fn()
  }
}));

// Create a mock manager global
global.manager = manager;

describe('PluginManager', () => {
  const mockPlugins = [
    createMockPlugin({
      id: 'git-integration',
      name: 'Git Integration',
      version: '1.0.0',
      description: 'Git version control integration',
      author: 'Orchflow Team',
      loaded: true,
      status: 'loaded',
      type: 'core'
    }),
    createMockPlugin({
      id: 'docker-tools',
      name: 'Docker Tools',
      version: '2.1.0',
      description: 'Docker container management',
      author: 'Docker Community',
      loaded: false,
      status: 'unloaded',
      type: 'extension'
    }),
    createMockPlugin({
      id: 'k8s-manager',
      name: 'Kubernetes Manager',
      version: '1.5.0',
      description: 'Kubernetes cluster management',
      author: 'K8s Team',
      loaded: false,
      status: 'unloaded',
      type: 'extension'
    })
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset stores with proper initial values
    mockManagerStore.reset();
    
    // Reset manager mock
    manager.refreshPlugins.mockResolvedValue(undefined);
    manager.loadPlugin.mockResolvedValue(undefined);
    manager.unloadPlugin.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render plugin manager header', () => {
      // Ensure stores are properly initialized before rendering
      mockManagerStore.setPlugins([]);
      
      const { getByText } = render(PluginManager);
      expect(getByText('Plugin Manager')).toBeTruthy();
    });

    it('should render refresh button', () => {
      const { getByTitle } = render(PluginManager);
      expect(getByTitle('Refresh plugin list')).toBeTruthy();
    });

    it('should display empty state when no plugins available', () => {
      const { getByText } = render(PluginManager);
      expect(getByText('No plugins available')).toBeTruthy();
    });

    it('should render plugin cards when plugins exist', async () => {
      mockManagerStore.setPlugins(mockPlugins);
      
      const { getByText, container } = render(PluginManager);
      
      await waitFor(() => {
        expect(getByText('Git Integration')).toBeInTheDocument();
        expect(getByText('Docker Tools')).toBeInTheDocument();
        expect(getByText('Kubernetes Manager')).toBeInTheDocument();
      });
      
      const pluginCards = container.querySelectorAll('.plugin-card');
      expect(pluginCards).toHaveLength(3);
    });

    it('should show version and author information', async () => {
      mockManagerStore.setPlugins([mockPlugins[0]]);
      
      const { getByText } = render(PluginManager);
      
      await waitFor(() => {
        expect(getByText('v1.0.0')).toBeInTheDocument();
        expect(getByText('by Orchflow Team')).toBeInTheDocument();
      });
    });

    it('should apply enabled class to loaded plugins', async () => {
      mockManagerStore.setPlugins(mockPlugins);
      
      const { container } = render(PluginManager);
      
      await waitFor(() => {
        const gitCard = container.querySelector('.plugin-card:has-text("Git Integration")');
        const dockerCard = container.querySelector('.plugin-card:has-text("Docker Tools")');
        
        expect(gitCard?.classList.contains('enabled')).toBe(true);
        expect(dockerCard?.classList.contains('enabled')).toBe(false);
      });
    });
  });

  describe('Plugin Icons', () => {
    it('should show appropriate icons for different plugin types', async () => {
      mockManagerStore.setPlugins(mockPlugins);
      
      const { container } = render(PluginManager);
      
      await waitFor(() => {
        const pluginIcons = container.querySelectorAll('.plugin-icon svg');
        expect(pluginIcons).toHaveLength(3);
        // Icons should be rendered based on plugin type
      });
    });

    it('should show default icon for unknown plugin types', async () => {
      mockManagerStore.setPlugins([createMockPlugin({
        ...mockPlugins[0],
        id: 'unknown-plugin',
        name: 'Unknown Plugin',
        type: 'unknown'
      })]);
      
      const { container } = render(PluginManager);
      
      await waitFor(() => {
        const icon = container.querySelector('.plugin-icon svg');
        expect(icon).toBeInTheDocument();
      });
    });
  });

  describe('Plugin Actions', () => {
    it('should refresh plugins on refresh button click', async () => {
      const { getByTitle } = render(PluginManager);
      const refreshButton = getByTitle('Refresh plugin list');
      
      await fireEvent.click(refreshButton);
      
      expect(manager.refreshPlugins).toHaveBeenCalledOnce();
    });

    it('should rotate refresh icon during refresh', async () => {
      const { getByTitle, container } = render(PluginManager);
      const refreshButton = getByTitle('Refresh plugin list');
      
      await fireEvent.click(refreshButton);
      
      const refreshIcon = container.querySelector('.refresh-icon');
      expect(refreshIcon?.classList.contains('rotating')).toBe(true);
      
      // Wait for refresh to complete
      await waitFor(() => {
        expect(refreshIcon?.classList.contains('rotating')).toBe(false);
      });
    });

    it('should toggle plugin on toggle button click', async () => {
      mockManagerStore.setPlugins(mockPlugins);
      
      const { container } = render(PluginManager);
      
      // Wait for plugins to be rendered
      await waitFor(() => {
        expect(container.querySelector('.plugin-card')).toBeInTheDocument();
      });
      
      // Find the Docker Tools enable button (it's unloaded)
      const pluginCards = container.querySelectorAll('.plugin-card');
      let enableButton;
      pluginCards.forEach(card => {
        if (card.textContent?.includes('Docker Tools')) {
          enableButton = card.querySelector('.toggle-button');
        }
      });
      
      expect(enableButton).toBeTruthy();
      
      // Mock successful loading
      manager.loadPlugin.mockResolvedValue(undefined);
      
      await fireEvent.click(enableButton);
      
      expect(manager.loadPlugin).toHaveBeenCalledWith('docker-tools');
    });

    it('should handle plugin toggle errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      manager.loadPlugin.mockRejectedValue(new Error('Failed to load'));
      
      mockManagerStore.setPlugins([mockPlugins[1]]);
      
      const { container } = render(PluginManager);
      
      // Wait for plugins to be rendered
      await waitFor(() => {
        expect(container.querySelector('.plugin-card')).toBeInTheDocument();
      });
      
      const enableButton = container.querySelector('.toggle-button');
      expect(enableButton).toBeTruthy();
      
      if (enableButton) {
        await fireEvent.click(enableButton);
      }
      
      expect(manager.loadPlugin).toHaveBeenCalledWith('docker-tools');
      expect(consoleSpy).toHaveBeenCalledWith('Failed to toggle plugin:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should unload plugin when toggling off', async () => {
      manager.unloadPlugin.mockResolvedValue(undefined);
      
      const { container } = render(PluginManager);
      // Wait for plugins to be rendered
      await waitFor(() => {
        expect(container.querySelector('.plugin-card')).toBeInTheDocument();
      });
      
      const enableButton = container.querySelector('.toggle-button');
      expect(enableButton).toBeTruthy();
      
      if (enableButton) {
        await fireEvent.click(enableButton);
      }
      
      expect(manager.unloadPlugin).toHaveBeenCalledWith('git-integration');
    });
  });

  describe('Plugin Details Modal', () => {
    it('should open details modal on details button click', async () => {
      mockManagerStore.setPlugins([mockPlugins[0]]);
      managerClient.getPluginMetadata.mockResolvedValue({
        ...mockPlugins[0],
        commands: ['git:status', 'git:commit'],
        keybindings: { 'ctrl+g': 'git:status' },
        settings: {},
        homepage: 'https://example.com',
        repository: 'https://github.com/example/repo'
      });
      
      const { getByText, container } = render(PluginManager);
      
      // Wait for plugin to be rendered
      await waitFor(() => {
        expect(getByText('Git Integration')).toBeInTheDocument();
      });
      
      // Find and click details button
      const detailsButton = container.querySelector('[title="View plugin details"]');
      expect(detailsButton).toBeTruthy();
      
      await fireEvent.click(detailsButton);
      
      // Modal should be open
      await waitFor(() => {
        expect(getByText('Plugin Details')).toBeInTheDocument();
      });
    });

    it('should load and display plugin metadata', async () => {
      mockManagerStore.setPlugins([mockPlugins[0]]);
      managerClient.getPluginMetadata.mockResolvedValue({
        ...mockPlugins[0],
        commands: ['git:status', 'git:commit'],
        keybindings: { 'ctrl+g': 'git:status' },
        settings: {},
        homepage: 'https://example.com',
        repository: 'https://github.com/example/repo'
      });
      
      const { getByText, container } = render(PluginManager);
      const detailsButton = container.querySelector('[title="View plugin details"]');
      
      await fireEvent.click(detailsButton);
      
      await waitFor(() => {
        expect(getByText('Commands')).toBeInTheDocument();
        expect(getByText('git:status')).toBeInTheDocument();
        expect(getByText('git:commit')).toBeInTheDocument();
        expect(getByText('Keybindings')).toBeInTheDocument();
        expect(getByText('ctrl+g')).toBeInTheDocument();
      });
    });

    it('should close modal on close button click', async () => {
      mockManagerStore.setPlugins([mockPlugins[0]]);
      
      const { getByText, container, queryByText } = render(PluginManager);
      const detailsButton = container.querySelector('[title="View plugin details"]');
      
      await fireEvent.click(detailsButton);
      
      // Modal should be open
      await waitFor(() => {
        expect(getByText('Plugin Details')).toBeInTheDocument();
      });
      
      // Find and click close button
      const closeButton = container.querySelector('.modal-close');
      expect(closeButton).toBeTruthy();
      
      await fireEvent.click(closeButton);
      
      // Modal should be closed
      await waitFor(() => {
        expect(queryByText('Plugin Details')).not.toBeInTheDocument();
      });
    });

    it('should close modal on overlay click', async () => {
      mockManagerStore.setPlugins([mockPlugins[0]]);
      
      const { getByText, container } = render(PluginManager);
      const detailsButton = container.querySelector('[title="View plugin details"]');
      
      await fireEvent.click(detailsButton);
      
      // Modal should be open
      await waitFor(() => {
        expect(getByText('Plugin Details')).toBeInTheDocument();
      });
      
      // Click on overlay
      const overlay = container.querySelector('.modal-overlay');
      expect(overlay).toBeTruthy();
      
      await fireEvent.click(overlay);
      
      // Modal should be closed
      await waitFor(() => {
        expect(container.querySelector('.modal-overlay')).not.toBeInTheDocument();
      });
    });

    it('should toggle plugin from modal', async () => {
      mockManagerStore.setPlugins([mockPlugins[0]]);
      
      const { getByText, container } = render(PluginManager);
      const detailsButton = container.querySelector('[title="View plugin details"]');
      
      await fireEvent.click(detailsButton);
      
      // Modal should be open
      await waitFor(() => {
        expect(getByText('Plugin Details')).toBeInTheDocument();
      });
      
      // Mock successful unloading
      manager.unloadPlugin.mockResolvedValue(undefined);
      
      // Find and click disable button
      const disableButton = await waitFor(() => {
        const btn = getByText('Disable');
        return btn;
      });
      
      await fireEvent.click(disableButton);
      
      expect(manager.unloadPlugin).toHaveBeenCalledWith('git-integration');
    });

    it('should handle Escape key to close modal', async () => {
      const { getByText, container, queryByText } = render(PluginManager);
      const detailsButton = container.querySelector('[title="View plugin details"]');
      
      await fireEvent.click(detailsButton);
      
      // Modal should be open
      await waitFor(() => {
        expect(getByText('Plugin Details')).toBeInTheDocument();
      });
      
      // Press Escape
      await fireEvent.keyDown(window, { key: 'Escape' });
      
      // Modal should be closed
      await waitFor(() => {
        expect(queryByText('Plugin Details')).not.toBeInTheDocument();
      });
    });

    it('should handle metadata loading failure gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockManagerStore.setPlugins([mockPlugins[0]]);
      managerClient.getPluginMetadata.mockRejectedValue(new Error('Failed to load metadata'));
      
      const { container } = render(PluginManager);
      const detailsButton = container.querySelector('[title="View plugin details"]');
      
      await fireEvent.click(detailsButton);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to load plugin metadata:', expect.any(Error));
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('Status Indicators', () => {
    it('should show correct status colors', async () => {
      mockManagerStore.setPlugins([
        createMockPlugin({ ...mockPlugins[0], status: 'loaded' }),
        createMockPlugin({ ...mockPlugins[1], status: 'error' }),
        createMockPlugin({ ...mockPlugins[2], status: 'available' })
      ]);
      
      const { container } = render(PluginManager);
      
      await waitFor(() => {
        const statusIndicators = container.querySelectorAll('.plugin-status');
        expect(statusIndicators).toHaveLength(3);
        
        // Check for specific status classes
        const cards = container.querySelectorAll('.plugin-card');
        expect(cards[0]?.querySelector('.status-loaded')).toBeTruthy();
        expect(cards[1]?.querySelector('.status-error')).toBeTruthy();
        expect(cards[2]?.querySelector('.status-available')).toBeTruthy();
      });
    });
  });
});