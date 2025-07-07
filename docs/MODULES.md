# OrchFlow Module Development Guide

## Overview

OrchFlow modules extend the IDE's functionality through a dynamic plugin system. Modules can provide custom layouts, AI agents, development tools, and external service integrations.

## Module Types

### 1. Layout Modules
Define custom workspace layouts and window arrangements.

**Example Use Cases:**
- Data science workspace with REPL + plots
- Web development with browser preview
- Mobile development with simulator view

### 2. Agent Modules
AI-powered automation and assistance agents.

**Example Use Cases:**
- Code review assistant
- Test generator
- Documentation writer
- Refactoring helper

### 3. Tool Modules
Development tools and utilities.

**Example Use Cases:**
- Database browser
- API client
- Performance profiler
- Log analyzer

### 4. Provider Modules
Integrate external services and APIs.

**Example Use Cases:**
- Cloud deployment
- CI/CD integration
- Issue tracker sync
- Version control extensions

## Module Structure

```
my-module/
├── manifest.json       # Required: Module metadata
├── index.js           # Required: Entry point
├── package.json       # Optional: Node dependencies
├── assets/            # Optional: Static resources
│   ├── icons/
│   └── templates/
└── README.md          # Recommended: Documentation
```

## Manifest File

The `manifest.json` file defines module metadata and configuration:

```json
{
  "name": "my-awesome-module",
  "version": "1.0.0",
  "description": "Does awesome things",
  "author": "Your Name <email@example.com>",
  "module_type": "tool",
  "entry_point": "index.js",
  "dependencies": ["base-module"],
  "permissions": ["terminal", "filesystem", "network"],
  "config_schema": {
    "apiKey": {
      "type": "string",
      "description": "API key for external service"
    },
    "timeout": {
      "type": "number",
      "default": 30000,
      "description": "Request timeout in milliseconds"
    }
  }
}
```

### Manifest Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Unique module identifier |
| version | string | Yes | Semantic version (x.y.z) |
| description | string | Yes | Brief description |
| author | string | Yes | Author name and email |
| module_type | string | Yes | One of: layout, agent, tool, provider |
| entry_point | string | Yes | Main JavaScript file |
| dependencies | string[] | No | Required module names |
| permissions | string[] | No | Required permissions |
| config_schema | object | No | JSON Schema for configuration |

### Available Permissions

- `terminal` - Create and control terminal panes
- `filesystem` - Read/write files
- `network` - Make network requests
- `editor` - Control Neovim instances
- `process` - Spawn processes
- `ui` - Create UI elements
- `state` - Access persistent storage

## Module Implementation

### Basic Module Structure

```javascript
// index.js
module.exports = {
  // Module info
  name: 'my-module',
  version: '1.0.0',
  
  // Lifecycle hooks
  async init(context) {
    // Initialize module
    this.context = context;
    console.log('Module initialized:', context.moduleId);
  },
  
  async cleanup() {
    // Clean up resources
    console.log('Module cleanup');
  },
  
  // Command definitions
  commands: {
    'hello': {
      description: 'Say hello',
      args: ['name'],
      execute: async (args) => {
        return `Hello, ${args[0] || 'World'}!`;
      }
    }
  }
};
```

### Module Context

The `context` object passed to `init()` provides:

```typescript
interface ModuleContext {
  moduleId: string;           // Module identifier
  config: Record<string, any>; // User configuration
  logger: Logger;             // Module logger
  eventBus: EventEmitter;     // Global event bus
  permissions: string[];      // Granted permissions
  rootPath: string;          // Module directory path
}
```

### Layout Module Example

```javascript
module.exports = {
  name: 'data-science-layout',
  version: '1.0.0',
  
  layouts: {
    'jupyter-style': {
      name: 'Jupyter Style',
      description: 'Editor + REPL + Plots',
      panes: [
        { type: 'editor', size: '50%', position: 'left' },
        { type: 'terminal', size: '25%', position: 'top-right', cmd: 'ipython' },
        { type: 'custom', size: '25%', position: 'bottom-right', content: 'plots' }
      ]
    }
  },
  
  async applyLayout(layoutId, options) {
    const layout = this.layouts[layoutId];
    if (!layout) throw new Error(`Unknown layout: ${layoutId}`);
    
    // Return layout configuration
    return {
      success: true,
      layout: layout.panes
    };
  }
};
```

### Agent Module Example

```javascript
module.exports = {
  name: 'test-generator',
  version: '1.0.0',
  
  async init(context) {
    this.context = context;
    
    // Subscribe to events
    context.eventBus.on('file.saved', this.onFileSaved.bind(this));
  },
  
  async onFileSaved(event) {
    if (event.path.endsWith('.js')) {
      // Generate test file
      const testPath = event.path.replace('.js', '.test.js');
      await this.generateTests(event.path, testPath);
    }
  },
  
  async generateTests(sourcePath, testPath) {
    // AI-powered test generation logic
    const sourceCode = await this.context.readFile(sourcePath);
    const tests = await this.context.ai.generateTests(sourceCode);
    await this.context.writeFile(testPath, tests);
  },
  
  commands: {
    'generate-tests': {
      description: 'Generate tests for current file',
      execute: async () => {
        const currentFile = await this.context.getCurrentFile();
        const testPath = currentFile.replace(/\.js$/, '.test.js');
        await this.generateTests(currentFile, testPath);
        return `Tests generated at ${testPath}`;
      }
    }
  }
};
```

