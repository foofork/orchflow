import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

export class GitPanelPage {
  page: Page;
  gitPanel: Locator;
  changedFiles: Locator;
  stagedFiles: Locator;
  commitMessage: Locator;
  commitButton: Locator;
  branchSelector: Locator;
  pullButton: Locator;
  pushButton: Locator;
  syncButton: Locator;
  historyTab: Locator;
  changesTab: Locator;
  branchesTab: Locator;

  constructor(page: Page) {
    this.page = page;
    this.gitPanel = page.locator('[data-testid="git-panel"]');
    this.changedFiles = page.locator('[data-testid="changed-files"]');
    this.stagedFiles = page.locator('[data-testid="staged-files"]');
    this.commitMessage = page.locator('[data-testid="commit-message"]');
    this.commitButton = page.locator('[data-testid="commit-button"]');
    this.branchSelector = page.locator('[data-testid="branch-selector"]');
    this.pullButton = page.locator('[data-testid="pull-button"]');
    this.pushButton = page.locator('[data-testid="push-button"]');
    this.syncButton = page.locator('[data-testid="sync-button"]');
    this.historyTab = page.locator('[data-testid="history-tab"]');
    this.changesTab = page.locator('[data-testid="changes-tab"]');
    this.branchesTab = page.locator('[data-testid="branches-tab"]');
  }

  async waitForReady(): Promise<void> {
    await this.gitPanel.waitFor({ state: 'visible' });
    await this.page.waitForTimeout(500); // Allow git status to load
  }

  async openGitPanel(): Promise<void> {
    const gitButton = this.page.locator('[data-testid="git-button"], [aria-label="Source Control"]');
    await gitButton.click();
    await this.waitForReady();
  }

  async closeGitPanel(): Promise<void> {
    const closeButton = this.gitPanel.locator('[data-testid="close-panel"]');
    await closeButton.click();
  }

  async switchToTab(tabName: 'changes' | 'history' | 'branches'): Promise<void> {
    const tabMap = {
      changes: this.changesTab,
      history: this.historyTab,
      branches: this.branchesTab
    };
    
    await tabMap[tabName].click();
    await this.page.waitForTimeout(100);
  }

  async stageFile(fileName: string): Promise<void> {
    const fileItem = this.changedFiles.locator(`[data-testid="file-${fileName}"]`);
    const stageButton = fileItem.locator('[data-testid="stage-file"]');
    await stageButton.click();
    await this.page.waitForTimeout(100);
  }

  async unstageFile(fileName: string): Promise<void> {
    const fileItem = this.stagedFiles.locator(`[data-testid="file-${fileName}"]`);
    const unstageButton = fileItem.locator('[data-testid="unstage-file"]');
    await unstageButton.click();
    await this.page.waitForTimeout(100);
  }

  async stageAll(): Promise<void> {
    const stageAllButton = this.changedFiles.locator('[data-testid="stage-all"]');
    await stageAllButton.click();
    await this.page.waitForTimeout(200);
  }

  async unstageAll(): Promise<void> {
    const unstageAllButton = this.stagedFiles.locator('[data-testid="unstage-all"]');
    await unstageAllButton.click();
    await this.page.waitForTimeout(200);
  }

  async discardChanges(fileName: string, confirm = true): Promise<void> {
    const fileItem = this.changedFiles.locator(`[data-testid="file-${fileName}"]`);
    const discardButton = fileItem.locator('[data-testid="discard-changes"]');
    await discardButton.click();
    
    if (confirm) {
      const confirmButton = this.page.locator('[data-testid="confirm-discard"]');
      await confirmButton.click();
    } else {
      const cancelButton = this.page.locator('[data-testid="cancel-discard"]');
      await cancelButton.click();
    }
    
    await this.page.waitForTimeout(100);
  }

  async viewFileDiff(fileName: string): Promise<void> {
    const fileItem = this.page.locator(`[data-testid="file-${fileName}"]`);
    await fileItem.click();
    
    const diffViewer = this.page.locator('[data-testid="diff-viewer"]');
    await diffViewer.waitFor({ state: 'visible' });
  }

