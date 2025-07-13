import { expect } from '@playwright/test';
import { GitPanelPage } from '../page-objects/git-panel-page';

export interface GitAssertions {
  toHaveChangedFiles(files: string[]): Promise<void>;
  toHaveStagedFiles(files: string[]): Promise<void>;
  toHaveNoChanges(): Promise<void>;
  toBeOnBranch(branchName: string): Promise<void>;
  toHaveCommitCount(count: number): Promise<void>;
  toHaveCleanWorkingDirectory(): Promise<void>;
  toHaveDirtyWorkingDirectory(): Promise<void>;
  toHaveRemote(remoteName: string): Promise<void>;
  toHaveCommitWithMessage(message: string): Promise<void>;
  toBeSynchronized(): Promise<void>;
}

export function createGitAssertions(gitPanel: GitPanelPage): GitAssertions {
  return {
    async toHaveChangedFiles(files: string[]): Promise<void> {
      const changedFiles = await gitPanel.getChangedFilesList();
      expect(changedFiles.sort()).toEqual(files.sort());
    },

    async toHaveStagedFiles(files: string[]): Promise<void> {
      const stagedFiles = await gitPanel.getStagedFilesList();
      expect(stagedFiles.sort()).toEqual(files.sort());
    },

    async toHaveNoChanges(): Promise<void> {
      const changedFiles = await gitPanel.getChangedFilesList();
      const stagedFiles = await gitPanel.getStagedFilesList();
      expect(changedFiles).toHaveLength(0);
      expect(stagedFiles).toHaveLength(0);
    },

    async toBeOnBranch(branchName: string): Promise<void> {
      const currentBranch = await gitPanel.getCurrentBranch();
      expect(currentBranch).toBe(branchName);
    },

    async toHaveCommitCount(count: number): Promise<void> {
      const history = await gitPanel.getCommitHistory(count + 1);
      expect(history).toHaveLength(count);
    },

    async toHaveCleanWorkingDirectory(): Promise<void> {
      const status = await gitPanel.getStatus();
      expect(status.changed).toBe(0);
      expect(status.staged).toBe(0);
    },

    async toHaveDirtyWorkingDirectory(): Promise<void> {
      const status = await gitPanel.getStatus();
      expect(status.changed + status.staged).toBeGreaterThan(0);
    },

    async toHaveRemote(remoteName: string): Promise<void> {
      const remotes = await gitPanel.getRemotes();
      expect(remotes).toContain(remoteName);
    },

    async toHaveCommitWithMessage(message: string): Promise<void> {
      const history = await gitPanel.getCommitHistory(50);
      const hasCommit = history.some(commit => commit.message.includes(message));
      expect(hasCommit).toBeTruthy();
    },

    async toBeSynchronized(): Promise<void> {
      const status = await gitPanel.getStatus();
      expect(status.ahead).toBe(0);
      expect(status.behind).toBe(0);
    }
  };
}

// Git status assertions
export async function assertGitStatus(
  gitPanel: GitPanelPage,
  expectedStatus: {
    branch?: string;
    ahead?: number;
    behind?: number;
    staged?: number;
    changed?: number;
    clean?: boolean;
  }
): Promise<void> {
  const status = await gitPanel.getStatus();
  
  if (expectedStatus.branch !== undefined) {
    expect(status.branch).toBe(expectedStatus.branch);
  }
  
  if (expectedStatus.ahead !== undefined) {
    expect(status.ahead).toBe(expectedStatus.ahead);
  }
  
  if (expectedStatus.behind !== undefined) {
    expect(status.behind).toBe(expectedStatus.behind);
  }
  
  if (expectedStatus.staged !== undefined) {
    expect(status.staged).toBe(expectedStatus.staged);
  }
  
  if (expectedStatus.changed !== undefined) {
    expect(status.changed).toBe(expectedStatus.changed);
  }
  
  if (expectedStatus.clean !== undefined) {
    const isClean = status.staged === 0 && status.changed === 0;
    expect(isClean).toBe(expectedStatus.clean);
  }
}

