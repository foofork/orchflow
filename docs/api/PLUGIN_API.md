# orchflow Plugin API

## Overview

The orchflow Plugin API enables developers to extend functionality through a well-defined interface. Plugins can add new commands, UI components, integrations, and behaviors to the core system.

## Plugin Structure

### Plugin Types

1. **Command Plugins** - Add new commands to the command palette
2. **UI Plugins** - Add new UI components and views
3. **Integration Plugins** - Connect to external services
4. **Language Plugins** - Add language-specific features
5. **Theme Plugins** - Customize appearance

### Plugin Lifecycle

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Discovery  │────▶│    Load     │────▶│ Initialize  │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                     │
                           ▼                     ▼
                    ┌─────────────┐     ┌─────────────┐
                    │   Unload    │◀────│   Active    │
                    └─────────────┘     └─────────────┘
```

## Plugin Manifest

Every plugin must include a `plugin.json` manifest file:

```json
{
  "id": "com.example.myplugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "A sample plugin",
  "author": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "repository": "https://github.com/example/myplugin",
  "license": "MIT",
  "engines": {
    "orchflow": ">=1.0.0"
  },
  "main": "dist/index.js",
  "activationEvents": [
    "onStartup",
    "onCommand:myPlugin.doSomething",
    "onLanguage:rust"
  ],
  "contributes": {
    "commands": [
      {
        "command": "myPlugin.doSomething",
        "title": "Do Something",
        "category": "My Plugin"
      }
    ],
    "configuration": {
      "title": "My Plugin",
      "properties": {
        "myPlugin.enabled": {
          "type": "boolean",
          "default": true,
          "description": "Enable My Plugin"
        }
      }
    },
    "keybindings": [
      {
        "command": "myPlugin.doSomething",
        "key": "ctrl+shift+m",
        "when": "editorFocus"
      }
    ],
    "menus": {
      "commandPalette": [
        {
          "command": "myPlugin.doSomething",
          "when": "myPlugin.enabled"
        }
      ]
    }
  },
  "permissions": [
    "terminal.read",
    "terminal.write",
    "filesystem.read",
    "network.fetch"
  ]
}
```

## Plugin API

### Core API

```typescript
import { Plugin, PluginContext } from '@orchflow/plugin-api';

export class MyPlugin implements Plugin {
  activate(context: PluginContext): void {
    // Plugin initialization
    console.log('Plugin activated');
    
    // Register command
    context.subscriptions.push(
      orchflow.commands.registerCommand('myPlugin.doSomething', () => {
        orchflow.window.showInformationMessage('Hello from My Plugin!');
      })
    );
  }
  
  deactivate(): void {
    // Cleanup
    console.log('Plugin deactivated');
  }
}
```

### Available APIs

#### Window API
```typescript
namespace orchflow.window {
  // Show messages
  showInformationMessage(message: string): void;
  showWarningMessage(message: string): void;
  showErrorMessage(message: string): void;
  
  // Input
  showInputBox(options?: InputBoxOptions): Promise<string | undefined>;
  showQuickPick(items: string[], options?: QuickPickOptions): Promise<string | undefined>;
  
  // Terminal
  createTerminal(options?: TerminalOptions): Terminal;
  get activeTerminal(): Terminal | undefined;
  get terminals(): ReadonlyArray<Terminal>;
}
```

#### Commands API
```typescript
namespace orchflow.commands {
  registerCommand(command: string, callback: (...args: any[]) => any): Disposable;
  executeCommand(command: string, ...args: any[]): Promise<any>;
  getCommands(): Promise<string[]>;
}
```

#### Workspace API
```typescript
namespace orchflow.workspace {
  // File system
  fs: FileSystem;
  
  // Workspace folders
  get workspaceFolders(): ReadonlyArray<WorkspaceFolder> | undefined;
  
  // Events
  onDidChangeWorkspaceFolders: Event<WorkspaceFoldersChangeEvent>;
  onDidSaveTextDocument: Event<TextDocument>;
  onDidChangeTextDocument: Event<TextDocumentChangeEvent>;
  
  // Find files
  findFiles(include: GlobPattern, exclude?: GlobPattern): Promise<Uri[]>;
}
```

#### Terminal API
```typescript
interface Terminal {
  readonly name: string;
  readonly processId: Promise<number | undefined>;
  
  sendText(text: string, addNewLine?: boolean): void;
  show(preserveFocus?: boolean): void;
  hide(): void;
  dispose(): void;
}
```

#### Language API
```typescript
namespace orchflow.languages {
  // Register providers
  registerCompletionItemProvider(
    selector: DocumentSelector,
    provider: CompletionItemProvider,
    ...triggerCharacters: string[]
  ): Disposable;
  
  registerHoverProvider(
    selector: DocumentSelector,
    provider: HoverProvider
  ): Disposable;
  
