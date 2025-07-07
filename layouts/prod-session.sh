#!/usr/bin/env bash
# orchflow production monitoring session layout

session=${1:-orchflow-prod}
project_dir=${2:-$(pwd)}

# Create new session with monitoring dashboard
tmux new-session -d -s "$session" -n monitor -c "$project_dir"
tmux send-keys -t "$session:monitor" 'htop' C-m

# Create logs window with multiple panes
tmux new-window -t "$session" -n logs -c "$project_dir"

# Application logs (top left)
tmux send-keys -t "$session:logs" 'tail -f logs/app.log' C-m

# Error logs (top right)
tmux split-window -h -p 50 -t "$session:logs" -c "$project_dir"
tmux send-keys -t "$session:logs.1" 'tail -f logs/error.log' C-m

# Access logs (bottom left)
tmux split-window -v -p 50 -t "$session:logs.0" -c "$project_dir"
tmux send-keys -t "$session:logs.2" 'tail -f logs/access.log' C-m

# System logs (bottom right)
tmux split-window -v -p 50 -t "$session:logs.1" -c "$project_dir"
tmux send-keys -t "$session:logs.3" 'journalctl -f' C-m

# Create services window
tmux new-window -t "$session" -n services -c "$project_dir"
tmux send-keys -t "$session:services" 'docker ps' C-m

# Create database window
tmux new-window -t "$session" -n database -c "$project_dir"
tmux send-keys -t "$session:database" '# Database console' C-m

# Focus on monitor window
tmux select-window -t "$session:monitor"

# Attach if not already in tmux
if [ -z "$TMUX" ]; then
    tmux attach-session -t "$session"
fi