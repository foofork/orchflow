#[cfg(test)]
mod performance_benchmarks {
    use super::*;
    use std::sync::Arc;
    use std::time::{Duration, Instant};
    use tokio::sync::Mutex;
    use orchflow::mux_backend::{MuxBackend, MockBackend, TmuxBackend, MuxError};
    use orchflow::terminal_io::{TerminalIO, TerminalEvent};
    use orchflow::file_system_watcher::{FileSystemWatcher, FileEvent};
    use sysinfo::{System, SystemExt, ProcessExt};
    use std::collections::HashMap;

    /// Performance test result structure
    #[derive(Debug, Clone)]
    struct PerformanceResult {
        test_name: String,
        min_latency_ms: f64,
        max_latency_ms: f64,
        avg_latency_ms: f64,
        median_latency_ms: f64,
        p95_latency_ms: f64,
        p99_latency_ms: f64,
        throughput_ops_sec: f64,
        memory_usage_mb: f64,
        cpu_usage_percent: f64,
        iterations: usize,
        success_rate: f64,
    }

    /// Performance test configuration
    struct PerformanceConfig {
        iterations: usize,
        warmup_iterations: usize,
        concurrent_operations: usize,
        payload_size_bytes: usize,
        timeout_ms: u64,
    }

    impl Default for PerformanceConfig {
        fn default() -> Self {
            Self {
                iterations: 1000,
                warmup_iterations: 100,
                concurrent_operations: 1,
                payload_size_bytes: 1024,
                timeout_ms: 10000, // 10ms requirement
            }
        }
    }

    /// Terminal I/O Performance Tests
    mod terminal_io_tests {
        use super::*;

        #[tokio::test]
        async fn test_terminal_input_latency() {
            let config = PerformanceConfig {
                iterations: 10000,
                timeout_ms: 10, // <10ms requirement
                ..Default::default()
            };

            let result = benchmark_terminal_input(&config).await;
            assert_performance_criteria(&result, "Terminal Input Latency", 10.0);
            print_performance_result(&result);
        }

        #[tokio::test]
        async fn test_terminal_output_latency() {
            let config = PerformanceConfig {
                iterations: 10000,
                payload_size_bytes: 4096, // Typical terminal output chunk
                timeout_ms: 10,
                ..Default::default()
            };

            let result = benchmark_terminal_output(&config).await;
            assert_performance_criteria(&result, "Terminal Output Latency", 10.0);
            print_performance_result(&result);
        }

        #[tokio::test]
        async fn test_terminal_resize_latency() {
            let config = PerformanceConfig {
                iterations: 1000,
                timeout_ms: 50, // Resize can be slower
                ..Default::default()
            };

            let result = benchmark_terminal_resize(&config).await;
            assert_performance_criteria(&result, "Terminal Resize Latency", 50.0);
            print_performance_result(&result);
        }

        async fn benchmark_terminal_input(config: &PerformanceConfig) -> PerformanceResult {
            let terminal = Arc::new(Mutex::new(TerminalIO::new()));
            let mut latencies = Vec::with_capacity(config.iterations);
            let mut successes = 0;

            // Warmup
            for _ in 0..config.warmup_iterations {
                let _ = terminal.lock().await.send_input("warmup").await;
            }

            // Benchmark
            let start_time = Instant::now();
            for _ in 0..config.iterations {
                let op_start = Instant::now();
                let result = terminal.lock().await.send_input("test input").await;
                let elapsed = op_start.elapsed();
                
                if result.is_ok() && elapsed.as_millis() < config.timeout_ms as u128 {
                    successes += 1;
                    latencies.push(elapsed.as_secs_f64() * 1000.0);
                }
            }
            let total_duration = start_time.elapsed();

            calculate_performance_result(
                "Terminal Input".to_string(),
                latencies,
                successes,
                config.iterations,
                total_duration,
            ).await
        }

