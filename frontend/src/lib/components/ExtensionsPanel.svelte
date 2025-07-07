<script lang="ts">
  import { onMount } from 'svelte';
  
  interface Extension {
    id: string;
    name: string;
    description: string;
    author: string;
    version: string;
    installed: boolean;
    enabled: boolean;
  }
  
  let extensions: Extension[] = [];
  let searchQuery = '';
  let loading = true;
  
  onMount(async () => {
    // Simulate loading extensions
    await loadExtensions();
  });
  
  async function loadExtensions() {
    loading = true;
    
    // Simulate extension loading
    await new Promise(resolve => setTimeout(resolve, 300));
    
    extensions = [
      {
        id: 'vim-mode',
        name: 'Vim Mode',
        description: 'Vim emulation for OrchFlow',
        author: 'OrchFlow Team',
        version: '1.0.0',
        installed: true,
        enabled: true
      },
      {
        id: 'rust-analyzer',
        name: 'Rust Analyzer',
        description: 'Rust language support',
        author: 'rust-analyzer',
        version: '0.3.1',
        installed: true,
        enabled: true
      },
      {
        id: 'prettier',
        name: 'Prettier',
        description: 'Code formatter for multiple languages',
        author: 'Prettier',
        version: '2.8.0',
        installed: false,
        enabled: false
      },
      {
        id: 'gitlens',
        name: 'GitLens',
        description: 'Supercharge Git within OrchFlow',
        author: 'GitLens',
        version: '13.0.0',
        installed: false,
        enabled: false
      }
    ];
    
    loading = false;
  }
  
  $: filteredExtensions = extensions.filter(ext => 
    ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ext.description.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  async function toggleExtension(extension: Extension) {
    if (!extension.installed) return;
    
    extension.enabled = !extension.enabled;
    extensions = extensions;
    
    // In production, this would call a Rust command
    console.log(`Extension ${extension.id} ${extension.enabled ? 'enabled' : 'disabled'}`);
  }
  
  async function installExtension(extension: Extension) {
    console.log(`Installing extension ${extension.id}...`);
    
    // Simulate installation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    extension.installed = true;
    extension.enabled = true;
    extensions = extensions;
  }
</script>

<div class="extensions-panel">
  <div class="search-bar">
    <input
      type="text"
      class="search-input"
      placeholder="Search extensions..."
      bind:value={searchQuery}
    />
  </div>
  
  <div class="extension-tabs">
    <button class="tab active">Installed</button>
    <button class="tab">Marketplace</button>
    <button class="tab">Recommended</button>
  </div>
  
  <div class="extension-list">
    {#if loading}
      <div class="loading">Loading extensions...</div>
    {:else if filteredExtensions.length === 0}
      <div class="empty">No extensions found</div>
    {:else}
      {#each filteredExtensions as extension}
        <div class="extension-item" class:installed={extension.installed}>
          <div class="extension-header">
            <div class="extension-info">
              <h4 class="extension-name">{extension.name}</h4>
              <p class="extension-meta">
                {extension.author} • v{extension.version}
              </p>
            </div>
            <div class="extension-actions">
              {#if extension.installed}
                <button
                  class="toggle-btn"
                  class:enabled={extension.enabled}
                  on:click={() => toggleExtension(extension)}
                  title={extension.enabled ? 'Disable' : 'Enable'}
                >
                  {extension.enabled ? '✓' : '○'}
                </button>
              {:else}
                <button
                  class="install-btn"
                  on:click={() => installExtension(extension)}
                >
                  Install
                </button>
              {/if}
            </div>
          </div>
          <p class="extension-description">{extension.description}</p>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .extensions-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  
  .search-bar {
    padding: 8px;
    border-bottom: 1px solid var(--border);
  }
  
  .search-input {
    width: 100%;
    padding: 6px 8px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--fg-primary);
    font-size: 13px;
  }
  
  .search-input:focus {
    outline: none;
    border-color: var(--accent);
  }
  
  .extension-tabs {
    display: flex;
    border-bottom: 1px solid var(--border);
  }
  
  .tab {
    flex: 1;
    padding: 8px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    font-size: 13px;
    color: var(--fg-secondary);
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .tab:hover {
    color: var(--fg-primary);
  }
  
  .tab.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }
  
  .extension-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }
  
  .loading,
  .empty {
    padding: 20px;
    text-align: center;
    color: var(--fg-tertiary);
    font-size: 13px;
  }
  
  .extension-item {
    padding: 12px;
    margin-bottom: 8px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 4px;
    transition: all 0.2s;
  }
  
  .extension-item:hover {
    border-color: var(--accent);
  }
  
  .extension-item.installed {
    background: var(--bg-tertiary);
  }
  
  .extension-header {
    display: flex;
    align-items: start;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  
  .extension-info {
    flex: 1;
  }
  
  .extension-name {
    margin: 0 0 4px 0;
    font-size: 14px;
    font-weight: 500;
    color: var(--fg-primary);
  }
  
  .extension-meta {
    margin: 0;
    font-size: 12px;
    color: var(--fg-secondary);
  }
  
  .extension-description {
    margin: 0;
    font-size: 13px;
    color: var(--fg-secondary);
    line-height: 1.4;
  }
  
  .extension-actions {
    display: flex;
    gap: 8px;
  }
  
  .toggle-btn {
    width: 24px;
    height: 24px;
    padding: 0;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--fg-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  
  .toggle-btn:hover {
    border-color: var(--accent);
  }
  
  .toggle-btn.enabled {
    background: var(--accent);
    color: var(--bg-primary);
    border-color: var(--accent);
  }
  
  .install-btn {
    padding: 4px 12px;
    background: var(--accent);
    border: none;
    border-radius: 4px;
    color: var(--bg-primary);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  
  .install-btn:hover {
    opacity: 0.9;
  }
</style>