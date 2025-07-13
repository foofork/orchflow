/**
 * Integration Tests for Tauri API Interactions
 * 
 * Tests real Tauri API calls with mocked backend responses
 * to ensure proper integration between frontend and Tauri core.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tauriAPI, fileSystemMock, terminalMock, storeMocks } from '../../test/setup-integration';
import { mockRegistry, createMock } from '../../test/utils/mock-registry';

// Mock components for testing integration flows
const MockTauriTerminal = `
<script>
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { Command } from '@tauri-apps/plugin-shell';
  
  export let command = '';
  let output = '';
  let isRunning = false;
  
  async function runCommand() {
    if (!command.trim()) return;
    
    isRunning = true;
    output = '';
    
    try {
      const cmd = new Command(command);
      const result = await cmd.execute();
      output = result.stdout || result.stderr || 'Command completed';
    } catch (error) {
      output = 'Error: ' + error.message;
    } finally {
      isRunning = false;
    }
  }
</script>

<div class="tauri-terminal">
  <input 
    bind:value={command} 
    placeholder="Enter command..."
    data-testid="command-input"
  />
  <button 
    on:click={runCommand} 
    disabled={isRunning}
    data-testid="run-button"
  >
    {isRunning ? 'Running...' : 'Run'}
  </button>
  <pre data-testid="output">{output}</pre>
</div>
`;

const MockFileManager = `
<script>
  import { readFile, writeFile, exists } from '@tauri-apps/plugin-fs';
  
  export let fileName = '';
  let fileContent = '';
  let status = '';
  
  async function loadFile() {
    if (!fileName) return;
    
    try {
      const fileExists = await exists(fileName);
      if (!fileExists) {
        status = 'File not found';
        return;
      }
      
      const data = await readFile(fileName);
      fileContent = new TextDecoder().decode(data);
      status = 'File loaded successfully';
    } catch (error) {
      status = 'Error loading file: ' + error.message;
    }
  }
  
  async function saveFile() {
    if (!fileName || !fileContent) return;
    
    try {
      const data = new TextEncoder().encode(fileContent);
      await writeFile(fileName, data);
      status = 'File saved successfully';
    } catch (error) {
      status = 'Error saving file: ' + error.message;
    }
  }
</script>

<div class="file-manager">
  <input 
    bind:value={fileName} 
    placeholder="File path..."
    data-testid="file-path"
  />
  <button on:click={loadFile} data-testid="load-button">Load</button>
  <button on:click={saveFile} data-testid="save-button">Save</button>
  <textarea 
    bind:value={fileContent} 
    placeholder="File content..."
    data-testid="file-content"
  ></textarea>
  <div data-testid="status">{status}</div>
</div>
`;

const MockFlowRunner = `
<script>
  import { invoke } from '@tauri-apps/api/core';
  
  export let flowId = null;
  let flows = [];
  let selectedFlow = null;
  let isRunning = false;
  let result = null;
  
  async function loadFlows() {
    try {
      flows = await invoke('get_flows');
    } catch (error) {
      console.error('Failed to load flows:', error);
    }
  }
  
  async function runFlow() {
    if (!selectedFlow) return;
    
    isRunning = true;
    result = null;
    
    try {
      result = await invoke('run_flow', { flowId: selectedFlow.id });
    } catch (error) {
      result = { error: error.message };
    } finally {
      isRunning = false;
    }
  }
  
  // Load flows on mount
  loadFlows();
</script>

<div class="flow-runner">
  <select bind:value={selectedFlow} data-testid="flow-select">
    <option value={null}>Select a flow...</option>
    {#each flows as flow}
      <option value={flow}>{flow.name}</option>
    {/each}
  </select>
  
  <button 
    on:click={runFlow} 
    disabled={!selectedFlow || isRunning}
    data-testid="run-flow-button"
  >
    {isRunning ? 'Running...' : 'Run Flow'}
  </button>
  
  {#if result}
    <div data-testid="flow-result">
      {JSON.stringify(result, null, 2)}
    </div>
  {/if}
</div>
`;

describe('Tauri API Integration Tests', () => {
  beforeEach(() => {
    // Clear mocks and setup fresh state
    mockRegistry.reset();
    fileSystemMock._clear();
  });

  afterEach(() => {
    mockRegistry.clearCalls();
  });

  describe('Terminal Integration', () => {
    it('should execute shell commands through Tauri', async () => {
      // Create a mock component render function
      const mockTerminal = {
        render: ({ command = 'echo "test"' } = {}) => {
          const container = document.createElement('div');
          container.innerHTML = `
            <input data-testid="command-input" value="${command}" />
            <button data-testid="run-button">Run</button>
            <pre data-testid="output"></pre>
          `;
          
          const runButton = container.querySelector('[data-testid="run-button"]');
          const output = container.querySelector('[data-testid="output"]');
          
          runButton?.addEventListener('click', async () => {
            const cmd = terminalMock.spawn();
            cmd.write(command);
            
            // Simulate command execution
            setTimeout(() => {
              if (output) {
                output.textContent = `Executing: ${command}\nOutput from command\n`;
              }
            }, 100);
          });
          
          return { container };
        }
      };

      const { container } = mockTerminal.render();
      document.body.appendChild(container);

      const runButton = container.querySelector('[data-testid="run-button"]') as HTMLButtonElement;
      const output = container.querySelector('[data-testid="output"]') as HTMLPreElement;

      // Execute command
      runButton.click();

      // Wait for command execution
      await waitFor(() => {
        expect(output.textContent).toContain('Hello World');
      }, { timeout: 1000 });

      // Verify terminal mock was called
      expect(terminalMock.spawn).toHaveBeenCalled();
    });

    it('should handle command errors gracefully', async () => {
      // Setup terminal mock to simulate error
      terminalMock.spawn.mockImplementation(() => {
        const listeners = new Map();
        return {
          on: (event: string, handler: Function) => {
            if (!listeners.has(event)) {
              listeners.set(event, new Set());
            }
            listeners.get(event).add(handler);
          },
          write: (data: string) => {
            setTimeout(() => {
              if (data.includes('invalid-command')) {
                listeners.get('error')?.forEach((handler: Function) => 
                  handler(new Error('Command not found'))
                );
              }
            }, 50);
          },
          kill: vi.fn()
        };
      });

      const mockTerminal = {
        render: () => {
          const container = document.createElement('div');
          container.innerHTML = `
            <button data-testid="error-button">Run Invalid Command</button>
            <pre data-testid="error-output"></pre>
          `;
          
          const errorButton = container.querySelector('[data-testid="error-button"]');
          const errorOutput = container.querySelector('[data-testid="error-output"]');
          
          errorButton?.addEventListener('click', async () => {
            const cmd = terminalMock.spawn();
            cmd.on('error', (error: Error) => {
              if (errorOutput) {
                errorOutput.textContent = `Error: ${error.message}`;
              }
            });
            cmd.write('invalid-command');
          });
          
          return { container };
        }
      };

      const container = document.createElement('div');
      container.innerHTML = '<div data-testid="api-explorer"></div>';
      document.body.appendChild(container);

      const errorButton = container.querySelector('[data-testid="error-button"]') as HTMLButtonElement;
      const errorOutput = container.querySelector('[data-testid="error-output"]') as HTMLPreElement;

      errorButton.click();

      await waitFor(() => {
        expect(errorOutput.textContent).toContain('Command not found');
      });
    });
  });

  describe('File System Integration', () => {
    it('should read and write files through Tauri FS API', async () => {
      // Setup test file
      fileSystemMock._setFile('/test/sample.txt', 'Initial content');

      const mockFileManager = {
        render: () => {
          const container = document.createElement('div');
          container.innerHTML = `
            <input data-testid="file-path" value="/test/sample.txt" />
            <button data-testid="load-button">Load</button>
            <button data-testid="save-button">Save</button>
            <textarea data-testid="file-content"></textarea>
            <div data-testid="status"></div>
          `;
          
          const loadButton = container.querySelector('[data-testid="load-button"]');
          const saveButton = container.querySelector('[data-testid="save-button"]');
          const fileContent = container.querySelector('[data-testid="file-content"]') as HTMLTextAreaElement;
          const status = container.querySelector('[data-testid="status"]');
          
          loadButton?.addEventListener('click', async () => {
            try {
              const data = await fileSystemMock.readFile('/test/sample.txt');
              fileContent.value = new TextDecoder().decode(data);
              if (status) status.textContent = 'File loaded successfully';
            } catch (error) {
              if (status) status.textContent = `Error: ${(error as Error).message}`;
            }
          });
          
          saveButton?.addEventListener('click', async () => {
            try {
              const data = new TextEncoder().encode(fileContent.value);
              await fileSystemMock.writeFile('/test/sample.txt', data);
              if (status) status.textContent = 'File saved successfully';
            } catch (error) {
              if (status) status.textContent = `Error: ${(error as Error).message}`;
            }
          });
          
          return { container };
        }
      };

      const { container } = mockFileManager.render();
      document.body.appendChild(container);

      const loadButton = container.querySelector('[data-testid="load-button"]') as HTMLButtonElement;
      const saveButton = container.querySelector('[data-testid="save-button"]') as HTMLButtonElement;
      const fileContent = container.querySelector('[data-testid="file-content"]') as HTMLTextAreaElement;
      const status = container.querySelector('[data-testid="status"]') as HTMLDivElement;

      // Load file
      loadButton.click();
      await waitFor(() => {
        expect(fileContent.value).toBe('Initial content');
        expect(status.textContent).toBe('File loaded successfully');
      });

      // Modify and save
      fireEvent.input(fileContent, { target: { value: 'Modified content' } });
      saveButton.click();
      
      await waitFor(() => {
        expect(status.textContent).toBe('File saved successfully');
      });

      // Verify file was saved
      expect(fileSystemMock.writeFile).toHaveBeenCalledWith(
        '/test/sample.txt',
        expect.any(Uint8Array)
      );
    });

    it('should handle file system errors appropriately', async () => {
      const mockFileManager = {
        render: () => {
          const container = document.createElement('div');
          container.innerHTML = `
            <button data-testid="load-nonexistent">Load Nonexistent</button>
            <div data-testid="error-status"></div>
          `;
          
          const loadButton = container.querySelector('[data-testid="load-nonexistent"]');
          const errorStatus = container.querySelector('[data-testid="error-status"]');
          
          loadButton?.addEventListener('click', async () => {
            try {
              await fileSystemMock.readFile('/nonexistent/file.txt');
            } catch (error) {
              if (errorStatus) {
                errorStatus.textContent = `Error: ${(error as Error).message}`;
              }
            }
          });
          
          return { container };
        }
      };

      const { container } = mockFileManager.render();
      document.body.appendChild(container);

      const loadButton = container.querySelector('[data-testid="load-nonexistent"]') as HTMLButtonElement;
      const errorStatus = container.querySelector('[data-testid="error-status"]') as HTMLDivElement;

      loadButton.click();

      await waitFor(() => {
        expect(errorStatus.textContent).toContain('File not found');
      });
    });
  });

  describe('Flow Management Integration', () => {
    it('should create and execute flows through Tauri backend', async () => {
      const mockFlowRunner = {
        render: () => {
          const container = document.createElement('div');
          container.innerHTML = `
            <select data-testid="flow-select">
              <option value="">Select a flow...</option>
            </select>
            <button data-testid="run-flow-button" disabled>Run Flow</button>
            <div data-testid="flow-result"></div>
          `;
          
          const flowSelect = container.querySelector('[data-testid="flow-select"]') as HTMLSelectElement;
          const runButton = container.querySelector('[data-testid="run-flow-button"]') as HTMLButtonElement;
          const resultDiv = container.querySelector('[data-testid="flow-result"]') as HTMLDivElement;
          
          // Load flows on initialization
          tauriAPI.invoke('get_flows').then((flows: any[]) => {
            flows.forEach(flow => {
              const option = document.createElement('option');
              option.value = flow.id.toString();
              option.textContent = flow.name;
              flowSelect.appendChild(option);
            });
          });
          
          flowSelect.addEventListener('change', () => {
            runButton.disabled = !flowSelect.value;
          });
          
          runButton.addEventListener('click', async () => {
            if (!flowSelect.value) return;
            
            runButton.disabled = true;
            runButton.textContent = 'Running...';
            
            try {
              const result = await tauriAPI.invoke('run_flow', { 
                flowId: parseInt(flowSelect.value) 
              });
              resultDiv.textContent = JSON.stringify(result, null, 2);
            } catch (error) {
              resultDiv.textContent = `Error: ${(error as Error).message}`;
            } finally {
              runButton.disabled = false;
              runButton.textContent = 'Run Flow';
            }
          });
          
          return { container };
        }
      };

      const { container } = mockFlowRunner.render();
      document.body.appendChild(container);

      const flowSelect = container.querySelector('[data-testid="flow-select"]') as HTMLSelectElement;
      const runButton = container.querySelector('[data-testid="run-flow-button"]') as HTMLButtonElement;
      const resultDiv = container.querySelector('[data-testid="flow-result"]') as HTMLDivElement;

      // Wait for flows to load
      await waitFor(() => {
        expect(flowSelect.children.length).toBeGreaterThan(1);
      });

      // Select a flow
      fireEvent.change(flowSelect, { target: { value: '1' } });
      expect(runButton.disabled).toBe(false);

      // Run the flow
      runButton.click();

      await waitFor(() => {
        expect(resultDiv.textContent).toContain('running');
        expect(tauriAPI.invoke).toHaveBeenCalledWith('run_flow', { flowId: 1 });
      });
    });
  });

  describe('Cross-Component Integration', () => {
    it('should coordinate between file manager and terminal', async () => {
      // Setup a script file
      fileSystemMock._setFile('/scripts/test.sh', '#!/bin/bash\necho "Script executed"');

      const mockIntegratedApp = {
        render: () => {
          const container = document.createElement('div');
          container.innerHTML = `
            <div class="file-section">
              <input data-testid="script-path" value="/scripts/test.sh" />
              <button data-testid="load-script">Load Script</button>
              <textarea data-testid="script-content"></textarea>
            </div>
            <div class="terminal-section">
              <button data-testid="run-script">Run Script</button>
              <pre data-testid="script-output"></pre>
            </div>
          `;
          
          const scriptPath = container.querySelector('[data-testid="script-path"]') as HTMLInputElement;
          const loadScript = container.querySelector('[data-testid="load-script"]') as HTMLButtonElement;
          const scriptContent = container.querySelector('[data-testid="script-content"]') as HTMLTextAreaElement;
          const runScript = container.querySelector('[data-testid="run-script"]') as HTMLButtonElement;
          const scriptOutput = container.querySelector('[data-testid="script-output"]') as HTMLPreElement;
          
          loadScript.addEventListener('click', async () => {
            try {
              const data = await fileSystemMock.readFile(scriptPath.value);
              scriptContent.value = new TextDecoder().decode(data);
            } catch (error) {
              scriptContent.value = `Error loading script: ${(error as Error).message}`;
            }
          });
          
          runScript.addEventListener('click', async () => {
            if (!scriptContent.value) return;
            
            const cmd = terminalMock.spawn();
            cmd.on('data', (data: string) => {
              scriptOutput.textContent += data;
            });
            cmd.write(`bash ${scriptPath.value}`);
          });
          
          return { container };
        }
      };

      const { container } = mockIntegratedApp.render();
      document.body.appendChild(container);

      const loadScript = container.querySelector('[data-testid="load-script"]') as HTMLButtonElement;
      const scriptContent = container.querySelector('[data-testid="script-content"]') as HTMLTextAreaElement;
      const runScript = container.querySelector('[data-testid="run-script"]') as HTMLButtonElement;
      const scriptOutput = container.querySelector('[data-testid="script-output"]') as HTMLPreElement;

      // Load script
      loadScript.click();
      await waitFor(() => {
        expect(scriptContent.value).toContain('echo "Script executed"');
      });

      // Run script
      runScript.click();
      await waitFor(() => {
        expect(scriptOutput.textContent).toContain('Executing');
      });

      // Verify both file system and terminal were used
      expect(fileSystemMock.readFile).toHaveBeenCalledWith('/scripts/test.sh');
      expect(terminalMock.spawn).toHaveBeenCalled();
    });
  });
});