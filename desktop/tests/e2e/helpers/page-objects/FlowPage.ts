/**
 * Flow Page Object
 * Handles all flow-related interactions
 */

import { BasePage } from './BasePage';
import type { Page } from 'playwright';

export interface FlowData {
  name: string;
  description?: string;
  steps?: FlowStep[];
  tags?: string[];
}

export interface FlowStep {
  type: 'command' | 'script' | 'flow';
  command?: string;
  script?: string;
  flowId?: string;
  timeout?: number;
  continueOnError?: boolean;
}

export class FlowPage extends BasePage {
  // Selectors
  private selectors = {
    flowsTab: '[data-testid="flows-tab"]',
    flowsSection: '[data-testid="flows-section"]',
    createFlowButton: '[data-testid="create-flow-button"]',
    flowNameInput: '[data-testid="flow-name-input"]',
    flowDescriptionInput: '[data-testid="flow-description-input"]',
    addStepButton: '[data-testid="add-step-button"]',
    stepTypeSelect: '[data-testid="step-type-select"]',
    stepCommandInput: '[data-testid="step-command-input"]',
    stepScriptInput: '[data-testid="step-script-input"]',
    stepFlowSelect: '[data-testid="step-flow-select"]',
    stepTimeoutInput: '[data-testid="step-timeout-input"]',
    continueOnErrorCheckbox: '[data-testid="continue-on-error-checkbox"]',
    saveFlowButton: '[data-testid="save-flow-button"]',
    cancelButton: '[data-testid="cancel-button"]',
    flowList: '[data-testid="flow-list"]',
    flowItem: '[data-testid="flow-item"]',
    runFlowButton: '[data-testid="run-flow-button"]',
    editFlowButton: '[data-testid="edit-flow-button"]',
    deleteFlowButton: '[data-testid="delete-flow-button"]',
    confirmDeleteButton: '[data-testid="confirm-delete-button"]',
    executionStatus: '[data-testid="execution-status"]',
    terminalOutput: '[data-testid="terminal-output"]',
    successMessage: '[data-testid="success-message"]',
    errorMessage: '[data-testid="error-message"]',
    flowTagInput: '[data-testid="flow-tag-input"]',
    addTagButton: '[data-testid="add-tag-button"]',
    flowStepsList: '[data-testid="flow-steps-list"]',
    stepItem: '[data-testid="step-item"]',
    deleteStepButton: '[data-testid="delete-step-button"]',
    moveStepUpButton: '[data-testid="move-step-up-button"]',
    moveStepDownButton: '[data-testid="move-step-down-button"]',
    duplicateFlowButton: '[data-testid="duplicate-flow-button"]',
    exportFlowButton: '[data-testid="export-flow-button"]',
    importFlowButton: '[data-testid="import-flow-button"]',
    searchFlowInput: '[data-testid="search-flow-input"]',
    filterByTagSelect: '[data-testid="filter-by-tag-select"]',
    sortFlowsSelect: '[data-testid="sort-flows-select"]',
    executionLog: '[data-testid="execution-log"]',
    stopExecutionButton: '[data-testid="stop-execution-button"]',
    clearOutputButton: '[data-testid="clear-output-button"]'
  };
  
  constructor(page: Page) {
    super(page);
  }
  
  /**
   * Navigate to flows section
   */
  async navigateToFlows() {
    await this.clickElement(this.selectors.flowsTab);
    await this.waitForElement(this.selectors.flowsSection);
  }
  
  /**
   * Create a new flow
   */
  async createFlow(data: FlowData) {
    await this.clickElement(this.selectors.createFlowButton);
    await this.fillInput(this.selectors.flowNameInput, data.name);
    
    if (data.description) {
      await this.fillInput(this.selectors.flowDescriptionInput, data.description);
    }
    
    if (data.tags) {
      for (const tag of data.tags) {
        await this.addTag(tag);
      }
    }
    
    if (data.steps) {
      for (const step of data.steps) {
        await this.addStep(step);
      }
    }
    
    await this.clickElement(this.selectors.saveFlowButton);
    await this.waitForSuccessMessage();
  }
  
  /**
   * Add a step to the current flow
   */
  private async addStep(step: FlowStep) {
    await this.clickElement(this.selectors.addStepButton);
    await this.selectOption(this.selectors.stepTypeSelect, step.type);
    
    switch (step.type) {
      case 'command':
        if (step.command) {
          await this.fillInput(this.selectors.stepCommandInput, step.command);
        }
        break;
      case 'script':
        if (step.script) {
          await this.fillInput(this.selectors.stepScriptInput, step.script);
        }
        break;
      case 'flow':
        if (step.flowId) {
          await this.selectOption(this.selectors.stepFlowSelect, step.flowId);
        }
        break;
    }
    
    if (step.timeout) {
      await this.fillInput(this.selectors.stepTimeoutInput, step.timeout.toString());
    }
    
    if (step.continueOnError) {
      await this.clickElement(this.selectors.continueOnErrorCheckbox);
    }
  }
  
  /**
   * Add a tag to the current flow
   */
  private async addTag(tag: string) {
    await this.fillInput(this.selectors.flowTagInput, tag);
    await this.clickElement(this.selectors.addTagButton);
  }
  
  /**
   * Execute a flow by name
   */
  async executeFlow(flowName: string) {
    await this.selectFlow(flowName);
    await this.clickElement(this.selectors.runFlowButton);
    await this.waitForExecutionStart();
  }
  