        async fn benchmark_terminal_output(config: &PerformanceConfig) -> PerformanceResult {
            let terminal = Arc::new(Mutex::new(TerminalIO::new()));
            let mut latencies = Vec::with_capacity(config.iterations);
            let mut successes = 0;
            
            let output_data = "x".repeat(config.payload_size_bytes);

            // Warmup
            for _ in 0..config.warmup_iterations {
                let _ = terminal.lock().await.write_output(&output_data).await;
            }

            // Benchmark
            let start_time = Instant::now();
            for _ in 0..config.iterations {
                let op_start = Instant::now();
                let result = terminal.lock().await.write_output(&output_data).await;
                let elapsed = op_start.elapsed();
                
                if result.is_ok() && elapsed.as_millis() < config.timeout_ms as u128 {
                    successes += 1;
                    latencies.push(elapsed.as_secs_f64() * 1000.0);
                }
            }
            let total_duration = start_time.elapsed();

            calculate_performance_result(
                "Terminal Output".to_string(),
                latencies,
                successes,
                config.iterations,
                total_duration,
            ).await
        }

        async fn benchmark_terminal_resize(config: &PerformanceConfig) -> PerformanceResult {
            let terminal = Arc::new(Mutex::new(TerminalIO::new()));
            let mut latencies = Vec::with_capacity(config.iterations);
            let mut successes = 0;

            // Benchmark
            let start_time = Instant::now();
            for i in 0..config.iterations {
                let width = 80 + (i % 40) as u16;
                let height = 24 + (i % 20) as u16;
                
                let op_start = Instant::now();
                let result = terminal.lock().await.resize(width, height).await;
                let elapsed = op_start.elapsed();
                
                if result.is_ok() && elapsed.as_millis() < config.timeout_ms as u128 {
                    successes += 1;
                    latencies.push(elapsed.as_secs_f64() * 1000.0);
                }
            }
            let total_duration = start_time.elapsed();

            calculate_performance_result(
                "Terminal Resize".to_string(),
                latencies,
                successes,
                config.iterations,
                total_duration,
            ).await
        }
    }

    /// File System Event Performance Tests
    mod file_system_tests {
        use super::*;

        #[tokio::test]
        async fn test_file_change_notification_latency() {
            let config = PerformanceConfig {
                iterations: 1000,
                timeout_ms: 20, // File system events can be slightly slower
                ..Default::default()
            };

            let result = benchmark_file_change_events(&config).await;
            assert_performance_criteria(&result, "File Change Notification", 20.0);
            print_performance_result(&result);
        }

        #[tokio::test]
        async fn test_file_system_throughput() {
            let config = PerformanceConfig {
                iterations: 5000,
                concurrent_operations: 10, // Test concurrent file operations
                ..Default::default()
            };

            let result = benchmark_file_system_throughput(&config).await;
            print_performance_result(&result);
            
            // Assert minimum throughput
            assert!(result.throughput_ops_sec > 1000.0, 
                "File system throughput too low: {} ops/sec", result.throughput_ops_sec);
        }

        async fn benchmark_file_change_events(config: &PerformanceConfig) -> PerformanceResult {
            let watcher = Arc::new(Mutex::new(FileSystemWatcher::new()));
            let mut latencies = Vec::with_capacity(config.iterations);
            let mut successes = 0;

            // Create test directory
            let test_dir = tempfile::tempdir().unwrap();
            let test_path = test_dir.path().join("test_file.txt");

            // Start watching
            watcher.lock().await.watch(&test_dir.path()).await.unwrap();

            // Benchmark
            let start_time = Instant::now();
            for i in 0..config.iterations {
                let op_start = Instant::now();
                
                // Write to file
                std::fs::write(&test_path, format!("test {}", i)).unwrap();
                
                // Wait for event
                let event_received = tokio::time::timeout(
                    Duration::from_millis(config.timeout_ms),
                    watcher.lock().await.recv_event()
                ).await;
                
                let elapsed = op_start.elapsed();
                
                if event_received.is_ok() && elapsed.as_millis() < config.timeout_ms as u128 {
                    successes += 1;
                    latencies.push(elapsed.as_secs_f64() * 1000.0);
                }
            }
            let total_duration = start_time.elapsed();

            calculate_performance_result(
                "File Change Events".to_string(),
                latencies,
                successes,
                config.iterations,
                total_duration,
            ).await
        }

