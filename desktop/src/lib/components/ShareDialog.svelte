<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { open } from '@tauri-apps/plugin-dialog';
  import { fade, slide } from 'svelte/transition';
  
  export let show = false;
  export let mode: 'create' | 'import' = 'create';
  export let testMode = false;
  
  const dispatch = createEventDispatcher();
  
  interface SharePackage {
    id: string;
    name: string;
    description: string;
    created_at: string;
    author: string;
    version: string;
    files: Array<{
      path: string;
      size: number;
      hash: string;
      file_type: string;
    }>;
    signature?: string;
  }
  
  interface ShareResult {
    success: boolean;
    path?: string;
    url?: string;
    error?: string;
  }
  
  // Create mode state
  let packageName = '';
  let packageDescription = '';
  let selectedFiles: string[] = [];
  let uploadEndpoint = '';
  let apiKey = '';
  
  // Import mode state
  let importPath = '';
  let targetDirectory = '';
  
  // Shared state
  let loading = false;
  let error: string | null = null;
  let success: ShareResult | null = null;
  let recentPackages: SharePackage[] = [];
  
  $: if (show && !testMode) {
    loadRecentPackages();
  }
  
  async function loadRecentPackages() {
    try {
      recentPackages = await invoke('list_share_packages');
    } catch (err) {
      console.error('Failed to load recent packages:', err);
    }
  }
  
  async function selectFiles() {
    try {
      const selected = await open({
        multiple: true,
        title: 'Select files to share'
      });
      
      if (selected) {
        if (Array.isArray(selected)) {
          selectedFiles = [...selectedFiles, ...selected];
        } else {
          selectedFiles = [...selectedFiles, selected];
        }
        // Remove duplicates
        selectedFiles = [...new Set(selectedFiles)];
      }
    } catch (err) {
      console.error('Failed to select files:', err);
    }
  }
  
  function removeFile(index: number) {
    selectedFiles = selectedFiles.filter((_, i) => i !== index);
  }
  
  async function createPackage() {
    if (!packageName || selectedFiles.length === 0) {
      error = 'Please provide a name and select files';
      return;
    }
    
    loading = true;
    error = null;
    success = null;
    
    try {
      const result: ShareResult = await invoke('create_share_package', {
        name: packageName,
        description: packageDescription,
        files: selectedFiles
      });
      
      if (result.success) {
        success = result;
        
        // Upload if endpoint provided
        if (uploadEndpoint && result.path) {
          await uploadPackage(result.path);
        }
        
        dispatch('created', result);
      } else {
        error = result.error || 'Failed to create package';
      }
    } catch (err) {
      error = String(err);
    } finally {
      loading = false;
    }
  }
  
  async function uploadPackage(packagePath: string) {
    try {
      const result: ShareResult = await invoke('upload_share_package', {
        zipPath: packagePath,
        endpoint: uploadEndpoint,
        apiKey: apiKey || null
      });
      
      if (result.success && result.url) {
        success = { 
          success: true,
          path: success?.path, 
          url: result.url,
          error: success?.error
        };
      }
    } catch (err) {
      console.error('Upload failed:', err);
      // Don't fail the whole operation if upload fails
    }
  }
  
  async function selectImportFile() {
    try {
      const selected = await open({
        filters: [{
          name: 'OrchFlow Package',
          extensions: ['zip']
        }],
        title: 'Select package to import'
      });
      
      if (selected && typeof selected === 'string') {
        importPath = selected;
      }
    } catch (err) {
      console.error('Failed to select file:', err);
    }
  }
  
  async function selectTargetDirectory() {
    try {
      const selected = await open({
        directory: true,
        title: 'Select target directory'
      });
      
      if (selected && typeof selected === 'string') {
        targetDirectory = selected;
      }
    } catch (err) {
      console.error('Failed to select directory:', err);
    }
  }
  
  async function importPackage() {
    if (!importPath || !targetDirectory) {
      error = 'Please select a package and target directory';
      return;
    }
    
    loading = true;
    error = null;
    success = null;
    
    try {
      const result: ShareResult = await invoke('import_share_package', {
        zipPath: importPath,
        targetDir: targetDirectory
      });
      
      if (result.success) {
        success = result;
        dispatch('imported', result);
      } else {
        error = result.error || 'Failed to import package';
      }
    } catch (err) {
      error = String(err);
    } finally {
      loading = false;
    }
  }
  
  async function deletePackage(packageId: string) {
    if (!confirm('Delete this package?')) return;
    
    try {
      await invoke('delete_share_package', { shareId: packageId });
      await loadRecentPackages();
    } catch (err) {
      console.error('Failed to delete package:', err);
    }
  }
  
  function close() {
    show = false;
    dispatch('close');
    
    // Reset state
    packageName = '';
    packageDescription = '';
    selectedFiles = [];
    uploadEndpoint = '';
    apiKey = '';
    importPath = '';
    targetDirectory = '';
    error = null;
    success = null;
  }
  
  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }
  
  function formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch {
      return dateStr;
    }
  }
