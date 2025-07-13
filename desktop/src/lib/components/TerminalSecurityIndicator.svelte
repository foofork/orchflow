<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { terminalSecurityStore } from '$lib/stores/terminalSecurity';
  import Icon from './Icon.svelte';
  // import Tooltip from './Tooltip.svelte'; // TODO: Create Tooltip component
  
  export let terminalId: string;
  export let compact: boolean = false;
  
  const dispatch = createEventDispatcher();
  
  // Security tier configurations
  const securityTiers = {
    0: {
      name: 'Unrestricted',
      color: 'text-gray-500',
      bgColor: 'bg-gray-100',
      icon: 'shield-off',
      description: 'No security restrictions - use only for trusted local development'
    },
    1: {
      name: 'Basic',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      icon: 'shield',
      description: 'Basic protection with command history sanitization and credential masking'
    },
    2: {
      name: 'Enhanced',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      icon: 'shield-check',
      description: 'Enhanced security with command filtering and audit logging'
    },
    3: {
      name: 'Restricted',
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      icon: 'shield-lock',
      description: 'Restricted mode with strict allowlisting and read-only access'
    },
    4: {
      name: 'Isolated',
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      icon: 'shield-alert',
      description: 'Full isolation with containerization and no host access'
    }
  };
  
  $: securityContext = $terminalSecurityStore[terminalId];
  $: currentTier = securityContext?.tier ?? 0;
  $: tierConfig = securityTiers[currentTier];
  $: hasAlerts = securityContext?.alerts?.length ? securityContext.alerts.length > 0 : false;
  
  function handleClick() {
    dispatch('click', { terminalId, securityContext });
  }
  
  function handleTierChange(newTier: number) {
    dispatch('tierChange', { terminalId, newTier });
  }
</script>

<div class="terminal-security-indicator" class:compact>
  {#if compact}
    <!-- Compact mode - just icon with tooltip -->
    <!-- <Tooltip content={`Security: ${tierConfig.name} - ${tierConfig.description}`}> -->
      <button
        class="security-badge compact {tierConfig.bgColor} {tierConfig.color}"
        on:click={handleClick}
        aria-label="Security tier: {tierConfig.name}"
      >
        <Icon name={tierConfig.icon} size="small" />
        {#if hasAlerts}
          <span class="alert-dot"></span>
        {/if}
      </button>
    <!-- </Tooltip> -->
  {:else}
    <!-- Full mode - detailed display -->
    <div class="security-panel">
      <button
        class="security-badge {tierConfig.bgColor} {tierConfig.color}"
        on:click={handleClick}
      >
        <Icon name={tierConfig.icon} size="small" />
        <span class="tier-name">{tierConfig.name}</span>
        {#if hasAlerts}
          <span class="alert-count">{securityContext?.alerts?.length || 0}</span>
        {/if}
      </button>
      
      <!-- Quick tier selector -->
      <div class="tier-selector">
        {#each Object.entries(securityTiers) as [tier, config] (tier)}
          <!-- <Tooltip content={config.description}> -->
            <button
              class="tier-option"
              class:active={currentTier === parseInt(tier)}
              on:click={() => handleTierChange(parseInt(tier))}
              aria-label="Switch to {config.name} security"
            >
              <Icon name={config.icon} size="tiny" class={config.color} />
            </button>
          <!-- </Tooltip> -->
        {/each}
      </div>
      
      <!-- Security features status -->
      {#if securityContext}
        <div class="features-status">
          <div class="feature" class:enabled={securityContext.workspaceTrust?.enabled}>
            <Icon name="folder-lock" size="tiny" />
            <span>Workspace Trust</span>
          </div>
          <div class="feature" class:enabled={securityContext.auditConfig?.enabled}>
            <Icon name="file-text" size="tiny" />
            <span>Audit Logging</span>
          </div>
          <div class="feature" class:enabled={securityContext.isolation?.enabled}>
            <Icon name="box" size="tiny" />
            <span>Process Isolation</span>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .terminal-security-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }
  
  .terminal-security-indicator.compact {
    gap: 0;
  }
  
  .security-badge {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 500;
  }
  
  .security-badge.compact {
    padding: 0.25rem;
    border-radius: 0.25rem;
    position: relative;
  }
  
  .security-badge:hover {
    opacity: 0.8;
    transform: translateY(-1px);
  }
  
  .alert-dot {
    position: absolute;
    top: -2px;
    right: -2px;
    width: 8px;
    height: 8px;
    background-color: #ef4444;
    border-radius: 50%;
    border: 2px solid white;
    animation: pulse 2s infinite;
  }
  
  .alert-count {
    background-color: #ef4444;
    color: white;
    border-radius: 0.75rem;
    padding: 0 0.375rem;
    font-size: 0.75rem;
    min-width: 1.25rem;
    text-align: center;
  }
  
  .security-panel {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem;
    background-color: var(--color-surface);
    border-radius: 0.5rem;
    border: 1px solid var(--color-border);
  }
  
  .tier-selector {
    display: flex;
    gap: 0.25rem;
    padding: 0.25rem;
    background-color: var(--color-background);
    border-radius: 0.375rem;
  }
  
  .tier-option {
    padding: 0.25rem;
    border: none;
    background: none;
    cursor: pointer;
    opacity: 0.5;
    transition: all 0.2s;
    border-radius: 0.25rem;
  }
  
  .tier-option:hover {
    opacity: 0.8;
    background-color: var(--color-surface);
  }
  
  .tier-option.active {
    opacity: 1;
    background-color: var(--color-primary-light);
  }
  
  .features-status {
    display: flex;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
  }
  
  .feature {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    opacity: 0.5;
  }
  
  .feature.enabled {
    opacity: 1;
    color: var(--color-success);
  }
  
  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
    }
    70% {
      box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
    }
  }
  
  /* Dark mode adjustments */
  :global(.dark) .security-panel {
    background-color: var(--color-surface-dark);
    border-color: var(--color-border-dark);
  }
  
  :global(.dark) .tier-selector {
    background-color: var(--color-background-dark);
  }
  
  :global(.dark) .tier-option:hover {
    background-color: var(--color-surface-dark);
  }
  
  /* Responsive */
  @media (max-width: 768px) {
    .security-panel {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }
    
    .features-status {
      flex-wrap: wrap;
    }
  }
</style>