  async commit(message: string, description?: string): Promise<void> {
    await this.commitMessage.fill(message);
    
    if (description) {
      await this.commitMessage.press('Enter');
      await this.commitMessage.press('Enter');
      await this.commitMessage.type(description);
    }
    
    await this.commitButton.click();
    await this.page.waitForTimeout(500);
  }

  async amendCommit(newMessage?: string): Promise<void> {
    const amendCheckbox = this.page.locator('[data-testid="amend-checkbox"]');
    await amendCheckbox.check();
    
    if (newMessage) {
      await this.commitMessage.clear();
      await this.commitMessage.fill(newMessage);
    }
    
    await this.commitButton.click();
    await this.page.waitForTimeout(500);
  }

  async getCurrentBranch(): Promise<string> {
    return await this.branchSelector.textContent() || '';
  }

  async switchBranch(branchName: string): Promise<void> {
    await this.branchSelector.click();
    
    const branchList = this.page.locator('[data-testid="branch-list"]');
    await branchList.waitFor({ state: 'visible' });
    
    const branchItem = branchList.locator(`[data-testid="branch-${branchName}"]`);
    await branchItem.click();
    
    await this.page.waitForTimeout(500);
  }

  async createBranch(branchName: string, checkout = true): Promise<void> {
    await this.branchSelector.click();
    
    const createButton = this.page.locator('[data-testid="create-branch-button"]');
    await createButton.click();
    
    const nameInput = this.page.locator('[data-testid="branch-name-input"]');
    await nameInput.fill(branchName);
    
    if (!checkout) {
      const checkoutCheckbox = this.page.locator('[data-testid="checkout-branch"]');
      await checkoutCheckbox.uncheck();
    }
    
    const confirmButton = this.page.locator('[data-testid="confirm-create-branch"]');
    await confirmButton.click();
    
    await this.page.waitForTimeout(500);
  }

  async deleteBranch(branchName: string, force = false): Promise<void> {
    await this.switchToTab('branches');
    
    const branchItem = this.page.locator(`[data-testid="branch-item-${branchName}"]`);
    const deleteButton = branchItem.locator('[data-testid="delete-branch"]');
    await deleteButton.click();
    
    if (force) {
      const forceCheckbox = this.page.locator('[data-testid="force-delete"]');
      await forceCheckbox.check();
    }
    
    const confirmButton = this.page.locator('[data-testid="confirm-delete-branch"]');
    await confirmButton.click();
    
    await this.page.waitForTimeout(300);
  }

  async pull(): Promise<void> {
    await this.pullButton.click();
    await this.waitForOperation();
  }

  async push(): Promise<void> {
    await this.pushButton.click();
    await this.waitForOperation();
  }

  async pushWithOptions(force = false, setUpstream = false): Promise<void> {
    await this.pushButton.click({ button: 'right' });
    
    const menu = this.page.locator('[data-testid="push-menu"]');
    await menu.waitFor({ state: 'visible' });
    
    if (force) {
      await menu.locator('[data-testid="push-force"]').click();
    } else if (setUpstream) {
      await menu.locator('[data-testid="push-upstream"]').click();
    } else {
      await menu.locator('[data-testid="push-normal"]').click();
    }
    
    await this.waitForOperation();
  }

  async sync(): Promise<void> {
    await this.syncButton.click();
    await this.waitForOperation();
  }

  async fetch(): Promise<void> {
    const fetchButton = this.page.locator('[data-testid="fetch-button"]');
    await fetchButton.click();
    await this.waitForOperation();
  }

  async getChangedFilesList(): Promise<string[]> {
    const files = await this.changedFiles.locator('[data-testid^="file-"]').all();
    const fileNames: string[] = [];
    
    for (const file of files) {
      const name = await file.getAttribute('data-file-name');
      if (name) fileNames.push(name);
    }
    
    return fileNames;
  }

  async getStagedFilesList(): Promise<string[]> {
    const files = await this.stagedFiles.locator('[data-testid^="file-"]').all();
    const fileNames: string[] = [];
    
    for (const file of files) {
      const name = await file.getAttribute('data-file-name');
      if (name) fileNames.push(name);
    }
    
    return fileNames;
  }

