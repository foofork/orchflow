#!/bin/bash

# Test Git Ignore Functionality
# This script runs tests to verify the git ignore implementation

echo "🧪 Testing Git Ignore Functionality"
echo "==================================="

# Set SQLX_OFFLINE to avoid database requirements during testing
export SQLX_OFFLINE=true

echo "📋 Running unit tests for git commands..."
cargo test git_commands::tests --lib -- --nocapture

echo ""
echo "📋 Running integration tests for file manager git features..."
cargo test file_manager::integration_tests --lib -- --nocapture

echo ""
echo "📋 Running all git-related tests..."
cargo test git --lib -- --nocapture

echo ""
echo "✅ Git functionality testing complete!"
echo ""
echo "📝 To test manually, you can:"
echo "1. Create a test repository with .gitignore"
echo "2. Use the git commands through the Tauri interface"
echo "3. Check that ignored files are properly marked in the file tree"