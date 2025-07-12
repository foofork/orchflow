<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  
  export let terminalId: string;
  export const title: string = 'Terminal'; // External reference only
  export let initialRows: number = 24;
  export let initialCols: number = 80;
  export let shell: string | undefined = undefined;
  export let cwd: string | undefined = undefined;
  export let env: Record<string, string> | undefined = undefined;
  
  // Allow injection for testing
  export let terminalFactory: (() => Promise<any>) | undefined = undefined;
  export let testMode: boolean = false;
  
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
  
  // Default terminal factory for production
  async function createDefaultTerminal() {
    const { Terminal: XTerm } = await import('@xterm/xterm');
    const { FitAddon } = await import('@xterm/addon-fit');
    const { WebglAddon } = await import('@xterm/addon-webgl');
    const { WebLinksAddon } = await import('@xterm/addon-web-links');
    const { SearchAddon } = await import('@xterm/addon-search');
    await import('@xterm/xterm/css/xterm.css');
    
    const term = new XTerm({
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
    
    return { term, FitAddon, WebglAddon, WebLinksAddon, SearchAddon };
  }
  
  onMount(async () => {
    if (!browser) return;
    
    try {
      // Use injected factory or default
      const factory = terminalFactory || createDefaultTerminal;
      const terminalSetup = await factory();
      
      if (!terminalSetup) {
        console.error('Terminal factory returned null');
        return;
      }
      
      // Handle both object return and direct terminal return
      if (terminalSetup.term) {
        terminal = terminalSetup.term;
        const { FitAddon, WebglAddon, WebLinksAddon, SearchAddon } = terminalSetup;
        
        // Attach to DOM if container exists
        if (container && terminal.open) {
          terminal.open(container);
        }
        
        // Add addons if available
        if (FitAddon) {
          fitAddon = new FitAddon();
          terminal.loadAddon(fitAddon);
        }
        
        // Load WebGL addon for better performance
        if (WebglAddon) {
          try {
            webglAddon = new WebglAddon();
            terminal.loadAddon(webglAddon);
            
            if (webglAddon.onContextLoss) {
              webglAddon.onContextLoss(() => {
                webglAddon.dispose();
              });
            }
          } catch (e) {
            console.warn('WebGL addon failed to load, using canvas renderer', e);
          }
        }
        
        // Load other addons
        if (SearchAddon) {
          searchAddon = new SearchAddon();
          terminal.loadAddon(searchAddon);
        }
        
        if (WebLinksAddon) {
          terminal.loadAddon(new WebLinksAddon());
        }
      } else {
        // Direct terminal instance
        terminal = terminalSetup;
        if (container && terminal.open) {
          terminal.open(container);
        }
      }
      
      // Fit terminal to container
      if (fitAddon && fitAddon.fit) {
        setTimeout(() => fitAddon.fit(), 0);
      }
      
      // Create Rust backend terminal
      await createBackendTerminal();
      
      // Set up event handlers
      setupEventHandlers();
      
      // Set up resize observer
      setupResizeObserver();
      
      isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize terminal:', error);
    }
  });
  
  async function createBackendTerminal() {
    try {
      await invoke('create_terminal', {
        id: terminalId,
        shell,
        cwd,
        env,
        rows: terminal.rows,
        cols: terminal.cols,
      });
    } catch (error) {
      console.error('Failed to create backend terminal:', error);
    }
  }
  
  function setupEventHandlers() {
    if (!terminal) return;
    
    // Handle terminal input
    if (terminal.onData) {
      terminal.onData(async (data: string) => {
        if (!testMode) {
          try {
            await invoke('write_terminal', { 
              terminalId, 
              data 
            });
          } catch (error) {
            console.error('Failed to write to terminal:', error);
          }
        }
      });
    }
    
    // Handle resize
    if (terminal.onResize) {
      terminal.onResize(async ({ cols, rows }: { cols: number; rows: number }) => {
        if (!testMode) {
          try {
            await invoke('resize_terminal', { 
              terminalId, 
              rows, 
              cols 
            });
          } catch (error) {
            console.error('Failed to resize terminal:', error);
          }
        }
      });
    }
    
    // Listen for backend events
    if (!testMode) {
      setupBackendListeners();
    }
  }
  
  async function setupBackendListeners() {
    // Listen for terminal output
    const outputUnlisten = await listen<TerminalEvent>('terminal-output', (event) => {
      if (event.payload.data.terminal_id === terminalId && event.payload.data.data) {
        terminal.write(event.payload.data.data);
      }
    });
    eventListeners.push(outputUnlisten);
    
    // Listen for terminal exit
    const exitUnlisten = await listen<TerminalEvent>('terminal-exit', (event) => {
      if (event.payload.data.terminal_id === terminalId) {
        const code = event.payload.data.code || 0;
        terminal.write(`\r\nProcess exited with code ${code}\r\n`);
      }
    });
    eventListeners.push(exitUnlisten);
    
    // Listen for terminal errors
    const errorUnlisten = await listen<TerminalEvent>('terminal-error', (event) => {
      if (event.payload.data.terminal_id === terminalId && event.payload.data.error) {
        terminal.write(`\r\nError: ${event.payload.data.error}\r\n`);
      }
    });
    eventListeners.push(errorUnlisten);
  }
  
  function setupResizeObserver() {
    if (!container || !fitAddon) return;
    
    resizeObserver = new ResizeObserver(() => {
      if (fitAddon && fitAddon.fit) {
        fitAddon.fit();
      }
    });
    
    resizeObserver.observe(container);
  }
  
  // Public methods for external control
  export function write(data: string) {
    if (terminal && terminal.write) {
      terminal.write(data);
    }
  }
  
  export function clear() {
    if (terminal && terminal.clear) {
      terminal.clear();
    }
  }
  
  export function focus() {
    if (terminal && terminal.focus) {
      terminal.focus();
    }
  }
  
  export function blur() {
    if (terminal && terminal.blur) {
      terminal.blur();
    }
  }
  
  export function search(term: string) {
    if (searchAddon && searchAddon.findNext) {
      searchAddon.findNext(term);
    }
  }
  
  export function resize(cols: number, rows: number) {
    if (terminal && terminal.resize) {
      terminal.resize(cols, rows);
    }
  }
  
  onDestroy(() => {
    // Clean up event listeners
    eventListeners.forEach(unlisten => unlisten());
    
    // Clean up resize observer
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    
    // Dispose addons
    if (searchAddon && searchAddon.dispose) {
      searchAddon.dispose();
    }
    if (webglAddon && webglAddon.dispose) {
      webglAddon.dispose();
    }
    if (fitAddon && fitAddon.dispose) {
      fitAddon.dispose();
    }
    
    // Dispose terminal
    if (terminal && terminal.dispose) {
      terminal.dispose();
    }
    
    // Close backend terminal
    if (isInitialized && !testMode) {
      invoke('close_terminal', { terminalId }).catch(console.error);
    }
  });
</script>

<div class="terminal-container" bind:this={container}>
  {#if testMode}
    <div class="terminal-test-mode">
      Terminal {terminalId} (Test Mode)
    </div>
  {/if}
</div>

<style>
  .terminal-container {
    width: 100%;
    height: 100%;
    background: #1e1e2e;
    position: relative;
  }
  
  .terminal-test-mode {
    padding: 20px;
    color: #cdd6f4;
    font-family: monospace;
    text-align: center;
  }
  
  :global(.xterm) {
    padding: 8px;
    height: 100%;
  }
  
  :global(.xterm-viewport) {
    background-color: transparent !important;
  }
  
  :global(.xterm-screen) {
    height: 100% !important;
  }
</style>