  async getCommitHistory(limit = 10): Promise<Array<{ hash: string; message: string; author: string; date: string }>> {
    await this.switchToTab('history');
    
    const commits = await this.page.locator('[data-testid^="commit-"]').all();
    const history: Array<{ hash: string; message: string; author: string; date: string }> = [];
    
    for (let i = 0; i < Math.min(commits.length, limit); i++) {
      const commit = commits[i];
      
      history.push({
        hash: await commit.getAttribute('data-commit-hash') || '',
        message: await commit.locator('[data-testid="commit-message"]').textContent() || '',
        author: await commit.locator('[data-testid="commit-author"]').textContent() || '',
        date: await commit.locator('[data-testid="commit-date"]').textContent() || ''
      });
    }
    
    return history;
  }

  async viewCommitDetails(commitHash: string): Promise<void> {
    const commit = this.page.locator(`[data-commit-hash="${commitHash}"]`);
    await commit.click();
    
    const detailsPanel = this.page.locator('[data-testid="commit-details"]');
    await detailsPanel.waitFor({ state: 'visible' });
  }

  async cherryPick(commitHash: string): Promise<void> {
    const commit = this.page.locator(`[data-commit-hash="${commitHash}"]`);
    await commit.click({ button: 'right' });
    
    const menu = this.page.locator('[data-testid="commit-context-menu"]');
    await menu.locator('[data-testid="cherry-pick"]').click();
    
    await this.waitForOperation();
  }

  async revertCommit(commitHash: string): Promise<void> {
    const commit = this.page.locator(`[data-commit-hash="${commitHash}"]`);
    await commit.click({ button: 'right' });
    
    const menu = this.page.locator('[data-testid="commit-context-menu"]');
    await menu.locator('[data-testid="revert-commit"]').click();
    
    await this.waitForOperation();
  }

  async startRebase(onto: string): Promise<void> {
    const rebaseButton = this.page.locator('[data-testid="rebase-button"]');
    await rebaseButton.click();
    
    const branchInput = this.page.locator('[data-testid="rebase-onto-input"]');
    await branchInput.fill(onto);
    
    const startButton = this.page.locator('[data-testid="start-rebase"]');
    await startButton.click();
    
    await this.waitForOperation();
  }

  async continueRebase(): Promise<void> {
    const continueButton = this.page.locator('[data-testid="continue-rebase"]');
    await continueButton.click();
    await this.waitForOperation();
  }

  async abortRebase(): Promise<void> {
    const abortButton = this.page.locator('[data-testid="abort-rebase"]');
    await abortButton.click();
    await this.waitForOperation();
  }

  async mergeBranch(branchName: string, squash = false): Promise<void> {
    const mergeButton = this.page.locator('[data-testid="merge-button"]');
    await mergeButton.click();
    
    const branchInput = this.page.locator('[data-testid="merge-branch-input"]');
    await branchInput.fill(branchName);
    
    if (squash) {
      const squashCheckbox = this.page.locator('[data-testid="squash-merge"]');
      await squashCheckbox.check();
    }
    
    const confirmButton = this.page.locator('[data-testid="confirm-merge"]');
    await confirmButton.click();
    
    await this.waitForOperation();
  }

  async resolveConflict(fileName: string, resolution: 'ours' | 'theirs' | 'manual'): Promise<void> {
    const conflictFile = this.page.locator(`[data-testid="conflict-${fileName}"]`);
    
    if (resolution === 'manual') {
      await conflictFile.click();
      // Opens merge conflict editor
    } else {
      const resolveButton = conflictFile.locator(`[data-testid="resolve-${resolution}"]`);
      await resolveButton.click();
    }
    
    await this.page.waitForTimeout(200);
  }

  async stash(message?: string): Promise<void> {
    const stashButton = this.page.locator('[data-testid="stash-button"]');
    await stashButton.click();
    
    if (message) {
      const messageInput = this.page.locator('[data-testid="stash-message"]');
      await messageInput.fill(message);
    }
    
    const confirmButton = this.page.locator('[data-testid="confirm-stash"]');
    await confirmButton.click();
    
    await this.page.waitForTimeout(300);
  }

  async popStash(index = 0): Promise<void> {
    const stashButton = this.page.locator('[data-testid="stash-button"]');
    await stashButton.click();
    
    const stashList = this.page.locator('[data-testid="stash-list"]');
    await stashList.waitFor({ state: 'visible' });
    
    const stashItem = stashList.locator(`[data-testid="stash-${index}"]`);
    const popButton = stashItem.locator('[data-testid="pop-stash"]');
    await popButton.click();
    
    await this.waitForOperation();
  }

