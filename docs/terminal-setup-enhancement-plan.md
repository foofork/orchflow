# OrchFlow Terminal Setup Enhancement Plan

## Executive Summary

This document outlines the enhancement plan for OrchFlow's terminal setup system to bridge the gap between the current simple implementation and the sophisticated environment detection system originally designed. The enhancement will provide intelligent environment detection, user choice menus, and configuration management for a seamless setup experience across all terminal environments.

## Current State Analysis

### Existing Implementation (`cli-injected.ts`)

The current implementation follows a basic pattern:
```typescript
// Current approach - simple fallback
try {
  await this.initializeSplitScreen();
  splitSpinner.succeed('Split-screen layout ready (70/30)');
} catch (error) {
  splitSpinner.fail('Failed to setup split-screen');
  console.log(chalk.yellow('Continuing without split-screen...'));
}
```

**Limitations:**
- No environment detection
- No user choice or preference storage
- Always attempts tmux, falls back silently
- Missing configuration file support
- No setup flow differentiation

### Original Design Vision (`ORCHFLOW_TERMINAL_SETUP.md`)

The original specification designed a comprehensive system with:
- Intelligent environment detection
- Multiple setup flows (tmux, VS Code, Codespaces, inline)
- User preference storage
- Configuration file support
- Command-line flag customization

## Enhancement Overview

### Goals
1. **Zero-friction setup** that adapts to any terminal environment
2. **Intelligent detection** of terminal capabilities and user preferences
3. **Multiple setup flows** optimized for different environments
4. **Persistent preferences** to avoid repeated setup prompts
5. **Progressive enhancement** with better features for capable terminals
6. **Graceful fallbacks** when advanced features aren't available

### Success Metrics
- Setup time reduced by 80% for returning users
- 95% success rate across all terminal environments
- User satisfaction score >4.5/5 for setup experience
- Zero manual configuration required for standard setups

## Technical Architecture

### Core Components

#### 1. Terminal Environment Detector
```typescript
interface TerminalConfig {
  hasTmux: boolean;
  isInsideTmux: boolean;
  isVSCode: boolean;
  isCodespaces: boolean;
  terminalType: string;
  terminalSize: { width: number; height: number };
  userPreference?: UserPreference;
}

class TerminalEnvironmentDetector {
  async detectCapabilities(): Promise<TerminalConfig>;
  private async checkCommand(command: string): Promise<boolean>;
  private async getTerminalSize(): Promise<{width: number, height: number}>;
  private async loadUserPreference(): Promise<UserPreference | null>;
}
```

#### 2. Setup Flow Router
```typescript
class SetupFlowRouter {
  async route(config: TerminalConfig): Promise<SetupFlow>;
  private async launchTmuxMode(): Promise<void>;
  private async launchVSCodeMode(): Promise<void>;
  private async launchCodespacesMode(): Promise<void>;
  private async launchInlineMode(): Promise<void>;
  private async offerTmuxSetup(): Promise<void>;
}
```

#### 3. Configuration Manager
```typescript
interface OrchFlowConfigData {
  terminal: {
    preferred_mode: 'auto' | 'tmux' | 'inline' | 'statusbar' | 'window';
    auto_setup: boolean;
    tmux: TmuxConfig;
    status: StatusConfig;
    vscode: VSCodeConfig;
  };
}

class OrchFlowConfigManager {
  async loadConfig(): Promise<OrchFlowConfigData>;
  async saveConfig(config: OrchFlowConfigData): Promise<void>;
  async saveUserPreference(mode: string, settings: any): Promise<void>;
}
```

#### 4. User Interaction Manager
```typescript
class UserInteractionManager {
  async promptUser(message: string): Promise<string>;
  async showChoiceMenu(options: MenuOption[]): Promise<number>;
  async confirmAction(message: string): Promise<boolean>;
  private validateInput(input: string, type: 'choice' | 'confirm'): boolean;
}
```

## Implementation Plan

### Phase 1: Environment Detection (Week 1)

**Deliverables:**
- `TerminalEnvironmentDetector` class
- Environment capability detection
- Terminal size and type detection
- Basic user preference loading

