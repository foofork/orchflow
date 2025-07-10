#!/bin/bash

# Script to run tests with coverage report
# Requires cargo-tarpaulin: cargo install cargo-tarpaulin

echo "Running test coverage analysis..."

# Clean previous runs
cargo clean

# Run tests with coverage
cargo tarpaulin \
  --out Html \
  --out Lcov \
  --output-dir ./coverage \
  --exclude-files "*/tests/*" \
  --exclude-files "*/test_*.rs" \
  --exclude-files "*_test.rs" \
  --exclude-files "*/bin/*" \
  --exclude-files "*/benchmarks/*" \
  --ignore-panics \
  --timeout 300 \
  --features "test-mode"

# Display summary
echo ""
echo "Coverage report generated in ./coverage/tarpaulin-report.html"
echo ""
echo "Summary:"
cargo tarpaulin --print-summary

# Check if we meet 85% threshold
COVERAGE=$(cargo tarpaulin --print-summary | grep "Coverage" | awk '{print $2}' | sed 's/%//')
THRESHOLD=85

if (( $(echo "$COVERAGE >= $THRESHOLD" | bc -l) )); then
    echo "✅ Coverage target met: $COVERAGE% >= $THRESHOLD%"
    exit 0
else
    echo "❌ Coverage below target: $COVERAGE% < $THRESHOLD%"
    exit 1
fi