use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Sqlite};
use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

use crate::error::OrchflowError;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct TestSuite {
    pub id: String,
    pub session_id: String,
    pub name: String,
    pub project_path: String,
    pub test_framework: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct TestRun {
    pub id: String,
    pub suite_id: String,
    pub session_id: String,
    pub command: String,
    pub status: String,
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

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct TestResult {
    pub id: String,
    pub run_id: String,
    pub suite_id: String,
    pub test_file: String,
    pub test_name: String,
    pub test_path: String,
    pub status: String,
    pub duration_ms: Option<i32>,
    pub error_message: Option<String>,
    pub error_stack: Option<String>,
    pub assertion_results: Option<String>,
    pub retry_count: i32,
    pub metadata: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct TestCoverage {
    pub id: String,
    pub run_id: String,
    pub file_path: String,
    pub lines_total: i32,
    pub lines_covered: i32,
    pub branches_total: i32,
    pub branches_covered: i32,
    pub functions_total: i32,
    pub functions_covered: i32,
    pub statements_total: i32,
    pub statements_covered: i32,
    pub uncovered_lines: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct TestRunSummary {
    pub id: String,
    pub suite_name: String,
    pub project_path: String,
    pub status: String,
    pub total_tests: i32,
    pub passed_tests: i32,
    pub failed_tests: i32,
    pub duration_ms: Option<i32>,
    pub coverage_percent: Option<f64>,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct TestFailureTrend {
    pub test_date: String,
    pub suite_name: String,
    pub total_runs: i32,
    pub failed_runs: i32,
    pub avg_failed_tests: f64,
    pub avg_duration_ms: f64,
}

/// Create a new test suite
#[tauri::command]
pub async fn create_test_suite(
    state: State<'_, Arc<crate::SimpleStateStore>>,
    session_id: String,
    name: String,
    project_path: String,
    test_framework: String,
) -> Result<TestSuite, OrchflowError> {
    let pool = state.pool.as_ref().ok_or_else(|| OrchflowError::DatabaseError {
        operation: "initialize".to_string(),
        reason: "SQLx pool not initialized".to_string()
    })?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now();

    sqlx::query(
        r#"
        INSERT INTO test_suites (id, session_id, name, project_path, test_framework, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&session_id)
    .bind(&name)
    .bind(&project_path)
    .bind(&test_framework)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(|e| OrchflowError::DatabaseError {
        operation: "create_test_suite".to_string(),
        reason: format!("Failed to create test suite: {}", e)
    })?;

    Ok(TestSuite {
        id,
        session_id,
        name,
        project_path,
        test_framework,
        created_at: now,
        updated_at: now,
    })
}

/// Start a new test run
#[tauri::command]
pub async fn start_test_run(
    state: State<'_, Arc<crate::SimpleStateStore>>,
    suite_id: String,
    session_id: String,
    command: String,
) -> Result<TestRun, OrchflowError> {
    let pool = state.pool.as_ref().ok_or_else(|| OrchflowError::DatabaseError {
        operation: "initialize".to_string(),
        reason: "SQLx pool not initialized".to_string()
    })?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now();

    sqlx::query(
        r#"
        INSERT INTO test_runs (
            id, suite_id, session_id, command, status, 
            total_tests, passed_tests, failed_tests, skipped_tests,
            started_at
        )
        VALUES (?, ?, ?, ?, 'running', 0, 0, 0, 0, ?)
        "#,
    )
    .bind(&id)
    .bind(&suite_id)
    .bind(&session_id)
    .bind(&command)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(|e| OrchflowError::DatabaseError {
        operation: "start_test_run".to_string(),
        reason: format!("Failed to start test run: {}", e)
    })?;

    Ok(TestRun {
        id,
        suite_id,
        session_id,
        command,
        status: "running".to_string(),
        total_tests: 0,
        passed_tests: 0,
        failed_tests: 0,
        skipped_tests: 0,
        duration_ms: None,
        coverage_percent: None,
        error_output: None,
        started_at: now,
        completed_at: None,
        metadata: None,
    })
}

/// Update test run results
#[tauri::command]
pub async fn update_test_run(
    state: State<'_, Arc<crate::SimpleStateStore>>,
    run_id: String,
    status: String,
    total_tests: i32,
    passed_tests: i32,
    failed_tests: i32,
    skipped_tests: i32,
    duration_ms: Option<i32>,
    coverage_percent: Option<f64>,
    error_output: Option<String>,
) -> Result<(), OrchflowError> {
    let pool = state.pool.as_ref().ok_or_else(|| OrchflowError::DatabaseError {
        operation: "initialize".to_string(),
        reason: "SQLx pool not initialized".to_string()
    })?;
    let completed_at = if status != "running" {
        Some(Utc::now())
    } else {
        None
    };

    sqlx::query(
        r#"
        UPDATE test_runs
        SET status = ?, total_tests = ?, passed_tests = ?, failed_tests = ?,
            skipped_tests = ?, duration_ms = ?, coverage_percent = ?,
            error_output = ?, completed_at = ?
        WHERE id = ?
        "#,
    )
    .bind(&status)
    .bind(total_tests)
    .bind(passed_tests)
    .bind(failed_tests)
    .bind(skipped_tests)
    .bind(duration_ms)
    .bind(coverage_percent)
    .bind(error_output)
    .bind(completed_at)
    .bind(&run_id)
    .execute(pool)
    .await
    .map_err(|e| OrchflowError::DatabaseError {
        operation: "update_test_run".to_string(),
        reason: format!("Failed to update test run: {}", e)
    })?;

    Ok(())
}

/// Add individual test result
#[tauri::command]
pub async fn add_test_result(
    state: State<'_, Arc<crate::SimpleStateStore>>,
    run_id: String,
    suite_id: String,
    test_file: String,
    test_name: String,
    test_path: String,
    status: String,
    duration_ms: Option<i32>,
    error_message: Option<String>,
    error_stack: Option<String>,
) -> Result<(), OrchflowError> {
    let pool = state.pool.as_ref().ok_or_else(|| OrchflowError::DatabaseError {
        operation: "initialize".to_string(),
        reason: "SQLx pool not initialized".to_string()
    })?;
    let id = Uuid::new_v4().to_string();

    sqlx::query(
        r#"
        INSERT INTO test_results (
            id, run_id, suite_id, test_file, test_name, test_path,
            status, duration_ms, error_message, error_stack, retry_count
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        "#,
    )
    .bind(&id)
    .bind(&run_id)
    .bind(&suite_id)
    .bind(&test_file)
    .bind(&test_name)
    .bind(&test_path)
    .bind(&status)
    .bind(duration_ms)
    .bind(error_message)
    .bind(error_stack)
    .execute(pool)
    .await
    .map_err(|e| OrchflowError::DatabaseError {
        operation: "add_test_result".to_string(),
        reason: format!("Failed to add test result: {}", e)
    })?;

    Ok(())
}

/// Add test coverage data
#[tauri::command]
pub async fn add_test_coverage(
    state: State<'_, Arc<crate::SimpleStateStore>>,
    run_id: String,
    file_path: String,
    lines_total: i32,
    lines_covered: i32,
    branches_total: i32,
    branches_covered: i32,
    functions_total: i32,
    functions_covered: i32,
    statements_total: i32,
    statements_covered: i32,
    uncovered_lines: Option<Vec<i32>>,
) -> Result<(), OrchflowError> {
    let pool = state.pool.as_ref().ok_or_else(|| OrchflowError::DatabaseError {
        operation: "initialize".to_string(),
        reason: "SQLx pool not initialized".to_string()
    })?;
    let id = Uuid::new_v4().to_string();
    let uncovered_lines_json = uncovered_lines.map(|lines| serde_json::to_string(&lines).unwrap());

    sqlx::query(
        r#"
        INSERT INTO test_coverage (
            id, run_id, file_path, lines_total, lines_covered,
            branches_total, branches_covered, functions_total, functions_covered,
            statements_total, statements_covered, uncovered_lines
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&run_id)
    .bind(&file_path)
    .bind(lines_total)
    .bind(lines_covered)
    .bind(branches_total)
    .bind(branches_covered)
    .bind(functions_total)
    .bind(functions_covered)
    .bind(statements_total)
    .bind(statements_covered)
    .bind(uncovered_lines_json)
    .execute(pool)
    .await
    .map_err(|e| OrchflowError::DatabaseError {
        operation: "add_test_coverage".to_string(),
        reason: format!("Failed to add test coverage: {}", e)
    })?;

    Ok(())
}

/// Get test run history
#[tauri::command]
pub async fn get_test_history(
    state: State<'_, Arc<crate::SimpleStateStore>>,
    session_id: Option<String>,
    limit: i32,
) -> Result<Vec<TestRunSummary>, OrchflowError> {
    let pool = state.pool.as_ref().ok_or_else(|| OrchflowError::DatabaseError {
        operation: "initialize".to_string(),
        reason: "SQLx pool not initialized".to_string()
    })?;
    
    let query = if let Some(session_id) = session_id {
        sqlx::query_as::<_, TestRunSummary>(
            r#"
            SELECT * FROM test_history
            WHERE session_id = ?
            LIMIT ?
            "#,
        )
        .bind(session_id)
        .bind(limit)
    } else {
        sqlx::query_as::<_, TestRunSummary>(
            r#"
            SELECT * FROM test_history
            LIMIT ?
            "#,
        )
        .bind(limit)
    };

    query
        .fetch_all(pool)
        .await
        .map_err(|e| OrchflowError::DatabaseError {
            operation: "get_test_history".to_string(),
            reason: format!("Failed to get test history: {}", e)
        })
}

/// Get test results for a run
#[tauri::command]
pub async fn get_test_results(
    state: State<'_, Arc<crate::SimpleStateStore>>,
    run_id: String,
) -> Result<Vec<TestResult>, OrchflowError> {
    let pool = state.pool.as_ref().ok_or_else(|| OrchflowError::DatabaseError {
        operation: "initialize".to_string(),
        reason: "SQLx pool not initialized".to_string()
    })?;

    sqlx::query_as::<_, TestResult>(
        r#"
        SELECT * FROM test_results
        WHERE run_id = ?
        ORDER BY test_file, test_path
        "#,
    )
    .bind(&run_id)
    .fetch_all(pool)
    .await
    .map_err(|e| OrchflowError::DatabaseError {
        operation: "get_test_results".to_string(),
        reason: format!("Failed to get test results: {}", e)
    })
}

/// Get test coverage for a run
#[tauri::command]
pub async fn get_test_coverage(
    state: State<'_, Arc<crate::SimpleStateStore>>,
    run_id: String,
) -> Result<Vec<TestCoverage>, OrchflowError> {
    let pool = state.pool.as_ref().ok_or_else(|| OrchflowError::DatabaseError {
        operation: "initialize".to_string(),
        reason: "SQLx pool not initialized".to_string()
    })?;

    sqlx::query_as::<_, TestCoverage>(
        r#"
        SELECT * FROM test_coverage
        WHERE run_id = ?
        ORDER BY file_path
        "#,
    )
    .bind(&run_id)
    .fetch_all(pool)
    .await
    .map_err(|e| OrchflowError::DatabaseError {
        operation: "get_test_coverage".to_string(),
        reason: format!("Failed to get test coverage: {}", e)
    })
}

/// Get test failure trends
#[tauri::command]
pub async fn get_test_failure_trends(
    state: State<'_, Arc<crate::SimpleStateStore>>,
    days: i32,
) -> Result<Vec<TestFailureTrend>, OrchflowError> {
    let pool = state.pool.as_ref().ok_or_else(|| OrchflowError::DatabaseError {
        operation: "initialize".to_string(),
        reason: "SQLx pool not initialized".to_string()
    })?;

    sqlx::query_as::<_, TestFailureTrend>(
        r#"
        SELECT * FROM test_failure_trends
        WHERE test_date >= date('now', '-' || ? || ' days')
        ORDER BY test_date DESC, suite_name
        "#,
    )
    .bind(days)
    .fetch_all(pool)
    .await
    .map_err(|e| OrchflowError::DatabaseError {
        operation: "get_test_failure_trends".to_string(),
        reason: format!("Failed to get test failure trends: {}", e)
    })
}

// Test parsing utilities have been moved to src/experimental/test_parsers.rs
// They can be re-imported when ready for integration