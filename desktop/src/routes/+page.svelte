<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  // Layout components
  import Sidebar from '$lib/components/Sidebar.svelte';
  import TabBar from '$lib/components/TabBar.svelte';
  import StatusBar from '$lib/components/StatusBar.svelte';
  import ActivityBar from '$lib/components/ActivityBar.svelte';
  
  // Essential components loaded immediately
  import Terminal from '$lib/components/Terminal.svelte';
  import UpdateNotification from '$lib/components/UpdateNotification.svelte';
  import CommandPalette from '$lib/components/CommandPalette.svelte';
  
  // Lazy-loaded components
  import LazyComponent from '$lib/components/LazyComponent.svelte';
  import { preloadComponents } from '$lib/utils/lazyLoad';
  
  // Component loaders for lazy loading
  const DashboardEnhanced = () => import('$lib/components/DashboardEnhanced.svelte');
  const NeovimEditor = () => import('$lib/components/NeovimEditor.svelte');
  const TestResultsView = () => import('$lib/components/TestResultsView.svelte');
  const ShareDialog = () => import('$lib/components/ShareDialog.svelte');
  const ConfigPanel = () => import('$lib/components/ConfigPanel.svelte');
  const GitPanel = () => import('$lib/components/GitPanel.svelte');
  const SymbolOutline = () => import('$lib/components/SymbolOutline.svelte');
  const SettingsModal = () => import('$lib/components/SettingsModal.svelte');
  const PluginManager = () => import('$lib/components/PluginManager.svelte');
  const PluginCommandPalette = () => import('$lib/components/PluginCommandPalette.svelte');
  
  // Stores - using new manager
  import { manager, activeSession, activePane } from '$lib/stores/manager';
  import { settings } from '$lib/stores/settings';
  import { toggleTheme } from '$lib/services/theme';
  
  // Types
  interface Tab {
    id: string;
    title: string;
    type: 'terminal' | 'dashboard' | 'file' | 'test' | 'settings' | 'plugins';
    paneId?: string;
    metadata?: any;
  }
  
  let isTauri = '__TAURI__' in window;
  let activeView = 'explorer';
  let showShareDialog = false;
  let showSettingsModal = false;
  let showGitPanel = false;
  let showSymbolOutline = false;
  let showPluginCommands = false;
  let layoutMode: 'single' | 'split-horizontal' | 'split-vertical' = 'single';
  let secondaryTab: Tab | null = null;
  
  // Local tab management (UI state)
  let tabs: Tab[] = [];
  let activeTabId: string | null = null;
  $: activeTab = tabs.find(t => t.id === activeTabId) || null;
  
  // Keyboard shortcuts
  let shortcuts = {
    'ctrl+k': () => showCommandPalette = true,
    'ctrl+p': () => showCommandPalette = true,
    'ctrl+shift+p': () => showPluginCommands = true,
    'ctrl+b': () => toggleSidebar(),
    'ctrl+`': () => openTerminal(),
    'ctrl+s': () => saveCurrentFile(),
    'ctrl+w': () => closeCurrentTab(),
    'ctrl+shift+e': () => activeView = 'explorer',
    'ctrl+shift+g': () => showGitPanel = true,
    'ctrl+shift+o': () => showSymbolOutline = true,
    'ctrl+shift+x': () => activeView = 'plugins',
    'ctrl+shift+d': () => activeView = 'debug',
    'ctrl+,': () => showSettingsModal = true,
  };
  
  let showCommandPalette = false;
  let sidebarVisible = true;
  
  onMount(async () => {
    // Register keyboard shortcuts
    document.addEventListener('keydown', handleKeydown);
    
    // Initialize with a default session
    if (!$activeSession) {
      await manager.createSession('Default Session');
    }
    
    // Preload commonly used components in the background
    preloadComponents([
      DashboardEnhanced,
      PluginManager,
      SettingsModal,
      ShareDialog
    ]);
    
    // Initialize Tauri-specific features
    if (isTauri && browser) {
      const { appWindow } = await import('@tauri-apps/api/window');
      const { listen } = await import('@tauri-apps/api/event');
      
      try {
        // Listen for file drops
        await appWindow.onFileDropEvent((event) => {
          if (event.payload.type === 'drop') {
            event.payload.paths.forEach((path: string) => {
              openFile(path);
            });
          }
        });
        
        // Listen for startup complete
        const unlisten = await listen('startup-complete', (event) => {
          console.log('Startup metrics:', event.payload);
        });
        
        return () => {
          document.removeEventListener('keydown', handleKeydown);
          unlisten();
        };
      } catch (err) {
        console.error('Failed to initialize Tauri features:', err);
      }
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  });
  
  function handleKeydown(event: KeyboardEvent) {
    const key = `${event.ctrlKey || event.metaKey ? 'ctrl+' : ''}${event.shiftKey ? 'shift+' : ''}${event.key.toLowerCase()}`;
    
    if (key in shortcuts) {
      event.preventDefault();
      (shortcuts as any)[key]();
    }
  }
  
  function handleViewChange(event: CustomEvent<string>) {
    activeView = event.detail;
    
    // Handle special views
    if (activeView === 'dashboard' && !tabs.find(t => t.type === 'dashboard')) {
      createDashboardTab();
    } else if (activeView === 'settings') {
      showSettingsModal = true;
    } else if (activeView === 'plugins') {
      createPluginsTab();
    }
  }
  
  async function openTerminal() {
    if (!$activeSession) {
      await manager.createSession('Default Session');
    }
    
    const pane = await manager.createTerminal($activeSession!.id, {
      name: 'Terminal'
    });
    
    const tab: Tab = {
      id: pane.id,
      title: pane.title || 'Terminal',
      type: 'terminal',
      paneId: pane.id,
      metadata: { pane }
    };
    
    tabs = [...tabs, tab];
    activeTabId = tab.id;
  }
  
  function createDashboardTab() {
    const tab: Tab = {
      id: `dashboard-${Date.now()}`,
      title: 'Dashboard',
      type: 'dashboard'
    };
    
    tabs = [...tabs, tab];
    activeTabId = tab.id;
  }
  
  function createPluginsTab() {
    const existingTab = tabs.find(t => t.type === 'plugins');
    if (existingTab) {
      activeTabId = existingTab.id;
      return;
    }
    
    const tab: Tab = {
      id: `plugins-${Date.now()}`,
      title: 'Plugins',
      type: 'plugins'
    };
    
    tabs = [...tabs, tab];
    activeTabId = tab.id;
  }
  
  async function openFile(path: string) {
    const fileName = path.split('/').pop() || path;
    const tab: Tab = {
      id: `file-${Date.now()}`,
      title: fileName,
      type: 'file',
      metadata: { filePath: path }
    };
    
    tabs = [...tabs, tab];
    activeTabId = tab.id;
  }
  
  function toggleSidebar() {
    sidebarVisible = !sidebarVisible;
  }
  
  async function saveCurrentFile() {
    if (activeTab?.type === 'file' && isTauri) {
      // Trigger save in Neovim
      const { invoke } = await import('@tauri-apps/api/core');
      invoke('nvim_execute_command', {
        instanceId: activeTab.metadata?.instanceId,
        command: ':w'
      });
    }
  }
  
  function closeCurrentTab() {
    if (activeTab) {
      // If it's a terminal, close the pane
      if (activeTab.type === 'terminal' && activeTab.paneId) {
        manager.closePane(activeTab.paneId);
      }
      
      // Remove from tabs
      tabs = tabs.filter(tab => tab.id !== activeTab.id);
      
      // Select next tab
      if (tabs.length > 0) {
        const currentIndex = tabs.findIndex(t => t.id === activeTabId);
        activeTabId = tabs[Math.max(0, currentIndex - 1)]?.id || tabs[0]?.id;
      } else {
        activeTabId = null;
      }
    }
  }
  
  function handleSplitView(direction: 'horizontal' | 'vertical') {
    if (direction === 'horizontal') {
      layoutMode = layoutMode === 'split-horizontal' ? 'single' : 'split-horizontal';
    } else {
      layoutMode = layoutMode === 'split-vertical' ? 'single' : 'split-vertical';
    }
    
    if (layoutMode !== 'single' && tabs.length > 1) {
      secondaryTab = tabs.find(t => t.id !== activeTabId) || null;
    } else {
      secondaryTab = null;
    }
  }
  
  async function handleCommand(event: CustomEvent<{ action: string }>) {
    const action = event.detail.action;
    
    switch (action) {
      // File actions
      case 'newFile':
      case 'openFile':
      case 'save':
        saveCurrentFile();
        break;
      case 'closeTab':
        closeCurrentTab();
        break;
      case 'closeAllTabs':
        tabs = [];
        activeTabId = null;
        break;
        
      // View actions
      case 'showExplorer':
        activeView = 'explorer';
        break;
      case 'showSearch':
        activeView = 'search';
        break;
      case 'showGit':
        activeView = 'git';
        showGitPanel = true;
        break;
      case 'showPlugins':
        activeView = 'plugins';
        createPluginsTab();
        break;
      case 'showDashboard':
        activeView = 'dashboard';
        createDashboardTab();
        break;
      case 'toggleSidebar':
        toggleSidebar();
        break;
        
      // Terminal actions
      case 'newTerminal':
        openTerminal();
        break;
        
      // Window actions
      case 'splitHorizontal':
        handleSplitView('horizontal');
        break;
      case 'splitVertical':
        handleSplitView('vertical');
        break;
      case 'toggleFullscreen':
        if (isTauri) {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const appWindow = getCurrentWindow();
          const isFullscreen = await appWindow.isFullscreen();
          await appWindow.setFullscreen(!isFullscreen);
        }
        break;
        
      // Settings actions
      case 'openSettings':
        showSettingsModal = true;
        break;
      case 'toggleTheme':
        toggleTheme();
        break;
        
      // Navigation
      case 'nextTab':
        const currentIndex = tabs.findIndex(t => t.id === activeTabId);
        if (currentIndex < tabs.length - 1) {
          activeTabId = tabs[currentIndex + 1].id;
        }
        break;
      case 'prevTab':
        const currentIdx = tabs.findIndex(t => t.id === activeTabId);
        if (currentIdx > 0) {
          activeTabId = tabs[currentIdx - 1].id;
        }
        break;
        
      // Misc actions
      case 'reload':
        location.reload();
        break;
      case 'shareWorkflow':
        showShareDialog = true;
        break;
        
      default:
        console.log('Unhandled command:', action);
    }
  }
</script>

<svelte:head>
  <title>OrchFlow</title>
</svelte:head>

<!-- Update Notification -->
<UpdateNotification />

<!-- Share Dialog -->
{#if showShareDialog}
  <LazyComponent loader={ShareDialog} props={{ show: showShareDialog }} />
{/if}

<!-- Main Application -->
<div class="app" class:sidebar-hidden={!sidebarVisible}>
  <!-- Activity Bar -->
  <ActivityBar {activeView} on:viewChange={handleViewChange} />
  
  <!-- Sidebar -->
  {#if sidebarVisible}
    <Sidebar 
      {activeView} 
      sessionId={$activeSession?.id || ''}
      on:openFile={(e) => openFile(e.detail)}
      on:share={() => showShareDialog = true}
    />
  {/if}
  
  <!-- Main Content -->
  <div class="main-content">
    <!-- Tab Bar -->
    <div class="tab-bar-container">
      <TabBar {tabs} bind:activeTabId on:closeTab={(e) => closeCurrentTab()} />
      <div class="tab-actions">
        <button 
          class="split-button"
          class:active={layoutMode === 'split-horizontal'}
          on:click={() => handleSplitView('horizontal')}
          title="Split Horizontal"
        >
          ⬌
        </button>
        <button 
          class="split-button"
          class:active={layoutMode === 'split-vertical'}
          on:click={() => handleSplitView('vertical')}
          title="Split Vertical"
        >
          ⬍
        </button>
      </div>
    </div>
    
    <!-- Editor Area -->
    <div class="editor-area" class:split-horizontal={layoutMode === 'split-horizontal'} class:split-vertical={layoutMode === 'split-vertical'}>
      <!-- Primary Pane -->
      <div class="editor-pane primary">
        {#if activeTab}
          {#if activeTab.type === 'terminal'}
            <Terminal 
              paneId={activeTab.paneId || ''}
              title={activeTab.title || 'Terminal'}
            />
          {:else if activeTab.type === 'dashboard'}
            <LazyComponent loader={DashboardEnhanced} placeholder="Loading Dashboard..." />
          {:else if activeTab.type === 'file'}
            <LazyComponent 
              loader={NeovimEditor}
              props={{
                filePath: activeTab.metadata?.filePath,
                title: activeTab.title,
                instanceId: activeTab.metadata?.instanceId
              }}
              placeholder="Loading Editor..."
            />
          {:else if activeTab.type === 'test'}
            <LazyComponent 
              loader={TestResultsView}
              props={{ sessionId: $activeSession?.id || '' }}
              placeholder="Loading Test Results..."
            />
          {:else if activeTab.type === 'settings'}
            <LazyComponent
              loader={ConfigPanel}
              props={{
                title: "Settings",
                config: $settings,
                show: true,
                onSave: (e) => settings.update(() => e.detail),
                onClose: () => closeCurrentTab()
              }}
              placeholder="Loading Settings..."
            />
          {:else if activeTab.type === 'plugins'}
            <LazyComponent loader={PluginManager} placeholder="Loading Plugin Manager..." />
          {/if}
        {:else}
          <div class="welcome">
            <div class="logo">🌊</div>
            <h1>Welcome to OrchFlow</h1>
            <p>The terminal-first IDE with AI orchestration</p>
            
            <div class="quick-actions">
              <button class="quick-action" on:click={openTerminal}>
                <span class="icon">📟</span>
                <span class="label">Open Terminal</span>
                <span class="shortcut">Ctrl+`</span>
              </button>
              
              <button class="quick-action" on:click={() => showCommandPalette = true}>
                <span class="icon">🔍</span>
                <span class="label">Command Palette</span>
                <span class="shortcut">Ctrl+P</span>
              </button>
              
              <button class="quick-action" on:click={() => activeView = 'explorer'}>
                <span class="icon">📁</span>
                <span class="label">File Explorer</span>
                <span class="shortcut">Ctrl+Shift+E</span>
              </button>
              
              <button class="quick-action" on:click={() => showSettingsModal = true}>
                <span class="icon">⚙️</span>
                <span class="label">Settings</span>
                <span class="shortcut">Ctrl+,</span>
              </button>
            </div>
            
            <div class="recent-files">
              <h3>Recent Files</h3>
              <p class="empty">No recent files</p>
            </div>
          </div>
        {/if}
      </div>
      
      <!-- Secondary Pane (when split) -->
      {#if layoutMode !== 'single' && secondaryTab}
        <div class="editor-pane secondary">
          {#if secondaryTab.type === 'terminal'}
            <Terminal 
              paneId={secondaryTab.paneId || ''}
              title={secondaryTab.title || 'Terminal'}
            />
          {:else if secondaryTab.type === 'file'}
            <NeovimEditor 
              filePath={secondaryTab.metadata?.filePath}
              title={secondaryTab.title}
              instanceId={secondaryTab.metadata?.instanceId}
            />
          {:else if secondaryTab.type === 'dashboard'}
            <DashboardEnhanced />
          {:else if secondaryTab.type === 'test'}
            <TestResultsView sessionId={$activeSession?.id || ''} />
          {:else if secondaryTab.type === 'plugins'}
            <PluginManager />
          {/if}
        </div>
      {/if}
    </div>
    
    <!-- Status Bar -->
    <StatusBar sessionId={$activeSession?.id || ''} />
  </div>
  
  <!-- Settings Modal -->
  {#if showSettingsModal}
    <LazyComponent 
      loader={() => import('$lib/components/SettingsModal.svelte')}
      props={{
        isOpen: showSettingsModal,
        onClose: () => showSettingsModal = false
      }}
    />
  {/if}
  
  <!-- Command Palette -->
  <CommandPalette 
    bind:show={showCommandPalette}
    on:command={handleCommand}
  />
  
  <!-- Plugin Command Palette -->
  {#if showPluginCommands}
    <LazyComponent 
      loader={PluginCommandPalette}
      props={{ show: showPluginCommands }}
    />
  {/if}
  
  <!-- Git Panel -->
  {#if showGitPanel}
    <LazyComponent
      loader={GitPanel}
      props={{
        show: showGitPanel,
        sessionId: $activeSession?.id || ''
      }}
    />
  {/if}
  
  <!-- Symbol Outline -->
  {#if showSymbolOutline}
    <LazyComponent
      loader={SymbolOutline}
      props={{
        isOpen: showSymbolOutline,
        onClose: () => showSymbolOutline = false
      }}
    />
  {/if}
</div>

<style>
  :global(:root) {
    /* Layout dimensions */
    --activity-bar-width: 48px;
    --sidebar-width: 260px;
    --tab-bar-height: 35px;
    --status-bar-height: 22px;
  }
  
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
    font-size: 13px;
    color: var(--fg-primary);
    background: var(--bg-primary);
  }
  
  .app {
    display: flex;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
  }
  
  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .tab-bar-container {
    display: flex;
    align-items: center;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
  }
  
  .tab-actions {
    display: flex;
    gap: 4px;
    padding: 0 8px;
  }
  
  .split-button {
    background: none;
    border: none;
    color: var(--fg-tertiary);
    padding: 4px 8px;
    cursor: pointer;
    border-radius: 3px;
    font-size: 16px;
    transition: all 0.2s;
  }
  
  .split-button:hover {
    background: var(--bg-hover);
    color: var(--fg-primary);
  }
  
  .split-button.active {
    background: var(--bg-tertiary);
    color: var(--accent);
  }
  
  .editor-area {
    flex: 1;
    display: flex;
    background: var(--bg-primary);
    overflow: hidden;
  }
  
  .editor-area.split-horizontal {
    flex-direction: row;
  }
  
  .editor-area.split-vertical {
    flex-direction: column;
  }
  
  .editor-pane {
    flex: 1;
    overflow: hidden;
    position: relative;
  }
  
  .editor-pane.secondary {
    border-left: 1px solid var(--border);
  }
  
  .editor-area.split-vertical .editor-pane.secondary {
    border-left: none;
    border-top: 1px solid var(--border);
  }
  
  /* Welcome Screen */
  .welcome {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    max-width: 600px;
    margin: 0 auto;
  }
  
  .logo {
    font-size: 64px;
    margin-bottom: 24px;
  }
  
  .welcome h1 {
    font-size: 32px;
    font-weight: 300;
    margin: 0 0 8px 0;
    color: var(--fg-primary);
  }
  
  .welcome p {
    font-size: 16px;
    color: var(--fg-secondary);
    margin: 0 0 40px 0;
  }
  
  .quick-actions {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    width: 100%;
    margin-bottom: 40px;
  }
  
  .quick-action {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }
  
  .quick-action:hover {
    background: var(--bg-tertiary);
    border-color: var(--accent);
  }
  
  .quick-action .icon {
    font-size: 24px;
  }
  
  .quick-action .label {
    flex: 1;
    font-size: 14px;
    color: var(--fg-primary);
  }
  
  .quick-action .shortcut {
    font-size: 11px;
    color: var(--fg-tertiary);
    background: var(--bg-tertiary);
    padding: 2px 6px;
    border-radius: 3px;
  }
  
  .recent-files {
    width: 100%;
  }
  
  .recent-files h3 {
    font-size: 14px;
    font-weight: 500;
    margin: 0 0 12px 0;
    color: var(--fg-secondary);
  }
  
  .recent-files .empty {
    text-align: center;
    color: var(--fg-tertiary);
    padding: 20px;
  }
  
  /* Responsive */
  .app.sidebar-hidden .main-content {
    margin-left: 0;
  }
</style>