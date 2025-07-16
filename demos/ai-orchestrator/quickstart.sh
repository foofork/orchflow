#!/bin/bash

# QuickStart Script for AI Terminal Orchestrator Demo
# This script sets up and runs the demo with optimal user experience

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== AI Terminal Orchestrator QuickStart ===${NC}"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "Checking prerequisites..."

if ! command_exists tmux; then
    echo -e "${RED}ERROR: tmux not found${NC}"
    echo "Please install tmux:"
    echo "  Ubuntu/Debian: sudo apt install tmux"
    echo "  macOS: brew install tmux"
    exit 1
fi

if ! command_exists node; then
    echo -e "${RED}ERROR: Node.js not found${NC}"
    echo "Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi

if ! command_exists cargo; then
    echo -e "${RED}ERROR: Rust not found${NC}"
    echo "Please install Rust from https://rustup.rs"
    exit 1
fi

# Optional: Check for claude tools
if ! command_exists claude-code; then
    echo -e "${YELLOW}WARNING: claude-code not found${NC}"
    echo "The demo will run in mock mode."
    echo "To use real Claude, install: npm install -g @anthropic-ai/claude-code"
    echo ""
    read -p "Continue in mock mode? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

if ! command_exists claude-flow; then
    echo -e "${YELLOW}WARNING: claude-flow not found${NC}"
    echo "Workers will run in mock mode."
    echo "To use real Claude-Flow, install: npm install -g claude-flow"
fi

# Clean up any existing sessions
echo ""
echo "Cleaning up any existing sessions..."
tmux kill-session -t ai-orchestrator 2>/dev/null || true
rm -f /tmp/orchestrator.sock

# Build the Rust components
echo ""
echo "Building OrchFlow components..."
cd /workspaces/orchflow/demos/ai-orchestrator
cargo build --release

if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Build failed${NC}"
    echo "Make sure you're in the OrchFlow workspace"
    exit 1
fi

# Create necessary scripts if they don't exist
if [ ! -f claude-monitor.js ]; then
    echo -e "${YELLOW}Creating claude-monitor.js...${NC}"
    cat > claude-monitor.js << 'EOF'
#!/usr/bin/env node
// Minimal mock for demo if the real file is missing
console.log('=== Claude-Code Mock Interface ===');
console.log('This is a mock interface. Type "orchestrate: <task>" to trigger orchestration.');
console.log('');

const readline = require('readline');
const net = require('net');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> '
});

rl.prompt();

rl.on('line', (line) => {
  if (line.startsWith('orchestrate:')) {
    const task = line.substring(12).trim();
    console.log(`\nClaude: I'll orchestrate "${task}" for you...\n`);
    
    // Send to orchestrator
    const client = net.createConnection('/tmp/orchestrator.sock', () => {
      client.write(JSON.stringify({ task, timestamp: Date.now() }));
      client.end();
    });
    
    client.on('error', (err) => {
      console.error('Could not connect to orchestrator:', err.message);
    });
  } else {
    console.log(`Claude: I understand. Try "orchestrate: build a REST API"`);
  }
  rl.prompt();
});
EOF
    chmod +x claude-monitor.js
fi

# Make scripts executable
chmod +x claude-monitor.js 2>/dev/null || true

# Start the demo
echo ""
echo -e "${GREEN}Starting AI Terminal Orchestrator...${NC}"
echo ""
echo "This will create a tmux session with:"
echo "  • Left pane: Claude-Code interface"
echo "  • Middle pane: Orchestrator monitor"
echo "  • Right pane: Worker terminals (dynamically created)"
echo ""
echo -e "${YELLOW}Tips:${NC}"
echo "  • Use Ctrl-b + arrows to navigate between panes"
echo "  • Use Ctrl-b + z to zoom current pane"
echo "  • Use Ctrl-b + d to detach (return with: tmux attach -t ai-orchestrator)"
echo ""
echo "Press Enter to continue..."
read

# Create tmux session and run everything
tmux new-session -d -s ai-orchestrator -n main

# Split into three panes
tmux split-window -h -p 66  # Split horizontally, right pane is 66%
tmux split-window -h -p 50  # Split the right pane in half

# Select panes and run commands
# Pane 0 (left): Claude monitor
tmux select-pane -t 0
tmux send-keys "cd /workspaces/orchflow/demos/ai-orchestrator" C-m
tmux send-keys "clear" C-m
tmux send-keys "node claude-monitor.js" C-m

# Pane 1 (middle): Orchestrator
tmux select-pane -t 1
tmux send-keys "cd /workspaces/orchflow/demos/ai-orchestrator" C-m
tmux send-keys "clear" C-m
tmux send-keys "./target/release/orchflow-orchestrator" C-m

# Pane 2 (right): Worker area
tmux select-pane -t 2
tmux send-keys "cd /workspaces/orchflow/demos/ai-orchestrator" C-m
tmux send-keys "clear" C-m
tmux send-keys "echo '=== Worker Area ==='" C-m
tmux send-keys "echo 'Workers will appear here when orchestrator spawns them'" C-m

# Set pane titles
tmux select-pane -t 0 -T "Claude-Code"
tmux select-pane -t 1 -T "Orchestrator"
tmux select-pane -t 2 -T "Workers"

# Focus on the Claude pane
tmux select-pane -t 0

# Attach to session
echo -e "${GREEN}Demo is running!${NC}"
echo ""
echo "In the Claude-Code pane (left), try typing:"
echo "  orchestrate: Build a REST API with authentication"
echo ""
echo "Or if you have real claude-code:"
echo "  Build a REST API with authentication"
echo ""

tmux attach-session -t ai-orchestrator