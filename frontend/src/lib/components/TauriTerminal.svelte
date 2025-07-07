<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { tmux } from '$lib/tauri/tmux';
  
  export let sessionName: string = 'orchflow-main';
  export let paneId: string | null = null;
  export let command: string | undefined = undefined;
  export let title: string = 'Terminal';
  
  let container: HTMLDivElement;
  let terminal: any;
  let fitAddon: any;
  let resizeObserver: ResizeObserver;
  let pollInterval: number;
  let lastContent: string = '';
  
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
    
    // Create or attach to pane
    if (!paneId) {
      const pane = await tmux.createPane(sessionName, command);
      paneId = pane.id;
    }
    
    // Handle input
    terminal.onData(async (data: string) => {
      if (paneId) {
        await tmux.sendKeys(paneId, data);
      }
    });
    
    // Poll for output
    pollInterval = setInterval(async () => {
      if (paneId) {
        try {
          const content = await tmux.capturePane(paneId);
          if (content !== lastContent) {
            terminal.clear();
            terminal.write(content);
            lastContent = content;
          }
        } catch (err) {
          console.error('Failed to capture pane:', err);
        }
      }
    }, 100) as unknown as number;
    
    // Handle resize
    resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      if (paneId) {
        const { cols, rows } = fitAddon.proposeDimensions() || { cols: 80, rows: 24 };
        tmux.resizePane(paneId, cols, rows).catch(console.error);
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
        tmux.sendKeys(paneId, '\x03'); // Ctrl+C
      }
    }
  }
</script>

<div 
  class="terminal-container"
  bind:this={container}
  on:keydown={handleKeyDown}
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