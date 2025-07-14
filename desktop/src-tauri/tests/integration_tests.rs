//! Integration tests for Manager-Frontend communication

use orchflow::simple_state_store::SimpleStateStore;
use std::sync::Arc;

#[tokio::test]
async fn test_manager_session_lifecycle() {
    // Initialize components
    let state_store = Arc::new(SimpleStateStore::new().unwrap());

    // Create manager (without AppHandle for testing)
    // Note: This is a simplified test version

    // Test session creation
    let session_name = "Test Session";
    let session = state_store
        .create_session(orchflow::simple_state_store::CreateSession {
            name: session_name.to_string(),
            tmux_session: None,
            metadata: None,
        })
        .await
        .unwrap();

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
    let session = state_store
        .create_session(orchflow::simple_state_store::CreateSession {
            name: "Pane Test Session".to_string(),
            tmux_session: None,
            metadata: None,
        })
        .await
        .unwrap();

    // Create pane
    let pane = state_store
        .create_pane(orchflow::simple_state_store::CreatePane {
            session_id: session.id.clone(),
            tmux_pane: None,
            pane_type: "terminal".to_string(),
            content: None,
            metadata: Some(r#"{"title":"Test Pane"}"#.to_string()),
        })
        .await
        .unwrap();

    assert_eq!(pane.pane_type, "terminal");
    assert_eq!(pane.session_id, session.id);

    // Test pane retrieval
    let retrieved = state_store.get_pane(&pane.id).await.unwrap();
    assert!(retrieved.is_some());

    // Test listing panes by session
    let panes = state_store.get_panes_by_session(&session.id).await.unwrap();
    assert!(!panes.is_empty());
    assert!(panes.iter().any(|p| p.id == pane.id));

    // Test pane update
    state_store
        .update_pane(
            &pane.id,
            orchflow::simple_state_store::UpdatePane {
                tmux_pane: None,
                pane_type: None,
                content: None,
                metadata: Some(r#"{"title":"Updated Pane"}"#.to_string()),
            },
        )
        .await
        .unwrap();

    let updated = state_store.get_pane(&pane.id).await.unwrap().unwrap();
    assert!(updated.metadata.is_some());
}

#[tokio::test]
async fn test_terminal_streaming_integration() {
    // This test verifies the terminal streaming functionality
    // It has been updated to work without requiring Tauri AppHandle
    
    // The terminal streaming system is tested more thoroughly in the unit tests
    // located in src/terminal_stream/testable_tests.rs which use the mock IPC channel
    
    // For integration testing, we verify that the modules are properly exposed
    // and that the basic types can be constructed
    
    use orchflow::terminal_stream::protocol::{TerminalInput, ControlMessage};
    use orchflow::terminal_stream::ipc_handler::TerminalEvent;
    use orchflow::terminal_stream::TerminalState;
    
    // Verify we can create terminal input variants
    let text_input = TerminalInput::Text("test".to_string());
    let binary_input = TerminalInput::Binary(vec![1, 2, 3]);
    let special_key_input = TerminalInput::SpecialKey("enter".to_string());
    
    // Verify the input types are constructed correctly
    match text_input {
        TerminalInput::Text(s) => assert_eq!(s, "test"),
        _ => panic!("Expected Text variant"),
    }
    match binary_input {
        TerminalInput::Binary(data) => assert_eq!(data, vec![1, 2, 3]),
        _ => panic!("Expected Binary variant"),
    }
    match special_key_input {
        TerminalInput::SpecialKey(key) => assert_eq!(key, "enter"),
        _ => panic!("Expected SpecialKey variant"),
    }
    
    // Verify we can create terminal events
    let output_event = TerminalEvent::Output {
        terminal_id: "test".to_string(),
        data: "QUJD".to_string(), // Base64 encoded "ABC"
    };
    
    let error_event = TerminalEvent::Error {
        terminal_id: "test".to_string(),
        error: "test error".to_string(),
    };
    
    // Verify the event types are constructed correctly
    match output_event {
        TerminalEvent::Output { terminal_id, data } => {
            assert_eq!(terminal_id, "test");
            assert_eq!(data, "QUJD"); // Base64 encoded "ABC"
        }
        _ => panic!("Expected Output variant"),
    }
    match error_event {
        TerminalEvent::Error { terminal_id, error } => {
            assert_eq!(terminal_id, "test");
            assert_eq!(error, "test error");
        }
        _ => panic!("Expected Error variant"),
    }
    
    // Verify we can create control messages
    let resize_msg = ControlMessage::Resize { rows: 24, cols: 80 };
    let focus_msg = ControlMessage::Focus;
    let blur_msg = ControlMessage::Blur;
    
    // Verify the control messages are constructed correctly
    match resize_msg {
        ControlMessage::Resize { rows, cols } => {
            assert_eq!(rows, 24);
            assert_eq!(cols, 80);
        }
        _ => panic!("Expected Resize variant"),
    }
    match focus_msg {
        ControlMessage::Focus => {}, // Focus has no fields
        _ => panic!("Expected Focus variant"),
    }
    match blur_msg {
        ControlMessage::Blur => {}, // Blur has no fields
        _ => panic!("Expected Blur variant"),
    }
    
    // Verify terminal state can be created
    let terminal_state = TerminalState::new("test-terminal".to_string(), 24, 80);
    assert_eq!(terminal_state.rows, 24);
    assert_eq!(terminal_state.cols, 80);
    
    // The actual terminal streaming with PTY and IPC is tested in:
    // - src/terminal_stream/testable_tests.rs (unit tests with mock IPC)
    // - src/terminal_stream/simple_tests.rs (component tests)
    
    println!("Terminal streaming integration test completed successfully");
    println!("For comprehensive terminal streaming tests, see:");
    println!("  - src/terminal_stream/testable_tests.rs");
    println!("  - src/terminal_stream/simple_tests.rs");
}

#[tokio::test]
async fn test_state_persistence() {
    use tempfile::TempDir;

    // Create temp directory for test database
    let temp_dir = TempDir::new().unwrap();
    let db_path = temp_dir.path().join("test.db");

    // Create state store with file
    let state_store = Arc::new(SimpleStateStore::new_with_file(&db_path).unwrap());

    // Create some data
    let session = state_store
        .create_session(orchflow::simple_state_store::CreateSession {
            name: "Persistent Session".to_string(),
            tmux_session: None,
            metadata: None,
        })
        .await
        .unwrap();

    let session_id = session.id.clone();

    // Drop and recreate to test persistence
    drop(state_store);

    let state_store2 = Arc::new(SimpleStateStore::new_with_file(&db_path).unwrap());

    // Verify data persisted
    let loaded_session = state_store2.get_session(&session_id).await.unwrap();
    assert!(loaded_session.is_some());
    assert_eq!(loaded_session.unwrap().name, "Persistent Session");
}

#[tokio::test]
async fn test_concurrent_operations() {
    let state_store = Arc::new(SimpleStateStore::new().unwrap());

    // Create session
    let session = state_store
        .create_session(orchflow::simple_state_store::CreateSession {
            name: "Concurrent Test".to_string(),
            tmux_session: None,
            metadata: None,
        })
        .await
        .unwrap();

    // Spawn multiple concurrent pane creations
    let mut handles = vec![];

    for i in 0..10 {
        let store = state_store.clone();
        let session_id = session.id.clone();

        let handle = tokio::spawn(async move {
            store
                .create_pane(orchflow::simple_state_store::CreatePane {
                    session_id,
                    tmux_pane: None,
                    pane_type: "terminal".to_string(),
                    content: None,
                    metadata: Some(format!(r#"{{"title":"Pane {}"}}"#, i)),
                })
                .await
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
    let panes = state_store.get_panes_by_session(&session.id).await.unwrap();
    assert_eq!(panes.len(), 10);
}

#[tokio::test]
async fn test_error_handling() {
    let state_store = Arc::new(SimpleStateStore::new().unwrap());

    // Test non-existent session
    let result = state_store.get_session("non-existent-id").await.unwrap();
    assert!(result.is_none());

    // Test creating pane with invalid session
    let result = state_store
        .create_pane(orchflow::simple_state_store::CreatePane {
            session_id: "non-existent-session".to_string(),
            tmux_pane: None,
            pane_type: "terminal".to_string(),
            content: None,
            metadata: Some(r#"{"title":"Invalid Pane"}"#.to_string()),
        })
        .await;

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
            let metadata = plugin.metadata();
            assert!(!metadata.name.is_empty());
            assert!(!metadata.version.is_empty());
        }
    }
}

#[test]
fn test_memory_usage() {
    // Simple memory check (not async)
    use std::process;
    use sysinfo::{Pid, System};

    let mut system = System::new_all();
    system.refresh_all();

    let pid = Pid::from_u32(process::id());
    let memory_kb = system
        .processes()
        .get(&pid)
        .map(|p| p.memory() / 1024)
        .unwrap_or(0);

    // Verify we're under 100MB
    assert!(
        memory_kb < 100 * 1024,
        "Memory usage {} KB exceeds 100MB limit",
        memory_kb
    );
}
