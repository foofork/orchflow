<script lang="ts">
  import { formatTimestamp } from '$lib/utils/timestamp';
  import type { TerminalMetadata, TerminalState } from '$lib/services/terminal-ipc';
  
  export let metadata: TerminalMetadata | null = null;
  export let state: TerminalState | null = null;
  export let showRelative: boolean = true;
  
  $: displayData = {
    created: metadata?.created_at ? formatTimestamp(metadata.created_at, { 
      relative: showRelative,
      format: 'medium' 
    }) : null,
    lastActivity: (state?.last_activity || metadata?.last_activity) ? 
      formatTimestamp(state?.last_activity || metadata?.last_activity, { 
        relative: showRelative,
        format: 'medium' 
      }) : null,
    processId: state?.process_info?.pid || metadata?.process_id,
    shell: metadata?.shell,
    title: state?.title || metadata?.title,
    workingDir: state?.working_dir
  };
</script>

{#if metadata || state}
  <div class="terminal-metadata">
    <div class="metadata-grid">
      {#if displayData.title}
        <div class="metadata-item">
          <span class="label">Title:</span>
          <span class="value">{displayData.title}</span>
        </div>
      {/if}
      
      {#if displayData.shell}
        <div class="metadata-item">
          <span class="label">Shell:</span>
          <span class="value">{displayData.shell}</span>
        </div>
      {/if}
      
      {#if displayData.processId}
        <div class="metadata-item">
          <span class="label">Process ID:</span>
          <span class="value">{displayData.processId}</span>
        </div>
      {/if}
      
      {#if displayData.workingDir}
        <div class="metadata-item">
          <span class="label">Working Directory:</span>
          <span class="value" title={displayData.workingDir}>{displayData.workingDir}</span>
        </div>
      {/if}
      
      {#if displayData.created}
        <div class="metadata-item">
          <span class="label">Created:</span>
          <span class="value" title="Click to toggle format" 
                on:click={() => showRelative = !showRelative}
                role="button"
                tabindex="0"
                on:keydown={(e) => e.key === 'Enter' && (showRelative = !showRelative)}>
            {displayData.created}
          </span>
        </div>
      {/if}
      
      {#if displayData.lastActivity}
        <div class="metadata-item">
          <span class="label">Last Activity:</span>
          <span class="value" title="Click to toggle format"
                on:click={() => showRelative = !showRelative}
                role="button"
                tabindex="0"
                on:keydown={(e) => e.key === 'Enter' && (showRelative = !showRelative)}>
            {displayData.lastActivity}
          </span>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .terminal-metadata {
    padding: 0.5rem;
    background-color: var(--color-surface);
    border-radius: 0.25rem;
    font-size: 0.875rem;
  }
  
  .metadata-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.5rem;
  }
  
  .metadata-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    overflow: hidden;
  }
  
  .label {
    font-weight: 500;
    color: var(--color-text-secondary);
    flex-shrink: 0;
  }
  
  .value {
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .value[role="button"] {
    cursor: pointer;
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 2px;
  }
  
  .value[role="button"]:hover {
    color: var(--color-primary);
  }
  
  .value[role="button"]:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
    border-radius: 2px;
  }
</style>