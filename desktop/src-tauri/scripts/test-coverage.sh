#!/bin/bash
# Test coverage script for local development

set -e

echo "🧪 Running test coverage analysis..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if cargo-tarpaulin is installed
if ! command -v cargo-tarpaulin &> /dev/null; then
    echo "📦 Installing cargo-tarpaulin..."
    cargo install cargo-tarpaulin
fi

# Run tests with coverage
echo "🔍 Generating coverage report..."
cargo tarpaulin --out Html --out Lcov --all-features --workspace \
    --exclude-files "*/tests/*" \
    --exclude-files "*/bin/*" \
    --exclude-files "*/build.rs" \
    --ignore-panics --ignore-tests \
    --timeout 300 \
    --print-summary

# Extract coverage percentage
COVERAGE=$(cargo tarpaulin --print-summary --all-features --workspace \
    --exclude-files "*/tests/*" \
    --exclude-files "*/bin/*" \
    --exclude-files "*/build.rs" \
    --ignore-panics --ignore-tests \
    2>/dev/null | grep "Coverage" | awk '{print $2}' | sed 's/%//')

# Check if coverage meets threshold
THRESHOLD=85
if (( $(echo "$COVERAGE >= $THRESHOLD" | bc -l) )); then
    echo -e "${GREEN}✅ Coverage: ${COVERAGE}% (meets ${THRESHOLD}% threshold)${NC}"
else
    echo -e "${RED}❌ Coverage: ${COVERAGE}% (below ${THRESHOLD}% threshold)${NC}"
    exit 1
fi

# Open coverage report in browser if available
if [[ "$OSTYPE" == "darwin"* ]]; then
    open tarpaulin-report.html
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open tarpaulin-report.html 2>/dev/null || true
fi

echo "📊 Coverage report generated: tarpaulin-report.html"
echo "📈 LCOV report generated: lcov.info"