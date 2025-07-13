// Tests for test_results_v2 module
// Comprehensive test coverage for SimpleStateStore-based test management

#[cfg(test)]
mod tests {
    use super::super::test_results_v2::*;
    use crate::error::OrchflowError;
    use crate::simple_state_store::SimpleStateStore;
    use chrono::Utc;
    use std::sync::Arc;
    use uuid::Uuid;

    async fn setup_test_store() -> Arc<SimpleStateStore> {
        Arc::new(SimpleStateStore::new().expect("Failed to create test store"))
    }

    fn create_test_suite() -> TestSuite {
        TestSuite {
            id: Uuid::new_v4().to_string(),
            session_id: Uuid::new_v4().to_string(),
            name: "Test Suite".to_string(),
            project_path: "/test/path".to_string(),
            test_framework: "jest".to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    fn create_test_run(suite_id: String) -> TestRun {
        TestRun {
            id: Uuid::new_v4().to_string(),
            suite_id,
            session_id: Uuid::new_v4().to_string(),
            command: "npm test".to_string(),
            status: TestRunStatus::Running,
            total_tests: 0,
            passed_tests: 0,
            failed_tests: 0,
            skipped_tests: 0,
            duration_ms: None,
            coverage_percent: None,
            error_output: None,
            started_at: Utc::now(),
            completed_at: None,
            metadata: None,
        }
    }

    fn create_test_result(run_id: String, suite_id: String) -> TestResult {
        TestResult {
            id: Uuid::new_v4().to_string(),
            run_id,
            suite_id,
            test_file: "test.spec.js".to_string(),
            test_name: "should pass".to_string(),
            test_path: "describe > it".to_string(),
            status: TestStatus::Passed,
            duration_ms: Some(100),
            error_message: None,
            error_stack: None,
            assertion_results: None,
            output: None,
            metadata: None,
        }
    }

    #[tokio::test]
    async fn test_create_and_get_test_suite() {
        let store = setup_test_store().await;
        let manager = TestResultsManager::new(store);
        let suite = create_test_suite();
        let suite_id = suite.id.clone();

        // Test creation
        let created = manager.create_test_suite(suite.clone()).await;
        assert!(created.is_ok());
        assert_eq!(created.unwrap().id, suite.id);

        // Test retrieval
        let retrieved = manager.get_test_suite(&suite_id).await;
        assert!(retrieved.is_ok());
        assert!(retrieved.unwrap().is_some());
    }

    #[tokio::test]
    async fn test_get_nonexistent_test_suite() {
        let store = setup_test_store().await;
        let manager = TestResultsManager::new(store);

        let result = manager.get_test_suite("nonexistent").await;
        assert!(result.is_ok());
        assert!(result.unwrap().is_none());
    }

    #[tokio::test]
    async fn test_list_test_suites_by_session() {
        let store = setup_test_store().await;
        let manager = TestResultsManager::new(store);
        let session_id = Uuid::new_v4().to_string();

        // Create multiple suites for the same session
        let mut suite1 = create_test_suite();
        suite1.session_id = session_id.clone();
        let mut suite2 = create_test_suite();
        suite2.session_id = session_id.clone();

        // Create a suite for a different session
        let suite3 = create_test_suite();

        manager.create_test_suite(suite1).await.unwrap();
        manager.create_test_suite(suite2).await.unwrap();
        manager.create_test_suite(suite3).await.unwrap();

        // List suites for specific session
        let suites = manager.list_test_suites(&session_id).await.unwrap();
        assert_eq!(suites.len(), 2);
        assert!(suites.iter().all(|s| s.session_id == session_id));
    }

    #[tokio::test]
    async fn test_create_and_get_test_run() {
        let store = setup_test_store().await;
        let manager = TestResultsManager::new(store);
        let suite = create_test_suite();
        let suite_id = suite.id.clone();

        manager.create_test_suite(suite).await.unwrap();

        let run = create_test_run(suite_id);
        let run_id = run.id.clone();

        // Test creation
        let created = manager.create_test_run(run.clone()).await;
        assert!(created.is_ok());
        assert_eq!(created.unwrap().id, run.id);

        // Test retrieval
        let retrieved = manager.get_test_run(&run_id).await;
        assert!(retrieved.is_ok());
        assert!(retrieved.unwrap().is_some());
    }

    #[tokio::test]
    async fn test_update_test_run() {
        let store = setup_test_store().await;
        let manager = TestResultsManager::new(store);
        let suite = create_test_suite();

        manager.create_test_suite(suite.clone()).await.unwrap();

        let mut run = create_test_run(suite.id);
        manager.create_test_run(run.clone()).await.unwrap();

        // Update the run
        run.status = TestRunStatus::Passed;
        run.total_tests = 10;
        run.passed_tests = 8;
        run.failed_tests = 2;
        run.duration_ms = Some(5000);
        run.completed_at = Some(Utc::now());

        let updated = manager.update_test_run(run.clone()).await;
        assert!(updated.is_ok());

        // Verify update
        let retrieved = manager.get_test_run(&run.id).await.unwrap().unwrap();
        assert_eq!(retrieved.total_tests, 10);
        assert_eq!(retrieved.passed_tests, 8);
        assert_eq!(retrieved.failed_tests, 2);
        assert!(matches!(retrieved.status, TestRunStatus::Passed));
    }

    #[tokio::test]
    async fn test_create_and_get_test_results() {
        let store = setup_test_store().await;
        let manager = TestResultsManager::new(store);
        let suite = create_test_suite();
        let run = create_test_run(suite.id.clone());

        manager.create_test_suite(suite.clone()).await.unwrap();
        manager.create_test_run(run.clone()).await.unwrap();

        // Create multiple test results for the run
        let result1 = create_test_result(run.id.clone(), suite.id.clone());
        let mut result2 = create_test_result(run.id.clone(), suite.id.clone());
        result2.status = TestStatus::Failed;
        result2.error_message = Some("Assertion failed".to_string());

        manager.create_test_result(result1).await.unwrap();
        manager.create_test_result(result2).await.unwrap();

        // Get results for run
        let results = manager.get_test_results_for_run(&run.id).await.unwrap();
        assert_eq!(results.len(), 2);
        assert!(results
            .iter()
            .any(|r| matches!(r.status, TestStatus::Passed)));
        assert!(results
            .iter()
            .any(|r| matches!(r.status, TestStatus::Failed)));
    }

    #[tokio::test]
    async fn test_get_test_run_summaries() {
        let store = setup_test_store().await;
        let manager = TestResultsManager::new(store);
        let session_id = Uuid::new_v4().to_string();

        // Create suite and run
        let mut suite = create_test_suite();
        suite.session_id = session_id.clone();
        manager.create_test_suite(suite.clone()).await.unwrap();

        let mut run = create_test_run(suite.id);
        run.status = TestRunStatus::Passed;
        run.total_tests = 5;
        run.passed_tests = 5;
        manager.create_test_run(run).await.unwrap();

        // Get summaries
        let summaries = manager.get_test_run_summaries(&session_id).await.unwrap();
        assert_eq!(summaries.len(), 1);
        assert_eq!(summaries[0].total_tests, 5);
        assert_eq!(summaries[0].passed_tests, 5);
        assert_eq!(summaries[0].suite_name, suite.name);
    }

    #[tokio::test]
    async fn test_error_serialization() {
        let store = setup_test_store().await;
        let manager = TestResultsManager::new(store);

        // Test with invalid JSON (this should not happen in practice but tests error handling)
        let mut suite = create_test_suite();
        suite.name = String::from_utf8(vec![0, 159, 146, 150]).unwrap_or_default(); // Invalid UTF-8 chars

        // This should still work as serde_json can handle most strings
        let result = manager.create_test_suite(suite).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_concurrent_operations() {
        let store = setup_test_store().await;
        let manager = Arc::new(TestResultsManager::new(store));

        let session_id = Uuid::new_v4().to_string();
        let mut handles = vec![];

        // Create multiple suites concurrently
        for i in 0..5 {
            let manager = manager.clone();
            let session_id = session_id.clone();
            let handle = tokio::spawn(async move {
                let mut suite = create_test_suite();
                suite.session_id = session_id;
                suite.name = format!("Suite {}", i);
                manager.create_test_suite(suite).await
            });
            handles.push(handle);
        }

        // Wait for all operations to complete
        for handle in handles {
            let result = handle.await.unwrap();
            assert!(result.is_ok());
        }

        // Verify all suites were created
        let suites = manager.list_test_suites(&session_id).await.unwrap();
        assert_eq!(suites.len(), 5);
    }

    #[tokio::test]
    async fn test_error_handling_with_typed_errors() {
        let store = setup_test_store().await;
        let manager = TestResultsManager::new(store);

        // Test getting non-existent run
        let result = manager.get_test_run("nonexistent").await;
        assert!(result.is_ok());
        assert!(result.unwrap().is_none());

        // Test getting results for non-existent run
        let results = manager.get_test_results_for_run("nonexistent").await;
        assert!(results.is_ok());
        assert!(results.unwrap().is_empty());
    }
}
