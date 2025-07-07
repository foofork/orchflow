<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { orchestratorClient } from '$lib/api/orchestrator-client';
  
  interface PluginStatus {
    id: string;
    name: string;
    icon: string;
    status: 'active' | 'inactive' | 'error';
    message?: string;
  }
  
  let plugins: PluginStatus[] = [];
  let showTooltip = false;
  let tooltipPlugin: PluginStatus | null = null;
  let tooltipElement: HTMLElement;
  
  // Subscribe to plugin events
  onMount(async () => {
    await loadPluginStatuses();
    
    // Subscribe to plugin events
    await orchestratorClient.subscribe(['plugin_loaded', 'plugin_unloaded', 'plugin_event']);
    
    const unsubscribers = [
      orchestratorClient.onEvent('plugin_loaded', (event) => {
        if (event.type === 'plugin_loaded') {
          loadPluginStatuses();
        }
      }),
      
      orchestratorClient.onEvent('plugin_unloaded', (event) => {
        if (event.type === 'plugin_unloaded') {
          loadPluginStatuses();
        }
      }),
      
      orchestratorClient.onEvent('plugin_event', (event) => {
        if (event.type === 'plugin_event' && event.event_type === 'status_update') {
          updatePluginStatus(event.plugin_id, event.data);
        }
      })
    ];
    
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  });
  
  async function loadPluginStatuses() {
    try {
      const loadedPlugins = await orchestratorClient.execute<any[]>({ type: 'list_plugins' });
      
      plugins = loadedPlugins
        .filter(p => p.status === 'loaded')
        .map(p => ({
          id: p.id,
          name: p.name,
          icon: getPluginIcon(p.id),
          status: 'active' as const,
          message: `${p.name} is active`
        }));
    } catch (error) {
      console.error('Failed to load plugin statuses:', error);
    }
  }
  
  function updatePluginStatus(pluginId: string, data: any) {
    const index = plugins.findIndex(p => p.id === pluginId);
    if (index >= 0) {
      plugins[index] = {
        ...plugins[index],
        status: data.status || plugins[index].status,
        message: data.message || plugins[index].message
      };
      plugins = plugins; // Trigger reactivity
    }
  }
  
  function getPluginIcon(pluginId: string): string {
    if (pluginId.includes('git')) return '🔀';
    if (pluginId.includes('docker')) return '🐳';
    if (pluginId.includes('k8s') || pluginId.includes('kubernetes')) return '☸️';
    if (pluginId.includes('test')) return '🧪';
    if (pluginId.includes('debug')) return '🐛';
    if (pluginId.includes('lint')) return '✨';
    return '🔌';
  }
  
  function handleMouseEnter(plugin: PluginStatus, event: MouseEvent) {
    tooltipPlugin = plugin;
    tooltipElement = event.currentTarget as HTMLElement;
    showTooltip = true;
  }
  
  function handleMouseLeave() {
    showTooltip = false;
    tooltipPlugin = null;
  }
  
  async function handleClick(plugin: PluginStatus) {
    // Open plugin details or execute default action
    console.log('Plugin clicked:', plugin.id);
    // Could open plugin manager with this plugin selected
    // Or execute a default plugin action
  }
</script>

<div class="plugin-status-bar">
  <div class="separator" />
  
  {#each plugins as plugin}
    <button
      class="plugin-item"
      class:error={plugin.status === 'error'}
      class:inactive={plugin.status === 'inactive'}
      on:mouseenter={(e) => handleMouseEnter(plugin, e)}
      on:mouseleave={handleMouseLeave}
      on:click={() => handleClick(plugin)}
    >
      <span class="plugin-icon">{plugin.icon}</span>
      {#if plugin.status === 'error'}
        <span class="error-indicator">!</span>
      {/if}
    </button>
  {/each}
  
  {#if plugins.length === 0}
    <span class="no-plugins">No active plugins</span>
  {/if}
</div>

{#if showTooltip && tooltipPlugin && tooltipElement}
  <div 
    class="tooltip"
    style="
      left: {tooltipElement.getBoundingClientRect().left}px;
      bottom: {window.innerHeight - tooltipElement.getBoundingClientRect().top + 5}px;
    "
  >
    <div class="tooltip-header">
      <span class="tooltip-icon">{tooltipPlugin.icon}</span>
      <span class="tooltip-name">{tooltipPlugin.name}</span>
    </div>
    {#if tooltipPlugin.message}
      <div class="tooltip-message">{tooltipPlugin.message}</div>
    {/if}
    <div class="tooltip-status" class:error={tooltipPlugin.status === 'error'}>
      Status: {tooltipPlugin.status}
    </div>
  </div>
{/if}

<style>
  .plugin-status-bar {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 100%;
  }
  
  .separator {
    width: 1px;
    height: 16px;
    background: #45475a;
    margin: 0 4px;
  }
  
  .plugin-item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 8px;
    height: 100%;
    background: none;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
  }
  
  .plugin-item:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  
  .plugin-icon {
    font-size: 14px;
    line-height: 1;
  }
  
  .plugin-item.inactive {
    opacity: 0.5;
  }
  
  .plugin-item.error {
    color: #f38ba8;
  }
  
  .error-indicator {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 6px;
    height: 6px;
    background: #f38ba8;
    border-radius: 50%;
    font-size: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
  }
  
  .no-plugins {
    color: #6c7086;
    font-size: 12px;
    padding: 0 8px;
  }
  
  .tooltip {
    position: fixed;
    background: #313244;
    border: 1px solid #45475a;
    border-radius: 6px;
    padding: 12px;
    z-index: 3000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    pointer-events: none;
    max-width: 300px;
  }
  
  .tooltip-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  
  .tooltip-icon {
    font-size: 16px;
  }
  
  .tooltip-name {
    font-weight: 500;
    color: #cdd6f4;
  }
  
  .tooltip-message {
    color: #bac2de;
    font-size: 13px;
    margin-bottom: 8px;
    line-height: 1.4;
  }
  
  .tooltip-status {
    color: #a6e3a1;
    font-size: 12px;
    text-transform: capitalize;
  }
  
  .tooltip-status.error {
    color: #f38ba8;
  }
</style>