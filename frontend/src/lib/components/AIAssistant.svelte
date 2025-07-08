<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  
  export let filePath: string = '';
  export let instanceId: string = '';
  export let selection: { start: number; end: number; text: string } | null = null;
  
  const dispatch = createEventDispatcher();
  
  interface DiffChunk {
    type: 'add' | 'remove' | 'unchanged';
    content: string;
    lineNumber?: number;
  }
  
  let prompt = '';
  let isStreaming = false;
  let streamedResponse = '';
  let diffChunks: DiffChunk[] = [];
  let showDiff = false;
  let aiPanel: HTMLDivElement;
  let promptInput: HTMLTextAreaElement;
  let abortController: AbortController | null = null;
  
  // AI models available
  const models = [
    { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'anthropic' },
    { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'anthropic' },
    { id: 'gpt-4', name: 'GPT-4', provider: 'openai' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai' },
  ];
  
  let selectedModel = models[0];
  
  // Common prompts
  const quickPrompts = [
    { icon: '💡', label: 'Explain', prompt: 'Explain this code' },
    { icon: '🔧', label: 'Refactor', prompt: 'Refactor this code to be more efficient' },
    { icon: '🐛', label: 'Fix', prompt: 'Fix any issues in this code' },
    { icon: '📝', label: 'Document', prompt: 'Add documentation comments' },
    { icon: '🧪', label: 'Tests', prompt: 'Generate unit tests for this code' },
    { icon: '🎨', label: 'Style', prompt: 'Improve code style and formatting' },
    { icon: '🔒', label: 'Security', prompt: 'Review for security issues' },
    { icon: '⚡', label: 'Optimize', prompt: 'Optimize for performance' },
  ];
  
  async function handleSubmit() {
    if (!prompt.trim() || isStreaming) return;
    
    isStreaming = true;
    streamedResponse = '';
    diffChunks = [];
    showDiff = false;
    abortController = new AbortController();
    
    try {
      // Get current file content and selection
      let fileContent = '';
      if ('__TAURI__' in window) {
        const { invoke } = await import('@tauri-apps/api/tauri');
        fileContent = await invoke('nvim_get_buffer_content', { instanceId });
      }
      const context = {
        filePath,
        content: fileContent,
        selection: selection || undefined,
        model: selectedModel.id,
        prompt: prompt.trim()
      };
      
      // Send the request and handle streaming response
      const response = await fetch('/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context),
        signal: abortController.signal
      });
      
      if (!response.ok) {
        throw new Error(`AI request failed: ${response.statusText}`);
      }
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error('No response body');
      }
      
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Process complete lines
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'token') {
                streamedResponse += data.content;
              } else if (data.type === 'diff') {
                diffChunks = parseDiff(data.diff);
                showDiff = true;
              } else if (data.type === 'complete') {
                isStreaming = false;
              } else if (data.type === 'error') {
                console.error('AI Error:', data.error);
                isStreaming = false;
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
        
        // Keep the last incomplete line in buffer
        buffer = lines[lines.length - 1];
      }
      
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('AI request failed:', error);
      }
      isStreaming = false;
    }
  }
  
  function parseDiff(diff: string): DiffChunk[] {
    const lines = diff.split('\n');
    const chunks: DiffChunk[] = [];
    let currentLine = 1;
    
    for (const line of lines) {
      if (line.startsWith('+')) {
        chunks.push({ 
          type: 'add', 
          content: line.substring(1),
          lineNumber: currentLine
        });
        currentLine++;
      } else if (line.startsWith('-')) {
        chunks.push({ 
          type: 'remove', 
          content: line.substring(1),
          lineNumber: currentLine
        });
      } else if (line.startsWith('@@')) {
        // Parse line number from diff header
        const match = line.match(/@@ -\d+,\d+ \+(\d+),\d+ @@/);
        if (match) {
          currentLine = parseInt(match[1]);
        }
      } else if (line.length > 0) {
        chunks.push({ 
          type: 'unchanged', 
          content: line,
          lineNumber: currentLine
        });
        currentLine++;
      }
    }
    
    return chunks;
  }
  
  async function applyDiff() {
    if (!diffChunks.length) return;
    
    try {
      // Convert diff chunks to Neovim commands
      const commands: string[] = [];
      const additions = diffChunks.filter(c => c.type === 'add');
      const deletions = diffChunks.filter(c => c.type === 'remove');
      
      // Apply deletions first (in reverse order)
      for (const chunk of deletions.reverse()) {
        if (chunk.lineNumber) {
          commands.push(`:${chunk.lineNumber}d`);
        }
      }
      
      // Then apply additions
      for (const chunk of additions) {
        if (chunk.lineNumber) {
          commands.push(`:${chunk.lineNumber - 1}a`);
          commands.push(chunk.content);
          commands.push('.');
        }
      }
      
      // Execute commands in Neovim
      if ('__TAURI__' in window) {
        const { invoke } = await import('@tauri-apps/api/tauri');
        for (const cmd of commands) {
          await invoke('nvim_execute_command', { instanceId, command: cmd });
        }
      }
      
      dispatch('applied');
      showDiff = false;
      
    } catch (error) {
      console.error('Failed to apply diff:', error);
    }
  }
  
  function cancelStream() {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    isStreaming = false;
  }
  
  function useQuickPrompt(quickPrompt: typeof quickPrompts[0]) {
    prompt = quickPrompt.prompt;
    promptInput.focus();
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleSubmit();
    } else if (event.key === 'Escape' && isStreaming) {
      cancelStream();
    }
  }
  
  onMount(() => {
    if (promptInput) {
      promptInput.focus();
    }
  });
  
  onDestroy(() => {
    cancelStream();
  });