**Implementation:**
```typescript
// packages/orchflow-claude-flow/src/cli-injected.ts
class TerminalEnvironmentDetector {
  async detectCapabilities(): Promise<TerminalConfig> {
    return {
      hasTmux: await this.checkCommand('tmux'),
      isInsideTmux: !!process.env.TMUX,
      isVSCode: !!process.env.VSCODE_PID || process.env.TERM_PROGRAM === 'vscode',
      isCodespaces: !!process.env.CODESPACES,
      terminalType: process.env.TERM_PROGRAM || 'unknown',
      terminalSize: await this.getTerminalSize(),
      userPreference: await this.loadUserPreference()
    };
  }

  private async checkCommand(command: string): Promise<boolean> {
    try {
      const { promisify } = require('util');
      const exec = promisify(require('child_process').exec);
      await exec(`which ${command}`);
      return true;
    } catch {
      return false;
    }
  }

  private async getTerminalSize(): Promise<{width: number, height: number}> {
    return {
      width: process.stdout.columns || 80,
      height: process.stdout.rows || 24
    };
  }

  private async loadUserPreference(): Promise<UserPreference | null> {
    const configManager = new OrchFlowConfigManager();
    const config = await configManager.loadConfig();
    return config.terminal.auto_setup ? {
      mode: config.terminal.preferred_mode,
      skipSetup: config.terminal.auto_setup
    } : null;
  }
}
```

**Integration Point:**
```typescript
// Enhanced launch method
async launch(options: LaunchOptions = {}): Promise<void> {
  const detector = new TerminalEnvironmentDetector();
  const config = await detector.detectCapabilities();
  
  // Use detected config for smart routing
  const router = new SetupFlowRouter();
  await router.route(config);
}
```

### Phase 2: Setup Flow Routing (Week 2)

**Deliverables:**
- `SetupFlowRouter` class
- Environment-specific setup methods
- Smart routing logic
- Basic setup flow implementations

**Implementation:**
```typescript
class SetupFlowRouter {
  async route(config: TerminalConfig): Promise<void> {
    // Check user preference first
    if (config.userPreference?.skipSetup) {
      return this.launchWithMode(config.userPreference.mode);
    }

    // Smart routing based on environment
    if (config.isInsideTmux) {
      await this.launchTmuxMode();
    } else if (config.isCodespaces) {
      await this.launchCodespacesMode();
    } else if (config.isVSCode) {
      await this.launchVSCodeMode(config.hasTmux);
    } else if (config.hasTmux) {
      await this.offerTmuxSetup();
    } else {
      await this.launchInlineMode();
    }
  }

  private async launchTmuxMode(): Promise<void> {
    console.log(chalk.cyan('✓ Tmux session detected'));
    console.log(chalk.gray('Creating 70/30 horizontal split...'));
    // Direct tmux setup
    await this.setupTmuxSplit();
  }

  private async launchCodespacesMode(): Promise<void> {
    console.log(chalk.cyan('🎯 OrchFlow Ready (Codespaces Edition)'));
    console.log('✓ Tmux configured');
    console.log('✓ Status monitor active');
    console.log('✓ Cloud resources optimized');
    await this.setupTmuxSplit();
  }

  private async launchVSCodeMode(hasTmux: boolean): Promise<void> {
    const interactionManager = new UserInteractionManager();
    await interactionManager.showVSCodeSetupMenu(hasTmux);
  }

  private async launchInlineMode(): Promise<void> {
    console.log(chalk.yellow('🎯 OrchFlow Setup'));
    console.log('Tmux not found. Using inline status mode.');
    console.log(chalk.gray('Tip: Install tmux for split-pane experience:'));
    console.log(chalk.gray('- Ubuntu/Debian: sudo apt install tmux'));
    console.log(chalk.gray('- macOS: brew install tmux'));
    
    await this.promptContinue();
  }
}
```

### Phase 3: User Choice Menus (Week 3)

**Deliverables:**
- `UserInteractionManager` class
- Interactive choice menus
- User input validation
- Preference saving after setup

