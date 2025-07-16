#!/bin/bash

echo "=== OrchFlow AI Terminal Orchestrator Demo ==="
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v tmux &> /dev/null; then
    echo "ERROR: tmux not found. Please install tmux first."
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js not found. Please install Node.js first."
    exit 1
fi

if ! command -v claude-code &> /dev/null; then
    echo "WARNING: claude-code not found. Demo will use mock mode."
    echo "Install with: npm install -g @anthropic-ai/claude-code"
fi

if ! command -v claude-flow &> /dev/null; then
    echo "WARNING: claude-flow not found. Workers will use mock mode."
    echo "Install with: npm install -g claude-flow"
fi

# Clean up any existing session
echo "Cleaning up any existing sessions..."
tmux kill-session -t ai-orchestrator 2>/dev/null
rm -f /tmp/orchestrator.sock

# Build the demo
echo "Building the demo..."
cd /workspaces/orchflow/demos/ai-orchestrator
cargo build --release

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to build. Make sure you're in the OrchFlow workspace."
    exit 1
fi

# Make claude-monitor executable
chmod +x claude-monitor.js

echo ""
echo "Starting the AI Orchestrator demo..."
echo ""
echo "This will create a tmux session with:"
echo "  - Left pane: Claude-Code (primary terminal)"
echo "  - Middle pane: Orchestrator monitor"
echo "  - Right pane: Worker terminals (will split as needed)"
echo ""
echo "Try asking Claude to build something complex!"
echo ""

# Run the demo
cargo run --bin orchflow-ai-demo

# On exit
echo ""
echo "Demo ended. To reattach: tmux attach -t ai-orchestrator"