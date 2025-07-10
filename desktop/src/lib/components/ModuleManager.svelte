<script lang="ts">
  import { onMount } from 'svelte';
  import { moduleClient, type ModuleManifest } from '$lib/tauri/modules';
  
  let modules: ModuleManifest[] = [];
  let loading = true;
  let error: string | null = null;
  
  onMount(async () => {
    await loadModules();
  });
  
  async function loadModules() {
    try {
      loading = true;
      error = null;
      
      // Scan for new modules
      await moduleClient.scanModules();
      
      // List all modules
      modules = await moduleClient.listModules();
    } catch (e) {
      error = String(e);
    } finally {
      loading = false;
    }
  }
  
  async function toggleModule(module: ModuleManifest, enabled: boolean) {
    try {
      await moduleClient.enableModule(module.name, enabled);
      // Refresh module list
      await loadModules();
    } catch (e) {
      error = String(e);
    }
  }
  
  function getModuleIcon(type: ModuleManifest['module_type']): string {
    switch (type) {
      case 'agent': return '🤖';
      case 'command': return '⚡';
      case 'layout': return '📐';
      case 'theme': return '🎨';
      case 'language': return '🌐';
      case 'tool': return '🔧';
      default: return '📦';
    }
  }
  
  function getPermissionIcon(permission: string): string {
    switch (permission) {
      case 'file_system': return '📁';
      case 'network': return '🌐';
      case 'process': return '⚙️';
      case 'terminal': return '💻';
      case 'editor': return '✏️';
      case 'state': return '💾';
      default: return '🔑';
    }
  }
</script>

<div class="module-manager">
  <div class="header">
    <h2>Modules</h2>
    <button class="refresh-button" on:click={loadModules} disabled={loading}>
      🔄 Refresh
    </button>
  </div>
  
  {#if loading}
    <div class="loading">
      <p>Loading modules...</p>
    </div>
  {:else if error}
    <div class="error">
      <p>Error: {error}</p>
    </div>
  {:else if modules.length === 0}
    <div class="empty">
      <p>No modules found</p>
      <p class="hint">Place modules in the modules directory</p>
    </div>
  {:else}
    <div class="module-list">
      {#each modules as module}
        <div class="module-card">
          <div class="module-header">
            <div class="module-title">
              <span class="module-icon">{getModuleIcon(module.module_type)}</span>
              <h3>{module.name}</h3>
              <span class="module-version">v{module.version}</span>
            </div>
            <label class="toggle">
              <input 
                type="checkbox" 
                checked={true}
                on:change={(e) => toggleModule(module, e.currentTarget.checked)}
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
          
          <p class="module-description">{module.description}</p>
          <p class="module-author">by {module.author}</p>
          
          <div class="module-meta">
            <div class="module-type">
              <span class="label">Type:</span>
              <span class="value">{module.module_type}</span>
            </div>
            
            {#if module.permissions.length > 0}
              <div class="module-permissions">
                <span class="label">Permissions:</span>
                <div class="permission-list">
                  {#each module.permissions as permission}
                    <span class="permission" title={permission}>
                      {getPermissionIcon(permission)}
                    </span>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
          
          {#if module.dependencies.length > 0}
            <div class="module-dependencies">
              <span class="label">Dependencies:</span>
              {#each module.dependencies as dep}
                <span class="dependency">{dep.name}@{dep.version}</span>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .module-manager {
    height: 100%;
    overflow-y: auto;
    background: var(--bg-primary);
    color: var(--fg-primary);
    padding: 20px;
  }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  
  .header h2 {
    margin: 0;
    font-size: 20px;
  }
  
  .refresh-button {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    color: var(--fg-primary);
    padding: 5px 10px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }
  
  .refresh-button:hover:not(:disabled) {
    background: var(--bg-hover);
  }
  
  .refresh-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .loading, .error, .empty {
    text-align: center;
    padding: 40px;
    color: var(--fg-secondary);
  }
  
  .error {
    color: var(--error);
  }
  
  .hint {
    font-size: 12px;
    opacity: 0.7;
  }
  
  .module-list {
    display: grid;
    gap: 15px;
  }
  
  .module-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 15px;
    transition: all 0.2s;
  }
  
  .module-card:hover {
    border-color: var(--accent);
  }
  
  .module-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  
  .module-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .module-icon {
    font-size: 20px;
  }
  
  .module-title h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 500;
  }
  
  .module-version {
    font-size: 12px;
    color: var(--fg-secondary);
  }
  
  .toggle {
    position: relative;
    display: inline-block;
    width: 40px;
    height: 22px;
  }
  
  .toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--bg-tertiary);
    transition: .4s;
    border-radius: 11px;
  }
  
  .toggle-slider:before {
    position: absolute;
    content: "";
    height: 16px;
    width: 16px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: .4s;
    border-radius: 50%;
  }
  
  .toggle input:checked + .toggle-slider {
    background-color: var(--accent);
  }
  
  .toggle input:checked + .toggle-slider:before {
    transform: translateX(18px);
  }
  
  .module-description {
    margin: 5px 0;
    font-size: 13px;
    color: var(--fg-secondary);
  }
  
  .module-author {
    font-size: 12px;
    color: var(--fg-secondary);
    margin-bottom: 10px;
  }
  
  .module-meta {
    display: flex;
    gap: 20px;
    font-size: 12px;
  }
  
  .module-type,
  .module-permissions,
  .module-dependencies {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  
  .label {
    color: var(--fg-secondary);
  }
  
  .permission-list {
    display: flex;
    gap: 3px;
  }
  
  .permission {
    font-size: 14px;
  }
  
  .dependency {
    background: var(--bg-tertiary);
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
  }
</style>