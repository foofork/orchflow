<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, scale, slide } from 'svelte/transition';
  import Icon from './Icon.svelte';
  import Modal from './Modal.svelte';
  
  export let open: boolean = false;
  export let command: string;
  export let warning: SecurityWarning;
  export let terminalInfo: { id: string; name: string };
  
  interface SecurityWarning {
    message: string;
    riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
    riskFactors: string[];
    matchedPattern?: string;
  }
  
  const dispatch = createEventDispatcher();
  
  let rememberChoice = false;
  let showDetails = false;
  
  const riskLevelConfig = {
    Low: {
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      icon: 'info',
      borderColor: 'border-blue-300'
    },
    Medium: {
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      icon: 'alert-triangle',
      borderColor: 'border-yellow-300'
    },
    High: {
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      icon: 'alert-octagon',
      borderColor: 'border-orange-300'
    },
    Critical: {
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      icon: 'alert-circle',
      borderColor: 'border-red-300'
    }
  };
  
  $: config = riskLevelConfig[warning?.riskLevel || 'Medium'];
  
  function handleConfirm() {
    dispatch('confirm', {
      command,
      terminalId: terminalInfo.id,
      rememberChoice
    });
    open = false;
  }
  
  function handleCancel() {
    dispatch('cancel', {
      command,
      terminalId: terminalInfo.id
    });
    open = false;
  }
  
  function handleBypassSecurity() {
    dispatch('bypass', {
      command,
      terminalId: terminalInfo.id
    });
    open = false;
  }
</script>

