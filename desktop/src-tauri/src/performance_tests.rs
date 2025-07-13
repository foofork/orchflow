// Performance monitoring and metrics tests
// Validates performance targets and establishes benchmarks

#[cfg(test)]
mod tests {
    use crate::error::OrchflowError;
    use crate::simple_state_store::SimpleStateStore;
    use std::sync::Arc;
    use std::time::{Duration, Instant};
    use uuid::Uuid;

    // Performance targets
    const MAX_STARTUP_TIME_MS: u128 = 100;
    const MAX_OPERATION_TIME_MS: u128 = 10;
    const MAX_CONCURRENT_SESSIONS: usize = 50;
    const MAX_MEMORY_MB: f64 = 100.0;

    #[tokio::test]
    async fn test_state_store_performance() {
        let store = Arc::new(SimpleStateStore::new().unwrap());

        // Test single operation latency
        let start = Instant::now();
        store.set("perf_test_key", "perf_test_value").await.unwrap();
        let duration = start.elapsed();

        assert!(
            duration.as_millis() < MAX_OPERATION_TIME_MS,
            "Set operation took {}ms, expected <{}ms",
            duration.as_millis(),
            MAX_OPERATION_TIME_MS
        );

        // Test read performance
        let start = Instant::now();
        let _ = store.get("perf_test_key").await.unwrap();
        let duration = start.elapsed();

        assert!(
            duration.as_millis() < MAX_OPERATION_TIME_MS,
            "Get operation took {}ms, expected <{}ms",
            duration.as_millis(),
            MAX_OPERATION_TIME_MS
        );
    }

    #[tokio::test]
    async fn test_concurrent_session_performance() {
        let store = Arc::new(SimpleStateStore::new().unwrap());
        let start = Instant::now();

        // Create many sessions concurrently
        let mut handles = vec![];
        for i in 0..MAX_CONCURRENT_SESSIONS {
            let store = store.clone();
            let handle = tokio::spawn(async move {
                let create_session = crate::simple_state_store::CreateSession {
                    name: format!("Perf Session {}", i),
                    tmux_session: None,
                    metadata: None,
                };
                store.create_session(create_session).await
            });
            handles.push(handle);
        }

        // Wait for all operations
        let mut success_count = 0;
        for handle in handles {
            if let Ok(Ok(_)) = handle.await {
                success_count += 1;
            }
        }

        let duration = start.elapsed();

        assert_eq!(
            success_count, MAX_CONCURRENT_SESSIONS,
            "Not all sessions were created successfully"
        );

        assert!(
            duration.as_secs() < 5,
            "Creating {} sessions took {:?}, expected <5s",
            MAX_CONCURRENT_SESSIONS,
            duration
        );

        // Calculate average operation time
        let avg_ms = duration.as_millis() as f64 / MAX_CONCURRENT_SESSIONS as f64;
        println!("Average time per session creation: {:.2}ms", avg_ms);
    }

    #[tokio::test]
    async fn test_bulk_operations_performance() {
        let store = Arc::new(SimpleStateStore::new().unwrap());

        // Test bulk writes
        let start = Instant::now();
        for i in 0..1000 {
            let key = format!("bulk_key_{}", i);
            let value = format!("bulk_value_{}", i);
            store.set(&key, &value).await.unwrap();
        }
        let write_duration = start.elapsed();

        // Test bulk reads
        let start = Instant::now();
        for i in 0..1000 {
            let key = format!("bulk_key_{}", i);
            let _ = store.get(&key).await.unwrap();
        }
        let read_duration = start.elapsed();

        println!("Bulk write (1000 ops): {:?}", write_duration);
        println!("Bulk read (1000 ops): {:?}", read_duration);

        // Ensure reasonable performance
        assert!(
            write_duration.as_secs() < 2,
            "Bulk writes took too long: {:?}",
            write_duration
        );
        assert!(
            read_duration.as_secs() < 1,
            "Bulk reads took too long: {:?}",
            read_duration
        );
    }

