<script lang="ts">
  import { onMount } from 'svelte';
  import StreamingTerminal from '$lib/components/StreamingTerminal.svelte';
  import TerminalGrid from '$lib/components/TerminalGrid.svelte';
  import { terminalIPC } from '$lib/services/terminal-ipc';
  
  let singleTerminalMode = true;
  let terminalGrid: TerminalGrid;
  let layoutOptions = [
    { value: 'single', label: 'Single' },
    { value: 'split-horizontal', label: 'Split Horizontal' },
    { value: 'split-vertical', label: 'Split Vertical' },
    { value: 'grid-2x2', label: 'Grid 2x2' },
    { value: 'grid-3x3', label: 'Grid 3x3' }
  ];
  let selectedLayout: any = 'single';
  
  function toggleMode() {
    singleTerminalMode = !singleTerminalMode;
  }
  
  function changeLayout() {
    if (terminalGrid) {
      terminalGrid.setLayout(selectedLayout as any);
    }
  }
  
  function addTerminal() {
    if (terminalGrid) {
      terminalGrid.addTerminal(`Terminal ${Date.now()}`);
    }
  }
  
  function broadcastMessage() {
    const message = prompt('Enter message to broadcast to all terminals:');
    if (message && terminalGrid) {
      terminalGrid.broadcastInput(message);
    }
  }
</script>

<main>
  <div class="demo-header">
    <h1>Terminal Streaming Demo</h1>
    <div class="controls">
      <button on:click={toggleMode}>
        Switch to {singleTerminalMode ? 'Multi' : 'Single'} Terminal
      </button>
      
      {#if !singleTerminalMode}
        <select bind:value={selectedLayout} on:change={changeLayout}>
          {#each layoutOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
        
        <button on:click={addTerminal}>Add Terminal</button>
        <button on:click={broadcastMessage}>Broadcast Input</button>
      {/if}
    </div>
  </div>
  
  <div class="demo-content">
    {#if singleTerminalMode}
      <div class="single-terminal">
        <StreamingTerminal
          terminalId="demo-terminal-1"
          title="Demo Terminal"
        />
      </div>
    {:else}
      <TerminalGrid
        bind:this={terminalGrid}
        layout={selectedLayout}
        initialTerminals={2}
      />
    {/if}
  </div>
  
  <div class="demo-info">
    <h3>Keyboard Shortcuts</h3>
    <ul>
      <li><kbd>Ctrl+F</kbd> - Search in terminal</li>
      <li><kbd>Ctrl+L</kbd> - Clear terminal</li>
      {#if !singleTerminalMode}
        <li><kbd>Ctrl+Shift+T</kbd> - New terminal</li>
        <li><kbd>Ctrl+Shift+W</kbd> - Close terminal</li>
        <li><kbd>Ctrl+Tab</kbd> - Next terminal</li>
        <li><kbd>Ctrl+Shift+Tab</kbd> - Previous terminal</li>
        <li><kbd>Ctrl+1-9</kbd> - Switch to terminal by number</li>
      {/if}
    </ul>
    
    <h3>Features</h3>
    <ul>
      <li>Real-time terminal output streaming via IPC</li>
      <li>WebGL renderer for optimal performance</li>
      <li>Full PTY support with resize handling</li>
      <li>Multi-terminal management with layouts</li>
      <li>Broadcast input to multiple terminals</li>
    </ul>
  </div>
</main>

<style>
  main {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: #11111b;
    color: #cdd6f4;
    font-family: system-ui, -apple-system, sans-serif;
  }
  
  .demo-header {
    padding: 1rem 2rem;
    background: #181825;
    border-bottom: 1px solid #313244;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  .demo-header h1 {
    margin: 0;
    font-size: 1.5rem;
    color: #89b4fa;
  }
  
  .controls {
    display: flex;
    gap: 1rem;
    align-items: center;
  }
  
  .controls button,
  .controls select {
    padding: 0.5rem 1rem;
    background: #313244;
    color: #cdd6f4;
    border: 1px solid #45475a;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
  }
  
  .controls button:hover,
  .controls select:hover {
    background: #45475a;
  }
  
  .demo-content {
    flex: 1;
    overflow: hidden;
    padding: 1rem;
  }
  
  .single-terminal {
    height: 100%;
    border: 1px solid #313244;
    border-radius: 4px;
    overflow: hidden;
  }
  
  .demo-info {
    padding: 1rem 2rem;
    background: #181825;
    border-top: 1px solid #313244;
    display: flex;
    gap: 3rem;
  }
  
  .demo-info h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    color: #89b4fa;
  }
  
  .demo-info ul {
    margin: 0;
    padding-left: 1.5rem;
    font-size: 0.875rem;
  }
  
  .demo-info li {
    margin-bottom: 0.25rem;
  }
  
  kbd {
    display: inline-block;
    padding: 0.2rem 0.4rem;
    font-size: 0.75rem;
    font-family: monospace;
    background: #313244;
    border: 1px solid #45475a;
    border-radius: 3px;
  }
</style>