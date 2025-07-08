#[cfg(test)]
mod benchmarks {
    use super::super::*;
    use crate::mux_backend::tmux_backend::TmuxBackend;
    use std::time::{Duration, Instant};
    
    /// Benchmark result for a single operation
    #[derive(Debug, Clone)]
    struct BenchmarkResult {
        operation: String,
        min_ms: f64,
        max_ms: f64,
        avg_ms: f64,
        median_ms: f64,
        p95_ms: f64,
        p99_ms: f64,
        iterations: usize,
    }
    
    /// Run a benchmark and collect statistics
    async fn benchmark_operation<F, Fut>(
        name: &str,
        iterations: usize,
        mut op: F,
    ) -> BenchmarkResult
    where
        F: FnMut() -> Fut,
        Fut: std::future::Future<Output = Result<(), MuxError>>,
    {
        let mut timings = Vec::with_capacity(iterations);
        
        for _ in 0..iterations {
            let start = Instant::now();
            let _ = op().await;
            let elapsed = start.elapsed();
            timings.push(elapsed.as_secs_f64() * 1000.0); // Convert to ms
        }
        
        timings.sort_by(|a, b| a.partial_cmp(b).unwrap());
        
        let min = timings[0];
        let max = timings[timings.len() - 1];
        let avg = timings.iter().sum::<f64>() / iterations as f64;
        let median = timings[iterations / 2];
        let p95_idx = (iterations as f64 * 0.95) as usize;
        let p99_idx = (iterations as f64 * 0.99) as usize;
        
        BenchmarkResult {
            operation: name.to_string(),
            min_ms: min,
            max_ms: max,
            avg_ms: avg,
            median_ms: median,
            p95_ms: timings[p95_idx.min(timings.len() - 1)],
            p99_ms: timings[p99_idx.min(timings.len() - 1)],
            iterations,
        }
    }
    
    /// Print benchmark results in a nice table format
    fn print_results(results: &[BenchmarkResult]) {
        println!("\n{:-<80}", "");
        println!("MuxBackend Performance Benchmarks");
        println!("{:-<80}", "");
        println!(
            "{:<30} {:>8} {:>8} {:>8} {:>8} {:>8} {:>8}",
            "Operation", "Min(ms)", "Avg(ms)", "Med(ms)", "P95(ms)", "P99(ms)", "Max(ms)"
        );
        println!("{:-<80}", "");
        
        for result in results {
            println!(
                "{:<30} {:>8.2} {:>8.2} {:>8.2} {:>8.2} {:>8.2} {:>8.2}",
                result.operation,
                result.min_ms,
                result.avg_ms,
                result.median_ms,
                result.p95_ms,
                result.p99_ms,
                result.max_ms
            );
        }
        println!("{:-<80}", "");
    }
    
    #[tokio::test]
    #[ignore = "Run manually with --ignored flag"]
    async fn benchmark_mock_backend() {
        println!("\nBenchmarking MockBackend...");
        let backend = MockBackend::new();
        let mut results = Vec::new();
        
        // Warmup
        for _ in 0..10 {
            let _ = backend.create_session("warmup").await;
            backend.clear().await;
        }
        
        // Benchmark session creation
        let result = benchmark_operation("create_session", 100, || {
            let backend = backend.clone();
            async move {
                let id = backend.create_session("bench").await?;
                backend.kill_session(&id).await?;
                Ok(())
            }
        }).await;
        results.push(result);
        
        // Setup for pane operations
        let session_id = backend.create_session("benchmark").await.unwrap();
        
        // Benchmark pane creation
        let result = benchmark_operation("create_pane", 100, || {
            let backend = backend.clone();
            let session_id = session_id.clone();
            async move {
                let pane_id = backend.create_pane(&session_id, SplitType::None).await?;
                backend.kill_pane(&pane_id).await?;
                Ok(())
            }
        }).await;
        results.push(result);
        
        // Create pane for other operations
        let pane_id = backend.create_pane(&session_id, SplitType::None).await.unwrap();
        
        // Benchmark send_keys
        let result = benchmark_operation("send_keys", 1000, || {
            let backend = backend.clone();
            let pane_id = pane_id.clone();
            async move {
                backend.send_keys(&pane_id, "echo test").await
            }
        }).await;
        results.push(result);
        
        // Benchmark capture_pane
        let result = benchmark_operation("capture_pane", 1000, || {
            let backend = backend.clone();
            let pane_id = pane_id.clone();
            async move {
                let _ = backend.capture_pane(&pane_id).await?;
                Ok(())
            }
        }).await;
        results.push(result);
        
        // Benchmark list operations
        let result = benchmark_operation("list_sessions", 1000, || {
            let backend = backend.clone();
            async move {
                let _ = backend.list_sessions().await?;
                Ok(())
            }
        }).await;
        results.push(result);
        
        let result = benchmark_operation("list_panes", 1000, || {
            let backend = backend.clone();
            let session_id = session_id.clone();
            async move {
                let _ = backend.list_panes(&session_id).await?;
                Ok(())
            }
        }).await;
        results.push(result);
        
        print_results(&results);
        
        // Cleanup
        backend.clear().await;
    }
    
