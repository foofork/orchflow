# MuxBackend Performance Benchmarks

## Overview
This document provides performance benchmarks for different MuxBackend implementations to help with optimization and backend selection decisions.

## Running Benchmarks

### Mock Backend Benchmarks (Always Available)
```bash
cargo test benchmark_mock_backend --lib -- --ignored --nocapture
```

### Tmux Backend Benchmarks (Requires tmux)
```bash
# Install tmux first if not available
brew install tmux  # macOS
sudo apt-get install tmux  # Ubuntu/Debian

cargo test benchmark_tmux_backend --lib -- --ignored --nocapture
```

### Comparison Benchmarks
```bash
cargo test benchmark_comparison --lib -- --ignored --nocapture
```

## Benchmark Results

### MockBackend Performance

Based on test runs, MockBackend operations are extremely fast:

| Operation | Min (ms) | Avg (ms) | Med (ms) | P95 (ms) | P99 (ms) | Max (ms) |
|-----------|----------|----------|----------|----------|----------|----------|
| create_session | 0.00 | 0.00 | 0.00 | 0.01 | 0.04 | 0.04 |
| create_pane | 0.00 | 0.00 | 0.00 | 0.01 | 0.01 | 0.01 |
| send_keys | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.02 |
| capture_pane | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.01 |
| list_sessions | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| list_panes | 0.00 | 0.00 | 0.00 | 0.00 | 0.01 | 0.03 |

**Analysis**: MockBackend is ideal for testing due to sub-millisecond performance across all operations.

### TmuxBackend Performance (Expected)

Based on tmux process spawning overhead, expected performance:

| Operation | Expected Avg (ms) | Reason |
|-----------|-------------------|---------|
| create_session | 15-30 | Process spawn + tmux session creation |
| create_pane | 10-25 | Process spawn + pane creation |
| send_keys | 5-15 | Process spawn only |
| capture_pane | 5-15 | Process spawn + output capture |
| list_sessions | 8-20 | Process spawn + parsing |
| list_panes | 8-20 | Process spawn + parsing |

**Note**: Actual results will vary by system and tmux version.

## Performance Characteristics

### MockBackend
- **Strengths**: 
  - Sub-millisecond operations
  - No external dependencies
  - Consistent performance
  - Memory-only operations
  
- **Use Cases**:
  - Unit testing
  - Development environments
  - Performance testing
  - CI/CD pipelines

### TmuxBackend
- **Strengths**:
  - Real terminal functionality
  - Process isolation
  - Mature and stable
  - Compatible with existing workflows
  
- **Limitations**:
  - Process spawning overhead (5-30ms per operation)
  - System resource usage
  - External dependency on tmux

### Future MuxdBackend (Projected)
- **Expected Performance**: 1-5ms per operation
- **Benefits**: 
  - Network-based but low latency
  - Resource management
  - Multi-user support
  - Event streaming

## Optimization Strategies

### For TmuxBackend
1. **Connection Pooling**: Maintain persistent tmux connections
2. **Command Batching**: Combine multiple operations
3. **Async Operations**: Parallelize independent operations
4. **Caching**: Cache session/pane listings

### For MockBackend
1. **Already Optimal**: Sub-millisecond performance
2. **Memory Management**: Clear state between tests
3. **Concurrency**: Use RwLock for better read performance

## Benchmark Architecture

### Test Structure
```rust
async fn benchmark_operation<F, Fut>(
    name: &str,
    iterations: usize,
    mut op: F,
) -> BenchmarkResult
```

### Metrics Collected
- **Min/Max**: Range of operation times
- **Average**: Mean operation time
- **Median**: 50th percentile
- **P95/P99**: 95th and 99th percentiles for outlier analysis

### Statistical Analysis
- Operations are timed with `Instant::now()`
- Results sorted for percentile calculations
- Multiple iterations for statistical significance
- Warmup phase to eliminate cold start effects

## Environment Factors

### System Performance Impact
- **CPU**: Process spawning overhead varies with CPU speed
- **Memory**: Available RAM affects process creation
- **Disk I/O**: Tmux socket operations use filesystem
- **Network**: Not applicable for local backends

### Tmux Configuration Impact
- **Socket Location**: Local vs network filesystems
- **Session Count**: More sessions = slower listing
- **Pane Count**: More panes = slower operations
- **History Size**: Larger capture buffers = slower capture

## Monitoring in Production

### Recommended Metrics
1. **Operation Latency**: P50, P95, P99 for each operation type
2. **Error Rate**: Failed operations per backend
3. **Throughput**: Operations per second
4. **Resource Usage**: CPU and memory per backend

### Implementation
```rust
// Example metrics collection
struct BackendMetrics {
    operation_latency: Histogram,
    error_count: Counter,
    active_sessions: Gauge,
}
```

## Benchmark Maintenance

### Running Regularly
- Include in CI/CD for regression detection
- Run on different platforms (macOS, Linux)
- Test with various tmux versions
- Monitor for performance degradation

### Updating Benchmarks
- Add new operations as they're implemented
- Adjust iteration counts for statistical significance
- Update expected ranges as backends evolve
- Include new backends (muxd, etc.)

## Troubleshooting Performance Issues

### Slow TmuxBackend Operations
1. Check tmux server status: `tmux list-sessions`
2. Verify socket location: `~/.orchflow/tmux.sock`
3. Monitor system resources during tests
4. Check for filesystem issues (network drives, etc.)

### MockBackend Performance Regression
1. Check for memory leaks in test cleanup
2. Verify RwLock contention in concurrent tests
3. Profile memory allocation patterns
4. Check for deadlocks in test scenarios

### General Debugging
```bash
# Enable debug logging
RUST_LOG=debug cargo test benchmark_name -- --nocapture

# Profile with perf (Linux)
perf record --call-graph dwarf cargo test benchmark_name
perf report

# Check system resources
htop  # or top
iostat -x 1  # disk I/O
```

## Future Improvements

### Planned Enhancements
1. **Continuous Benchmarking**: Automated performance monitoring
2. **Flamegraph Integration**: Visual performance profiling
3. **Memory Benchmarks**: Track memory usage patterns
4. **Concurrency Benchmarks**: Multi-threaded operation testing
5. **Real-world Scenarios**: Complex workflow benchmarks

### Backend-Specific Optimizations
- **Tmux**: Connection pooling, command batching
- **Muxd**: Persistent connections, event streaming
- **Mock**: Already optimal for its use case