/**
 * Git Integration E2E Tests
 * Tests git clone, commit, push, pull, and other git operations
 */

import { TestContext } from '../helpers/test-context';
import { GitPage } from '../helpers/page-objects/GitPage';
import { FileExplorerPage } from '../helpers/page-objects/FileExplorerPage';
import { EditorPage } from '../helpers/page-objects/EditorPage';
import * as path from 'path';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Git Integration Flow', () => {
  let testContext: TestContext;
  let gitPage: GitPage;
  let fileExplorer: FileExplorerPage;
  let editor: EditorPage;
  let testRepo: string;
  let remoteRepo: string;

  beforeEach(async () => {
    testContext = new TestContext({
      headless: process.env.CI === 'true',
      trace: true
    });
    await testContext.setup();
    
    const { page, baseUrl } = await testContext.createPage();
    gitPage = new GitPage(page);
    fileExplorer = new FileExplorerPage(page);
    editor = new EditorPage(page);

    // Create test repositories
    const dataDir = testContext.getDataDir() || '';
    testRepo = path.join(dataDir, 'test-repo');
    remoteRepo = path.join(dataDir, 'remote-repo');

    // Initialize remote repository
    await fs.mkdir(remoteRepo, { recursive: true });
    await execAsync('git init --bare', { cwd: remoteRepo });

    await page.goto(baseUrl);
  });

  afterEach(async () => {
    await testContext.captureState('git-flow');
    await testContext.teardown();
  });

  describe('Repository Initialization', () => {
    test('should initialize a new repository', async () => {
      // Arrange
      await fileExplorer.openWorkspace(testRepo);

      // Act
      await gitPage.initializeRepository();

      // Assert
      expect(await gitPage.isGitRepository()).toBe(true);
      expect(await gitPage.getCurrentBranch()).toBe('main');
      const status = await gitPage.getStatus();
      expect(status.modified).toHaveLength(0);
      expect(status.untracked).toHaveLength(0);
    });

    test('should clone a repository', async () => {
      // Arrange - Create a repo with content
      await execAsync(`git clone ${remoteRepo} temp-source`, { cwd: testContext.getDataDir() });
      const sourceRepo = path.join(testContext.getDataDir()!, 'temp-source');
      await fs.writeFile(path.join(sourceRepo, 'README.md'), '# Test Repo');
      await execAsync('git add . && git commit -m "Initial commit"', { cwd: sourceRepo });
      await execAsync(`git push origin main`, { cwd: sourceRepo });

      // Act
      await gitPage.cloneRepository(remoteRepo, testRepo);

      // Assert
      await fileExplorer.openWorkspace(testRepo);
      expect(await gitPage.isGitRepository()).toBe(true);
      expect(await fileExplorer.fileExists('README.md')).toBe(true);
    });

    test('should handle clone errors gracefully', async () => {
      // Act - Try to clone non-existent repository
      await gitPage.cloneRepository('https://invalid-repo-url.git', testRepo);

      // Assert
      const error = await gitPage.getErrorMessage();
      expect(error).toContain('Failed to clone');
    });
  });

  describe('File Changes and Staging', () => {
    beforeEach(async () => {
      await fileExplorer.openWorkspace(testRepo);
      await gitPage.initializeRepository();
    });

    test('should detect file changes', async () => {
      // Act
      await fileExplorer.createFile('test.js');
      await editor.setContent('console.log("test");');
      await editor.save();

      // Assert
      const status = await gitPage.getStatus();
      expect(status.untracked).toContain('test.js');
    });

    test('should stage files', async () => {
      // Arrange
      await fileExplorer.createFile('file1.js');
      await fileExplorer.createFile('file2.js');

      // Act
      await gitPage.stageFile('file1.js');

      // Assert
      const status = await gitPage.getStatus();
      expect(status.staged).toContain('file1.js');
      expect(status.untracked).toContain('file2.js');
    });

    test('should stage all files', async () => {
      // Arrange
      await fileExplorer.createFile('file1.js');
      await fileExplorer.createFile('file2.js');
      await fileExplorer.createFile('file3.js');

      // Act
      await gitPage.stageAll();

      // Assert
      const status = await gitPage.getStatus();
      expect(status.staged).toHaveLength(3);
      expect(status.untracked).toHaveLength(0);
    });

    test('should unstage files', async () => {
      // Arrange
      await fileExplorer.createFile('test.js');
      await gitPage.stageFile('test.js');

      // Act
      await gitPage.unstageFile('test.js');

      // Assert
      const status = await gitPage.getStatus();
      expect(status.staged).toHaveLength(0);
      expect(status.untracked).toContain('test.js');
    });

    test('should show diff for modified files', async () => {
      // Arrange
      await fileExplorer.createFile('test.js');
      await editor.setContent('line 1\nline 2\nline 3');
      await editor.save();
      await gitPage.stageAll();
      await gitPage.commit('Initial commit');
      
      // Modify file
      await editor.setContent('line 1 modified\nline 2\nline 3\nline 4');
      await editor.save();

      // Act
      await gitPage.viewDiff('test.js');

      // Assert
      const diff = await gitPage.getDiffContent();
      expect(diff).toContain('-line 1');
      expect(diff).toContain('+line 1 modified');
      expect(diff).toContain('+line 4');
    });
  });

  describe('Committing Changes', () => {
    beforeEach(async () => {
      await fileExplorer.openWorkspace(testRepo);
      await gitPage.initializeRepository();
    });

    test('should commit staged changes', async () => {
      // Arrange
      await fileExplorer.createFile('test.js');
      await gitPage.stageAll();

      // Act
      await gitPage.commit('Add test.js file');

      // Assert
      const status = await gitPage.getStatus();
      expect(status.staged).toHaveLength(0);
      expect(status.modified).toHaveLength(0);
      
      const history = await gitPage.getCommitHistory();
      expect(history[0].message).toBe('Add test.js file');
    });

    test('should validate commit message', async () => {
      // Arrange
      await fileExplorer.createFile('test.js');
      await gitPage.stageAll();

      // Act - Try to commit with empty message
      await gitPage.commit('');

      // Assert
      const error = await gitPage.getErrorMessage();
      expect(error).toContain('Commit message is required');
    });

    test('should amend last commit', async () => {
      // Arrange
      await fileExplorer.createFile('file1.js');
      await gitPage.stageAll();
      await gitPage.commit('Initial commit');
      
      await fileExplorer.createFile('file2.js');
      await gitPage.stageAll();

      // Act
      await gitPage.amendCommit('Initial commit with both files');

      // Assert
      const history = await gitPage.getCommitHistory();
      expect(history).toHaveLength(1);
      expect(history[0].message).toBe('Initial commit with both files');
    });

    test('should support commit templates', async () => {
      // Act
      await fileExplorer.createFile('feature.js');
      await gitPage.stageAll();
      await gitPage.openCommitDialog();
      await gitPage.selectCommitTemplate('feature');

      // Assert
      const message = await gitPage.getCommitMessage();
      expect(message).toContain('feat:');
      expect(message).toContain('[scope]');
    });
  });

  describe('Branching', () => {
    beforeEach(async () => {
      await fileExplorer.openWorkspace(testRepo);
      await gitPage.initializeRepository();
      
      // Create initial commit
      await fileExplorer.createFile('README.md');
      await gitPage.stageAll();
      await gitPage.commit('Initial commit');
    });

    test('should create new branch', async () => {
      // Act
      await gitPage.createBranch('feature/new-feature');

      // Assert
      expect(await gitPage.getCurrentBranch()).toBe('feature/new-feature');
      const branches = await gitPage.getBranches();
      expect(branches).toContain('main');
      expect(branches).toContain('feature/new-feature');
    });

    test('should switch branches', async () => {
      // Arrange
      await gitPage.createBranch('develop');
      
      // Act
      await gitPage.switchBranch('main');

      // Assert
      expect(await gitPage.getCurrentBranch()).toBe('main');
    });

    test('should delete branch', async () => {
      // Arrange
      await gitPage.createBranch('temp-branch');
      await gitPage.switchBranch('main');

      // Act
      await gitPage.deleteBranch('temp-branch');

      // Assert
      const branches = await gitPage.getBranches();
      expect(branches).not.toContain('temp-branch');
    });

    test('should merge branches', async () => {
      // Arrange
      await gitPage.createBranch('feature');
      await fileExplorer.createFile('feature.js');
      await gitPage.stageAll();
      await gitPage.commit('Add feature');
      await gitPage.switchBranch('main');

      // Act
      await gitPage.mergeBranch('feature');

      // Assert
      expect(await fileExplorer.fileExists('feature.js')).toBe(true);
      const history = await gitPage.getCommitHistory();
      expect(history[0].message).toContain('Merge');
    });

    test('should handle merge conflicts', async () => {
      // Create conflict scenario
      await fileExplorer.createFile('conflict.txt');
      await editor.setContent('main branch content');
      await editor.save();
      await gitPage.stageAll();
      await gitPage.commit('Main branch commit');

      await gitPage.createBranch('conflict-branch');
      await editor.setContent('feature branch content');
      await editor.save();
      await gitPage.stageAll();
      await gitPage.commit('Feature branch commit');

      await gitPage.switchBranch('main');
      await editor.setContent('updated main content');
      await editor.save();
      await gitPage.stageAll();
      await gitPage.commit('Update on main');

      // Act
      await gitPage.mergeBranch('conflict-branch');

      // Assert
      expect(await gitPage.hasConflicts()).toBe(true);
      const conflicts = await gitPage.getConflictedFiles();
      expect(conflicts).toContain('conflict.txt');
    });
  });

  describe('Remote Operations', () => {
    beforeEach(async () => {
      await fileExplorer.openWorkspace(testRepo);
      await gitPage.initializeRepository();
      await gitPage.addRemote('origin', remoteRepo);
      
      // Initial commit
      await fileExplorer.createFile('README.md');
      await gitPage.stageAll();
      await gitPage.commit('Initial commit');
    });

    test('should push to remote', async () => {
      // Act
      await gitPage.push('origin', 'main');

      // Assert
      const status = await gitPage.getSyncStatus();
      expect(status.ahead).toBe(0);
      expect(status.behind).toBe(0);
    });

    test('should pull from remote', async () => {
      // Setup - Push from another clone
      const otherRepo = path.join(testContext.getDataDir()!, 'other-repo');
      await execAsync(`git clone ${remoteRepo} ${otherRepo}`);
      await fs.writeFile(path.join(otherRepo, 'remote-file.txt'), 'Remote content');
      await execAsync('git add . && git commit -m "Remote commit"', { cwd: otherRepo });
      await execAsync('git push origin main', { cwd: otherRepo });

      // Act
      await gitPage.pull('origin', 'main');

      // Assert
      expect(await fileExplorer.fileExists('remote-file.txt')).toBe(true);
    });

    test('should fetch from remote', async () => {
      // Setup - Push from another clone
      const otherRepo = path.join(testContext.getDataDir()!, 'other-repo');
      await execAsync(`git clone ${remoteRepo} ${otherRepo}`);
      await fs.writeFile(path.join(otherRepo, 'remote-file.txt'), 'Remote content');
      await execAsync('git add . && git commit -m "Remote commit"', { cwd: otherRepo });
      await execAsync('git push origin main', { cwd: otherRepo });

      // Act
      await gitPage.fetch('origin');

      // Assert
      const status = await gitPage.getSyncStatus();
      expect(status.behind).toBe(1);
    });

    test('should handle authentication', async () => {
      // Act - Try to push to authenticated remote
      await gitPage.addRemote('github', 'https://github.com/test/repo.git');
      await gitPage.push('github', 'main');

      // Assert
      expect(await gitPage.isAuthenticationRequired()).toBe(true);
      const authDialog = await gitPage.getAuthenticationDialog();
      expect(authDialog).toBeTruthy();
    });
  });

  describe('Stash Operations', () => {
    beforeEach(async () => {
      await fileExplorer.openWorkspace(testRepo);
      await gitPage.initializeRepository();
      
      // Initial commit
      await fileExplorer.createFile('base.js');
      await gitPage.stageAll();
      await gitPage.commit('Initial commit');
    });

    test('should stash changes', async () => {
      // Arrange
      await fileExplorer.createFile('work-in-progress.js');
      await editor.setContent('unfinished work');
      await editor.save();

      // Act
      await gitPage.stashChanges('WIP: New feature');

      // Assert
      const status = await gitPage.getStatus();
      expect(status.modified).toHaveLength(0);
      expect(status.untracked).toHaveLength(0);
      
      const stashes = await gitPage.getStashList();
      expect(stashes).toHaveLength(1);
      expect(stashes[0].message).toContain('WIP: New feature');
    });

    test('should apply stash', async () => {
      // Arrange
      await fileExplorer.createFile('stashed.js');
      await gitPage.stashChanges();

      // Act
      await gitPage.applyStash(0);

      // Assert
      expect(await fileExplorer.fileExists('stashed.js')).toBe(true);
      const stashes = await gitPage.getStashList();
      expect(stashes).toHaveLength(1); // Stash still exists after apply
    });

    test('should pop stash', async () => {
      // Arrange
      await fileExplorer.createFile('stashed.js');
      await gitPage.stashChanges();

      // Act
      await gitPage.popStash();

      // Assert
      expect(await fileExplorer.fileExists('stashed.js')).toBe(true);
      const stashes = await gitPage.getStashList();
      expect(stashes).toHaveLength(0); // Stash removed after pop
    });
  });

  describe('Git History and Log', () => {
    beforeEach(async () => {
      await fileExplorer.openWorkspace(testRepo);
      await gitPage.initializeRepository();
      
      // Create some history
      for (let i = 1; i <= 5; i++) {
        await fileExplorer.createFile(`file${i}.js`);
        await gitPage.stageAll();
        await gitPage.commit(`Commit ${i}`);
      }
    });

    test('should view commit history', async () => {
      // Act
      const history = await gitPage.getCommitHistory();

      // Assert
      expect(history).toHaveLength(5);
      expect(history[0].message).toBe('Commit 5');
      expect(history[4].message).toBe('Commit 1');
    });

    test('should view commit details', async () => {
      // Act
      const history = await gitPage.getCommitHistory();
      const details = await gitPage.getCommitDetails(history[0].hash);

      // Assert
      expect(details.message).toBe('Commit 5');
      expect(details.files).toContain('file5.js');
      expect(details.additions).toBeGreaterThan(0);
    });

    test('should search commits', async () => {
      // Act
      const results = await gitPage.searchCommits('Commit 3');

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].message).toBe('Commit 3');
    });

    test('should view file history', async () => {
      // Arrange - Modify a file multiple times
      await fileExplorer.openFile('file1.js');
      await editor.setContent('version 2');
      await editor.save();
      await gitPage.stageAll();
      await gitPage.commit('Update file1.js');

      // Act
      const fileHistory = await gitPage.getFileHistory('file1.js');

      // Assert
      expect(fileHistory).toHaveLength(2);
      expect(fileHistory[0].message).toBe('Update file1.js');
      expect(fileHistory[1].message).toBe('Commit 1');
    });
  });

  describe('Git Tags', () => {
    beforeEach(async () => {
      await fileExplorer.openWorkspace(testRepo);
      await gitPage.initializeRepository();
      
      await fileExplorer.createFile('version.txt');
      await gitPage.stageAll();
      await gitPage.commit('Initial version');
    });

    test('should create tag', async () => {
      // Act
      await gitPage.createTag('v1.0.0', 'First release');

      // Assert
      const tags = await gitPage.getTags();
      expect(tags).toContain('v1.0.0');
    });

    test('should push tags', async () => {
      // Arrange
      await gitPage.addRemote('origin', remoteRepo);
      await gitPage.createTag('v1.0.0');

      // Act
      await gitPage.pushTags('origin');

      // Assert
      // Verify tag exists in remote
      const { stdout } = await execAsync('git tag', { cwd: remoteRepo });
      expect(stdout).toContain('v1.0.0');
    });

    test('should delete tag', async () => {
      // Arrange
      await gitPage.createTag('temp-tag');

      // Act
      await gitPage.deleteTag('temp-tag');

      // Assert
      const tags = await gitPage.getTags();
      expect(tags).not.toContain('temp-tag');
    });
  });

  describe('Performance', () => {
    test('should handle large repositories efficiently', async () => {
      // Create repository with many files
      await fileExplorer.openWorkspace(testRepo);
      await gitPage.initializeRepository();
      
      // Create 100 files
      for (let i = 0; i < 100; i++) {
        await fs.writeFile(
          path.join(testRepo, `file-${i}.txt`),
          `Content ${i}`
        );
      }

      // Act
      const startTime = Date.now();
      await gitPage.refreshStatus();
      const statusTime = Date.now() - startTime;

      // Assert
      expect(statusTime).toBeLessThan(5000); // Should complete within 5 seconds
      const status = await gitPage.getStatus();
      expect(status.untracked).toHaveLength(100);
    });

    test('should display large diffs efficiently', async () => {
      // Create large file
      await fileExplorer.openWorkspace(testRepo);
      await gitPage.initializeRepository();
      
      const largeContent = 'line\n'.repeat(1000);
      await fileExplorer.createFile('large.txt');
      await editor.setContent(largeContent);
      await editor.save();
      await gitPage.stageAll();
      await gitPage.commit('Add large file');

      // Modify file
      await editor.setContent(largeContent + 'new line\n');
      await editor.save();

      // Act
      const startTime = Date.now();
      await gitPage.viewDiff('large.txt');
      const diffTime = Date.now() - startTime;

      // Assert
      expect(diffTime).toBeLessThan(2000); // Should load within 2 seconds
    });
  });
});