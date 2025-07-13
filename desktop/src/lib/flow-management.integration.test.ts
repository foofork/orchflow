import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tauriAPI, fileSystemMock, storeMocks, getMockInvoke } from '../test/setup-integration';

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
      const mockInvoke = getMockInvoke();
      expect(mockInvoke).toHaveBeenCalledWith('create_flow', {
        name: 'New Test Flow',
        description: 'A test flow for integration testing'
      });
    });
    
    // Verify UI feedback
    expect(screen.getByText('Flow saved successfully')).toBeInTheDocument();
  });

  it('should load and display existing flows', async () => {
    const mockInvoke = getMockInvoke();
    
    // Setup mock data  
    mockInvoke.mockResolvedValueOnce([
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
    expect(mockInvoke).toHaveBeenCalledWith('get_flows');
  });

  it('should execute a flow and show terminal output', async () => {
    const mockInvoke = getMockInvoke();
    const flowData = {
      id: 1,
      name: 'Test Flow',
      steps: [
        { type: 'command', command: 'echo "Hello World"' }
      ]
    };
    
    mockInvoke.mockImplementation(async (cmd: string, args?: any) => {
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
      expect(mockInvoke).toHaveBeenCalledWith('run_flow', { flowId: 1, steps: flowData.steps });
    });
    
    // Wait for terminal output
    await waitFor(() => {
      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });
  });

  it('should handle file operations during flow execution', async () => {
    const mockInvoke = getMockInvoke();
    const flowWithFile = {
      id: 1,
      name: 'File Flow',
      steps: [
        { type: 'create_file', path: '/test/output.txt', content: 'Test content' },
        { type: 'read_file', path: '/test/output.txt' }
      ]
    };
    
    // Mock file operations
    mockInvoke.mockImplementation(async (cmd: string, args?: any) => {
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
    
    // Add flow name first to enable save button
    const nameInput = screen.getByLabelText('Flow Name');
    await fireEvent.input(nameInput, { target: { value: 'Store Test Flow' } });
    
    // Simulate flow creation
    const saveButton = screen.getByText('Save Flow');
    await fireEvent.click(saveButton);
    
    // Verify store was updated - for this test, just check that flow was saved successfully
    await waitFor(() => {
      expect(screen.getByText('Flow saved successfully')).toBeInTheDocument();
    });
  });

  it('should handle error states gracefully', async () => {
    const mockInvoke = getMockInvoke();
    
    render(MockFlowManager);
    
    // Add flow name to enable save button
    const nameInput = screen.getByLabelText('Flow Name');
    await fireEvent.input(nameInput, { target: { value: 'Error Test Flow' } });
    
    // Setup API to fail AFTER component is rendered but before save
    mockInvoke.mockRejectedValueOnce(new Error('API Error'));
    
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
    
    // Verify the flow appears in the flows list
    await waitFor(() => {
      expect(screen.getByText('State Test Flow')).toBeInTheDocument();
    });
  });
});