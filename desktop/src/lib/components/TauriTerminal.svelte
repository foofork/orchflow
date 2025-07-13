<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { tmux } from '$lib/tauri/tmux';
  import { withTimeout, exponentialBackoff, TIMEOUT_CONFIG } from '$lib/utils/timeout';
  
  export let sessionName: string = 'orchflow-main';
  export let paneId: string | null = null;
  export let command: string | undefined = undefined;
  export let title: string = 'Terminal';
  
  // Use centralized timeout utilities
  
  let container: HTMLDivElement;
  let terminal: any;
  let fitAddon: any;
  let resizeObserver: ResizeObserver;
  let pollInterval: number;
  let lastContent: string = '';
  let connectionRetries = 0;
  const MAX_RETRIES = 5;
  
  onMount(async () => {
    if (!browser) return;
    
    // Dynamic imports for client-side only
    const { Terminal: XTerm } = await import('@xterm/xterm');
    const { FitAddon } = await import('@xterm/addon-fit');
    const { WebLinksAddon } = await import('@xterm/addon-web-links');
    await import('@xterm/xterm/css/xterm.css');
    
    // Create terminal
    terminal = new XTerm({
      theme: {
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        cursor: '#f5e0dc',
        black: '#45475a',
        red: '#f38ba8',
        green: '#a6e3a1',
        yellow: '#f9e2af',
        blue: '#89b4fa',
        magenta: '#f5c2e7',
        cyan: '#94e2d5',
        white: '#bac2de',
        brightBlack: '#585b70',
        brightRed: '#f38ba8',
        brightGreen: '#a6e3a1',
        brightYellow: '#f9e2af',
        brightBlue: '#89b4fa',
        brightMagenta: '#f5c2e7',
        brightCyan: '#94e2d5',
        brightWhite: '#a6adc8',
      },
      fontSize: 14,
      fontFamily: 'Cascadia Code, Menlo, Monaco, monospace',
      cursorBlink: true,
      cursorStyle: 'bar',
    });
    
    // Add addons
    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());
    
    // Attach to DOM
    terminal.open(container);
    fitAddon.fit();
    
    // Create or attach to pane with timeout
    if (!paneId) {
      try {
        const pane = await withTimeout(
          tmux.createPane(sessionName, command),
          TIMEOUT_CONFIG.TAURI_API,
          'Create pane timed out'
        );
        paneId = pane.id;
        connectionRetries = 0; // Reset on success
      } catch (err) {
        console.error('Failed to create pane:', err);
        if (connectionRetries < MAX_RETRIES) {
          connectionRetries++;
          const backoffMs = exponentialBackoff(connectionRetries - 1, 1000, 10000);
          setTimeout(() => {
            // Retry with exponential backoff
            window.location.reload();
          }, backoffMs);
        }
        throw err;
      }
    }
    
    // Handle input with timeout
    terminal.onData(async (data: string) => {
      if (paneId) {
        try {
          await withTimeout(
            tmux.sendKeys(paneId, data),
            TIMEOUT_CONFIG.TAURI_API,
            'Send keys timed out'
          );
        } catch (err) {
          console.error('Failed to send input:', err);
        }
      }
    });
    
    // Poll for output with reduced frequency and timeout
    pollInterval = setInterval(async () => {
      if (paneId) {
        try {
          const content = await withTimeout(
            tmux.capturePane(paneId),
            TIMEOUT_CONFIG.TAURI_API,
            'Capture pane timed out'
          );
          if (content !== lastContent) {
            terminal.clear();
            terminal.write(content);
            lastContent = content;
          }
        } catch (err) {
          console.error('Failed to capture pane:', err);
          // Exponential backoff on repeated failures
          if (err.message?.includes('timed out')) {
            clearInterval(pollInterval);
            const backoffMs = exponentialBackoff(connectionRetries - 1, TIMEOUT_CONFIG.TERMINAL_POLL, 5000);
            setTimeout(() => {
              pollInterval = setInterval(() => {
                if (paneId) {
                  tmux.capturePane(paneId).then(content => {
                    if (content !== lastContent) {
                      terminal.clear();
                      terminal.write(content);
                      lastContent = content;
                    }
                  }).catch(err => console.error('Failed to capture pane:', err));
                }
              }, TIMEOUT_CONFIG.TERMINAL_POLL) as unknown as number;
            }, backoffMs);
            connectionRetries++;
          }
        }
      }
    }, TIMEOUT_CONFIG.TERMINAL_POLL) as unknown as number;
    
    // Handle resize
    resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      if (paneId) {
        const { cols, rows } = fitAddon.proposeDimensions() || { cols: 80, rows: 24 };
        withTimeout(
          tmux.resizePane(paneId, cols, rows),
          TIMEOUT_CONFIG.TAURI_API,
          'Resize pane timed out'
        ).catch(console.error);
      }
    });
    resizeObserver.observe(container);
    
    // Initial message
    terminal.writeln(`\x1b[1;34m${title}\x1b[0m`);
    if (command) {
      terminal.writeln(`Running: ${command}`);
    }
    terminal.writeln('');
  });
  
  onDestroy(() => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    if (terminal) {
      terminal.dispose();
    }
  });
  
  function handleKeyDown(event: KeyboardEvent) {
    // Handle special keys
    if (event.ctrlKey && event.key === 'c') {
      event.preventDefault();
      if (paneId) {
        withTimeout(
          tmux.sendKeys(paneId, '\x03'),
          TIMEOUT_CONFIG.TAURI_API,
          'Send Ctrl+C timed out'
        ).catch(console.error);
      }
    }
  }
</script>

<div 
  class="terminal-container"
  bind:this={container}
  on:keydown={handleKeyDown}
  role="application"
  aria-label="Terminal"
  tabindex="0"
>
  {#if !browser}
    <div class="terminal-placeholder">Terminal (client-side only)</div>
  {/if}
</div>

<style>
  .terminal-container {
    width: 100%;
    height: 100%;
    background: #1e1e2e;
    position: relative;
  }
  
  .terminal-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #6c7086;
    font-family: monospace;
  }
  
  :global(.xterm) {
    height: 100%;
    padding: 8px;
  }
  
  :global(.xterm-viewport) {
    overflow-y: auto;
  }
</style>