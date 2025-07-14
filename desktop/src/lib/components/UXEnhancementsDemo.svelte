<script lang="ts">
  import { onMount } from 'svelte';
  import ToastContainer from './ToastContainer.svelte';
  import CodeMirrorEditor from './CodeMirrorEditor.svelte';
  import Tooltip from './Tooltip.svelte';
  import TerminalSecurityIndicator from './TerminalSecurityIndicator.svelte';
  import { toastManager } from '$lib/stores/toast';
  import { securityEventManager } from '$lib/services/securityEvents';

  let editorRef: CodeMirrorEditor;
  let editorValue = `{
  "name": "orchflow-demo",
  "version": "1.0.0",
  "description": "Demo of new UX components"
}`;

  onMount(() => {
    // Simulate some security events for demonstration
    if (import.meta.env.DEV) {
      securityEventManager.simulateEvents();
    }
  });

  function showToastExamples() {
    toastManager.success('Success toast example!');
    
    setTimeout(() => {
      toastManager.warning('Warning toast with action', {
        actions: [
          {
            label: 'Fix Now',
            variant: 'primary',
            handler: () => toastManager.success('Fixed!')
          }
        ]
      });
    }, 1000);

    setTimeout(() => {
      toastManager.error('Error toast example', {
        title: 'Something went wrong',
        persistent: true,
        actions: [
          {
            label: 'Retry',
            variant: 'primary',
            handler: () => toastManager.success('Retried successfully!')
          },
          {
            label: 'Dismiss',
            variant: 'secondary',
            handler: () => {} // Auto-dismiss
          }
        ]
      });
    }, 2000);
  }

  function formatCode() {
    editorRef.format();
  }

  function handleFormatError(event: CustomEvent) {
    toastManager.error(`Format failed: ${event.detail.error}`);
  }

  function handleFormatSuccess(event: CustomEvent) {
    toastManager.success('Code formatted successfully!');
  }

  function simulateSecurityAlert() {
    toastManager.securityAlert(
      'Suspicious command detected: rm -rf /*',
      'error',
      [
        {
          label: 'Block Command',
          variant: 'primary',
          handler: () => toastManager.success('Command blocked!')
        },
        {
          label: 'View Details',
          variant: 'secondary',
          handler: () => toastManager.info('Security details would be shown here')
        }
      ]
    );
  }
</script>

<div class="demo-container">
  <h1>Orchflow UX Enhancements Demo</h1>
  
  <div class="demo-grid">
    <!-- Toast Notifications Demo -->
    <section class="demo-section">
      <h2>🍞 Toast Notifications</h2>
      <p>Click to see different types of toast notifications with actions:</p>
      <div class="button-group">
        <button class="demo-button success" on:click={showToastExamples}>
          Show Toast Examples
        </button>
        <button class="demo-button error" on:click={simulateSecurityAlert}>
          Simulate Security Alert
        </button>
      </div>
    </section>

    <!-- Tooltip Demo -->
    <section class="demo-section">
      <h2>💬 Enhanced Tooltips</h2>
      <p>Hover over these elements to see tooltips:</p>
      <div class="tooltip-examples">
        <Tooltip content="This is a default tooltip" placement="top">
          <button class="demo-button">Default Tooltip</button>
        </Tooltip>
        
        <Tooltip 
          content="Security tooltips use different styling for better visibility" 
          variant="security" 
          placement="bottom"
        >
          <button class="demo-button security">Security Tooltip</button>
        </Tooltip>
        
        <Tooltip 
          content="Warning tooltips grab attention for important information" 
          variant="warning" 
          placement="right"
        >
          <button class="demo-button warning">Warning Tooltip</button>
        </Tooltip>
        
        <Tooltip 
          content="Error tooltips are used for critical issues that need immediate attention" 
          variant="error" 
          placement="left"
        >
          <button class="demo-button error">Error Tooltip</button>
        </Tooltip>
      </div>
    </section>

    <!-- CodeMirror Formatting Demo -->
    <section class="demo-section">
      <h2>⚡ Code Formatting</h2>
      <p>Try formatting the code below using the button or Shift+Alt+F:</p>
      <CodeMirrorEditor
        bind:this={editorRef}
        bind:value={editorValue}
        language="json"
        height="200px"
        showFormatButton={true}
        on:formatError={handleFormatError}
        on:format={handleFormatSuccess}
      />
      <div class="button-group">
        <button class="demo-button" on:click={formatCode}>
          Format Code
        </button>
      </div>
    </section>

    <!-- Security Indicator Demo -->
    <section class="demo-section">
      <h2>🛡️ Security Indicators</h2>
      <p>Enhanced security indicators with tooltips:</p>
      <div class="security-examples">
        <div class="security-example">
          <span>Compact mode:</span>
          <TerminalSecurityIndicator terminalId="demo-terminal-1" compact={true} />
        </div>
        <div class="security-example">
          <span>Full mode:</span>
          <TerminalSecurityIndicator terminalId="demo-terminal-2" compact={false} />
        </div>
      </div>
    </section>

    <!-- WebSocket Connection Status -->
    <section class="demo-section">
      <h2>🔗 Real-time Security Events</h2>
      <p>WebSocket/SSE connection for real-time security monitoring:</p>
      <div class="connection-status">
        <Tooltip content="Security events are received in real-time via WebSocket connection">
          <div class="status-indicator connected">
            <div class="status-dot"></div>
            <span>Security Events Connected</span>
          </div>
        </Tooltip>
      </div>
      <p class="note">
        In development mode, simulated security events are generated automatically.
        In production, this would connect to your security monitoring service.
      </p>
    </section>
  </div>