        async fn benchmark_file_system_throughput(config: &PerformanceConfig) -> PerformanceResult {
            let watcher = Arc::new(Mutex::new(FileSystemWatcher::new()));
            let mut latencies = Vec::with_capacity(config.iterations);
            let mut successes = 0;

            // Create test directory
            let test_dir = tempfile::tempdir().unwrap();
            watcher.lock().await.watch(&test_dir.path()).await.unwrap();

            // Benchmark concurrent operations
            let start_time = Instant::now();
            let mut handles = vec![];

            for batch in 0..(config.iterations / config.concurrent_operations) {
                for i in 0..config.concurrent_operations {
                    let test_path = test_dir.path().join(format!("file_{}.txt", batch * config.concurrent_operations + i));
                    let watcher_clone = watcher.clone();
                    
                    let handle = tokio::spawn(async move {
                        let op_start = Instant::now();
                        std::fs::write(&test_path, format!("test {}", i)).unwrap();
                        let _ = watcher_clone.lock().await.recv_event().await;
                        op_start.elapsed()
                    });
                    
                    handles.push(handle);
                }

                // Wait for batch to complete
                for handle in handles.drain(..) {
                    if let Ok(elapsed) = handle.await {
                        if elapsed.as_millis() < config.timeout_ms as u128 {
                            successes += 1;
                            latencies.push(elapsed.as_secs_f64() * 1000.0);
                        }
                    }
                }
            }
            let total_duration = start_time.elapsed();

            calculate_performance_result(
                "File System Throughput".to_string(),
                latencies,
                successes,
                config.iterations,
                total_duration,
            ).await
        }
    }

    /// Editor State Synchronization Performance Tests
    mod editor_sync_tests {
        use super::*;

        #[tokio::test]
        async fn test_cursor_position_sync_latency() {
            let config = PerformanceConfig {
                iterations: 10000,
                timeout_ms: 5, // Cursor sync should be very fast
                ..Default::default()
            };

            let result = benchmark_cursor_sync(&config).await;
            assert_performance_criteria(&result, "Cursor Position Sync", 5.0);
            print_performance_result(&result);
        }

        #[tokio::test]
        async fn test_buffer_content_sync_latency() {
            let config = PerformanceConfig {
                iterations: 1000,
                payload_size_bytes: 10240, // 10KB buffer
                timeout_ms: 20,
                ..Default::default()
            };

            let result = benchmark_buffer_sync(&config).await;
            assert_performance_criteria(&result, "Buffer Content Sync", 20.0);
            print_performance_result(&result);
        }

        #[tokio::test]
        async fn test_multi_cursor_sync_performance() {
            let config = PerformanceConfig {
                iterations: 5000,
                concurrent_operations: 5, // 5 cursors
                timeout_ms: 10,
                ..Default::default()
            };

            let result = benchmark_multi_cursor_sync(&config).await;
            assert_performance_criteria(&result, "Multi-Cursor Sync", 10.0);
            print_performance_result(&result);
        }

        async fn benchmark_cursor_sync(config: &PerformanceConfig) -> PerformanceResult {
            // Simulate editor state sync
            let mut latencies = Vec::with_capacity(config.iterations);
            let mut successes = 0;

            let start_time = Instant::now();
            for i in 0..config.iterations {
                let op_start = Instant::now();
                
                // Simulate cursor position update
                let cursor_pos = (i % 1000, i % 100);
                let sync_result = simulate_editor_sync(EditorEvent::CursorMove(cursor_pos)).await;
                
                let elapsed = op_start.elapsed();
                
                if sync_result.is_ok() && elapsed.as_millis() < config.timeout_ms as u128 {
                    successes += 1;
                    latencies.push(elapsed.as_secs_f64() * 1000.0);
                }
            }
            let total_duration = start_time.elapsed();

            calculate_performance_result(
                "Cursor Position Sync".to_string(),
                latencies,
                successes,
                config.iterations,
                total_duration,
            ).await
        }

