// Docker Plugin for Orchflow
const { orchflow } = require('@orchflow/plugin-api');

let dockerTerminal = null;
let outputChannel = null;

// Plugin activation
exports.activate = function(context) {
    console.log('Docker plugin activated');
    
    // Create output channel
    outputChannel = orchflow.window.createOutputChannel('Docker');
    
    // Register commands
    context.subscriptions.push(
        orchflow.commands.registerCommand('docker.ps', dockerPs),
        orchflow.commands.registerCommand('docker.images', dockerImages),
        orchflow.commands.registerCommand('docker.run', dockerRun),
        orchflow.commands.registerCommand('docker.stop', dockerStop),
        orchflow.commands.registerCommand('docker.logs', dockerLogs),
        orchflow.commands.registerCommand('docker.exec', dockerExec),
        orchflow.commands.registerCommand('docker.compose.up', dockerComposeUp),
        orchflow.commands.registerCommand('docker.compose.down', dockerComposeDown)
    );
    
    // Create container tree view
    const containerProvider = new ContainerProvider();
    orchflow.window.registerTreeDataProvider('dockerContainers', containerProvider);
    
    // Refresh containers periodically
    setInterval(() => {
        containerProvider.refresh();
    }, 5000);
};

// Plugin deactivation
exports.deactivate = function() {
    console.log('Docker plugin deactivated');
    if (dockerTerminal) {
        dockerTerminal.dispose();
    }
    if (outputChannel) {
        outputChannel.dispose();
    }
};

// Docker PS command
async function dockerPs() {
    const showAll = orchflow.workspace.getConfiguration('docker').get('showAllContainers');
    const terminal = getDockerTerminal();
    terminal.sendText(`docker ps ${showAll ? '-a' : ''}`);
    terminal.show();
}

// Docker Images command
async function dockerImages() {
    const terminal = getDockerTerminal();
    terminal.sendText('docker images');
    terminal.show();
}

// Docker Run command
async function dockerRun() {
    // Get list of images
    const images = await executeDockerCommand('docker images --format "{{.Repository}}:{{.Tag}}"');
    const imageList = images.split('\n').filter(i => i.trim() && !i.includes('<none>'));
    
    // Select image
    const image = await orchflow.window.showQuickPick(imageList, {
        placeHolder: 'Select image to run'
    });
    
    if (!image) {
        return;
    }
    
    // Get container name
    const name = await orchflow.window.showInputBox({
        prompt: 'Container name (optional)',
        placeholder: 'my-container'
    });
    
    // Get port mapping
    const ports = await orchflow.window.showInputBox({
        prompt: 'Port mapping (optional)',
        placeholder: '8080:80',
        validateInput: (text) => {
            if (!text) return null;
            return /^\d+:\d+$/.test(text) ? null : 'Format: hostPort:containerPort';
        }
    });
    
    // Build command
    let command = 'docker run -d';
    if (name) command += ` --name ${name}`;
    if (ports) command += ` -p ${ports}`;
    command += ` ${image}`;
    
    const terminal = getDockerTerminal();
    terminal.sendText(command);
    terminal.show();
}

// Docker Stop command
async function dockerStop() {
    // Get running containers
    const containers = await executeDockerCommand('docker ps --format "{{.Names}}"');
    const containerList = containers.split('\n').filter(c => c.trim());
    
    if (containerList.length === 0) {
        orchflow.window.showInformationMessage('No running containers');
        return;
    }
    
    // Select container
    const container = await orchflow.window.showQuickPick(containerList, {
        placeHolder: 'Select container to stop'
    });
    
    if (!container) {
        return;
    }
    
    const terminal = getDockerTerminal();
    terminal.sendText(`docker stop ${container}`);
    terminal.show();
}

