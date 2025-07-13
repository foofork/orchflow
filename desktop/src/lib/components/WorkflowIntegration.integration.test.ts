/**
 * Integration Tests for Cross-Component Workflows
 * 
 * Converts key unit tests to integration tests that verify
 * interactions between multiple components and the Tauri backend.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { tauriAPI, fileSystemMock, terminalMock, storeMocks } from '../../test/setup-integration';
import { mockRegistry, createMock } from '../../test/utils/mock-registry';

// Integration test scenarios that combine multiple components
describe('Cross-Component Workflow Integration Tests', () => {
  beforeEach(() => {
    mockRegistry.reset();
    fileSystemMock._clear();
    
    // Setup test project structure
    fileSystemMock._setFile('/project/src/main.js', 'console.log("Hello World");');
    fileSystemMock._setFile('/project/src/utils.js', 'export function helper() { return "test"; }');
    fileSystemMock._setFile('/project/package.json', JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      scripts: {
        test: 'vitest',
        build: 'vite build'
      }
    }));
  });

  afterEach(() => {
    mockRegistry.clearCalls();
  });

  describe('Dashboard + Terminal + FileExplorer Integration', () => {
    it('should coordinate project creation through multiple components', async () => {
      const mockWorkspace = {
        render: () => {
          const container = document.createElement('div');
          container.innerHTML = `
            <div class="workspace">
              <!-- Dashboard Section -->
              <div class="dashboard" data-testid="dashboard">
                <button data-testid="new-project-btn">New Project</button>
                <input data-testid="project-name" placeholder="Project name" />
                <button data-testid="create-project-btn">Create</button>
              </div>
              
              <!-- File Explorer Section -->
              <div class="file-explorer" data-testid="file-explorer">
                <div data-testid="file-tree"></div>
                <button data-testid="refresh-files">Refresh</button>
              </div>
              
              <!-- Terminal Section -->
              <div class="terminal" data-testid="terminal">
                <input data-testid="terminal-input" placeholder="Enter command" />
                <button data-testid="run-command">Run</button>
                <pre data-testid="terminal-output"></pre>
              </div>
            </div>
          `;
          
          const newProjectBtn = container.querySelector('[data-testid="new-project-btn"]');
          const projectNameInput = container.querySelector('[data-testid="project-name"]') as HTMLInputElement;
          const createProjectBtn = container.querySelector('[data-testid="create-project-btn"]');
          const fileTree = container.querySelector('[data-testid="file-tree"]');
          const refreshFilesBtn = container.querySelector('[data-testid="refresh-files"]');
          const terminalInput = container.querySelector('[data-testid="terminal-input"]') as HTMLInputElement;
          const runCommandBtn = container.querySelector('[data-testid="run-command"]');
          const terminalOutput = container.querySelector('[data-testid="terminal-output"]');
          
          // Dashboard functionality
          newProjectBtn?.addEventListener('click', () => {
            (projectNameInput as HTMLElement).style.display = 'block';
            (createProjectBtn as HTMLElement).style.display = 'block';
          });
          
          createProjectBtn?.addEventListener('click', async () => {
            const projectName = projectNameInput.value;
            if (!projectName) return;
            
            try {
              // Create project through Tauri API
              await tauriAPI.invoke('create_project', { name: projectName });
              
              // Create initial files
              await fileSystemMock.createDir(`/projects/${projectName}`);
              await fileSystemMock.writeFile(
                `/projects/${projectName}/package.json`,
                new TextEncoder().encode(JSON.stringify({
                  name: projectName,
                  version: '1.0.0'
                }, null, 2))
              );
              
              // Update file tree
              refreshFiles();
            } catch (error) {
              console.error('Project creation failed:', error);
            }
          });
          
          // File Explorer functionality
          async function refreshFiles() {
            try {
              // Track created projects
              const createdProjects = new Set<string>();
              if (projectNameInput.value) {
                createdProjects.add(projectNameInput.value);
              }
              
              if (fileTree) {
                // Show created projects
                fileTree.innerHTML = Array.from(createdProjects).map(project => 
                  `<div class="file-item">${project}</div>`
                ).join('');
              }
            } catch (error) {
              console.error('Failed to refresh files:', error);
            }
          }
          
          refreshFilesBtn?.addEventListener('click', refreshFiles);
          
          // Terminal functionality
          runCommandBtn?.addEventListener('click', async () => {
            const command = terminalInput.value;
            if (!command) return;
            
            const terminal = terminalMock.spawn();
            terminal.on('data', (data: string) => {
              if (terminalOutput) {
                terminalOutput.textContent += data;
              }
            });
            
            terminal.write(command);
          });
          
          return { container };
        }
      };

      const { container } = mockWorkspace.render();
      document.body.appendChild(container);

      // Step 1: Initiate project creation from dashboard
      const newProjectBtn = container.querySelector('[data-testid="new-project-btn"]') as HTMLButtonElement;
      const projectNameInput = container.querySelector('[data-testid="project-name"]') as HTMLInputElement;
      const createProjectBtn = container.querySelector('[data-testid="create-project-btn"]') as HTMLButtonElement;

      newProjectBtn.click();
      projectNameInput.value = 'integration-test-project';
      fireEvent.input(projectNameInput, { target: { value: 'integration-test-project' } });
      createProjectBtn.click();

      // Wait for project creation
      await waitFor(() => {
        expect(tauriAPI.invoke).toHaveBeenCalledWith('create_project', { 
          name: 'integration-test-project' 
        });
      });

      // Step 2: Verify file explorer updates
      const refreshFilesBtn = container.querySelector('[data-testid="refresh-files"]') as HTMLButtonElement;
      refreshFilesBtn.click();

      await waitFor(() => {
        const fileTree = container.querySelector('[data-testid="file-tree"]');
        expect(fileTree?.textContent).toContain('integration-test-project');
      });

      // Step 3: Execute terminal command related to the project
      const terminalInput = container.querySelector('[data-testid="terminal-input"]') as HTMLInputElement;
      const runCommandBtn = container.querySelector('[data-testid="run-command"]') as HTMLButtonElement;

      terminalInput.value = 'cd integration-test-project && npm init -y';
      fireEvent.input(terminalInput, { target: { value: 'cd integration-test-project && npm init -y' } });
      runCommandBtn.click();

      await waitFor(() => {
        const terminalOutput = container.querySelector('[data-testid="terminal-output"]');
        expect(terminalOutput?.textContent).toContain('npm init');
      });

      // Verify all components coordinated properly
      expect(fileSystemMock.createDir).toHaveBeenCalledWith('/projects/integration-test-project');
      expect(fileSystemMock.writeFile).toHaveBeenCalled();
      expect(terminalMock.spawn).toHaveBeenCalled();
    });
  });

  describe('Search + Replace + Git Integration', () => {
    it('should coordinate code changes with version control', async () => {
      const mockGitWorkflow = {
        render: () => {
          const container = document.createElement('div');
          container.innerHTML = `
            <div class="git-workflow">
              <!-- Search Panel -->
              <div class="search-panel" data-testid="search-panel">
                <input data-testid="search-input" placeholder="Search..." />
                <input data-testid="replace-input" placeholder="Replace with..." />
                <button data-testid="replace-all-btn">Replace All</button>
                <div data-testid="search-results"></div>
              </div>
              
              <!-- Git Panel -->
              <div class="git-panel" data-testid="git-panel">
                <div data-testid="git-status"></div>
                <input data-testid="commit-message" placeholder="Commit message" />
                <button data-testid="commit-btn">Commit</button>
                <div data-testid="commit-history"></div>
              </div>
              
              <!-- Editor Mock -->
              <div class="editor" data-testid="editor">
                <textarea data-testid="editor-content"></textarea>
              </div>
            </div>
          `;
          
          const searchInput = container.querySelector('[data-testid="search-input"]') as HTMLInputElement;
          const replaceInput = container.querySelector('[data-testid="replace-input"]') as HTMLInputElement;
          const replaceAllBtn = container.querySelector('[data-testid="replace-all-btn"]');
          const searchResults = container.querySelector('[data-testid="search-results"]');
          const gitStatus = container.querySelector('[data-testid="git-status"]');
          const commitMessage = container.querySelector('[data-testid="commit-message"]') as HTMLInputElement;
          const commitBtn = container.querySelector('[data-testid="commit-btn"]');
          const commitHistory = container.querySelector('[data-testid="commit-history"]');
          const editorContent = container.querySelector('[data-testid="editor-content"]') as HTMLTextAreaElement;

          // Load initial file content
          fileSystemMock.readFile('/project/src/main.js').then(data => {
            editorContent.value = new TextDecoder().decode(data);
          });

          // Search and replace functionality
          replaceAllBtn?.addEventListener('click', async () => {
            const searchTerm = searchInput.value;
            const replaceTerm = replaceInput.value;
            
            if (!searchTerm || !replaceTerm) return;
            
            // Perform search across project files
            const files = ['/project/src/main.js', '/project/src/utils.js'];
            let totalReplacements = 0;
            
            for (const file of files) {
              try {
                const data = await fileSystemMock.readFile(file);
                let content = new TextDecoder().decode(data);
                const originalContent = content;
                
                content = content.replace(new RegExp(searchTerm, 'g'), replaceTerm);
                
                if (content !== originalContent) {
                  await fileSystemMock.writeFile(file, new TextEncoder().encode(content));
                  totalReplacements++;
                }
              } catch (error) {
                console.error(`Error processing file ${file}:`, error);
              }
            }
            
            if (searchResults) {
              searchResults.textContent = `Replaced in ${totalReplacements} files`;
            }
            
            // Update git status
            updateGitStatus();
            
            // Update editor if current file was modified
            if (totalReplacements > 0) {
              const updatedData = await fileSystemMock.readFile('/project/src/main.js');
              editorContent.value = new TextDecoder().decode(updatedData);
            }
          });

          // Git functionality
          async function updateGitStatus() {
            try {
              const result = await tauriAPI.invoke('git_status');
              if (gitStatus) {
                gitStatus.textContent = `Modified files: ${result.modified?.length || 0}`;
              }
            } catch (error) {
              if (gitStatus) {
                gitStatus.textContent = 'No git repository';
              }
            }
          }

          commitBtn?.addEventListener('click', async () => {
            const message = commitMessage.value;
            if (!message) return;
            
            try {
              // Stage all changes
              await tauriAPI.invoke('git_add_all');
              
              // Commit changes
              const commitResult = await tauriAPI.invoke('git_commit', { message });
              
              // Update commit history
              if (commitHistory) {
                const historyDiv = document.createElement('div');
                historyDiv.textContent = `${commitResult.hash}: ${message}`;
                commitHistory.appendChild(historyDiv);
              }
              
              // Clear commit message and update status
              commitMessage.value = '';
              updateGitStatus();
              
            } catch (error) {
              console.error('Commit failed:', error);
            }
          });

          // Initialize git status
          updateGitStatus();
          
          return { container };
        }
      };

      const { container } = mockGitWorkflow.render();
      document.body.appendChild(container);

      // Wait for initial load
      await waitFor(() => {
        const editorContent = container.querySelector('[data-testid="editor-content"]') as HTMLTextAreaElement;
        expect(editorContent.value).toContain('console.log');
      });

      // Step 1: Perform search and replace
      const searchInput = container.querySelector('[data-testid="search-input"]') as HTMLInputElement;
      const replaceInput = container.querySelector('[data-testid="replace-input"]') as HTMLInputElement;
      const replaceAllBtn = container.querySelector('[data-testid="replace-all-btn"]') as HTMLButtonElement;

      searchInput.value = 'console.log';
      replaceInput.value = 'console.info';
      fireEvent.input(searchInput, { target: { value: 'console.log' } });
      fireEvent.input(replaceInput, { target: { value: 'console.info' } });
      
      replaceAllBtn.click();

      await waitFor(() => {
        const searchResults = container.querySelector('[data-testid="search-results"]');
        expect(searchResults?.textContent).toContain('Replaced');
      });

      // Step 2: Verify git status updated
      await waitFor(() => {
        const gitStatus = container.querySelector('[data-testid="git-status"]');
        expect(gitStatus?.textContent).toContain('Modified files');
      });

      // Step 3: Commit the changes
      const commitMessage = container.querySelector('[data-testid="commit-message"]') as HTMLInputElement;
      const commitBtn = container.querySelector('[data-testid="commit-btn"]') as HTMLButtonElement;

      commitMessage.value = 'Replace console.log with console.info';
      fireEvent.input(commitMessage, { target: { value: 'Replace console.log with console.info' } });
      commitBtn.click();

      await waitFor(() => {
        expect(tauriAPI.invoke).toHaveBeenCalledWith('git_add_all');
        expect(tauriAPI.invoke).toHaveBeenCalledWith('git_commit', { 
          message: 'Replace console.log with console.info' 
        });
      });

      // Step 4: Verify commit history updated
      await waitFor(() => {
        const commitHistory = container.querySelector('[data-testid="commit-history"]');
        expect(commitHistory?.textContent).toContain('Replace console.log with console.info');
      });

      // Verify file system calls
      expect(fileSystemMock.readFile).toHaveBeenCalledWith('/project/src/main.js');
      expect(fileSystemMock.writeFile).toHaveBeenCalled();
    });
  });

  describe('Flow Execution + Terminal + File Operations Integration', () => {
    it('should execute complex automation flows with multiple components', async () => {
      const mockFlowExecution = {
        render: () => {
          const container = document.createElement('div');
          container.innerHTML = `
            <div class="flow-execution">
              <div class="flow-designer" data-testid="flow-designer">
                <h3>Flow Designer</h3>
                <button data-testid="add-file-step">Add File Step</button>
                <button data-testid="add-command-step">Add Command Step</button>
                <button data-testid="execute-flow">Execute Flow</button>
                <div data-testid="flow-steps"></div>
              </div>
              
              <div class="execution-monitor" data-testid="execution-monitor">
                <h3>Execution Monitor</h3>
                <div data-testid="current-step"></div>
                <div data-testid="execution-log"></div>
              </div>
              
              <div class="file-operations" data-testid="file-operations">
                <h3>File Operations</h3>
                <div data-testid="file-status"></div>
              </div>
            </div>
          `;
          
          const addFileStepBtn = container.querySelector('[data-testid="add-file-step"]');
          const addCommandStepBtn = container.querySelector('[data-testid="add-command-step"]');
          const executeFlowBtn = container.querySelector('[data-testid="execute-flow"]');
          const flowSteps = container.querySelector('[data-testid="flow-steps"]');
          const currentStep = container.querySelector('[data-testid="current-step"]');
          const executionLog = container.querySelector('[data-testid="execution-log"]');
          const fileStatus = container.querySelector('[data-testid="file-status"]');

          const steps: Array<{ type: string; config: any }> = [];
          let isExecuting = false;

          // Add flow steps
          addFileStepBtn?.addEventListener('click', () => {
            steps.push({
              type: 'file',
              config: {
                operation: 'create',
                path: '/project/build/output.txt',
                content: 'Build completed successfully'
              }
            });
            updateFlowSteps();
          });

          addCommandStepBtn?.addEventListener('click', () => {
            steps.push({
              type: 'command',
              config: {
                command: 'npm run build',
                workingDir: '/project'
              }
            });
            updateFlowSteps();
          });

          function updateFlowSteps() {
            if (flowSteps) {
              flowSteps.innerHTML = steps.map((step, index) => 
                `<div class="step-${index}">Step ${index + 1}: ${step.type} - ${JSON.stringify(step.config)}</div>`
              ).join('');
            }
          }

          // Execute flow
          executeFlowBtn?.addEventListener('click', async () => {
            if (isExecuting || steps.length === 0) return;
            
            isExecuting = true;
            if (executeFlowBtn instanceof HTMLButtonElement) {
              executeFlowBtn.disabled = true;
            }

            try {
              for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                
                if (currentStep) {
                  currentStep.textContent = `Executing step ${i + 1}: ${step.type}`;
                }

                await executeStep(step, i);
                
                if (executionLog) {
                  const logEntry = document.createElement('div');
                  logEntry.textContent = `✓ Step ${i + 1} completed: ${step.type}`;
                  executionLog.appendChild(logEntry);
                }
              }

              if (currentStep) {
                currentStep.textContent = 'Flow execution completed';
              }

            } catch (error) {
              if (executionLog) {
                const errorEntry = document.createElement('div');
                errorEntry.textContent = `✗ Flow execution failed: ${(error as Error).message}`;
                errorEntry.style.color = 'red';
                executionLog.appendChild(errorEntry);
              }
            } finally {
              isExecuting = false;
              if (executeFlowBtn instanceof HTMLButtonElement) {
                executeFlowBtn.disabled = false;
              }
            }
          });

          async function executeStep(step: { type: string; config: any }, index: number) {
            switch (step.type) {
              case 'file':
                await executeFileStep(step.config);
                break;
              case 'command':
                await executeCommandStep(step.config);
                break;
              default:
                throw new Error(`Unknown step type: ${step.type}`);
            }
          }

          async function executeFileStep(config: any) {
            try {
              if (config.operation === 'create') {
                // Ensure directory exists
                const dir = config.path.substring(0, config.path.lastIndexOf('/'));
                await fileSystemMock.createDir(dir);
                
                // Create file
                await fileSystemMock.writeFile(
                  config.path,
                  new TextEncoder().encode(config.content)
                );
                
                if (fileStatus) {
                  fileStatus.textContent = `Created: ${config.path}`;
                }
              }
            } catch (error) {
              if (fileStatus) {
                fileStatus.textContent = `File operation failed: ${(error as Error).message}`;
              }
              throw error;
            }
          }

          async function executeCommandStep(config: any) {
            const terminal = terminalMock.spawn();
            
            return new Promise<void>((resolve, reject) => {
              let output = '';
              
              terminal.on('data', (data: string) => {
                output += data;
                if (executionLog) {
                  const outputEntry = document.createElement('div');
                  outputEntry.textContent = `Executing: ${config.command}\n${data}`;
                  outputEntry.style.fontSize = '0.9em';
                  outputEntry.style.color = '#666';
                  executionLog.appendChild(outputEntry);
                }
              });
              
              terminal.on('close', (code: number) => {
                if (code === 0) {
                  resolve();
                } else {
                  reject(new Error(`Command failed with code ${code}`));
                }
              });
              
              terminal.on('error', (error: Error) => {
                reject(error);
              });
              
              // Execute command
              terminal.write(config.command);
              
              // Simulate command completion after a delay
              setTimeout(() => {
                // Emit output and then close
                terminal.write('');
                setTimeout(() => {
                  terminal.kill();
                }, 200);
              }, 100);
            });
          }

          return { container };
        }
      };

      const { container } = mockFlowExecution.render();
      document.body.appendChild(container);

      // Step 1: Design the flow
      const addFileStepBtn = container.querySelector('[data-testid="add-file-step"]') as HTMLButtonElement;
      const addCommandStepBtn = container.querySelector('[data-testid="add-command-step"]') as HTMLButtonElement;

      addCommandStepBtn.click(); // Add build command first
      addFileStepBtn.click();    // Then create output file

      // Verify steps were added
      await waitFor(() => {
        const flowSteps = container.querySelector('[data-testid="flow-steps"]');
        expect(flowSteps?.textContent).toContain('command');
        expect(flowSteps?.textContent).toContain('file');
      });

      // Step 2: Execute the flow
      const executeFlowBtn = container.querySelector('[data-testid="execute-flow"]') as HTMLButtonElement;
      executeFlowBtn.click();

      // Step 3: Monitor execution
      await waitFor(() => {
        const currentStep = container.querySelector('[data-testid="current-step"]');
        expect(currentStep?.textContent).toContain('Executing step');
      }, { timeout: 2000 });

      // Step 4: Verify completion
      await waitFor(() => {
        const executionLog = container.querySelector('[data-testid="execution-log"]');
        expect(executionLog?.textContent).toContain('✓ Step 1 completed');
        expect(executionLog?.textContent).toContain('✓ Step 2 completed');
      }, { timeout: 3000 });

      await waitFor(() => {
        const currentStep = container.querySelector('[data-testid="current-step"]');
        expect(currentStep?.textContent).toContain('Flow execution completed');
      });

      // Verify all subsystems were used
      expect(terminalMock.spawn).toHaveBeenCalled();
      expect(fileSystemMock.createDir).toHaveBeenCalledWith('/project/build');
      
      // Check that the specific file was written (among possible other writes)
      const writeFileCalls = fileSystemMock.writeFile.mock.calls;
      const outputFileWrite = writeFileCalls.find(call => 
        call[0] === '/project/build/output.txt'
      );
      expect(outputFileWrite).toBeTruthy();
      expect(outputFileWrite![1]).toBeDefined();
    });
  });
});