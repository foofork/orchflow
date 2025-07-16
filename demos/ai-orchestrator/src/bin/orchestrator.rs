use tokio::net::UnixListener;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use std::sync::Arc;
use tokio::sync::Mutex;
use serde::{Deserialize, Serialize};
use orchflow_ai_demo::{AIOrchestrator, OrchestrationCommand};

#[derive(Debug, Serialize, Deserialize)]
struct WorkerPlan {
    name: String,
    worker_type: String,
    task: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("=== OrchFlow AI Orchestrator ===");
    println!("[LISTENING] Waiting for tasks from claude-code...\n");
    
    // Clean up old socket
    let _ = std::fs::remove_file("/tmp/orchestrator.sock");
    
    // Listen on Unix socket for commands from claude-code
    let listener = UnixListener::bind("/tmp/orchestrator.sock")?;
    
    // Create shared orchestrator (will be created on first command)
    let orchestrator: Arc<Mutex<Option<AIOrchestrator>>> = Arc::new(Mutex::new(None));
    
    loop {
        let (mut stream, _) = listener.accept().await?;
        let orchestrator = orchestrator.clone();
        
        tokio::spawn(async move {
            let mut buf = vec![0; 4096];
            match stream.read(&mut buf).await {
                Ok(n) => {
                    if let Ok(command) = serde_json::from_slice::<OrchestrationCommand>(&buf[..n]) {
                        println!("[RECEIVED] Task: {}", command.task);
                        
                        // Initialize orchestrator if needed
                        let mut orch_lock = orchestrator.lock().await;
                        if orch_lock.is_none() {
                            match AIOrchestrator::new().await {
                                Ok(orch) => {
                                    *orch_lock = Some(orch);
                                }
                                Err(e) => {
                                    println!("[ERROR] Failed to create orchestrator: {}", e);
                                    return;
                                }
                            }
                        }
                        
                        if let Some(orch) = orch_lock.as_mut() {
                            // Plan workers based on task
                            let workers = plan_workers(&command.task);
                            println!("[PLANNING] Spawning {} workers:", workers.len());
                            for w in &workers {
                                println!("  - {}: {} ({})", w.name, w.worker_type, w.task);
                            }
                            
                            // Spawn workers in tmux panes
                            for worker in workers {
                                match orch.spawn_worker(&worker.worker_type, &worker.task, &worker.name).await {
                                    Ok(pane_id) => {
                                        println!("[SPAWNED] {} in pane {}", worker.name, pane_id);
                                    }
                                    Err(e) => {
                                        println!("[ERROR] Failed to spawn {}: {}", worker.name, e);
                                    }
                                }
                            }
                            
                            println!("\n[MONITORING] Workers are running in tmux panes");
                        }
                    }
                }
                Err(e) => println!("[ERROR] Failed to read command: {}", e),
            }
        });
    }
}

fn plan_workers(task: &str) -> Vec<WorkerPlan> {
    let mut workers = vec![];
    let task_lower = task.to_lowercase();
    
    // Analyze task and determine what workers we need
    if task_lower.contains("api") || task_lower.contains("rest") {
        workers.push(WorkerPlan {
            name: "API-Designer".to_string(),
            worker_type: "sparc".to_string(),
            task: format!("Design REST API architecture for: {}", task),
        });
        workers.push(WorkerPlan {
            name: "API-Builder".to_string(),
            worker_type: "task".to_string(),
            task: format!("Implement REST API endpoints for: {}", task),
        });
    }
    
    if task_lower.contains("auth") || task_lower.contains("user") {
        workers.push(WorkerPlan {
            name: "Auth-System".to_string(),
            worker_type: "swarm".to_string(),
            task: format!("Build complete authentication system for: {}", task),
        });
    }
    
    if task_lower.contains("frontend") || task_lower.contains("ui") {
        workers.push(WorkerPlan {
            name: "Frontend-Dev".to_string(),
            worker_type: "sparc".to_string(),
            task: format!("Create frontend interface for: {}", task),
        });
    }
    
    if task_lower.contains("database") || task_lower.contains("data") {
        workers.push(WorkerPlan {
            name: "DB-Specialist".to_string(),
            worker_type: "task".to_string(),
            task: format!("Design and implement database schema for: {}", task),
        });
    }
    
    // Always add a tester if we have other workers
    if !workers.is_empty() {
        workers.push(WorkerPlan {
            name: "Test-Engineer".to_string(),
            worker_type: "sparc".to_string(),
            task: format!("Write comprehensive tests for: {}", task),
        });
    }
    
    // Default worker if nothing specific matched
    if workers.is_empty() {
        workers.push(WorkerPlan {
            name: "General-Dev".to_string(),
            worker_type: "task".to_string(),
            task: task.to_string(),
        });
    }
    
    workers
}