**Implementation:**
```typescript
class UserInteractionManager {
  async showVSCodeSetupMenu(hasTmux: boolean): Promise<void> {
    console.log(chalk.cyan('🎯 OrchFlow Setup - VS Code Detected'));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('How would you like to see live status updates?');
    console.log('');
    console.log('1. Split Terminal (recommended if tmux installed)');
    console.log('   └─ 70/30 split with live status pane');
    console.log('2. Inline Status');
    console.log('   └─ Status updates in main terminal');
    console.log('3. VS Code Status Bar');
    console.log('   └─ Minimal updates in bottom bar');
    console.log('4. Separate Window');
    console.log('   └─ Status in new VS Code window');
    console.log('');

    const choice = await this.promptUser('Choose [1-4] or Enter for recommended: ');
    const selectedMode = this.parseVSCodeChoice(choice, hasTmux);
    
    // Save preference
    const configManager = new OrchFlowConfigManager();
    await configManager.saveUserPreference(selectedMode, { 
      environment: 'vscode',
      hasTmux 
    });

    await this.executeSetupMode(selectedMode);
  }

  async promptUser(message: string): Promise<string> {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(message, (answer: string) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  private parseVSCodeChoice(choice: string, hasTmux: boolean): string {
    const num = parseInt(choice) || (hasTmux ? 1 : 2);
    switch (num) {
      case 1: return 'tmux';
      case 2: return 'inline';
      case 3: return 'statusbar';
      case 4: return 'window';
      default: return hasTmux ? 'tmux' : 'inline';
    }
  }
}
```

### Phase 4: Configuration Management (Week 4)

**Deliverables:**
- `OrchFlowConfigManager` class
- YAML configuration file support
- User preference persistence
- Command-line flag integration

**Implementation:**
```typescript
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import * as yaml from 'js-yaml';

class OrchFlowConfigManager {
  private configPath = join(homedir(), '.orchflow', 'config.yml');
  private configDir = join(homedir(), '.orchflow');

  async loadConfig(): Promise<OrchFlowConfigData> {
    if (existsSync(this.configPath)) {
      try {
        const content = readFileSync(this.configPath, 'utf8');
        return yaml.load(content) as OrchFlowConfigData;
      } catch (error) {
        console.warn('Failed to load config, using defaults:', error);
      }
    }
    return this.getDefaultConfig();
  }

  async saveConfig(config: OrchFlowConfigData): Promise<void> {
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true });
    }

    const yamlContent = yaml.dump(config, { 
      indent: 2,
      lineWidth: 80,
      noRefs: true
    });

    writeFileSync(this.configPath, yamlContent);
  }

  async saveUserPreference(mode: string, settings: any): Promise<void> {
    const config = await this.loadConfig();
    config.terminal.preferred_mode = mode as any;
    config.terminal.auto_setup = true;
    
    // Update mode-specific settings
    if (mode === 'tmux') {
      config.terminal.tmux = { ...config.terminal.tmux, ...settings.tmux };
    } else if (mode === 'vscode') {
      config.terminal.vscode = { ...config.terminal.vscode, ...settings.vscode };
    }

    await this.saveConfig(config);
  }

  private getDefaultConfig(): OrchFlowConfigData {
    return {
      terminal: {
        preferred_mode: 'auto',
        auto_setup: false,
        tmux: {
          split_direction: 'horizontal',
          split_size: 30,
          status_position: 'right',
          respect_layout: false
        },
        status: {
          update_interval: 1000,
          show_resources: true,
          show_details: true,
          max_workers_display: 10
        },
        vscode: {
          status_location: 'terminal',
          use_terminal_api: true
        }
      }
    };
  }
}
```

## Command-Line Flag Integration

### Enhanced CLI Arguments
```typescript
interface LaunchOptions {
  debug?: boolean;
  port?: number;
  noCore?: boolean;
  restore?: string;
  // New options
  mode?: 'auto' | 'tmux' | 'inline' | 'statusbar' | 'window';
  autoDetect?: boolean;
  respectLayout?: boolean;
  split?: 'horizontal' | 'vertical';
  splitSize?: number;
}

// Usage examples:
// orchflow --mode=inline              # Force inline mode
// orchflow --mode=tmux                # Force tmux mode
// orchflow --auto-detect              # Skip all prompts
// orchflow --respect-layout           # Don't modify existing panes
// orchflow --split=vertical --split-size=40  # Custom split
```

