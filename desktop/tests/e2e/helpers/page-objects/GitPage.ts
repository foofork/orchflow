/**
 * Git Page Object
 * Handles git-related UI interactions and operations
 */

import type { Page, Locator } from 'playwright';
import { BasePage } from './BasePage';

interface GitStatus {
  staged: string[];
  modified: string[];
  untracked: string[];
}

interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
}

interface CommitDetails extends CommitInfo {
  files: string[];
  additions: number;
  deletions: number;
}

interface SyncStatus {
  ahead: number;
  behind: number;
}

interface StashInfo {
  id: number;
  message: string;
  date: string;
}

export class GitPage extends BasePage {
  // Selectors
  private readonly gitPanel = '[data-testid="git-panel"]';
  private readonly statusList = '[data-testid="git-status-list"]';
  private readonly stagedList = '[data-testid="staged-files"]';
  private readonly changedList = '[data-testid="changed-files"]';
  private readonly commitButton = '[data-testid="commit-button"]';
  private readonly commitMessage = '[data-testid="commit-message"]';
  private readonly branchSelector = '[data-testid="branch-selector"]';
  private readonly syncButton = '[data-testid="sync-button"]';
  private readonly historyPanel = '[data-testid="git-history"]';
  private readonly diffViewer = '[data-testid="diff-viewer"]';
  private readonly errorMessage = '[data-testid="git-error"]';
  private readonly authDialog = '[data-testid="auth-dialog"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Initialize repository
   */
  async initializeRepository() {
    await this.clickElement('[data-testid="init-repo"]');
    await this.waitForElement(this.gitPanel);
  }

  /**
   * Check if current directory is a git repository
   */
  async isGitRepository(): Promise<boolean> {
    return await this.elementExists(this.gitPanel);
  }

  /**
   * Clone repository
   */
  async cloneRepository(url: string, path: string) {
    await this.clickElement('[data-testid="clone-repo"]');
    await this.fillInput('[data-testid="clone-url"]', url);
    await this.fillInput('[data-testid="clone-path"]', path);
    await this.clickElement('[data-testid="clone-button"]');
    
    // Wait for clone to complete
    await this.waitForCondition(
      async () => {
        const progress = await this.elementExists('[data-testid="clone-progress"]');
        return !progress;
      },
      { timeout: 30000 }
    );
  }

  /**
   * Get current branch
   */
  async getCurrentBranch(): Promise<string> {
    const branchElement = await this.waitForElement('[data-testid="current-branch"]');
    return await branchElement.textContent() || 'main';
  }

  /**
   * Get repository status
   */
  async getStatus(): Promise<GitStatus> {
    await this.clickElement('[data-testid="refresh-status"]');
    await this.page.waitForTimeout(500);

    const staged = await this.getAllElements(`${this.stagedList} [data-testid="file-item"]`);
    const modified = await this.getAllElements(`${this.changedList} [data-testid="file-item"][data-status="modified"]`);
    const untracked = await this.getAllElements(`${this.changedList} [data-testid="file-item"][data-status="untracked"]`);

    return {
      staged: (await Promise.all(staged.map(async el => el.getAttribute('data-file')))).filter((file): file is string => file !== null),
      modified: (await Promise.all(modified.map(async el => el.getAttribute('data-file')))).filter((file): file is string => file !== null),
      untracked: (await Promise.all(untracked.map(async el => el.getAttribute('data-file')))).filter((file): file is string => file !== null)
    };
  }

  /**
   * Stage file
   */
  async stageFile(fileName: string) {
    const fileItem = `[data-testid="file-item"][data-file="${fileName}"]`;
    await this.hover(fileItem);
    await this.clickElement(`${fileItem} [data-testid="stage-file"]`);
    await this.page.waitForTimeout(200);
  }

  /**
   * Stage all files
   */
  async stageAll() {
    await this.clickElement('[data-testid="stage-all"]');
    await this.page.waitForTimeout(200);
  }