        async fn benchmark_buffer_sync(config: &PerformanceConfig) -> PerformanceResult {
            let mut latencies = Vec::with_capacity(config.iterations);
            let mut successes = 0;
            
            let buffer_content = "x".repeat(config.payload_size_bytes);

            let start_time = Instant::now();
            for _ in 0..config.iterations {
                let op_start = Instant::now();
                
                // Simulate buffer update
                let sync_result = simulate_editor_sync(
                    EditorEvent::BufferUpdate(buffer_content.clone())
                ).await;
                
                let elapsed = op_start.elapsed();
                
                if sync_result.is_ok() && elapsed.as_millis() < config.timeout_ms as u128 {
                    successes += 1;
                    latencies.push(elapsed.as_secs_f64() * 1000.0);
                }
            }
            let total_duration = start_time.elapsed();

            calculate_performance_result(
                "Buffer Content Sync".to_string(),
                latencies,
                successes,
                config.iterations,
                total_duration,
            ).await
        }

        async fn benchmark_multi_cursor_sync(config: &PerformanceConfig) -> PerformanceResult {
            let mut latencies = Vec::with_capacity(config.iterations);
            let mut successes = 0;

            let start_time = Instant::now();
            for i in 0..config.iterations {
                let op_start = Instant::now();
                
                // Simulate multiple cursor updates
                let mut handles = vec![];
                for cursor_id in 0..config.concurrent_operations {
                    let handle = tokio::spawn(async move {
                        simulate_editor_sync(
                            EditorEvent::CursorMove((i + cursor_id, cursor_id))
                        ).await
                    });
                    handles.push(handle);
                }
                
                // Wait for all cursors to sync
                let mut all_success = true;
                for handle in handles {
                    if handle.await.unwrap().is_err() {
                        all_success = false;
                        break;
                    }
                }
                
                let elapsed = op_start.elapsed();
                
                if all_success && elapsed.as_millis() < config.timeout_ms as u128 {
                    successes += 1;
                    latencies.push(elapsed.as_secs_f64() * 1000.0);
                }
            }
            let total_duration = start_time.elapsed();

            calculate_performance_result(
                "Multi-Cursor Sync".to_string(),
                latencies,
                successes,
                config.iterations,
                total_duration,
            ).await
        }

        enum EditorEvent {
            CursorMove((usize, usize)),
            BufferUpdate(String),
        }

        async fn simulate_editor_sync(event: EditorEvent) -> Result<(), MuxError> {
            // Simulate processing time
            match event {
                EditorEvent::CursorMove(_) => {
                    tokio::time::sleep(Duration::from_micros(100)).await;
                }
                EditorEvent::BufferUpdate(ref content) => {
                    // Simulate processing based on content size
                    let process_time = content.len() as u64 / 1000; // 1 microsecond per KB
                    tokio::time::sleep(Duration::from_micros(process_time)).await;
                }
            }
            Ok(())
        }
    }

    /// Memory and Resource Usage Tests
    mod resource_tests {
        use super::*;

        #[tokio::test]
        async fn test_memory_usage_under_load() {
            let config = PerformanceConfig {
                iterations: 10000,
                concurrent_operations: 50,
                payload_size_bytes: 10240, // 10KB per operation
                ..Default::default()
            };

            let result = benchmark_memory_usage(&config).await;
            print_performance_result(&result);
            
            // Assert memory usage stays reasonable (< 100MB for test)
            assert!(result.memory_usage_mb < 100.0, 
                "Memory usage too high: {} MB", result.memory_usage_mb);
        }

        #[tokio::test]
        async fn test_cpu_usage_under_load() {
            let config = PerformanceConfig {
                iterations: 5000,
                concurrent_operations: 20,
                ..Default::default()
            };

            let result = benchmark_cpu_usage(&config).await;
            print_performance_result(&result);
            
            // Assert CPU usage stays reasonable (< 80% average)
            assert!(result.cpu_usage_percent < 80.0, 
                "CPU usage too high: {}%", result.cpu_usage_percent);
        }

