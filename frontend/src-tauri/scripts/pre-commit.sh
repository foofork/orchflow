#!/bin/bash
# Pre-commit hook script

set -e

echo "🔍 Running pre-commit checks..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Change to the src-tauri directory
cd "$(dirname "$0")/.."

# Check formatting
echo "📝 Checking Rust formatting..."
if ! cargo fmt -- --check; then
    echo -e "${RED}❌ Rust formatting issues found. Run 'cargo fmt' to fix.${NC}"
    exit 1
fi

# Run clippy
echo "🔧 Running clippy..."
if ! cargo clippy --all-features -- -D warnings; then
    echo -e "${RED}❌ Clippy warnings found.${NC}"
    exit 1
fi

# Run tests
echo "🧪 Running tests..."
if ! cargo test --all-features; then
    echo -e "${RED}❌ Tests failed.${NC}"
    exit 1
fi

# Check for sensitive information
echo "🔒 Checking for sensitive information..."
if grep -rE "(api_key|secret|password|token)\s*=\s*[\"'][^\"']+[\"']" src --include="*.rs" | grep -v "example\|test\|mock"; then
    echo -e "${RED}❌ Potential secrets found in code!${NC}"
    exit 1
fi

# Check for large files
echo "📦 Checking for large files..."
LARGE_FILES=$(find . -type f -size +5M -not -path "./target/*" -not -path "./.git/*")
if [ ! -z "$LARGE_FILES" ]; then
    echo -e "${YELLOW}⚠️  Large files detected:${NC}"
    echo "$LARGE_FILES"
    echo "Consider using Git LFS for these files."
fi

echo -e "${GREEN}✅ All pre-commit checks passed!${NC}"