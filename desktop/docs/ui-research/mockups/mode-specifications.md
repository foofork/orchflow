# OrchFlow UI Mode Specifications

## Mode Selector Component

Located in the top-left corner, the mode selector provides instant switching between UI modes:

```
┌─────────────────┐
│ 📚 Guided  ▼   │  <- Dropdown with mode options
└─────────────────┘
```

### Mode Indicator States
- **Guided**: 📚 (book icon) - Learning-focused
- **Standard**: ⚡ (lightning) - Balanced productivity  
- **Power**: 🚀 (rocket) - Maximum efficiency
- **Zen**: 🧘 (meditation) - Distraction-free

## Guided Mode Layout

```
┌──────────────────────────────────────────────────────────────┐
│ 📚 Guided ▼ │ OrchFlow - project.ts │ Help │ Settings │ User │
├─────────────┼────────────────────────────────────────────────┤
│ Files       │ Editor                 │ Assistant            │
│ ├─ src/     │ function main() {      │ ┌──────────────────┐ │
│ │  ├─ app.ts│   console.log('...');  │ │ 💡 Tip of the Day│ │
│ │  └─ ...   │ }                      │ │                  │ │
│ └─ tests/   │                        │ │ Press Ctrl+P to  │ │
│             │────────────────────────│ │ open any file    │ │
│ Terminal 1  │ Terminal               │ │ quickly!         │ │
│ Terminal 2+ │ $ npm run dev          │ │                  │ │
│             │ Server running...      │ │ [Learn More]     │ │
│             │                        │ └──────────────────┘ │
├─────────────┴────────────────────────┴──────────────────────┤
│ 📁 app.ts • ✓ Saved • Git: main • 🔄 Sync • Memory: 45MB    │
└──────────────────────────────────────────────────────────────┘
```

### Guided Mode Features
- **Persistent file explorer** with visual Git status
- **Terminal tabs** with descriptive names
- **Assistant panel** with contextual help
- **Toolbar** with common actions (New, Save, Run, etc.)
- **Visual breadcrumbs** for navigation
- **Hover tooltips** on all UI elements
- **Welcome overlay** on first launch

## Standard Mode Layout

```
┌──────────────────────────────────────────────────────────────┐
│ ⚡ Standard ▼ │ Cmd+P: Files │ Cmd+Shift+P: Commands │ ⚙️   │
├───────────────┼──────────────────────────────────────────────┤
│ Explorer      │ Editor                  │ Terminal          │
│ [Cmd+B]       │                         │                   │
│ ├─ src/       │ function process() {    │ $ npm test       │
│ └─ tests/     │   return data.map(...)  │ ✓ 15 passing     │
│               │ }                       │                   │
│ Outline       │                         │ Problems  Output  │
│ ├─ process    │─────────────────────────┴──────────────────┤
│ └─ utils      │ Terminal 2              │ Terminal 3       │
│               │ $ git status            │ $ node repl      │
│               │ On branch: feature/ui   │ >                │
├───────────────┴─────────────────────────┴──────────────────┤
│ main.ts:42:5 • TypeScript • 2 errors • Git: 3↑ 2↓         │
└──────────────────────────────────────────────────────────────┘
```

### Standard Mode Features
- **Collapsible panels** (toggle with shortcuts)
- **Command bar** prominence
- **Keyboard shortcuts** displayed
- **Multi-pane** editing
- **Integrated terminal** with tabs
- **Status bar** with key metrics
- **Quick actions** via command palette

## Power Mode Layout

```
┌──────────────────────────────────────────────────────────────┐
│ 🚀 │ :e src/app.ts                                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1  import { Terminal } from './terminal';                  │
│  2  import { SwarmManager } from './ai/swarm';              │
│  3                                                           │
│  4  export class OrchFlow {                                 │
│  5    private swarm: SwarmManager;                          │
│  6                                                           │
│  7    constructor() {                                        │
│  8      this.swarm = new SwarmManager({                     │
│  9        agents: 8,                                         │
│ 10        topology: 'mesh'                                   │
│ 11      });                                                  │
│ 12    }                                                      │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ NORMAL │ app.ts:7:15 │ mesh-swarm │ 127.0.0.1:7890 │ 12ms │
└──────────────────────────────────────────────────────────────┘
```

### Power Mode Features
- **Minimal chrome** - just content and status
- **Vim-style** command line
- **No mouse** dependencies
- **Custom status line** with performance metrics
- **Quick split** navigation (Ctrl+W)
- **Floating windows** for temporary views
- **Swarm monitor** overlay (toggle: Ctrl+S)
- **Performance HUD** (toggle: Ctrl+H)

## Zen Mode Layout

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                                                              │
│  function calculateOptimalPath(nodes: Node[]): Path {       │
│    // Deep focus on the algorithm at hand                   │
│    const distances = new Map<Node, number>();               │
│                                                              │
│    for (const node of nodes) {                              │
│      distances.set(node, Infinity);                         │
│    }                                                         │
│                                                              │
│    // Implementation continues...                            │
│                                                              │
│                                                              │
│                                                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Zen Mode Features
- **No UI elements** visible by default
- **Full screen** content
- **Smooth transitions** in/out
- **Maintains state** when exiting
- **Emergency exit**: ESC ESC
- **Subtle indicators** on hover (top/bottom edge)

## Responsive Behavior

### Small Screens (< 1280px)
- Auto-switch to **single panel** layouts
- **Tab-based** navigation for panels
- **Compact mode** for status bar
- **Touch-optimized** in Guided mode

### Large Screens (> 2560px)
- **Multi-column** editor support
- **Persistent sidebars** in Standard mode
- **Picture-in-picture** terminals
- **Extended status bar** with more metrics

## Theme Integration

Each mode can have optimized themes:
- **Guided**: Higher contrast, clear boundaries
- **Standard**: Balanced, professional
- **Power**: Minimal, syntax-focused
- **Zen**: Ultra-minimal, paper-like

## Keyboard Shortcuts by Mode

### Global (All Modes)
- `Cmd/Ctrl + Shift + M`: Switch mode
- `Cmd/Ctrl + ,`: Settings
- `Cmd/Ctrl + Q`: Quit

### Guided Mode
- `F1`: Show help
- `Cmd/Ctrl + N`: New file (with dialog)
- `Cmd/Ctrl + S`: Save (with confirmation)

### Standard Mode  
- `Cmd/Ctrl + P`: Quick file open
- `Cmd/Ctrl + Shift + P`: Command palette
- `Cmd/Ctrl + B`: Toggle sidebar

### Power Mode
- `:`: Vim command mode
- `Ctrl + W`: Window navigation
- `g + t`: Next terminal
- Custom mappings via `.orchflow/keybindings.json`

### Zen Mode
- `ESC ESC`: Exit zen mode
- All other shortcuts disabled for focus

## Transition Animations

- **Mode switches**: 200ms fade transition
- **Panel toggles**: 150ms slide
- **Zen mode**: 300ms zoom effect
- **Tooltips**: 100ms fade in after 500ms hover

## Accessibility Features

- **High contrast** mode for each UI mode
- **Screen reader** announcements for mode changes
- **Keyboard navigation** for all features
- **Focus indicators** clearly visible
- **Reduced motion** option