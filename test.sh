#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Test orchflow in isolation
echo "Testing orchflow..."
echo "==================="
echo ""
echo "Starting Neovim with orchflow config..."
echo "Use :OrchSpawn to create terminals"
echo "Use :OrchDashboard or <leader>d to see dashboard"
echo ""

# Change to orchflow directory and run Neovim
cd "$SCRIPT_DIR"
nvim -u init.lua "$@"