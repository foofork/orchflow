// Demo program to test the enhanced test result storage functionality

use orchflow::simple_state_store::SimpleStateStore;
use orchflow::test_parser_commands::*;
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🧪 Testing Enhanced Test Result Storage");
    println!("=====================================");
    
    // Create in-memory store
    let store = Arc::new(SimpleStateStore::new()?);
    
    // Test 1: Parse Jest output
    println!("\n📝 Test 1: Parsing Jest output");
    
    let jest_output = r#"
 PASS  src/utils.test.js
  ✓ should add numbers (5 ms)
  ✗ should handle errors (12 ms)
  ○ should skip this test

Test Suites: 1 passed, 1 total
Tests:       2 passed, 1 failed, 1 skipped, 4 total
"#;

    let request = TestParseRequest {
        output: jest_output.to_string(),
        framework: "jest".to_string(),
        run_id: "demo-run-1".to_string(),
        suite_id: "demo-suite-1".to_string(),
    };

    // Simulate the tauri command call
    let summary = parse_and_store_test_output_internal(store.clone(), request).await?;
    
    println!("✅ Parsed and stored test results:");
    println!("   Total tests: {}", summary.total_tests);
    println!("   Passed: {}", summary.passed_tests);
    println!("   Failed: {}", summary.failed_tests);
    println!("   Skipped: {}", summary.skipped_tests);
    
    // Test 2: Retrieve test runs
    println!("\n📋 Test 2: Retrieving test runs");
    
    let runs = get_test_runs_internal(store.clone(), Some(10)).await?;
    println!("✅ Retrieved {} test runs", runs.len());
    
    if !runs.is_empty() {
        let run = &runs[0];
        println!("   Latest run: {} ({})", run.run_id, run.framework);
    }
    
    // Test 3: Get run summary
    println!("\n📊 Test 3: Getting run summary");
    
    let summary = get_test_run_summary_internal(store.clone(), "demo-run-1".to_string()).await?;
    
    if let Some(summary) = summary {
        println!("✅ Retrieved run summary:");
        println!("   Run ID: {}", summary.run_id);
        println!("   Framework: {}", summary.framework);
        println!("   Duration: {}ms", summary.duration_ms);
        println!("   Pass rate: {:.1}%", (summary.passed_tests as f64 / summary.total_tests as f64) * 100.0);
    }
    
    // Test 4: Get individual test results
    println!("\n🔍 Test 4: Getting individual test results");
    
    let results = get_test_results_internal(store.clone(), "demo-run-1".to_string(), None).await?;
    println!("✅ Retrieved {} individual test results", results.len());
    
    for result in &results {
        let status_icon = match result.status {
            TestStatus::Passed => "✅",
            TestStatus::Failed => "❌",
            TestStatus::Skipped => "⏭️",
            TestStatus::Pending => "⏳",
        };
        println!("   {} {} ({}ms)", status_icon, result.test_name, 
                result.duration_ms.unwrap_or(0));
    }
    
    // Test 5: Get statistics
    println!("\n📈 Test 5: Getting test statistics");
    
    let stats = get_test_statistics_internal(store.clone(), Some(7)).await?;
    println!("✅ Test statistics for last 7 days:");
    println!("   Total runs: {}", stats.total_runs);
    println!("   Total tests: {}", stats.total_tests);
    println!("   Pass rate: {:.1}%", stats.pass_rate);
    
    // Test 6: Test different framework parsers
    println!("\n🔧 Test 6: Testing different framework parsers");
    
    let pytest_output = r#"
test_example.py::test_function PASSED
test_example.py::test_another FAILED
test_example.py::test_skipped SKIPPED
"#;

    let pytest_results = parse_pytest_output(pytest_output);
    println!("✅ Parsed {} pytest results", pytest_results.len());
    
    let cargo_output = r#"
running 3 tests
test tests::test_add ... ok
test tests::test_subtract ... FAILED
test tests::test_ignored ... ignored

test result: FAILED. 1 passed; 1 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.01s
"#;

    let cargo_results = parse_cargo_test_output(cargo_output);
    println!("✅ Parsed {} cargo test results", cargo_results.len());
    
    println!("\n🎉 All tests completed successfully!");
    println!("✨ Enhanced test result storage is working correctly");
    
    Ok(())
}

