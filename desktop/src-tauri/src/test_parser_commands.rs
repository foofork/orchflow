// Test parser commands for parsing test output and storing results
use crate::error::Result;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedTestResult {
    pub test_file: String,
    pub test_name: String,
    pub test_path: String,
    pub status: TestStatus,
    pub duration_ms: Option<i32>,
    pub error_message: Option<String>,
    pub error_stack: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TestStatus {
    Passed,
    Failed,
    Skipped,
    Pending,
}

impl ToString for TestStatus {
    fn to_string(&self) -> String {
        match self {
            TestStatus::Passed => "passed",
            TestStatus::Failed => "failed",
            TestStatus::Skipped => "skipped",
            TestStatus::Pending => "pending",
        }
        .to_string()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestParseRequest {
    pub output: String,
    pub framework: String,
    pub run_id: String,
    pub suite_id: String,
}

/// Parse test output and store results
#[tauri::command]
pub async fn parse_and_store_test_output(
    state: State<'_, Arc<crate::simple_state_store::SimpleStateStore>>,
    request: TestParseRequest,
) -> Result<ParseTestSummary> {
    let parsed_results = match request.framework.as_str() {
        "jest" | "vitest" => parse_jest_vitest_output(&request.output),
        "pytest" => parse_pytest_output(&request.output),
        "cargo" | "rust" => parse_cargo_test_output(&request.output),
        "go" => parse_go_test_output(&request.output),
        _ => {
            return Err(crate::error::OrchflowError::ValidationError {
                field: "framework".to_string(),
                reason: format!("Unsupported test framework: {}", request.framework),
            })
        }
    };

    // Store results in database
    let mut total = 0;
    let mut passed = 0;
    let mut failed = 0;
    let mut skipped = 0;

    // Process test results without database storage for now
    for result in parsed_results {
        total += 1;
        match &result.status {
            TestStatus::Passed => passed += 1,
            TestStatus::Failed => failed += 1,
            TestStatus::Skipped => skipped += 1,
            TestStatus::Pending => skipped += 1,
        }

        // TODO: Store test results using SimpleStateStore key-value store
        let result_key = format!("test_result:{}:{}", request.run_id, result.test_name);
        let result_data = serde_json::to_string(&result).map_err(|e| {
            crate::error::OrchflowError::ValidationError {
                field: "test_result".to_string(),
                reason: format!("Failed to serialize test result: {}", e),
            }
        })?;

        if let Err(e) = state.set(&result_key, &result_data).await {
            eprintln!("Warning: Failed to store test result: {}", e);
        }
    }

    Ok(ParseTestSummary {
        total_tests: total,
        passed_tests: passed,
        failed_tests: failed,
        skipped_tests: skipped,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParseTestSummary {
    pub total_tests: i32,
    pub passed_tests: i32,
    pub failed_tests: i32,
    pub skipped_tests: i32,
}

// Parser implementations

pub fn parse_jest_vitest_output(output: &str) -> Vec<ParsedTestResult> {
    let mut results = Vec::new();

    // Regex patterns for Jest/Vitest
    let pass_regex = Regex::new(r"✓\s+(.+)\s+\((\d+)\s*ms\)").unwrap();
    let fail_regex = Regex::new(r"✗\s+(.+)\s+\((\d+)\s*ms\)").unwrap();
    let skip_regex = Regex::new(r"○\s+(.+)").unwrap();
    let suite_regex = Regex::new(r"^\s*(.+\.(?:test|spec)\.[jt]sx?)\s*$").unwrap();

    let mut current_file = "unknown".to_string();

    for line in output.lines() {
        // Check for test file
        if let Some(cap) = suite_regex.captures(line) {
            current_file = cap[1].to_string();
        }

        // Check for passed tests
        if let Some(cap) = pass_regex.captures(line) {
            results.push(ParsedTestResult {
                test_file: current_file.clone(),
                test_name: cap[1].trim().to_string(),
                test_path: format!("{}::{}", current_file, cap[1].trim()),
                status: TestStatus::Passed,
                duration_ms: Some(cap[2].parse().unwrap_or(0)),
                error_message: None,
                error_stack: None,
            });
        }

        // Check for failed tests
        if let Some(cap) = fail_regex.captures(line) {
            results.push(ParsedTestResult {
                test_file: current_file.clone(),
                test_name: cap[1].trim().to_string(),
                test_path: format!("{}::{}", current_file, cap[1].trim()),
                status: TestStatus::Failed,
                duration_ms: Some(cap[2].parse().unwrap_or(0)),
                error_message: Some("Test failed".to_string()),
                error_stack: None,
            });
        }

        // Check for skipped tests
        if let Some(cap) = skip_regex.captures(line) {
            results.push(ParsedTestResult {
                test_file: current_file.clone(),
                test_name: cap[1].trim().to_string(),
                test_path: format!("{}::{}", current_file, cap[1].trim()),
                status: TestStatus::Skipped,
                duration_ms: None,
                error_message: None,
                error_stack: None,
            });
        }
    }

    results
}

pub fn parse_pytest_output(output: &str) -> Vec<ParsedTestResult> {
    let mut results = Vec::new();

    let test_regex = Regex::new(r"([\w/]+\.py)::(test_\w+).*?(PASSED|FAILED|SKIPPED)").unwrap();

    for cap in test_regex.captures_iter(output) {
        let status = match &cap[3] {
            "PASSED" => TestStatus::Passed,
            "FAILED" => TestStatus::Failed,
            "SKIPPED" => TestStatus::Skipped,
            _ => TestStatus::Pending,
        };

        results.push(ParsedTestResult {
            test_file: cap[1].to_string(),
            test_name: cap[2].to_string(),
            test_path: format!("{}::{}", &cap[1], &cap[2]),
            status,
            duration_ms: None, // Would need to parse from verbose output
            error_message: if matches!(status, TestStatus::Failed) {
                Some("Test failed".to_string())
            } else {
                None
            },
            error_stack: None,
        });
    }

    results
}

pub fn parse_cargo_test_output(output: &str) -> Vec<ParsedTestResult> {
    let mut results = Vec::new();

    let test_regex = Regex::new(r"test\s+([\w:]+)\s+\.\.\.\s+(ok|FAILED|ignored)").unwrap();
    let duration_regex = Regex::new(r"test result:.*?finished in (\d+\.\d+)s").unwrap();

    for cap in test_regex.captures_iter(output) {
        let status = match &cap[2] {
            "ok" => TestStatus::Passed,
            "FAILED" => TestStatus::Failed,
            "ignored" => TestStatus::Skipped,
            _ => TestStatus::Pending,
        };

        let test_path = cap[1].to_string();
        let parts: Vec<&str> = test_path.split("::").collect();
        let test_file = if parts.len() > 1 {
            format!("{}.rs", parts[0].replace("::", "/"))
        } else {
            "unknown.rs".to_string()
        };

        results.push(ParsedTestResult {
            test_file,
            test_name: parts.last().map(|s| *s).unwrap_or(&cap[1]).to_string(),
            test_path: test_path.clone(),
            status,
            duration_ms: None,
            error_message: if matches!(status, TestStatus::Failed) {
                Some("Test failed".to_string())
            } else {
                None
            },
            error_stack: None,
        });
    }

    results
}

pub fn parse_go_test_output(output: &str) -> Vec<ParsedTestResult> {
    let mut results = Vec::new();

    let test_regex = Regex::new(r"---\s+(PASS|FAIL|SKIP):\s+(\w+)\s+\((\d+\.\d+)s\)").unwrap();
    let package_regex = Regex::new(r"(?:ok|FAIL)\s+([\w/\.]+)").unwrap();

    let mut current_package = "unknown".to_string();

    for line in output.lines() {
        if let Some(cap) = package_regex.captures(line) {
            current_package = cap[1].to_string();
        }

        if let Some(cap) = test_regex.captures(line) {
            let status = match &cap[1] {
                "PASS" => TestStatus::Passed,
                "FAIL" => TestStatus::Failed,
                "SKIP" => TestStatus::Skipped,
                _ => TestStatus::Pending,
            };

            let duration_ms = (cap[3].parse::<f64>().unwrap_or(0.0) * 1000.0) as i32;

            results.push(ParsedTestResult {
                test_file: format!("{}_test.go", current_package.replace("/", "_")),
                test_name: cap[2].to_string(),
                test_path: format!("{}::{}", current_package, &cap[2]),
                status,
                duration_ms: Some(duration_ms),
                error_message: if matches!(status, TestStatus::Failed) {
                    Some("Test failed".to_string())
                } else {
                    None
                },
                error_stack: None,
            });
        }
    }

    results
}

/// Get supported test frameworks
#[tauri::command]
pub async fn get_supported_test_frameworks() -> Result<Vec<TestFrameworkInfo>> {
    Ok(vec![
        TestFrameworkInfo {
            id: "jest".to_string(),
            name: "Jest".to_string(),
            language: "JavaScript/TypeScript".to_string(),
            file_patterns: vec![
                "*.test.js".to_string(),
                "*.test.ts".to_string(),
                "*.spec.js".to_string(),
                "*.spec.ts".to_string(),
            ],
            command: "npm test".to_string(),
        },
        TestFrameworkInfo {
            id: "vitest".to_string(),
            name: "Vitest".to_string(),
            language: "JavaScript/TypeScript".to_string(),
            file_patterns: vec![
                "*.test.js".to_string(),
                "*.test.ts".to_string(),
                "*.spec.js".to_string(),
                "*.spec.ts".to_string(),
            ],
            command: "npm run test".to_string(),
        },
        TestFrameworkInfo {
            id: "pytest".to_string(),
            name: "pytest".to_string(),
            language: "Python".to_string(),
            file_patterns: vec!["test_*.py".to_string(), "*_test.py".to_string()],
            command: "pytest".to_string(),
        },
        TestFrameworkInfo {
            id: "cargo".to_string(),
            name: "Cargo Test".to_string(),
            language: "Rust".to_string(),
            file_patterns: vec!["*.rs".to_string()],
            command: "cargo test".to_string(),
        },
        TestFrameworkInfo {
            id: "go".to_string(),
            name: "Go Test".to_string(),
            language: "Go".to_string(),
            file_patterns: vec!["*_test.go".to_string()],
            command: "go test".to_string(),
        },
    ])
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestFrameworkInfo {
    pub id: String,
    pub name: String,
    pub language: String,
    pub file_patterns: Vec<String>,
    pub command: String,
}
