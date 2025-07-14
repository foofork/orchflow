<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  
  export let selectedFlow: any = null;
  
  const dispatch = createEventDispatcher();
  
  let flowName = '';
  let description = '';
  let isLoading = false;
  let message = '';
  let flows: any[] = [];
  let terminalOutput = '';
  let isRunning = false;
  
  async function saveFlow() {
    if (!flowName.trim()) return;
    
    isLoading = true;
    message = '';
    
    try {
      const result = await invoke('create_flow', {
        name: flowName,
        description: description
      });
      
      message = 'Flow saved successfully';
      dispatch('flowSaved', result);
      
      // Update flows list
      flows = [...flows, result];
      
    } catch (error) {
      message = `Error: Failed to save flow`;
      console.error('Save flow error:', error);
    } finally {
      isLoading = false;
    }
  }
  
  async function loadFlows() {
    try {
      flows = await invoke('get_flows');
    } catch (error) {
      console.error('Load flows error:', error);
    }
  }
  
  async function runFlow() {
    if (!selectedFlow) return;
    
    isRunning = true;
    terminalOutput = '';
    
    try {
      const result = await invoke('run_flow', {
        flowId: selectedFlow.id,
        steps: selectedFlow.steps
      });
      
      // Poll for output
      const pollOutput = async () => {
        try {
          const output = await invoke('get_terminal_output');
          terminalOutput = output as string;
        } catch (error) {
          console.error('Get output error:', error);
        }
      };
      
      // Simulate polling
      setTimeout(pollOutput, 100);
      
    } catch (error) {
      console.error('Run flow error:', error);
    } finally {
      isRunning = false;
    }
  }
  
  // Load flows on mount
  loadFlows();
</script>

<div class="flow-manager">
  <div class="form-section">
    <label for="flow-name">Flow Name</label>
    <input 
      id="flow-name"
      type="text" 
      bind:value={flowName}
      aria-label="Flow Name"
      disabled={isLoading}
    />
    
    <label for="description">Description</label>
    <textarea 
      id="description"
      bind:value={description}
      aria-label="Description"
      disabled={isLoading}
    ></textarea>
    
    <button 
      on:click={saveFlow}
      disabled={isLoading || !flowName.trim()}
    >
      {isLoading ? 'Saving...' : 'Save Flow'}
    </button>
    
    {#if message}
      <div class="message" class:error={message.includes('Error')}>
        {message}
      </div>
    {/if}
  </div>
  
  <div class="flows-section">
    <h3>Existing Flows</h3>
    {#each flows as flow (flow.id)}
      <div class="flow-item">
        <span>{flow.name}</span>
        <p>{flow.description}</p>
      </div>
    {/each}
  </div>
  
  {#if selectedFlow}
    <div class="execution-section">
      <h3>Execute Flow: {selectedFlow.name}</h3>
      <button 
        on:click={runFlow}
        disabled={isRunning}
      >
        {isRunning ? 'Running...' : 'Run Flow'}
      </button>
      
      {#if terminalOutput}
        <div class="terminal-output">
          <pre>{terminalOutput}</pre>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .flow-manager {
    padding: 1rem;
  }
  
  .form-section {
    margin-bottom: 2rem;
  }
  
  .form-section label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: bold;
  }
  
  .form-section input,
  .form-section textarea {
    width: 100%;
    padding: 0.5rem;
    margin-bottom: 1rem;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
  
  .form-section button {
    padding: 0.75rem 1.5rem;
    background: #007acc;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .form-section button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .message {
    margin-top: 1rem;
    padding: 0.75rem;
    border-radius: 4px;
    background: #d4edda;
    color: #155724;
  }
  
  .message.error {
    background: #f8d7da;
    color: #721c24;
  }
  
  .flows-section {
    margin-bottom: 2rem;
  }
  
  .flow-item {
    padding: 1rem;
    border: 1px solid #eee;
    border-radius: 4px;
    margin-bottom: 0.5rem;
  }
  
  .flow-item span {
    font-weight: bold;
  }
  
  .flow-item p {
    margin: 0.5rem 0 0 0;
    color: #666;
  }
  
  .execution-section {
    border-top: 1px solid #eee;
    padding-top: 2rem;
  }
  
  .terminal-output {
    margin-top: 1rem;
    padding: 1rem;
    background: #000;
    color: #00ff00;
    border-radius: 4px;
    font-family: monospace;
  }
  
  .terminal-output pre {
    margin: 0;
    white-space: pre-wrap;
  }
</style>