  /**
   * Unstage file
   */
  async unstageFile(fileName: string) {
    const fileItem = `${this.stagedList} [data-testid="file-item"][data-file="${fileName}"]`;
    await this.hover(fileItem);
    await this.clickElement(`${fileItem} [data-testid="unstage-file"]`);
    await this.page.waitForTimeout(200);
  }

  /**
   * Commit changes
   */
  async commit(message: string) {
    await this.fillInput(this.commitMessage, message);
    await this.clickElement(this.commitButton);
    
    // Wait for commit to complete
    await this.waitForCondition(
      async () => {
        const isDisabled = await this.page.locator(this.commitButton).isDisabled();
        return !isDisabled;
      },
      { timeout: 5000 }
    );
  }

  /**
   * Amend commit
   */
  async amendCommit(newMessage: string) {
    await this.clickElement('[data-testid="amend-checkbox"]');
    await this.fillInput(this.commitMessage, newMessage);
    await this.clickElement(this.commitButton);
  }

  /**
   * Open commit dialog
   */
  async openCommitDialog() {
    await this.clickElement('[data-testid="commit-options"]');
  }

  /**
   * Select commit template
   */
  async selectCommitTemplate(template: string) {
    await this.clickElement('[data-testid="template-selector"]');
    await this.clickElement(`[data-testid="template-${template}"]`);
  }

  /**
   * Get commit message
   */
  async getCommitMessage(): Promise<string> {
    const input = await this.waitForElement(this.commitMessage);
    return await input.inputValue();
  }

  /**
   * View diff
   */
  async viewDiff(fileName: string) {
    const fileItem = `[data-testid="file-item"][data-file="${fileName}"]`;
    await this.clickElement(fileItem);
    await this.waitForElement(this.diffViewer);
  }

  /**
   * Get diff content
   */
  async getDiffContent(): Promise<string> {
    return await this.getTextContent(this.diffViewer);
  }

  /**
   * Create branch
   */
  async createBranch(branchName: string) {
    await this.clickElement(this.branchSelector);
    await this.clickElement('[data-testid="create-branch"]');
    await this.fillInput('[data-testid="branch-name"]', branchName);
    await this.clickElement('[data-testid="create-branch-button"]');
  }

  /**
   * Switch branch
   */
  async switchBranch(branchName: string) {
    await this.clickElement(this.branchSelector);
    await this.clickElement(`[data-testid="branch-item"][data-branch="${branchName}"]`);
  }

  /**
   * Get branches
   */
  async getBranches(): Promise<string[]> {
    await this.clickElement(this.branchSelector);
    const branches = await this.getAllElements('[data-testid="branch-item"]');
    const names = await Promise.all(
      branches.map(async b => b.getAttribute('data-branch'))
    );
    await this.pressKey('Escape'); // Close dropdown
    return names.filter((n): n is string => n !== null);
  }

  /**
   * Delete branch
   */
  async deleteBranch(branchName: string) {
    await this.clickElement(this.branchSelector);
    const branchItem = `[data-testid="branch-item"][data-branch="${branchName}"]`;
    await this.hover(branchItem);
    await this.clickElement(`${branchItem} [data-testid="delete-branch"]`);
    await this.confirmDialog();
  }

  /**
   * Merge branch
   */
  async mergeBranch(branchName: string) {
    await this.clickElement('[data-testid="merge-button"]');
    await this.selectOption('[data-testid="merge-branch-select"]', branchName);
    await this.clickElement('[data-testid="perform-merge"]');
  }

  /**
   * Check for conflicts
   */
  async hasConflicts(): Promise<boolean> {
    return await this.elementExists('[data-testid="merge-conflicts"]');
  }

  /**
   * Get conflicted files
   */
  async getConflictedFiles(): Promise<string[]> {
    const conflicts = await this.getAllElements('[data-testid="conflict-file"]');
    const fileNames = await Promise.all(
      conflicts.map(async c => c.getAttribute('data-file'))
    );
    return fileNames.filter((name): name is string => name !== null);
  }

