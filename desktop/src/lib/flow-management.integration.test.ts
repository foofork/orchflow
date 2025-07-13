import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tauriAPI, fileSystemMock, storeMocks } from '../test/setup-integration';

/**
 * Integration Tests for Flow Management
 * 
 * Tests the complete flow lifecycle including:
 * - UI interactions
 * - Tauri API calls
 * - File system operations
 * - Store updates
 */

// Mock component for testing
import MockFlowManager from '../test/mocks/MockFlowManager.svelte';

describe('Flow Management Integration', () => {
  beforeEach(() => {
    // Setup test data
    fileSystemMock._setFile('/flows/test-flow.json', JSON.stringify({
      id: 1,
      name: 'Test Flow',
      steps: [
        { type: 'command', command: 'echo "Hello World"' }
      ]
    }));
  });

  it('should create and save a new flow', async () => {
    const { component } = render(MockFlowManager);
    
    // Simulate user creating a new flow
    const nameInput = screen.getByLabelText('Flow Name');
    const descInput = screen.getByLabelText('Description');
    const saveButton = screen.getByText('Save Flow');
    
    await fireEvent.input(nameInput, { target: { value: 'New Test Flow' } });
    await fireEvent.input(descInput, { target: { value: 'A test flow for integration testing' } });
    await fireEvent.click(saveButton);
    
    // Verify Tauri API was called
    await waitFor(() => {
      expect(tauriAPI.invoke).toHaveBeenCalledWith('create_flow', {
        name: 'New Test Flow',
        description: 'A test flow for integration testing'
      });
    });
    
    // Verify UI feedback
    expect(screen.getByText('Flow saved successfully')).toBeInTheDocument();
  });

  it('should load and display existing flows', async () => {
    // Setup mock data  
    vi.mocked(tauriAPI.invoke).mockResolvedValueOnce([
      { id: 1, name: 'Flow 1', description: 'First flow' },
      { id: 2, name: 'Flow 2', description: 'Second flow' }
    ]);
    
    render(MockFlowManager);
    
    // Wait for flows to load
    await waitFor(() => {
      expect(screen.getByText('Flow 1')).toBeInTheDocument();
      expect(screen.getByText('Flow 2')).toBeInTheDocument();
    });
    
    // Verify API call
    expect(tauriAPI.invoke).toHaveBeenCalledWith('get_flows');
  });

  it('should execute a flow and show terminal output', async () => {
    const flowData = {
      id: 1,
      name: 'Test Flow',
      steps: [
        { type: 'command', command: 'echo "Hello World"' }
      ]
    };
    
    vi.mocked(tauriAPI.invoke).mockImplementation(async (cmd: string, args?: any) => {
      if (cmd === 'run_flow') {
        return { id: args.flowId, status: 'running' };
      }
      if (cmd === 'get_terminal_output') {
        return 'Hello World\n';
      }
      return null;
    });
    
    render(MockFlowManager, {
      props: { selectedFlow: flowData }
    });
    
    const runButton = screen.getByText('Run Flow');
    await fireEvent.click(runButton);
    
    // Verify flow execution
    await waitFor(() => {
      expect(tauriAPI.invoke).toHaveBeenCalledWith('run_flow', { flowId: 1 });
    });
    
    // Wait for terminal output
    await waitFor(() => {
      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });
  });

  it('should handle file operations during flow execution', async () => {
    const flowWithFile = {
      id: 1,
      name: 'File Flow',
      steps: [
        { type: 'create_file', path: '/test/output.txt', content: 'Test content' },
        { type: 'read_file', path: '/test/output.txt' }
      ]
    };
    
    // Mock file operations
    vi.mocked(tauriAPI.invoke).mockImplementation(async (cmd: string, args?: any) => {
      if (cmd === 'run_flow') {
        // Simulate file creation during flow execution
        fileSystemMock._setFile(args.steps[0].path, args.steps[0].content);
        return { id: args.flowId, status: 'completed' };
      }
      return null;
    });
    
    render(MockFlowManager, {
      props: { selectedFlow: flowWithFile }
    });
    
    const runButton = screen.getByText('Run Flow');
    await fireEvent.click(runButton);
    
    // Verify file was created
    await waitFor(async () => {
      const exists = await fileSystemMock.exists('/test/output.txt');
      expect(exists).toBe(true);
    });
  });

  it('should sync with stores during operations', async () => {
    render(MockFlowManager);
    
    // Simulate flow creation
    const saveButton = screen.getByText('Save Flow');
    await fireEvent.click(saveButton);
    
    // Verify store was updated
    await waitFor(() => {
      expect(storeMocks.flows.update).toHaveBeenCalled();
    });
  });

  it('should handle error states gracefully', async () => {
    // Setup API to fail
    vi.mocked(tauriAPI.invoke).mockRejectedValueOnce(new Error('API Error'));
    
    render(MockFlowManager);
    
    const saveButton = screen.getByText('Save Flow');
    await fireEvent.click(saveButton);
    
    // Verify error handling
    await waitFor(() => {
      expect(screen.getByText('Error: Failed to save flow')).toBeInTheDocument();
    });
  });

  it('should maintain state consistency across operations', async () => {
    const { component } = render(MockFlowManager);
    
    // Create flow
    const nameInput = screen.getByLabelText('Flow Name');
    await fireEvent.input(nameInput, { target: { value: 'State Test Flow' } });
    
    const saveButton = screen.getByText('Save Flow');
    await fireEvent.click(saveButton);
    
    // Wait for save to complete
    await waitFor(() => {
      expect(screen.getByText('Flow saved successfully')).toBeInTheDocument();
    });
    
    // Verify state is maintained
    expect((nameInput as HTMLInputElement).value).toBe('State Test Flow');
    
    // Run the flow
    const runButton = screen.getByText('Run Flow');
    await fireEvent.click(runButton);
    
    // Verify flow name is still displayed during execution
    await waitFor(() => {
      expect(screen.getByDisplayValue('State Test Flow')).toBeInTheDocument();
    });
  });
});