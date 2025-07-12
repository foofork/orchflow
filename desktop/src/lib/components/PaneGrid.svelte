<script lang="ts">
  import { onMount } from 'svelte';
  import TauriTerminal from './TauriTerminal.svelte';
  import { layoutClient, type GridLayout, type PaneLayout } from '$lib/tauri/layout';
  
    const sessionId = 'orchflow-main'; // Fixed session ID

  let layout: GridLayout | null = null;
  let selectedPaneId: string | null = null;
  
  onMount(async () => {
    // Create or get layout
    try {
      layout = await layoutClient.getLayout(sessionId);
    } catch {
      layout = await layoutClient.createLayout(sessionId);
    }
  });
  
  function renderPane(paneId: string): PaneLayout | null {
    if (!layout) return null;
    return layout.panes[paneId] || null;
  }
  
  async function splitPane(horizontal: boolean) {
    if (!layout || !selectedPaneId) return;
    
    try {
      const [child1, child2] = await layoutClient.splitPane(
        sessionId,
        selectedPaneId,
        horizontal,
        50
      );
      
      // Refresh layout
      layout = await layoutClient.getLayout(sessionId);
      
      // Select the new pane
      selectedPaneId = child2;
    } catch (error) {
      console.error('Failed to split pane:', error);
    }
  }
  
  async function closePane() {
    if (!layout || !selectedPaneId) return;
    
    try {
      await layoutClient.closePane(sessionId, selectedPaneId);
      
      // Refresh layout
      layout = await layoutClient.getLayout(sessionId);
      selectedPaneId = null;
    } catch (error) {
      console.error('Failed to close pane:', error);
    }
  }
  
  function selectPane(paneId: string) {
    selectedPaneId = paneId;
  }
  
  // Calculate CSS grid areas based on layout
  function calculateGridStyle(pane: PaneLayout): string {
    const { x, y, width, height } = pane.bounds;
    return `
      grid-column: ${x + 1} / span ${width};
      grid-row: ${y + 1} / span ${height};
    `;
  }
</script>

<div class="pane-grid-container">
  <div class="pane-controls">
    <button 
      on:click={() => splitPane(true)}
      disabled={!selectedPaneId}
      title="Split Horizontally"
      aria-label="Split selected pane horizontally"
    >
      ⬌
    </button>
    <button 
      on:click={() => splitPane(false)}
      disabled={!selectedPaneId}
      title="Split Vertically"
      aria-label="Split selected pane vertically"
    >
      ⬍
    </button>
    <button 
      on:click={closePane}
      disabled={!selectedPaneId || (layout && Object.keys(layout.panes).length === 1)}
      title="Close Pane"
      aria-label="Close selected pane"
    >
      ✕
    </button>
  </div>
  
  {#if layout}
    <div class="pane-grid">
      {#each Object.values(layout.panes) as pane (pane.id)}
        {#if pane.children.length === 0}
          <button 
            class="pane"
            class:selected={selectedPaneId === pane.id}
            style={calculateGridStyle(pane)}
            on:click={() => selectPane(pane.id)}
            type="button"
            aria-label="Select pane {pane.id}"
            aria-pressed={selectedPaneId === pane.id}
          >
            {#if pane.pane_id}
              <TauriTerminal
                sessionName={sessionId}
                paneId={pane.pane_id}
                title={`Pane ${pane.id.slice(-4)}`}
              />
            {:else}
              <div class="empty-pane">
                <p>Empty Pane</p>
                <p class="hint">Click to select, then split</p>
              </div>
            {/if}
          </button>
        {/if}
      {/each}
    </div>
  {:else}
    <div class="loading">
      <p>Initializing layout...</p>
    </div>
  {/if}
</div>

<style>
  .pane-grid-container {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  
  .pane-controls {
    display: flex;
    gap: 10px;
    padding: 10px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
  }
  
  .pane-controls button {
    padding: 5px 10px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    color: var(--fg-primary);
    cursor: pointer;
    border-radius: 3px;
    font-size: 16px;
    transition: all 0.2s;
  }
  
  .pane-controls button:hover:not(:disabled) {
    background: var(--bg-hover);
  }
  
  .pane-controls button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .pane-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(100, 1fr);
    grid-template-rows: repeat(100, 1fr);
    gap: 2px;
    background: var(--border);
    padding: 2px;
  }
  
  .pane {
    background: var(--bg-primary);
    overflow: hidden;
    cursor: pointer;
    position: relative;
    /* Reset button styles */
    border: none;
    padding: 0;
    font: inherit;
    color: inherit;
    text-align: left;
    width: auto;
    display: block;
  }
  
  .pane.selected {
    box-shadow: inset 0 0 0 2px var(--accent);
  }
  
  .empty-pane {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--fg-secondary);
  }
  
  .empty-pane .hint {
    font-size: 12px;
    opacity: 0.7;
  }
  
  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--fg-secondary);
  }
  
  /* Screen reader only content */
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>