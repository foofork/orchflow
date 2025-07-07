#!/bin/bash

echo "🔍 Checking prerequisites..."

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 16+"
    exit 1
fi
echo "✅ Node.js: $(node --version)"

# Check for Rust
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust not found. Please install Rust from https://rustup.rs"
    exit 1
fi
echo "✅ Rust: $(rustc --version)"

# Check for tmux
if ! command -v tmux &> /dev/null; then
    echo "⚠️  tmux not found. Installing is recommended:"
    echo "   macOS: brew install tmux"
    echo "   Ubuntu: sudo apt-get install tmux"
    echo ""
    echo "Continuing anyway (tmux integration won't work)..."
else
    echo "✅ tmux: $(tmux -V)"
fi

echo ""
echo "🚀 Starting Orchflow Desktop..."
echo ""

# Navigate to frontend directory
cd frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start Tauri in development mode
echo "🎯 Launching Tauri development server..."
echo "   Frontend: http://localhost:5173"
echo "   Desktop app will open automatically"
echo ""
echo "Press Ctrl+C to stop"
echo ""

npm run tauri:dev