<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import ConfigPanel from '$lib/components/ConfigPanel.svelte';
  import { fade } from 'svelte/transition';
  
  interface Setting {
    id: string;
    title: string;
    description: string;
    value: any;
    schema?: any;
  }
  
  let settings: Setting[] = [];
  let loading = true;
  let selectedSetting: Setting | null = null;
  let showConfigPanel = false;
  
  onMount(async () => {
    await loadSettings();
  });
  
  async function loadSettings() {
    try {
      // Load various settings
      const [
        editorConfig,
        terminalConfig,
        managerConfig,
        moduleConfig,
        appearanceConfig
      ] = await Promise.all([
        getSetting('editor'),
        getSetting('terminal'),
        getSetting('manager'),
        getSetting('modules'),
        getSetting('appearance')
      ]);
      
      settings = [
        {
          id: 'editor',
          title: 'Editor Settings',
          description: 'Configure Neovim editor behavior and appearance',
          value: editorConfig || {
            fontSize: 14,
            tabSize: 2,
            theme: 'catppuccin',
            lineNumbers: true,
            relativeLineNumbers: false,
            cursorStyle: 'block',
            scrolloff: 5
          },
          schema: {
            fontSize: { type: 'number', min: 10, max: 24 },
            tabSize: { type: 'number', min: 2, max: 8 },
            theme: { type: 'string', enum: ['catppuccin', 'gruvbox', 'nord', 'dracula'] },
            lineNumbers: { type: 'boolean' },
            relativeLineNumbers: { type: 'boolean' },
            cursorStyle: { type: 'string', enum: ['block', 'line', 'underline'] },
            scrolloff: { type: 'number', min: 0, max: 20 }
          }
        },
        {
          id: 'terminal',
          title: 'Terminal Settings',
          description: 'Configure terminal emulator behavior',
          value: terminalConfig || {
            shell: '/bin/zsh',
            fontSize: 13,
            fontFamily: 'JetBrains Mono',
            cursorBlink: true,
            scrollback: 10000,
            copyOnSelect: true,
            rightClickSelectsWord: true
          },
          schema: {
            shell: { type: 'string', required: true },
            fontSize: { type: 'number', min: 10, max: 20 },
            fontFamily: { type: 'string' },
            cursorBlink: { type: 'boolean' },
            scrollback: { type: 'number', min: 1000, max: 50000 },
            copyOnSelect: { type: 'boolean' },
            rightClickSelectsWord: { type: 'boolean' }
          }
        },
        {
          id: 'manager',
          title: 'Manager Settings',
          description: 'Configure terminal manager and backend settings',
          value: managerConfig || {
            backend: 'muxd',
            stateDirectory: '~/.orchflow/state',
            sessionTimeout: 3600000,
            maxSessions: 10,
            maxPanesPerSession: 20,
            debugMode: false
          },
          schema: {
            backend: { type: 'string', enum: ['tmux', 'muxd'] },
            stateDirectory: { type: 'string' },
            sessionTimeout: { type: 'number', min: 60000 },
            maxSessions: { type: 'number', min: 1, max: 50 },
            maxPanesPerSession: { type: 'number', min: 1, max: 100 },
            debugMode: { type: 'boolean' }
          }
        },
        {
          id: 'modules',
          title: 'Module Settings',
          description: 'Configure module loading and permissions',
          value: moduleConfig || {
            autoLoad: true,
            trustedSources: ['https://modules.orchflow.dev'],
            allowLocalModules: true,
            sandboxMode: false,
            maxModuleSize: 10485760
          },
          schema: {
            autoLoad: { type: 'boolean' },
            trustedSources: { type: 'array', items: { type: 'string' } },
            allowLocalModules: { type: 'boolean' },
            sandboxMode: { type: 'boolean' },
            maxModuleSize: { type: 'number', min: 1048576 }
          }
        },
        {
          id: 'appearance',
          title: 'Appearance Settings',
          description: 'Customize the look and feel',
          value: appearanceConfig || {
            theme: 'dark',
            accentColor: '#89b4fa',
            fontScale: 1.0,
            animations: true,
            compactMode: false,
            showStatusBar: true
          },
          schema: {
            theme: { type: 'string', enum: ['dark', 'light', 'auto'] },
            accentColor: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
            fontScale: { type: 'number', min: 0.8, max: 1.5 },
            animations: { type: 'boolean' },
            compactMode: { type: 'boolean' },
            showStatusBar: { type: 'boolean' }
          }
        }
      ];
      
      loading = false;
    } catch (err) {
      console.error('Failed to load settings:', err);
      loading = false;
    }
  }
  
  async function getSetting(key: string): Promise<any> {
    try {
      return await invoke('db_get_setting', { key });
    } catch {
      return null;
    }
  }
  
  async function saveSetting(key: string, value: any) {
    try {
      await invoke('db_set_setting', { key, value: JSON.stringify(value) });
      
      // Update local state
      const index = settings.findIndex(s => s.id === key);
      if (index >= 0) {
        settings[index].value = value;
      }
      
      // Show success notification
      showNotification('Settings saved successfully', 'success');
    } catch (err) {
      console.error('Failed to save setting:', err);
      showNotification('Failed to save settings', 'error');
    }
  }
  
  function openConfig(setting: Setting) {
    selectedSetting = setting;
    showConfigPanel = true;
  }
  
  function handleConfigSave(event: CustomEvent<any>) {
    if (selectedSetting) {
      saveSetting(selectedSetting.id, event.detail);
    }
  }
  
  function handleConfigClose() {
    showConfigPanel = false;
    selectedSetting = null;
  }
  
  let notification: { message: string; type: 'success' | 'error' } | null = null;
  
  function showNotification(message: string, type: 'success' | 'error') {
    notification = { message, type };
    setTimeout(() => {
      notification = null;
    }, 3000);
  }
