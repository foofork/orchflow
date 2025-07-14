<script lang="ts">
  import TerminalPanel from '$lib/components/TerminalPanel.svelte';
  import { onMount } from 'svelte';
  
  let layoutOptions = [
    { value: 'single', label: 'Single Terminal' },
    { value: 'split-horizontal', label: 'Split Horizontal' },
    { value: 'split-vertical', label: 'Split Vertical' },
    { value: 'grid', label: 'Grid Layout' }
  ];
  
  let selectedLayout: 'single' | 'split-horizontal' | 'split-vertical' | 'grid' = 'single';
  let showPanel = true;
  
  function handleTerminalEvent(event: CustomEvent) {
    console.log('Terminal event:', event.type, event.detail);
  }
  
  function togglePanel() {
    showPanel = !showPanel;
  }
</script>

<main>
  <div class="demo-header">
    <h1>Terminal Panel Component Demo</h1>
    <div class="controls">
      <select bind:value={selectedLayout}>
        {#each layoutOptions as option (option.value)}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
      
      <button on:click={togglePanel}>
        {showPanel ? 'Hide' : 'Show'} Panel
      </button>
    </div>
  </div>
  
  {#if showPanel}
    <div class="terminal-container">
      <TerminalPanel
        layout={selectedLayout}
        defaultShell="/bin/bash"
        on:terminalCreated={handleTerminalEvent}
        on:terminalClosed={handleTerminalEvent}
        on:terminalActivated={handleTerminalEvent}
        on:error={handleTerminalEvent}
      />
    </div>
  {/if}
  
  <div class="demo-info">
    <div class="info-section">
      <h3>Terminal Panel Features</h3>
      <ul>
        <li>✓ Multi-terminal management with tabs</li>
        <li>✓ Split view layouts (horizontal/vertical/grid)</li>
        <li>✓ Shell selection menu</li>
        <li>✓ Terminal status bar</li>
        <li>✓ Keyboard shortcuts</li>
        <li>✓ Terminal groups by working directory</li>
        <li>✓ Broadcast commands to multiple terminals</li>
        <li>✓ Search across terminal output</li>
      </ul>
    </div>
    
    <div class="info-section">
      <h3>Keyboard Shortcuts</h3>
      <ul>
        <li><kbd>Ctrl+T</kbd> - New terminal</li>
        <li><kbd>Ctrl+W</kbd> - Close terminal</li>
        <li><kbd>Ctrl+\</kbd> - Split vertical</li>
        <li><kbd>Ctrl+-</kbd> - Split horizontal</li>
        <li><kbd>Ctrl+F</kbd> - Toggle search</li>
        <li><kbd>Ctrl+Tab</kbd> - Next terminal</li>
        <li><kbd>Ctrl+Shift+Tab</kbd> - Previous terminal</li>
        <li><kbd>Ctrl+1-9</kbd> - Switch to terminal N</li>
      </ul>
    </div>
    
    <div class="info-section">
      <h3>Implementation Notes</h3>
      <ul>
        <li>Uses StreamingTerminal component internally</li>
        <li>Persists terminal groups to localStorage</li>
        <li>Integrates with Git for directory context</li>
        <li>Supports custom terminal templates</li>
      </ul>
    </div>
  </div>
</main>

<style>
  main {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    color: var(--fg-primary);
  }
  
  .demo-header {
    padding: 1rem 2rem;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  .demo-header h1 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--accent);
  }
  
  .controls {
    display: flex;
    gap: 1rem;
    align-items: center;
  }
  
  .controls button,
  .controls select {
    padding: 0.5rem 1rem;
    background: var(--bg-tertiary);
    color: var(--fg-primary);
    border: 1px solid var(--border);
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
  }
  
  .controls button:hover,
  .controls select:hover {
    background: var(--bg-hover);
  }
  
  .terminal-container {
    flex: 1;
    overflow: hidden;
    background: var(--bg-primary);
  }
  
  .demo-info {
    padding: 1rem 2rem;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    display: flex;
    gap: 3rem;
    overflow-x: auto;
  }
  
  .info-section {
    min-width: 250px;
  }
  
  .demo-info h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    color: var(--accent);
  }
  
  .demo-info ul {
    margin: 0;
    padding-left: 1.5rem;
    font-size: 0.875rem;
    list-style: none;
  }
  
  .demo-info li {
    margin-bottom: 0.25rem;
    position: relative;
  }
  
  .demo-info li::before {
    content: '';
    position: absolute;
    left: -1rem;
  }
  
  kbd {
    display: inline-block;
    padding: 0.2rem 0.4rem;
    font-size: 0.75rem;
    font-family: var(--font-mono);
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 3px;
  }
</style>