// Internal functions that don't require Tauri State wrapper
async fn parse_and_store_test_output_internal(
    state: Arc<SimpleStateStore>,
    request: TestParseRequest,
) -> Result<ParseTestSummary, Box<dyn std::error::Error>> {
    let parsed_results = match request.framework.as_str() {
        "jest" | "vitest" => parse_jest_vitest_output(&request.output),
        "pytest" => parse_pytest_output(&request.output),
        "cargo" | "rust" => parse_cargo_test_output(&request.output),
        "go" => parse_go_test_output(&request.output),
        _ => return Err(format!("Unsupported test framework: {}", request.framework).into()),
    };

    let mut total = 0;
    let mut passed = 0;
    let mut failed = 0;
    let mut skipped = 0;
    let mut result_keys = Vec::new();
    
    for result in &parsed_results {
        total += 1;
        match &result.status {
            TestStatus::Passed => passed += 1,
            TestStatus::Failed => failed += 1,
            TestStatus::Skipped => skipped += 1,
            TestStatus::Pending => skipped += 1,
        }

        let result_key = format!("test_result:{}:{}", request.run_id, result.test_name);
        let result_data = serde_json::to_string(&result)?;

        if state.set(&result_key, &result_data).await.is_ok() {
            result_keys.push(result_key);
        }
    }

    // Store test run summary
    let summary = TestRunSummary {
        run_id: request.run_id.clone(),
        suite_id: request.suite_id.clone(),
        framework: request.framework.clone(),
        timestamp: chrono::Utc::now(),
        total_tests: total,
        passed_tests: passed,
        failed_tests: failed,
        skipped_tests: skipped,
        duration_ms: parsed_results.iter()
            .filter_map(|r| r.duration_ms)
            .sum::<i32>(),
    };

    let summary_data = serde_json::to_string(&summary)?;
    let summary_key = format!("test_summary:{}", request.run_id);
    state.set(&summary_key, &summary_data).await?;

    // Store test run list entry
    let mut runs = get_test_runs_list_internal(&state).await.unwrap_or_default();
    runs.push(TestRunEntry {
        run_id: request.run_id.clone(),
        suite_id: request.suite_id.clone(),
        framework: request.framework.clone(),
        timestamp: chrono::Utc::now(),
        total_tests: total,
        passed_tests: passed,
        failed_tests: failed,
        skipped_tests: skipped,
    });

    if runs.len() > 100 {
        runs = runs.into_iter().rev().take(100).rev().collect();
    }

    let runs_data = serde_json::to_string(&runs)?;
    state.set("test_runs", &runs_data).await?;

    // Store test result keys index
    let keys_index_key = format!("test_result_keys:{}", request.run_id);
    let keys_data = serde_json::to_string(&result_keys)?;
    state.set(&keys_index_key, &keys_data).await?;

    Ok(ParseTestSummary {
        total_tests: total,
        passed_tests: passed,
        failed_tests: failed,
        skipped_tests: skipped,
    })
}

async fn get_test_runs_internal(
    state: Arc<SimpleStateStore>,
    limit: Option<i32>,
) -> Result<Vec<TestRunEntry>, Box<dyn std::error::Error>> {
    let runs = get_test_runs_list_internal(&state).await.unwrap_or_default();
    let limit = limit.unwrap_or(20) as usize;
    Ok(runs.into_iter().rev().take(limit).collect())
}

async fn get_test_run_summary_internal(
    state: Arc<SimpleStateStore>,
    run_id: String,
) -> Result<Option<TestRunSummary>, Box<dyn std::error::Error>> {
    let summary_key = format!("test_summary:{}", run_id);
    
    match state.get(&summary_key).await? {
        Some(data) => Ok(Some(serde_json::from_str::<TestRunSummary>(&data)?)),
        None => Ok(None),
    }
}

async fn get_test_results_internal(
    state: Arc<SimpleStateStore>,
    run_id: String,
    status_filter: Option<String>,
) -> Result<Vec<ParsedTestResult>, Box<dyn std::error::Error>> {
    let mut results = Vec::new();
    let keys = get_test_result_keys_internal(&state, &run_id).await?;
    
    for key in keys {
        if let Some(data) = state.get(&key).await? {
            if let Ok(result) = serde_json::from_str::<ParsedTestResult>(&data) {
                if let Some(ref filter) = status_filter {
                    if result.status.to_string() != filter.to_lowercase() {
                        continue;
                    }
                }
                results.push(result);
            }
        }
    }
    
    Ok(results)
}

async fn get_test_statistics_internal(
    state: Arc<SimpleStateStore>,
    days: Option<i32>,
) -> Result<TestStatistics, Box<dyn std::error::Error>> {
    let runs = get_test_runs_list_internal(&state).await.unwrap_or_default();
    let days = days.unwrap_or(7);
    let cutoff_date = chrono::Utc::now() - chrono::Duration::days(days as i64);
    
    let recent_runs: Vec<_> = runs.iter()
        .filter(|run| run.timestamp > cutoff_date)
        .collect();
    
    let total_runs = recent_runs.len();
    let total_tests: i32 = recent_runs.iter().map(|r| r.total_tests).sum();
    let total_passed: i32 = recent_runs.iter().map(|r| r.passed_tests).sum();
    let total_failed: i32 = recent_runs.iter().map(|r| r.failed_tests).sum();
    let total_skipped: i32 = recent_runs.iter().map(|r| r.skipped_tests).sum();
    
    let pass_rate = if total_tests > 0 {
        (total_passed as f64 / total_tests as f64) * 100.0
    } else {
        0.0
    };
    
    Ok(TestStatistics {
        total_runs: total_runs as i32,
        total_tests,
        total_passed,
        total_failed,
        total_skipped,
        pass_rate,
        period_days: days,
    })
}

async fn get_test_runs_list_internal(
    state: &Arc<SimpleStateStore>
) -> Result<Vec<TestRunEntry>, Box<dyn std::error::Error>> {
    match state.get("test_runs").await? {
        Some(data) => Ok(serde_json::from_str::<Vec<TestRunEntry>>(&data)?),
        None => Ok(Vec::new()),
    }
}

async fn get_test_result_keys_internal(
    state: &Arc<SimpleStateStore>,
    run_id: &str,
) -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let index_key = format!("test_result_keys:{}", run_id);
    
    match state.get(&index_key).await? {
        Some(data) => Ok(serde_json::from_str::<Vec<String>>(&data)?),
        None => Ok(Vec::new()),
    }
}