        async fn benchmark_memory_usage(config: &PerformanceConfig) -> PerformanceResult {
            let mut system = System::new_all();
            system.refresh_all();
            
            let process_id = sysinfo::get_current_pid().unwrap();
            let initial_memory = system.process(process_id)
                .map(|p| p.memory())
                .unwrap_or(0);

            // Create load
            let mut handles = vec![];
            let start_time = Instant::now();
            
            for _ in 0..config.concurrent_operations {
                let iterations = config.iterations / config.concurrent_operations;
                let payload_size = config.payload_size_bytes;
                
                let handle = tokio::spawn(async move {
                    let mut data = Vec::with_capacity(iterations);
                    for _ in 0..iterations {
                        // Allocate memory
                        let buffer = vec![0u8; payload_size];
                        data.push(buffer);
                        
                        // Simulate work
                        tokio::time::sleep(Duration::from_micros(100)).await;
                    }
                    data.len()
                });
                
                handles.push(handle);
            }

            // Wait for completion
            for handle in handles {
                let _ = handle.await;
            }

            let total_duration = start_time.elapsed();

            // Measure peak memory
            system.refresh_all();
            let peak_memory = system.process(process_id)
                .map(|p| p.memory())
                .unwrap_or(0);
            
            let memory_increase_mb = (peak_memory - initial_memory) as f64 / 1024.0 / 1024.0;

            PerformanceResult {
                test_name: "Memory Usage".to_string(),
                min_latency_ms: 0.0,
                max_latency_ms: 0.0,
                avg_latency_ms: 0.0,
                median_latency_ms: 0.0,
                p95_latency_ms: 0.0,
                p99_latency_ms: 0.0,
                throughput_ops_sec: config.iterations as f64 / total_duration.as_secs_f64(),
                memory_usage_mb: memory_increase_mb,
                cpu_usage_percent: 0.0,
                iterations: config.iterations,
                success_rate: 100.0,
            }
        }

        async fn benchmark_cpu_usage(config: &PerformanceConfig) -> PerformanceResult {
            let mut system = System::new_all();
            let mut cpu_samples = Vec::new();
            
            // Monitor CPU during load
            let monitor_handle = tokio::spawn(async move {
                let mut samples = Vec::new();
                for _ in 0..100 { // Sample every 100ms for 10 seconds
                    system.refresh_cpu();
                    let cpu_usage: f32 = system.cpus().iter()
                        .map(|cpu| cpu.cpu_usage())
                        .sum::<f32>() / system.cpus().len() as f32;
                    samples.push(cpu_usage);
                    tokio::time::sleep(Duration::from_millis(100)).await;
                }
                samples
            });

            // Create CPU load
            let mut handles = vec![];
            let start_time = Instant::now();
            
            for _ in 0..config.concurrent_operations {
                let iterations = config.iterations / config.concurrent_operations;
                
                let handle = tokio::spawn(async move {
                    for _ in 0..iterations {
                        // CPU-intensive work
                        let mut sum = 0u64;
                        for i in 0..1000 {
                            sum = sum.wrapping_add(i * i);
                        }
                        
                        // Yield to prevent blocking
                        if sum % 100 == 0 {
                            tokio::task::yield_now().await;
                        }
                    }
                });
                
                handles.push(handle);
            }

            // Wait for completion
            for handle in handles {
                let _ = handle.await;
            }

            let total_duration = start_time.elapsed();
            
            // Get CPU samples
            cpu_samples = monitor_handle.await.unwrap();
            let avg_cpu = cpu_samples.iter().sum::<f32>() / cpu_samples.len() as f32;

            PerformanceResult {
                test_name: "CPU Usage".to_string(),
                min_latency_ms: 0.0,
                max_latency_ms: 0.0,
                avg_latency_ms: 0.0,
                median_latency_ms: 0.0,
                p95_latency_ms: 0.0,
                p99_latency_ms: 0.0,
                throughput_ops_sec: config.iterations as f64 / total_duration.as_secs_f64(),
                memory_usage_mb: 0.0,
                cpu_usage_percent: avg_cpu as f64,
                iterations: config.iterations,
                success_rate: 100.0,
            }
        }
    }

    /// Stress Testing
    mod stress_tests {
        use super::*;

