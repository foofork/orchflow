<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { manager, terminalOutputs } from '$lib/stores/manager';
  
  export let paneId: string;
  export let title: string = 'Terminal';
  
  let container: HTMLDivElement;
  let terminal: any;
  let fitAddon: any;
  let searchAddon: any;
  let resizeObserver: ResizeObserver;
  
  onMount(async () => {
    if (!browser) return;
    
    // Dynamic imports for client-side only
    const { Terminal: XTerm } = await import('@xterm/xterm');
    const { FitAddon } = await import('@xterm/addon-fit');
    const { WebLinksAddon } = await import('@xterm/addon-web-links');
    const { SearchAddon } = await import('@xterm/addon-search');
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
    searchAddon = new SearchAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(searchAddon);
    terminal.loadAddon(new WebLinksAddon());
    
    // Attach to DOM
    terminal.open(container);
    fitAddon.fit();
    
    // Handle input - now using the new manager API
    terminal.onData((data: string) => {
      manager.sendInput(paneId, data);
    });
    
    // Subscribe to output - structure is the same but source is different
    const unsubscribe = terminalOutputs.subscribe(outputs => {
      const output = outputs.get(paneId);
      if (output && output.length > 0) {
        // Write only new output
        const lastLine = output[output.length - 1];
        terminal.write(lastLine);
      }
    });
    
    // Handle resize
    resizeObserver = new ResizeObserver(() => {
      if (fitAddon) {
        fitAddon.fit();
        // Notify backend about terminal size
        const dimensions = fitAddon.proposeDimensions();
        if (dimensions) {
          manager.execute({
            type: 'ResizePane',
            pane_id: paneId,
            width: dimensions.cols,
            height: dimensions.rows
          });
        }
      }
    });
    resizeObserver.observe(container);
    
    // Load existing output if any
    try {
      const existingOutput = await manager.getPaneOutput(paneId, 1000);
      if (existingOutput) {
        terminal.write(existingOutput);
      }
    } catch (error) {
      console.error('Failed to load existing output:', error);
    }
    
    // Initial welcome message
    terminal.writeln(`\x1b[1;34m${title}\x1b[0m`);
    terminal.writeln('');
    
    return () => {
      unsubscribe();
    };
  });
  
  onDestroy(() => {
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    if (terminal) {
      terminal.dispose();
    }
  });
  
  function handleKeyDown(event: KeyboardEvent) {
    // Ctrl+F for search
    if (event.ctrlKey && event.key === 'f') {
      event.preventDefault();
      searchAddon?.findNext(prompt('Search for:') || '');
    }
    // Ctrl+C to send interrupt
    else if (event.ctrlKey && event.key === 'c') {
      event.preventDefault();
      manager.sendInput(paneId, '\x03');
    }
    // Ctrl+D to send EOF
    else if (event.ctrlKey && event.key === 'd') {
      event.preventDefault();
      manager.sendInput(paneId, '\x04');
    }
  }
</script>

<div 
  class="terminal-container"
  bind:this={container}
  on:keydown={handleKeyDown}
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
  
  .terminal-container:focus {
    outline: none;
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