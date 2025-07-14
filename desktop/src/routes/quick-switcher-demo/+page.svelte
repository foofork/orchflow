<script lang="ts">
  import QuickSwitcher from '$lib/components/QuickSwitcher.svelte';
  import { onMount } from 'svelte';
  
  let showSwitcher = false;
  let currentMode: 'all' | 'files' | 'terminals' | 'sessions' = 'all';
  let maxResults = 10;
  
  // Demo event log
  let eventLog: string[] = [];
  
  function logEvent(message: string) {
    eventLog = [...eventLog, `${new Date().toLocaleTimeString()}: ${message}`];
    if (eventLog.length > 10) {
      eventLog = eventLog.slice(-10);
    }
  }
  
  function handleOpenFile(event: CustomEvent) {
    logEvent(`Open file: ${event.detail.path}`);
    showSwitcher = false;
  }
  
  function handleSwitchToTerminal(event: CustomEvent) {
    logEvent(`Switch to terminal: ${event.detail.paneId}`);
    showSwitcher = false;
  }
  
  function handleSwitchToSession(event: CustomEvent) {
    logEvent(`Switch to session: ${event.detail.sessionId}`);
    showSwitcher = false;
  }
  
  function handleSwitchToPane(event: CustomEvent) {
    logEvent(`Switch to pane: ${event.detail.paneId}`);
    showSwitcher = false;
  }
  
  function handleExecuteCommand(event: CustomEvent) {
    logEvent(`Execute command: ${JSON.stringify(event.detail)}`);
    showSwitcher = false;
  }
  
  function handleClose() {
    logEvent('Quick switcher closed');
    showSwitcher = false;
  }
  
  // Keyboard shortcut
  function handleGlobalKeydown(event: KeyboardEvent) {
    // Cmd/Ctrl + K to open quick switcher
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      showSwitcher = true;
    }
    
    // Cmd/Ctrl + Shift + P for command mode
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'P') {
      event.preventDefault();
      currentMode = 'all';
      showSwitcher = true;
    }
  }
  
  onMount(() => {
    window.addEventListener('keydown', handleGlobalKeydown);
    return () => window.removeEventListener('keydown', handleGlobalKeydown);
  });
</script>

