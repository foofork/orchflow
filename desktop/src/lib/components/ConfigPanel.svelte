<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  
  export let title = 'Configuration';
  export let config: any = {};
  export let schema: any = null;
  export let mode: 'json' | 'yaml' = 'json';
  export let show = false;
  
  const dispatch = createEventDispatcher();
  
  let CodeMirrorEditor: any;
  let editorLoaded = false;
  let editorValue = '';
  let validationErrors: string[] = [];
  let hasChanges = false;
  let saving = false;
  
  // Convert config to string
  $: {
    if (mode === 'json') {
      editorValue = JSON.stringify(config, null, 2);
    } else {
      // For YAML mode, we'd need a YAML library
      editorValue = JSON.stringify(config, null, 2);
    }
  }
  
  onMount(async () => {
    if (show) {
      await loadEditor();
    }
  });
  
  async function loadEditor() {
    if (editorLoaded) return;
    
    try {
      // Dynamically import CodeMirror editor component
      const module = await import('./CodeMirrorEditor.svelte');
      CodeMirrorEditor = module.default;
      editorLoaded = true;
    } catch (err) {
      console.error('Failed to load CodeMirror editor:', err);
    }
  }
  
  function handleEditorChange(event: CustomEvent<string>) {
    hasChanges = true;
    validateConfig(event.detail);
  }
  
  function validateConfig(value: string) {
    validationErrors = [];
    
    try {
      const parsed = JSON.parse(value);
      
      // Validate against schema if provided
      if (schema) {
        const errors = validateAgainstSchema(parsed, schema);
        validationErrors = errors;
      }
      
      return parsed;
    } catch (err) {
      validationErrors = [`Invalid JSON: ${err.message}`];
      return null;
    }
  }
  
  function validateAgainstSchema(data: any, schema: any): string[] {
    const errors: string[] = [];
    
    // Simple schema validation (in production, use a proper JSON Schema validator)
    for (const [key, schemaValue] of Object.entries(schema)) {
      if (schemaValue.required && !(key in data)) {
        errors.push(`Missing required field: ${key}`);
      }
      
      if (key in data && schemaValue.type) {
        const actualType = typeof data[key];
        const expectedType = schemaValue.type;
        
        if (actualType !== expectedType) {
          errors.push(`Invalid type for ${key}: expected ${expectedType}, got ${actualType}`);
        }
      }
    }
    
    return errors;
  }
  
  async function save() {
    const parsed = validateConfig(editorValue);
    
    if (!parsed || validationErrors.length > 0) {
      return;
    }
    
    saving = true;
    
    try {
      dispatch('save', parsed);
      hasChanges = false;
      
      // Show success feedback
      setTimeout(() => {
        saving = false;
      }, 500);
    } catch (err) {
      console.error('Save failed:', err);
      saving = false;
    }
  }
  
  function close() {
    if (hasChanges) {
      if (!confirm('You have unsaved changes. Close anyway?')) {
        return;
      }
    }
    
    show = false;
    dispatch('close');
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      close();
    }
  }
  
  function reset() {
    if (confirm('Reset to default configuration?')) {
      editorValue = JSON.stringify(config, null, 2);
      hasChanges = false;
      validationErrors = [];
    }
  }
  
  // Load editor when panel opens
  $: if (show && !editorLoaded) {
    loadEditor();
  }
</script>

{#if show}
  <div 
    class="config-panel-overlay" 
    on:click={close} 
    on:keydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-label="Configuration Panel"
    transition:fade={{ duration: 200 }}
  >
    <div 
      class="config-panel" 
      on:click|stopPropagation
      role="document"
      transition:slide={{ duration: 300 }}
    >
      <div class="panel-header">
        <h2>{title}</h2>
        <button class="close-btn" on:click={close}>×</button>
      </div>
      
      <div class="panel-content">
        {#if editorLoaded && CodeMirrorEditor}
          <div class="editor-section">
            <svelte:component 
              this={CodeMirrorEditor}
              value={editorValue}
              language={mode}
              theme="dark"
              height="400px"
              on:change={handleEditorChange}
              on:save={save}
            />
          </div>
        {:else}
          <div class="loading">
            <div class="spinner"></div>
            <p>Loading configuration editor...</p>
          </div>
        {/if}
        
        {#if validationErrors.length > 0}
          <div class="validation-errors">
            <h3>Validation Errors:</h3>
            <ul>
              {#each validationErrors as error}
                <li>{error}</li>
              {/each}
            </ul>
          </div>
        {/if}
        
        {#if schema}
          <details class="schema-info">
            <summary>Configuration Schema</summary>
            <pre>{JSON.stringify(schema, null, 2)}</pre>
          </details>
        {/if}
      </div>
      
      <div class="panel-footer">
        <div class="status">
          {#if hasChanges}
            <span class="unsaved">Unsaved changes</span>
          {:else if saving}
            <span class="saving">Saving...</span>
          {:else}
            <span class="saved">Saved</span>
          {/if}
        </div>
        
        <div class="actions">
          <button class="btn secondary" on:click={reset}>
            Reset
          </button>
          <button 
            class="btn primary" 
            on:click={save}
            disabled={!hasChanges || validationErrors.length > 0 || saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .config-panel-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(2px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  
  .config-panel {
    background: var(--color-bg-primary, #11111b);
    border: 1px solid var(--color-border, #45475a);
    border-radius: 8px;
    width: 100%;
    max-width: 800px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }
  
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid var(--color-border, #45475a);
  }
  
  .panel-header h2 {
    margin: 0;
    font-size: 20px;
    color: var(--color-text-primary, #cdd6f4);
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
  
  .panel-content {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
  }
  
  .editor-section {
    margin-bottom: 20px;
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
  
  .validation-errors {
    background: var(--color-error-bg, rgba(243, 139, 168, 0.1));
    border: 1px solid var(--color-error, #f38ba8);
    border-radius: 4px;
    padding: 16px;
    margin-bottom: 20px;
  }
  
  .validation-errors h3 {
    margin: 0 0 8px 0;
    font-size: 16px;
    color: var(--color-error, #f38ba8);
  }
  
  .validation-errors ul {
    margin: 0;
    padding-left: 20px;
    color: var(--color-error, #f38ba8);
  }
  
  .schema-info {
    background: var(--color-bg-secondary, #1e1e2e);
    border: 1px solid var(--color-border, #45475a);
    border-radius: 4px;
    padding: 12px;
    font-size: 14px;
  }
  
  .schema-info summary {
    cursor: pointer;
    color: var(--color-text-secondary, #bac2de);
    user-select: none;
  }
  
  .schema-info pre {
    margin: 12px 0 0 0;
    padding: 12px;
    background: var(--color-bg-primary, #11111b);
    border-radius: 4px;
    overflow-x: auto;
    color: var(--color-text-primary, #cdd6f4);
    font-size: 12px;
  }
  
  .panel-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-top: 1px solid var(--color-border, #45475a);
  }
  
  .status {
    font-size: 14px;
  }
  
  .status .unsaved {
    color: var(--color-warning, #f9e2af);
  }
  
  .status .saving {
    color: var(--color-info, #89b4fa);
  }
  
  .status .saved {
    color: var(--color-success, #a6e3a1);
  }
  
  .actions {
    display: flex;
    gap: 12px;
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
</style>