### Argument Parsing Enhancement
```typescript
// Enhanced argument parsing in main()
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--mode':
      options.mode = args[++i] as any;
      break;
    case '--auto-detect':
      options.autoDetect = true;
      break;
    case '--respect-layout':
      options.respectLayout = true;
      break;
    case '--split':
      options.split = args[++i] as any;
      break;
    case '--split-size':
      options.splitSize = parseInt(args[++i]);
      break;
    // ... existing cases
  }
}
```

## Status Display Modes

### 1. Tmux Split Mode (Full Featured)
```
┌─────────────────────┬─────────────────────────┐
│ Primary Terminal    │ Live Status Pane        │
│ (Claude-Code)       │ (Auto-updating)         │
│                     │                         │
│ Natural conversation│ Worker status           │
│ with Claude         │ Progress bars           │
│                     │ Resource usage          │
│                     │ Quick navigation        │
└─────────────────────┴─────────────────────────┘
```

### 2. Inline Mode (Minimal)
```
Claude: "Starting authentication refactor..."
[AUTH: 45%] [TEST: 23%] [DOCS: 90%] [CPU: 34%]
> _
```

### 3. VS Code Status Bar
```
┌─────────────────────────────────────────────┐
│ Claude: "Building authentication..."        │
│ > _                                         │
└─────────────────────────────────────────────┘
[OrchFlow: 3 workers | AUTH 45% | ▶ Details]
```

### 4. Separate Window
Opens dedicated VS Code window with full dashboard

## Testing Strategy

### Unit Tests
- Environment detection accuracy
- Configuration file parsing
- User input validation
- Setup flow routing logic

### Integration Tests
- End-to-end setup flows
- Cross-platform compatibility
- Configuration persistence
- Fallback scenarios

### User Experience Tests
- Setup time measurements
- User satisfaction surveys
- Error handling scenarios
- Performance impact assessment

## Migration Strategy

### Backward Compatibility
- Existing `cli-injected.ts` behavior preserved as fallback
- Gradual rollout with feature flags
- Configuration migration for existing users
- Deprecation notices for old patterns

### Rollout Plan
1. **Phase 1**: Deploy environment detection (no behavior changes)
2. **Phase 2**: Enable routing with opt-in flag
3. **Phase 3**: Default to new system with old system fallback
4. **Phase 4**: Remove old system after validation period

## Performance Considerations

### Optimization Targets
- Setup detection: <200ms
- Configuration loading: <50ms
- User interaction: <100ms response time
- Memory footprint: <10MB additional

### Monitoring
- Setup success/failure rates
- Setup time distribution
- User preference patterns
- Error frequency and types

## Documentation Updates

### User Documentation
- Updated setup guide with new flows
- Configuration file reference
- Troubleshooting guide
- Environment-specific tips

### Developer Documentation
- Architecture overview
- API reference
- Extension points
- Testing guidelines

## Success Criteria

### Technical Metrics
- ✅ 95% setup success rate across all environments
- ✅ <5 seconds average setup time
- ✅ 100% test coverage for core detection logic
- ✅ Zero breaking changes to existing API

### User Experience Metrics
- ✅ >4.5/5 user satisfaction score
- ✅ 80% reduction in setup-related support tickets
- ✅ 90% of users choose to save preferences
- ✅ <1% preference modification rate (indicating good defaults)

## Risk Assessment

### Technical Risks
- **Environment detection failures**: Mitigated by comprehensive fallbacks
- **Configuration corruption**: Mitigated by validation and defaults
- **Performance impact**: Mitigated by lazy loading and caching
- **Cross-platform issues**: Mitigated by extensive testing

### User Experience Risks
- **Setup complexity**: Mitigated by intelligent defaults
- **Preference confusion**: Mitigated by clear documentation
- **Migration issues**: Mitigated by backward compatibility

## Conclusion

This enhancement plan transforms OrchFlow's terminal setup from a basic fallback system to a sophisticated, user-friendly experience that adapts to any environment. The phased approach ensures stable rollout while the comprehensive testing strategy validates reliability across all target environments.

The implementation maintains backward compatibility while providing the foundation for advanced features like custom layouts, workspace integration, and intelligent performance optimization. This positions OrchFlow as a truly environment-agnostic orchestration platform that works seamlessly regardless of the user's terminal setup.