    #[tokio::test]
    async fn test_error_creation_performance() {
        // Test error creation overhead
        let start = Instant::now();
        let mut errors = vec![];

        for i in 0..10000 {
            let error = OrchflowError::session_not_found(format!("session_{}", i));
            errors.push(error);
        }

        let duration = start.elapsed();

        assert!(
            duration.as_millis() < 100,
            "Creating 10k errors took {}ms, expected <100ms",
            duration.as_millis()
        );

        // Test error serialization performance
        let error = OrchflowError::backend_error("test_op", "test_reason");
        let start = Instant::now();

        for _ in 0..1000 {
            let _ = serde_json::to_string(&error).unwrap();
        }

        let duration = start.elapsed();

        assert!(
            duration.as_millis() < 50,
            "Serializing 1k errors took {}ms, expected <50ms",
            duration.as_millis()
        );
    }

    #[test]
    fn test_memory_usage_baseline() {
        // Get current memory usage
        let mut system = sysinfo::System::new_all();
        system.refresh_processes();

        let pid = sysinfo::Pid::from_u32(std::process::id());
        if let Some(process) = system.process(pid) {
            let memory_mb = process.memory() as f64 / 1024.0 / 1024.0;

            println!("Current memory usage: {:.2} MB", memory_mb);

            // This is a soft check - memory usage varies
            if memory_mb > MAX_MEMORY_MB {
                println!(
                    "Warning: Memory usage ({:.2} MB) exceeds target ({:.2} MB)",
                    memory_mb, MAX_MEMORY_MB
                );
            }
        }
    }

    #[tokio::test]
    async fn test_persistence_performance() {
        let temp_db = format!("/tmp/perf_test_{}.db", Uuid::new_v4());

        // Test file-based store performance
        let start = Instant::now();
        let store = SimpleStateStore::new_with_file(&temp_db).unwrap();
        let init_duration = start.elapsed();

        assert!(
            init_duration.as_millis() < 50,
            "Store initialization took {}ms, expected <50ms",
            init_duration.as_millis()
        );

        // Test persistence operations
        let start = Instant::now();
        for i in 0..100 {
            store
                .set(&format!("key_{}", i), &format!("value_{}", i))
                .await
                .unwrap();
        }
        let write_duration = start.elapsed();

        println!("100 persistent writes: {:?}", write_duration);

        // Cleanup
        std::fs::remove_file(&temp_db).ok();
    }

    #[tokio::test]
    async fn test_search_performance() {
        let store = Arc::new(SimpleStateStore::new().unwrap());

        // Create many keys with patterns
        for i in 0..1000 {
            let key = format!("search:item:{}", i);
            let value = format!("value_{}", i);
            store.set(&key, &value).await.unwrap();
        }

        // Test prefix search performance
        let start = Instant::now();
        let keys = store.keys_with_prefix("search:item:").await.unwrap();
        let duration = start.elapsed();

        assert_eq!(keys.len(), 1000);
        assert!(
            duration.as_millis() < 100,
            "Prefix search took {}ms, expected <100ms",
            duration.as_millis()
        );
    }

    #[tokio::test]
    async fn test_operation_scaling() {
        let store = Arc::new(SimpleStateStore::new().unwrap());
        let mut timings = vec![];

        // Test how performance scales with data size
        for size in [10, 100, 1000, 5000] {
            let start = Instant::now();

            for i in 0..size {
                let key = format!("scale_test_{}_{}", size, i);
                store.set(&key, "value").await.unwrap();
            }

            let duration = start.elapsed();
            let avg_ms = duration.as_millis() as f64 / size as f64;
            timings.push((size, avg_ms));

            println!("Size {}: {:.3}ms per operation", size, avg_ms);
        }

        // Verify scaling is reasonable (not exponential)
        let first_avg = timings[0].1;
        let last_avg = timings[timings.len() - 1].1;

        assert!(
            last_avg < first_avg * 10.0,
            "Performance degraded too much with scale"
        );
    }
}
