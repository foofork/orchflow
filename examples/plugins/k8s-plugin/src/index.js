// Kubernetes Plugin for Orchflow
const { orchflow } = require('@orchflow/plugin-api');

let k8sTerminal = null;
let outputChannel = null;
let currentContext = null;
let currentNamespace = null;

// Plugin activation
exports.activate = function(context) {
    console.log('Kubernetes plugin activated');
    
    // Create output channel
    outputChannel = orchflow.window.createOutputChannel('Kubernetes');
    
    // Get initial context and namespace
    initializeK8s();
    
    // Register commands
    context.subscriptions.push(
        orchflow.commands.registerCommand('k8s.getPods', getPods),
        orchflow.commands.registerCommand('k8s.getServices', getServices),
        orchflow.commands.registerCommand('k8s.getDeployments', getDeployments),
        orchflow.commands.registerCommand('k8s.describe', describeResource),
        orchflow.commands.registerCommand('k8s.logs', viewLogs),
        orchflow.commands.registerCommand('k8s.exec', execInPod),
        orchflow.commands.registerCommand('k8s.apply', applyConfig),
        orchflow.commands.registerCommand('k8s.delete', deleteResource),
        orchflow.commands.registerCommand('k8s.portForward', portForward),
        orchflow.commands.registerCommand('k8s.switchContext', switchContext)
    );
    
    // Create Kubernetes explorer
    const k8sProvider = new KubernetesProvider();
    orchflow.window.registerTreeDataProvider('kubernetesExplorer', k8sProvider);
    
    // Auto-refresh if enabled
    if (orchflow.workspace.getConfiguration('kubernetes').get('autoRefresh')) {
        setInterval(() => {
            k8sProvider.refresh();
            updateStatusBar();
        }, 10000);
    }
};

// Plugin deactivation
exports.deactivate = function() {
    console.log('Kubernetes plugin deactivated');
    if (k8sTerminal) {
        k8sTerminal.dispose();
    }
    if (outputChannel) {
        outputChannel.dispose();
    }
};

// Initialize K8s context
async function initializeK8s() {
    try {
        currentContext = await executeK8sCommand('kubectl config current-context');
        currentNamespace = orchflow.workspace.getConfiguration('kubernetes').get('namespace') || 'default';
        updateStatusBar();
    } catch (error) {
        outputChannel.appendLine('Failed to initialize Kubernetes context');
    }
}

// Get Pods command
async function getPods() {
    const namespace = await getNamespace();
    const format = orchflow.workspace.getConfiguration('kubernetes').get('outputFormat');
    
    const terminal = getK8sTerminal();
    terminal.sendText(`kubectl get pods -n ${namespace} -o ${format}`);
    terminal.show();
}

// Get Services command
async function getServices() {
    const namespace = await getNamespace();
    const format = orchflow.workspace.getConfiguration('kubernetes').get('outputFormat');
    
    const terminal = getK8sTerminal();
    terminal.sendText(`kubectl get services -n ${namespace} -o ${format}`);
    terminal.show();
}

// Get Deployments command
async function getDeployments() {
    const namespace = await getNamespace();
    const format = orchflow.workspace.getConfiguration('kubernetes').get('outputFormat');
    
    const terminal = getK8sTerminal();
    terminal.sendText(`kubectl get deployments -n ${namespace} -o ${format}`);
    terminal.show();
}

// Describe Resource command
async function describeResource() {
    const resourceTypes = ['pod', 'service', 'deployment', 'configmap', 'secret', 'ingress'];
    const resourceType = await orchflow.window.showQuickPick(resourceTypes, {
        placeHolder: 'Select resource type'
    });
    
    if (!resourceType) return;
    
    const namespace = await getNamespace();
    const resources = await executeK8sCommand(
        `kubectl get ${resourceType} -n ${namespace} -o jsonpath='{.items[*].metadata.name}'`
    );
    
    const resourceList = resources.split(' ').filter(r => r.trim());
    
    if (resourceList.length === 0) {
        orchflow.window.showInformationMessage(`No ${resourceType}s found in namespace ${namespace}`);
        return;
    }
    
    const resource = await orchflow.window.showQuickPick(resourceList, {
        placeHolder: `Select ${resourceType} to describe`
    });
    
    if (!resource) return;
    
    const terminal = getK8sTerminal();
    terminal.sendText(`kubectl describe ${resourceType} ${resource} -n ${namespace}`);
    terminal.show();
}

