# VS Code-Style GUI for Orchflow

A modern developer environment that combines VS Code's intuitive GUI with tmux's powerful terminal multiplexing and AI-driven orchestration.

## 🎯 Key Features

### 1. **Unified Tab System**
- **File Tabs**: Traditional file editing tabs
- **Terminal Tabs**: Live terminal sessions as tabs
- **Dashboard Tabs**: System monitoring and analytics
- Seamless switching between files and terminals
- Tab persistence across sessions

### 2. **Smart Layout Management**
- Pre-defined layouts (Dev, TDD, Data Science)
- Visual pane arrangement
- Resizable and focusable panes
- Layout templates and customization

### 3. **Real-Time Synchronization**
- WebSocket-based state sync
- Live terminal output streaming
- Multi-client support
- Activity logging and monitoring

### 4. **Agent Integration**
- Terminal agents with specific roles
- Auto-spawn based on context
- Resource monitoring per agent
- Intelligent routing and orchestration

## 🚀 Quick Start

```typescript
import { createOrchestrator } from '@orchflow/orchestrator';

// Initialize with GUI features
const orchestrator = await createOrchestrator({
  enableGUI: true,
  enableWebSocket: true,
  port: 8080,
});

// Apply VS Code-style layout
await orchestrator.createLayout('dev-workspace');

// Create tabs
orchestrator.createTab({ type: 'file', title: 'main.ts', path: '/src/main.ts' });
orchestrator.createTab({ type: 'terminal', title: 'Dev Server', agentId: 'agent-1' });
orchestrator.createTab({ type: 'dashboard', title: 'System Monitor' });
```

## 📐 Layout Templates

### Development Workspace
```typescript
{
  id: 'dev-workspace',
  panes: [
    { position: 'main', agentType: 'editor', title: 'Editor' },
    { position: 'bottom-left', agentType: 'dev-server', title: 'Dev Server' },
    { position: 'bottom-right', agentType: 'logger', title: 'Logs' }
  ]
}
```

### TDD Workspace
```typescript
{
  id: 'tdd-workspace',
  panes: [
    { position: 'main', agentType: 'editor', title: 'Editor' },
    { position: 'side', agentType: 'test-runner', title: 'Tests' },
    { position: 'bottom', agentType: 'repl', title: 'REPL' }
  ]
}
```

### Data Science
```typescript
{
  id: 'data-science',
  panes: [
    { position: 'main', agentType: 'notebook', title: 'Notebook' },
    { position: 'bottom', agentType: 'python-repl', title: 'Python REPL' },
    { position: 'side', agentType: 'data-explorer', title: 'Resources' }
  ]
}
```

## 🔌 API Endpoints

### Dashboard
- `GET /api/dashboard/stats` - System statistics
- `GET /api/activity` - Activity log

### Terminals
- `GET /api/terminals` - List all terminals
- `GET /api/terminals/:id` - Get terminal details
- `POST /api/terminals/:id/attach` - Attach to terminal
- `POST /api/terminals/:id/kill` - Kill terminal
- `POST /api/terminals/:id/restart` - Restart terminal

### Layouts
- `GET /api/layouts/templates` - Available templates
- `POST /api/layouts/apply` - Apply layout
- `POST /api/layouts/save` - Save current layout

### Tabs
- `GET /api/tabs` - List all tabs
- `POST /api/tabs` - Create new tab
- `PUT /api/tabs/:id/activate` - Activate tab
- `DELETE /api/tabs/:id` - Close tab

### Commands
- `POST /api/command` - Execute command

## 🔄 WebSocket Events

### Client → Server
```typescript
// Tab actions
{ type: 'tab:activate', tabId: string }
{ type: 'tab:close', tabId: string, force?: boolean }
{ type: 'tab:rename', tabId: string, title: string }

// Pane actions  
{ type: 'pane:focus', paneId: string }
{ type: 'pane:resize', paneId: string, size: any }

// Layout actions
{ type: 'layout:apply', templateId: string }
{ type: 'layout:save', name: string }
```

### Server → Client
```typescript
// Tab events
{ type: 'tab:created', tab: Tab }
{ type: 'tab:activated', tabId: string }
{ type: 'tab:closed', tabId: string }

// Agent events
{ type: 'agent:output', agentId: string, output: string }
{ type: 'agent:status', agentId: string, status: string }

// System events
{ type: 'metrics:updated', metrics: SystemMetrics }
{ type: 'activity:logged', activity: ActivityLog }
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                   GUI Frontend                   │
│  (SvelteKit + Tauri / Web Interface)           │
└─────────────────┬───────────────────────────────┘
                  │ WebSocket
┌─────────────────▼───────────────────────────────┐
│              GUI State Manager                   │
│  • Tab synchronization                          │
│  • Layout management                            │
│  • Real-time updates                            │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│               Orchestrator                       │
│  • Agent management                             │
│  • Command routing                              │
│  • Session persistence                          │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│            Terminal Adapter                      │
│  • Tmux integration                             │
│  • Cross-platform support                       │
│  • Pane lifecycle                               │
└─────────────────────────────────────────────────┘
```

## 🎨 GUI Components

### 1. **Tab Manager**
- Unified tab system for files and terminals
- Tab persistence and state management
- Smart icons and categorization
- Drag-and-drop reordering

### 2. **Layout Manager**
- Pre-defined workspace templates
- Dynamic pane creation and positioning
- Layout import/export
- Responsive resizing

### 3. **GUI State Manager**
- Real-time state synchronization
- WebSocket client management
- Activity logging
- Metrics collection

## 🔮 Future Enhancements

1. **Collaborative Features**
   - Multi-user sessions
   - Shared cursors
   - Live code sharing

2. **AI Integration**
   - Smart command suggestions
   - Automated layout optimization
   - Context-aware agent spawning

3. **Advanced Visualizations**
   - Resource usage graphs
   - Dependency visualization
   - Performance profiling

4. **Plugin System**
   - Custom agent types
   - Layout extensions
   - Theme support

## 🚦 Getting Started

1. **Install Dependencies**
   ```bash
   npm install @orchflow/orchestrator
   ```

2. **Run the Demo**
   ```bash
   npm run demo:gui
   ```

3. **Open Dashboard**
   - API: http://localhost:3000
   - WebSocket: ws://localhost:8081

4. **Connect Frontend**
   - Use provided SvelteKit template
   - Or build custom UI with WebSocket client

## 📝 Example Usage

```typescript
// Initialize orchestrator with GUI
const orchestrator = await createOrchestrator({
  enableGUI: true,
  enableWebSocket: true,
});

// Set up API server
const app = express();
const dashboardAPI = new DashboardAPI(orchestrator);
app.use('/api', dashboardAPI.getRouter());

// Set up WebSocket
const wss = new WebSocketServer({ port: 8081 });
wss.on('connection', ws => {
  orchestrator.attachGUIClient(ws);
});

// Create development layout
await orchestrator.createLayout('dev-workspace');

// Start coding!
```

This VS Code-style GUI brings the best of both worlds: the familiarity and polish of VS Code's interface with the power and flexibility of terminal-based development orchestrated by AI.