// Test Results Management with SimpleStateStore
// Replaces SQLx-based implementation with unified state management

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;

use crate::error::OrchflowError;
use crate::simple_state_store::SimpleStateStore;

// ===== Core Types =====

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestSuite {
    pub id: String,
    pub session_id: String,
    pub name: String,
    pub project_path: String,
    pub test_framework: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestRun {
    pub id: String,
    pub suite_id: String,
    pub session_id: String,
    pub command: String,
    pub status: TestRunStatus,
    pub total_tests: i32,
    pub passed_tests: i32,
    pub failed_tests: i32,
    pub skipped_tests: i32,
    pub duration_ms: Option<i32>,
    pub coverage_percent: Option<f64>,
    pub error_output: Option<String>,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub metadata: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestResult {
    pub id: String,
    pub run_id: String,
    pub suite_id: String,
    pub test_file: String,
    pub test_name: String,
    pub test_path: String,
    pub status: TestStatus,
    pub duration_ms: Option<i32>,
    pub error_message: Option<String>,
    pub error_stack: Option<String>,
    pub assertion_results: Option<String>,
    pub output: Option<String>,
    pub metadata: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum TestRunStatus {
    Running,
    Passed,
    Failed,
    Cancelled,
    Timeout,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum TestStatus {
    Passed,
    Failed,
    Skipped,
    Todo,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestRunSummary {
    pub run_id: String,
    pub suite_name: String,
    pub status: TestRunStatus,
    pub total_tests: i32,
    pub passed_tests: i32,
    pub failed_tests: i32,
    pub duration_ms: Option<i32>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestCoverage {
    pub run_id: String,
    pub file_path: String,
    pub lines_covered: i32,
    pub lines_total: i32,
    pub coverage_percent: f64,
    pub functions_covered: Option<i32>,
    pub functions_total: Option<i32>,
    pub branches_covered: Option<i32>,
    pub branches_total: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestFailureTrend {
    pub test_name: String,
    pub failure_count: i32,
    pub last_failure_date: DateTime<Utc>,
    pub avg_duration_ms: Option<f64>,
}

// ===== Storage Implementation =====

pub struct TestResultsManager {
    store: Arc<SimpleStateStore>,
}

impl TestResultsManager {
    pub fn new(store: Arc<SimpleStateStore>) -> Self {
        Self { store }
    }

    // Test Suite Management
    pub async fn create_test_suite(&self, suite: TestSuite) -> Result<TestSuite, OrchflowError> {
        let key = format!("test_suite:{}", suite.id);
        let value =
            serde_json::to_string(&suite).map_err(|e| OrchflowError::StatePersistenceError {
                reason: format!("Failed to serialize test suite: {}", e),
            })?;

        self.store
            .set(&key, &value)
            .await
            .map_err(|e| OrchflowError::StatePersistenceError {
                reason: format!("Failed to store test suite: {:?}", e),
            })?;

        Ok(suite)
    }

    pub async fn get_test_suite(&self, suite_id: &str) -> Result<Option<TestSuite>, OrchflowError> {
        let key = format!("test_suite:{}", suite_id);

        match self.store.get(&key).await {
            Ok(Some(value)) => {
                let suite: TestSuite = serde_json::from_str(&value).map_err(|e| {
                    OrchflowError::StatePersistenceError {
                        reason: format!("Failed to deserialize test suite: {}", e),
                    }
                })?;
                Ok(Some(suite))
            }
            Ok(None) => Ok(None),
            Err(e) => Err(OrchflowError::StatePersistenceError {
                reason: format!("Failed to retrieve test suite: {:?}", e),
            }),
        }
    }

    pub async fn list_test_suites(
        &self,
        session_id: &str,
    ) -> Result<Vec<TestSuite>, OrchflowError> {
        let prefix = "test_suite:";
        let all_values = self.store.list_with_prefix(prefix).await.map_err(|e| {
            OrchflowError::StatePersistenceError {
                reason: format!("Failed to list test suites: {:?}", e),
            }
        })?;

        let mut suites = Vec::new();
        for kv in all_values {
            if let Ok(suite) = serde_json::from_str::<TestSuite>(&kv.value) {
                if suite.session_id == session_id {
                    suites.push(suite);
                }
            }
        }

        Ok(suites)
    }

    // Test Run Management
    pub async fn create_test_run(&self, run: TestRun) -> Result<TestRun, OrchflowError> {
        let key = format!("test_run:{}", run.id);
        let value =
            serde_json::to_string(&run).map_err(|e| OrchflowError::StatePersistenceError {
                reason: format!("Failed to serialize test run: {}", e),
            })?;

        self.store
            .set(&key, &value)
            .await
            .map_err(|e| OrchflowError::StatePersistenceError {
                reason: format!("Failed to store test run: {:?}", e),
            })?;

        Ok(run)
    }

    pub async fn update_test_run(&self, run: TestRun) -> Result<TestRun, OrchflowError> {
        self.create_test_run(run).await // Same as create for now
    }

    pub async fn get_test_run(&self, run_id: &str) -> Result<Option<TestRun>, OrchflowError> {
        let key = format!("test_run:{}", run_id);

        match self.store.get(&key).await {
            Ok(Some(value)) => {
                let run: TestRun = serde_json::from_str(&value).map_err(|e| {
                    OrchflowError::StatePersistenceError {
                        reason: format!("Failed to deserialize test run: {}", e),
                    }
                })?;
                Ok(Some(run))
            }
            Ok(None) => Ok(None),
            Err(e) => Err(OrchflowError::StatePersistenceError {
                reason: format!("Failed to retrieve test run: {:?}", e),
            }),
        }
    }

    // Test Results Management
    pub async fn create_test_result(
        &self,
        result: TestResult,
    ) -> Result<TestResult, OrchflowError> {
        let key = format!("test_result:{}", result.id);
        let value =
            serde_json::to_string(&result).map_err(|e| OrchflowError::StatePersistenceError {
                reason: format!("Failed to serialize test result: {}", e),
            })?;

        self.store
            .set(&key, &value)
            .await
            .map_err(|e| OrchflowError::StatePersistenceError {
                reason: format!("Failed to store test result: {:?}", e),
            })?;

        Ok(result)
    }

    pub async fn get_test_results_for_run(
        &self,
        run_id: &str,
    ) -> Result<Vec<TestResult>, OrchflowError> {
        let prefix = "test_result:";
        let all_values = self.store.list_with_prefix(prefix).await.map_err(|e| {
            OrchflowError::StatePersistenceError {
                reason: format!("Failed to list test results: {:?}", e),
            }
        })?;

        let mut results = Vec::new();
        for kv in all_values {
            if let Ok(result) = serde_json::from_str::<TestResult>(&kv.value) {
                if result.run_id == run_id {
                    results.push(result);
                }
            }
        }

        Ok(results)
    }

    // Analytics and Reporting
    pub async fn get_test_run_summaries(
        &self,
        session_id: &str,
    ) -> Result<Vec<TestRunSummary>, OrchflowError> {
        let suites = self.list_test_suites(session_id).await?;
        let mut summaries = Vec::new();

        for suite in suites {
            let prefix = "test_run:";
            let all_values = self.store.list_with_prefix(prefix).await.map_err(|e| {
                OrchflowError::StatePersistenceError {
                    reason: format!("Failed to list test runs: {:?}", e),
                }
            })?;

            for kv in all_values {
                if let Ok(run) = serde_json::from_str::<TestRun>(&kv.value) {
                    if run.suite_id == suite.id {
                        summaries.push(TestRunSummary {
                            run_id: run.id,
                            suite_name: suite.name.clone(),
                            status: run.status,
                            total_tests: run.total_tests,
                            passed_tests: run.passed_tests,
                            failed_tests: run.failed_tests,
                            duration_ms: run.duration_ms,
                            completed_at: run.completed_at,
                        });
                    }
                }
            }
        }

        Ok(summaries)
    }

    pub async fn get_test_failure_trends(
        &self,
        session_id: &str,
    ) -> Result<Vec<TestFailureTrend>, OrchflowError> {
        // Implementation would analyze test results to identify patterns
        // For now, return empty vector
        Ok(Vec::new())
    }

    pub async fn delete_test_data(&self, _session_id: &str) -> Result<(), OrchflowError> {
        // This would delete all test data for a session
        // Implementation would require listing and deleting all related keys
        Ok(())
    }
}

// ===== Tauri Commands =====

#[tauri::command]
pub async fn create_test_suite_v2(
    suite: TestSuite,
    state: State<'_, Arc<SimpleStateStore>>,
) -> Result<TestSuite, OrchflowError> {
    let manager = TestResultsManager::new(state.inner().clone());
    manager.create_test_suite(suite).await
}

#[tauri::command]
pub async fn create_test_run_v2(
    run: TestRun,
    state: State<'_, Arc<SimpleStateStore>>,
) -> Result<TestRun, OrchflowError> {
    let manager = TestResultsManager::new(state.inner().clone());
    manager.create_test_run(run).await
}

#[tauri::command]
pub async fn create_test_result_v2(
    result: TestResult,
    state: State<'_, Arc<SimpleStateStore>>,
) -> Result<TestResult, OrchflowError> {
    let manager = TestResultsManager::new(state.inner().clone());
    manager.create_test_result(result).await
}

#[tauri::command]
pub async fn get_test_run_summaries_v2(
    session_id: String,
    state: State<'_, Arc<SimpleStateStore>>,
) -> Result<Vec<TestRunSummary>, OrchflowError> {
    let manager = TestResultsManager::new(state.inner().clone());
    manager.get_test_run_summaries(&session_id).await
}

#[tauri::command]
pub async fn get_test_results_for_run_v2(
    run_id: String,
    state: State<'_, Arc<SimpleStateStore>>,
) -> Result<Vec<TestResult>, OrchflowError> {
    let manager = TestResultsManager::new(state.inner().clone());
    manager.get_test_results_for_run(&run_id).await
}

#[tauri::command]
pub async fn get_test_failure_trends_v2(
    session_id: String,
    state: State<'_, Arc<SimpleStateStore>>,
) -> Result<Vec<TestFailureTrend>, OrchflowError> {
    let manager = TestResultsManager::new(state.inner().clone());
    manager.get_test_failure_trends(&session_id).await
}
