#!/usr/bin/env bash
# orchflow development session layout

session=${1:-orchflow-dev}
project_dir=${2:-$(pwd)}

# Create new session with editor window
tmux new-session -d -s "$session" -n editor -c "$project_dir"
tmux send-keys -t "$session:editor" 'nvim .' C-m

# Create dev server pane (bottom 30%)
tmux split-window -v -p 30 -t "$session:editor" -c "$project_dir"
tmux send-keys -t "$session:editor.1" '# Dev server - use :OrchSend dev "npm run dev"' C-m

# Create logs pane (right side of dev server)
tmux split-window -h -p 50 -t "$session:editor.1" -c "$project_dir"
tmux send-keys -t "$session:editor.2" '# Logs - tail -f logs/output.log' C-m

# Create test window
tmux new-window -t "$session" -n tests -c "$project_dir"
tmux send-keys -t "$session:tests" '# Test runner - npm test' C-m

# Create git window with status and log panes
tmux new-window -t "$session" -n git -c "$project_dir"
tmux send-keys -t "$session:git" 'git status' C-m
tmux split-window -h -p 50 -t "$session:git" -c "$project_dir"
tmux send-keys -t "$session:git.1" 'git log --oneline --graph -20' C-m

# Create repl window
tmux new-window -t "$session" -n repl -c "$project_dir"
tmux send-keys -t "$session:repl" '# REPL - node/python/etc' C-m

# Focus on editor
tmux select-window -t "$session:editor"
tmux select-pane -t "$session:editor.0"

# Attach if not already in tmux
if [ -z "$TMUX" ]; then
    tmux attach-session -t "$session"
fi