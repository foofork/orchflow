# Requirements Verification - AI Terminal Orchestrator

## Critical Requirements Check

### 1. ❓ Claude-Code Integration Challenges

**Issue**: Claude-code is designed for interactive use, not as a programmable API.

**Reality Check**:
- ❌ No system prompt flag documented
- ❌ Cannot inject custom behavior to emit orchestration commands
- ✅ Has print mode (-p) but returns natural language, not structured commands
- ✅ Has JSON output format but for the entire response, not custom payloads

**Solution Required**:
```bash
# This won't work as imagined:
claude-code --system-prompt "emit ORCHESTRATE commands"

# Reality - need a different approach:
# Option 1: Parse claude-code's natural language output
# Option 2: Create a custom prompt that claude-code will respond to
# Option 3: Use claude-code SDK instead of CLI
```

### 2. ✅ Claude-Flow Integration

**Working Approach**:
```bash
# Claude-flow can be spawned and controlled
claude-flow sparc run architect "Design REST API"
claude-flow swarm "Build authentication system" --output json

# Can capture output and parse status
```

### 3. ⚠️ Terminal Display Requirements

**Current Plan Issues**:
- Opening multiple terminal windows programmatically is OS-specific
- Terminal emulators vary widely (Terminal.app, iTerm, gnome-terminal, etc.)
- No standard way to position windows

**Better Approach**:
```javascript
// Use a single window with panes (tmux) or web UI
// Option 1: tmux sessions
tmux new-session -s ai-demo
tmux split-window -h
tmux split-window -v

// Option 2: Web-based with xterm.js (most portable)
```

### 4. 🔴 Critical Missing Pieces

#### A. Claude-Code Command Extraction
The fundamental assumption that claude-code will output structured commands is **incorrect**.

**What Actually Happens**:
```bash
$ claude-code -p "Build a REST API" --output-format json
{
  "response": "I'll help you build a REST API. Here's how we can approach this...",
  "usage": { "input_tokens": 50, "output_tokens": 200 }
}
```

**What We Need**:
A way to make claude-code emit parseable orchestration instructions.

#### B. Inter-Process Communication
File-based watching has race conditions and isn't efficient.

**Better Options**:
1. **Message Queue** (Redis, RabbitMQ)
2. **WebSocket Server** (for real-time updates)
3. **Unix Domain Sockets** (for local IPC)
4. **Named Pipes** (simple but limited)

### 5. 📋 Revised Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Revised Architecture                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Custom Claude Wrapper Script                         │
│     - Prompts claude-code with specific format          │
│     - Parses responses for action keywords              │
│     - Emits structured commands                         │
│                                                          │
│  2. WebSocket Message Bus                                │
│     - Central communication hub                          │
│     - All terminals connect via WebSocket               │
│     - Real-time bidirectional messaging                 │
│                                                          │
│  3. Web-Based UI (Most Practical)                       │
│     - Three xterm.js panels in browser                  │
│     - Consistent across all platforms                   │
│     - Easy to position and style                        │
│                                                          │
│  4. OrchFlow Integration                                 │
│     - Manages PTY sessions for each terminal            │
│     - Handles I/O streaming                             │
│     - Provides session persistence                       │
└─────────────────────────────────────────────────────────┘
```

### 6. 🔧 Implementation Fixes

#### Fix 1: Claude Wrapper with Keyword Detection
```javascript
// claude-wrapper.js
const { spawn } = require('child_process');

const claude = spawn('claude-code', ['-p', prompt, '--output-format', 'json']);

claude.stdout.on('data', (data) => {
  const response = JSON.parse(data);
  const text = response.response;
  
  // Look for action patterns in response
  if (text.includes('I will coordinate') || 
      text.includes('deploy agents') ||
      text.includes('orchestrate')) {
    
    // Extract agent types mentioned
    const agents = extractAgentTypes(text);
    
    // Emit orchestration command
    emitCommand({
      action: 'orchestrate',
      task: originalPrompt,
      agents: agents
    });
  }
});

function extractAgentTypes(text) {
  const agentTypes = ['architect', 'coder', 'tester', 'reviewer'];
  return agentTypes.filter(type => text.toLowerCase().includes(type));
}
```

#### Fix 2: Prompt Engineering
```javascript
// Craft prompts that elicit structured responses
const structuredPrompt = `
${userRequest}

Please respond with:
1. A brief acknowledgment
2. List the specialist agents you would deploy (architect, coder, tester, etc.)
3. End with "ORCHESTRATION PLAN:" followed by the agent list
`;
```

#### Fix 3: Use OrchFlow for Terminal Management
```rust
// Use OrchFlow instead of spawning raw terminals
use orchflow_terminal::PtyManager;

// Create managed PTY sessions
let claude_pty = pty_manager.spawn_pty("node", vec!["claude-wrapper.js"]).await?;
let orch_pty = pty_manager.spawn_pty("node", vec!["orchestrator.js"]).await?;

// Stream I/O through OrchFlow
let mut claude_output = claude_pty.output_stream();
while let Some(data) = claude_output.next().await {
    // Process and route output
}
```

### 7. ✅ Minimum Viable Demo Requirements

1. **Web UI with xterm.js** (cross-platform)
2. **WebSocket server** for communication
3. **Claude wrapper script** that detects keywords
4. **Simple orchestrator** that spawns claude-flow
5. **Status tracking** via WebSocket messages

### 8. 🚀 Quick Start Path

```bash
# 1. Create web UI
npx create-react-app ai-orchestrator-ui
cd ai-orchestrator-ui
npm install xterm xterm-addon-fit socket.io-client

# 2. Create WebSocket server
npm install express socket.io node-pty

# 3. Create claude wrapper
# Uses keyword detection, not system prompts

# 4. Test with mock commands first
# Then integrate real claude-code and claude-flow
```

### 9. ⚠️ Performance Considerations

- **PTY Overhead**: Each terminal has memory/CPU cost
- **Output Buffering**: Limit scrollback to prevent memory issues
- **WebSocket Messages**: Batch updates to reduce traffic
- **Process Cleanup**: Ensure workers terminate properly

### 10. 📝 Summary of Gaps

1. **Claude-code cannot be directly instructed** to output orchestration commands
2. **Terminal spawning is OS-specific** and problematic
3. **File-based IPC has race conditions**
4. **Need proper error handling** for failed workers
5. **Resource management** for multiple PTY sessions

## Recommended Approach

1. Start with **web-based UI** using xterm.js
2. Use **WebSocket** for all communication
3. Create **keyword-detecting wrapper** for claude-code
4. Implement **simple orchestrator** first
5. Add **OrchFlow integration** for production quality
6. Test with **mock agents** before real claude-flow

This approach is more realistic and will actually work in practice.