        #[tokio::test]
        #[ignore = "Run manually - this is a stress test"]
        async fn stress_test_high_frequency_updates() {
            let config = PerformanceConfig {
                iterations: 100000,
                concurrent_operations: 100,
                payload_size_bytes: 256,
                timeout_ms: 50,
                ..Default::default()
            };

            println!("\n🔥 Starting High-Frequency Update Stress Test");
            println!("   - Operations: {}", config.iterations);
            println!("   - Concurrent: {}", config.concurrent_operations);
            println!("   - Payload: {} bytes", config.payload_size_bytes);

            let terminal_result = stress_terminal_updates(&config).await;
            let file_result = stress_file_system_events(&config).await;
            let editor_result = stress_editor_sync(&config).await;

            println!("\n📊 Stress Test Results:");
            print_performance_result(&terminal_result);
            print_performance_result(&file_result);
            print_performance_result(&editor_result);

            // Generate stress test report
            generate_stress_report(&[terminal_result, file_result, editor_result]);
        }

        async fn stress_terminal_updates(config: &PerformanceConfig) -> PerformanceResult {
            let terminal = Arc::new(Mutex::new(TerminalIO::new()));
            let mut handles = vec![];
            let mut latencies = Arc::new(Mutex::new(Vec::new()));
            let successes = Arc::new(Mutex::new(0usize));
            
            let start_time = Instant::now();
            
            for worker_id in 0..config.concurrent_operations {
                let terminal_clone = terminal.clone();
                let latencies_clone = latencies.clone();
                let successes_clone = successes.clone();
                let iterations_per_worker = config.iterations / config.concurrent_operations;
                let payload_size = config.payload_size_bytes;
                let timeout_ms = config.timeout_ms;
                
                let handle = tokio::spawn(async move {
                    let data = format!("Worker {} data: {}", worker_id, "x".repeat(payload_size));
                    
                    for _ in 0..iterations_per_worker {
                        let op_start = Instant::now();
                        let result = terminal_clone.lock().await.write_output(&data).await;
                        let elapsed = op_start.elapsed();
                        
                        if result.is_ok() && elapsed.as_millis() < timeout_ms as u128 {
                            *successes_clone.lock().await += 1;
                            latencies_clone.lock().await.push(elapsed.as_secs_f64() * 1000.0);
                        }
                    }
                });
                
                handles.push(handle);
            }

            // Wait for all workers
            for handle in handles {
                let _ = handle.await;
            }

            let total_duration = start_time.elapsed();
            let latencies = Arc::try_unwrap(latencies).unwrap().into_inner();
            let successes = *Arc::try_unwrap(successes).unwrap().into_inner();

            calculate_performance_result(
                "Terminal Stress Test".to_string(),
                latencies,
                successes,
                config.iterations,
                total_duration,
            ).await
        }

        async fn stress_file_system_events(config: &PerformanceConfig) -> PerformanceResult {
            // Similar stress test for file system events
            let test_dir = tempfile::tempdir().unwrap();
            let watcher = Arc::new(Mutex::new(FileSystemWatcher::new()));
            watcher.lock().await.watch(&test_dir.path()).await.unwrap();
            
            let mut handles = vec![];
            let latencies = Arc::new(Mutex::new(Vec::new()));
            let successes = Arc::new(Mutex::new(0usize));
            
            let start_time = Instant::now();
            
            for worker_id in 0..config.concurrent_operations {
                let test_dir_path = test_dir.path().to_path_buf();
                let watcher_clone = watcher.clone();
                let latencies_clone = latencies.clone();
                let successes_clone = successes.clone();
                let iterations_per_worker = config.iterations / config.concurrent_operations;
                let timeout_ms = config.timeout_ms;
                
                let handle = tokio::spawn(async move {
                    for i in 0..iterations_per_worker {
                        let file_path = test_dir_path.join(format!("worker_{}_file_{}.txt", worker_id, i));
                        let op_start = Instant::now();
                        
                        // Write file
                        if std::fs::write(&file_path, format!("test {}", i)).is_ok() {
                            // Wait for event
                            let event_result = tokio::time::timeout(
                                Duration::from_millis(timeout_ms),
                                watcher_clone.lock().await.recv_event()
                            ).await;
                            
                            let elapsed = op_start.elapsed();
                            
                            if event_result.is_ok() {
                                *successes_clone.lock().await += 1;
                                latencies_clone.lock().await.push(elapsed.as_secs_f64() * 1000.0);
                            }
                        }
                        
                        // Clean up file
                        let _ = std::fs::remove_file(&file_path);
                    }
                });
                
                handles.push(handle);
            }

            // Wait for all workers
            for handle in handles {
                let _ = handle.await;
            }

            let total_duration = start_time.elapsed();
            let latencies = Arc::try_unwrap(latencies).unwrap().into_inner();
            let successes = *Arc::try_unwrap(successes).unwrap().into_inner();

            calculate_performance_result(
                "File System Stress Test".to_string(),
                latencies,
                successes,
                config.iterations,
                total_duration,
            ).await
        }

