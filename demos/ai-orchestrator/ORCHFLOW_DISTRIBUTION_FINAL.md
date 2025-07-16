# OrchFlow Distribution - Final Architecture

## Overview

OrchFlow is distributed as a smart NPM wrapper package that intercepts `claude-flow orchflow` commands while transparently passing through all other claude-flow commands.

## Distribution Model

### Package: `@orchflow/claude-flow`

```bash
# Install globally (one-time)
npm install -g @orchflow/claude-flow

# Use OrchFlow
claude-flow orchflow

# All regular claude-flow commands work unchanged
claude-flow swarm "build feature"
claude-flow sparc run developer "add tests"
```

## How It Works

### 1. Smart Command Interception

```javascript
#!/usr/bin/env node
// bin/claude-flow.js

const { spawn } = require('child_process');

async function main() {
  const args = process.argv.slice(2);
  
  if (args[0] === 'orchflow') {
    // Launch OrchFlow terminal interface
    const { OrchFlow } = await import('../dist/orchflow.js');
    await OrchFlow.start(args.slice(1));
  } else {
    // Pass through to real claude-flow
    const claudeFlow = require.resolve('claude-flow/bin/claude-flow');
    spawn(process.execPath, [claudeFlow, ...args], { 
      stdio: 'inherit' 
    });
  }
}

main().catch(console.error);
```

### 2. On-Demand Component Download

```typescript
// First-time setup only
export class ComponentManager {
  async ensureComponents(): Promise<void> {
    if (!await this.componentsExist()) {
      console.log('🚀 First-time setup - downloading OrchFlow components...');
      await this.downloadRustBinaries();
    }
  }
}
```

### 3. Component Storage

```
~/.orchflow/
├── components/
│   ├── orchflow-mux-{platform}
│   ├── orchflow-core-{platform}
│   └── orchflow-terminal-{platform}
├── config.json
└── cache/
```

## User Experience

### First Run
```bash
$ claude-flow orchflow

🎯 OrchFlow Terminal Architecture
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
First-time setup - downloading components...
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
$ claude-flow orchflow

# Instant launch - components already cached
Claude: "Hello! I'm ready to help with your development."
> _
```

## Package Structure

```
@orchflow/claude-flow/
├── package.json
├── bin/
│   └── claude-flow.js         # Entry point wrapper
├── dist/
│   ├── orchflow.js           # Main OrchFlow logic
│   ├── component-manager.js  # Binary download/management
│   └── terminal-interface.js # Natural language terminal
└── README.md
```

### package.json
```json
{
  "name": "@orchflow/claude-flow",
  "version": "1.0.0",
  "description": "Natural language orchestration for claude-flow",
  "bin": {
    "claude-flow": "./bin/claude-flow.js"
  },
  "dependencies": {
    "claude-flow": "^2.0.0-alpha.50"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

## Binary Distribution

Rust components are distributed via GitHub releases:

```yaml
# GitHub Release v1.0.0
assets:
  - orchflow-mux-linux-x64
  - orchflow-mux-linux-arm64
  - orchflow-mux-darwin-x64
  - orchflow-mux-darwin-arm64
  - orchflow-mux-win32-x64
  - checksums.txt
```

## Why This Approach?

1. **Single Command**: Users only need `claude-flow orchflow`
2. **No Confusion**: Maintains claude-flow namespace
3. **Transparent**: All claude-flow commands work unchanged
4. **Lightweight**: Components only download when needed
5. **Secure**: Checksum verification for all binaries
6. **Cross-Platform**: Automatic platform detection

## Alternative Usage

For users who prefer npx:
```bash
# Direct usage without global install
npx @orchflow/claude-flow orchflow

# Regular commands still work
npx @orchflow/claude-flow swarm "build app"
```

## Summary

The `@orchflow/claude-flow` NPM package provides a seamless wrapper that:
- Intercepts only the `orchflow` command
- Downloads Rust binaries on first use only
- Passes through all other commands to claude-flow
- Requires no separate installation or configuration
- Works exactly as if OrchFlow were built into claude-flow

This approach was chosen after confirming that claude-flow does not have a plugin system, making the smart wrapper the most practical solution for delivering the desired user experience.