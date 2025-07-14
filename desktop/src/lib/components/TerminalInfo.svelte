<script lang="ts">
  import { terminalIPC } from '$lib/services/terminal-ipc';
  import TerminalMetadata from './TerminalMetadata.svelte';
  import type { TerminalMetadata as TMetadata, TerminalState } from '$lib/services/terminal-ipc';
  
  export let terminalId: string;
  
  let metadata: TMetadata | null = null;
  let state: TerminalState | null = null;
  let loading = true;
  let error: string | null = null;
  
  async function loadTerminalInfo() {
    loading = true;
    error = null;
    
    try {
      // Get metadata from stored terminals
      const terminals = terminalIPC.getTerminals();
      metadata = terminals.get(terminalId) || null;
      
      // Get current state
      state = await terminalIPC.getState(terminalId);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load terminal info';
    } finally {
      loading = false;
    }
  }
  
  // Load info on mount
  $: if (terminalId) {
    loadTerminalInfo();
  }
  
  // Subscribe to state changes
  $: if (terminalId) {
    const unsubscribe = terminalIPC.subscribeToTerminal(terminalId, {
      onStateChange: (newState) => {
        state = newState;
      }
    });
    
    // Cleanup on component destroy
    return () => {
      unsubscribe();
    };
  }
</script>

<div class="terminal-info">
  {#if loading}
    <div class="loading">Loading terminal information...</div>
  {:else if error}
    <div class="error">Error: {error}</div>
  {:else}
    <TerminalMetadata {metadata} {state} />
  {/if}
</div>

<style>
  .terminal-info {
    padding: 1rem;
  }
  
  .loading {
    color: var(--color-text-secondary);
    font-style: italic;
  }
  
  .error {
    color: var(--color-error);
    padding: 0.5rem;
    background-color: var(--color-error-bg);
    border-radius: 0.25rem;
  }
</style>