</script>

<div class="settings-page">
  <div class="header">
    <h1>Settings</h1>
    <p>Configure OrchFlow to match your workflow</p>
  </div>
  
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading settings...</p>
    </div>
  {:else}
    <div class="settings-grid">
      {#each settings as setting}
        <button 
          class="setting-card"
          on:click={() => openConfig(setting)}
          transition:fade={{ duration: 200, delay: settings.indexOf(setting) * 50 }}
        >
          <div class="setting-icon">
            {#if setting.id === 'editor'}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <path d="M14 2v6h6"/>
                <path d="M10 12h4"/>
                <path d="M10 16h4"/>
              </svg>
            {:else if setting.id === 'terminal'}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>
                <path d="M9 9l3 3-3 3"/>
                <path d="M13 15h3"/>
              </svg>
            {:else if setting.id === 'manager'}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
                <path d="M20.5 7.5L16 12l4.5 4.5M3.5 7.5L8 12l-4.5 4.5"/>
              </svg>
            {:else if setting.id === 'modules'}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
            {:else if setting.id === 'appearance'}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
              </svg>
            {/if}
          </div>
          
          <h3>{setting.title}</h3>
          <p>{setting.description}</p>
          
          <div class="arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </div>
        </button>
      {/each}
    </div>
  {/if}
  
  {#if selectedSetting}
    <ConfigPanel
      title={selectedSetting.title}
      config={selectedSetting.value}
      schema={selectedSetting.schema}
      show={showConfigPanel}
      on:save={handleConfigSave}
      on:close={handleConfigClose}
    />
  {/if}
  
  {#if notification}
    <div 
      class="notification {notification.type}"
      transition:fade={{ duration: 200 }}
    >
      {notification.message}
    </div>
  {/if}
</div>

<style>
  .settings-page {
    max-width: 1200px;
    margin: 0 auto;
    padding: 40px 20px;
  }
  
  .header {
    margin-bottom: 40px;
  }
  
  .header h1 {
    font-size: 32px;
    margin: 0 0 8px 0;
    color: var(--color-text-primary, #cdd6f4);
  }
  
  .header p {
    font-size: 16px;
    color: var(--color-text-secondary, #bac2de);
    margin: 0;
  }
  
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 400px;
    color: var(--color-text-secondary, #bac2de);
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    margin-bottom: 16px;
    border: 3px solid var(--color-border, #45475a);
    border-top-color: var(--color-primary, #89b4fa);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .settings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
  }
  
  .setting-card {
    position: relative;
    background: var(--color-bg-secondary, #1e1e2e);
    border: 1px solid var(--color-border, #45475a);
    border-radius: 8px;
    padding: 24px;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .setting-card:hover {
    background: var(--color-bg-tertiary, #313244);
    border-color: var(--color-primary, #89b4fa);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
  
  .setting-icon {
    width: 48px;
    height: 48px;
    padding: 12px;
    background: var(--color-bg-primary, #11111b);
    border-radius: 8px;
    color: var(--color-primary, #89b4fa);
  }
  
  .setting-icon svg {
    width: 100%;
    height: 100%;
  }
  
  .setting-card h3 {
    margin: 0;
    font-size: 18px;
    color: var(--color-text-primary, #cdd6f4);
  }
  
  .setting-card p {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-secondary, #bac2de);
    line-height: 1.5;
  }
  
  .arrow {
    position: absolute;
    top: 24px;
    right: 24px;
    width: 20px;
    height: 20px;
    color: var(--color-text-secondary, #bac2de);
    opacity: 0;
    transition: opacity 0.2s;
  }
  
  .setting-card:hover .arrow {
    opacity: 1;
  }
  
  .notification {
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  
  .notification.success {
    background: var(--color-success, #a6e3a1);
    color: var(--color-bg-primary, #11111b);
  }
  
  .notification.error {
    background: var(--color-error, #f38ba8);
    color: var(--color-bg-primary, #11111b);
  }
</style>