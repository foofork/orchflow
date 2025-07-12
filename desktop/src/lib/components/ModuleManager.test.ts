import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import ModuleManager from './ModuleManager.svelte';
import { createAsyncMock } from '@/test/mock-factory';

// Mock moduleClient
vi.mock('$lib/tauri/modules', () => ({
  moduleClient: {
    scanModules: createAsyncMock<[], void>(undefined),
    listModules: createAsyncMock<[], any[]>([]),
    enableModule: createAsyncMock<[string, boolean], void>(undefined)
  }
}));

describe('ModuleManager', () => {
  let cleanup: Array<() => void> = [];

  const mockModules = [
    {
      name: 'vim-mode',
      version: '1.0.0',
      description: 'Vim key bindings for OrchFlow',
      author: 'OrchFlow Team',
      module_type: 'command',
      permissions: ['editor', 'terminal'],
      dependencies: []
    },
    {
      name: 'dark-theme',
      version: '2.1.0',
      description: 'Dark theme for OrchFlow',
      author: 'Theme Designer',
      module_type: 'theme',
      permissions: [],
      dependencies: [{ name: 'base-theme', version: '1.0.0' }]
    },
    {
      name: 'ai-assistant',
      version: '0.5.0',
      description: 'AI coding assistant',
      author: 'AI Labs',
      module_type: 'agent',
      permissions: ['file_system', 'network', 'process'],
      dependencies: []
    }
  ];

  let mockModuleClient: {
    scanModules: any;
    listModules: any;
    enableModule: any;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    cleanup = [];
    const { moduleClient } = await import('$lib/tauri/modules');
    mockModuleClient = moduleClient as any;
    mockModuleClient.scanModules.mockResolvedValue(undefined);
    mockModuleClient.listModules.mockResolvedValue(mockModules);
    mockModuleClient.enableModule.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup.forEach(fn => fn());
  });

  describe('Rendering', () => {
    it('renders module manager', () => {
      const { container, unmount } = render(ModuleManager);
      cleanup.push(unmount);

      expect(container.querySelector('.module-manager')).toBeTruthy();
      expect(container.querySelector('.header')).toBeTruthy();
      expect(container.querySelector('h2')?.textContent).toBe('Modules');
    });

    it('shows loading state initially', () => {
      const { container, unmount } = render(ModuleManager);
      cleanup.push(unmount);

      expect(container.querySelector('.loading')).toBeTruthy();
      expect(container.querySelector('.loading')?.textContent).toContain('Loading modules...');
    });

    it('renders refresh button', () => {
      const { container, unmount } = render(ModuleManager);
      cleanup.push(unmount);

      const refreshBtn = container.querySelector('.refresh-button');
      expect(refreshBtn).toBeTruthy();
      expect(refreshBtn?.textContent).toContain('🔄 Refresh');
    });
  });

  describe('Module Loading', () => {
    it('loads modules on mount', async () => {
      const { unmount } = render(ModuleManager);
      cleanup.push(unmount);

      await waitFor(() => {
        expect(mockModuleClient.scanModules).toHaveBeenCalledTimes(1);
        expect(mockModuleClient.listModules).toHaveBeenCalledTimes(1);
      });
    });

    it('displays modules after loading', async () => {
      const { container, unmount } = render(ModuleManager);
      cleanup.push(unmount);

      await waitFor(() => {
        const moduleCards = container.querySelectorAll('.module-card');
        expect(moduleCards.length).toBe(3);
      });

      // Check first module
      const firstModule = container.querySelector('.module-card');
      expect(firstModule?.querySelector('h3')?.textContent).toBe('vim-mode');
      expect(firstModule?.querySelector('.module-version')?.textContent).toBe('v1.0.0');
      expect(firstModule?.querySelector('.module-description')?.textContent).toBe('Vim key bindings for OrchFlow');
      expect(firstModule?.querySelector('.module-author')?.textContent).toBe('by OrchFlow Team');
    });

    it('handles loading error', async () => {
      mockModuleClient.scanModules.mockRejectedValueOnce(new Error('Failed to scan'));
      
      const { container, unmount } = render(ModuleManager);
      cleanup.push(unmount);

      await waitFor(() => {
        const error = container.querySelector('.error');
        expect(error).toBeTruthy();
        expect(error?.textContent).toContain('Error: Error: Failed to scan');
      });
    });

    it('shows empty state when no modules', async () => {
      mockModuleClient.listModules.mockResolvedValueOnce([]);
      
      const { container, unmount } = render(ModuleManager);
      cleanup.push(unmount);

      await waitFor(() => {
        const empty = container.querySelector('.empty');
        expect(empty).toBeTruthy();
        expect(empty?.querySelector('p')?.textContent).toBe('No modules found');
        expect(empty?.querySelector('.hint')?.textContent).toBe('Place modules in the modules directory');
      });
    });
  });

  describe('Module Display', () => {
    it('displays correct module type icons', async () => {
      const { container, unmount } = render(ModuleManager);
      cleanup.push(unmount);

      await waitFor(() => {
        const moduleCards = container.querySelectorAll('.module-card');
        expect(moduleCards.length).toBe(3);
      });

      const moduleIcons = container.querySelectorAll('.module-icon');
      expect(moduleIcons[0].textContent).toBe('⚡'); // command
      expect(moduleIcons[1].textContent).toBe('🎨'); // theme
      expect(moduleIcons[2].textContent).toBe('🤖'); // agent
    });

    it('displays module permissions', async () => {
      const { container, unmount } = render(ModuleManager);
      cleanup.push(unmount);

      await waitFor(() => {
        const moduleCards = container.querySelectorAll('.module-card');
        expect(moduleCards.length).toBe(3);
      });

      // First module permissions
      const firstModule = container.querySelector('.module-card');
      const permissions = firstModule?.querySelectorAll('.permission');
      expect(permissions?.length).toBe(2);
      expect((permissions?.[0] as HTMLElement).title).toBe('editor');
      expect((permissions?.[1] as HTMLElement).title).toBe('terminal');
    });

    it('displays module dependencies', async () => {
      const { container, unmount } = render(ModuleManager);
      cleanup.push(unmount);

      await waitFor(() => {
        const moduleCards = container.querySelectorAll('.module-card');
        expect(moduleCards.length).toBe(3);
      });

      // Second module has dependencies
      const secondModule = container.querySelectorAll('.module-card')[1];
      const deps = secondModule.querySelector('.module-dependencies');
      expect(deps).toBeTruthy();
      expect(deps?.querySelector('.dependency')?.textContent).toBe('base-theme@1.0.0');
    });

    it('hides permissions section when module has no permissions', async () => {
      const { container, unmount } = render(ModuleManager);
      cleanup.push(unmount);

      await waitFor(() => {
        const moduleCards = container.querySelectorAll('.module-card');
        expect(moduleCards.length).toBe(3);
      });

      // Second module (theme) has no permissions
      const secondModule = container.querySelectorAll('.module-card')[1];
      expect(secondModule.querySelector('.module-permissions')).toBeFalsy();
    });

    it('hides dependencies section when module has no dependencies', async () => {
      const { container, unmount } = render(ModuleManager);
      cleanup.push(unmount);

      await waitFor(() => {
        const moduleCards = container.querySelectorAll('.module-card');
        expect(moduleCards.length).toBe(3);
      });

      // First module has no dependencies
      const firstModule = container.querySelector('.module-card');
      expect(firstModule?.querySelector('.module-dependencies')).toBeFalsy();
    });
  });

  describe('Module Actions', () => {
    it('toggles module when checkbox changed', async () => {
      const { container, unmount } = render(ModuleManager);
      cleanup.push(unmount);

      await waitFor(() => {
        const moduleCards = container.querySelectorAll('.module-card');
        expect(moduleCards.length).toBe(3);
      });

      const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);

      // Uncheck to disable
      await fireEvent.click(checkbox);

      expect(mockModuleClient.enableModule).toHaveBeenCalledWith('vim-mode', false);
      
      // Should reload modules after toggle
      await waitFor(() => {
        expect(mockModuleClient.scanModules).toHaveBeenCalledTimes(2);
        expect(mockModuleClient.listModules).toHaveBeenCalledTimes(2);
      });
    });

    it('handles toggle error gracefully', async () => {
      mockModuleClient.enableModule.mockRejectedValueOnce(new Error('Failed to toggle'));
      
      const { container, unmount } = render(ModuleManager);
      cleanup.push(unmount);

      await waitFor(() => {
        const moduleCards = container.querySelectorAll('.module-card');
        expect(moduleCards.length).toBe(3);
      });

      const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
      await fireEvent.click(checkbox);

      await waitFor(() => {
        const error = container.querySelector('.error');
        expect(error).toBeTruthy();
        expect(error?.textContent).toContain('Error: Error: Failed to toggle');
      });
    });

    it('refreshes modules when refresh button clicked', async () => {
      const { container, unmount } = render(ModuleManager);
      cleanup.push(unmount);

      await waitFor(() => {
        const moduleCards = container.querySelectorAll('.module-card');
        expect(moduleCards.length).toBe(3);
      });

      // Clear previous calls
      vi.clearAllMocks();

      const refreshBtn = container.querySelector('.refresh-button') as HTMLButtonElement;
      await fireEvent.click(refreshBtn);

      expect(mockModuleClient.scanModules).toHaveBeenCalledTimes(1);
      expect(mockModuleClient.listModules).toHaveBeenCalledTimes(1);
    });

    it('disables refresh button while loading', async () => {
      const { container, unmount } = render(ModuleManager);
      cleanup.push(unmount);

      // Initially disabled while loading
      const refreshBtn = container.querySelector('.refresh-button') as HTMLButtonElement;
      expect(refreshBtn.disabled).toBe(true);

      // Wait for loading to complete
      await waitFor(() => {
        expect(refreshBtn.disabled).toBe(false);
      });
    });
  });

  describe('Module Type Handling', () => {
    it('displays correct module type text', async () => {
      const { container, unmount } = render(ModuleManager);
      cleanup.push(unmount);

      await waitFor(() => {
        const moduleCards = container.querySelectorAll('.module-card');
        expect(moduleCards.length).toBe(3);
      });

      const moduleTypes = container.querySelectorAll('.module-type .value');
      expect(moduleTypes[0].textContent).toBe('command');
      expect(moduleTypes[1].textContent).toBe('theme');
      expect(moduleTypes[2].textContent).toBe('agent');
    });
  });

  describe('Permission Icons', () => {
    it('displays correct permission icons', async () => {
      const { container, unmount } = render(ModuleManager);
      cleanup.push(unmount);

      await waitFor(() => {
        const moduleCards = container.querySelectorAll('.module-card');
        expect(moduleCards.length).toBe(3);
      });

      // AI Assistant module has file_system, network, process permissions
      const aiModule = container.querySelectorAll('.module-card')[2];
      const permissions = aiModule.querySelectorAll('.permission');
      
      expect(permissions[0].textContent?.trim()).toBe('📁'); // file_system
      expect(permissions[1].textContent?.trim()).toBe('🌐'); // network
      expect(permissions[2].textContent?.trim()).toBe('⚙️'); // process
    });
  });
});