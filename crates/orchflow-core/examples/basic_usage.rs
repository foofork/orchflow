//! Basic usage example of orchflow-core
//!
//! This example demonstrates how to:
//! - Create a manager with a mock backend
//! - Execute actions
//! - Handle events
//! - Create and manage sessions and panes

use async_trait::async_trait;
use orchflow_core::{
    state::StateManager, storage::MemoryStore, Action, Event, Manager, MuxBackend, PaneType,
};
use orchflow_mux::backend::{MuxError, Pane, PaneSize, Session, SplitType};
use std::sync::Arc;

// Simple mock backend for demonstration
struct MockBackend;

#[async_trait]
impl MuxBackend for MockBackend {
    async fn create_session(&self, name: &str) -> Result<String, MuxError> {
        println!("Creating session: {}", name);
        Ok(name.to_string())
    }

    async fn create_pane(&self, session_id: &str, split: SplitType) -> Result<String, MuxError> {
        println!(
            "Creating pane in session {} with split type: {:?}",
            session_id, split
        );
        Ok(format!("{session_id}-pane-1"))
    }

    async fn send_keys(&self, pane_id: &str, keys: &str) -> Result<(), MuxError> {
        println!("Sending keys to pane {}: {}", pane_id, keys);
        Ok(())
    }

    async fn capture_pane(&self, pane_id: &str) -> Result<String, MuxError> {
        println!("Capturing pane: {}", pane_id);
        Ok("Mock output\nLine 2\nLine 3".to_string())
    }

    async fn list_sessions(&self) -> Result<Vec<Session>, MuxError> {
        Ok(vec![])
    }

    async fn kill_session(&self, session_id: &str) -> Result<(), MuxError> {
        println!("Killing session: {}", session_id);
        Ok(())
    }

    async fn kill_pane(&self, pane_id: &str) -> Result<(), MuxError> {
        println!("Killing pane: {}", pane_id);
        Ok(())
    }

    async fn resize_pane(&self, pane_id: &str, size: PaneSize) -> Result<(), MuxError> {
        println!(
            "Resizing pane {} to {}x{}",
            pane_id, size.width, size.height
        );
        Ok(())
    }

    async fn select_pane(&self, pane_id: &str) -> Result<(), MuxError> {
        println!("Selecting pane: {}", pane_id);
        Ok(())
    }

    async fn list_panes(&self, session_id: &str) -> Result<Vec<Pane>, MuxError> {
        println!("Listing panes in session: {}", session_id);
        Ok(vec![])
    }

    async fn attach_session(&self, session_id: &str) -> Result<(), MuxError> {
        println!("Attaching to session: {}", session_id);
        Ok(())
    }

    async fn detach_session(&self, session_id: &str) -> Result<(), MuxError> {
        println!("Detaching from session: {}", session_id);
        Ok(())
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create storage and state manager
    let store = Arc::new(MemoryStore::new());
    let state_manager = StateManager::new(store);

    // Create backend
    let backend = Arc::new(MockBackend);

    // Create manager
    let manager = Arc::new(Manager::new(backend, state_manager));

    // Subscribe to events
    let mut event_rx = manager.event_tx.subscribe();

    // Spawn event listener
    tokio::spawn(async move {
        while let Ok(event) = event_rx.recv().await {
            match event {
                Event::SessionCreated { session } => {
                    println!("Event: Session created - {}", session.name);
                }
                Event::PaneCreated { pane } => {
                    println!("Event: Pane created - {:?}", pane.pane_type);
                }
                Event::CommandExecuted { pane_id, command } => {
                    println!("Event: Command executed in pane {pane_id} - {command}");
                }
                _ => {}
            }
        }
    });

    // Create a session
    println!("\n=== Creating Session ===");
    let session_result = manager
        .execute_action(Action::CreateSession {
            name: "demo-session".to_string(),
        })
        .await?;

    let session = serde_json::from_value::<orchflow_core::SessionState>(session_result)?;
    println!("Created session: {} (ID: {})", session.name, session.id);

    // Create a terminal pane
    println!("\n=== Creating Terminal Pane ===");
    let pane_result = manager
        .execute_action(Action::CreatePane {
            session_id: session.id.clone(),
            pane_type: PaneType::Terminal,
            command: Some("bash".to_string()),
            shell_type: None,
            name: Some("Main Terminal".to_string()),
        })
        .await?;

    let pane = serde_json::from_value::<orchflow_core::PaneState>(pane_result)?;
    println!(
        "Created pane: {} (ID: {})",
        pane.title.unwrap_or_default(),
        pane.id
    );

    // Send a command to the pane
    println!("\n=== Running Command ===");
    manager
        .execute_action(Action::RunCommand {
            pane_id: pane.id.clone(),
            command: "echo 'Hello from OrchFlow!'".to_string(),
        })
        .await?;

    // Get pane output
    println!("\n=== Getting Pane Output ===");
    let output_result = manager
        .execute_action(Action::GetPaneOutput {
            pane_id: pane.id.clone(),
            lines: Some(10),
        })
        .await?;

    if let Some(output) = output_result.get("output").and_then(|v| v.as_str()) {
        println!("Pane output:\n{output}");
    }

    // Resize the pane
    println!("\n=== Resizing Pane ===");
    manager
        .execute_action(Action::ResizePane {
            pane_id: pane.id.clone(),
            width: 120,
            height: 40,
        })
        .await?;

    // Clean up
    println!("\n=== Cleaning Up ===");
    manager
        .execute_action(Action::ClosePane { pane_id: pane.id })
        .await?;

    manager
        .execute_action(Action::DeleteSession {
            session_id: session.id,
        })
        .await?;

    println!("\nDemo completed!");

    Ok(())
}
