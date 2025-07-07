// Test output parsing utilities - experimental features for future integration
use sqlx::{Pool, Sqlite};
use uuid::Uuid;

/// Parse test output and store results
pub async fn parse_and_store_test_output(
    pool: &Pool<Sqlite>,
    run_id: &str,
    suite_id: &str,
    output: &str,
    framework: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    match framework {
        "jest" | "vitest" => parse_jest_output(pool, run_id, suite_id, output).await?,
        "pytest" => parse_pytest_output(pool, run_id, suite_id, output).await?,
        "cargo" => parse_cargo_test_output(pool, run_id, suite_id, output).await?,
        _ => {
            // Generic parser for common patterns
            parse_generic_output(pool, run_id, suite_id, output).await?;
        }
    }
    
    Ok(())
}

/// Parse Jest/Vitest output
async fn parse_jest_output(
    pool: &Pool<Sqlite>,
    run_id: &str,
    suite_id: &str,
    output: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    // Look for test results patterns
    let test_pattern = regex::Regex::new(r"(?m)^\s*(✓|✗|○)\s+(.+?)\s*(?:\((\d+)\s*ms\))?")?;
    let file_pattern = regex::Regex::new(r"(?m)^(?:PASS|FAIL)\s+(.+?)(?:\s+\([\d.]+s\))?")?;
    
    let mut current_file = String::new();
    
    for line in output.lines() {
        // Check for file markers
        if let Some(captures) = file_pattern.captures(line) {
            current_file = captures.get(1).map_or("", |m| m.as_str()).to_string();
        }
        
        // Check for test results
        if let Some(captures) = test_pattern.captures(line) {
            let status_symbol = captures.get(1).map_or("", |m| m.as_str());
            let test_name = captures.get(2).map_or("", |m| m.as_str());
            let duration = captures.get(3)
                .and_then(|m| m.as_str().parse::<i32>().ok());
            
            let status = match status_symbol {
                "✓" => "passed",
                "✗" => "failed",
                "○" => "skipped",
                _ => "unknown",
            };
            
            // Store test result
            let id = Uuid::new_v4().to_string();
            sqlx::query(
                r#"
                INSERT INTO test_results (
                    id, run_id, suite_id, test_file, test_name, test_path,
                    status, duration_ms, retry_count
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
                "#,
            )
            .bind(&id)
            .bind(run_id)
            .bind(suite_id)
            .bind(&current_file)
            .bind(test_name)
            .bind(test_name) // Use test_name as path for now
            .bind(status)
            .bind(duration)
            .execute(pool)
            .await?;
        }
    }
    
    Ok(())
}

/// Parse pytest output
async fn parse_pytest_output(
    pool: &Pool<Sqlite>,
    run_id: &str,
    suite_id: &str,
    output: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    // Implement pytest-specific parsing
    // Look for patterns like:
    // test_file.py::test_name PASSED
    // test_file.py::test_name FAILED
    
    let test_pattern = regex::Regex::new(r"(?m)^(.+?)::(.+?)\s+(PASSED|FAILED|SKIPPED|XFAIL|XPASS)")?;
    
    for captures in test_pattern.captures_iter(output) {
        let test_file = captures.get(1).map_or("", |m| m.as_str());
        let test_name = captures.get(2).map_or("", |m| m.as_str());
        let status_str = captures.get(3).map_or("", |m| m.as_str());
        
        let status = match status_str {
            "PASSED" | "XPASS" => "passed",
            "FAILED" | "XFAIL" => "failed",
            "SKIPPED" => "skipped",
            _ => "unknown",
        };
        
        // Store test result
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            r#"
            INSERT INTO test_results (
                id, run_id, suite_id, test_file, test_name, test_path,
                status, retry_count
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 0)
            "#,
        )
        .bind(&id)
        .bind(run_id)
        .bind(suite_id)
        .bind(test_file)
        .bind(test_name)
        .bind(format!("{}::{}", test_file, test_name))
        .bind(status)
        .execute(pool)
        .await?;
    }
    
    Ok(())
}

/// Parse cargo test output
async fn parse_cargo_test_output(
    pool: &Pool<Sqlite>,
    run_id: &str,
    suite_id: &str,
    output: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    // Look for patterns like:
    // test tests::test_name ... ok
    // test tests::test_name ... FAILED
    
    let test_pattern = regex::Regex::new(r"(?m)^test\s+(.+?)\s+\.\.\.\s+(ok|FAILED|ignored)")?;
    
    for captures in test_pattern.captures_iter(output) {
        let test_path = captures.get(1).map_or("", |m| m.as_str());
        let status_str = captures.get(2).map_or("", |m| m.as_str());
        
        let status = match status_str {
            "ok" => "passed",
            "FAILED" => "failed",
            "ignored" => "skipped",
            _ => "unknown",
        };
        
        // Extract file and test name from path
        let parts: Vec<&str> = test_path.split("::").collect();
        let test_file = parts.get(0).unwrap_or(&"unknown");
        let test_name = parts.last().unwrap_or(&test_path);
        
        // Store test result
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            r#"
            INSERT INTO test_results (
                id, run_id, suite_id, test_file, test_name, test_path,
                status, retry_count
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 0)
            "#,
        )
        .bind(&id)
        .bind(run_id)
        .bind(suite_id)
        .bind(test_file)
        .bind(test_name)
        .bind(test_path)
        .bind(status)
        .execute(pool)
        .await?;
    }
    
    Ok(())
}

/// Generic test output parser
async fn parse_generic_output(
    pool: &Pool<Sqlite>,
    run_id: &str,
    _suite_id: &str,
    output: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    // Look for common patterns across different frameworks
    // This is a fallback parser
    
    // Count basic statistics
    let passed_count = output.matches("PASS").count() + 
                      output.matches("✓").count() + 
                      output.matches("ok").count();
    
    let failed_count = output.matches("FAIL").count() + 
                      output.matches("✗").count() + 
                      output.matches("ERROR").count();
    
    // Update run statistics
    sqlx::query(
        r#"
        UPDATE test_runs
        SET total_tests = ?, passed_tests = ?, failed_tests = ?
        WHERE id = ?
        "#,
    )
    .bind((passed_count + failed_count) as i32)
    .bind(passed_count as i32)
    .bind(failed_count as i32)
    .bind(run_id)
    .execute(pool)
    .await?;
    
    Ok(())
}