  /**
   * Add remote
   */
  async addRemote(name: string, url: string) {
    await this.clickElement('[data-testid="remotes-button"]');
    await this.clickElement('[data-testid="add-remote"]');
    await this.fillInput('[data-testid="remote-name"]', name);
    await this.fillInput('[data-testid="remote-url"]', url);
    await this.clickElement('[data-testid="add-remote-button"]');
  }

  /**
   * Push to remote
   */
  async push(remote: string, branch: string) {
    await this.clickElement('[data-testid="push-button"]');
    await this.selectOption('[data-testid="push-remote"]', remote);
    await this.selectOption('[data-testid="push-branch"]', branch);
    await this.clickElement('[data-testid="perform-push"]');
    
    // Wait for push to complete
    await this.waitForCondition(
      async () => !await this.elementExists('[data-testid="push-progress"]'),
      { timeout: 30000 }
    );
  }

  /**
   * Pull from remote
   */
  async pull(remote: string, branch: string) {
    await this.clickElement('[data-testid="pull-button"]');
    await this.selectOption('[data-testid="pull-remote"]', remote);
    await this.selectOption('[data-testid="pull-branch"]', branch);
    await this.clickElement('[data-testid="perform-pull"]');
    
    // Wait for pull to complete
    await this.waitForCondition(
      async () => !await this.elementExists('[data-testid="pull-progress"]'),
      { timeout: 30000 }
    );
  }

  /**
   * Fetch from remote
   */
  async fetch(remote: string) {
    await this.clickElement('[data-testid="fetch-button"]');
    await this.selectOption('[data-testid="fetch-remote"]', remote);
    await this.clickElement('[data-testid="perform-fetch"]');
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    const ahead = await this.getTextContent('[data-testid="commits-ahead"]');
    const behind = await this.getTextContent('[data-testid="commits-behind"]');
    
    return {
      ahead: parseInt(ahead) || 0,
      behind: parseInt(behind) || 0
    };
  }

  /**
   * Check if authentication required
   */
  async isAuthenticationRequired(): Promise<boolean> {
    return await this.elementExists(this.authDialog);
  }

  /**
   * Get authentication dialog
   */
  async getAuthenticationDialog(): Promise<Locator | null> {
    if (await this.isAuthenticationRequired()) {
      return this.page.locator(this.authDialog);
    }
    return null;
  }

  /**
   * Stash changes
   */
  async stashChanges(message?: string) {
    await this.clickElement('[data-testid="stash-button"]');
    if (message) {
      await this.fillInput('[data-testid="stash-message"]', message);
    }
    await this.clickElement('[data-testid="create-stash"]');
  }

  /**
   * Get stash list
   */
  async getStashList(): Promise<StashInfo[]> {
    await this.clickElement('[data-testid="stash-dropdown"]');
    const stashes = await this.getAllElements('[data-testid="stash-item"]');
    
    const list: StashInfo[] = [];
    for (const stash of stashes) {
      list.push({
        id: parseInt(await stash.getAttribute('data-stash-id') || '0'),
        message: await stash.locator('[data-testid="stash-message"]').textContent() || '',
        date: await stash.locator('[data-testid="stash-date"]').textContent() || ''
      });
    }
    
    await this.pressKey('Escape'); // Close dropdown
    return list;
  }

  /**
   * Apply stash
   */
  async applyStash(stashId: number) {
    await this.clickElement('[data-testid="stash-dropdown"]');
    const stashItem = `[data-testid="stash-item"][data-stash-id="${stashId}"]`;
    await this.hover(stashItem);
    await this.clickElement(`${stashItem} [data-testid="apply-stash"]`);
  }

  /**
   * Pop stash
   */
  async popStash() {
    await this.clickElement('[data-testid="stash-dropdown"]');
    await this.clickElement('[data-testid="pop-stash"]');
  }

