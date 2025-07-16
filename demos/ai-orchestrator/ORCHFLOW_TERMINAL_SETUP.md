# OrchFlow Terminal Setup & Configuration

## Overview

OrchFlow provides a zero-friction setup experience that intelligently adapts to any terminal environment. Users run a single command and OrchFlow automatically configures itself based on their environment, preferences, and available tools.

## Quick Start

```bash
# The only command users need:
npx claude-flow orchflow

# Or if installed locally:
./claude-flow orchflow
```

## Intelligent Environment Detection

### Terminal Capability Detection
```typescript
class OrchFlowLauncher {
  async detectTerminalCapabilities(): TerminalConfig {
    return {
      hasTmux: await this.checkCommand('tmux'),
      isInsideTmux: !!process.env.TMUX,
      isVSCode: !!process.env.VSCODE_PID || process.env.TERM_PROGRAM === 'vscode',
      isCodespaces: !!process.env.CODESPACES,
      terminalType: process.env.TERM_PROGRAM,
      terminalSize: await this.getTerminalSize(),
      userPreference: await this.loadUserPreference()
    };
  }

  async launch(): Promise<void> {
    const config = await this.detectTerminalCapabilities();
    
    // Smart routing based on environment
    if (config.isInsideTmux) {
      await this.launchTmuxMode();
    } else if (config.isVSCode && !config.hasTmux) {
      await this.launchVSCodeMode();
    } else if (config.hasTmux) {
      await this.offerTmuxSetup();
    } else {
      await this.launchInlineMode();
    }
  }
}
```

## Setup Flows by Environment

### 1. Tmux Users (Automatic Split)

```bash
# User already in tmux
$ ./claude-flow orchflow

# Automatic actions:
✓ Detecting tmux session...
✓ Creating 70/30 horizontal split...
✓ Starting status monitor in right pane...
✓ Initializing OrchFlow primary terminal...

# User immediately enters claude-code conversation:
┌─────────────────────┬─────────────────────────┐
│ OrchFlow Terminal   │ 🎯 Live Status         │
│                     │ ━━━━━━━━━━━━━━━━━━━━━━━ │
│ Claude: "Hello! I'm │ System: Ready           │
│ ready to help with  │ Workers: 0 active       │
│ your development."  │ CPU: [░░░░░░░░░░] 2%   │
│                     │ Mem: [██░░░░░░░░] 18%  │
│ > _                 │                         │
└─────────────────────┴─────────────────────────┘
```

### 2. VS Code Users (Choice Menu)

```bash
# In VS Code terminal
$ ./claude-flow orchflow

🎯 OrchFlow Setup - VS Code Detected
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

How would you like to see live status updates?

1. Split Terminal (recommended if tmux installed)
   └─ 70/30 split with live status pane

2. Inline Status
   └─ Status updates in main terminal
   
3. VS Code Status Bar
   └─ Minimal updates in bottom bar
   
4. Separate Window
   └─ Status in new VS Code window

Choose [1-4] or Enter for recommended: _

# After selection, enters claude-code:
Claude: "Hello! I'm ready to help with your development."
> _
```

### 3. Codespaces (Auto-Configuration)

```bash
# Automatically configured via devcontainer
# User opens terminal and sees:

🎯 OrchFlow Ready (Codespaces Edition)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Tmux configured
✓ Status monitor active
✓ Cloud resources optimized

Claude: "Hello! I'm ready to help with your development."
> _
```

### 4. Basic Terminal (Inline Mode)

```bash
# No tmux, basic terminal
$ ./claude-flow orchflow

🎯 OrchFlow Setup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tmux not found. Using inline status mode.

Tip: Install tmux for split-pane experience:
- Ubuntu/Debian: sudo apt install tmux
- macOS: brew install tmux

Press Enter to continue with inline mode...

# Enters claude-code with inline status:
Claude: "Hello! I'm ready to help with your development."
[Workers: 0] [CPU: 5%] [Mem: 156MB]
> _
```

## Configuration Options

### Command Line Flags
```bash
# Force specific mode
./claude-flow orchflow --mode=inline
./claude-flow orchflow --mode=tmux
./claude-flow orchflow --mode=vscode

# Skip setup prompts
./claude-flow orchflow --auto-detect

# Respect existing layout
./claude-flow orchflow --respect-layout

# Custom split configuration
./claude-flow orchflow --split=vertical --split-size=40
```

