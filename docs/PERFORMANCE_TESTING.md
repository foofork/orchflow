# Performance Testing Guide

## Overview

The orchflow performance testing suite ensures that all communication patterns meet the strict latency and throughput requirements necessary for a responsive terminal-based IDE experience.

## Performance Requirements

### Critical Latency Targets

| Component | P95 Latency | P99 Latency | Notes |
|-----------|-------------|-------------|-------|
| Terminal I/O | < 5ms | < 10ms | User input must feel instant |
| File System Events | < 10ms | < 20ms | File changes need quick reflection |
| Editor Sync | < 3ms | < 5ms | Cursor movements must be seamless |
| Window Resize | < 20ms | < 50ms | Smooth resize experience |

### Throughput Requirements

| Component | Minimum Throughput | Target Throughput |
|-----------|-------------------|-------------------|
| Terminal Output | 500 ops/sec | 1000 ops/sec |
| File Events | 100 ops/sec | 500 ops/sec |
| Cursor Updates | 1000 ops/sec | 5000 ops/sec |
| Message Passing | 10000 msg/sec | 50000 msg/sec |

### Resource Constraints

- Memory usage increase: < 100MB under load
- CPU usage: < 80% average during stress tests
- Memory leaks: < 10MB after cleanup

## Running Performance Tests

### Backend Performance Tests (Rust)

```bash
# Run all backend performance tests
cd desktop/src-tauri
cargo test --test performance_benchmarks --release -- --ignored

# Run specific test categories
cargo test --test performance_benchmarks terminal_io_tests --release -- --ignored
cargo test --test performance_benchmarks file_system_tests --release -- --ignored
cargo test --test performance_benchmarks editor_sync_tests --release -- --ignored
cargo test --test performance_benchmarks resource_tests --release -- --ignored

# Run stress tests (longer duration)
cargo test --test performance_benchmarks stress_tests --release -- --ignored
```

### Frontend Performance Tests (TypeScript)

```bash
# Run all frontend performance tests
cd desktop
npm run test:performance

# Run benchmarks
npm run bench

# Run specific test suites
npx vitest run src/lib/tests/performance.test.ts
```

### Benchmark Suite

```bash
# Run all benchmarks
npx vitest bench

# Run specific benchmark file
npx vitest bench src/lib/benchmarks/communication.bench.ts

# Generate benchmark report
npx vitest bench --reporter=json --outputFile=benchmark-results.json
```

## Test Categories

### 1. Terminal I/O Performance

Tests the latency and throughput of terminal input/output operations:

- **Input Latency**: Measures time from keystroke to terminal processing
- **Output Throughput**: Tests rendering speed of terminal output
- **Resize Performance**: Validates smooth terminal resizing

### 2. File System Event Performance

Validates file watching and event propagation:

- **Change Notification**: Time from file change to event receipt
- **Concurrent Operations**: Handling multiple file operations
- **Event Throughput**: Maximum sustainable event rate

### 3. Editor State Synchronization

Ensures responsive editor experience:

- **Cursor Movement**: Sub-5ms cursor position updates
- **Buffer Sync**: Efficient content synchronization
- **Multi-cursor**: Handling multiple concurrent cursors

### 4. Memory and Resource Usage

Monitors system resource consumption:

- **Memory Growth**: Tracking allocation patterns
- **CPU Usage**: Ensuring efficient processing
- **Garbage Collection**: Proper cleanup verification

### 5. Stress Testing

Validates performance under extreme conditions:

- **High-frequency Updates**: 10,000+ ops/sec sustained
- **Recovery Testing**: Performance after load spikes
- **Concurrent Workers**: Parallel operation handling

## Performance Monitoring

### Real-time Metrics

The performance test suite provides real-time metrics during execution:

```
📊 Performance Test: Terminal Input Latency
────────────────────────────────────────────────────────────
  Iterations: 10000 | Success Rate: 99.80%
  Throughput: 2453.32 ops/sec
────────────────────────────────────────────────────────────
  Latency Statistics (ms):
    Min: 0.234 | Max: 9.876 | Avg: 2.145
    Median: 1.987 | P95: 4.532 | P99: 7.234
────────────────────────────────────────────────────────────
  Memory Used: 12.45 MB
────────────────────────────────────────────────────────────
```

### Performance Reports

After test completion, detailed reports are generated:

- `test-results/performance-results.json`: Test execution details
- `test-results/benchmark-results.json`: Benchmark comparisons
- `test-results/performance-report.json`: Summary report

## CI/CD Integration

### GitHub Actions Workflow

```yaml
performance-tests:
  runs-on: ubuntu-latest
  steps:
    - name: Run Performance Tests
      run: |
        npm run test:performance
        cargo test --test performance_benchmarks --release -- --ignored
    
    - name: Upload Performance Results
      uses: actions/upload-artifact@v3
      with:
        name: performance-results
        path: test-results/
```

### Performance Regression Detection

The CI pipeline automatically:
1. Runs performance tests on each PR
2. Compares results against baseline
3. Fails if regression > 10% detected
4. Posts performance summary as PR comment

## Best Practices

### Writing Performance Tests

1. **Isolate Operations**: Test one specific operation at a time
2. **Warm-up Runs**: Include warm-up iterations before measurement
3. **Statistical Significance**: Use sufficient iterations (1000+)
4. **Clean State**: Reset state between test runs
5. **Resource Monitoring**: Track memory and CPU usage

### Interpreting Results

1. **Focus on Percentiles**: P95/P99 more important than average
2. **Consider Variance**: High variance indicates instability
3. **Check Success Rate**: Should be > 95% for all tests
4. **Monitor Trends**: Track performance over time
5. **Validate Under Load**: Stress tests reveal real behavior

### Common Issues

1. **High Latency Spikes**
   - Check for blocking operations
   - Review async/await usage
   - Look for synchronous I/O

2. **Memory Leaks**
   - Ensure proper cleanup in tests
   - Check for retained references
   - Monitor long-running tests

3. **Throughput Bottlenecks**
   - Profile hot paths
   - Consider batching operations
   - Review concurrent limits

## Performance Optimization Tips

### Backend (Rust)

1. Use `tokio::spawn` for parallel operations
2. Implement connection pooling
3. Use channels for communication
4. Avoid blocking the runtime
5. Profile with `cargo flamegraph`

### Frontend (TypeScript)

1. Debounce high-frequency updates
2. Use virtual scrolling for large lists
3. Implement request batching
4. Use Web Workers for heavy computation
5. Profile with Chrome DevTools

## Maintenance

### Regular Tasks

1. **Weekly**: Run full performance suite
2. **Monthly**: Update baseline metrics
3. **Quarterly**: Review and adjust targets
4. **Yearly**: Comprehensive performance audit

### Adding New Tests

1. Identify performance-critical operation
2. Define success criteria (latency/throughput)
3. Write isolated test case
4. Add to appropriate test category
5. Update documentation

## Troubleshooting

### Test Failures

```bash
# Enable debug logging
RUST_LOG=debug cargo test --test performance_benchmarks

# Run with extended timeout
npm run test:performance -- --testTimeout=120000

# Generate flame graphs
cargo flamegraph --test performance_benchmarks
```

### Platform-Specific Issues

- **macOS**: Check for Instruments.app interference
- **Linux**: Ensure proper ulimits for file handles
- **Windows**: Disable Windows Defender during tests

## References

- [Vitest Benchmark Documentation](https://vitest.dev/guide/features.html#benchmarking)
- [Rust Criterion.rs Guide](https://bheisler.github.io/criterion.rs/book/)
- [Performance Testing Best Practices](https://web.dev/vitals/)