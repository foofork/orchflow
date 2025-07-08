<script lang="ts">
  import StatusBarEnhanced from '$lib/components/StatusBarEnhanced.svelte';
  import { onMount } from 'svelte';
  import { emit } from '@tauri-apps/api/event';
  
  // Custom status items
  let customItems = [
    {
      id: 'custom1',
      text: '🔌 Connected',
      tooltip: 'Server connection status',
      onClick: () => console.log('Connection clicked'),
      align: 'right' as const
    },
    {
      id: 'custom2',
      text: '🔒 Secure',
      tooltip: 'Security status',
      align: 'left' as const
    }
  ];
  
  // Demo controls
  let showGitStatus = true;
  let showSystemMetrics = true;
  let showNotifications = true;
  
  // Simulated events
  function simulateFileChange() {
    emit('active-file-changed', '/src/components/StatusBar.svelte');
  }
  
  function simulateCursorChange() {
    const line = Math.floor(Math.random() * 100) + 1;
    const column = Math.floor(Math.random() * 80) + 1;
    emit('cursor-position-changed', { line, column });
  }
  
  function simulateFileTypeChange() {
    const types = ['TypeScript', 'JavaScript', 'Rust', 'Python', 'Svelte'];
    const type = types[Math.floor(Math.random() * types.length)];
    emit('file-type-changed', type);
  }
  
  function simulateProblems() {
    const errors = Math.floor(Math.random() * 5);
    const warnings = Math.floor(Math.random() * 10);
    emit('problems-updated', { errors, warnings });
  }
  
  function simulateNotification() {
    const messages = [
      'Build completed successfully',
      'New version available',
      'Terminal process exited',
      'File saved',
      'Tests passed'
    ];
    const message = messages[Math.floor(Math.random() * messages.length)];
    emit('notification', message);
  }
  
  function simulateProcessStart() {
    emit('process-started');
    setTimeout(() => emit('process-stopped'), 5000);
  }
  
  function handleStatusAction(event: CustomEvent) {
    console.log('Status bar action:', event.detail);
    // Handle the action appropriately
    switch (event.detail.type) {
      case 'showGit':
        alert('Show Git panel');
        break;
      case 'revealInExplorer':
        alert(`Reveal ${event.detail.path} in explorer`);
        break;
      case 'goToLine':
        alert('Open Go to Line dialog');
        break;
      case 'showProblems':
        alert('Show Problems panel');
        break;
      case 'showOutput':
        alert('Show Output panel');
        break;
      case 'showNotifications':
        alert('Show Notifications');
        break;
      case 'selectLanguageMode':
        alert('Select Language Mode');
        break;
      case 'selectEncoding':
        alert('Select Encoding');
        break;
      case 'showSystemMonitor':
        alert('Show System Monitor');
        break;
    }
  }
  
  onMount(() => {
    // Simulate some initial events
    simulateFileChange();
    simulateCursorChange();
    simulateFileTypeChange();
  });
</script>

<main>
  <div class="demo-container">
    <div class="demo-header">
      <h1>Enhanced Status Bar Demo</h1>
      <p>Interactive demonstration of the enhanced status bar component</p>
    </div>
    
    <div class="demo-controls">
      <h2>Configuration</h2>
      <div class="control-group">
        <label>
          <input type="checkbox" bind:checked={showGitStatus} />
          Show Git Status
        </label>
        <label>
          <input type="checkbox" bind:checked={showSystemMetrics} />
          Show System Metrics
        </label>
        <label>
          <input type="checkbox" bind:checked={showNotifications} />
          Show Notifications
        </label>
      </div>
      
      <h2>Simulate Events</h2>
      <div class="button-grid">
        <button on:click={simulateFileChange}>Change File</button>
        <button on:click={simulateCursorChange}>Move Cursor</button>
        <button on:click={simulateFileTypeChange}>Change File Type</button>
        <button on:click={simulateProblems}>Add Problems</button>
        <button on:click={simulateNotification}>Add Notification</button>
        <button on:click={simulateProcessStart}>Start Process</button>
      </div>
    </div>
    
    <div class="demo-preview">
      <h2>Preview</h2>
      <div class="preview-frame">
        <div class="editor-mock">
          <div class="editor-header">
            <div class="tabs">
              <div class="tab active">StatusBar.svelte</div>
              <div class="tab">app.ts</div>
              <div class="tab">README.md</div>
            </div>
          </div>
          <div class="editor-content">
            <pre><code>&lt;script lang="ts"&gt;
  // Status bar implementation
  import {'{ onMount }'} from 'svelte';
  
  export let showGitStatus = true;
  export let showSystemMetrics = true;
  
  // Component logic...