// Docker Logs command
async function dockerLogs() {
    // Get all containers
    const containers = await executeDockerCommand('docker ps -a --format "{{.Names}}"');
    const containerList = containers.split('\n').filter(c => c.trim());
    
    if (containerList.length === 0) {
        orchflow.window.showInformationMessage('No containers found');
        return;
    }
    
    // Select container
    const container = await orchflow.window.showQuickPick(containerList, {
        placeHolder: 'Select container to view logs'
    });
    
    if (!container) {
        return;
    }
    
    // Follow logs?
    const follow = await orchflow.window.showQuickPick(['Yes', 'No'], {
        placeHolder: 'Follow logs?'
    });
    
    const terminal = getDockerTerminal();
    terminal.sendText(`docker logs ${follow === 'Yes' ? '-f' : ''} ${container}`);
    terminal.show();
}

// Docker Exec command
async function dockerExec() {
    // Get running containers
    const containers = await executeDockerCommand('docker ps --format "{{.Names}}"');
    const containerList = containers.split('\n').filter(c => c.trim());
    
    if (containerList.length === 0) {
        orchflow.window.showInformationMessage('No running containers');
        return;
    }
    
    // Select container
    const container = await orchflow.window.showQuickPick(containerList, {
        placeHolder: 'Select container to execute command in'
    });
    
    if (!container) {
        return;
    }
    
    // Get command
    const defaultShell = orchflow.workspace.getConfiguration('docker').get('defaultShell');
    const command = await orchflow.window.showInputBox({
        prompt: 'Command to execute',
        value: defaultShell
    });
    
    if (!command) {
        return;
    }
    
    const terminal = getDockerTerminal();
    terminal.sendText(`docker exec -it ${container} ${command}`);
    terminal.show();
}

// Docker Compose Up command
async function dockerComposeUp() {
    const terminal = getDockerTerminal();
    
    // Check for docker-compose file
    const files = await orchflow.workspace.findFiles('docker-compose*.{yml,yaml}', null, 10);
    
    if (files.length === 0) {
        orchflow.window.showErrorMessage('No docker-compose.yml file found');
        return;
    }
    
    // Detached mode?
    const detached = await orchflow.window.showQuickPick(['Yes', 'No'], {
        placeHolder: 'Run in detached mode?'
    });
    
    terminal.sendText(`docker-compose up ${detached === 'Yes' ? '-d' : ''}`);
    terminal.show();
}

// Docker Compose Down command
async function dockerComposeDown() {
    const terminal = getDockerTerminal();
    terminal.sendText('docker-compose down');
    terminal.show();
}

// Helper: Get or create docker terminal
function getDockerTerminal() {
    if (!dockerTerminal || dockerTerminal.exitStatus) {
        dockerTerminal = orchflow.window.createTerminal({
            name: 'Docker',
            cwd: orchflow.workspace.workspaceFolders?.[0]?.uri.fsPath
        });
    }
    return dockerTerminal;
}

// Helper: Execute docker command and return output
async function executeDockerCommand(command) {
    return new Promise((resolve, reject) => {
        const { exec } = require('child_process');
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                outputChannel.appendLine(`Error: ${error.message}`);
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}

// Container tree data provider
class ContainerProvider {
    constructor() {
        this._onDidChangeTreeData = new orchflow.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.containers = [];
    }
    
    refresh() {
        this.loadContainers();
        this._onDidChangeTreeData.fire();
    }
    
    async loadContainers() {
        try {
            const output = await executeDockerCommand(
                'docker ps -a --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.Image}}"'
            );
            
            this.containers = output.split('\n')
                .filter(line => line.trim())
                .map(line => {
                    const [id, name, status, image] = line.split('|');
                    return { id, name, status, image };
                });
        } catch (error) {
            this.containers = [];
        }
    }
    
    getTreeItem(element) {
        const isRunning = element.status.includes('Up');
        return {
            label: element.name,
            description: `${element.image} - ${element.status}`,
            iconPath: isRunning ? '$(vm-running)' : '$(vm-outline)',
            contextValue: isRunning ? 'runningContainer' : 'stoppedContainer',
            collapsibleState: 0
        };
    }
    
    async getChildren(element) {
        if (!element) {
            await this.loadContainers();
            return this.containers;
        }
        return [];
    }
}