## Event System

Modules can subscribe to and emit events:

### Common Events

```javascript
// File events
'file.opened'    // { path: string }
'file.saved'     // { path: string }
'file.closed'    // { path: string }

// Terminal events
'terminal.output'  // { paneId: string, data: string }
'terminal.error'   // { paneId: string, error: string }
'terminal.exit'    // { paneId: string, code: number }

// Editor events
'editor.cursor'    // { line: number, column: number }
'editor.selection' // { start: Position, end: Position }

// System events
'module.loaded'    // { moduleId: string }
'module.unloaded'  // { moduleId: string }
```

### Event Handling

```javascript
// Subscribe to events
context.eventBus.on('terminal.output', (event) => {
  console.log(`Terminal ${event.paneId}: ${event.data}`);
});

// Emit custom events
context.eventBus.emit('my-module.custom-event', {
  type: 'info',
  message: 'Something happened'
});
```

## API Reference

### Terminal Control

```javascript
// Create new terminal pane
const paneId = await context.terminal.create({
  cmd: 'npm run dev',
  cwd: '/path/to/project'
});

// Send commands
await context.terminal.sendKeys(paneId, 'ls -la\n');

// Capture output
const output = await context.terminal.capture(paneId);
```

### File System

```javascript
// Read file
const content = await context.fs.readFile('/path/to/file');

// Write file
await context.fs.writeFile('/path/to/file', content);

// Watch for changes
const watcher = context.fs.watch('/path/to/dir', (event) => {
  console.log('File changed:', event);
});
```

### Editor Control

```javascript
// Open file in editor
await context.editor.open('/path/to/file');

// Get current file
const file = await context.editor.getCurrentFile();

// Execute Vim command
await context.editor.command(':w');
```

### State Storage

```javascript
// Save module state
await context.state.set('myKey', { data: 'value' });

// Retrieve state
const data = await context.state.get('myKey');

// List all keys
const keys = await context.state.keys();
```

## Testing Modules

### Local Development

1. Create module in `modules/` directory
2. Run OrchFlow in development mode
3. Use module commands to test

```bash
# In OrchFlow terminal
:module reload my-module
:module test my-module
```

### Unit Testing

```javascript
// my-module.test.js
const module = require('./index');
const { MockContext } = require('@orchflow/test-utils');

describe('My Module', () => {
  let context;
  
  beforeEach(() => {
    context = new MockContext();
  });
  
  test('init should setup module', async () => {
    await module.init(context);
    expect(module.context).toBe(context);
  });
  
  test('hello command should greet', async () => {
    const result = await module.commands.hello.execute(['Alice']);
    expect(result).toBe('Hello, Alice!');
  });
});
```

## Publishing Modules

### 1. Prepare for Publishing

```bash
# Validate module
orchflow module validate

# Build module
orchflow module build

# Test module
orchflow module test
```

### 2. Package Module

```bash
# Create distributable package
orchflow module pack

# This creates my-module-1.0.0.tar.gz
```

### 3. Publish to Registry

```bash
# Login to OrchFlow registry
orchflow login

# Publish module
orchflow module publish
```

## Best Practices

### 1. Error Handling

Always handle errors gracefully:

```javascript
async execute(args) {
  try {
    const result = await riskyOperation();
    return { success: true, data: result };
  } catch (error) {
    this.context.logger.error('Operation failed:', error);
    return { success: false, error: error.message };
  }
}
```

### 2. Resource Cleanup

Always clean up resources:

```javascript
async cleanup() {
  // Close connections
  if (this.connection) {
    await this.connection.close();
  }
  
  // Stop watchers
  if (this.watcher) {
    this.watcher.stop();
  }
  
  // Clear timers
  if (this.timer) {
    clearInterval(this.timer);
  }
}
```

### 3. Configuration Validation

Validate configuration on init:

```javascript
async init(context) {
  // Validate required config
  if (!context.config.apiKey) {
    throw new Error('API key is required');
  }
  
  // Set defaults
  this.timeout = context.config.timeout || 30000;
}
```

### 4. Performance

- Debounce frequent operations
- Use streaming for large data
- Implement caching where appropriate
- Avoid blocking operations

### 5. Documentation

- Document all commands
- Provide usage examples
- Include configuration schema
- Add troubleshooting guide

## Examples

Full example modules are available in the `modules/` directory:

- `example-terminal-agent/` - Basic agent module
- `data-science-layout/` - Layout module for data science

## Support

- [Module API Docs](https://orchflow.dev/api/modules)
- [Community Forum](https://forum.orchflow.dev)
- [GitHub Issues](https://github.com/orchflow/orchflow/issues)