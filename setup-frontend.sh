#!/bin/bash
# Setup script for OrchFlow frontend

cd "$(dirname "$0")"

echo "🚀 Setting up OrchFlow Frontend"
echo "=============================="

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed"
    exit 1
fi

if ! command -v cargo &> /dev/null; then
    echo "❌ Rust/Cargo is required for Tauri but not installed"
    echo "   Install from: https://rustup.rs/"
    exit 1
fi

echo "✅ Prerequisites checked"
echo ""

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install

echo ""
echo "✅ Frontend setup complete!"
echo ""
echo "Available commands:"
echo "  npm run dev         - Start development server (SvelteKit only)"
echo "  npm run tauri:dev   - Start with Tauri (desktop app)"
echo "  npm run build       - Build for production"
echo "  npm run tauri:build - Build desktop app"
echo ""
echo "Note: Make sure the orchestrator is running on port 8080"
echo "      cd orchestrator && npm install && tsx demo.ts"