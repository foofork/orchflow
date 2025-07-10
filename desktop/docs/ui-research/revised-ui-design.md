# Revised OrchFlow UI Design: AI-First Terminal Experience

## Core Insight

Basic users will primarily interact through a **single AI-enhanced terminal**, not by manually managing multiple panes. Tools like Claude Code, ruv-fann, and claude-flow become the orchestration layer, abstracting away terminal complexity.

## Revised User Workflows

### Basic User Flow
```
1. Open OrchFlow → See file explorer + ONE terminal
2. Type: `claude "help me build a React app"`
3. Claude Code spawns terminals, runs commands, edits files
4. User sees progress in their main terminal
5. Other terminals are hidden but accessible if needed
```

### Advanced User Flow
```
1. Open OrchFlow → Minimal UI, multiple terminals
2. Manually orchestrate terminals
3. Use AI for specific tasks
4. Full control over layout and sessions
```

## Revised UI Architecture

### Basic Mode (AI-First)
```
┌────────────────────────────────────────────────────────┐
│ OrchFlow │ project-name │ 🤖 AI Active │ Settings │   │
├────────────┼───────────────────────────────────────────┤
│            │                                           │
│   Files    │          Main Terminal                   │
│            │                                           │
│ ├─ src/    │  $ claude "create a todo app"            │
│ │  ├─ app  │  🤖 Claude Code: I'll help you create   │
│ │  └─ ...  │  a todo app. Let me set up the project.  │
│ └─ test/   │                                           │
│            │  [Creating 3 background terminals...]     │
│            │  ✓ Installing dependencies (Terminal 2)  │
│            │  ✓ Starting dev server (Terminal 3)      │
│            │  ✓ Running tests (Terminal 4)            │
│            │                                           │
│ 🔍 Search  │  The app is now running at:             │
│            │  http://localhost:3000                   │
│            │                                           │
├────────────┴───────────────────────────────────────────┤
│ 💡 Tip: Say "claude help" for assistance │ 3 hidden   │
└────────────────────────────────────────────────────────┘
```

### Key Features for AI-First Experience

1. **Single Terminal Focus**
   - Large, comfortable terminal as primary interface
   - AI command input with syntax highlighting
   - Clear AI response formatting
   - Progress indicators for background operations

2. **AI Status Indicator**
   - Shows when AI is thinking/working
   - Lists active background terminals
   - Quick toggle to see all terminals
   - Resource usage of AI operations

3. **Hidden Complexity**
   - Background terminals run silently
   - Surface only errors or important output
   - "Show all terminals" option for debugging
   - Terminal notifications in status bar

## Revised Mode System

### 1. **AI Mode** (Default for new users)
- Single terminal with AI assistant
- File explorer for context
- Hidden orchestrated terminals
- AI status panel
- Natural language commands

### 2. **Hybrid Mode** (Transitional)
- Main AI terminal
- 1-2 visible work terminals
- Toggle between AI and manual control
- Learning shortcuts
- AI suggestions

### 3. **Expert Mode** (Power users)
- Multiple terminals visible
- Manual orchestration
- AI as optional tool
- Full keyboard control
- Custom layouts

### 4. **Zen Mode** (Unchanged)
- Distraction-free coding
- No UI chrome
- Pure focus

## AI Integration Features

### Command Enhancement
```bash
$ claude "run tests"
🤖 Running tests in background terminal #2...
   ✓ 15 tests passed
   
$ claude "why is this failing?"
🤖 I see a TypeScript error in app.ts:42. Let me fix it...
   [File automatically updated]
   
$ claude "deploy to vercel"
🤖 I'll help you deploy. First, I need to:
   1. Build the project ✓
   2. Run tests ✓
   3. Deploy to Vercel...
```

### AI Workspace Awareness
- AI can see all files in project
- Understands terminal output from all panes
- Tracks file changes and git status
- Monitors error states

### Progressive Disclosure via AI
Instead of UI complexity, users discover features through AI:

```bash
$ claude "how do I split my view?"
🤖 I can help you manage your workspace:
   - "show all terminals" - See everything I'm running
   - "split vertical" - Create a new terminal beside this one
   - "focus terminal 2" - Switch to a specific terminal
   Or just tell me what you want to do!
```

## Status Bar Redesign

```
┌─────────────────────────────────────────────────────────┐
│ 🤖 AI: Active │ 🖥️ Terminals: 1+3 │ 📁 main.ts │ ⚡ 12ms│
└─────────────────────────────────────────────────────────┘
```

- **AI Status**: Idle/Thinking/Working
- **Terminal Count**: Visible + Hidden
- **Performance**: Still important for pros

## Implementation Priorities

### Phase 1: AI-First Terminal
1. Enhance single terminal experience
2. Integrate Claude Code/claude-flow
3. Background terminal management
4. AI status indicators

### Phase 2: Orchestration Features  
1. Terminal spawning from AI
2. Output aggregation
3. Error surfacing
4. Progress tracking

### Phase 3: Progressive Enhancement
1. "Show me" commands for learning
2. Gradual UI revelation
3. Shortcut discovery through AI
4. Mode progression tracking

## Benefits of This Approach

### For Basic Users
- **Zero learning curve**: Just talk to AI
- **No overwhelm**: One terminal to focus on
- **Gradual learning**: Discover features naturally
- **Always productive**: AI handles complexity

### For Power Users
- **Full control**: Can ignore AI completely
- **Efficiency**: AI for repetitive tasks
- **Flexibility**: Mix AI and manual work
- **Performance**: Same powerful backend

## Example User Journey

### Week 1: Pure AI
```bash
$ claude "help me learn OrchFlow"
$ claude "create a new project"
$ claude "fix this error"
```

### Week 2: Discovering Features
```bash
$ claude "show me the test output"
$ claude "I want to see two terminals"
$ show-all-terminals  # Learned command
```

### Week 3: Hybrid Usage
- Manually opens second terminal
- Uses AI for complex operations
- Starts using keyboard shortcuts
- Explores settings

### Month 2: Power User
- Multiple terminals
- Custom keybindings
- AI for specific tasks only
- Teaching others

## Conclusion

This revised design recognizes that **AI is the interface** for basic users. Instead of teaching terminal multiplexing, we let AI orchestrate complexity while users focus on their goals. The UI progressively reveals itself as users grow, but starts with the simplest possible interface: one terminal with an AI assistant.