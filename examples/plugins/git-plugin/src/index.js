// Git Plugin for Orchflow
const { orchflow } = require('@orchflow/plugin-api');

let gitTerminal = null;
let outputChannel = null;

// Plugin activation
exports.activate = function(context) {
    console.log('Git plugin activated');
    
    // Create output channel
    outputChannel = orchflow.window.createOutputChannel('Git');
    
    // Register commands
    context.subscriptions.push(
        orchflow.commands.registerCommand('git.status', gitStatus),
        orchflow.commands.registerCommand('git.commit', gitCommit),
        orchflow.commands.registerCommand('git.push', gitPush),
        orchflow.commands.registerCommand('git.pull', gitPull),
        orchflow.commands.registerCommand('git.branch', gitBranch),
        orchflow.commands.registerCommand('git.diff', gitDiff)
    );
    
    // Watch for git changes
    const gitWatcher = orchflow.workspace.createFileSystemWatcher('**/.git/**');
    context.subscriptions.push(gitWatcher);
    
    gitWatcher.onDidChange(() => {
        updateGitStatus();
    });
};

// Plugin deactivation
exports.deactivate = function() {
    console.log('Git plugin deactivated');
    if (gitTerminal) {
        gitTerminal.dispose();
    }
    if (outputChannel) {
        outputChannel.dispose();
    }
};

// Git Status command
async function gitStatus() {
    const terminal = getGitTerminal();
    terminal.sendText('git status');
    terminal.show();
}

// Git Commit command
async function gitCommit() {
    // Get commit message
    const message = await orchflow.window.showInputBox({
        prompt: 'Commit message',
        placeholder: 'Enter commit message',
        validateInput: (text) => {
            return text.length < 3 ? 'Message must be at least 3 characters' : null;
        }
    });
    
    if (!message) {
        return;
    }
    
    // Stage all changes
    const shouldStageAll = await orchflow.window.showQuickPick(['Yes', 'No'], {
        placeHolder: 'Stage all changes?'
    });
    
    const terminal = getGitTerminal();
    
    if (shouldStageAll === 'Yes') {
        terminal.sendText('git add -A');
    }
    
    // Commit with message
    terminal.sendText(`git commit -m "${message}"`);
    terminal.show();
}

// Git Push command
async function gitPush() {
    const terminal = getGitTerminal();
    
    // Check if we need to set upstream
    const result = await executeGitCommand('git status -sb');
    if (result.includes('no upstream')) {
        const branch = await executeGitCommand('git branch --show-current');
        terminal.sendText(`git push -u origin ${branch.trim()}`);
    } else {
        terminal.sendText('git push');
    }
    
    terminal.show();
}

// Git Pull command
async function gitPull() {
    const terminal = getGitTerminal();
    terminal.sendText('git pull');
    terminal.show();
}

// Git Branch command
async function gitBranch() {
    // Get list of branches
    const branches = await executeGitCommand('git branch -a');
    const branchList = branches
        .split('\n')
        .filter(b => b.trim())
        .map(b => b.replace(/^\*?\s*/, ''));
    
    // Show branch picker
    const selected = await orchflow.window.showQuickPick(branchList, {
        placeHolder: 'Select branch to switch to'
    });
    
    if (!selected) {
        return;
    }
    
    const terminal = getGitTerminal();
    
    // Check if it's a remote branch
    if (selected.startsWith('remotes/origin/')) {
        const localBranch = selected.replace('remotes/origin/', '');
        terminal.sendText(`git checkout -b ${localBranch} ${selected}`);
    } else {
        terminal.sendText(`git checkout ${selected}`);
    }
    
    terminal.show();
}

// Git Diff command
async function gitDiff() {
    // Get list of modified files
    const files = await executeGitCommand('git diff --name-only');
    const fileList = files.split('\n').filter(f => f.trim());
    
    if (fileList.length === 0) {
        orchflow.window.showInformationMessage('No changes to show');
        return;
    }
    
    // Show file picker
    const selected = await orchflow.window.showQuickPick(fileList, {
        placeHolder: 'Select file to view diff'
    });
    
    if (!selected) {
        return;
    }
    
    const terminal = getGitTerminal();
    terminal.sendText(`git diff ${selected}`);
    terminal.show();
}

// Helper: Get or create git terminal
function getGitTerminal() {
    if (!gitTerminal || gitTerminal.exitStatus) {
        gitTerminal = orchflow.window.createTerminal({
            name: 'Git',
            cwd: orchflow.workspace.workspaceFolders?.[0]?.uri.fsPath
        });
    }
    return gitTerminal;
}

// Helper: Execute git command and return output
async function executeGitCommand(command) {
    return new Promise((resolve, reject) => {
        const { exec } = require('child_process');
        const cwd = orchflow.workspace.workspaceFolders?.[0]?.uri.fsPath;
        
        exec(command, { cwd }, (error, stdout, stderr) => {
            if (error) {
                outputChannel.appendLine(`Error: ${error.message}`);
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}

// Helper: Update git status in status bar
async function updateGitStatus() {
    try {
        const branch = await executeGitCommand('git branch --show-current');
        const status = await executeGitCommand('git status --porcelain');
        
        const modifiedCount = status.split('\n').filter(l => l.trim()).length;
        
        // Update status bar
        orchflow.window.setStatusBarMessage(
            `$(git-branch) ${branch.trim()} ${modifiedCount > 0 ? `$(git-commit) ${modifiedCount}` : ''}`,
            'git.status'
        );
    } catch (error) {
        // Not a git repository
    }
}