    #[tokio::test]
    #[ignore = "Run manually with --ignored flag, requires tmux"]
    async fn benchmark_tmux_backend() {
        // Check if tmux is available
        if std::process::Command::new("tmux")
            .arg("-V")
            .output()
            .map(|o| !o.status.success())
            .unwrap_or(true)
        {
            println!("Skipping tmux benchmarks: tmux not available");
            return;
        }
        
        println!("\nBenchmarking TmuxBackend...");
        let backend = TmuxBackend::new();
        let mut results = Vec::new();
        
        // Cleanup any existing test sessions
        let sessions = backend.list_sessions().await.unwrap_or_default();
        for session in sessions {
            if session.name.starts_with("bench-") {
                let _ = backend.kill_session(&session.id).await;
            }
        }
        
        // Benchmark session creation
        let result = benchmark_operation("create_session", 20, || {
            let backend = backend.clone();
            async move {
                let id = backend.create_session(&format!("bench-{}", uuid::Uuid::new_v4())).await?;
                backend.kill_session(&id).await?;
                Ok(())
            }
        }).await;
        results.push(result);
        
        // Setup for pane operations
        let session_id = backend.create_session(&format!("bench-main-{}", uuid::Uuid::new_v4())).await.unwrap();
        
        // Benchmark pane creation
        let result = benchmark_operation("create_pane", 20, || {
            let backend = backend.clone();
            let session_id = session_id.clone();
            async move {
                let pane_id = backend.create_pane(&session_id, SplitType::None).await?;
                backend.kill_pane(&pane_id).await?;
                Ok(())
            }
        }).await;
        results.push(result);
        
        // Create pane for other operations
        let pane_id = backend.create_pane(&session_id, SplitType::None).await.unwrap();
        
        // Benchmark send_keys
        let result = benchmark_operation("send_keys", 100, || {
            let backend = backend.clone();
            let pane_id = pane_id.clone();
            async move {
                backend.send_keys(&pane_id, "echo test").await
            }
        }).await;
        results.push(result);
        
        // Let commands execute
        tokio::time::sleep(Duration::from_millis(100)).await;
        
        // Benchmark capture_pane
        let result = benchmark_operation("capture_pane", 50, || {
            let backend = backend.clone();
            let pane_id = pane_id.clone();
            async move {
                let _ = backend.capture_pane(&pane_id).await?;
                Ok(())
            }
        }).await;
        results.push(result);
        
        // Benchmark list operations
        let result = benchmark_operation("list_sessions", 50, || {
            let backend = backend.clone();
            async move {
                let _ = backend.list_sessions().await?;
                Ok(())
            }
        }).await;
        results.push(result);
        
        let result = benchmark_operation("list_panes", 50, || {
            let backend = backend.clone();
            let session_id = session_id.clone();
            async move {
                let _ = backend.list_panes(&session_id).await?;
                Ok(())
            }
        }).await;
        results.push(result);
        
        print_results(&results);
        
        // Cleanup
        let _ = backend.kill_session(&session_id).await;
    }
    
    #[tokio::test]
    #[ignore = "Run manually with --ignored flag"]
    async fn benchmark_comparison() {
        println!("\n{:=<80}", "");
        println!("MuxBackend Performance Comparison");
        println!("{:=<80}", "");
        
        // Run both benchmarks and compare
        let mock_results = benchmark_mock_operations().await;
        let tmux_results = if tmux_available() {
            Some(benchmark_tmux_operations().await)
        } else {
            println!("Tmux not available, skipping comparison");
            None
        };
        
        if let Some(tmux_results) = tmux_results {
            println!("\n{:-<80}", "");
            println!("{:<30} {:>15} {:>15} {:>15}", "Operation", "Mock (ms)", "Tmux (ms)", "Tmux/Mock");
            println!("{:-<80}", "");
            
            for (mock, tmux) in mock_results.iter().zip(tmux_results.iter()) {
                let ratio = tmux.avg_ms / mock.avg_ms;
                println!(
                    "{:<30} {:>15.2} {:>15.2} {:>15.1}x",
                    mock.operation,
                    mock.avg_ms,
                    tmux.avg_ms,
                    ratio
                );
            }
            println!("{:-<80}", "");
        }
    }
    
