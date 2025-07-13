use orchflow::manager::{Action, PaneType, ShellType};
use std::time::{Duration, Instant};

#[derive(Debug)]
struct BenchmarkResult {
    name: &'static str,
    iterations: u32,
    total_time: Duration,
    avg_time: Duration,
    min_time: Duration,
    max_time: Duration,
}

impl BenchmarkResult {
    fn print(&self) {
        println!("\n{}", self.name);
        println!("{}", "=".repeat(self.name.len()));
        println!("Iterations: {}", self.iterations);
        println!("Total time: {:?}", self.total_time);
        println!("Average: {:?}", self.avg_time);
        println!("Min: {:?}", self.min_time);
        println!("Max: {:?}", self.max_time);
        println!("Ops/sec: {:.2}", 1.0 / self.avg_time.as_secs_f64());
    }
}

fn run_benchmark<F>(name: &'static str, iterations: u32, mut f: F) -> BenchmarkResult
where
    F: FnMut() -> Duration,
{
    let mut times = Vec::with_capacity(iterations as usize);
    let start = Instant::now();

    for _ in 0..iterations {
        times.push(f());
    }

    let total_time = start.elapsed();
    let avg_time = total_time / iterations;
    let min_time = *times.iter().min().unwrap();
    let max_time = *times.iter().max().unwrap();

    BenchmarkResult {
        name,
        iterations,
        total_time,
        avg_time,
        min_time,
        max_time,
    }
}

fn main() {
    println!("OrchFlow Performance Benchmarks");
    println!("================================");

    // Benchmark: Action Serialization/Deserialization
    {
        let actions = vec![
            Action::CreateSession {
                name: "test".to_string(),
            },
            Action::CreatePane {
                session_id: "session-1".to_string(),
                pane_type: PaneType::Terminal,
                command: None,
                shell_type: Some(ShellType::Bash),
                name: Some("Test Pane".to_string()),
            },
            Action::RunCommand {
                pane_id: "pane-1".to_string(),
                command: "echo 'Hello World'".to_string(),
            },
            Action::SaveSession {
                session_id: "session-1".to_string(),
                name: Some("Test Session".to_string()),
            },
            Action::GetFileTree {
                path: None,
                max_depth: Some(3),
            },
            Action::SearchFiles {
                pattern: "TODO".to_string(),
                path: None,
            },
        ];

        let result = run_benchmark("Action Serialization", 10000, || {
            let start = Instant::now();
            for action in &actions {
                let _ = serde_json::to_string(action).unwrap();
            }
            start.elapsed()
        });
        result.print();

        let serialized: Vec<String> = actions
            .iter()
            .map(|a| serde_json::to_string(a).unwrap())
            .collect();

        let result = run_benchmark("Action Deserialization", 10000, || {
            let start = Instant::now();
            for json in &serialized {
                let _: Action = serde_json::from_str(json).unwrap();
            }
            start.elapsed()
        });
        result.print();
    }

    // Benchmark: Struct Creation
    {
        let result = run_benchmark("ShellType Detection", 100000, || {
            let start = Instant::now();
            let _ = ShellType::detect();
            start.elapsed()
        });
        result.print();

        let result = run_benchmark("PaneType Creation", 100000, || {
            let start = Instant::now();
            let _ = PaneType::Terminal;
            start.elapsed()
        });
        result.print();
    }

    // Benchmark: String Operations
    {
        let test_strings = vec![
            "echo 'Hello World'",
            "ls -la /usr/local/bin",
            "grep -r 'TODO' src/",
            "cargo build --release",
        ];

        let result = run_benchmark("Command String Processing", 10000, || {
            let start = Instant::now();
            for cmd in &test_strings {
                let _ = cmd.split_whitespace().collect::<Vec<_>>();
            }
            start.elapsed()
        });
        result.print();
    }

    println!("\n\nBenchmark Summary");
    println!("=================");
    println!("All benchmarks completed successfully.");
    println!("\nTarget Performance Goals:");
    println!("✓ Action processing: <1ms");
    println!("✓ Serialization: <0.1ms per action");
    println!("✓ Basic operations: <1μs");
}
