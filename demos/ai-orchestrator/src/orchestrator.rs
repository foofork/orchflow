use orchflow_core::{Manager, Action, Event};
use orchflow_mux::{TmuxBackend, MuxBackend, Session, Pane, SplitType};
use orchflow_terminal::{PtyManager, TerminalStreamManager};
use std::sync::Arc;
use std::collections::HashMap;
use tokio::sync::Mutex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct OrchestrationCommand {
    pub task: String,
    pub timestamp: u64,
}

#[derive(Debug)]
pub struct WorkerInfo {
    pub pane_id: String,
    pub worker_type: String,
    pub task: String,
    pub status: WorkerStatus,
}

#[derive(Debug)]
pub enum WorkerStatus {
    Running,
    Complete,
    Failed,
}

pub struct AIOrchestrator {
    manager: Arc<Manager>,
    backend: Arc<TmuxBackend>,
    session_id: String,
    primary_pane: String,
    orchestrator_pane: String,
    worker_panes: Vec<String>,
    workers: HashMap<String, WorkerInfo>,
}

impl AIOrchestrator {
    pub async fn new() -> Result<Self, Box<dyn std::error::Error>> {
        // Create OrchFlow components with tmux backend
        let backend = Arc::new(TmuxBackend::new());
        let store = Arc::new(orchflow_core::storage::MemoryStore::new());
        let state_manager = orchflow_core::state::StateManager::new(store);
        let manager = Arc::new(Manager::new(backend.clone(), state_manager));
        
        // Create tmux session for AI orchestration
        let session_name = "ai-orchestrator";
        
        // Check if session exists, create if not
        let sessions = backend.list_sessions().await?;
        if !sessions.iter().any(|s| s.name == session_name) {
            backend.create_session(session_name).await?;
        }
        
        // Get session and root pane
        let session = backend.get_session(session_name).await?;
        let root_pane = session.panes[0].id.clone();
        
        // Create layout: Primary (33%) | Orchestrator (33%) | Workers (34%)
        // First split: Primary | Rest
        let orchestrator_pane = backend.split_pane(
            &session.id,
            &root_pane,
            SplitType::Horizontal,
            Some(33)
        ).await?;
        
        // Second split: Orchestrator | Workers
        let workers_pane = backend.split_pane(
            &session.id,
            &orchestrator_pane.id,
            SplitType::Horizontal,
            Some(50)
        ).await?;
        
        Ok(Self {
            manager,
            backend,
            session_id: session.id.clone(),
            primary_pane: root_pane,
            orchestrator_pane: orchestrator_pane.id,
            worker_panes: vec![workers_pane.id],
            workers: HashMap::new(),
        })
    }
    
    pub async fn start(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        // Start claude-code monitor in primary pane
        self.start_primary_terminal().await?;
        
        // Start orchestrator process in middle pane
        self.start_orchestrator_display().await?;
        
        // Set pane titles
        self.backend.run_command(&format!(
            "tmux select-pane -t {}:{}.0 -T 'Claude-Code (Primary)'"
        , &self.session_id, &self.primary_pane)).await?;
        
        self.backend.run_command(&format!(
            "tmux select-pane -t {}:{}.1 -T 'Orchestrator'"
        , &self.session_id, &self.orchestrator_pane)).await?;
        
        self.backend.run_command(&format!(
            "tmux select-pane -t {}:{}.2 -T 'Workers'"
        , &self.session_id, &self.worker_panes[0])).await?;
        
        // Attach to session
        println!("Attaching to tmux session: {}", self.session_id);
        self.backend.attach_session(&self.session_id).await?;
        
        Ok(())
    }
    
    async fn start_primary_terminal(&self) -> Result<(), Box<dyn std::error::Error>> {
        // Clear pane and start claude monitor
        self.backend.send_keys(&self.session_id, &self.primary_pane, "clear").await?;
        self.backend.send_keys(&self.session_id, &self.primary_pane, "Enter").await?;
        
        // Run claude-monitor.js
        let command = "node demos/ai-orchestrator/claude-monitor.js";
        self.backend.send_keys(&self.session_id, &self.primary_pane, command).await?;
        self.backend.send_keys(&self.session_id, &self.primary_pane, "Enter").await?;
        
        Ok(())
    }
    
    async fn start_orchestrator_display(&self) -> Result<(), Box<dyn std::error::Error>> {
        // Clear pane and show orchestrator status
        self.backend.send_keys(&self.session_id, &self.orchestrator_pane, "clear").await?;
        self.backend.send_keys(&self.session_id, &self.orchestrator_pane, "Enter").await?;
        
        // Run the actual orchestrator binary
        let command = "./target/debug/orchflow-orchestrator";
        self.backend.send_keys(&self.session_id, &self.orchestrator_pane, command).await?;
        self.backend.send_keys(&self.session_id, &self.orchestrator_pane, "Enter").await?;
        
        Ok(())
    }
    
    pub async fn spawn_worker(
        &mut self,
        worker_type: &str,
        task: &str,
        worker_name: &str,
    ) -> Result<String, Box<dyn std::error::Error>> {
        // Get the current workers pane (last one)
        let last_pane = self.worker_panes.last().unwrap().clone();
        
        // Split for new worker
        let new_pane = self.backend.split_pane(
            &self.session_id,
            &last_pane,
            SplitType::Vertical,
            None // Equal split
        ).await?;
        
        self.worker_panes.push(new_pane.id.clone());
        
        // Set pane title
        self.backend.run_command(&format!(
            "tmux select-pane -t {}:{} -T '{}'"
        , &self.session_id, &new_pane.id, worker_name)).await?;
        
        // Clear and show worker header
        self.backend.send_keys(&self.session_id, &new_pane.id, "clear").await?;
        self.backend.send_keys(&self.session_id, &new_pane.id, "Enter").await?;
        
        let header = format!("echo '=== Worker: {} ==='", worker_name);
        self.backend.send_keys(&self.session_id, &new_pane.id, &header).await?;
        self.backend.send_keys(&self.session_id, &new_pane.id, "Enter").await?;
        
        // Build claude-flow command based on worker type
        let command = match worker_type {
            "task" => format!("claude-flow task \"{}\"", task),
            "sparc" => format!("claude-flow sparc run developer \"{}\"", task),
            "swarm" => format!("claude-flow swarm \"{}\" --max-agents 3", task),
            _ => format!("claude-flow task \"{}\"", task),
        };
        
        // Execute claude-flow
        self.backend.send_keys(&self.session_id, &new_pane.id, &command).await?;
        self.backend.send_keys(&self.session_id, &new_pane.id, "Enter").await?;
        
        // Store worker info
        self.workers.insert(new_pane.id.clone(), WorkerInfo {
            pane_id: new_pane.id.clone(),
            worker_type: worker_type.to_string(),
            task: task.to_string(),
            status: WorkerStatus::Running,
        });
        
        Ok(new_pane.id)
    }
    
    pub async fn update_worker_status(
        &mut self,
        pane_id: &str,
        status: WorkerStatus
    ) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(worker) = self.workers.get_mut(pane_id) {
            worker.status = status;
        }
        Ok(())
    }
    
    pub fn get_worker_statuses(&self) -> Vec<(String, &WorkerInfo)> {
        self.workers.iter()
            .map(|(id, info)| (id.clone(), info))
            .collect()
    }
}