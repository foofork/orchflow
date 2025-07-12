<script lang="ts">
  import { manager, activeSession, plugins } from '$lib/stores/manager';
  
  let input = '';
  let suggestions: string[] = [];
  let selectedSuggestion = -1;
  let loading = false;
  let showSuggestions = false;
  
  // Common commands that can be suggested
  const commonCommands = [
    'create terminal',
    'create session',
    'list sessions',
    'list plugins',
    'search project',
    'get file tree',
    'run tests',
    'start dev server',
    'build project',
    'git status',
    'docker ps',
    'kubectl get pods'
  ];
  
  async function handleSubmit() {
    if (!input.trim() || loading) return;
    
    loading = true;
    try {
      // Parse the command and execute appropriate action
      const trimmedInput = input.trim();
      const command = trimmedInput.toLowerCase();
      
      if (command === 'create terminal' || command === 'new terminal') {
        const session = $activeSession;
        if (session) {
          await manager.createTerminal(session.id, { name: 'Terminal' });
        } else {
          console.error('No active session');
        }
      }
      else if (command === 'create session' || command === 'new session') {
        const name = prompt('Session name:') || 'New Session';
        await manager.createSession(name);
      }
      else if (command === 'list sessions') {
        await manager.refreshSessions();
      }
      else if (command === 'list plugins') {
        await manager.refreshPlugins();
        console.log('Available plugins:', $plugins);
      }
      else if (command.startsWith('search ')) {
        const query = trimmedInput.substring(7);
        const results = await manager.searchProject(query);
        console.log('Search results:', results);
      }
      else if (command === 'get file tree' || command === 'file tree') {
        const tree = await manager.listDirectory('/');
        console.log('File tree:', tree);
      }
      else {
        // Try to execute as a plugin command
        const [pluginCmd, ...args] = command.split(' ');
        
        // Check if it's a plugin command (format: plugin.command)
        if (pluginCmd.includes('.')) {
          const [pluginId, cmdName] = pluginCmd.split('.');
          // Note: Manager doesn't have executePluginCommand yet
          // This would need to be implemented in the manager API
          console.log('Plugin commands not yet implemented in manager');
        }
        else {
          // Default: create a terminal and run the command
          const session = $activeSession;
          if (session) {
            const pane = await manager.createTerminal(session.id, { command });
            // Send the command to the terminal
            if (pane) {
              await manager.sendInput(pane.id, command + '\n');
            }
            console.log('Created terminal with command:', command);
          }
        }
      }
      
      input = '';
      suggestions = [];
      showSuggestions = false;
    } catch (error) {
      console.error('Failed to execute command:', error);
      // TODO: Show error toast
    } finally {
      loading = false;
    }
  }
  
  function fetchSuggestions() {
    if (input.length < 2) {
      suggestions = [];
      showSuggestions = false;
      return;
    }
    
    const lowerInput = input.toLowerCase();
    
    // Filter common commands
    suggestions = commonCommands.filter(cmd => 
      cmd.toLowerCase().includes(lowerInput)
    );
    
    // Add dynamic suggestions based on input
    if (lowerInput.startsWith('git')) {
      suggestions.push('git.status', 'git.commit', 'git.push', 'git.pull');
    }
    else if (lowerInput.startsWith('docker')) {
      suggestions.push('docker.ps', 'docker.images', 'docker.logs');
    }
    else if (lowerInput.startsWith('k8s') || lowerInput.startsWith('kubectl')) {
      suggestions.push('k8s.getPods', 'k8s.getServices', 'k8s.logs');
    }
    
    showSuggestions = suggestions.length > 0;
  }
  
  function handleKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (showSuggestions && selectedSuggestion < suggestions.length - 1) {
          selectedSuggestion++;
        }
        break;
        
      case 'ArrowUp':
        event.preventDefault();
        if (showSuggestions && selectedSuggestion > -1) {
          selectedSuggestion--;
        }
        break;
        
      case 'Enter':
        if (selectedSuggestion >= 0 && showSuggestions) {
          event.preventDefault();
          selectSuggestion(selectedSuggestion);
        }
        break;
        
      case 'Escape':
        showSuggestions = false;
        selectedSuggestion = -1;
        break;
    }
  }
  
  function selectSuggestion(index: number) {
    input = suggestions[index];
    suggestions = [];
    showSuggestions = false;
    selectedSuggestion = -1;
    handleSubmit();
  }
  
  let debounceTimer: NodeJS.Timeout;
  
  function handleInput() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fetchSuggestions, 300);
  }
  
  function handleFocus() {
    if (suggestions.length > 0) {
      showSuggestions = true;
    }
  }
  
  function handleBlur() {
    // Delay to allow click on suggestion
    setTimeout(() => {
      showSuggestions = false;
    }, 200);
  }
</script>

<div class="command-bar">
  <form on:submit|preventDefault={handleSubmit}>
    <div class="input-wrapper">
      <span class="prompt">›</span>
      <input
        type="text"
        bind:value={input}
        on:input={handleInput}
        on:keydown={handleKeydown}
        on:focus={handleFocus}
        on:blur={handleBlur}
        placeholder="Type a command... (e.g., 'create terminal', 'search TODO', 'git.status')"
        disabled={loading}
        autocomplete="off"
      />
      {#if loading}
        <div class="spinner" />
      {/if}
    </div>
  </form>
  
  {#if showSuggestions && suggestions.length > 0}
    <div class="suggestions">
      {#each suggestions as suggestion, i}
        <button
          class="suggestion"
          class:selected={i === selectedSuggestion}
          on:click={() => selectSuggestion(i)}
        >
          {suggestion}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .command-bar {
    position: relative;
    background: #2d2d30;
    border: 1px solid #3e3e42;
    border-radius: 8px;
    overflow: visible;
  }
  
  .input-wrapper {
    display: flex;
    align-items: center;
    padding: 0 15px;
    height: 48px;
  }
  
  .prompt {
    color: #007acc;
    font-size: 18px;
    font-weight: 600;
    margin-right: 10px;
  }
  
  input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: #d4d4d4;
    font-size: 16px;
    font-family: inherit;
  }
  
  input::placeholder {
    color: #6b7280;
  }
  
  input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid #3e3e42;
    border-top-color: #007acc;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background: #252526;
    border: 1px solid #3e3e42;
    border-radius: 8px;
    overflow: hidden;
    z-index: 100;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  }
  
  .suggestion {
    display: block;
    width: 100%;
    padding: 10px 15px;
    text-align: left;
    background: none;
    border: none;
    color: #d4d4d4;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .suggestion:hover,
  .suggestion.selected {
    background: #37373d;
  }
  
  .suggestion.selected {
    color: #007acc;
  }
</style>