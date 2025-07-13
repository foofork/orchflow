<script lang="ts">
  import { onMount } from 'svelte';
  import { manager, plugins, loadedPlugins } from '$lib/stores/manager';
  import { managerClient } from '$lib/api/manager-client';
  import type { PluginInfo, PluginMetadata } from '$lib/api/manager-client';
  
  let loading = false;
  let error: string | null = null;
  let selectedPlugin: PluginInfo | null = null;
  let selectedMetadata: PluginMetadata | null = null;
  let showDetails = false;
  
  // Plugins are automatically loaded via the store
  $: availablePlugins = $plugins;
  
  async function refreshPlugins() {
    loading = true;
    error = null;
    
    try {
      await manager.refreshPlugins();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to refresh plugins';
      console.error('Failed to refresh plugins:', err);
    } finally {
      loading = false;
    }
  }
  
  async function togglePlugin(plugin: PluginInfo) {
    try {
      if (plugin.loaded) {
        await manager.unloadPlugin(plugin.id);
      } else {
        await manager.loadPlugin(plugin.id);
      }
    } catch (err) {
      console.error(`Failed to toggle plugin ${plugin.id}:`, err);
      error = `Failed to ${plugin.loaded ? 'unload' : 'load'} plugin`;
    }
  }
  
  async function showPluginDetails(plugin: PluginInfo) {
    selectedPlugin = plugin;
    showDetails = true;
    
    // Load full metadata
    try {
      selectedMetadata = await managerClient.getPluginMetadata(plugin.id);
    } catch (err) {
      console.error('Failed to load plugin metadata:', err);
    }
  }
  
  function closeDetails() {
    showDetails = false;
    selectedPlugin = null;
  }
  
  function getPluginIcon(pluginId: string): string {
    // Return appropriate icon based on plugin type
    if (pluginId.includes('git')) return '🔀';
    if (pluginId.includes('docker')) return '🐳';
    if (pluginId.includes('k8s') || pluginId.includes('kubernetes')) return '☸️';
    if (pluginId.includes('test')) return '🧪';
    if (pluginId.includes('debug')) return '🐛';
    if (pluginId.includes('lint')) return '✨';
    return '🔌';
  }
  
  function getStatusColor(status: string): string {
    switch (status) {
      case 'loaded': return '#10b981'; // green
      case 'unloaded': return '#6b7280'; // gray
      case 'error': return '#ef4444'; // red
      default: return '#6b7280';
    }
  }
</script>

