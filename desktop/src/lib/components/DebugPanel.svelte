<script lang="ts">
  import { onMount } from 'svelte';
  
  export const sessionId: string = ''; // External reference only
  
  interface DebugConfiguration {
    name: string;
    type: string;
    request: string;
    program?: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
  }
  
  let configurations: DebugConfiguration[] = [];
  let selectedConfig: DebugConfiguration | null = null;
  let isDebugging = false;
  let breakpoints: string[] = [];
  let callStack: string[] = [];
  let variables: Record<string, any> = {};
  
  onMount(() => {
    loadConfigurations();
  });
  
  async function loadConfigurations() {
    // Simulate loading debug configurations
    configurations = [
      {
        name: 'Debug Rust Binary',
        type: 'lldb',
        request: 'launch',
        program: '${workspaceFolder}/target/debug/orchflow',
        args: [],
        cwd: '${workspaceFolder}'
      },
      {
        name: 'Debug TypeScript',
        type: 'node',
        request: 'launch',
        program: '${workspaceFolder}/frontend/src/index.ts',
        args: ['--inspect'],
        cwd: '${workspaceFolder}/frontend'
      },
      {
        name: 'Debug Frontend',
        type: 'chrome',
        request: 'launch',
        program: 'http://localhost:5173'
      }
    ];
    
    if (configurations.length > 0) {
      selectedConfig = configurations[0];
    }
  }
  
  async function startDebugging() {
    if (!selectedConfig) return;
    
    isDebugging = true;
    
    // Simulate debug session
    console.log('Starting debug session:', selectedConfig.name);
    
    // Simulate some debug data
    breakpoints = [
      'src/main.rs:42',
      'src/lib.rs:156',
      'src/modules/auth.rs:89'
    ];
    
    callStack = [
      'main() at src/main.rs:42',
      'process_request() at src/lib.rs:156',
      'authenticate() at src/modules/auth.rs:89'
    ];
    
    variables = {
      request: { method: 'GET', path: '/api/users' },
      user_id: 12345,
      authenticated: true
    };
  }
  
  function stopDebugging() {
    isDebugging = false;
    callStack = [];
    variables = {};
  }
  
  function continueExecution() {
    console.log('Continue execution');
  }
  
  function stepOver() {
    console.log('Step over');
  }
  
  function stepInto() {
    console.log('Step into');
  }
  
  function stepOut() {
    console.log('Step out');
  }
  
  function restart() {
    console.log('Restart debugging');
  }
  
  function removeBreakpoint(bp: string) {
    breakpoints = breakpoints.filter(b => b !== bp);
  }
</script>

<div class="debug-panel">
  <div class="debug-header">
    <select
      class="config-select"
      bind:value={selectedConfig}
      disabled={isDebugging}
    >
      {#each configurations as config (config.name)}
        <option value={config}>{config.name}</option>
      {/each}
    </select>
    
    <div class="debug-controls">
      {#if !isDebugging}
        <button
          class="control-btn start"
          on:click={startDebugging}
          disabled={!selectedConfig}
          title="Start Debugging"
        >
          ▶️
        </button>
      {:else}
        <button
          class="control-btn"
          on:click={continueExecution}
          title="Continue"
        >
          ▶️
        </button>
        <button
          class="control-btn"
          on:click={stepOver}
          title="Step Over"
        >
          ⤵️
        </button>
        <button
          class="control-btn"
          on:click={stepInto}
          title="Step Into"
        >
          ⬇️
        </button>
        <button
          class="control-btn"
          on:click={stepOut}
          title="Step Out"
        >
          ⬆️
        </button>
        <button
          class="control-btn"
          on:click={restart}
          title="Restart"
        >
          🔄
        </button>
        <button
          class="control-btn stop"
          on:click={stopDebugging}
          title="Stop"
        >
          ⏹️
        </button>
      {/if}
    </div>
  </div>
  
  <div class="debug-content">
    {#if isDebugging}
      <div class="debug-section">
        <h4>Call Stack</h4>
        <div class="call-stack">
          {#each callStack as frame, i (i)}
            <div class="stack-frame" class:current={i === 0}>
              {frame}
            </div>
          {/each}
        </div>
      </div>
      
      <div class="debug-section">
        <h4>Variables</h4>
        <div class="variables">
          {#each Object.entries(variables) as [name, value] (name)}
            <div class="variable">
              <span class="var-name">{name}:</span>
              <span class="var-value">{JSON.stringify(value)}</span>
            </div>
          {/each}
        </div>
      </div>
      
      <div class="debug-section">
        <h4>Breakpoints</h4>
        <div class="breakpoints">
          {#each breakpoints as bp (`${bp.file}:${bp.line}`)}
            <div class="breakpoint">
              <span class="bp-location">{bp}</span>
              <button
                class="remove-btn"
                on:click={() => removeBreakpoint(bp)}
              >
                ✕
              </button>
            </div>
          {/each}
        </div>
      </div>
    {:else}
      <div class="no-debug">
        <p>Select a configuration and click start to begin debugging</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .debug-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  
  .debug-header {
    display: flex;
    gap: 8px;
    padding: 8px;
    border-bottom: 1px solid var(--border);
  }
  
  .config-select {
    flex: 1;
    padding: 6px 8px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--fg-primary);
    font-size: 13px;
  }
  
  .config-select:focus {
    outline: none;
    border-color: var(--accent);
  }
  
  .debug-controls {
    display: flex;
    gap: 4px;
  }
  
  .control-btn {
    width: 28px;
    height: 28px;
    padding: 0;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  
  .control-btn:hover:not(:disabled) {
    background: var(--bg-hover);
    border-color: var(--accent);
  }
  
  .control-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .control-btn.start {
    background: var(--success);
    border-color: var(--success);
  }
  
  .control-btn.stop {
    background: var(--error);
    border-color: var(--error);
  }
  
  .debug-content {
    flex: 1;
    overflow-y: auto;
  }
  
  .no-debug {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 20px;
    text-align: center;
    color: var(--fg-tertiary);
    font-size: 13px;
  }
  
  .debug-section {
    padding: 12px;
    border-bottom: 1px solid var(--border);
  }
  
  .debug-section h4 {
    margin: 0 0 8px 0;
    font-size: 12px;
    font-weight: 500;
    color: var(--fg-secondary);
    text-transform: uppercase;
  }
  
  .call-stack {
    font-family: monospace;
    font-size: 12px;
  }
  
  .stack-frame {
    padding: 4px 8px;
    margin-bottom: 2px;
    background: var(--bg-primary);
    border-radius: 3px;
    color: var(--fg-secondary);
  }
  
  .stack-frame.current {
    background: var(--accent);
    color: var(--bg-primary);
  }
  
  .variables {
    font-family: monospace;
    font-size: 12px;
  }
  
  .variable {
    display: flex;
    gap: 8px;
    padding: 4px 0;
  }
  
  .var-name {
    color: var(--accent);
  }
  
  .var-value {
    color: var(--fg-primary);
  }
  
  .breakpoints {
    font-family: monospace;
    font-size: 12px;
  }
  
  .breakpoint {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    margin-bottom: 2px;
    background: var(--bg-primary);
    border-radius: 3px;
  }
  
  .bp-location {
    color: var(--fg-primary);
  }
  
  .remove-btn {
    background: none;
    border: none;
    color: var(--fg-tertiary);
    cursor: pointer;
    padding: 2px 4px;
    font-size: 12px;
    transition: color 0.2s;
  }
  
  .remove-btn:hover {
    color: var(--error);
  }
</style>