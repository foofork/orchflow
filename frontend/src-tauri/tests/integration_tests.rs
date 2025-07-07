//! Integration tests for Manager-Frontend communication

use orchflow::manager::Manager;
use orchflow::simple_state_store::SimpleStateStore;
use orchflow::mux_backend;
use std::sync::Arc;
use tokio::time::{sleep, Duration};

#[tokio::test]
async fn test_manager_session_lifecycle() {
    // Initialize components
    let state_store = Arc::new(SimpleStateStore::new().unwrap());
    let mux_backend = mux_backend::create_mux_backend();
    
    // Create manager (without AppHandle for testing)
    // Note: This is a simplified test version
    
    // Test session creation
    let session_name = "Test Session";
    let session = state_store.create_session(orchflow::simple_state_store::CreateSession {
        name: session_name.to_string(),
        ..Default::default()
    }).await.unwrap();
    
    assert_eq!(session.name, session_name);
    assert!(!session.id.is_empty());
    
    // Test session retrieval
    let retrieved = state_store.get_session(&session.id).await.unwrap();
    assert!(retrieved.is_some());
    assert_eq!(retrieved.unwrap().name, session_name);
    
    // Test session listing
    let sessions = state_store.list_sessions().await.unwrap();
    assert!(!sessions.is_empty());
    assert!(sessions.iter().any(|s| s.id == session.id));
    
    // Test session deletion
    state_store.delete_session(&session.id).await.unwrap();
    let deleted = state_store.get_session(&session.id).await.unwrap();
    assert!(deleted.is_none());
}

#[tokio::test]
async fn test_manager_pane_operations() {
    let state_store = Arc::new(SimpleStateStore::new().unwrap());
    
    // Create session first
    let session = state_store.create_session(orchflow::simple_state_store::CreateSession {
        name: "Pane Test Session".to_string(),
        ..Default::default()
    }).await.unwrap();
    
    // Create pane
    let pane = state_store.create_pane(orchflow::simple_state_store::CreatePane {
        title: "Test Pane".to_string(),
        pane_type: orchflow::simple_state_store::PaneType::Terminal,
        session_id: session.id.clone(),
        parent_id: None,
        direction: None,
        size: None,
        metadata: None,
    }).await.unwrap();
    
    assert_eq!(pane.title, "Test Pane");
    assert_eq!(pane.session_id, session.id);
    
    // Test pane retrieval
    let retrieved = state_store.get_pane(&pane.id).await.unwrap();
    assert!(retrieved.is_some());
    
    // Test listing panes by session
    let panes = state_store.list_panes_by_session(&session.id).await.unwrap();
    assert!(!panes.is_empty());
    assert!(panes.iter().any(|p| p.id == pane.id));
    
    // Test pane update
    state_store.update_pane(&pane.id, orchflow::simple_state_store::UpdatePane {
        title: Some("Updated Pane".to_string()),
        ..Default::default()
    }).await.unwrap();
    
    let updated = state_store.get_pane(&pane.id).await.unwrap().unwrap();
    assert_eq!(updated.title, "Updated Pane");
}

#[tokio::test]
async fn test_terminal_streaming_integration() {
    use orchflow::terminal_stream::{TerminalStreamManager, CreateTerminalOptions, TerminalInput};
    
    let manager = TerminalStreamManager::new();
    
    // Create terminal
    let options = CreateTerminalOptions {
        shell: Some("sh".to_string()),
        cwd: None,
        env: None,
        rows: 24,
        cols: 80,
    };
    
    let terminal_id = manager.create_terminal(options).await.unwrap();
    
    // Send command
    let input = TerminalInput {
        data: "echo 'Integration test'\n".to_string(),
    };
    
    manager.send_input(&terminal_id, input).await.unwrap();
    
    // Wait for output
    sleep(Duration::from_millis(100)).await;
    
    // Verify output
    let buffer = manager.get_buffer(&terminal_id).await.unwrap();
    assert!(buffer.contains("Integration test"));
    
    // Clean up
    manager.close_terminal(&terminal_id).await.unwrap();
}

