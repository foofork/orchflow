# OrchFlow Distribution Strategy

## User Experience Goal

Users should only need ONE command to get started:
```bash
npx claude-flow orchflow
```

No separate OrchFlow installation required!

## Distribution Approach

### Option A: Claude-Flow Plugin/Extension (Recommended)
```bash
# Users continue using claude-flow as normal
npx claude-flow orchflow

# claude-flow detects 'orchflow' command and:
# 1. Downloads OrchFlow components if needed
# 2. Launches OrchFlow terminal interface
# 3. Everything happens transparently
```

**Implementation:**
- OrchFlow becomes a claude-flow extension/plugin
- Published as `@orchflow/claude-flow-plugin`
- Claude-flow automatically installs when 'orchflow' command is used
- Rust binaries downloaded on-demand

### Option B: Integrated into Claude-Flow Core
```bash
# OrchFlow features become part of claude-flow itself
npx claude-flow --orchestrator  # Launches OrchFlow mode
npx claude-flow orchflow        # Alias for same thing
```

**Implementation:**
- OrchFlow contributed to claude-flow repository
- Becomes a built-in feature
- No separate package needed

### Option C: Standalone with Claude-Flow Auto-Install (Fallback)
```bash
# If claude-flow team prefers separation
npx orchflow

# OrchFlow automatically:
# 1. Checks for claude-flow
# 2. Uses existing claude-flow if found
# 3. Downloads claude-flow if needed
# 4. Manages everything transparently
```

## Recommended Architecture: Claude-Flow Plugin

### How It Works

```typescript
// In claude-flow's plugin system
export class ClaudeFlowPluginLoader {
  async loadCommand(command: string): Promise<void> {
    if (command === 'orchflow') {
      // Dynamic import of OrchFlow
      const { OrchFlow } = await import('@orchflow/claude-flow-plugin');
      
      // OrchFlow handles everything from here
      const orchflow = new OrchFlow();
      await orchflow.start();
    }
  }
}
```

### Package Structure
```
claude-flow/
├── standard claude-flow files...
└── plugins/
    └── orchflow/  (downloaded on first use)
        ├── index.js
        ├── bin/
        │   ├── orchflow-mux-linux-x64
        │   ├── orchflow-mux-darwin-x64
        │   └── orchflow-mux-win32-x64
        └── assets/
```

### First-Time User Flow
```bash
$ npx claude-flow orchflow

🎯 OrchFlow Terminal Architecture
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
First time setup - downloading OrchFlow components...
✓ Downloaded orchestrator (2.1 MB)
✓ Downloaded tmux backend (1.8 MB)
✓ Verified checksums
✓ Ready!

Launching OrchFlow...

Claude: "Hello! I'm ready to help with your development."
> _
```

### Subsequent Runs
```bash
$ npx claude-flow orchflow

# Instant launch - components already cached
Claude: "Hello! I'm ready to help with your development."
> _
```

## Technical Implementation

### Claude-Flow Integration Points

```typescript
// claude-flow would need to expose:
interface ClaudeFlowPluginAPI {
  // Register custom commands
  registerCommand(name: string, handler: CommandHandler): void;
  
  // Access to claude-flow internals
  getClaudeAPI(): ClaudeAPI;
  getSwarmManager(): SwarmManager;
  getHiveMindController(): HiveMindController;
  
  // Terminal control
  getTerminal(): Terminal;
  splitTerminal(config: SplitConfig): TerminalPane;
}
```

### OrchFlow Plugin Implementation

```typescript
export class OrchFlowPlugin implements ClaudeFlowPlugin {
  async initialize(api: ClaudeFlowPluginAPI): Promise<void> {
    // Register the 'orchflow' command
    api.registerCommand('orchflow', this.handleOrchFlowCommand);
    
    // Set up our thin wrapper
    this.wrapper = new ClaudeFlowWrapper(api);
  }
  
  async handleOrchFlowCommand(args: string[]): Promise<void> {
    // Download Rust binaries if needed
    await this.ensureBinariesInstalled();
    
    // Launch OrchFlow interface
    const orchestrator = new OrchFlowOrchestrator(this.wrapper);
    await orchestrator.start();
  }
  
  private async ensureBinariesInstalled(): Promise<void> {
    const binaryPath = this.getBinaryPath();
    
    if (!await this.binaryExists(binaryPath)) {
      console.log('Downloading OrchFlow components...');
      await this.downloadBinary();
    }
  }
}
```

## Benefits of Plugin Approach

1. **Single Entry Point**: Users only need `npx claude-flow`
2. **No Extra Installation**: OrchFlow downloads on-demand
3. **Always Compatible**: OrchFlow updates with claude-flow
4. **Lightweight**: Only downloaded if user wants it
5. **Clean Integration**: Uses claude-flow's existing infrastructure

## Alternative: Minimal Wrapper

If claude-flow doesn't support plugins, we could create a minimal wrapper:

```json
// orchflow package.json
{
  "name": "@orchflow/cli",
  "bin": {
    "orchflow": "./bin/orchflow.js"
  },
  "dependencies": {
    "claude-flow": "*"  // Use whatever version user has
  }
}
```

```javascript
#!/usr/bin/env node
// bin/orchflow.js

import { exec } from 'child_process';

// Check if claude-flow exists
exec('npx claude-flow --version', (error) => {
  if (error) {
    console.log('Installing claude-flow...');
    exec('npm install -g claude-flow', () => {
      launchOrchFlow();
    });
  } else {
    launchOrchFlow();
  }
});

function launchOrchFlow() {
  // Start OrchFlow with claude-flow integration
  require('../dist/index.js').start();
}
```

## Recommendation

The **Claude-Flow Plugin** approach is ideal because:
- Users keep their familiar `npx claude-flow` workflow
- OrchFlow becomes a natural extension of claude-flow
- No confusion about which tool to use
- Automatic compatibility with claude-flow updates
- Clean separation of concerns

The user experience remains simple:
```bash
# Just add 'orchflow' to normal claude-flow command
npx claude-flow orchflow

# Everything else is magic! ✨
```