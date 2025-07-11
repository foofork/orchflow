import { render, fireEvent, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SettingsModal from './SettingsModal.svelte';
import { settings } from '$lib/stores/settings';
import { get } from 'svelte/store';

// Mock the settings store
vi.mock('$lib/stores/settings', () => ({
  settings: {
    subscribe: vi.fn(),
    set: vi.fn(),
    update: vi.fn()
  }
}));

// Mock browser environment
vi.mock('$app/environment', () => ({
  browser: true
}));

// Mock Tauri API
global.window = Object.create(window);
Object.defineProperty(window, '__TAURI__', {
  value: {
    invoke: vi.fn()
  },
  writable: true
});

// Mock dynamic import for Tauri
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn()
}));

describe('SettingsModal', () => {
  let mockSettings: any;
  let onCloseMock: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock settings matching the component's expected flat structure
    mockSettings = {
      // Appearance
      theme: 'dark',
      fontSize: 14,
      fontFamily: 'JetBrains Mono',
      accentColor: '#007acc',
      compactMode: false,
      animations: true,
      // Editor
      tabSize: 2,
      insertSpaces: true,
      wordWrap: false,
      lineNumbers: true,
      minimap: true,
      bracketMatching: true,
      autoSave: true,
      autoSaveDelay: 1000,
      // Terminal
      shell: '/bin/zsh',
      terminalFontSize: 14,
      terminalFontFamily: 'JetBrains Mono',
      scrollback: 1000,
      closeOnExit: true,
      bellStyle: 'none',
      // Git
      gitAutoFetch: true,
      gitFetchInterval: 300,
      gitShowUntracked: true,
      gitDefaultBranch: 'main',
      gitSignCommits: false,
      // Performance
      maxTabs: 20,
      enableVirtualization: true,
      metricsPolling: true,
      logLevel: 'info',
      // Shortcuts
      shortcuts: {
        'command_palette': 'Ctrl+K',
        'quick_open': 'Ctrl+P',
        'toggle_sidebar': 'Ctrl+B',
        'new_terminal': 'Ctrl+`',
        'save_file': 'Ctrl+S',
        'close_tab': 'Ctrl+W',
        'symbol_outline': 'Ctrl+Shift+O',
        'git_panel': 'Ctrl+Shift+G'
      }
    };

    // Mock settings store subscription
    (settings.subscribe as any).mockImplementation((fn: any) => {
      fn(mockSettings);
      return () => {};
    });

    onCloseMock = vi.fn();
  });

  describe('Component Rendering', () => {
    it('should render when isOpen is true', () => {
      render(SettingsModal, { 
        props: { 
          isOpen: true, 
          onClose: onCloseMock 
        } 
      });

      expect(screen.getByText('⚙️ Settings')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      const { container } = render(SettingsModal, { 
        props: { 
          isOpen: false, 
          onClose: onCloseMock 
        } 
      });

      expect(container.querySelector('.settings-modal')).not.toBeInTheDocument();
    });

    it('should render all tab sections', () => {
      render(SettingsModal, { 
        props: { 
          isOpen: true, 
          onClose: onCloseMock 
        } 
      });

      // Check nav items instead of just text to avoid duplicates
      const navContainer = screen.getByRole('navigation');
      expect(navContainer.querySelector('.nav-label')?.textContent).toContain('Appearance');
      
      // Check all tabs are present by their role and text
      expect(screen.getByRole('button', { name: /🎨 Appearance/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /📝 Editor/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /💻 Terminal/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /🔧 Git/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /⚡ Performance/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /⌨️ Shortcuts/i })).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    it('should show appearance tab by default', () => {
      render(SettingsModal, { 
        props: { 
          isOpen: true, 
          onClose: onCloseMock 
        } 
      });

      // Check that appearance section heading is visible
      expect(screen.getByRole('heading', { name: 'Appearance' })).toBeInTheDocument();
    });

    it('should switch tabs when clicked', async () => {
      render(SettingsModal, { 
        props: { 
          isOpen: true, 
          onClose: onCloseMock 
        } 
      });

      // Click on Editor tab
      const editorTab = screen.getByRole('button', { name: /📝 Editor/i });
      await fireEvent.click(editorTab);

      // Check that editor section is now visible
      expect(screen.getByRole('heading', { name: 'Editor' })).toBeInTheDocument();
      expect(screen.getByLabelText('Tab Size')).toBeInTheDocument();
    });

    it('should filter tabs based on search query', async () => {
      render(SettingsModal, { 
        props: { 
          isOpen: true, 
          onClose: onCloseMock 
        } 
      });

      const searchInput = screen.getByPlaceholderText('Search settings...');
      await fireEvent.input(searchInput, { target: { value: 'terminal' } });

      // Terminal tab should still be visible
      expect(screen.getByRole('button', { name: /💻 Terminal/i })).toBeInTheDocument();
      
      // Other tabs should not be visible (we need to check the specific nav container)
      const navContainer = screen.getByRole('navigation');
      const buttons = navContainer.querySelectorAll('button');
      expect(buttons.length).toBe(1);
    });
  });

  describe('Form Field Interactions', () => {
    it('should update theme setting', async () => {
      render(SettingsModal, { 
        props: { 
          isOpen: true, 
          onClose: onCloseMock 
        } 
      });

      const lightThemeButton = screen.getByRole('button', { name: /Light/i });
      await fireEvent.click(lightThemeButton);

      // Check that the light theme option is selected
      expect(lightThemeButton.closest('.theme-option')).toHaveClass('selected');
    });

    it('should update font size with range slider', async () => {
      render(SettingsModal, { 
        props: { 
          isOpen: true, 
          onClose: onCloseMock 
        } 
      });

      const fontSizeSlider = screen.getByLabelText('Font Size');
      await fireEvent.input(fontSizeSlider, { target: { value: '16' } });

      // Check that the value is displayed
      expect(screen.getByText('16px')).toBeInTheDocument();
    });

    it('should toggle checkbox settings', async () => {
      render(SettingsModal, { 
        props: { 
          isOpen: true, 
          onClose: onCloseMock 
        } 
      });

      const compactModeCheckbox = screen.getByLabelText('Compact Mode');
      expect(compactModeCheckbox).not.toBeChecked();

      await fireEvent.click(compactModeCheckbox);
      expect(compactModeCheckbox).toBeChecked();
    });

    it('should update text input fields', async () => {
      render(SettingsModal, { 
        props: { 
          isOpen: true, 
          onClose: onCloseMock 
        } 
      });

      // Switch to terminal tab
      const terminalTab = screen.getByRole('button', { name: /💻 Terminal/i });
      await fireEvent.click(terminalTab);

      const shellInput = screen.getByLabelText('Default Shell');
      await fireEvent.input(shellInput, { target: { value: '/bin/bash' } });

      expect(shellInput).toHaveValue('/bin/bash');
    });

    it('should update select dropdown values', async () => {
      render(SettingsModal, { 
        props: { 
          isOpen: true, 
          onClose: onCloseMock 
        } 
      });

      const fontFamilySelect = screen.getByLabelText('Font Family');
      await fireEvent.change(fontFamilySelect, { target: { value: 'Fira Code' } });

      expect(fontFamilySelect).toHaveValue('Fira Code');
    });
  });

  describe('Save/Cancel Functionality', () => {
    it('should show unsaved changes indicator when settings are modified', async () => {
      render(SettingsModal, { 
        props: { 
          isOpen: true, 
          onClose: onCloseMock 
        } 
      });

      // Initially no changes
      expect(screen.queryByText('● Unsaved changes')).not.toBeInTheDocument();

      // Make a change
      const compactModeCheckbox = screen.getByLabelText('Compact Mode');
      await fireEvent.click(compactModeCheckbox);

      // Should show unsaved changes
      expect(screen.getByText('● Unsaved changes')).toBeInTheDocument();
    });

    it('should enable save button only when there are changes', async () => {
      render(SettingsModal, { 
        props: { 
          isOpen: true, 
          onClose: onCloseMock 
        } 
      });

      const saveButton = screen.getByRole('button', { name: 'Save Changes' });
      
      // Initially disabled
      expect(saveButton).toBeDisabled();

      // Make a change
      const compactModeCheckbox = screen.getByLabelText('Compact Mode');
      await fireEvent.click(compactModeCheckbox);

      // Should be enabled now
      expect(saveButton).not.toBeDisabled();
    });

    it('should save settings when save button is clicked', async () => {
      const { invoke } = await import('@tauri-apps/api/tauri');
      
      render(SettingsModal, { 
        props: { 
          isOpen: true, 
          onClose: onCloseMock 
        } 
      });

      // Make a change
      const compactModeCheckbox = screen.getByLabelText('Compact Mode');
      await fireEvent.click(compactModeCheckbox);

      const saveButton = screen.getByRole('button', { name: 'Save Changes' });
      await fireEvent.click(saveButton);

      // Wait for async operations
      await waitFor(() => {
        // Check that Tauri invoke was called
        expect(invoke).toHaveBeenCalledWith('db_set_setting', {
          key: 'orchflow_settings',
          value: expect.any(String)
        });

        // Check that settings store was updated
        expect(settings.set).toHaveBeenCalled();
      });
    });

    it('should reset changes when reset button is clicked', async () => {
      render(SettingsModal, { 
        props: { 
          isOpen: true, 
          onClose: onCloseMock 
        } 
      });

      // Make a change
      const fontSizeSlider = screen.getByLabelText('Font Size');
      await fireEvent.input(fontSizeSlider, { target: { value: '18' } });

      // Reset button should be enabled
      const resetButton = screen.getByRole('button', { name: 'Reset' });
      expect(resetButton).not.toBeDisabled();

      await fireEvent.click(resetButton);

      // Value should be reset
      expect(screen.getByText('14px')).toBeInTheDocument();
      expect(resetButton).toBeDisabled();
    });

    it('should close modal when close button is clicked', async () => {
      render(SettingsModal, { 
        props: { 
          isOpen: true, 
          onClose: onCloseMock 
        } 
      });

      const closeButton = screen.getByLabelText('Close settings');
      await fireEvent.click(closeButton);

      expect(onCloseMock).toHaveBeenCalled();
    });

    it('should close modal when overlay is clicked', async () => {
      render(SettingsModal, { 
        props: { 
          isOpen: true, 
          onClose: onCloseMock 
        } 
      });

      const overlay = screen.getByRole('dialog');
      await fireEvent.click(overlay);

      expect(onCloseMock).toHaveBeenCalled();
    });

    it('should not close modal when modal content is clicked', async () => {
      render(SettingsModal, { 
        props: { 
          isOpen: true, 
          onClose: onCloseMock 
        } 
      });

      const modalContent = screen.getByRole('document');
      await fireEvent.click(modalContent);

      expect(onCloseMock).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should close modal on Escape key', async () => {
      render(SettingsModal, { 
        props: { 
          isOpen: true, 
          onClose: onCloseMock 
        } 
      });

      await fireEvent.keyDown(window, { key: 'Escape' });

      expect(onCloseMock).toHaveBeenCalled();
    });

    it('should save settings on Ctrl+S', async () => {
      const { invoke } = await import('@tauri-apps/api/tauri');
      
      render(SettingsModal, { 
        props: { 
          isOpen: true, 
          onClose: onCloseMock 
        } 
      });

      // Make a change first
      const compactModeCheckbox = screen.getByLabelText('Compact Mode');
      await fireEvent.click(compactModeCheckbox);

      await fireEvent.keyDown(window, { key: 's', ctrlKey: true });

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('db_set_setting', expect.any(Object));
      });
    });
  });

  describe('Import/Export', () => {
    it('should have export button', async () => {
      render(SettingsModal, { 
        props: { 
          isOpen: true, 
          onClose: onCloseMock 
        } 
      });

      const exportButton = screen.getByTitle('Export Settings');
      expect(exportButton).toBeInTheDocument();
    });

    it('should have import button', async () => {
      render(SettingsModal, { 
        props: { 
          isOpen: true, 
          onClose: onCloseMock 
        } 
      });

      const importLabel = screen.getByTitle('Import Settings');
      expect(importLabel).toBeInTheDocument();
      expect(importLabel.querySelector('input[type="file"]')).toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('should validate numeric inputs', async () => {
      render(SettingsModal, { 
        props: { 
          isOpen: true, 
          onClose: onCloseMock 
        } 
      });

      // Switch to editor tab
      const editorTab = screen.getByRole('button', { name: /📝 Editor/i });
      await fireEvent.click(editorTab);

      const tabSizeInput = screen.getByLabelText('Tab Size');
      
      // Should have min/max attributes
      expect(tabSizeInput).toHaveAttribute('min', '1');
      expect(tabSizeInput).toHaveAttribute('max', '8');
    });

    it('should show conditional fields based on other settings', async () => {
      render(SettingsModal, { 
        props: { 
          isOpen: true, 
          onClose: onCloseMock 
        } 
      });

      // Switch to editor tab
      const editorTab = screen.getByRole('button', { name: /📝 Editor/i });
      await fireEvent.click(editorTab);

      // Auto save delay should be visible when auto save is enabled
      expect(screen.getByLabelText('Auto Save Delay (ms)')).toBeInTheDocument();

      // Disable auto save
      const autoSaveCheckbox = screen.getByLabelText('Auto Save');
      await fireEvent.click(autoSaveCheckbox);

      // Auto save delay should not be visible
      expect(screen.queryByLabelText('Auto Save Delay (ms)')).not.toBeInTheDocument();
    });
  });
});