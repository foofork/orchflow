use async_trait::async_trait;
use serde_json::{json, Value};
use std::path::Path;
use regex::Regex;
use crate::manager::{Plugin, PluginMetadata, PluginContext, Event, Action, PaneType};

#[derive(Debug, Clone)]
enum TestFramework {
    Jest,
    Vitest,
    Pytest,
    RustTest,
    Go,
    Unknown,
}

#[derive(Debug, Clone, serde::Serialize)]
struct TestResult {
    name: String,
    suite: String,
    passed: bool,
    duration_ms: u64,
    error: Option<String>,
}

/// Test Runner Plugin - Detects and runs tests for various frameworks
pub struct TestRunnerPlugin {
    context: Option<PluginContext>,
    current_framework: Option<TestFramework>,
    test_pane_id: Option<String>,
    test_results: Vec<TestResult>,
    is_running: bool,
}

impl TestRunnerPlugin {
    pub fn new() -> Self {
        Self {
            context: None,
            current_framework: None,
            test_pane_id: None,
            test_results: Vec::new(),
            is_running: false,
        }
    }
    
    /// Detect test framework based on project files
    async fn detect_framework(&self, project_dir: &Path) -> TestFramework {
        // Check for package.json
        let package_json = project_dir.join("package.json");
        if package_json.exists() {
            if let Ok(content) = tokio::fs::read_to_string(&package_json).await {
                if content.contains("\"jest\"") {
                    return TestFramework::Jest;
                } else if content.contains("\"vitest\"") {
                    return TestFramework::Vitest;
                }
            }
        }
        
        // Check for Python
        if project_dir.join("pytest.ini").exists() || 
           project_dir.join("setup.py").exists() ||
           project_dir.join("pyproject.toml").exists() {
            return TestFramework::Pytest;
        }
        
        // Check for Rust
        if project_dir.join("Cargo.toml").exists() {
            return TestFramework::RustTest;
        }
        
        // Check for Go
        if project_dir.join("go.mod").exists() {
            return TestFramework::Go;
        }
        
        TestFramework::Unknown
    }
    
    /// Get the test command for the detected framework
    fn get_test_command(&self, framework: &TestFramework, args: &str) -> String {
        match framework {
            TestFramework::Jest => format!("npm test {}", args),
            TestFramework::Vitest => format!("npm run test {}", args),
            TestFramework::Pytest => format!("pytest {}", args),
            TestFramework::RustTest => format!("cargo test {}", args),
            TestFramework::Go => format!("go test ./... {}", args),
            TestFramework::Unknown => "echo 'No test framework detected'".to_string(),
        }
    }
    
    /// Parse test output based on framework
    fn parse_test_output(&mut self, output: &str, framework: &TestFramework) {
        self.test_results.clear();
        
        match framework {
            TestFramework::Jest | TestFramework::Vitest => {
                // Parse Jest/Vitest output
                let pass_regex = Regex::new(r"✓\s+(.+)\s+\((\d+)\s*ms\)").unwrap();
                let fail_regex = Regex::new(r"✗\s+(.+)\s+\((\d+)\s*ms\)").unwrap();
                
                for cap in pass_regex.captures_iter(output) {
                    self.test_results.push(TestResult {
                        name: cap[1].to_string(),
                        suite: "default".to_string(),
                        passed: true,
                        duration_ms: cap[2].parse().unwrap_or(0),
                        error: None,
                    });
                }
                
                for cap in fail_regex.captures_iter(output) {
                    self.test_results.push(TestResult {
                        name: cap[1].to_string(),
                        suite: "default".to_string(),
                        passed: false,
                        duration_ms: cap[2].parse().unwrap_or(0),
                        error: Some("Test failed".to_string()),
                    });
                }
            }
            
            TestFramework::Pytest => {
                // Parse pytest output
                let test_regex = Regex::new(r"(test_\w+).*?(PASSED|FAILED)").unwrap();
                
                for cap in test_regex.captures_iter(output) {
                    self.test_results.push(TestResult {
                        name: cap[1].to_string(),
                        suite: "pytest".to_string(),
                        passed: &cap[2] == "PASSED",
                        duration_ms: 0,
                        error: if &cap[2] == "FAILED" { 
                            Some("Test failed".to_string()) 
                        } else { 
                            None 
                        },
                    });
                }
            }
            
            TestFramework::RustTest => {
                // Parse cargo test output
                let test_regex = Regex::new(r"test\s+(\S+)\s+\.\.\.\s+(ok|FAILED)").unwrap();
                
                for cap in test_regex.captures_iter(output) {
                    self.test_results.push(TestResult {
                        name: cap[1].to_string(),
                        suite: "cargo".to_string(),
                        passed: &cap[2] == "ok",
                        duration_ms: 0,
                        error: if &cap[2] == "FAILED" { 
                            Some("Test failed".to_string()) 
                        } else { 
                            None 
                        },
                    });
                }
            }
            
            _ => {}
        }
    }
    