// View Logs command
async function viewLogs() {
    const namespace = await getNamespace();
    const pods = await executeK8sCommand(
        `kubectl get pods -n ${namespace} -o jsonpath='{.items[*].metadata.name}'`
    );
    
    const podList = pods.split(' ').filter(p => p.trim());
    
    if (podList.length === 0) {
        orchflow.window.showInformationMessage(`No pods found in namespace ${namespace}`);
        return;
    }
    
    const pod = await orchflow.window.showQuickPick(podList, {
        placeHolder: 'Select pod to view logs'
    });
    
    if (!pod) return;
    
    // Check if pod has multiple containers
    const containers = await executeK8sCommand(
        `kubectl get pod ${pod} -n ${namespace} -o jsonpath='{.spec.containers[*].name}'`
    );
    
    const containerList = containers.split(' ').filter(c => c.trim());
    let container = '';
    
    if (containerList.length > 1) {
        const selected = await orchflow.window.showQuickPick(containerList, {
            placeHolder: 'Select container'
        });
        if (selected) container = `-c ${selected}`;
    }
    
    const follow = await orchflow.window.showQuickPick(['Yes', 'No'], {
        placeHolder: 'Follow logs?'
    });
    
    const terminal = getK8sTerminal();
    terminal.sendText(`kubectl logs ${follow === 'Yes' ? '-f' : ''} ${pod} ${container} -n ${namespace}`);
    terminal.show();
}

// Execute in Pod command
async function execInPod() {
    const namespace = await getNamespace();
    const pods = await executeK8sCommand(
        `kubectl get pods -n ${namespace} -o jsonpath='{range .items[*]}{.metadata.name}{" "}{.status.phase}{"\\n"}{end}'`
    );
    
    const runningPods = pods.split('\n')
        .filter(line => line.includes('Running'))
        .map(line => line.split(' ')[0]);
    
    if (runningPods.length === 0) {
        orchflow.window.showInformationMessage(`No running pods found in namespace ${namespace}`);
        return;
    }
    
    const pod = await orchflow.window.showQuickPick(runningPods, {
        placeHolder: 'Select pod to exec into'
    });
    
    if (!pod) return;
    
    const command = await orchflow.window.showInputBox({
        prompt: 'Command to execute',
        value: '/bin/sh'
    });
    
    if (!command) return;
    
    const terminal = getK8sTerminal();
    terminal.sendText(`kubectl exec -it ${pod} -n ${namespace} -- ${command}`);
    terminal.show();
}

// Apply Configuration command
async function applyConfig() {
    const files = await orchflow.workspace.findFiles('**/*.{yaml,yml}', '**/node_modules/**', 50);
    
    if (files.length === 0) {
        orchflow.window.showInformationMessage('No YAML files found');
        return;
    }
    
    const fileNames = files.map(f => orchflow.workspace.asRelativePath(f));
    const file = await orchflow.window.showQuickPick(fileNames, {
        placeHolder: 'Select configuration file to apply'
    });
    
    if (!file) return;
    
    const terminal = getK8sTerminal();
    terminal.sendText(`kubectl apply -f ${file}`);
    terminal.show();
}

// Delete Resource command
async function deleteResource() {
    const resourceTypes = ['pod', 'service', 'deployment', 'configmap', 'secret'];
    const resourceType = await orchflow.window.showQuickPick(resourceTypes, {
        placeHolder: 'Select resource type to delete'
    });
    
    if (!resourceType) return;
    
    const namespace = await getNamespace();
    const resources = await executeK8sCommand(
        `kubectl get ${resourceType} -n ${namespace} -o jsonpath='{.items[*].metadata.name}'`
    );
    
    const resourceList = resources.split(' ').filter(r => r.trim());
    
    if (resourceList.length === 0) {
        orchflow.window.showInformationMessage(`No ${resourceType}s found`);
        return;
    }
    
    const resource = await orchflow.window.showQuickPick(resourceList, {
        placeHolder: `Select ${resourceType} to delete`
    });
    
    if (!resource) return;
    
    const confirm = await orchflow.window.showWarningMessage(
        `Delete ${resourceType} '${resource}'?`,
        'Yes', 'No'
    );
    
    if (confirm !== 'Yes') return;
    
    const terminal = getK8sTerminal();
    terminal.sendText(`kubectl delete ${resourceType} ${resource} -n ${namespace}`);
    terminal.show();
}

