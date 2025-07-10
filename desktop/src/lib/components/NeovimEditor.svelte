<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Terminal as XTerm } from '@xterm/xterm';
  import { FitAddon } from '@xterm/addon-fit';
  import { tmux } from '$lib/tauri/tmux';
  import { NeovimClient } from '$lib/tauri/neovim';
  import AIAssistant from './AIAssistant.svelte';
  import { slide } from 'svelte/transition';
  import '@xterm/xterm/css/xterm.css';
  
  export let filePath: string | null = null;
  export let sessionName: string = 'orchflow-main';
  export let title: string = 'Neovim';
  export let instanceId: string = '';
  
  let container: HTMLDivElement;
  let terminal: XTerm;
  let fitAddon: FitAddon;
  let resizeObserver: ResizeObserver;
  let pollInterval: number;
  let lastContent: string = '';
  let paneId: string | null = null;
  let nvimClient: NeovimClient | null = null;
  let showAIAssistant = false;
  let aiPanelWidth = 400;
  let selection: { start: number; end: number; text: string } | null = null;
  
  onMount(async () => {
    // Create terminal
    terminal = new XTerm({
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5'
      },
      fontFamily: 'var(--font-mono)',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 10000,
    });
    
    // Add addons
    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    
    // Open terminal in container
    terminal.open(container);
    fitAddon.fit();
    
    try {
      // Create Neovim instance
      if (!instanceId) {
        instanceId = `nvim-${Date.now()}`;
      }
      nvimClient = await NeovimClient.create(instanceId);
      
      // Create tmux pane with Neovim attached to the socket
      const nvimCommand = `nvim --listen /tmp/nvim-${instanceId}.sock ${filePath || ''}`;
      const pane = await tmux.createPane(sessionName, nvimCommand);
      paneId = pane.id;
      
      // Wait for Neovim to start
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Open file if provided
      if (filePath && nvimClient) {
        await nvimClient.openFile(filePath);
      }
      
      // Handle terminal input
      terminal.onData(async (data) => {
        if (paneId) {
          try {
            await tmux.sendKeys(paneId, data);
          } catch (error) {
            console.error('Failed to send keys:', error);
          }
        }
      });
      
      // Handle keyboard shortcuts
      container.addEventListener('keydown', handleKeydown);
      
      // Start polling for output
      let isPolling = false;
      pollInterval = window.setInterval(async () => {
        if (paneId && !isPolling) {
          isPolling = true;
          try {
            const content = await tmux.capturePane(paneId, 1000);
            if (content !== lastContent) {
              terminal.clear();
              const lines = content.split('\n');
              lines.forEach((line, i) => {
                if (i < lines.length - 1) {
                  terminal.writeln(line);
                } else if (line) {
                  terminal.write(line);
                }
              });
              lastContent = content;
            }
          } catch (error) {
            console.error('Failed to capture pane:', error);
          } finally {
            isPolling = false;
          }
        }
      }, 100);
      
      // Handle resize
      let resizeTimeout: number;
      resizeObserver = new ResizeObserver(async () => {
        fitAddon.fit();
        
        clearTimeout(resizeTimeout);
        resizeTimeout = window.setTimeout(async () => {
          if (paneId && terminal) {
            try {
              const cols = terminal.cols;
              const rows = terminal.rows;
              if (cols > 0 && rows > 0) {
                await tmux.resizePane(paneId, cols, rows);
              }
            } catch (error) {
              console.error('Failed to resize pane:', error);
            }
          }
        }, 100);
      });
      resizeObserver.observe(container);
      
      // Initial resize
      if (paneId) {
        await tmux.resizePane(paneId, terminal.cols, terminal.rows);
      }
    } catch (error) {
      console.error('Failed to initialize Neovim:', error);
      terminal.writeln('\x1b[31mError: Failed to initialize Neovim\x1b[0m');
      terminal.writeln(String(error));
    }
  });
  
  onDestroy(async () => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    if (terminal) {
      terminal.dispose();
    }
    if (nvimClient) {
      await nvimClient.close();
    }
    if (paneId) {
      try {
        await tmux.killPane(paneId);
      } catch (error) {
        console.error('Failed to kill pane:', error);
      }
    }
    container.removeEventListener('keydown', handleKeydown);
  });
  
  // Exposed methods
  export async function save() {
    if (nvimClient) {
      return await nvimClient.save();
    }
  }
  
  export async function getBuffer() {
    if (nvimClient) {
      return await nvimClient.getBufferContent();
    }
  }
  
  async function handleKeydown(event: KeyboardEvent) {
    // Ctrl+Enter or Cmd+Enter to toggle AI Assistant
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      await toggleAIAssistant();
    }
  }
  
  async function toggleAIAssistant() {
    showAIAssistant = !showAIAssistant;
    
    if (showAIAssistant && nvimClient) {
      // Get current selection if any
      try {
        const mode = await nvimClient.getMode();
        if (mode === 'v' || mode === 'V') {
          // Visual mode - get selection
          const start = await nvimClient.eval("line(\"'<\")");
          const end = await nvimClient.eval("line(\"'>\")");
          const lines = await nvimClient.eval("getline(line(\"'<\"), line(\"'>\"))");
          selection = {
            start: Number(start),
            end: Number(end),
            text: Array.isArray(lines) ? lines.join('\n') : String(lines)
          };
        } else {
          selection = null;
        }
      } catch (error) {
        console.error('Failed to get selection:', error);
        selection = null;
      }
    }
  }
  
  function closeAIAssistant() {
    showAIAssistant = false;
    selection = null;
  }
