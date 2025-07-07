<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { invoke } from '@tauri-apps/api/tauri';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  
  export let terminalId: string;
  export let title: string = 'Terminal';
  export let initialRows: number = 24;
  export let initialCols: number = 80;
  export let shell: string | undefined = undefined;
  export let cwd: string | undefined = undefined;
  export let env: Record<string, string> | undefined = undefined;
  
  let container: HTMLDivElement;
  let terminal: any;
  let fitAddon: any;
  let webglAddon: any;
  let searchAddon: any;
  let resizeObserver: ResizeObserver;
  let eventListeners: UnlistenFn[] = [];
  let isInitialized = false;
  
  interface TerminalEvent {
    type: string;
    data: {
      terminal_id: string;
      data?: string;
      code?: number;
      error?: string;
      state?: any;
    };
  }
  
  onMount(async () => {
    if (!browser) return;
    
    // Dynamic imports for client-side only
    const { Terminal: XTerm } = await import('@xterm/xterm');
    const { FitAddon } = await import('@xterm/addon-fit');
    const { WebglAddon } = await import('@xterm/addon-webgl');
    const { WebLinksAddon } = await import('@xterm/addon-web-links');
    const { SearchAddon } = await import('@xterm/addon-search');
    await import('@xterm/xterm/css/xterm.css');
    
    // Create terminal with performance-optimized settings
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
      rows: initialRows,
      cols: initialCols,
      scrollback: 10000,
      convertEol: true,
      allowProposedApi: true,
    });
    
    // Attach to DOM first
    terminal.open(container);
    
    // Add addons
    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    
    // Load WebGL addon for better performance
    try {
      webglAddon = new WebglAddon();
      terminal.loadAddon(webglAddon);
      
      // Wait for WebGL to initialize
      webglAddon.onContextLoss(() => {
        // Fallback to canvas renderer
        webglAddon.dispose();
      });
    } catch (e) {
      console.warn('WebGL addon failed to load, using canvas renderer', e);
    }
    
    // Load other addons
    searchAddon = new SearchAddon();
    terminal.loadAddon(searchAddon);
    terminal.loadAddon(new WebLinksAddon());
    
    // Fit terminal to container
    fitAddon.fit();
    
    // Create streaming terminal backend
    try {
      await invoke('create_streaming_terminal', {
        terminalId,
        shell,
        rows: terminal.rows,
        cols: terminal.cols,
        cwd,
        env
      });
      isInitialized = true;
    } catch (error) {
      console.error('Failed to create streaming terminal:', error);
      terminal.writeln(`\x1b[1;31mError: Failed to create terminal - ${error}\x1b[0m`);
      return;
    }
    
    // Set up IPC event listeners
    const outputListener = await listen('terminal:output', (event: any) => {
      const payload = event.payload as TerminalEvent;
      if (payload.data.terminal_id === terminalId && payload.data.data) {
        // Decode base64 data
        const decoded = atob(payload.data.data);
        terminal.write(decoded);
      }
    });
    eventListeners.push(outputListener);
    
    const exitListener = await listen('terminal:exit', (event: any) => {
      const payload = event.payload as TerminalEvent;
      if (payload.data.terminal_id === terminalId) {
        const code = payload.data.code;
        terminal.writeln(`\n\x1b[1;33mProcess exited${code !== undefined ? ` with code ${code}` : ''}\x1b[0m`);
        isInitialized = false;
      }
    });
    eventListeners.push(exitListener);
    
    const errorListener = await listen('terminal:error', (event: any) => {
      const payload = event.payload as TerminalEvent;
      if (payload.data.terminal_id === terminalId) {
        terminal.writeln(`\x1b[1;31mError: ${payload.data.error}\x1b[0m`);
      }
    });
    eventListeners.push(errorListener);
    
    const stateListener = await listen('terminal:state', (event: any) => {
      const payload = event.payload as TerminalEvent;
      if (payload.data.terminal_id === terminalId && payload.data.state) {
        // Handle terminal state changes
        const state = payload.data.state;
        if (state.rows && state.cols) {
          terminal.resize(state.cols, state.rows);
        }
      }
    });
    eventListeners.push(stateListener);
    
    // Handle input
    terminal.onData(async (data: string) => {
      if (!isInitialized) return;
      
      try {
        await invoke('send_terminal_input', {
          terminalId,
          inputType: 'text',
          data
        });
      } catch (error) {
        console.error('Failed to send input:', error);
      }
    });
    
    // Handle resize
    resizeObserver = new ResizeObserver(() => {
      if (fitAddon && isInitialized) {
        fitAddon.fit();
        // Notify backend about terminal size
        const dimensions = fitAddon.proposeDimensions();
        if (dimensions && (dimensions.rows !== terminal.rows || dimensions.cols !== terminal.cols)) {
          invoke('resize_streaming_terminal', {
            terminalId,
            rows: dimensions.rows,
            cols: dimensions.cols
          }).catch(console.error);
        }
      }
    });
    resizeObserver.observe(container);
    
    // Welcome message
    terminal.writeln(`\x1b[1;34m${title}\x1b[0m`);
    if (shell) {
      terminal.writeln(`Shell: ${shell}`);
    }
    terminal.writeln('');
  });
  
  onDestroy(async () => {
    // Clean up event listeners
    for (const unlisten of eventListeners) {
      unlisten();
    }
    
    // Clean up terminal
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    if (webglAddon) {
      webglAddon.dispose();
    }
    if (terminal) {
      terminal.dispose();
    }
    
    // Stop streaming
    if (isInitialized) {
      try {
        await invoke('stop_streaming_terminal', { terminalId });
      } catch (error) {
        console.error('Failed to stop terminal:', error);
      }
    }
  });
  
  function handleKeyDown(event: KeyboardEvent) {
    if (!isInitialized) return;
    
    // Ctrl+F for search
    if (event.ctrlKey && event.key === 'f') {
      event.preventDefault();
      const searchTerm = prompt('Search for:');
      if (searchTerm) {
        searchAddon?.findNext(searchTerm);
      }
    }
    // Ctrl+Shift+F for search backward
    else if (event.ctrlKey && event.shiftKey && event.key === 'F') {
      event.preventDefault();
      searchAddon?.findPrevious(searchAddon.searchOptions?.term || '');
    }
    // Ctrl+L to clear
    else if (event.ctrlKey && event.key === 'l') {
      event.preventDefault();
      invoke('clear_terminal_scrollback', { terminalId }).catch(console.error);
    }
  }
  
  // Public methods
  export function focus() {
    terminal?.focus();
  }
  
  export function clear() {
    terminal?.clear();
  }
  
  export function getTerminal() {
    return terminal;
  }
</script>

<div 
  class="terminal-container"
  bind:this={container}
  on:keydown={handleKeyDown}
  tabindex="0"
  role="application"
  aria-label={title}
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
    overflow: hidden;
  }
  
  .terminal-container:focus {
    outline: 2px solid #89b4fa;
    outline-offset: -2px;
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
  
  :global(.xterm-screen) {
    height: 100%;
  }
</style>