<div class="plugin-manager">
  <div class="header">
    <h2>Plugin Manager</h2>
    <button class="refresh-button" on:click={refreshPlugins} disabled={loading}>
      <svg class="icon" class:spinning={loading} width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M13.65 2.35a8 8 0 10-1.41 11.9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M11 2h3v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Refresh
    </button>
  </div>
  
  {#if error}
    <div class="error-message">
      {error}
    </div>
  {/if}
  
  {#if loading && $plugins.length === 0}
    <div class="loading">
      <div class="spinner" />
      <p>Loading plugins...</p>
    </div>
  {:else if $plugins.length === 0}
    <div class="empty-state">
      <p>No plugins installed</p>
      <p class="hint">Install plugins to extend Orchflow's functionality</p>
    </div>
  {:else}
    <div class="plugin-grid">
      {#each availablePlugins as plugin}
        <div class="plugin-card" class:enabled={plugin.loaded}>
          <div class="plugin-header">
            <span class="plugin-icon">{getPluginIcon(plugin.id)}</span>
            <div class="plugin-info">
              <h3>{plugin.name}</h3>
              <p class="version">v{plugin.version}</p>
            </div>
            <button 
              class="toggle-button"
              class:active={plugin.loaded}
              on:click={() => togglePlugin(plugin)}
              title={plugin.loaded ? 'Disable plugin' : 'Enable plugin'}
            >
              <span class="toggle-slider" />
            </button>
          </div>
          
          <p class="description">{plugin.description}</p>
          
          <div class="plugin-footer">
            <span class="author">by {plugin.author || 'Unknown'}</span>
            <button class="details-button" on:click={() => showPluginDetails(plugin)}>
              Details
            </button>
          </div>
          
          <div class="status-indicator" style="background-color: {getStatusColor(plugin.loaded ? 'loaded' : 'unloaded')}" />
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if showDetails && selectedPlugin}
  <div class="modal-overlay" on:click={closeDetails}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-header">
        <h3>{selectedPlugin.name}</h3>
        <button class="close-button" on:click={closeDetails}>×</button>
      </div>
      
      <div class="modal-content">
        <div class="detail-section">
          <h4>Information</h4>
          <dl>
            <dt>ID</dt>
            <dd>{selectedPlugin.id}</dd>
            
            <dt>Version</dt>
            <dd>{selectedPlugin.version}</dd>
            
            <dt>Author</dt>
            <dd>{selectedMetadata?.author || selectedPlugin.author || 'Unknown'}</dd>
            
            <dt>Status</dt>
            <dd>
              <span class="status-badge" style="background-color: {getStatusColor(selectedPlugin.loaded ? 'loaded' : 'unloaded')}">
                {selectedPlugin.loaded ? 'loaded' : 'unloaded'}
              </span>
            </dd>
          </dl>
        </div>
        
        {#if selectedMetadata?.capabilities && selectedMetadata.capabilities.length > 0}
          <div class="detail-section">
            <h4>Capabilities</h4>
            <ul class="permissions-list">
              {#each selectedMetadata.capabilities as capability}
                <li>{capability}</li>
              {/each}
            </ul>
          </div>
        {/if}
        
        <div class="detail-section">
          <h4>Description</h4>
          <p>{selectedMetadata?.description || selectedPlugin.description || 'No description available'}</p>
        </div>
      </div>
      
      <div class="modal-footer">
        <button 
          class="action-button"
          class:danger={selectedPlugin.loaded}
          on:click={() => selectedPlugin && togglePlugin(selectedPlugin)}
        >
          {selectedPlugin.loaded ? 'Disable Plugin' : 'Enable Plugin'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .plugin-manager {
    padding: 20px;
    height: 100%;
    overflow-y: auto;
    background: #1e1e2e;
  }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  
  .header h2 {
    margin: 0;
    color: #cdd6f4;
    font-size: 24px;
  }
  
  .refresh-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: #313244;
    border: 1px solid #45475a;
    border-radius: 6px;
    color: #cdd6f4;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .refresh-button:hover:not(:disabled) {
    background: #45475a;
  }
  
  .refresh-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .icon {
    width: 16px;
    height: 16px;
  }
  
  .icon.spinning {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .error-message {
    padding: 12px;
    background: #f38ba8;
    color: #1e1e2e;
    border-radius: 6px;
    margin-bottom: 20px;
  }
  
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: #6c7086;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #313244;
    border-top-color: #89b4fa;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 16px;
  }
  
  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: #6c7086;
  }
  
  .empty-state p {
    margin: 8px 0;
  }
  
  .hint {
    font-size: 14px;
    opacity: 0.8;
  }
  
  .plugin-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 16px;
  }
  
  .plugin-card {
    position: relative;
    background: #313244;
    border: 1px solid #45475a;
    border-radius: 8px;
    padding: 20px;
    transition: all 0.2s;
  }
  
  .plugin-card:hover {
    border-color: #585b70;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
  
  .plugin-card.enabled {
    border-color: #89b4fa;
  }
  
  .plugin-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }
  
  .plugin-icon {
    font-size: 32px;
  }
  
  .plugin-info {
    flex: 1;
  }
  
  .plugin-info h3 {
    margin: 0;
    color: #cdd6f4;
    font-size: 18px;
  }
  
  .version {
    margin: 0;
    color: #6c7086;
    font-size: 14px;
  }
  
  .toggle-button {
    position: relative;
    width: 44px;
    height: 24px;
    background: #45475a;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .toggle-button.active {
    background: #89b4fa;
  }
  
  .toggle-slider {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    transition: transform 0.2s;
  }
  
  .toggle-button.active .toggle-slider {
    transform: translateX(20px);
  }
  
  .description {
    margin: 0 0 16px 0;
    color: #bac2de;
    font-size: 14px;
    line-height: 1.5;
  }
  
  .plugin-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .author {
    color: #6c7086;
    font-size: 13px;
  }
  
  .details-button {
    padding: 4px 12px;
    background: none;
    border: 1px solid #45475a;
    border-radius: 4px;
    color: #89b4fa;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .details-button:hover {
    background: #45475a;
  }
  
  .status-indicator {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  
  /* Modal styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .modal {
    background: #1e1e2e;
    border: 1px solid #45475a;
    border-radius: 8px;
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid #313244;
  }
  
  .modal-header h3 {
    margin: 0;
    color: #cdd6f4;
  }
  
  .close-button {
    background: none;
    border: none;
    color: #6c7086;
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }
  
  .close-button:hover {
    background: #313244;
    color: #cdd6f4;
  }
  
  .modal-content {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
  }
  
  .detail-section {
    margin-bottom: 24px;
  }
  
  .detail-section:last-child {
    margin-bottom: 0;
  }
  
  .detail-section h4 {
    margin: 0 0 12px 0;
    color: #cdd6f4;
    font-size: 16px;
  }
  
  dl {
    margin: 0;
  }
  
  dt {
    display: inline-block;
    width: 100px;
    color: #6c7086;
    font-size: 14px;
  }
  
  dd {
    display: inline;
    color: #bac2de;
    font-size: 14px;
    margin: 0 0 8px 0;
  }
  
  dd::after {
    content: '\A';
    white-space: pre;
  }
  
  .status-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    color: white;
    text-transform: uppercase;
  }
  
  .permissions-list {
    margin: 0;
    padding-left: 20px;
  }
  
  .permissions-list li {
    color: #bac2de;
    font-size: 14px;
    margin-bottom: 4px;
  }
  
  .modal-footer {
    padding: 20px;
    border-top: 1px solid #313244;
  }
  
  .action-button {
    padding: 8px 16px;
    background: #89b4fa;
    border: none;
    border-radius: 6px;
    color: #1e1e2e;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .action-button:hover {
    background: #7ba0ff;
  }
  
  .action-button.danger {
    background: #f38ba8;
  }
  
  .action-button.danger:hover {
    background: #f5a3b5;
  }
</style>