    async fn benchmark_mock_operations() -> Vec<BenchmarkResult> {
        let backend = MockBackend::new();
        let mut results = Vec::new();
        
        // Standard set of operations for comparison
        let session_id = backend.create_session("bench").await.unwrap();
        let pane_id = backend.create_pane(&session_id, SplitType::None).await.unwrap();
        
        // Time each operation type
        let operations = vec![
            ("session_create", 50),
            ("pane_create", 50),
            ("send_keys", 200),
            ("capture_pane", 200),
            ("list_sessions", 200),
        ];
        
        for (op_name, iterations) in operations {
            let result = match op_name {
                "session_create" => {
                    benchmark_operation(op_name, iterations, || {
                        let backend = backend.clone();
                        async move {
                            let id = backend.create_session("temp").await?;
                            backend.kill_session(&id).await?;
                            Ok(())
                        }
                    }).await
                }
                "pane_create" => {
                    benchmark_operation(op_name, iterations, || {
                        let backend = backend.clone();
                        let session_id = session_id.clone();
                        async move {
                            let id = backend.create_pane(&session_id, SplitType::None).await?;
                            backend.kill_pane(&id).await?;
                            Ok(())
                        }
                    }).await
                }
                "send_keys" => {
                    benchmark_operation(op_name, iterations, || {
                        let backend = backend.clone();
                        let pane_id = pane_id.clone();
                        async move {
                            backend.send_keys(&pane_id, "test").await
                        }
                    }).await
                }
                "capture_pane" => {
                    benchmark_operation(op_name, iterations, || {
                        let backend = backend.clone();
                        let pane_id = pane_id.clone();
                        async move {
                            let _ = backend.capture_pane(&pane_id).await?;
                            Ok(())
                        }
                    }).await
                }
                "list_sessions" => {
                    benchmark_operation(op_name, iterations, || {
                        let backend = backend.clone();
                        async move {
                            let _ = backend.list_sessions().await?;
                            Ok(())
                        }
                    }).await
                }
                _ => unreachable!(),
            };
            results.push(result);
        }
        
        backend.clear().await;
        results
    }
    
    async fn benchmark_tmux_operations() -> Vec<BenchmarkResult> {
        let backend = TmuxBackend::new();
        let mut results = Vec::new();
        
        // Cleanup
        let sessions = backend.list_sessions().await.unwrap_or_default();
        for session in sessions {
            if session.name.starts_with("bench-") {
                let _ = backend.kill_session(&session.id).await;
            }
        }
        
        // Standard set of operations for comparison
        let session_id = backend.create_session(&format!("bench-{}", uuid::Uuid::new_v4())).await.unwrap();
        let pane_id = backend.create_pane(&session_id, SplitType::None).await.unwrap();
        
        // Time each operation type (fewer iterations for tmux due to process overhead)
        let operations = vec![
            ("session_create", 10),
            ("pane_create", 10),
            ("send_keys", 20),
            ("capture_pane", 20),
            ("list_sessions", 20),
        ];
        
        for (op_name, iterations) in operations {
            let result = match op_name {
                "session_create" => {
                    benchmark_operation(op_name, iterations, || {
                        let backend = backend.clone();
                        async move {
                            let id = backend.create_session(&format!("bench-temp-{}", uuid::Uuid::new_v4())).await?;
                            backend.kill_session(&id).await?;
                            Ok(())
                        }
                    }).await
                }
                "pane_create" => {
                    benchmark_operation(op_name, iterations, || {
                        let backend = backend.clone();
                        let session_id = session_id.clone();
                        async move {
                            let id = backend.create_pane(&session_id, SplitType::None).await?;
                            backend.kill_pane(&id).await?;
                            Ok(())
                        }
                    }).await
                }
                "send_keys" => {
                    benchmark_operation(op_name, iterations, || {
                        let backend = backend.clone();
                        let pane_id = pane_id.clone();
                        async move {
                            backend.send_keys(&pane_id, "test").await
                        }
                    }).await
                }
                "capture_pane" => {
                    benchmark_operation(op_name, iterations, || {
                        let backend = backend.clone();
                        let pane_id = pane_id.clone();
                        async move {
                            let _ = backend.capture_pane(&pane_id).await?;
                            Ok(())
                        }
                    }).await
                }
                "list_sessions" => {
                    benchmark_operation(op_name, iterations, || {
                        let backend = backend.clone();
                        async move {
                            let _ = backend.list_sessions().await?;
                            Ok(())
                        }
                    }).await
                }
                _ => unreachable!(),
            };
            results.push(result);
        }
        
        let _ = backend.kill_session(&session_id).await;
        results
    }
    
    fn tmux_available() -> bool {
        std::process::Command::new("tmux")
            .arg("-V")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
}