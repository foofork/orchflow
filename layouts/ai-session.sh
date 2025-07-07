#!/usr/bin/env bash
# orchflow AI agent orchestration session layout

session=${1:-orchflow-ai}
project_dir=${2:-$(pwd)}

# Create new session with orchestrator window
tmux new-session -d -s "$session" -n orchestrator -c "$project_dir"
tmux send-keys -t "$session:orchestrator" '# AI Orchestrator Dashboard' C-m

# Create editor agent window
tmux new-window -t "$session" -n editor-agent -c "$project_dir"
tmux send-keys -t "$session:editor-agent" 'nvim' C-m

# Create dev server agent window
tmux new-window -t "$session" -n dev-agent -c "$project_dir"
tmux send-keys -t "$session:dev-agent" '# Dev server agent' C-m

# Create test agent window with output monitoring
tmux new-window -t "$session" -n test-agent -c "$project_dir"
tmux send-keys -t "$session:test-agent" '# Test runner agent' C-m
tmux split-window -v -p 30 -t "$session:test-agent" -c "$project_dir"
tmux send-keys -t "$session:test-agent.1" '# Test output monitor' C-m

# Create REPL agents window (multiple REPLs)
tmux new-window -t "$session" -n repl-agents -c "$project_dir"

# Python REPL (top left)
tmux send-keys -t "$session:repl-agents" 'python3' C-m

# Node REPL (top right)
tmux split-window -h -p 50 -t "$session:repl-agents" -c "$project_dir"
tmux send-keys -t "$session:repl-agents.1" 'node' C-m

# Database console (bottom)
tmux split-window -v -p 50 -t "$session:repl-agents.0" -c "$project_dir"
tmux send-keys -t "$session:repl-agents.2" '# Database console' C-m

# Create logs aggregator window
tmux new-window -t "$session" -n logs -c "$project_dir"
tmux send-keys -t "$session:logs" 'tail -f logs/orchestrator.log' C-m

# Focus on orchestrator
tmux select-window -t "$session:orchestrator"

# Attach if not already in tmux
if [ -z "$TMUX" ]; then
    tmux attach-session -t "$session"
fi