  registerDefinitionProvider(
    selector: DocumentSelector,
    provider: DefinitionProvider
  ): Disposable;
}
```

## Plugin Development

### Project Structure
```
my-plugin/
├── package.json
├── plugin.json
├── src/
│   ├── index.ts
│   └── commands/
│       └── myCommand.ts
├── dist/
│   └── index.js
└── README.md
```

### TypeScript Example

```typescript
// src/index.ts
import { Plugin, PluginContext, Terminal } from '@orchflow/plugin-api';
import { MyCommand } from './commands/myCommand';

export default class MyPlugin implements Plugin {
  private terminal?: Terminal;
  
  activate(context: PluginContext): void {
    // Create terminal
    this.terminal = orchflow.window.createTerminal({
      name: 'My Plugin Terminal',
      cwd: orchflow.workspace.rootPath
    });
    
    // Register commands
    const myCommand = new MyCommand();
    context.subscriptions.push(
      orchflow.commands.registerCommand('myPlugin.run', () => {
        myCommand.execute(this.terminal!);
      })
    );
    
    // Listen to events
    context.subscriptions.push(
      orchflow.workspace.onDidSaveTextDocument((doc) => {
        if (doc.languageId === 'javascript') {
          this.lintFile(doc.uri);
        }
      })
    );
  }
  
  deactivate(): void {
    this.terminal?.dispose();
  }
  
  private lintFile(uri: Uri): void {
    // Linting logic
  }
}
```

### JavaScript Example

```javascript
// index.js
const { orchflow } = require('@orchflow/plugin-api');

exports.activate = function(context) {
  console.log('Plugin activated');
  
  const disposable = orchflow.commands.registerCommand('myPlugin.hello', () => {
    orchflow.window.showInformationMessage('Hello World!');
  });
  
  context.subscriptions.push(disposable);
};

exports.deactivate = function() {
  console.log('Plugin deactivated');
};
```

## Security & Permissions

### Permission Model
Plugins must declare required permissions in their manifest:

- `terminal.read` - Read terminal output
- `terminal.write` - Send commands to terminal
- `filesystem.read` - Read files
- `filesystem.write` - Write files
- `network.fetch` - Make network requests
- `system.exec` - Execute system commands
- `ui.webview` - Create webview panels

### Sandboxing
- Plugins run in isolated contexts
- File system access is restricted to workspace
- Network requests require explicit permission
- System commands are filtered and logged

## Plugin Distribution

### Publishing
```bash
# Build plugin
npm run build

# Package plugin
orchflow plugin package

# Publish to registry
orchflow plugin publish
```

### Installation
```bash
# From registry
orchflow plugin install my-plugin

# From file
orchflow plugin install ./my-plugin-1.0.0.opx

# From GitHub
orchflow plugin install github:user/repo
```

## Best Practices

1. **Performance**
   - Lazy load heavy dependencies
   - Use activation events wisely
   - Dispose resources properly

2. **User Experience**
   - Provide clear command names
   - Show progress for long operations
   - Handle errors gracefully

3. **Compatibility**
   - Test with minimum supported version
   - Handle missing APIs gracefully
   - Document breaking changes

4. **Security**
   - Request minimal permissions
   - Validate all user input
   - Don't store sensitive data

## Example Plugins

### Git Integration
```typescript
export default class GitPlugin implements Plugin {
  activate(context: PluginContext): void {
    // Add git commands
    context.subscriptions.push(
      orchflow.commands.registerCommand('git.status', async () => {
        const terminal = orchflow.window.createTerminal({ name: 'Git' });
        terminal.sendText('git status');
        terminal.show();
      })
    );
  }
}
```

### Docker Integration
```typescript
export default class DockerPlugin implements Plugin {
  activate(context: PluginContext): void {
    // Docker commands
    context.subscriptions.push(
      orchflow.commands.registerCommand('docker.ps', async () => {
        const result = await orchflow.system.exec('docker ps');
        orchflow.window.showInformationMessage(result.stdout);
      })
    );
  }
}
```

### Custom Language Support
```typescript
export default class MyLangPlugin implements Plugin {
  activate(context: PluginContext): void {
    // Register language features
    context.subscriptions.push(
      orchflow.languages.registerCompletionItemProvider(
        { scheme: 'file', language: 'mylang' },
        {
          provideCompletionItems(document, position) {
            // Return completion items
            return [
              {
                label: 'function',
                kind: CompletionItemKind.Keyword,
                insertText: 'function ${1:name}() {\n\t$0\n}'
              }
            ];
          }
        }
      )
    );
  }
}
```

## Debugging Plugins

### Development Mode
```bash
# Run orchflow with plugin in development
orchflow --plugin-dev ./my-plugin
```

### Debug Output
```typescript
// Use console for debugging
console.log('[MyPlugin]', 'Debug message');

// Or use output channel
const outputChannel = orchflow.window.createOutputChannel('My Plugin');
outputChannel.appendLine('Debug message');
```

### Common Issues
1. **Plugin not loading**: Check activation events
2. **Commands not working**: Verify command registration
3. **Performance issues**: Profile with DevTools
4. **Permission errors**: Check manifest permissions

## API Reference

Full API documentation available at: https://orchflow.dev/api