</script>

{#if show}
  <div class="share-overlay" on:click={close} transition:fade={{ duration: 200 }}>
    <div 
      class="share-dialog" 
      on:click|stopPropagation
      transition:slide={{ duration: 300 }}
    >
      <div class="dialog-header">
        <h2>{mode === 'create' ? 'Share Files' : 'Import Package'}</h2>
        <div class="mode-toggle">
          <button 
            class="mode-btn" 
            class:active={mode === 'create'}
            on:click={() => mode = 'create'}
          >
            Create
          </button>
          <button 
            class="mode-btn" 
            class:active={mode === 'import'}
            on:click={() => mode = 'import'}
          >
            Import
          </button>
        </div>
        <button class="close-btn" on:click={close}>×</button>
      </div>
      
      <div class="dialog-content">
        {#if mode === 'create'}
          <div class="form-section">
            <label>
              Package Name
              <input 
                type="text" 
                bind:value={packageName}
                placeholder="My Project Files"
                disabled={loading}
              />
            </label>
            
            <label>
              Description
              <textarea 
                bind:value={packageDescription}
                placeholder="Optional description..."
                rows="3"
                disabled={loading}
              />
            </label>
            
            <div class="files-section">
              <div class="section-header">
                <h3>Files ({selectedFiles.length})</h3>
                <button 
                  class="btn secondary small"
                  on:click={selectFiles}
                  disabled={loading}
                >
                  Add Files
                </button>
              </div>
              
              {#if selectedFiles.length > 0}
                <ul class="file-list">
                  {#each selectedFiles as file, i (file)}
                    <li>
                      <span class="file-path">{file}</span>
                      <button 
                        class="remove-btn"
                        on:click={() => removeFile(i)}
                        disabled={loading}
                      >
                        ×
                      </button>
                    </li>
                  {/each}
                </ul>
              {:else}
                <p class="empty-state">No files selected</p>
              {/if}
            </div>
            
            <details class="upload-section">
              <summary>Upload Options (Optional)</summary>
              <label>
                Endpoint URL
                <input 
                  type="url" 
                  bind:value={uploadEndpoint}
                  placeholder="https://api.example.com/upload"
                  disabled={loading}
                />
              </label>
              
              <label>
                API Key
                <input 
                  type="password" 
                  bind:value={apiKey}
                  placeholder="Optional authentication"
                  disabled={loading}
                />
              </label>
            </details>
          </div>
          
        {:else}
          <div class="form-section">
            <label>
              Package File
              <div class="file-input-group">
                <input 
                  type="text" 
                  bind:value={importPath}
                  placeholder="Select .orchflow.zip file"
                  readonly
                  disabled={loading}
                />
                <button 
                  class="btn secondary"
                  on:click={selectImportFile}
                  disabled={loading}
                >
                  Browse
                </button>
              </div>
            </label>
            
            <label>
              Target Directory
              <div class="file-input-group">
                <input 
                  type="text" 
                  bind:value={targetDirectory}
                  placeholder="Select destination folder"
                  readonly
                  disabled={loading}
                />
                <button 
                  class="btn secondary"
                  on:click={selectTargetDirectory}
                  disabled={loading}
                >
                  Browse
                </button>
              </div>
            </label>
          </div>
        {/if}
        
        {#if recentPackages && recentPackages.length > 0}
          <div class="recent-section">
            <h3>Recent Packages</h3>
            <div class="package-list">
              {#each recentPackages as pkg (pkg.id)}
                <div class="package-item">
                  <div class="package-info">
                    <h4>{pkg.name}</h4>
                    <p>{pkg.description || 'No description'}</p>
                    <div class="package-meta">
                      <span>{pkg.files.length} files</span>
                      <span>by {pkg.author}</span>
                      <span>{formatDate(pkg.created_at)}</span>
                    </div>
                  </div>
                  <button 
                    class="delete-btn"
                    on:click={() => deletePackage(pkg.id)}
                    title="Delete package"
                  >
                    🗑
                  </button>
                </div>
              {/each}
            </div>
          </div>
        {/if}
        
        {#if error}
          <div class="error-message">
            {error}
          </div>
        {/if}
        
        {#if success}
          <div class="success-message">
            <p>✓ Package {mode === 'create' ? 'created' : 'imported'} successfully!</p>
            {#if success.path}
              <p class="path">Path: {success.path}</p>
            {/if}
            {#if success.url}
              <p class="url">URL: <a href={success.url} target="_blank">{success.url}</a></p>
            {/if}
          </div>
        {/if}
      </div>
      
      <div class="dialog-footer">
        <button class="btn secondary" on:click={close}>
          {success ? 'Close' : 'Cancel'}
        </button>
        {#if !success}
          <button 
            class="btn primary" 
            on:click={mode === 'create' ? createPackage : importPackage}
            disabled={loading || (mode === 'create' ? !packageName || selectedFiles.length === 0 : !importPath || !targetDirectory)}
          >
            {#if loading}
              {mode === 'create' ? 'Creating...' : 'Importing...'}
            {:else}
              {mode === 'create' ? 'Create Package' : 'Import Package'}
            {/if}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .share-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--backdrop-color);
    backdrop-filter: blur(12px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  
  .share-dialog {
    background: var(--color-bg-primary, #11111b);
    border: 1px solid var(--color-border, #45475a);
    border-radius: 8px;
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }
  
  .dialog-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
    border-bottom: 1px solid var(--color-border, #45475a);
  }
  
  .dialog-header h2 {
    margin: 0;
    font-size: 20px;
    color: var(--color-text-primary, #cdd6f4);
  }
  
  .mode-toggle {
    display: flex;
    margin-left: auto;
    background: var(--color-bg-secondary, #1e1e2e);
    border-radius: 4px;
    padding: 2px;
  }
  
  .mode-btn {
    background: none;
    border: none;
    padding: 6px 12px;
    font-size: 14px;
    color: var(--color-text-secondary, #bac2de);
    cursor: pointer;
    border-radius: 3px;
    transition: all 0.2s;
  }
  
  .mode-btn.active {
    background: var(--color-primary, #89b4fa);
    color: var(--color-bg-primary, #11111b);
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 28px;
    color: var(--color-text-secondary, #bac2de);
    cursor: pointer;
    padding: 0;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }
  
  .close-btn:hover {
    background: var(--color-bg-hover, #45475a);
    color: var(--color-text-primary, #cdd6f4);
  }
  
  .dialog-content {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
  }
  
  .form-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  
  label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 14px;
    color: var(--color-text-secondary, #bac2de);
  }
  
  input, textarea {
    background: var(--color-bg-secondary, #1e1e2e);
    border: 1px solid var(--color-border, #45475a);
    border-radius: 4px;
    padding: 8px 12px;
    font-size: 14px;
    color: var(--color-text-primary, #cdd6f4);
    font-family: inherit;
  }
  
  input:focus, textarea:focus {
    outline: none;
    border-color: var(--color-primary, #89b4fa);
  }
  
  input:disabled, textarea:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .file-input-group {
    display: flex;
    gap: 8px;
  }
  
  .file-input-group input {
    flex: 1;
  }
  
  .files-section {
    margin-top: 8px;
  }
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  
  .section-header h3 {
    margin: 0;
    font-size: 16px;
    color: var(--color-text-primary, #cdd6f4);
  }
  
  .file-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .file-list li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--color-bg-secondary, #1e1e2e);
    border: 1px solid var(--color-border, #45475a);
    border-radius: 4px;
  }
  
  .file-path {
    flex: 1;
    font-size: 13px;
    color: var(--color-text-primary, #cdd6f4);
    font-family: monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .remove-btn {
    background: none;
    border: none;
    color: var(--color-text-secondary, #bac2de);
    cursor: pointer;
    font-size: 20px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }
  
  .remove-btn:hover {
    background: var(--color-error, #f38ba8);
    color: var(--color-bg-primary, #11111b);
  }
  
  .empty-state {
    text-align: center;
    color: var(--color-text-secondary, #6c7086);
    font-size: 14px;
    padding: 20px;
  }
  
  .upload-section {
    margin-top: 8px;
    background: var(--color-bg-secondary, #1e1e2e);
    border: 1px solid var(--color-border, #45475a);
    border-radius: 4px;
    padding: 12px;
  }
  
  .upload-section summary {
    cursor: pointer;
    font-size: 14px;
    color: var(--color-text-secondary, #bac2de);
    user-select: none;
  }
  
  .upload-section[open] summary {
    margin-bottom: 12px;
  }
  
  .recent-section {
    margin-top: 24px;
    padding-top: 24px;
    border-top: 1px solid var(--color-border, #45475a);
  }
  
  .recent-section h3 {
    margin: 0 0 12px 0;
    font-size: 16px;
    color: var(--color-text-primary, #cdd6f4);
  }
  
  .package-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .package-item {
    display: flex;
    align-items: start;
    gap: 12px;
    padding: 12px;
    background: var(--color-bg-secondary, #1e1e2e);
    border: 1px solid var(--color-border, #45475a);
    border-radius: 4px;
  }
  
  .package-info {
    flex: 1;
  }
  
  .package-info h4 {
    margin: 0 0 4px 0;
    font-size: 14px;
    color: var(--color-text-primary, #cdd6f4);
  }
  
  .package-info p {
    margin: 0 0 8px 0;
    font-size: 13px;
    color: var(--color-text-secondary, #bac2de);
  }
  
  .package-meta {
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: var(--color-text-secondary, #6c7086);
  }
  
  .delete-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 16px;
    opacity: 0.6;
    transition: opacity 0.2s;
  }
  
  .delete-btn:hover {
    opacity: 1;
  }
  
  .error-message {
    margin-top: 16px;
    padding: 12px;
    background: var(--color-error-bg, rgba(243, 139, 168, 0.1));
    border: 1px solid var(--color-error, #f38ba8);
    border-radius: 4px;
    color: var(--color-error, #f38ba8);
    font-size: 14px;
  }
  
  .success-message {
    margin-top: 16px;
    padding: 12px;
    background: var(--color-success-bg, rgba(166, 227, 161, 0.1));
    border: 1px solid var(--color-success, #a6e3a1);
    border-radius: 4px;
    color: var(--color-success, #a6e3a1);
    font-size: 14px;
  }
  
  .success-message .path,
  .success-message .url {
    margin: 4px 0;
    font-size: 13px;
    font-family: monospace;
  }
  
  .success-message a {
    color: inherit;
    text-decoration: underline;
  }
  
  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 20px;
    border-top: 1px solid var(--color-border, #45475a);
  }
  
  .btn {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn.primary {
    background: var(--color-primary, #89b4fa);
    color: var(--color-bg-primary, #11111b);
  }
  
  .btn.primary:hover:not(:disabled) {
    background: var(--color-primary-hover, #74a8f5);
  }
  
  .btn.secondary {
    background: var(--color-bg-tertiary, #313244);
    color: var(--color-text-primary, #cdd6f4);
    border: 1px solid var(--color-border, #45475a);
  }
  
  .btn.secondary:hover {
    background: var(--color-bg-hover, #45475a);
  }
  
  .btn.small {
    padding: 4px 12px;
    font-size: 13px;
  }
</style>