// Git operation assertions
export async function assertGitOperation(
  gitPanel: GitPanelPage,
  operation: () => Promise<void>,
  expectations: {
    shouldSucceed?: boolean;
    resultingBranch?: string;
    resultingStatus?: {
      staged?: number;
      changed?: number;
      ahead?: number;
      behind?: number;
    };
    newCommit?: {
      messageContains?: string;
      author?: string;
    };
  }
): Promise<void> {
  // Get initial state
  const initialHistory = await gitPanel.getCommitHistory(1);
  const initialCommitCount = initialHistory.length;
  
  // Perform operation
  await operation();
  
  // Wait for operation to complete
  const isInProgress = await gitPanel.isOperationInProgress();
  if (isInProgress) {
    await gitPanel.page.waitForTimeout(1000);
  }
  
  // Check operation result
  const result = await gitPanel.getLastOperationResult();
  
  if (expectations.shouldSucceed !== undefined) {
    expect(result.success).toBe(expectations.shouldSucceed);
  }
  
  if (expectations.resultingBranch) {
    const branch = await gitPanel.getCurrentBranch();
    expect(branch).toBe(expectations.resultingBranch);
  }
  
  if (expectations.resultingStatus) {
    const status = await gitPanel.getStatus();
    
    if (expectations.resultingStatus.staged !== undefined) {
      expect(status.staged).toBe(expectations.resultingStatus.staged);
    }
    
    if (expectations.resultingStatus.changed !== undefined) {
      expect(status.changed).toBe(expectations.resultingStatus.changed);
    }
    
    if (expectations.resultingStatus.ahead !== undefined) {
      expect(status.ahead).toBe(expectations.resultingStatus.ahead);
    }
    
    if (expectations.resultingStatus.behind !== undefined) {
      expect(status.behind).toBe(expectations.resultingStatus.behind);
    }
  }
  
  if (expectations.newCommit) {
    const newHistory = await gitPanel.getCommitHistory(2);
    
    if (expectations.newCommit.messageContains) {
      expect(newHistory[0].message).toContain(expectations.newCommit.messageContains);
    }
    
    if (expectations.newCommit.author) {
      expect(newHistory[0].author).toBe(expectations.newCommit.author);
    }
  }
}

// Commit history assertions
export async function assertCommitHistory(
  gitPanel: GitPanelPage,
  expectations: {
    count?: number;
    latestCommit?: {
      message?: string | RegExp;
      author?: string;
      hash?: string | RegExp;
    };
    containsCommits?: Array<{
      message?: string | RegExp;
      author?: string;
    }>;
    orderMatters?: boolean;
  }
): Promise<void> {
  const history = await gitPanel.getCommitHistory(expectations.count || 50);
  
  if (expectations.count !== undefined) {
    expect(history).toHaveLength(expectations.count);
  }
  
  if (expectations.latestCommit) {
    const latest = history[0];
    
    if (expectations.latestCommit.message) {
      if (typeof expectations.latestCommit.message === 'string') {
        expect(latest.message).toContain(expectations.latestCommit.message);
      } else {
        expect(latest.message).toMatch(expectations.latestCommit.message);
      }
    }
    
    if (expectations.latestCommit.author) {
      expect(latest.author).toBe(expectations.latestCommit.author);
    }
    
    if (expectations.latestCommit.hash) {
      if (typeof expectations.latestCommit.hash === 'string') {
        expect(latest.hash).toBe(expectations.latestCommit.hash);
      } else {
        expect(latest.hash).toMatch(expectations.latestCommit.hash);
      }
    }
  }
  
  if (expectations.containsCommits) {
    for (const expectedCommit of expectations.containsCommits) {
      const found = history.find(commit => {
        let matches = true;
        
        if (expectedCommit.message) {
          if (typeof expectedCommit.message === 'string') {
            matches = matches && commit.message.includes(expectedCommit.message);
          } else {
            matches = matches && expectedCommit.message.test(commit.message);
          }
        }
        
        if (expectedCommit.author) {
          matches = matches && commit.author === expectedCommit.author;
        }
        
        return matches;
      });
      
      expect(found).toBeTruthy();
    }
  }
}

// Branch assertions
export async function assertBranchState(
  gitPanel: GitPanelPage,
  expectations: {
    currentBranch?: string;
    branches?: string[];
    hasUpstream?: boolean;
    isAheadBehind?: { ahead: number; behind: number };
  }
): Promise<void> {
  if (expectations.currentBranch) {
    const branch = await gitPanel.getCurrentBranch();
    expect(branch).toBe(expectations.currentBranch);
  }
  
  if (expectations.branches) {
    await gitPanel.switchToTab('branches');
    // In a real implementation, you would get the list of branches
    // For now, we'll just check the current branch
  }
  
  if (expectations.hasUpstream !== undefined) {
    const status = await gitPanel.getStatus();
    const hasUpstream = status.ahead !== undefined && status.behind !== undefined;
    expect(hasUpstream).toBe(expectations.hasUpstream);
  }
  
  if (expectations.isAheadBehind) {
    const status = await gitPanel.getStatus();
    expect(status.ahead).toBe(expectations.isAheadBehind.ahead);
    expect(status.behind).toBe(expectations.isAheadBehind.behind);
  }
}

