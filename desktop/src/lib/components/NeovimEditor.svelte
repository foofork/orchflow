<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Terminal as XTerm } from '@xterm/xterm';
  import { FitAddon } from '@xterm/addon-fit';
  import { tmux } from '$lib/tauri/tmux';
  import { NeovimClient } from '$lib/tauri/neovim';
  import { createTerminalTheme, watchThemeChanges } from '$lib/theme/api';
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
  let themeUnsubscribe: (() => void) | null = null;
  
  onMount(async () => {
    // Get initial theme from CSS variables
    const initialTheme = createTerminalTheme();
    
    // Create terminal with dynamic theme
    terminal = new XTerm({
      theme: initialTheme,
      fontFamily: 'var(--font-mono)',
      fontSize: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--font-body').replace('px', '')) || 13,
      lineHeight: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--line-height-normal')) || 1.2,
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
    
    // Watch for theme changes and update terminal
    themeUnsubscribe = watchThemeChanges((newTheme) => {
      terminal.options.theme = newTheme;
    });
    
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
    if (themeUnsubscribe) {
      themeUnsubscribe();
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
</script>

<div class="editor-container">
  <div class="editor-wrapper">
    <div class="editor-header">
      <span class="editor-title">{title}</span>
      <div class="editor-actions">
        <button class="editor-action" title="Save" on:click={save}>
          💾
        </button>
      </div>
    </div>
    <div class="editor-terminal" bind:this={container}></div>
  </div>
</div>

<style>
  .editor-container {
    display: flex;
    height: 100%;
    background: var(--editor-bg);
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
    padding: var(--space-xs) var(--space-sm);
    background: var(--editor-gutter-bg);
    border-bottom: 1px solid var(--editor-border);
    font-size: var(--font-body-sm);
    color: var(--editor-gutter-fg);
  }
  
  .editor-title {
    font-weight: var(--font-weight-medium);
    color: var(--editor-gutter-active);
  }
  
  .editor-actions {
    display: flex;
    gap: var(--space-xs);
  }
  
  .editor-action {
    background: none;
    border: none;
    color: var(--editor-gutter-fg);
    cursor: pointer;
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-sm);
    font-size: var(--font-body-sm);
    transition: all var(--duration-fast) var(--ease-out);
  }
  
  .editor-action:hover {
    background: var(--state-hover-bg);
    color: var(--state-hover-fg);
  }
  
  .editor-action:focus {
    outline: var(--state-focus-outline);
    outline-offset: var(--state-focus-outline-offset);
  }
  
  .editor-terminal {
    flex: 1;
    overflow: hidden;
  }
  
  :global(.xterm) {
    height: 100%;
    padding: var(--space-xs);
    font-family: var(--font-mono);
    font-size: var(--font-body);
    line-height: var(--line-height-normal);
  }
</style>