</script>

<div class="editor-container" class:with-ai={showAIAssistant}>
  <div class="editor-wrapper">
    <div class="editor-header">
      <span class="editor-title">{title}</span>
      <div class="editor-actions">
        <button 
          class="editor-action" 
          class:active={showAIAssistant}
          title="AI Assistant (Ctrl+Enter)" 
          on:click={toggleAIAssistant}
        >
          🤖
        </button>
        <button class="editor-action" title="Save" on:click={save}>
          💾
        </button>
      </div>
    </div>
    <div class="editor-terminal" bind:this={container}></div>
  </div>
  
  {#if showAIAssistant}
    <div 
      class="ai-panel" 
      style="width: {aiPanelWidth}px"
      transition:slide={{ axis: 'x', duration: 200 }}
    >
      <AIAssistant 
        {filePath}
        {instanceId}
        {selection}
        on:close={closeAIAssistant}
        on:applied={() => {
          // Refresh the terminal view after applying changes
          if (paneId) {
            tmux.capturePane(paneId, 1000).then(content => {
              lastContent = '';
            });
          }
        }}
      />
    </div>
  {/if}
</div>

<style>
  .editor-container {
    display: flex;
    height: 100%;
    background: var(--bg-primary);
  }
  
  .editor-container.with-ai {
    gap: 0;
  }
  
  .editor-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  
  .editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 10px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    font-size: 12px;
    color: var(--fg-secondary);
  }
  
  .editor-title {
    font-weight: 500;
  }
  
  .editor-actions {
    display: flex;
    gap: 5px;
  }
  
  .editor-action {
    background: none;
    border: none;
    color: var(--fg-secondary);
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 12px;
    transition: all 0.2s;
  }
  
  .editor-action:hover {
    background: var(--bg-hover);
    color: var(--fg-primary);
  }
  
  .editor-action.active {
    background: var(--accent);
    color: white;
  }
  
  .ai-panel {
    flex-shrink: 0;
    height: 100%;
    overflow: hidden;
    border-left: 1px solid var(--border);
  }
  
  .editor-terminal {
    flex: 1;
    overflow: hidden;
  }
  
  :global(.xterm) {
    height: 100%;
    padding: 5px;
  }
</style>