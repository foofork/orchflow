<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import Fuse from 'fuse.js';
  import { invoke } from '@tauri-apps/api/tauri';
  
  export let show = false;
  
  const dispatch = createEventDispatcher();
  
  interface Command {
    id: string;
    label: string;
    icon?: string;
    category?: string;
    shortcut?: string;
    action: () => void | Promise<void>;
    keywords?: string[];
  }
  
  let searchQuery = '';
  let selectedIndex = 0;
  let searchInput: HTMLInputElement;
  let filteredCommands: Command[] = [];
  let categories: string[] = [];
  let hasGitIntegration = false;
  let recentCommands: string[] = [];
  let fuse: Fuse<Command>;
  
  // Check git availability on mount
  async function checkGitAvailability() {
    try {
      hasGitIntegration = await invoke('has_git_integration');
    } catch (err) {
      console.error('Failed to check git availability:', err);
      hasGitIntegration = false;
    }
  }
  
  // Load recent commands from localStorage
  function loadRecentCommands() {
    const stored = localStorage.getItem('orchflow_recent_commands');
    if (stored) {
      try {
        recentCommands = JSON.parse(stored);
      } catch (err) {
        recentCommands = [];
      }
    }
  }
  
  // Save recent command
  function saveRecentCommand(commandId: string) {
    if (!recentCommands.includes(commandId)) {
      recentCommands = [commandId, ...recentCommands].slice(0, 10);
      localStorage.setItem('orchflow_recent_commands', JSON.stringify(recentCommands));
    }
  }
  
  // All available commands
  const commands: Command[] = [
    // File Commands
    { id: 'file.new', label: 'New File', icon: '📄', category: 'File', shortcut: 'Ctrl+N', action: () => dispatch('command', { action: 'newFile' }), keywords: ['create'] },
    { id: 'file.open', label: 'Open File', icon: '📂', category: 'File', shortcut: 'Ctrl+O', action: () => dispatch('command', { action: 'openFile' }), keywords: ['browse'] },
    { id: 'file.save', label: 'Save', icon: '💾', category: 'File', shortcut: 'Ctrl+S', action: () => dispatch('command', { action: 'save' }), keywords: ['write'] },
    { id: 'file.saveAs', label: 'Save As...', icon: '💾', category: 'File', shortcut: 'Ctrl+Shift+S', action: () => dispatch('command', { action: 'saveAs' }) },
    { id: 'file.closeTab', label: 'Close Tab', icon: '❌', category: 'File', shortcut: 'Ctrl+W', action: () => dispatch('command', { action: 'closeTab' }) },
    { id: 'file.closeAllTabs', label: 'Close All Tabs', icon: '❌', category: 'File', action: () => dispatch('command', { action: 'closeAllTabs' }) },
    
    // Edit Commands
    { id: 'edit.undo', label: 'Undo', icon: '↩️', category: 'Edit', shortcut: 'Ctrl+Z', action: () => dispatch('command', { action: 'undo' }) },
    { id: 'edit.redo', label: 'Redo', icon: '↪️', category: 'Edit', shortcut: 'Ctrl+Shift+Z', action: () => dispatch('command', { action: 'redo' }) },
    { id: 'edit.cut', label: 'Cut', icon: '✂️', category: 'Edit', shortcut: 'Ctrl+X', action: () => dispatch('command', { action: 'cut' }) },
    { id: 'edit.copy', label: 'Copy', icon: '📋', category: 'Edit', shortcut: 'Ctrl+C', action: () => dispatch('command', { action: 'copy' }) },
    { id: 'edit.paste', label: 'Paste', icon: '📋', category: 'Edit', shortcut: 'Ctrl+V', action: () => dispatch('command', { action: 'paste' }) },
    { id: 'edit.selectAll', label: 'Select All', icon: '🔲', category: 'Edit', shortcut: 'Ctrl+A', action: () => dispatch('command', { action: 'selectAll' }) },
    { id: 'edit.find', label: 'Find', icon: '🔍', category: 'Edit', shortcut: 'Ctrl+F', action: () => dispatch('command', { action: 'find' }) },
    { id: 'edit.replace', label: 'Replace', icon: '🔄', category: 'Edit', shortcut: 'Ctrl+H', action: () => dispatch('command', { action: 'replace' }) },
    
    // View Commands
    { id: 'view.explorer', label: 'Show Explorer', icon: '📁', category: 'View', shortcut: 'Ctrl+Shift+E', action: () => dispatch('command', { action: 'showExplorer' }), keywords: ['files', 'tree'] },
    { id: 'view.search', label: 'Show Search', icon: '🔍', category: 'View', shortcut: 'Ctrl+Shift+F', action: () => dispatch('command', { action: 'showSearch' }) },
    { id: 'view.git', label: 'Show Git', icon: '🌿', category: 'View', shortcut: 'Ctrl+Shift+G', action: () => dispatch('command', { action: 'showGit' }), keywords: ['source', 'control'] },
    { id: 'view.extensions', label: 'Show Extensions', icon: '🧩', category: 'View', shortcut: 'Ctrl+Shift+X', action: () => dispatch('command', { action: 'showExtensions' }) },
    { id: 'view.dashboard', label: 'Show Dashboard', icon: '📊', category: 'View', action: () => dispatch('command', { action: 'showDashboard' }), keywords: ['stats', 'metrics'] },
    { id: 'view.toggleSidebar', label: 'Toggle Sidebar', icon: '📐', category: 'View', shortcut: 'Ctrl+B', action: () => dispatch('command', { action: 'toggleSidebar' }) },
    { id: 'view.zoomIn', label: 'Zoom In', icon: '🔍', category: 'View', shortcut: 'Ctrl+=', action: () => dispatch('command', { action: 'zoomIn' }) },
    { id: 'view.zoomOut', label: 'Zoom Out', icon: '🔍', category: 'View', shortcut: 'Ctrl+-', action: () => dispatch('command', { action: 'zoomOut' }) },
    { id: 'view.resetZoom', label: 'Reset Zoom', icon: '🔍', category: 'View', shortcut: 'Ctrl+0', action: () => dispatch('command', { action: 'resetZoom' }) },
    
    // Terminal Commands
    { id: 'terminal.new', label: 'New Terminal', icon: '📟', category: 'Terminal', shortcut: 'Ctrl+`', action: () => dispatch('command', { action: 'newTerminal' }), keywords: ['console', 'shell'] },
    { id: 'terminal.split', label: 'Split Terminal', icon: '📟', category: 'Terminal', action: () => dispatch('command', { action: 'splitTerminal' }) },
    { id: 'terminal.clear', label: 'Clear Terminal', icon: '🧹', category: 'Terminal', action: () => dispatch('command', { action: 'clearTerminal' }) },
    { id: 'terminal.kill', label: 'Kill Terminal', icon: '🛑', category: 'Terminal', action: () => dispatch('command', { action: 'killTerminal' }) },
    { id: 'terminal.rename', label: 'Rename Terminal', icon: '✏️', category: 'Terminal', action: () => dispatch('command', { action: 'renameTerminal' }) },
    
    // Editor Commands
    { id: 'editor.formatDocument', label: 'Format Document', icon: '🎨', category: 'Editor', shortcut: 'Shift+Alt+F', action: () => dispatch('command', { action: 'formatDocument' }), keywords: ['prettier', 'beautify'] },
    { id: 'editor.toggleComment', label: 'Toggle Comment', icon: '💬', category: 'Editor', shortcut: 'Ctrl+/', action: () => dispatch('command', { action: 'toggleComment' }) },
    { id: 'editor.goToLine', label: 'Go to Line', icon: '🔢', category: 'Editor', shortcut: 'Ctrl+G', action: () => dispatch('command', { action: 'goToLine' }) },
    { id: 'editor.goToDefinition', label: 'Go to Definition', icon: '📍', category: 'Editor', shortcut: 'F12', action: () => dispatch('command', { action: 'goToDefinition' }) },
    { id: 'editor.quickFix', label: 'Quick Fix', icon: '💡', category: 'Editor', shortcut: 'Ctrl+.', action: () => dispatch('command', { action: 'quickFix' }) },
    { id: 'editor.rename', label: 'Rename Symbol', icon: '✏️', category: 'Editor', shortcut: 'F2', action: () => dispatch('command', { action: 'renameSymbol' }) },
    { id: 'editor.selectLine', label: 'Select Line', icon: '🔲', category: 'Editor', shortcut: 'Ctrl+L', action: () => dispatch('command', { action: 'selectLine' }) },
    { id: 'editor.duplicateLine', label: 'Duplicate Line', icon: '📋', category: 'Editor', shortcut: 'Shift+Alt+Down', action: () => dispatch('command', { action: 'duplicateLine' }) },
    { id: 'editor.deleteLine', label: 'Delete Line', icon: '🗑️', category: 'Editor', shortcut: 'Ctrl+Shift+K', action: () => dispatch('command', { action: 'deleteLine' }) },
    { id: 'editor.moveLineUp', label: 'Move Line Up', icon: '⬆️', category: 'Editor', shortcut: 'Alt+Up', action: () => dispatch('command', { action: 'moveLineUp' }) },
    { id: 'editor.moveLineDown', label: 'Move Line Down', icon: '⬇️', category: 'Editor', shortcut: 'Alt+Down', action: () => dispatch('command', { action: 'moveLineDown' }) },
    
    // Git Commands
    { id: 'git.status', label: 'Git: Show Status', icon: '📊', category: 'Git', action: async () => {
      if (hasGitIntegration) {
        const status = await invoke('get_all_git_statuses');
        dispatch('command', { action: 'gitStatus', data: status });
      }
    }, keywords: ['changes', 'diff'] },
    { id: 'git.branch', label: 'Git: Show Branch Info', icon: '🌿', category: 'Git', action: async () => {
      if (hasGitIntegration) {
        const branch = await invoke('get_git_branch_info');
        dispatch('command', { action: 'gitBranch', data: branch });
      }
    } },
    { id: 'git.commit', label: 'Git: Commit', icon: '💾', category: 'Git', shortcut: 'Ctrl+Enter', action: () => dispatch('command', { action: 'gitCommit' }) },
    { id: 'git.pull', label: 'Git: Pull', icon: '⬇️', category: 'Git', action: () => dispatch('command', { action: 'gitPull' }) },
    { id: 'git.push', label: 'Git: Push', icon: '⬆️', category: 'Git', action: () => dispatch('command', { action: 'gitPush' }) },
    { id: 'git.sync', label: 'Git: Sync', icon: '🔄', category: 'Git', action: () => dispatch('command', { action: 'gitSync' }) },
    { id: 'git.stage', label: 'Git: Stage Changes', icon: '➕', category: 'Git', action: () => dispatch('command', { action: 'gitStage' }) },
    { id: 'git.unstage', label: 'Git: Unstage Changes', icon: '➖', category: 'Git', action: () => dispatch('command', { action: 'gitUnstage' }) },
    { id: 'git.stash', label: 'Git: Stash Changes', icon: '📦', category: 'Git', action: () => dispatch('command', { action: 'gitStash' }) },
    { id: 'git.checkout', label: 'Git: Checkout Branch', icon: '🔀', category: 'Git', action: () => dispatch('command', { action: 'gitCheckout' }) },
    { id: 'git.merge', label: 'Git: Merge Branch', icon: '🔀', category: 'Git', action: () => dispatch('command', { action: 'gitMerge' }) },
    
    // Debug Commands
    { id: 'debug.start', label: 'Start Debugging', icon: '▶️', category: 'Debug', shortcut: 'F5', action: () => dispatch('command', { action: 'debugStart' }) },
    { id: 'debug.stop', label: 'Stop Debugging', icon: '⏹️', category: 'Debug', shortcut: 'Shift+F5', action: () => dispatch('command', { action: 'debugStop' }) },
    { id: 'debug.stepOver', label: 'Step Over', icon: '⏭️', category: 'Debug', shortcut: 'F10', action: () => dispatch('command', { action: 'debugStepOver' }) },
    { id: 'debug.stepInto', label: 'Step Into', icon: '⬇️', category: 'Debug', shortcut: 'F11', action: () => dispatch('command', { action: 'debugStepInto' }) },
    { id: 'debug.stepOut', label: 'Step Out', icon: '⬆️', category: 'Debug', shortcut: 'Shift+F11', action: () => dispatch('command', { action: 'debugStepOut' }) },
    { id: 'debug.toggleBreakpoint', label: 'Toggle Breakpoint', icon: '🔴', category: 'Debug', shortcut: 'F9', action: () => dispatch('command', { action: 'debugToggleBreakpoint' }) },
    
    // Test Commands
    { id: 'test.run', label: 'Run Tests', icon: '✅', category: 'Test', action: () => dispatch('command', { action: 'runTests' }) },
    { id: 'test.runFile', label: 'Run Tests in File', icon: '✅', category: 'Test', action: () => dispatch('command', { action: 'runTestsFile' }) },
    { id: 'test.debug', label: 'Debug Tests', icon: '🐛', category: 'Test', action: () => dispatch('command', { action: 'debugTests' }) },
    { id: 'test.coverage', label: 'Show Test Coverage', icon: '📊', category: 'Test', action: () => dispatch('command', { action: 'testCoverage' }) },
    
    // Window Commands
    { id: 'window.newWindow', label: 'New Window', icon: '🪟', category: 'Window', shortcut: 'Ctrl+Shift+N', action: () => dispatch('command', { action: 'newWindow' }) },
    { id: 'window.splitHorizontal', label: 'Split Horizontal', icon: '⬌', category: 'Window', action: () => dispatch('command', { action: 'splitHorizontal' }) },
    { id: 'window.splitVertical', label: 'Split Vertical', icon: '⬍', category: 'Window', action: () => dispatch('command', { action: 'splitVertical' }) },
    { id: 'window.fullscreen', label: 'Toggle Fullscreen', icon: '🖥️', category: 'Window', shortcut: 'F11', action: () => dispatch('command', { action: 'toggleFullscreen' }) },
    
    // Settings Commands
    { id: 'settings.open', label: 'Open Settings', icon: '⚙️', category: 'Preferences', shortcut: 'Ctrl+,', action: () => dispatch('command', { action: 'openSettings' }) },
    { id: 'settings.theme', label: 'Toggle Theme', icon: '🌓', category: 'Preferences', shortcut: 'Ctrl+K D', action: () => dispatch('command', { action: 'toggleTheme' }) },
    { id: 'settings.keyboardShortcuts', label: 'Keyboard Shortcuts', icon: '⌨️', category: 'Preferences', shortcut: 'Ctrl+K Ctrl+S', action: () => dispatch('command', { action: 'keyboardShortcuts' }) },
    { id: 'settings.colorTheme', label: 'Color Theme', icon: '🎨', category: 'Preferences', action: () => dispatch('command', { action: 'colorTheme' }) },
    { id: 'settings.fontSize', label: 'Font Size', icon: '📏', category: 'Preferences', action: () => dispatch('command', { action: 'fontSize' }) },
    
    // Help Commands
    { id: 'help.documentation', label: 'Documentation', icon: '📚', category: 'Help', action: () => dispatch('command', { action: 'documentation' }) },
    { id: 'help.releaseNotes', label: 'Release Notes', icon: '📋', category: 'Help', action: () => dispatch('command', { action: 'releaseNotes' }) },
    { id: 'help.reportIssue', label: 'Report Issue', icon: '🐛', category: 'Help', action: () => dispatch('command', { action: 'reportIssue' }) },
    { id: 'help.about', label: 'About', icon: 'ℹ️', category: 'Help', action: () => dispatch('command', { action: 'about' }) },
    
    // Trash command
    { id: 'file.trash', label: 'Open Trash Manager', icon: '🗑️', category: 'File', action: () => dispatch('command', { action: 'openTrash' }), keywords: ['deleted', 'recycle', 'bin'] },
    
    // AI Commands
    { id: 'ai.assist', label: 'AI: Assist', icon: '🤖', category: 'AI', shortcut: 'Ctrl+Enter', action: () => dispatch('command', { action: 'aiAssist' }), keywords: ['copilot', 'claude'] },
    { id: 'ai.explain', label: 'AI: Explain Code', icon: '💡', category: 'AI', action: () => dispatch('command', { action: 'aiExplain' }) },
    { id: 'ai.refactor', label: 'AI: Refactor', icon: '🔧', category: 'AI', action: () => dispatch('command', { action: 'aiRefactor' }) },
    { id: 'ai.generateTests', label: 'AI: Generate Tests', icon: '🧪', category: 'AI', action: () => dispatch('command', { action: 'aiGenerateTests' }) },
    { id: 'ai.fix', label: 'AI: Fix Issue', icon: '🔨', category: 'AI', action: () => dispatch('command', { action: 'aiFix' }) },
    
    // Project Commands
    { id: 'project.new', label: 'New Project', icon: '🆕', category: 'Project', action: () => dispatch('command', { action: 'newProject' }) },
    { id: 'project.open', label: 'Open Project', icon: '📂', category: 'Project', action: () => dispatch('command', { action: 'openProject' }) },
    { id: 'project.close', label: 'Close Project', icon: '❌', category: 'Project', action: () => dispatch('command', { action: 'closeProject' }) },
    { id: 'project.build', label: 'Build Project', icon: '🔨', category: 'Project', shortcut: 'Ctrl+Shift+B', action: () => dispatch('command', { action: 'buildProject' }) },
    { id: 'project.clean', label: 'Clean Project', icon: '🧹', category: 'Project', action: () => dispatch('command', { action: 'cleanProject' }) },
    { id: 'project.dependencies', label: 'Install Dependencies', icon: '📦', category: 'Project', action: () => dispatch('command', { action: 'installDependencies' }), keywords: ['npm', 'yarn', 'packages'] },
    
    // Workflow Commands
    { id: 'workflow.share', label: 'Share Workflow', icon: '📤', category: 'Workflow', action: () => dispatch('command', { action: 'shareWorkflow' }) },
    { id: 'workflow.export', label: 'Export Workflow', icon: '💾', category: 'Workflow', action: () => dispatch('command', { action: 'exportWorkflow' }) },
    { id: 'workflow.import', label: 'Import Workflow', icon: '📥', category: 'Workflow', action: () => dispatch('command', { action: 'importWorkflow' }) },
    
    // Agent Commands
    { id: 'agent.list', label: 'List Agents', icon: '📋', category: 'Agents', action: () => dispatch('command', { action: 'listAgents' }) },
    { id: 'agent.kill', label: 'Kill Agent', icon: '🛑', category: 'Agents', action: () => dispatch('command', { action: 'killAgent' }) },
    { id: 'agent.restart', label: 'Restart Agent', icon: '🔄', category: 'Agents', action: () => dispatch('command', { action: 'restartAgent' }) },
    { id: 'agent.logs', label: 'Show Agent Logs', icon: '📜', category: 'Agents', action: () => dispatch('command', { action: 'showAgentLogs' }) },
    
    // Navigation Commands
    { id: 'navigate.back', label: 'Navigate Back', icon: '⬅️', category: 'Navigation', shortcut: 'Alt+Left', action: () => dispatch('command', { action: 'navigateBack' }) },
    { id: 'navigate.forward', label: 'Navigate Forward', icon: '➡️', category: 'Navigation', shortcut: 'Alt+Right', action: () => dispatch('command', { action: 'navigateForward' }) },
    { id: 'navigate.lastEdit', label: 'Go to Last Edit', icon: '📍', category: 'Navigation', shortcut: 'Ctrl+Q', action: () => dispatch('command', { action: 'goToLastEdit' }) },
    { id: 'navigate.nextTab', label: 'Next Tab', icon: '→', category: 'Navigation', shortcut: 'Ctrl+Tab', action: () => dispatch('command', { action: 'nextTab' }) },
    { id: 'navigate.prevTab', label: 'Previous Tab', icon: '←', category: 'Navigation', shortcut: 'Ctrl+Shift+Tab', action: () => dispatch('command', { action: 'prevTab' }) },
    
    // Miscellaneous Commands
    { id: 'misc.reload', label: 'Reload Window', icon: '🔄', category: 'Misc', shortcut: 'Ctrl+R', action: () => dispatch('command', { action: 'reload' }) },
    { id: 'misc.devTools', label: 'Toggle Developer Tools', icon: '🔧', category: 'Misc', shortcut: 'Ctrl+Shift+I', action: () => dispatch('command', { action: 'toggleDevTools' }) },
    { id: 'misc.checkUpdates', label: 'Check for Updates', icon: '⬇️', category: 'Misc', action: () => dispatch('command', { action: 'checkUpdates' }) },
  ];
  
  // Extract unique categories
  categories = [...new Set(commands.map(cmd => cmd.category).filter(Boolean))].sort();
  
  // Initialize Fuse.js
  function initializeFuse() {
    fuse = new Fuse(commands, {
      keys: [
        { name: 'label', weight: 0.5 },
        { name: 'category', weight: 0.2 },
        { name: 'keywords', weight: 0.3 }
      ],
      threshold: 0.4,
      includeScore: true,
      useExtendedSearch: true,
      ignoreLocation: true
    });
  }
  
  // Filter commands based on search query
  function filterCommands(query: string) {
    if (!query) {
      // Show recent commands first when no query
      const recentCmds = commands.filter(cmd => recentCommands.includes(cmd.id));
      const otherCmds = commands.filter(cmd => !recentCommands.includes(cmd.id));
      
      // Filter out git commands if git is not available
      filteredCommands = [...recentCmds, ...otherCmds].filter(cmd => {
        if (cmd.category === 'Git' && !hasGitIntegration) return false;
        return true;
      });
      return;
    }
    
    const startTime = performance.now();
    
    const results = fuse.search(query);
    filteredCommands = results
      .map(result => result.item)
      .filter(cmd => {
        // Filter out git commands if git is not available
        if (cmd.category === 'Git' && !hasGitIntegration) return false;
        return true;
      });
    
    const endTime = performance.now();
    console.log(`Command palette search took ${(endTime - startTime).toFixed(2)}ms`);
  }
  
  // Handle keyboard navigation
  function handleKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, filteredCommands.length - 1);
        scrollToSelected();
        break;
      case 'ArrowUp':
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        scrollToSelected();
        break;
      case 'Enter':
        event.preventDefault();
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        close();
        break;
    }
  }
  
  function scrollToSelected() {
    const element = document.querySelector(`.command-item:nth-child(${selectedIndex + 1})`);
    element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  
  function executeCommand(command: Command) {
    command.action();
    saveRecentCommand(command.id);
    close();
  }
  
  function close() {
    show = false;
    dispatch('close');
  }
  
  $: if (show && searchInput) {
    searchInput.focus();
    searchQuery = '';
    selectedIndex = 0;
    filterCommands('');
  }
  
  $: filterCommands(searchQuery);
  
  onMount(async () => {
    await checkGitAvailability();
    loadRecentCommands();
    initializeFuse();
    
    if (show && searchInput) {
      searchInput.focus();
    }
  });
</script>

{#if show}
  <div class="command-palette-overlay" on:click={close} transition:fade={{ duration: 150 }}>
    <div class="command-palette" on:click|stopPropagation>
      <div class="search-container">
        <span class="search-icon">🔍</span>
        <input 
          bind:this={searchInput}
          bind:value={searchQuery}
          type="text" 
          placeholder="Type a command or search..."
          class="command-input"
          on:keydown={handleKeydown}
          autocomplete="off"
          spellcheck="false"
        />
        <kbd class="shortcut-hint">esc</kbd>
      </div>
      
      <div class="command-list">
        {#if filteredCommands.length === 0}
          <div class="no-results">
            No commands found for "{searchQuery}"
          </div>
        {:else}
          {#each filteredCommands as command, index}
            <button
              class="command-item"
              class:selected={index === selectedIndex}
              on:click={() => executeCommand(command)}
              on:mouseenter={() => selectedIndex = index}
            >
              {#if command.icon}
                <span class="command-icon">{command.icon}</span>
              {/if}
              <span class="command-content">
                <span class="command-label">{command.label}</span>
                {#if command.category}
                  <span class="command-category">{command.category}</span>
                {/if}
              </span>
              {#if command.shortcut}
                <span class="command-shortcut">{command.shortcut}</span>
              {/if}
            </button>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .command-palette-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 10vh;
    z-index: 3000;
  }
  
  .command-palette {
    width: 90%;
    max-width: 640px;
    max-height: 70vh;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
  }
  
  .search-container {
    display: flex;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid var(--border);
    gap: 12px;
  }
  
  .search-icon {
    font-size: 20px;
    opacity: 0.6;
  }
  
  .command-input {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--fg-primary);
    font-size: 16px;
    outline: none;
  }
  
  .command-input::placeholder {
    color: var(--fg-tertiary);
  }
  
  .shortcut-hint {
    font-size: 12px;
    padding: 2px 6px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--fg-secondary);
  }
  
  .command-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }
  
  .no-results {
    text-align: center;
    padding: 40px;
    color: var(--fg-tertiary);
    font-size: 14px;
  }
  
  .command-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    width: 100%;
    background: none;
    border: none;
    color: var(--fg-primary);
    text-align: left;
    cursor: pointer;
    transition: background 0.1s;
  }
  
  .command-item:hover {
    background: var(--bg-hover);
  }
  
  .command-item.selected {
    background: var(--bg-tertiary);
  }
  
  .command-icon {
    font-size: 18px;
    width: 24px;
    text-align: center;
  }
  
  .command-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  
  .command-label {
    font-size: 14px;
    font-weight: 500;
  }
  
  .command-category {
    font-size: 12px;
    color: var(--fg-secondary);
  }
  
  .command-shortcut {
    font-size: 12px;
    color: var(--fg-tertiary);
    background: var(--bg-tertiary);
    padding: 2px 6px;
    border-radius: 4px;
    margin-left: auto;
  }
  
  /* Custom scrollbar */
  .command-list::-webkit-scrollbar {
    width: 8px;
  }
  
  .command-list::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .command-list::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 4px;
  }
  
  .command-list::-webkit-scrollbar-thumb:hover {
    background: var(--fg-tertiary);
  }
</style>