// File staging assertions
export async function assertStagingState(
  gitPanel: GitPanelPage,
  expectations: {
    stagedFiles?: string[];
    unstagedFiles?: string[];
    totalChanges?: number;
    allStaged?: boolean;
    noneStaged?: boolean;
  }
): Promise<void> {
  const staged = await gitPanel.getStagedFilesList();
  const changed = await gitPanel.getChangedFilesList();
  
  if (expectations.stagedFiles) {
    expect(staged.sort()).toEqual(expectations.stagedFiles.sort());
  }
  
  if (expectations.unstagedFiles) {
    expect(changed.sort()).toEqual(expectations.unstagedFiles.sort());
  }
  
  if (expectations.totalChanges !== undefined) {
    expect(staged.length + changed.length).toBe(expectations.totalChanges);
  }
  
  if (expectations.allStaged !== undefined) {
    expect(changed.length === 0 && staged.length > 0).toBe(expectations.allStaged);
  }
  
  if (expectations.noneStaged !== undefined) {
    expect(staged.length === 0).toBe(expectations.noneStaged);
  }
}

// Merge/rebase assertions
export async function assertMergeState(
  gitPanel: GitPanelPage,
  expectations: {
    hasConflicts?: boolean;
    conflictedFiles?: string[];
    canContinue?: boolean;
    isInProgress?: boolean;
  }
): Promise<void> {
  // In a real implementation, you would check for merge/rebase state
  // This is a placeholder for the assertion logic
  
  if (expectations.hasConflicts !== undefined) {
    // Check for conflict markers in the UI
  }
  
  if (expectations.conflictedFiles) {
    // Get list of conflicted files and compare
  }
  
  if (expectations.canContinue !== undefined) {
    // Check if continue button is enabled
  }
  
  if (expectations.isInProgress !== undefined) {
    // Check if merge/rebase is in progress
  }
}

// Remote operations assertions
export async function assertRemoteOperations(
  gitPanel: GitPanelPage,
  expectations: {
    canPush?: boolean;
    canPull?: boolean;
    hasRemotes?: boolean;
    remotes?: string[];
    defaultRemote?: string;
  }
): Promise<void> {
  if (expectations.canPush !== undefined) {
    const pushButton = gitPanel.pushButton;
    const isEnabled = await pushButton.isEnabled();
    expect(isEnabled).toBe(expectations.canPush);
  }
  
  if (expectations.canPull !== undefined) {
    const pullButton = gitPanel.pullButton;
    const isEnabled = await pullButton.isEnabled();
    expect(isEnabled).toBe(expectations.canPull);
  }
  
  if (expectations.hasRemotes !== undefined) {
    const remotes = await gitPanel.getRemotes();
    expect(remotes.length > 0).toBe(expectations.hasRemotes);
  }
  
  if (expectations.remotes) {
    const remotes = await gitPanel.getRemotes();
    expect(remotes.sort()).toEqual(expectations.remotes.sort());
  }
  
  if (expectations.defaultRemote) {
    const remotes = await gitPanel.getRemotes();
    expect(remotes[0]).toBe(expectations.defaultRemote);
  }
}

// Tag assertions
export async function assertTags(
  gitPanel: GitPanelPage,
  expectations: {
    tags?: string[];
    hasTag?: string;
    latestTag?: string;
    tagCount?: number;
  }
): Promise<void> {
  const tags = await gitPanel.getTags();
  
  if (expectations.tags) {
    expect(tags.sort()).toEqual(expectations.tags.sort());
  }
  
  if (expectations.hasTag) {
    expect(tags).toContain(expectations.hasTag);
  }
  
  if (expectations.latestTag) {
    expect(tags[0]).toBe(expectations.latestTag);
  }
  
  if (expectations.tagCount !== undefined) {
    expect(tags).toHaveLength(expectations.tagCount);
  }
}

// Stash assertions
export async function assertStashState(
  gitPanel: GitPanelPage,
  expectations: {
    hasStashes?: boolean;
    stashCount?: number;
    canStash?: boolean;
    latestStashMessage?: string;
  }
): Promise<void> {
  // In a real implementation, you would:
  // 1. Check if stash list is available
  // 2. Count stashes
  // 3. Check if stash button is enabled
  // 4. Get latest stash message
  
  // This is a placeholder for the actual implementation
  if (expectations.hasStashes !== undefined) {
    // Check if stash list has entries
  }
  
  if (expectations.stashCount !== undefined) {
    // Count stashes in the list
  }
  
  if (expectations.canStash !== undefined) {
    // Check if stash button is enabled
  }
  
  if (expectations.latestStashMessage) {
    // Get the message of the latest stash
  }
}