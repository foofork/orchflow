<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { writable, derived } from 'svelte/store';
  import StreamingTerminal from './StreamingTerminal.svelte';
  import { invoke } from '@tauri-apps/api/core';
  
  const dispatch = createEventDispatcher();
  
  interface Terminal {
    id: string;
    title: string;
    cwd: string;
    shell?: string;
    isActive: boolean;
    processId?: number;
    isRunning: boolean;
  }
  
  interface TerminalGroup {
    id: string;
    name: string;
    terminals: string[];
  }
  
  export let layout: 'single' | 'split-horizontal' | 'split-vertical' | 'grid' = 'single';
  export let defaultShell: string | undefined = undefined;
  export let terminals: Terminal[] = [];
  export let activeTerminalId: string | null = null;
  export let terminalGroups: string[] = [];
  export let quickCommands: Array<{ label: string; command: string }> = [];
  export let supportedLayouts: string[] = ['single', 'split', 'grid'];
  export let onTerminalCreate: (() => void) | undefined = undefined;
  export let onTerminalClose: ((id: string) => void) | undefined = undefined;
  export let onTabSwitch: ((id: string) => void) | undefined = undefined;
  export let onSplit: ((direction: 'horizontal' | 'vertical') => void) | undefined = undefined;
  export let onBroadcastToggle: (() => void) | undefined = undefined;
  export let onQuickCommand: ((command: string) => void) | undefined = undefined;
  export let onTerminalRename: ((id: string, name: string) => void) | undefined = undefined;
  export let onTabReorder: ((fromIndex: number, toIndex: number) => void) | undefined = undefined;
  export let onLayoutChange: ((layout: string) => void) | undefined = undefined;
  export let onSearch: ((query: string) => void) | undefined = undefined;
  export let testMode: boolean = false;
  
  const terminalsStore = writable<Terminal[]>(terminals);
  const activeTerminalIdStore = writable<string | null>(activeTerminalId);
  const terminalGroupsStore = writable<TerminalGroup[]>(terminalGroups.map((name, idx) => ({ id: `group-${idx}`, name, terminals: [] })));
  const availableShells = writable<string[]>([]);
  
  // Update stores when props change
  $: terminalsStore.set(terminals);
  $: activeTerminalIdStore.set(activeTerminalId);
  $: terminalGroupsStore.set(terminalGroups.map((name, idx) => ({ id: `group-${idx}`, name, terminals: [] })));
  
  const activeTerminal = derived(
    [terminalsStore, activeTerminalIdStore],
    ([$terminals, $activeId]) => $terminals.find(t => t.id === $activeId) || null
  );
  
  let terminalContainer: HTMLElement;
  let showNewTerminalMenu = false;
  let searchQuery = '';
  let showSearchBar = false;
  let showGroupsMenu = false;
  let showQuickCommandsMenu = false;
  let showLayoutMenu = false;
  let renamingTerminalId: string | null = null;
  let renameValue = '';
  let showContextMenu = false;
  let contextMenuTerminalId: string | null = null;
  let contextMenuPosition = { x: 0, y: 0 };
  let draggedTerminalId: string | null = null;
  let draggedOverId: string | null = null;
  
  onMount(async () => {
    // Load available shells
    if (testMode) {
      // In test mode, use mock data
      availableShells.set(['/bin/bash', '/bin/zsh', '/bin/sh']);
    } else {
      try {
        const shells = await invoke('get_available_shells');
        availableShells.set(shells as string[]);
      } catch (err) {
        console.error('Failed to get available shells:', err);
        availableShells.set(['/bin/bash', '/bin/zsh', '/bin/sh']);
      }
    }
    
    // Load saved terminal groups
    loadTerminalGroups();
    
    // Global click handler to close menus
    const handleGlobalClick = () => {
      showContextMenu = false;
    };
    document.addEventListener('click', handleGlobalClick);
    
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  });
  
  async function createTerminal(shell?: string, cwd?: string, title?: string) {
    if (onTerminalCreate) {
      onTerminalCreate();
      return;
    }
    
    try {
      const terminalId = crypto.randomUUID();
      const terminal: Terminal = {
        id: terminalId,
        title: title || `Terminal ${$terminalsStore.length + 1}`,
        cwd: cwd || await invoke('get_current_dir') as string,
        shell: shell || defaultShell,
        isActive: true,
        isRunning: true
      };
      
      // Set all other terminals as inactive
      terminalsStore.update(terms => terms.map(t => ({ ...t, isActive: false })));
      
      // Add new terminal
      terminalsStore.update(terms => [...terms, terminal]);
      activeTerminalIdStore.set(terminalId);
      
      dispatch('terminalCreated', { terminal });
    } catch (err) {
      console.error('Failed to create terminal:', err);
      dispatch('error', { message: `Failed to create terminal: ${err}` });
    }
  }
  
  function closeTerminal(id: string) {
    if (onTerminalClose) {
      onTerminalClose(id);
      return;
    }
    
    terminalsStore.update(terms => {
      const filtered = terms.filter(t => t.id !== id);
      
      // If closing active terminal, activate another
      if ($activeTerminalIdStore === id && filtered.length > 0) {
        const newActive = filtered[filtered.length - 1];
        newActive.isActive = true;
        activeTerminalIdStore.set(newActive.id);
      } else if (filtered.length === 0) {
        activeTerminalIdStore.set(null);
      }
      
      return filtered;
    });
    
    dispatch('terminalClosed', { id });
  }
  
  function activateTerminal(id: string) {
    if (onTabSwitch) {
      onTabSwitch(id);
      return;
    }
    
    terminalsStore.update(terms => terms.map(t => ({
      ...t,
      isActive: t.id === id
    })));
    activeTerminalIdStore.set(id);
    dispatch('terminalActivated', { id });
  }
  
  function renameTerminal(id: string, newTitle: string) {
    terminalsStore.update(terms => terms.map(t => 
      t.id === id ? { ...t, title: newTitle } : t
    ));
  }
  
  function splitTerminal(direction: 'horizontal' | 'vertical') {
    if (onSplit) {
      onSplit(direction);
      return;
    }
    
    const current = $activeTerminal;
    if (!current) {
      createTerminal();
      return;
    }
    
    // Update layout based on split direction
    if (layout === 'single') {
      layout = direction === 'horizontal' ? 'split-horizontal' : 'split-vertical';
    } else if (layout === 'split-horizontal' || layout === 'split-vertical') {
      layout = 'grid';
    }
    
    // Create new terminal in same directory
    createTerminal(current.shell, current.cwd, `${current.title} (2)`);
  }
  
  async function broadcastCommand(command: string, groupId?: string) {
    const targetTerminals = groupId 
      ? $terminalsStore.filter(t => {
          const group = $terminalGroupsStore.find(g => g.id === groupId);
          return group?.terminals.includes(t.id);
        })
      : $terminalsStore;
    
    try {
      await invoke('broadcast_terminal_input', {
        terminal_ids: targetTerminals.map(t => t.id),
        input_type: 'text',
        data: command + '\n'
      });
    } catch (err) {
      console.error('Failed to broadcast command:', err);
    }
  }
  
  function createTerminalGroup(name: string, terminalIds: string[]) {
    const group: TerminalGroup = {
      id: crypto.randomUUID(),
      name,
      terminals: terminalIds
    };
    
    terminalGroupsStore.update(groups => [...groups, group]);
    saveTerminalGroups();
  }
  
  function loadTerminalGroups() {
    const saved = localStorage.getItem('orchflow_terminal_groups');
    if (saved) {
      try {
        terminalGroupsStore.set(JSON.parse(saved));
      } catch (err) {
        console.error('Failed to load terminal groups:', err);
      }
    }
  }
  
  function saveTerminalGroups() {
    localStorage.setItem('orchflow_terminal_groups', JSON.stringify($terminalGroupsStore));
  }
  
  function handleTerminalKey(event: KeyboardEvent) {
    // Handle keyboard shortcuts
    const isMac = navigator.platform.toLowerCase().includes('mac');
    const modKey = isMac ? event.metaKey : event.ctrlKey;
    
    if (modKey) {
      switch (event.key) {
        case 't':
          event.preventDefault();
          createTerminal();
          break;
        case 'w':
          event.preventDefault();
          if ($activeTerminalIdStore) {
            closeTerminal($activeTerminalIdStore);
          }
          break;
        case '\\':
          event.preventDefault();
          splitTerminal('vertical');
          break;
        case '-':
          event.preventDefault();
          splitTerminal('horizontal');
          break;
        case 'f':
          event.preventDefault();
          showSearchBar = !showSearchBar;
          break;
        case 'Tab':
          event.preventDefault();
          // Cycle through terminals
          const terms = $terminalsStore;
          if (terms.length > 1) {
            const currentIndex = terms.findIndex(t => t.id === $activeTerminalIdStore);
            const nextIndex = event.shiftKey 
              ? (currentIndex - 1 + terms.length) % terms.length
              : (currentIndex + 1) % terms.length;
            activateTerminal(terms[nextIndex].id);
          }
          break;
      }
      
      // Number keys to switch terminals
      if (event.key >= '1' && event.key <= '9') {
        event.preventDefault();
        const index = parseInt(event.key) - 1;
        if ($terminalsStore[index]) {
          activateTerminal($terminalsStore[index].id);
        }
      }
    }
  }
  
  function getLayoutClasses() {
    switch (layout) {
      case 'split-horizontal':
        return 'terminal-grid horizontal';
      case 'split-vertical':
        return 'terminal-grid vertical';
      case 'grid':
        return 'terminal-grid grid';
      default:
        return 'terminal-single';
    }
  }
  
  // Handle terminal output for process detection
  function handleTerminalOutput(event: CustomEvent) {
    const { terminalId, data } = event.detail;
    
    // Update terminal state based on output
    terminalsStore.update(terms => terms.map(t => {
      if (t.id === terminalId) {
        // You could parse the output here to detect running processes
        // For now, just mark as running
        return { ...t, isRunning: true };
      }
      return t;
    }));
  }

  function handleSearch() {
    if (onSearch) {
      onSearch(searchQuery);
    } else {
      // Default search behavior
      dispatch('search', { query: searchQuery });
    }
  }

  function startRename(terminalId: string, currentTitle: string) {
    renamingTerminalId = terminalId;
    renameValue = currentTitle;
    // Focus the input after it's rendered
    setTimeout(() => {
      const input = document.querySelector('.tab-rename-input') as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    }, 0);
  }

  function handleRenameKeydown(event: KeyboardEvent, terminalId: string) {
    if (event.key === 'Enter') {
      finishRename(terminalId);
    } else if (event.key === 'Escape') {
      cancelRename();
    }
  }

  function finishRename(terminalId: string) {
    if (renameValue.trim() && renameValue !== renamingTerminalId) {
      if (onTerminalRename) {
        onTerminalRename(terminalId, renameValue.trim());
      } else {
        renameTerminal(terminalId, renameValue.trim());
      }
    }
    cancelRename();
  }

  function cancelRename() {
    renamingTerminalId = null;
    renameValue = '';
  }