    /// Get test statistics
    fn get_test_stats(&self) -> Value {
        let total = self.test_results.len();
        let passed = self.test_results.iter().filter(|t| t.passed).count();
        let failed = total - passed;
        let duration = self.test_results.iter().map(|t| t.duration_ms).sum::<u64>();
        
        json!({
            "total": total,
            "passed": passed,
            "failed": failed,
            "duration_ms": duration,
            "success_rate": if total > 0 { 
                (passed as f64 / total as f64 * 100.0) as u32 
            } else { 
                0 
            }
        })
    }
}

#[async_trait]
impl Plugin for TestRunnerPlugin {
    fn id(&self) -> &str {
        "test-runner"
    }
    
    fn metadata(&self) -> PluginMetadata {
        PluginMetadata {
            name: "Test Runner".to_string(),
            version: "0.1.0".to_string(),
            author: "Orchflow Team".to_string(),
            description: "Universal test runner for multiple frameworks".to_string(),
            capabilities: vec![
                "test.detect".to_string(),
                "test.run".to_string(),
                "test.watch".to_string(),
                "test.results".to_string(),
                "test.coverage".to_string(),
            ],
        }
    }
    
    async fn init(&mut self, context: PluginContext) -> Result<(), String> {
        // Subscribe to relevant events
        context.subscribe(vec![
            "pane_output".to_string(),
            "command_completed".to_string(),
            "file_saved".to_string(),
        ]).await?;
        
        self.context = Some(context);
        Ok(())
    }
    
    async fn handle_event(&mut self, event: &Event) -> Result<(), String> {
        match event {
            Event::PaneOutput { pane_id, output, .. } => {
                // If this is our test pane, parse the output
                if Some(pane_id) == self.test_pane_id.as_ref() && self.is_running {
                    if let Some(framework) = self.current_framework.clone() {
                        self.parse_test_output(output, &framework);
                    }
                }
            }
            
            Event::CommandCompleted { pane_id, exit_code } => {
                if Some(pane_id) == self.test_pane_id.as_ref() && self.is_running {
                    self.is_running = false;
                    
                    // Emit test results
                    if let Some(ctx) = &self.context {
                        let stats = self.get_test_stats();
                        println!("Test run completed: {:?}", stats);
                    }
                }
            }
            
            Event::FileSaved { path } => {
                // Auto-run tests if watching
                if path.ends_with(".test.js") || 
                   path.ends_with(".spec.ts") || 
                   path.ends_with("_test.py") ||
                   path.contains("/tests/") {
                    // Could trigger test run here
                }
            }
            
            _ => {}
        }
        Ok(())
    }
    
    async fn handle_request(&mut self, method: &str, params: Value) -> Result<Value, String> {
        match method {
            "test.detect" => {
                let path = params["path"].as_str()
                    .unwrap_or(".");
                let framework = self.detect_framework(Path::new(path)).await;
                self.current_framework = Some(framework.clone());
                
                Ok(json!({
                    "framework": format!("{:?}", framework),
                    "detected": !matches!(framework, TestFramework::Unknown)
                }))
            }
            
            "test.run" => {
                if self.is_running {
                    return Err("Tests already running".to_string());
                }
                
                let args = params["args"].as_str().unwrap_or("");
                let pane_id = params["pane_id"].as_str();
                
                if let Some(framework) = &self.current_framework {
                    let command = self.get_test_command(framework, args);
                    
                    if let Some(ctx) = &self.context {
                        // Create or use specified pane
                        let pane_id = if let Some(id) = pane_id {
                            id.to_string()
                        } else {
                            // Create new pane for tests
                            let result = ctx.execute(Action::CreatePane {
                                session_id: "default".to_string(),
                                pane_type: PaneType::Output,
                                command: Some(command.clone()),
                                shell_type: None,
                                name: Some("Test Runner".to_string()),
                            }).await?;
                            
                            result["id"].as_str()
                                .ok_or("Failed to create test pane")?
                                .to_string()
                        };
                        
                        self.test_pane_id = Some(pane_id.clone());
                        self.is_running = true;
                        self.test_results.clear();
                        
                        // Run the test command
                        ctx.execute(Action::RunCommand {
                            pane_id,
                            command,
                        }).await?;
                        
                        Ok(json!({ 
                            "status": "started",
                            "framework": format!("{:?}", framework)
                        }))
                    } else {
                        Err("Plugin not initialized".to_string())
                    }
                } else {
                    Err("No test framework detected".to_string())
                }
            }
            
            "test.stop" => {
                if let Some(pane_id) = &self.test_pane_id {
                    if let Some(ctx) = &self.context {
                        ctx.execute(Action::ClosePane {
                            pane_id: pane_id.clone(),
                        }).await?;
                    }
                }
                
                self.is_running = false;
                self.test_pane_id = None;
                
                Ok(json!({ "status": "stopped" }))
            }
            
            "test.results" => {
                Ok(json!({
                    "results": self.test_results,
                    "stats": self.get_test_stats(),
                    "is_running": self.is_running
                }))
            }
            
            "test.watch" => {
                // In a real implementation, would set up file watching
                Ok(json!({ 
                    "status": "not_implemented",
                    "message": "Test watching coming soon"
                }))
            }
            
            _ => Err(format!("Unknown method: {}", method))
        }
    }
    
    async fn shutdown(&mut self) -> Result<(), String> {
        if self.is_running {
            self.handle_request("test.stop", json!({})).await?;
        }
        Ok(())
    }
}