  async getRemotes(): Promise<string[]> {
    const remotesButton = this.page.locator('[data-testid="remotes-button"]');
    await remotesButton.click();
    
    const remotesList = this.page.locator('[data-testid="remotes-list"]');
    await remotesList.waitFor({ state: 'visible' });
    
    const remotes = await remotesList.locator('[data-testid^="remote-"]').all();
    const remoteNames: string[] = [];
    
    for (const remote of remotes) {
      const name = await remote.getAttribute('data-remote-name');
      if (name) remoteNames.push(name);
    }
    
    const closeButton = this.page.locator('[data-testid="close-remotes"]');
    await closeButton.click();
    
    return remoteNames;
  }

  async addRemote(name: string, url: string): Promise<void> {
    const remotesButton = this.page.locator('[data-testid="remotes-button"]');
    await remotesButton.click();
    
    const addButton = this.page.locator('[data-testid="add-remote"]');
    await addButton.click();
    
    const nameInput = this.page.locator('[data-testid="remote-name"]');
    const urlInput = this.page.locator('[data-testid="remote-url"]');
    
    await nameInput.fill(name);
    await urlInput.fill(url);
    
    const confirmButton = this.page.locator('[data-testid="confirm-add-remote"]');
    await confirmButton.click();
    
    await this.page.waitForTimeout(300);
  }

  async getTags(): Promise<string[]> {
    await this.switchToTab('branches');
    
    const showTagsButton = this.page.locator('[data-testid="show-tags"]');
    await showTagsButton.click();
    
    const tags = await this.page.locator('[data-testid^="tag-"]').all();
    const tagNames: string[] = [];
    
    for (const tag of tags) {
      const name = await tag.getAttribute('data-tag-name');
      if (name) tagNames.push(name);
    }
    
    return tagNames;
  }

  async createTag(tagName: string, message?: string): Promise<void> {
    const tagButton = this.page.locator('[data-testid="create-tag-button"]');
    await tagButton.click();
    
    const nameInput = this.page.locator('[data-testid="tag-name"]');
    await nameInput.fill(tagName);
    
    if (message) {
      const annotatedCheckbox = this.page.locator('[data-testid="annotated-tag"]');
      await annotatedCheckbox.check();
      
      const messageInput = this.page.locator('[data-testid="tag-message"]');
      await messageInput.fill(message);
    }
    
    const confirmButton = this.page.locator('[data-testid="confirm-create-tag"]');
    await confirmButton.click();
    
    await this.page.waitForTimeout(300);
  }

  async getStatus(): Promise<{ branch: string; ahead: number; behind: number; staged: number; changed: number }> {
    const statusBar = this.page.locator('[data-testid="git-status-bar"]');
    
    return {
      branch: await this.getCurrentBranch(),
      ahead: parseInt(await statusBar.locator('[data-testid="ahead-count"]').textContent() || '0'),
      behind: parseInt(await statusBar.locator('[data-testid="behind-count"]').textContent() || '0'),
      staged: (await this.getStagedFilesList()).length,
      changed: (await this.getChangedFilesList()).length
    };
  }

  private async waitForOperation(timeout = 10000): Promise<void> {
    const spinner = this.page.locator('[data-testid="git-operation-spinner"]');
    
    try {
      await spinner.waitFor({ state: 'visible', timeout: 1000 });
      await spinner.waitFor({ state: 'hidden', timeout });
    } catch {
      // No operation in progress or already completed
    }
  }

  async isOperationInProgress(): Promise<boolean> {
    const spinner = this.page.locator('[data-testid="git-operation-spinner"]');
    return await spinner.isVisible();
  }

  async getLastOperationResult(): Promise<{ success: boolean; message: string }> {
    const notification = this.page.locator('[data-testid="git-notification"]');
    
    if (await notification.isVisible()) {
      const success = await notification.getAttribute('data-type') === 'success';
      const message = await notification.textContent() || '';
      
      return { success, message };
    }
    
    return { success: true, message: '' };
  }
}