</script>

<div class="terminal-panel" on:keydown={handleTerminalKey}>
  <div class="terminal-header">
    <div class="terminal-tabs" role="tablist" aria-label="Terminal tabs">
      {#each $terminalsStore as terminal}
        <div class="terminal-tab-container">
          <button
          class="terminal-tab"
          class:active={terminal.isActive}
          class:drag-over={draggedOverId === terminal.id}
          role="tab"
          aria-selected={terminal.isActive}
          aria-controls="terminal-{terminal.id}"
          id="tab-{terminal.id}"
          draggable="true"
          on:click={() => activateTerminal(terminal.id)}
          on:dblclick={() => startRename(terminal.id, terminal.title)}
          on:auxclick={(e) => { if (e.button === 1) closeTerminal(terminal.id); }}
          on:contextmenu={(e) => {
            e.preventDefault();
            contextMenuTerminalId = terminal.id;
            contextMenuPosition = { x: e.clientX, y: e.clientY };
            showContextMenu = true;
          }}
          on:keydown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              e.preventDefault();
              const terms = $terminalsStore;
              const currentIndex = terms.findIndex(t => t.id === terminal.id);
              if (e.key === 'ArrowRight' && currentIndex < terms.length - 1) {
                activateTerminal(terms[currentIndex + 1].id);
              } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
                activateTerminal(terms[currentIndex - 1].id);
              }
            }
          }}
          on:dragstart={(e) => {
            draggedTerminalId = terminal.id;
            if (e.dataTransfer) {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', terminal.id);
            }
          }}
          on:dragover={(e) => {
            e.preventDefault();
            if (e.dataTransfer) {
              e.dataTransfer.dropEffect = 'move';
            }
            if (draggedTerminalId && draggedTerminalId !== terminal.id) {
              draggedOverId = terminal.id;
            }
          }}
          on:dragleave={() => {
            draggedOverId = null;
          }}
          on:drop={(e) => {
            e.preventDefault();
            if (draggedTerminalId && draggedTerminalId !== terminal.id) {
              const fromIndex = $terminalsStore.findIndex(t => t.id === draggedTerminalId);
              const toIndex = $terminalsStore.findIndex(t => t.id === terminal.id);
              if (fromIndex !== -1 && toIndex !== -1 && onTabReorder) {
                onTabReorder(fromIndex, toIndex);
              }
            }
            draggedTerminalId = null;
            draggedOverId = null;
          }}
          on:dragend={() => {
            draggedTerminalId = null;
            draggedOverId = null;
          }}
          title="{terminal.title} - {terminal.cwd}"
        >
          <span class="tab-icon">
            {terminal.isRunning ? '🟢' : '⚫'}
          </span>
          {#if renamingTerminalId === terminal.id}
            <input
              type="text"
              class="tab-rename-input"
              bind:value={renameValue}
              on:keydown={(e) => handleRenameKeydown(e, terminal.id)}
              on:blur={() => finishRename(terminal.id)}
              on:click|stopPropagation
            />
          {:else}
            <span class="tab-title">{terminal.title}</span>
          {/if}
          </button>
          <button
            class="tab-close"
            on:click|stopPropagation={() => closeTerminal(terminal.id)}
            title="Close terminal"
          >
            ×
          </button>
        </div>
      {/each}
      
      <button
        class="new-terminal-btn"
        on:click={() => testMode && onTerminalCreate ? onTerminalCreate() : (showNewTerminalMenu = !showNewTerminalMenu)}
        title="New Terminal"
      >
        +
      </button>
      
      {#if showNewTerminalMenu}
        <div class="new-terminal-menu">
          <div class="menu-title">New Terminal</div>
          {#each $availableShells as shell}
            <button
              class="menu-item"
              on:click={() => {
                createTerminal(shell);
                showNewTerminalMenu = false;
              }}
            >
              💻 {shell.split('/').pop()}
            </button>
          {/each}
          <hr />
          <button
            class="menu-item"
            on:click={() => {
              splitTerminal('horizontal');
              showNewTerminalMenu = false;
            }}
          >
            ➖ Split Horizontal
          </button>
          <button
            class="menu-item"
            on:click={() => {
              splitTerminal('vertical');
              showNewTerminalMenu = false;
            }}
          >
            ➕ Split Vertical
          </button>
        </div>
      {/if}
    </div>
    
    <div class="terminal-actions">
      <button
        class="action-btn"
        on:click={() => splitTerminal('vertical')}
        title="Split Vertical"
      >
        ⏸
      </button>
      <button
        class="action-btn"
        on:click={() => splitTerminal('horizontal')}
        title="Split Horizontal"
      >
        ⏹
      </button>
      <button
        class="action-btn"
        on:click={() => showSearchBar = !showSearchBar}
        title="Search (Ctrl+F)"
        class:active={showSearchBar}
      >
        🔍
      </button>
      <button
        class="action-btn"
        on:click={() => dispatch('openSettings')}
        title="Terminal Settings"
      >
        ⚙️
      </button>
      <button
        class="action-btn"
        on:click={() => showNewTerminalMenu = !showNewTerminalMenu}
        title="Shell selector"
      >
        💻
      </button>
      <button
        class="action-btn"
        on:click={() => onBroadcastToggle ? onBroadcastToggle() : dispatch('toggleBroadcast')}
        title="Toggle broadcast"
      >
        📡
      </button>
      <button
        class="action-btn"
        on:click={() => showGroupsMenu = !showGroupsMenu}
        title="Terminal groups"
      >
        👥
      </button>
      <button
        class="action-btn"
        on:click={() => showQuickCommandsMenu = !showQuickCommandsMenu}
        title="Quick commands"
      >
        ⚡
      </button>
      <button
        class="action-btn"
        on:click={() => showLayoutMenu = !showLayoutMenu}
        title="Layout options"
      >
        ⊞
      </button>
    </div>
  </div>
  
  {#if showSearchBar}
    <div class="search-bar">
      <input
        type="text"
        placeholder="Search terminal output..."
        bind:value={searchQuery}
        class="search-input"
        on:keydown={(e) => e.key === 'Enter' && handleSearch()}
      />
      <button class="search-btn" on:click={handleSearch}>Find</button>
      <button class="search-close" on:click={() => showSearchBar = false}>×</button>
    </div>
  {/if}
  
  {#if showGroupsMenu}
    <div class="groups-menu">
      <div class="menu-title">Terminal Groups</div>
      {#each $terminalGroupsStore as group}
        <button
          class="menu-item"
          on:click={() => {
            dispatch('selectGroup', { group: group.name });
            showGroupsMenu = false;
          }}
        >
          👥 {group.name}
        </button>
      {/each}
      {#if $terminalGroupsStore.length === 0}
        <div class="menu-item disabled">No groups available</div>
      {/if}
    </div>
  {/if}
  
  {#if showQuickCommandsMenu}
    <div class="quick-commands-menu">
      <div class="menu-title">Quick Commands</div>
      {#each quickCommands as cmd}
        <button
          class="menu-item"
          on:click={() => {
            if (onQuickCommand) {
              onQuickCommand(cmd.command);
            } else {
              dispatch('quickCommand', { command: cmd.command });
            }
            showQuickCommandsMenu = false;
          }}
        >
          ⚡ {cmd.label}
        </button>
      {/each}
      {#if quickCommands.length === 0}
        <div class="menu-item disabled">No quick commands available</div>
      {/if}
    </div>
  {/if}
  
  {#if showLayoutMenu}
    <div class="layout-menu">
      <div class="menu-title">Layout Options</div>
      {#each supportedLayouts as layoutOption}
        <button
          class="menu-item"
          class:active={layout === layoutOption}
          on:click={() => {
            if (onLayoutChange) {
              onLayoutChange(layoutOption);
            } else {
              layout = layoutOption;
            }
            showLayoutMenu = false;
          }}
        >
          {#if layoutOption === 'single'}
            ⬜ Single
          {:else if layoutOption === 'split'}
            ⏸ Split
          {:else if layoutOption === 'grid'}
            ⊞ Grid
          {:else}
            {layoutOption}
          {/if}
        </button>
      {/each}
    </div>
  {/if}
  
  {#if showContextMenu && contextMenuTerminalId}
    <div
      class="context-menu"
      style="position: fixed; left: {contextMenuPosition.x}px; top: {contextMenuPosition.y}px;"
      on:click|stopPropagation
    >
      <button
        class="menu-item"
        on:click={() => {
          startRename(contextMenuTerminalId, $terminalsStore.find(t => t.id === contextMenuTerminalId)?.title || '');
          showContextMenu = false;
        }}
      >
        ✏️ Rename
      </button>
      <button
        class="menu-item"
        on:click={() => {
          const terminal = $terminalsStore.find(t => t.id === contextMenuTerminalId);
          if (terminal) {
            createTerminal(terminal.shell, terminal.cwd, `${terminal.title} (copy)`);
          }
          showContextMenu = false;
        }}
      >
        📋 Duplicate
      </button>
      <button
        class="menu-item"
        on:click={() => {
          if (contextMenuTerminalId) closeTerminal(contextMenuTerminalId);
          showContextMenu = false;
        }}
      >
        ❌ Close
      </button>
      <button
        class="menu-item"
        on:click={() => {
          // Move to new window functionality
          dispatch('moveToWindow', { terminalId: contextMenuTerminalId });
          showContextMenu = false;
        }}
      >
        🪟 Move to New Window
      </button>
    </div>
  {/if}
  
  <div class="terminal-container {getLayoutClasses()}" bind:this={terminalContainer}>
    {#if $terminalsStore.length === 0}
      <div class="empty-state">
        <div class="empty-icon">💻</div>
        <h3>No terminals open</h3>
        <p>Create a new terminal to get started</p>
        <button class="primary-btn" on:click={() => createTerminal()}>
          New Terminal
        </button>
      </div>
    {:else}
      {#each $terminalsStore as terminal (terminal.id)}
        <div
          class="terminal-wrapper"
          class:active={terminal.isActive}
          id="terminal-{terminal.id}"
          role="tabpanel"
          aria-labelledby="tab-{terminal.id}"
          style="display: {terminal.isActive || layout !== 'single' ? 'block' : 'none'}"
        >
          <StreamingTerminal
            terminalId={terminal.id}
            cwd={terminal.cwd}
            shell={terminal.shell}
            title={terminal.title}
            {testMode}
            on:output={handleTerminalOutput}
            on:exit={() => closeTerminal(terminal.id)}
          />
        </div>
      {/each}
    {/if}
  </div>
  
  {#if $terminalsStore.length > 0}
    <div class="terminal-status">
      <span class="status-item">
        📁 {$activeTerminal?.cwd || 'Unknown'}
      </span>
      <span class="status-item">
        🐚 {$activeTerminal?.shell?.split('/').pop() || 'Unknown'}
      </span>
      <span class="status-item">
        📟 {$terminalsStore.length} terminal{$terminalsStore.length !== 1 ? 's' : ''}
      </span>
    </div>
  {/if}
</div>

<style>
  .terminal-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    color: var(--fg-primary);
    position: relative;
  }
  
  .terminal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    height: 36px;
  }
  
  .terminal-tabs {
    display: flex;
    align-items: center;
    flex: 1;
    overflow-x: auto;
    position: relative;
  }
  
  .terminal-tabs::-webkit-scrollbar {
    height: 3px;
  }
  
  .terminal-tabs::-webkit-scrollbar-thumb {
    background: var(--border);
  }
  
  .terminal-tab-container {
    display: flex;
    align-items: center;
    position: relative;
  }
  
  .terminal-tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: none;
    border: none;
    border-right: 1px solid var(--border);
    color: var(--fg-secondary);
    cursor: pointer;
    font-size: 13px;
    min-width: 120px;
    max-width: 200px;
    transition: all 0.2s;
  }
  
  .terminal-tab:hover {
    background: var(--bg-hover);
    color: var(--fg-primary);
  }
  
  .terminal-tab.active {
    background: var(--bg-primary);
    color: var(--fg-primary);
  }
  
  .terminal-tab.drag-over {
    border-left: 2px solid var(--accent);
  }
  
  .tab-icon {
    font-size: 8px;
  }
  
  .tab-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .tab-close {
    background: none;
    border: none;
    color: var(--fg-tertiary);
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    padding: 0 4px;
    opacity: 0;
    transition: opacity 0.2s;
  }
  
  .terminal-tab:hover .tab-close {
    opacity: 1;
  }
  
  .tab-close:hover {
    color: var(--fg-primary);
  }
  
  .new-terminal-btn {
    padding: 6px 12px;
    background: none;
    border: none;
    color: var(--fg-secondary);
    cursor: pointer;
    font-size: 18px;
    transition: all 0.2s;
  }
  
  .new-terminal-btn:hover {
    background: var(--bg-hover);
    color: var(--fg-primary);
  }
  
  .new-terminal-menu {
    position: absolute;
    top: 100%;
    left: auto;
    right: 60px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    min-width: 180px;
    z-index: 100;
  }
  
  .menu-title {
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 600;
    color: var(--fg-secondary);
    border-bottom: 1px solid var(--border);
  }
  
  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: none;
    color: var(--fg-primary);
    cursor: pointer;
    font-size: 13px;
    text-align: left;
    transition: background 0.1s;
  }
  
  .menu-item:hover {
    background: var(--bg-hover);
  }
  
  .terminal-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 8px;
  }
  
  .action-btn {
    background: none;
    border: none;
    color: var(--fg-secondary);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 14px;
    transition: all 0.2s;
  }
  
  .action-btn:hover {
    background: var(--bg-hover);
    color: var(--fg-primary);
  }
  
  .action-btn.active {
    background: var(--bg-tertiary);
    color: var(--fg-primary);
  }
  
  .search-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
  }
  
  .search-input {
    flex: 1;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 13px;
    color: var(--fg-primary);
    outline: none;
  }
  
  .search-btn {
    padding: 4px 12px;
    background: var(--accent);
    border: none;
    border-radius: 4px;
    color: white;
    cursor: pointer;
    font-size: 13px;
  }
  
  .search-close {
    background: none;
    border: none;
    color: var(--fg-secondary);
    cursor: pointer;
    font-size: 18px;
    padding: 0 4px;
  }
  
  .terminal-container {
    flex: 1;
    overflow: hidden;
    position: relative;
  }
  
  .terminal-container.terminal-single {
    display: block;
  }
  
  .terminal-container.terminal-grid {
    display: grid;
    gap: 1px;
    background: var(--border);
  }
  
  .terminal-container.horizontal {
    grid-template-rows: 1fr 1fr;
  }
  
  .terminal-container.vertical {
    grid-template-columns: 1fr 1fr;
  }
  
  .terminal-container.grid {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
  }
  
  .terminal-wrapper {
    height: 100%;
    background: var(--bg-primary);
  }
  
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 16px;
    color: var(--fg-tertiary);
  }
  
  .empty-icon {
    font-size: 64px;
    opacity: 0.5;
  }
  
  .empty-state h3 {
    font-size: 20px;
    font-weight: 600;
    color: var(--fg-secondary);
    margin: 0;
  }
  
  .empty-state p {
    font-size: 14px;
    margin: 0;
  }
  
  .primary-btn {
    padding: 8px 16px;
    background: var(--accent);
    border: none;
    border-radius: 4px;
    color: white;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: opacity 0.2s;
  }
  
  .primary-btn:hover {
    opacity: 0.9;
  }
  
  .terminal-status {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 4px 12px;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    font-size: 12px;
    color: var(--fg-secondary);
  }
  
  .status-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  .new-terminal-menu,
  .groups-menu,
  .quick-commands-menu,
  .layout-menu,
  .context-menu {
    position: absolute;
    top: 40px;
    right: 100px;
    background: var(--bg-secondary, #2d2d2d);
    border: 1px solid var(--border, #444);
    border-radius: 4px;
    padding: 8px 0;
    min-width: 200px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    z-index: 100;
  }
  
  .context-menu {
    position: fixed !important;
    top: auto !important;
    right: auto !important;
  }
  
  .new-terminal-menu {
    right: auto;
    left: 20px;
  }
  
  .quick-commands-menu {
    right: 50px;
  }
  
  .layout-menu {
    right: 20px;
  }
  
  .menu-title {
    padding: 4px 12px;
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    color: var(--fg-secondary, #999);
    border-bottom: 1px solid var(--border, #444);
    margin-bottom: 4px;
  }
  
  .menu-item {
    display: block;
    width: 100%;
    padding: 6px 12px;
    text-align: left;
    background: none;
    border: none;
    color: var(--fg-primary, #f0f0f0);
    cursor: pointer;
    font-size: 13px;
  }
  
  .menu-item:hover {
    background: var(--bg-hover, #3a3a3a);
  }
  
  .menu-item.disabled {
    color: var(--fg-tertiary, #666);
    cursor: default;
  }
  
  .tab-rename-input {
    background: var(--bg-secondary, #2d2d2d);
    border: 1px solid var(--accent, #007acc);
    color: var(--fg-primary, #f0f0f0);
    padding: 2px 4px;
    font-size: 12px;
    width: 100px;
  }
</style>