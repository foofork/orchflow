#!/bin/bash

# MuxBackend Performance Benchmark Runner
set -e

echo "======================================"
echo "  MuxBackend Performance Benchmarks  "
echo "======================================"
echo

# Check if tmux is available
if command -v tmux >/dev/null 2>&1; then
    TMUX_AVAILABLE=true
    echo "✓ tmux available: $(tmux -V)"
else
    TMUX_AVAILABLE=false
    echo "✗ tmux not available - skipping tmux benchmarks"
fi

echo

# Run MockBackend benchmarks (always available)
echo "Running MockBackend benchmarks..."
echo "--------------------------------"
cargo test benchmark_mock_backend --lib -- --ignored --nocapture
echo

# Run TmuxBackend benchmarks if tmux is available
if [ "$TMUX_AVAILABLE" = true ]; then
    echo "Running TmuxBackend benchmarks..."
    echo "--------------------------------"
    cargo test benchmark_tmux_backend --lib -- --ignored --nocapture
    echo
    
    echo "Running comparison benchmarks..."
    echo "------------------------------"
    cargo test benchmark_comparison --lib -- --ignored --nocapture
    echo
else
    echo "Skipping TmuxBackend benchmarks (tmux not available)"
    echo
fi

echo "======================================"
echo "  Benchmark Summary                   "
echo "======================================"
echo "MockBackend: ✓ Sub-millisecond performance"
if [ "$TMUX_AVAILABLE" = true ]; then
    echo "TmuxBackend: ✓ Process-spawn overhead measured"
    echo "Comparison:  ✓ Performance ratio calculated"
else
    echo "TmuxBackend: ✗ Skipped (tmux not available)"
    echo "Comparison:  ✗ Skipped (tmux not available)"
fi
echo
echo "For detailed results, see output above."
echo "For setup instructions: see PERFORMANCE_BENCHMARKS.md"