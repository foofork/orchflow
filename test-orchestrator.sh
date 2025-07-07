#!/bin/bash
# Test the OrchFlow orchestrator

cd "$(dirname "$0")"

echo "🧪 Testing OrchFlow Orchestrator"
echo "================================"

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    echo "❌ tmux is required but not installed"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed"
    exit 1
fi

echo "✅ Prerequisites checked"
echo ""

# Install dependencies
echo "📦 Installing orchestrator dependencies..."
cd orchestrator
npm install --silent
echo "✅ Dependencies installed"
echo ""

# Check if tsx is available
if ! command -v tsx &> /dev/null; then
    echo "📦 Installing tsx globally..."
    npm install -g tsx
fi

# Run the demo
echo "🚀 Starting orchestrator demo..."
echo "Type 'help' for available commands"
echo ""

tsx demo.ts