</div>

<!-- Toast Container - This should be included once at the app level -->
<ToastContainer />

<style>
  .demo-container {
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
    font-family: var(--font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
    line-height: 1.6;
  }

  .demo-container h1 {
    color: var(--fg-primary, #1a1a1a);
    margin-bottom: 2rem;
    text-align: center;
    font-size: 2.5rem;
    font-weight: 700;
  }

  .demo-grid {
    display: grid;
    gap: 2rem;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  }

  .demo-section {
    background: var(--bg-primary, #ffffff);
    border: 1px solid var(--border, #e1e5e9);
    border-radius: var(--radius-md, 8px);
    padding: 1.5rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .demo-section h2 {
    color: var(--fg-primary, #1a1a1a);
    margin: 0 0 0.5rem 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .demo-section p {
    color: var(--fg-secondary, #6b7280);
    margin-bottom: 1rem;
  }

  .button-group {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .demo-button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: var(--radius-sm, 6px);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    background: var(--accent, #3b82f6);
    color: var(--accent-fg, white);
  }

  .demo-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }

  .demo-button.success {
    background: var(--success, #10b981);
    color: white;
  }

  .demo-button.warning {
    background: var(--warning, #f59e0b);
    color: white;
  }

  .demo-button.error {
    background: var(--error, #ef4444);
    color: white;
  }

  .demo-button.security {
    background: #16a34a;
    color: white;
  }

  .tooltip-examples {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .security-examples {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .security-example {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem;
    background: var(--bg-secondary, #f8fafc);
    border-radius: var(--radius-sm, 6px);
  }

  .security-example span {
    font-weight: 500;
    min-width: 120px;
  }

  .connection-status {
    margin-bottom: 1rem;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--bg-secondary, #f8fafc);
    border-radius: var(--radius-sm, 6px);
    border: 1px solid var(--success, #10b981);
    color: var(--success, #10b981);
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .status-indicator:hover {
    background: var(--bg-tertiary, #f1f5f9);
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--success, #10b981);
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
    }
    70% {
      box-shadow: 0 0 0 10px rgba(16, 185, 129, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
    }
  }

  .note {
    font-size: 0.875rem;
    color: var(--fg-tertiary, #9ca3af);
    font-style: italic;
    margin-top: 0.5rem;
  }

  /* Dark theme support */
  @media (prefers-color-scheme: dark) {
    .demo-container {
      color: #e5e7eb;
    }

    .demo-section {
      background: #1f2937;
      border-color: #374151;
    }

    .demo-section h2 {
      color: #f9fafb;
    }

    .demo-section p {
      color: #9ca3af;
    }

    .security-example {
      background: #111827;
    }

    .status-indicator {
      background: #111827;
    }

    .status-indicator:hover {
      background: #1f2937;
    }
  }

  /* Mobile responsiveness */
  @media (max-width: 768px) {
    .demo-container {
      padding: 1rem;
    }

    .demo-grid {
      grid-template-columns: 1fr;
    }

    .demo-container h1 {
      font-size: 2rem;
    }

    .tooltip-examples {
      justify-content: center;
    }

    .button-group {
      justify-content: center;
    }
  }
</style>