</script>

<div class="ai-assistant" bind:this={aiPanel}>
  <div class="ai-header">
    <h3>AI Assistant</h3>
    <div class="ai-controls">
      <select bind:value={selectedModel} class="model-select">
        {#each models as model}
          <option value={model}>{model.name}</option>
        {/each}
      </select>
      <button class="close-btn" on:click={() => dispatch('close')}>✕</button>
    </div>
  </div>
  
  <div class="quick-prompts">
    {#each quickPrompts as qp}
      <button 
        class="quick-prompt-btn"
        on:click={() => useQuickPrompt(qp)}
        title={qp.prompt}
      >
        <span class="quick-icon">{qp.icon}</span>
        <span class="quick-label">{qp.label}</span>
      </button>
    {/each}
  </div>
  
  <div class="ai-content">
    {#if streamedResponse}
      <div class="response-section" transition:slide>
        <h4>Response</h4>
        <div class="response-content">
          {streamedResponse}
          {#if isStreaming}
            <span class="cursor">▊</span>
          {/if}
        </div>
      </div>
    {/if}
    
    {#if showDiff && diffChunks.length > 0}
      <div class="diff-section" transition:slide>
        <div class="diff-header">
          <h4>Suggested Changes</h4>
          <button class="apply-btn" on:click={applyDiff}>
            Apply Changes
          </button>
        </div>
        <div class="diff-content">
          {#each diffChunks as chunk}
            <div class="diff-line {chunk.type}">
              {#if chunk.lineNumber}
                <span class="line-number">{chunk.lineNumber}</span>
              {/if}
              <span class="diff-marker">
                {chunk.type === 'add' ? '+' : chunk.type === 'remove' ? '-' : ' '}
              </span>
              <span class="diff-text">{chunk.content}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
  
  <div class="ai-input">
    <textarea
      bind:this={promptInput}
      bind:value={prompt}
      placeholder="Ask about this code... (Ctrl+Enter to send)"
      on:keydown={handleKeydown}
      disabled={isStreaming}
      rows="3"
    ></textarea>
    <div class="input-actions">
      {#if isStreaming}
        <button class="cancel-btn" on:click={cancelStream}>
          Cancel
        </button>
      {:else}
        <button 
          class="send-btn" 
          on:click={handleSubmit}
          disabled={!prompt.trim()}
        >
          Send
        </button>
      {/if}
    </div>
  </div>
  
  {#if selection}
    <div class="selection-info">
      <span class="selection-icon">📍</span>
      Selected: Lines {selection.start}-{selection.end}
    </div>
  {/if}
</div>

<style>
  .ai-assistant {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-secondary);
    border-left: 1px solid var(--border);
  }
  
  .ai-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }
  
  .ai-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }
  
  .ai-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .model-select {
    padding: 4px 8px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--fg-primary);
    font-size: 12px;
    outline: none;
  }
  
  .close-btn {
    background: none;
    border: none;
    color: var(--fg-tertiary);
    font-size: 20px;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s;
  }
  
  .close-btn:hover {
    background: var(--bg-hover);
    color: var(--fg-primary);
  }
  
  .quick-prompts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 12px;
    border-bottom: 1px solid var(--border);
  }
  
  .quick-prompt-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--fg-primary);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .quick-prompt-btn:hover {
    background: var(--bg-hover);
    border-color: var(--accent);
  }
  
  .quick-icon {
    font-size: 14px;
  }
  
  .quick-label {
    font-weight: 500;
  }
  
  .ai-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }
  
  .response-section,
  .diff-section {
    margin-bottom: 20px;
  }
  
  .response-section h4,
  .diff-header h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--fg-secondary);
  }
  
  .response-content {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 12px;
    font-size: 13px;
    line-height: 1.6;
    white-space: pre-wrap;
  }
  
  .cursor {
    animation: blink 1s infinite;
  }
  
  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }
  
  .diff-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  
  .apply-btn {
    padding: 6px 12px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .apply-btn:hover {
    background: var(--accent-hover);
  }
  
  .diff-content {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
    font-family: 'Menlo', 'Monaco', monospace;
    font-size: 12px;
  }
  
  .diff-line {
    display: flex;
    padding: 4px 0;
    border-bottom: 1px solid var(--border);
  }
  
  .diff-line:last-child {
    border-bottom: none;
  }
  
  .diff-line.add {
    background: rgba(46, 160, 67, 0.15);
  }
  
  .diff-line.remove {
    background: rgba(248, 81, 73, 0.15);
  }
  
  .line-number {
    width: 40px;
    padding: 0 8px;
    text-align: right;
    color: var(--fg-tertiary);
    flex-shrink: 0;
  }
  
  .diff-marker {
    width: 20px;
    text-align: center;
    font-weight: bold;
  }
  
  .diff-line.add .diff-marker {
    color: var(--success);
  }
  
  .diff-line.remove .diff-marker {
    color: var(--error);
  }
  
  .diff-text {
    flex: 1;
    padding-right: 8px;
    white-space: pre-wrap;
  }
  
  .ai-input {
    border-top: 1px solid var(--border);
    padding: 16px;
  }
  
  .ai-input textarea {
    width: 100%;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 12px;
    color: var(--fg-primary);
    font-size: 14px;
    resize: vertical;
    min-height: 60px;
    outline: none;
  }
  
  .ai-input textarea:focus {
    border-color: var(--accent);
  }
  
  .ai-input textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .input-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
  }
  
  .send-btn,
  .cancel-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .send-btn {
    background: var(--accent);
    color: white;
  }
  
  .send-btn:hover:not(:disabled) {
    background: var(--accent-hover);
  }
  
  .send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .cancel-btn {
    background: var(--error);
    color: white;
  }
  
  .cancel-btn:hover {
    background: var(--error-hover);
  }
  
  .selection-info {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: var(--bg-tertiary);
    border-top: 1px solid var(--border);
    font-size: 12px;
    color: var(--fg-secondary);
  }
  
  .selection-icon {
    font-size: 14px;
  }
</style>