<main>
  <div class="demo-container">
    <div class="demo-header">
      <h1>Quick Switcher Demo</h1>
      <p>Fast navigation between files, terminals, and sessions</p>
    </div>
    
    <div class="demo-controls">
      <h2>Controls</h2>
      
      <div class="control-group">
        <label>
          <span>Mode:</span>
          <select bind:value={currentMode}>
            <option value="all">All Items</option>
            <option value="files">Files Only</option>
            <option value="terminals">Terminals Only</option>
            <option value="sessions">Sessions Only</option>
          </select>
        </label>
        
        <label>
          <span>Max Results:</span>
          <input type="number" bind:value={maxResults} min="5" max="50" />
        </label>
      </div>
      
      <div class="button-group">
        <button class="primary-btn" on:click={() => showSwitcher = true}>
          Open Quick Switcher
        </button>
        <span class="hint">or press <kbd>Ctrl+K</kbd></span>
      </div>
    </div>
    
    <div class="feature-grid">
      <div class="feature-card">
        <h3>🚀 Instant Navigation</h3>
        <p>Jump to any file, terminal, or session with just a few keystrokes</p>
      </div>
      
      <div class="feature-card">
        <h3>🔍 Fuzzy Search</h3>
        <p>Smart fuzzy matching finds what you're looking for, even with typos</p>
      </div>
      
      <div class="feature-card">
        <h3>📊 Smart Ranking</h3>
        <p>Recently accessed items appear first, learning from your usage patterns</p>
      </div>
      
      <div class="feature-card">
        <h3>⌨️ Keyboard Driven</h3>
        <p>Navigate entirely with keyboard - no mouse required</p>
      </div>
      
      <div class="feature-card">
        <h3>🎯 Multiple Modes</h3>
        <p>Filter by type: files, terminals, sessions, or search everything</p>
      </div>
      
      <div class="feature-card">
        <h3>💾 Persistent History</h3>
        <p>Your recent items are saved across sessions</p>
      </div>
    </div>
    
    <div class="usage-section">
      <h2>How to Use</h2>
      
      <div class="usage-grid">
        <div class="usage-item">
          <div class="step">1</div>
          <div class="description">
            <h4>Open the Switcher</h4>
            <p>Press <kbd>Ctrl+K</kbd> (or <kbd>Cmd+K</kbd> on Mac)</p>
          </div>
        </div>
        
        <div class="usage-item">
          <div class="step">2</div>
          <div class="description">
            <h4>Start Typing</h4>
            <p>Type part of the file, terminal, or session name</p>
          </div>
        </div>
        
        <div class="usage-item">
          <div class="step">3</div>
          <div class="description">
            <h4>Navigate Results</h4>
            <p>Use <kbd>↑</kbd> <kbd>↓</kbd> arrow keys to select</p>
          </div>
        </div>
        
        <div class="usage-item">
          <div class="step">4</div>
          <div class="description">
            <h4>Select Item</h4>
            <p>Press <kbd>Enter</kbd> to open the selected item</p>
          </div>
        </div>
      </div>
      
      <div class="shortcuts">
        <h3>Keyboard Shortcuts</h3>
        <table>
          <tbody>
            <tr>
              <td><kbd>Tab</kbd></td>
              <td>Cycle through modes (All → Files → Terminals → Sessions)</td>
            </tr>
            <tr>
              <td><kbd>↑</kbd> / <kbd>↓</kbd></td>
              <td>Navigate through results</td>
            </tr>
            <tr>
              <td><kbd>Enter</kbd></td>
              <td>Select the highlighted item</td>
            </tr>
            <tr>
              <td><kbd>Esc</kbd></td>
              <td>Close the quick switcher</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    
    <div class="event-log">
      <h2>Event Log</h2>
      <div class="log-container">
        {#if eventLog.length === 0}
          <div class="log-empty">Events will appear here when you use the quick switcher</div>
        {:else}
          {#each eventLog as event, index (index)}
            <div class="log-entry">{event}</div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
  
  <!-- The actual QuickSwitcher component -->
  <QuickSwitcher
    bind:show={showSwitcher}
    mode={currentMode}
    {maxResults}
    on:openFile={handleOpenFile}
    on:switchToTerminal={handleSwitchToTerminal}
    on:switchToSession={handleSwitchToSession}
    on:switchToPane={handleSwitchToPane}
    on:executeCommand={handleExecuteCommand}
    on:close={handleClose}
  />
</main>

<style>
  main {
    min-height: 100vh;
    background: var(--bg-primary);
    color: var(--fg-primary);
    padding: 2rem;
  }
  
  .demo-container {
    max-width: 1200px;
    margin: 0 auto;
  }
  
  .demo-header {
    text-align: center;
    margin-bottom: 3rem;
  }
  
  .demo-header h1 {
    font-size: 2.5rem;
    color: var(--accent);
    margin-bottom: 0.5rem;
  }
  
  .demo-header p {
    font-size: 1.2rem;
    color: var(--fg-secondary);
  }
  
  .demo-controls {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 2rem;
    margin-bottom: 2rem;
  }
  
  .demo-controls h2 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
    color: var(--accent);
  }
  
  .control-group {
    display: flex;
    gap: 2rem;
    margin-bottom: 1.5rem;
  }
  
  .control-group label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .control-group select,
  .control-group input {
    padding: 0.5rem;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--fg-primary);
  }
  
  .button-group {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .primary-btn {
    padding: 0.75rem 1.5rem;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  
  .primary-btn:hover {
    opacity: 0.9;
  }
  
  .hint {
    color: var(--fg-secondary);
    font-size: 0.875rem;
  }
  
  .feature-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
    margin-bottom: 3rem;
  }
  
  .feature-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.5rem;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  
  .feature-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  .feature-card h3 {
    font-size: 1.2rem;
    margin-bottom: 0.5rem;
    color: var(--fg-primary);
  }
  
  .feature-card p {
    font-size: 0.875rem;
    color: var(--fg-secondary);
    line-height: 1.5;
  }
  
  .usage-section {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 2rem;
    margin-bottom: 2rem;
  }
  
  .usage-section h2 {
    font-size: 1.5rem;
    margin-bottom: 1.5rem;
    color: var(--accent);
  }
  
  .usage-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }
  
  .usage-item {
    display: flex;
    gap: 1rem;
  }
  
  .step {
    width: 32px;
    height: 32px;
    background: var(--accent);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    flex-shrink: 0;
  }
  
  .description h4 {
    margin: 0 0 0.25rem 0;
    font-size: 1rem;
  }
  
  .description p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--fg-secondary);
  }
  
  .shortcuts {
    background: var(--bg-tertiary);
    border-radius: 6px;
    padding: 1.5rem;
  }
  
  .shortcuts h3 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
  }
  
  .shortcuts table {
    width: 100%;
    border-collapse: collapse;
  }
  
  .shortcuts td {
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border);
  }
  
  .shortcuts td:first-child {
    width: 120px;
  }
  
  .event-log {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 2rem;
  }
  
  .event-log h2 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
    color: var(--accent);
  }
  
  .log-container {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 1rem;
    min-height: 200px;
    max-height: 300px;
    overflow-y: auto;
    font-family: var(--font-mono);
    font-size: 0.875rem;
  }
  
  .log-empty {
    color: var(--fg-tertiary);
    text-align: center;
    padding: 2rem;
  }
  
  .log-entry {
    padding: 0.25rem 0;
    border-bottom: 1px solid var(--border);
    color: var(--fg-secondary);
  }
  
  .log-entry:last-child {
    border-bottom: none;
  }
  
  kbd {
    display: inline-block;
    padding: 0.2rem 0.4rem;
    font-size: 0.875rem;
    font-family: var(--font-mono);
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 4px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }
</style>