<Modal bind:show={open} title="Security Confirmation Required" width="600px">
  <div class="confirmation-dialog">
    <!-- Risk Level Banner -->
    <div class="risk-banner {config.bgColor} {config.borderColor}">
      <Icon name={config.icon} class={config.color} size="large" />
      <div class="risk-info">
        <h3 class={config.color}>
          {warning.riskLevel} Risk Command Detected
        </h3>
        <p class="risk-message">{warning.message}</p>
      </div>
    </div>
    
    <!-- Terminal Info -->
    <div class="terminal-info">
      <Icon name="terminal" size="small" />
      <span>Terminal: {terminalInfo.name}</span>
    </div>
    
    <!-- Command Display -->
    <div class="command-section">
      <h4>Command to Execute:</h4>
      <div class="command-display">
        <code>{command}</code>
        <button
          class="copy-button"
          on:click={() => navigator.clipboard.writeText(command)}
          aria-label="Copy command"
        >
          <Icon name="copy" size="small" />
        </button>
      </div>
    </div>
    
    <!-- Risk Factors -->
    {#if warning.riskFactors?.length > 0}
      <div class="risk-factors">
        <button
          class="toggle-details"
          on:click={() => showDetails = !showDetails}
        >
          <Icon name={showDetails ? 'chevron-down' : 'chevron-right'} size="small" />
          <span>Risk Analysis ({warning.riskFactors.length} factors)</span>
        </button>
        
        {#if showDetails}
          <ul class="factors-list" transition:slide>
            {#each warning.riskFactors as factor (factor)}
              <li>
                <Icon name="alert-circle" size="tiny" class="text-warning" />
                {factor}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}
    
    <!-- Matched Pattern -->
    {#if warning.matchedPattern}
      <div class="matched-pattern">
        <Icon name="filter" size="small" />
        <span>Matched security pattern: <code>{warning.matchedPattern}</code></span>
      </div>
    {/if}
    
    <!-- Options -->
    <div class="options">
      <label class="remember-choice">
        <input
          type="checkbox"
          bind:checked={rememberChoice}
        />
        <span>Remember my choice for similar commands in this session</span>
      </label>
    </div>
    
    <!-- Actions -->
    <div class="actions">
      <button
        class="btn-secondary"
        on:click={handleCancel}
      >
        <Icon name="x" size="small" />
        Cancel
      </button>
      
      <div class="right-actions">
        {#if warning.riskLevel === 'Low' || warning.riskLevel === 'Medium'}
          <button
            class="btn-ghost"
            on:click={handleBypassSecurity}
            title="Execute without security checks (use with caution)"
          >
            <Icon name="shield-off" size="small" />
            Bypass Security
          </button>
        {/if}
        
        <button
          class="btn-primary btn-danger"
          on:click={handleConfirm}
        >
          <Icon name="play" size="small" />
          Execute Anyway
        </button>
      </div>
    </div>
  </div>
</Modal>

<style>
  .confirmation-dialog {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  
  .risk-banner {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem;
    border-radius: 0.5rem;
    border: 1px solid;
  }
  
  .risk-info {
    flex: 1;
  }
  
  .risk-info h3 {
    margin: 0 0 0.25rem 0;
    font-size: 1.125rem;
    font-weight: 600;
  }
  
  .risk-message {
    margin: 0;
    color: var(--color-text-secondary);
  }
  
  .terminal-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background-color: var(--color-surface);
    border-radius: 0.375rem;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }
  
  .command-section h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-secondary);
  }
  
  .command-display {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background-color: var(--color-code-bg);
    border: 1px solid var(--color-border);
    border-radius: 0.375rem;
    font-family: var(--font-mono);
  }
  
  .command-display code {
    flex: 1;
    overflow-x: auto;
    white-space: pre;
  }
  
  .copy-button {
    flex-shrink: 0;
    padding: 0.25rem;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-secondary);
    transition: color 0.2s;
  }
  
  .copy-button:hover {
    color: var(--color-primary);
  }
  
  .risk-factors {
    border: 1px solid var(--color-border);
    border-radius: 0.375rem;
    overflow: hidden;
  }
  
  .toggle-details {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.75rem;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    text-align: left;
    transition: background-color 0.2s;
  }
  
  .toggle-details:hover {
    background-color: var(--color-surface);
  }
  
  .factors-list {
    margin: 0;
    padding: 0.75rem;
    list-style: none;
    background-color: var(--color-surface);
    border-top: 1px solid var(--color-border);
  }
  
  .factors-list li {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.25rem 0;
    font-size: 0.875rem;
  }
  
  .matched-pattern {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background-color: var(--color-surface);
    border-radius: 0.375rem;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }
  
  .matched-pattern code {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    color: var(--color-primary);
  }
  
  .options {
    padding: 0.5rem 0;
  }
  
  .remember-choice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.875rem;
  }
  
  .remember-choice input[type="checkbox"] {
    cursor: pointer;
  }
  
  .actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
  }
  
  .right-actions {
    display: flex;
    gap: 0.75rem;
  }
  
  .btn-primary,
  .btn-secondary,
  .btn-ghost {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-primary {
    background-color: var(--color-primary);
    color: white;
  }
  
  .btn-primary:hover {
    background-color: var(--color-primary-dark);
  }
  
  .btn-primary.btn-danger {
    background-color: #ef4444;
  }
  
  .btn-primary.btn-danger:hover {
    background-color: #dc2626;
  }
  
  .btn-secondary {
    background-color: var(--color-surface);
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }
  
  .btn-secondary:hover {
    background-color: var(--color-surface-hover);
  }
  
  .btn-ghost {
    background: none;
    color: var(--color-text-secondary);
  }
  
  .btn-ghost:hover {
    background-color: var(--color-surface);
    color: var(--color-text);
  }
  
  /* Dark mode */
  :global(.dark) .command-display {
    background-color: var(--color-code-bg-dark);
  }
  
  :global(.dark) .risk-banner {
    background-color: rgba(0, 0, 0, 0.2);
  }
  
  /* Animations */
  @keyframes slide {
    from {
      max-height: 0;
      opacity: 0;
    }
    to {
      max-height: 500px;
      opacity: 1;
    }
  }
</style>