### Configuration File (Optional)
```yaml
# ~/.orchflow/config.yml or .orchflow/config.yml
terminal:
  # auto, tmux, inline, statusbar, window
  preferred_mode: auto
  
  # Skip all prompts and use preferences
  auto_setup: true
  
  tmux:
    # horizontal, vertical
    split_direction: horizontal
    
    # Percentage for status pane
    split_size: 30
    
    # right, left, bottom, top
    status_position: right
    
    # Respect existing pane layout
    respect_layout: false
    
  status:
    # Milliseconds between updates
    update_interval: 1000
    
    # Show CPU/Memory usage
    show_resources: true
    
    # Show detailed worker info
    show_details: true
    
    # Number of workers to show
    max_workers_display: 10
    
  vscode:
    # terminal, statusbar, window
    status_location: terminal
    
    # Use VS Code's terminal API
    use_terminal_api: true
```

### User Preference Storage
```typescript
// Remembered preferences
interface UserPreferences {
  mode: 'tmux' | 'inline' | 'statusbar' | 'window';
  tmuxSplitDirection?: 'horizontal' | 'vertical';
  tmuxSplitSize?: number;
  skipSetup?: boolean;
  lastUsed: Date;
}

// Save after first setup
await saveUserPreference(selectedMode);

// Next time, skip prompts if preference exists
const pref = await loadUserPreference();
if (pref && pref.skipSetup) {
  return launchWithMode(pref.mode);
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

## Advanced Tmux Features

### For Tmux Power Users
```bash
./claude-flow orchflow --tmux-bindings

# Enables OrchFlow tmux shortcuts:
Keyboard Shortcuts Enabled:
- Ctrl+O, 1-9: Jump to worker pane
- Ctrl+O, s: Toggle status pane
- Ctrl+O, f: Fullscreen current pane
- Ctrl+O, d: Show full dashboard
- Ctrl+O, p: Pause all workers
- Ctrl+O, r: Resume all workers
- Ctrl+O, 0: Return to primary
```

### Custom Tmux Layouts
```bash
# Use existing pane
./claude-flow orchflow --use-pane=2

# Create new window instead of split
./claude-flow orchflow --new-window

# Vertical split on left
./claude-flow orchflow --split=vertical --position=left
```

## Primary Terminal Experience

After setup completes, users enter the standard claude-code interface with OrchFlow enhancements:

```bash
# Standard claude-code conversation
Claude: "Hello! I'm ready to help with your development. I can coordinate 
complex tasks using multiple workers while keeping this conversation flowing."

User: "Build a React authentication system"

Claude: "I'll set up a team to build that authentication system. Let me 
coordinate the work across specialized workers..."

# Status pane shows:
🎯 Active Workers (3 starting)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. JWT Auth Builder
   [░░░░░░░░░░░░] Starting...
   
2. React UI Developer  
   [░░░░░░░░░░░░] Starting...
   
3. Security Tester
   [░░░░░░░░░░░░] Queued

# Conversation continues normally while work proceeds
Claude: "I've started three specialized workers:
- JWT Auth Builder: Setting up backend authentication
- React UI Developer: Creating login/signup components  
- Security Tester: Will validate the implementation

You can ask me about progress anytime or press 1-3 to inspect any worker."

User: "Sounds good. Make sure to use TypeScript"

Claude: "Absolutely! I'll ensure all workers use TypeScript with proper type 
definitions. The React developer is already configured for TypeScript, and 
the JWT builder will create fully typed interfaces."

# Natural conversation continues while workers execute in background
```

## Setup Script Example

```bash
#!/bin/bash
# claude-flow orchflow setup script

echo "🎯 OrchFlow Terminal Architecture"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Detect environment
if [ -n "$TMUX" ]; then
    echo "✓ Tmux session detected"
    setup_tmux_mode
elif [ -n "$VSCODE_PID" ]; then
    echo "✓ VS Code detected"
    show_vscode_options
elif command -v tmux &> /dev/null; then
    echo "✓ Tmux available"
    offer_tmux_setup
else
    echo "ℹ Tmux not found"
    setup_inline_mode
fi

# Launch primary terminal with claude-code
exec node ./orchflow-primary.js
```

## Key Benefits

1. **Zero Configuration**: Works out of the box
2. **Smart Detection**: Adapts to any environment
3. **User Choice**: Offers options when multiple modes available
4. **Remembers Preferences**: One-time setup
5. **Progressive Enhancement**: Better features with better terminals
6. **Seamless Transition**: Setup leads directly into claude-code conversation
7. **Power User Friendly**: Advanced options for those who want them

## Implementation Priority

1. **Phase 1**: Basic tmux/inline detection and setup
2. **Phase 2**: VS Code integration and status bar
3. **Phase 3**: User preferences and configuration file
4. **Phase 4**: Advanced tmux bindings and layouts
5. **Phase 5**: Codespaces optimization

This setup ensures every user gets the best possible OrchFlow experience for their environment with minimal friction.