#[tokio::test]
async fn test_state_persistence() {
    use tempfile::TempDir;
    
    // Create temp directory for test database
    let temp_dir = TempDir::new().unwrap();
    let db_path = temp_dir.path().join("test.db");
    
    // Create state store with file
    let state_store = Arc::new(
        SimpleStateStore::new_with_file(&db_path).unwrap()
    );
    
    // Create some data
    let session = state_store.create_session(orchflow::simple_state_store::CreateSession {
        name: "Persistent Session".to_string(),
        ..Default::default()
    }).await.unwrap();
    
    let session_id = session.id.clone();
    
    // Drop and recreate to test persistence
    drop(state_store);
    
    let state_store2 = Arc::new(
        SimpleStateStore::new_with_file(&db_path).unwrap()
    );
    
    // Verify data persisted
    let loaded_session = state_store2.get_session(&session_id).await.unwrap();
    assert!(loaded_session.is_some());
    assert_eq!(loaded_session.unwrap().name, "Persistent Session");
}

#[tokio::test]
async fn test_concurrent_operations() {
    let state_store = Arc::new(SimpleStateStore::new().unwrap());
    
    // Create session
    let session = state_store.create_session(orchflow::simple_state_store::CreateSession {
        name: "Concurrent Test".to_string(),
        ..Default::default()
    }).await.unwrap();
    
    // Spawn multiple concurrent pane creations
    let mut handles = vec![];
    
    for i in 0..10 {
        let store = state_store.clone();
        let session_id = session.id.clone();
        
        let handle = tokio::spawn(async move {
            store.create_pane(orchflow::simple_state_store::CreatePane {
                title: format!("Pane {}", i),
                pane_type: orchflow::simple_state_store::PaneType::Terminal,
                session_id,
                parent_id: None,
                direction: None,
                size: None,
                metadata: None,
            }).await
        });
        
        handles.push(handle);
    }
    
    // Wait for all to complete
    let results: Vec<_> = futures::future::join_all(handles).await;
    
    // Verify all succeeded
    for result in results {
        assert!(result.is_ok());
        assert!(result.unwrap().is_ok());
    }
    
    // Verify all panes created
    let panes = state_store.list_panes_by_session(&session.id).await.unwrap();
    assert_eq!(panes.len(), 10);
}

#[tokio::test]
async fn test_error_handling() {
    let state_store = Arc::new(SimpleStateStore::new().unwrap());
    
    // Test non-existent session
    let result = state_store.get_session("non-existent-id").await.unwrap();
    assert!(result.is_none());
    
    // Test creating pane with invalid session
    let result = state_store.create_pane(orchflow::simple_state_store::CreatePane {
        title: "Invalid Pane".to_string(),
        pane_type: orchflow::simple_state_store::PaneType::Terminal,
        session_id: "non-existent-session".to_string(),
        parent_id: None,
        direction: None,
        size: None,
        metadata: None,
    }).await;
    
    // Should fail due to foreign key constraint
    assert!(result.is_err());
}

#[tokio::test]
async fn test_plugin_lifecycle() {
    use orchflow::plugins::PluginRegistry;
    
    let registry = PluginRegistry::new();
    
    // Test plugin discovery
    let plugin_ids = ["terminal", "session", "file-browser"];
    
    for plugin_id in &plugin_ids {
        let plugin = registry.create(plugin_id);
        assert!(plugin.is_some(), "Plugin {} should exist", plugin_id);
        
        if let Some(plugin) = plugin {
            assert_eq!(plugin.id(), *plugin_id);
            assert!(!plugin.name().is_empty());
            assert!(!plugin.version().is_empty());
        }
    }
}

#[test]
fn test_memory_usage() {
    // Simple memory check (not async)
    use sysinfo::{System, Pid};
    use std::process;
    
    let mut system = System::new_all();
    system.refresh_all();
    
    let pid = Pid::from_u32(process::id());
    let memory_kb = system.processes().get(&pid)
        .map(|p| p.memory() / 1024)
        .unwrap_or(0);
    
    // Verify we're under 100MB
    assert!(memory_kb < 100 * 1024, "Memory usage {} KB exceeds 100MB limit", memory_kb);
}