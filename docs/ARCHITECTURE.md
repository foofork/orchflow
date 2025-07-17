# OrchFlow Architecture

## Overview

OrchFlow features a **unified architecture** built for production-ready orchestration with comprehensive type safety and streamlined component integration. The system consolidates multiple orchestrators into a single, powerful orchestration engine while maintaining full backwards compatibility.

## Key Architecture Components

### 1. **Unified Setup System** (Automated Environment Setup)
```
User launches: orchflow

What happens:
1. UnifiedSetupOrchestrator initializes (single orchestrator)
2. Automatic tmux installation if needed (9 package managers supported)
3. 5 Core Managers initialize (ConfigurationManager, ContextManager, etc.)
4. MCP tools register with proper type safety
5. Terminal UI launches with real-time status monitoring
6. User has normal Claude conversation with orchestration happening naturally
```

### 2. **Unified Manager System** (5 Core Managers)
```typescript
Core Management Layer
├── ConfigurationManager (unified config with caching)
├── ContextManager (memory, conversation, session context)
├── TerminalManager (terminal lifecycle and state)
├── WorkerManager (worker orchestration)
└── UIManager (status pane and user interface)
```

### 3. **Enhanced MCP Integration** (Type-Safe Tool Registration)
```typescript
OrchFlowCore (API Server)
├── Enhanced MCP Tools (7 specialized tools)
│   ├── orchflow_natural_task
│   ├── orchflow_smart_connect
│   ├── orchflow_status_rich
│   ├── orchflow_quick_access
│   ├── orchflow_session
│   ├── orchflow_performance
│   └── orchflow_help
├── Proper Public API
│   └── registerMCPTool() (no more private property access)
├── Unified Interfaces
│   └── All types in unified-interfaces.ts
└── Security Layer
    ├── Authentication
    ├── Rate limiting
    └── Input validation
```

### 4. **Type-Safe Worker System** (Production-Ready)
- Workers maintain proper type safety with unified interfaces
- Each worker has:
  - Conversation history (with SharedKnowledge interface)
  - Shared knowledge (facts, patterns, insights, bestPractices)
  - Code artifacts (properly typed)
  - Task context (string | Task union type handled safely)
  - Decisions made
- Workers appear as different "personalities" in the conversation

### 5. **Split Terminal Support** (Still Available!)
```
┌─────────────────────────┬──────────────────┐
│                         │                  │
│   Primary Terminal      │   Status Pane    │
│   (Claude Conv)         │   (Live Status)  │
│                         │                  │
│   70%                   │   30%            │
│                         │                  │
└─────────────────────────┴──────────────────┘
```

- **Primary Terminal**: Claude conversation with orchestration
- **Status Pane**: Real-time worker status, progress, metrics
- **Quick Access**: Press 1-9 to "switch context" to different workers

## How It All Works Together

### Example Flow:
1. **User**: "Build a complete e-commerce platform"

2. **Claude** (in primary terminal):
   - Recognizes this needs parallel work
   - Uses `orchflow_spawn_worker` MCP tool internally
   - Creates: Product Dev, Cart Dev, Payment Dev, Admin Dev
   - Shares data models between all workers
   - Continues conversation naturally

3. **Behind the Scenes**:
   - OrchFlow Core tracks all workers
   - Each worker's context is maintained
   - Status pane shows real-time progress
   - WebSocket updates flow to UI

4. **Context Switching**:
   - User: "How's the payment integration?"
   - Claude uses `orchflow_switch_context` internally
   - Loads payment worker's context
   - Continues conversation from that perspective

## Key Differences from Original Vision

### What Changed:
- **No worker terminals** - All work happens in Claude's context
- **No separate Claude instances** - One Claude, many contexts
- **No NLP parsing** - Claude understands naturally via MCP

### What Stayed:
- **Split screen layout** - Primary + Status pane
- **Worker orchestration** - Multiple parallel workers
- **Context switching** - Seamless perspective changes
- **Knowledge sharing** - Automatic information flow
- **Session persistence** - Save/restore capability

## Technical Stack

### Core Technologies:
- **TypeScript** - Type-safe implementation
- **Express.js** - API server for orchestration core
- **WebSocket (ws)** - Real-time updates
- **MCP SDK** - Model Context Protocol integration
- **tmux** - Terminal management (optional)

### Security:
- **API Key Authentication**
- **Rate Limiting** (LRU Cache + Redis)
- **CORS Protection**
- **Input Validation**
- **Audit Logging**

### Build & Deploy:
- **esbuild** - Fast bundling
- **Jest** - Testing framework
- **Docker** - Containerization
- **GitHub Actions** - CI/CD

## Benefits of This Architecture

1. **Natural Experience**: No learning curve - just talk to Claude
2. **Seamless Integration**: Orchestration feels native
3. **Efficient**: No spawning overhead
4. **Stateful**: Full context preservation
5. **Scalable**: API-based architecture
6. **Secure**: Enterprise-grade security

## File Structure
```
src/
├── cli-injected.ts         # Entry point - launches Claude with injections
├── core/
│   └── orchflow-core.ts    # Orchestration API server
├── mcp/
│   └── orchflow-mcp-server.ts  # MCP tool definitions
├── orchflow-injection.ts   # System prompts & tool configs
├── security/               # Enterprise security layer
├── types/                  # TypeScript definitions
└── primary-terminal/       # Terminal UI components (optional)
```

## Future Enhancements

While maintaining the injection architecture:
1. **Visual Workspace** - GUI for worker visualization
2. **Workflow Templates** - Pre-built orchestration patterns
3. **Plugin System** - Custom tool extensions
4. **Multi-Model Support** - Beyond Claude
5. **Distributed Execution** - Cross-machine orchestration

---

This architecture provides the best of both worlds: Claude's natural language understanding combined with powerful orchestration capabilities, all within a single conversation interface.