// Port Forward command
async function portForward() {
    const namespace = await getNamespace();
    const pods = await executeK8sCommand(
        `kubectl get pods -n ${namespace} -o jsonpath='{.items[*].metadata.name}'`
    );
    
    const podList = pods.split(' ').filter(p => p.trim());
    
    if (podList.length === 0) {
        orchflow.window.showInformationMessage('No pods found');
        return;
    }
    
    const pod = await orchflow.window.showQuickPick(podList, {
        placeHolder: 'Select pod for port forwarding'
    });
    
    if (!pod) return;
    
    const ports = await orchflow.window.showInputBox({
        prompt: 'Port mapping',
        placeholder: '8080:80',
        validateInput: (text) => {
            return /^\d+:\d+$/.test(text) ? null : 'Format: localPort:remotePort';
        }
    });
    
    if (!ports) return;
    
    const terminal = getK8sTerminal();
    terminal.sendText(`kubectl port-forward ${pod} ${ports} -n ${namespace}`);
    terminal.show();
}

// Switch Context command
async function switchContext() {
    const contexts = await executeK8sCommand('kubectl config get-contexts -o name');
    const contextList = contexts.split('\n').filter(c => c.trim());
    
    const selected = await orchflow.window.showQuickPick(contextList, {
        placeHolder: 'Select Kubernetes context'
    });
    
    if (!selected) return;
    
    const terminal = getK8sTerminal();
    terminal.sendText(`kubectl config use-context ${selected}`);
    terminal.show();
    
    currentContext = selected;
    updateStatusBar();
}

// Helper functions
function getK8sTerminal() {
    if (!k8sTerminal || k8sTerminal.exitStatus) {
        k8sTerminal = orchflow.window.createTerminal({
            name: 'Kubernetes',
            cwd: orchflow.workspace.workspaceFolders?.[0]?.uri.fsPath
        });
    }
    return k8sTerminal;
}

async function executeK8sCommand(command) {
    return new Promise((resolve, reject) => {
        const { exec } = require('child_process');
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                outputChannel.appendLine(`Error: ${error.message}`);
                reject(error);
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

async function getNamespace() {
    return currentNamespace || orchflow.workspace.getConfiguration('kubernetes').get('namespace') || 'default';
}

function updateStatusBar() {
    if (currentContext) {
        orchflow.window.setStatusBarMessage(
            `$(cloud) ${currentContext} | ${currentNamespace}`,
            'k8s.status'
        );
    }
}

// Kubernetes Explorer Provider
class KubernetesProvider {
    constructor() {
        this._onDidChangeTreeData = new orchflow.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.resources = [];
    }
    
    refresh() {
        this.loadResources();
        this._onDidChangeTreeData.fire();
    }
    
    async loadResources() {
        try {
            const namespace = await getNamespace();
            
            this.resources = [
                { type: 'pods', label: 'Pods' },
                { type: 'services', label: 'Services' },
                { type: 'deployments', label: 'Deployments' },
                { type: 'configmaps', label: 'ConfigMaps' },
                { type: 'secrets', label: 'Secrets' }
            ];
            
            // Load counts for each resource type
            for (const resource of this.resources) {
                try {
                    const count = await executeK8sCommand(
                        `kubectl get ${resource.type} -n ${namespace} --no-headers | wc -l`
                    );
                    resource.count = parseInt(count) || 0;
                } catch {
                    resource.count = 0;
                }
            }
        } catch (error) {
            this.resources = [];
        }
    }
    
    getTreeItem(element) {
        if (element.name) {
            // Resource item
            return {
                label: element.name,
                description: element.status,
                contextValue: element.type,
                collapsibleState: 0
            };
        } else {
            // Resource type
            return {
                label: `${element.label} (${element.count})`,
                contextValue: 'resourceType',
                collapsibleState: element.count > 0 ? 1 : 0
            };
        }
    }
    
    async getChildren(element) {
        if (!element) {
            await this.loadResources();
            return this.resources;
        } else {
            // Load specific resources
            const namespace = await getNamespace();
            const items = await executeK8sCommand(
                `kubectl get ${element.type} -n ${namespace} -o json`
            );
            
            const data = JSON.parse(items);
            return data.items.map(item => ({
                type: element.type.slice(0, -1), // Remove 's'
                name: item.metadata.name,
                status: item.status?.phase || 'Active'
            }));
        }
    }
}