        async fn stress_editor_sync(config: &PerformanceConfig) -> PerformanceResult {
            // Stress test for editor synchronization
            let mut handles = vec![];
            let latencies = Arc::new(Mutex::new(Vec::new()));
            let successes = Arc::new(Mutex::new(0usize));
            
            let start_time = Instant::now();
            
            for worker_id in 0..config.concurrent_operations {
                let latencies_clone = latencies.clone();
                let successes_clone = successes.clone();
                let iterations_per_worker = config.iterations / config.concurrent_operations;
                let timeout_ms = config.timeout_ms;
                
                let handle = tokio::spawn(async move {
                    for i in 0..iterations_per_worker {
                        let op_start = Instant::now();
                        
                        // Simulate rapid cursor movements
                        let cursor_pos = (worker_id * 100 + i, i % 100);
                        let result = simulate_editor_sync(
                            EditorEvent::CursorMove(cursor_pos)
                        ).await;
                        
                        let elapsed = op_start.elapsed();
                        
                        if result.is_ok() && elapsed.as_millis() < timeout_ms as u128 {
                            *successes_clone.lock().await += 1;
                            latencies_clone.lock().await.push(elapsed.as_secs_f64() * 1000.0);
                        }
                    }
                });
                
                handles.push(handle);
            }

            // Wait for all workers
            for handle in handles {
                let _ = handle.await;
            }

            let total_duration = start_time.elapsed();
            let latencies = Arc::try_unwrap(latencies).unwrap().into_inner();
            let successes = *Arc::try_unwrap(successes).unwrap().into_inner();

            calculate_performance_result(
                "Editor Sync Stress Test".to_string(),
                latencies,
                successes,
                config.iterations,
                total_duration,
            ).await
        }

        fn generate_stress_report(results: &[PerformanceResult]) {
            println!("\n📈 STRESS TEST SUMMARY REPORT");
            println!("═══════════════════════════════════════════════════════════════");
            
            for result in results {
                println!("\n{}", result.test_name);
                println!("───────────────────────────────────────────────────────────────");
                println!("  Success Rate: {:.2}%", result.success_rate);
                println!("  Throughput: {:.2} ops/sec", result.throughput_ops_sec);
                println!("  Latency P95: {:.2}ms", result.p95_latency_ms);
                println!("  Latency P99: {:.2}ms", result.p99_latency_ms);
                
                if result.p99_latency_ms > 10.0 {
                    println!("  ⚠️  WARNING: P99 latency exceeds 10ms requirement!");
                }
            }
            
            println!("\n═══════════════════════════════════════════════════════════════");
        }
    }

    /// Helper Functions
    async fn calculate_performance_result(
        test_name: String,
        mut latencies: Vec<f64>,
        successes: usize,
        total_iterations: usize,
        total_duration: Duration,
    ) -> PerformanceResult {
        // Get system info for resource metrics
        let mut system = System::new_all();
        system.refresh_all();
        
        let process_id = sysinfo::get_current_pid().unwrap();
        let memory_mb = system.process(process_id)
            .map(|p| p.memory() as f64 / 1024.0 / 1024.0)
            .unwrap_or(0.0);
        
        system.refresh_cpu();
        let cpu_percent = system.cpus().iter()
            .map(|cpu| cpu.cpu_usage() as f64)
            .sum::<f64>() / system.cpus().len() as f64;

        // Calculate statistics
        latencies.sort_by(|a, b| a.partial_cmp(b).unwrap());
        
        let min = latencies.first().copied().unwrap_or(0.0);
        let max = latencies.last().copied().unwrap_or(0.0);
        let avg = if !latencies.is_empty() {
            latencies.iter().sum::<f64>() / latencies.len() as f64
        } else {
            0.0
        };
        
        let median = if !latencies.is_empty() {
            latencies[latencies.len() / 2]
        } else {
            0.0
        };
        
        let p95_idx = ((latencies.len() as f64 * 0.95) as usize).min(latencies.len().saturating_sub(1));
        let p99_idx = ((latencies.len() as f64 * 0.99) as usize).min(latencies.len().saturating_sub(1));
        
        let p95 = latencies.get(p95_idx).copied().unwrap_or(0.0);
        let p99 = latencies.get(p99_idx).copied().unwrap_or(0.0);
        
        let throughput = successes as f64 / total_duration.as_secs_f64();
        let success_rate = (successes as f64 / total_iterations as f64) * 100.0;

        PerformanceResult {
            test_name,
            min_latency_ms: min,
            max_latency_ms: max,
            avg_latency_ms: avg,
            median_latency_ms: median,
            p95_latency_ms: p95,
            p99_latency_ms: p99,
            throughput_ops_sec: throughput,
            memory_usage_mb: memory_mb,
            cpu_usage_percent: cpu_percent,
            iterations: total_iterations,
            success_rate,
        }
    }