  /**
   * Get commit history
   */
  async getCommitHistory(): Promise<CommitInfo[]> {
    await this.clickElement('[data-testid="history-tab"]');
    await this.waitForElement(this.historyPanel);
    
    const commits = await this.getAllElements('[data-testid="commit-item"]');
    const history: CommitInfo[] = [];
    
    for (const commit of commits) {
      history.push({
        hash: await commit.getAttribute('data-commit-hash') || '',
        message: await commit.locator('[data-testid="commit-message"]').textContent() || '',
        author: await commit.locator('[data-testid="commit-author"]').textContent() || '',
        date: await commit.locator('[data-testid="commit-date"]').textContent() || ''
      });
    }
    
    return history;
  }

  /**
   * Get commit details
   */
  async getCommitDetails(hash: string): Promise<CommitDetails> {
    await this.clickElement(`[data-testid="commit-item"][data-commit-hash="${hash}"]`);
    await this.waitForElement('[data-testid="commit-details"]');
    
    const files = await this.getAllElements('[data-testid="commit-file"]');
    const fileNames = (await Promise.all(
      files.map(async f => f.getAttribute('data-file'))
    )).filter((name): name is string => name !== null);
    
    return {
      hash,
      message: await this.getTextContent('[data-testid="detail-message"]'),
      author: await this.getTextContent('[data-testid="detail-author"]'),
      date: await this.getTextContent('[data-testid="detail-date"]'),
      files: fileNames,
      additions: parseInt(await this.getTextContent('[data-testid="additions"]') || '0'),
      deletions: parseInt(await this.getTextContent('[data-testid="deletions"]') || '0')
    };
  }

  /**
   * Search commits
   */
  async searchCommits(query: string): Promise<CommitInfo[]> {
    await this.fillInput('[data-testid="search-commits"]', query);
    await this.page.waitForTimeout(500); // Debounce
    return await this.getCommitHistory();
  }

  /**
   * Get file history
   */
  async getFileHistory(fileName: string): Promise<CommitInfo[]> {
    await this.rightClick(`[data-testid="file-item"][data-file="${fileName}"]`);
    await this.clickElement('[data-testid="view-file-history"]');
    await this.waitForElement('[data-testid="file-history-panel"]');
    
    return await this.getCommitHistory();
  }

  /**
   * Create tag
   */
  async createTag(tagName: string, message?: string) {
    await this.clickElement('[data-testid="tags-button"]');
    await this.clickElement('[data-testid="create-tag"]');
    await this.fillInput('[data-testid="tag-name"]', tagName);
    
    if (message) {
      await this.fillInput('[data-testid="tag-message"]', message);
    }
    
    await this.clickElement('[data-testid="create-tag-button"]');
  }

  /**
   * Get tags
   */
  async getTags(): Promise<string[]> {
    await this.clickElement('[data-testid="tags-button"]');
    const tags = await this.getAllElements('[data-testid="tag-item"]');
    const names = await Promise.all(
      tags.map(async t => t.getAttribute('data-tag'))
    );
    await this.pressKey('Escape'); // Close dropdown
    return names.filter((name): name is string => name !== null);
  }

  /**
   * Push tags
   */
  async pushTags(remote: string) {
    await this.clickElement('[data-testid="push-button"]');
    await this.clickElement('[data-testid="push-tags-checkbox"]');
    await this.selectOption('[data-testid="push-remote"]', remote);
    await this.clickElement('[data-testid="perform-push"]');
  }

  /**
   * Delete tag
   */
  async deleteTag(tagName: string) {
    await this.clickElement('[data-testid="tags-button"]');
    const tagItem = `[data-testid="tag-item"][data-tag="${tagName}"]`;
    await this.hover(tagItem);
    await this.clickElement(`${tagItem} [data-testid="delete-tag"]`);
    await this.confirmDialog();
  }

  /**
   * Get error message
   */
  async getErrorMessage(): Promise<string> {
    try {
      return await this.getTextContent(this.errorMessage);
    } catch {
      return '';
    }
  }

  /**
   * Refresh status
   */
  async refreshStatus() {
    await this.clickElement('[data-testid="refresh-status"]');
    await this.page.waitForTimeout(500);
  }

  /**
   * Confirm dialog
   */
  async confirmDialog() {
    await this.clickElement('[data-testid="confirm-button"]');
  }
}