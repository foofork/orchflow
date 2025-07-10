import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import ExtensionsPanel from './ExtensionsPanel.svelte';

describe('ExtensionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('renders extensions panel', () => {
      const { container } = render(ExtensionsPanel);

      expect(container.querySelector('.extensions-panel')).toBeTruthy();
      expect(container.querySelector('.search-bar')).toBeTruthy();
      expect(container.querySelector('.extension-tabs')).toBeTruthy();
      expect(container.querySelector('.extension-list')).toBeTruthy();
    });

    it('shows loading state initially', () => {
      const { container } = render(ExtensionsPanel);

      expect(container.querySelector('.loading')).toBeTruthy();
      expect(container.querySelector('.loading')?.textContent).toBe('Loading extensions...');
    });

    it('renders extension tabs', () => {
      const { container } = render(ExtensionsPanel);

      const tabs = container.querySelectorAll('.tab');
      expect(tabs.length).toBe(3);
      expect(tabs[0].textContent).toBe('Installed');
      expect(tabs[1].textContent).toBe('Marketplace');
      expect(tabs[2].textContent).toBe('Recommended');
      expect(tabs[0].classList.contains('active')).toBe(true);
    });

    it('renders search input', () => {
      const { container } = render(ExtensionsPanel);

      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      expect(searchInput).toBeTruthy();
      expect(searchInput.placeholder).toBe('Search extensions...');
    });
  });

  describe('Extension Loading', () => {
    it('loads and displays extensions after timeout', async () => {
      const { container } = render(ExtensionsPanel);

      // Initially shows loading
      expect(container.querySelector('.loading')).toBeTruthy();

      // Fast-forward timer
      vi.advanceTimersByTime(300);
      
      // Wait for extensions to render
      await waitFor(() => {
        const extensions = container.querySelectorAll('.extension-item');
        expect(extensions.length).toBe(4);
      });

      // Check first extension
      const firstExtension = container.querySelector('.extension-item');
      expect(firstExtension?.querySelector('.extension-name')?.textContent).toBe('Vim Mode');
      expect(firstExtension?.querySelector('.extension-meta')?.textContent).toContain('OrchFlow Team');
      expect(firstExtension?.querySelector('.extension-meta')?.textContent).toContain('v1.0.0');
      expect(firstExtension?.querySelector('.extension-description')?.textContent).toBe('Vim emulation for OrchFlow');
    });

    it('displays installed extensions with correct styling', async () => {
      const { container } = render(ExtensionsPanel);

      vi.advanceTimersByTime(300);
      
      await waitFor(() => {
        const extensions = container.querySelectorAll('.extension-item');
        expect(extensions.length).toBe(4);
      });

      // First two should be installed
      const extensions = container.querySelectorAll('.extension-item');
      expect(extensions[0].classList.contains('installed')).toBe(true);
      expect(extensions[1].classList.contains('installed')).toBe(true);
      expect(extensions[2].classList.contains('installed')).toBe(false);
      expect(extensions[3].classList.contains('installed')).toBe(false);
    });
  });

  describe('Search Functionality', () => {
    it('filters extensions by name', async () => {
      const { container } = render(ExtensionsPanel);

      vi.advanceTimersByTime(300);
      
      await waitFor(() => {
        const extensions = container.querySelectorAll('.extension-item');
        expect(extensions.length).toBe(4);
      });

      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      await fireEvent.input(searchInput, { target: { value: 'vim' } });

      await waitFor(() => {
        const extensions = container.querySelectorAll('.extension-item');
        expect(extensions.length).toBe(1);
        expect(extensions[0].querySelector('.extension-name')?.textContent).toBe('Vim Mode');
      });
    });

    it('filters extensions by description', async () => {
      const { container } = render(ExtensionsPanel);

      vi.advanceTimersByTime(300);
      
      await waitFor(() => {
        const extensions = container.querySelectorAll('.extension-item');
        expect(extensions.length).toBe(4);
      });

      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      await fireEvent.input(searchInput, { target: { value: 'formatter' } });

      await waitFor(() => {
        const extensions = container.querySelectorAll('.extension-item');
        expect(extensions.length).toBe(1);
        expect(extensions[0].querySelector('.extension-name')?.textContent).toBe('Prettier');
      });
    });

    it('shows empty state when no extensions match', async () => {
      const { container } = render(ExtensionsPanel);

      vi.advanceTimersByTime(300);
      
      await waitFor(() => {
        const extensions = container.querySelectorAll('.extension-item');
        expect(extensions.length).toBe(4);
      });

      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      await fireEvent.input(searchInput, { target: { value: 'nonexistent' } });

      await waitFor(() => {
        expect(container.querySelector('.empty')).toBeTruthy();
        expect(container.querySelector('.empty')?.textContent).toBe('No extensions found');
      });
    });

    it('performs case-insensitive search', async () => {
      const { container } = render(ExtensionsPanel);

      vi.advanceTimersByTime(300);
      
      await waitFor(() => {
        const extensions = container.querySelectorAll('.extension-item');
        expect(extensions.length).toBe(4);
      });

      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      await fireEvent.input(searchInput, { target: { value: 'RUST' } });

      await waitFor(() => {
        const extensions = container.querySelectorAll('.extension-item');
        expect(extensions.length).toBe(1);
        expect(extensions[0].querySelector('.extension-name')?.textContent).toBe('Rust Analyzer');
      });
    });
  });

  describe('Extension Actions', () => {
    it('shows toggle button for installed extensions', async () => {
      const { container } = render(ExtensionsPanel);

      vi.advanceTimersByTime(300);
      
      await waitFor(() => {
        const extensions = container.querySelectorAll('.extension-item');
        expect(extensions.length).toBe(4);
      });

      const installedExtensions = container.querySelectorAll('.extension-item.installed');
      installedExtensions.forEach(ext => {
        expect(ext.querySelector('.toggle-btn')).toBeTruthy();
        expect(ext.querySelector('.install-btn')).toBeFalsy();
      });
    });

    it('shows install button for non-installed extensions', async () => {
      const { container } = render(ExtensionsPanel);

      vi.advanceTimersByTime(300);
      
      await waitFor(() => {
        const extensions = container.querySelectorAll('.extension-item');
        expect(extensions.length).toBe(4);
      });

      const nonInstalledExtensions = container.querySelectorAll('.extension-item:not(.installed)');
      nonInstalledExtensions.forEach(ext => {
        expect(ext.querySelector('.install-btn')).toBeTruthy();
        expect(ext.querySelector('.toggle-btn')).toBeFalsy();
      });
    });

    it('toggles extension enabled state', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { container } = render(ExtensionsPanel);

      vi.advanceTimersByTime(300);
      
      await waitFor(() => {
        const extensions = container.querySelectorAll('.extension-item');
        expect(extensions.length).toBe(4);
      });

      // First extension (Vim Mode) is enabled by default
      const toggleBtn = container.querySelector('.toggle-btn') as HTMLButtonElement;
      expect(toggleBtn.classList.contains('enabled')).toBe(true);
      expect(toggleBtn.textContent).toBe('✓');

      // Click to disable
      await fireEvent.click(toggleBtn);

      expect(toggleBtn.classList.contains('enabled')).toBe(false);
      expect(toggleBtn.textContent).toBe('○');
      expect(consoleSpy).toHaveBeenCalledWith('Extension vim-mode disabled');

      // Click to enable again
      await fireEvent.click(toggleBtn);

      expect(toggleBtn.classList.contains('enabled')).toBe(true);
      expect(toggleBtn.textContent).toBe('✓');
      expect(consoleSpy).toHaveBeenCalledWith('Extension vim-mode enabled');

      consoleSpy.mockRestore();
    });

    it('installs extension when install button clicked', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { container } = render(ExtensionsPanel);

      vi.advanceTimersByTime(300);
      
      await waitFor(() => {
        const extensions = container.querySelectorAll('.extension-item');
        expect(extensions.length).toBe(4);
      });

      // Find Prettier extension (not installed)
      const prettierExtension = Array.from(container.querySelectorAll('.extension-item'))
        .find(el => el.querySelector('.extension-name')?.textContent === 'Prettier');
      
      expect(prettierExtension).toBeTruthy();
      expect(prettierExtension?.classList.contains('installed')).toBe(false);

      const installBtn = prettierExtension?.querySelector('.install-btn') as HTMLButtonElement;
      await fireEvent.click(installBtn);

      expect(consoleSpy).toHaveBeenCalledWith('Installing extension prettier...');

      // Fast-forward installation simulation
      vi.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(prettierExtension?.classList.contains('installed')).toBe(true);
        expect(prettierExtension?.querySelector('.toggle-btn')).toBeTruthy();
        expect(prettierExtension?.querySelector('.install-btn')).toBeFalsy();
      });

      consoleSpy.mockRestore();
    });

    it('does not toggle uninstalled extensions', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { container } = render(ExtensionsPanel);

      vi.advanceTimersByTime(300);
      
      await waitFor(() => {
        const extensions = container.querySelectorAll('.extension-item');
        expect(extensions.length).toBe(4);
      });

      // Uninstalled extensions shouldn't have toggle buttons
      const uninstalledExtensions = container.querySelectorAll('.extension-item:not(.installed)');
      uninstalledExtensions.forEach(ext => {
        expect(ext.querySelector('.toggle-btn')).toBeFalsy();
      });

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('UI States', () => {
    it('shows correct title attribute on toggle button', async () => {
      const { container } = render(ExtensionsPanel);

      vi.advanceTimersByTime(300);
      
      await waitFor(() => {
        const extensions = container.querySelectorAll('.extension-item');
        expect(extensions.length).toBe(4);
      });

      const toggleBtn = container.querySelector('.toggle-btn') as HTMLButtonElement;
      
      // Initially enabled
      expect(toggleBtn.title).toBe('Disable');

      // Click to disable
      await fireEvent.click(toggleBtn);
      expect(toggleBtn.title).toBe('Enable');
    });

    it('maintains extension state after filtering', async () => {
      const { container } = render(ExtensionsPanel);

      vi.advanceTimersByTime(300);
      
      await waitFor(() => {
        const extensions = container.querySelectorAll('.extension-item');
        expect(extensions.length).toBe(4);
      });

      // Disable Vim Mode
      const toggleBtn = container.querySelector('.toggle-btn') as HTMLButtonElement;
      await fireEvent.click(toggleBtn);
      expect(toggleBtn.classList.contains('enabled')).toBe(false);

      // Filter
      const searchInput = container.querySelector('.search-input') as HTMLInputElement;
      await fireEvent.input(searchInput, { target: { value: 'rust' } });

      // Clear filter
      await fireEvent.input(searchInput, { target: { value: '' } });

      // Vim Mode should still be disabled
      await waitFor(() => {
        const vimToggle = container.querySelector('.toggle-btn') as HTMLButtonElement;
        expect(vimToggle.classList.contains('enabled')).toBe(false);
      });
    });
  });
});