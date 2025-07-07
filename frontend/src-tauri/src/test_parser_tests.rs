#[cfg(test)]
mod test_parser_tests {
    use crate::test_parser_commands::*;
    
    #[test]
    fn test_parse_jest_output() {
        let output = r#"
 PASS  src/components/Button.test.js
  ✓ renders correctly (15 ms)
  ✓ handles click events (8 ms)
  ✗ displays error state (23 ms)
  ○ skipped test

Test Suites: 1 passed, 1 total
"#;
        
        let results = parse_jest_vitest_output(output);
        assert_eq!(results.len(), 4); // Including skipped test
        
        // Check passed tests
        let passed: Vec<_> = results.iter().filter(|r| matches!(r.status, TestStatus::Passed)).collect();
        assert_eq!(passed.len(), 2);
        assert_eq!(passed[0].test_name, "renders correctly");
        assert_eq!(passed[0].duration_ms, Some(15));
        
        // Check failed test
        let failed: Vec<_> = results.iter().filter(|r| matches!(r.status, TestStatus::Failed)).collect();
        assert_eq!(failed.len(), 1);
        assert_eq!(failed[0].test_name, "displays error state");
        assert_eq!(failed[0].duration_ms, Some(23));
    }
    
    #[test]
    fn test_parse_pytest_output() {
        let output = r#"
tests/test_example.py::test_addition PASSED
tests/test_example.py::test_subtraction FAILED
tests/test_math.py::test_multiply PASSED
tests/test_math.py::test_divide SKIPPED
"#;
        
        let results = parse_pytest_output(output);
        assert_eq!(results.len(), 4);
        
        // Check file paths
        assert_eq!(results[0].test_file, "tests/test_example.py");
        assert_eq!(results[0].test_name, "test_addition");
        assert!(matches!(results[0].status, TestStatus::Passed));
        
        assert_eq!(results[1].test_name, "test_subtraction");
        assert!(matches!(results[1].status, TestStatus::Failed));
        
        assert_eq!(results[3].test_name, "test_divide");
        assert!(matches!(results[3].status, TestStatus::Skipped));
    }
    
    #[test]
    fn test_parse_cargo_test_output() {
        let output = r#"
test tests::test_basic ... ok
test module::tests::test_advanced ... FAILED
test integration::test_full ... ignored

test result: FAILED. 1 passed; 1 failed; 1 ignored
"#;
        
        let results = parse_cargo_test_output(output);
        assert_eq!(results.len(), 3);
        
        // Check test paths
        assert_eq!(results[0].test_path, "tests::test_basic");
        assert!(matches!(results[0].status, TestStatus::Passed));
        
        assert_eq!(results[1].test_path, "module::tests::test_advanced");
        assert!(matches!(results[1].status, TestStatus::Failed));
        
        assert_eq!(results[2].test_path, "integration::test_full");
        assert!(matches!(results[2].status, TestStatus::Skipped));
    }
    
    #[test]
    fn test_parse_go_test_output() {
        let output = r#"
ok      github.com/user/project/pkg1    0.123s
--- PASS: TestFunction1 (0.01s)
--- FAIL: TestFunction2 (0.05s)
--- SKIP: TestFunction3 (0.00s)
FAIL    github.com/user/project/pkg2    0.234s
"#;
        
        let results = parse_go_test_output(output);
        assert_eq!(results.len(), 3);
        
        assert_eq!(results[0].test_name, "TestFunction1");
        assert!(matches!(results[0].status, TestStatus::Passed));
        assert_eq!(results[0].duration_ms, Some(10));
        
        assert_eq!(results[1].test_name, "TestFunction2");
        assert!(matches!(results[1].status, TestStatus::Failed));
        assert_eq!(results[1].duration_ms, Some(50));
        
        assert_eq!(results[2].test_name, "TestFunction3");
        assert!(matches!(results[2].status, TestStatus::Skipped));
    }
    
    #[test]
    fn test_test_status_to_string() {
        assert_eq!(TestStatus::Passed.to_string(), "passed");
        assert_eq!(TestStatus::Failed.to_string(), "failed");
        assert_eq!(TestStatus::Skipped.to_string(), "skipped");
        assert_eq!(TestStatus::Pending.to_string(), "pending");
    }
}