&lt;/script&gt;</code></pre>
          </div>
        </div>
        
        <!-- The actual StatusBar component -->
        <StatusBarEnhanced
          {showGitStatus}
          {showSystemMetrics}
          {showNotifications}
          {customItems}
          on:action={handleStatusAction}
        />
      </div>
    </div>
    
    <div class="feature-list">
      <h2>Features</h2>
      <div class="features">
        <div class="feature">
          <h3>🌿 Git Integration</h3>
          <p>Shows current branch, sync status, and file changes</p>
        </div>
        <div class="feature">
          <h3>📊 System Metrics</h3>
          <p>Real-time CPU and memory usage monitoring</p>
        </div>
        <div class="feature">
          <h3>📍 Cursor Position</h3>
          <p>Current line and column with go-to-line action</p>
        </div>
        <div class="feature">
          <h3>❌ Problem Indicators</h3>
          <p>Error and warning counts with quick access</p>
        </div>
        <div class="feature">
          <h3>🔔 Notifications</h3>
          <p>System notifications with count indicator</p>
        </div>
        <div class="feature">
          <h3>⚡ Process Status</h3>
          <p>Shows when processes are running</p>
        </div>
        <div class="feature">
          <h3>🎨 Custom Items</h3>
          <p>Add your own status items with actions</p>
        </div>
        <div class="feature">
          <h3>🕐 Clock</h3>
          <p>Current time with date tooltip</p>
        </div>
      </div>
    </div>
  </div>
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
    margin-bottom: 2rem;
  }
  
  .control-group label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }
  
  .button-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
  }
  
  .button-grid button {
    padding: 0.75rem 1rem;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--fg-primary);
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .button-grid button:hover {
    background: var(--bg-hover);
    border-color: var(--accent);
  }
  
  .demo-preview {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 2rem;
    margin-bottom: 2rem;
  }
  
  .demo-preview h2 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
    color: var(--accent);
  }
  
  .preview-frame {
    border: 1px solid var(--border);
    border-radius: 4px;
    overflow: hidden;
    background: var(--bg-primary);
  }
  
  .editor-mock {
    height: 300px;
    display: flex;
    flex-direction: column;
  }
  
  .editor-header {
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    padding: 0 1rem;
  }
  
  .tabs {
    display: flex;
    gap: 0;
  }
  
  .tab {
    padding: 0.5rem 1rem;
    background: var(--bg-tertiary);
    border-right: 1px solid var(--border);
    color: var(--fg-secondary);
    font-size: 0.875rem;
  }
  
  .tab.active {
    background: var(--bg-primary);
    color: var(--fg-primary);
  }
  
  .editor-content {
    flex: 1;
    padding: 1rem;
    overflow: auto;
    font-family: var(--font-mono);
    font-size: 0.875rem;
  }
  
  .editor-content pre {
    margin: 0;
  }
  
  .editor-content code {
    color: var(--fg-primary);
  }
  
  .feature-list {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 2rem;
  }
  
  .feature-list h2 {
    font-size: 1.5rem;
    margin-bottom: 1.5rem;
    color: var(--accent);
  }
  
  .features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
  }
  
  .feature {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 1.5rem;
  }
  
  .feature h3 {
    font-size: 1.1rem;
    margin-bottom: 0.5rem;
    color: var(--fg-primary);
  }
  
  .feature p {
    font-size: 0.875rem;
    color: var(--fg-secondary);
  }
</style>