  /**
   * Edit an existing flow
   */
  async editFlow(flowName: string, updates: Partial<FlowData>) {
    await this.selectFlow(flowName);
    await this.clickElement(this.selectors.editFlowButton);
    
    if (updates.name) {
      await this.clearInput(this.selectors.flowNameInput);
      await this.fillInput(this.selectors.flowNameInput, updates.name);
    }
    
    if (updates.description !== undefined) {
      await this.clearInput(this.selectors.flowDescriptionInput);
      if (updates.description) {
        await this.fillInput(this.selectors.flowDescriptionInput, updates.description);
      }
    }
    
    await this.clickElement(this.selectors.saveFlowButton);
    await this.waitForSuccessMessage();
  }
  
  /**
   * Delete a flow
   */
  async deleteFlow(flowName: string) {
    await this.selectFlow(flowName);
    await this.clickElement(this.selectors.deleteFlowButton);
    await this.clickElement(this.selectors.confirmDeleteButton);
    await this.waitForSuccessMessage();
  }
  
  /**
   * Select a flow from the list
   */
  private async selectFlow(flowName: string) {
    const flowItem = `${this.selectors.flowItem}:has-text("${flowName}")`;
    await this.clickElement(flowItem);
  }
  
  /**
   * Wait for execution to start
   */
  private async waitForExecutionStart() {
    await this.waitForText('Running', { timeout: 10000 });
  }
  
  /**
   * Wait for execution to complete
   */
  async waitForExecutionComplete(timeout = 60000) {
    await this.waitForText('Completed', { timeout });
  }
  
  /**
   * Get execution status
   */
  async getExecutionStatus(): Promise<string> {
    return await this.getTextContent(this.selectors.executionStatus);
  }
  
  /**
   * Get terminal output
   */
  async getTerminalOutput(): Promise<string> {
    return await this.getTextContent(this.selectors.terminalOutput);
  }
  
  /**
   * Wait for success message
   */
  private async waitForSuccessMessage() {
    await this.waitForElement(this.selectors.successMessage);
  }
  
  /**
   * Check if flow exists
   */
  async flowExists(flowName: string): Promise<boolean> {
    return await this.elementExists(`${this.selectors.flowItem}:has-text("${flowName}")`);
  }
  
  /**
   * Get all flow names
   */
  async getAllFlowNames(): Promise<string[]> {
    const flowItems = await this.getAllElements(this.selectors.flowItem);
    const names: string[] = [];
    
    for (const item of flowItems) {
      const text = await item.textContent();
      if (text) {
        names.push(text);
      }
    }
    
    return names;
  }
  
  /**
   * Search for flows
   */
  async searchFlows(query: string) {
    await this.fillInput(this.selectors.searchFlowInput, query);
    await this.page.waitForTimeout(500); // Debounce
  }
  
  /**
   * Filter flows by tag
   */
  async filterByTag(tag: string) {
    await this.selectOption(this.selectors.filterByTagSelect, tag);
  }
  
  /**
   * Sort flows
   */
  async sortFlows(sortBy: 'name' | 'date' | 'modified') {
    await this.selectOption(this.selectors.sortFlowsSelect, sortBy);
  }
  
  /**
   * Duplicate a flow
   */
  async duplicateFlow(flowName: string, newName: string) {
    await this.selectFlow(flowName);
    await this.clickElement(this.selectors.duplicateFlowButton);
    await this.fillInput(this.selectors.flowNameInput, newName);
    await this.clickElement(this.selectors.saveFlowButton);
    await this.waitForSuccessMessage();
  }
  
  /**
   * Export a flow
   */
  async exportFlow(flowName: string) {
    await this.selectFlow(flowName);
    await this.clickElement(this.selectors.exportFlowButton);
    // Handle download
  }
  
  /**
   * Import a flow
   */
  async importFlow(filePath: string) {
    await this.clickElement(this.selectors.importFlowButton);
    await this.uploadFile('input[type="file"]', filePath);
    await this.waitForSuccessMessage();
  }
  
  /**
   * Stop flow execution
   */
  async stopExecution() {
    await this.clickElement(this.selectors.stopExecutionButton);
  }
  
  /**
   * Clear terminal output
   */
  async clearOutput() {
    await this.clickElement(this.selectors.clearOutputButton);
  }
  
  /**
   * Get execution log
   */
  async getExecutionLog(): Promise<string[]> {
    const logItems = await this.getAllElements(`${this.selectors.executionLog} .log-entry`);
    const logs: string[] = [];
    
    for (const item of logItems) {
      const text = await item.textContent();
      if (text) {
        logs.push(text);
      }
    }
    
    return logs;
  }
  
  /**
   * Verify flow step order
   */
  async verifyStepOrder(expectedSteps: string[]): Promise<boolean> {
    const stepItems = await this.getAllElements(this.selectors.stepItem);
    
    if (stepItems.length !== expectedSteps.length) {
      return false;
    }
    
    for (let i = 0; i < stepItems.length; i++) {
      const text = await stepItems[i].textContent();
      if (!text?.includes(expectedSteps[i])) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Delete a specific step
   */
  async deleteStep(stepIndex: number) {
    const deleteButtons = await this.getAllElements(this.selectors.deleteStepButton);
    if (stepIndex < deleteButtons.length) {
      await deleteButtons[stepIndex].click();
    }
  }
  
  /**
   * Move step up
   */
  async moveStepUp(stepIndex: number) {
    const moveUpButtons = await this.getAllElements(this.selectors.moveStepUpButton);
    if (stepIndex < moveUpButtons.length) {
      await moveUpButtons[stepIndex].click();
    }
  }
  
  /**
   * Move step down
   */
  async moveStepDown(stepIndex: number) {
    const moveDownButtons = await this.getAllElements(this.selectors.moveStepDownButton);
    if (stepIndex < moveDownButtons.length) {
      await moveDownButtons[stepIndex].click();
    }
  }
}