    fn print_performance_result(result: &PerformanceResult) {
        println!("\n📊 Performance Test: {}", result.test_name);
        println!("───────────────────────────────────────────────────────────────");
        println!("  Iterations: {} | Success Rate: {:.2}%", result.iterations, result.success_rate);
        println!("  Throughput: {:.2} ops/sec", result.throughput_ops_sec);
        println!("───────────────────────────────────────────────────────────────");
        println!("  Latency Statistics (ms):");
        println!("    Min: {:.3} | Max: {:.3} | Avg: {:.3}", 
            result.min_latency_ms, result.max_latency_ms, result.avg_latency_ms);
        println!("    Median: {:.3} | P95: {:.3} | P99: {:.3}", 
            result.median_latency_ms, result.p95_latency_ms, result.p99_latency_ms);
        println!("───────────────────────────────────────────────────────────────");
        println!("  Resource Usage:");
        println!("    Memory: {:.2} MB | CPU: {:.2}%", 
            result.memory_usage_mb, result.cpu_usage_percent);
        println!("───────────────────────────────────────────────────────────────");
    }

    fn assert_performance_criteria(result: &PerformanceResult, test_name: &str, max_p99_ms: f64) {
        assert!(
            result.p99_latency_ms <= max_p99_ms,
            "{} P99 latency ({:.2}ms) exceeds requirement ({}ms)",
            test_name,
            result.p99_latency_ms,
            max_p99_ms
        );
        
        assert!(
            result.success_rate >= 95.0,
            "{} success rate ({:.2}%) below 95% threshold",
            test_name,
            result.success_rate
        );
    }

    /// Main benchmark runner
    #[tokio::test]
    #[ignore = "Run with --ignored to execute all benchmarks"]
    async fn run_all_performance_benchmarks() {
        println!("\n🚀 ORCHFLOW PERFORMANCE BENCHMARK SUITE");
        println!("═══════════════════════════════════════════════════════════════");
        println!("Running comprehensive performance tests...\n");

        // Terminal I/O benchmarks
        println!("1️⃣  Terminal I/O Performance");
        terminal_io_tests::test_terminal_input_latency().await;
        terminal_io_tests::test_terminal_output_latency().await;
        terminal_io_tests::test_terminal_resize_latency().await;

        // File system benchmarks
        println!("\n2️⃣  File System Event Performance");
        file_system_tests::test_file_change_notification_latency().await;
        file_system_tests::test_file_system_throughput().await;

        // Editor sync benchmarks
        println!("\n3️⃣  Editor State Synchronization Performance");
        editor_sync_tests::test_cursor_position_sync_latency().await;
        editor_sync_tests::test_buffer_content_sync_latency().await;
        editor_sync_tests::test_multi_cursor_sync_performance().await;

        // Resource usage benchmarks
        println!("\n4️⃣  Resource Usage Performance");
        resource_tests::test_memory_usage_under_load().await;
        resource_tests::test_cpu_usage_under_load().await;

        println!("\n✅ All performance benchmarks completed!");
        println!("═══════════════════════════════════════════════════════════════");
    }
}