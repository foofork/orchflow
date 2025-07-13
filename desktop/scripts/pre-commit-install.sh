#!/bin/bash
# Pre-commit installation script for Orchflow Desktop

set -e

echo "🔧 Installing pre-commit hooks for Orchflow Desktop..."

# Check if pre-commit is installed
if ! command -v pre-commit &> /dev/null; then
    echo "❌ pre-commit is not installed. Installing..."
    
    # Try different installation methods
    if command -v pip &> /dev/null; then
        pip install pre-commit
    elif command -v pipx &> /dev/null; then
        pipx install pre-commit
    elif command -v brew &> /dev/null; then
        brew install pre-commit
    else
        echo "❌ Could not install pre-commit. Please install manually:"
        echo "   pip install pre-commit"
        echo "   # or"
        echo "   brew install pre-commit"
        exit 1
    fi
fi

# Install the git hook scripts
echo "📦 Installing pre-commit hooks..."
pre-commit install

# Optionally run on all files
if [[ "${1:-}" == "--all" ]]; then
    echo "🧹 Running pre-commit on all files..."
    pre-commit run --all-files
fi

echo "✅ Pre-commit hooks installed successfully!"
echo ""
echo "📋 Hooks configured:"
echo "   • TypeScript type checking"
echo "   • ESLint with auto-fix"
echo "   • Rust compilation check"
echo "   • Rust formatting (cargo fmt)"
echo "   • Rust clippy lints"
echo "   • Prettier code formatting"
echo "   • Secret detection"
echo "   • Basic file validation"
echo ""
echo "💡 To skip hooks temporarily: git commit --no-verify"
echo "💡 To run hooks manually: pre-commit run --all-files"