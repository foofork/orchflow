#[cfg(test)]
mod unit_tests {
    use crate::{
        backend::MuxBackend, storage::MemoryStore, Action, Event, FileManager, Manager,
        OrchflowError, PaneType, Plugin, PluginContext, Result, ShellType, StateManager,
    };
    use async_trait::async_trait;
    use orchflow_mux::backend::{MuxError, Pane, PaneSize, Session, SplitType};
    use std::sync::Arc;

    // Mock backend for testing
    struct MockBackend;

    #[async_trait]
    impl MuxBackend for MockBackend {
        async fn create_session(&self, name: &str) -> std::result::Result<String, MuxError> {
            Ok(name.to_string())
        }

        async fn create_pane(
            &self,
            session_id: &str,
            _split: SplitType,
        ) -> std::result::Result<String, MuxError> {
            Ok(format!("{session_id}-pane-1"))
        }

        async fn send_keys(
            &self,
            _pane_id: &str,
            _keys: &str,
        ) -> std::result::Result<(), MuxError> {
            Ok(())
        }

        async fn capture_pane(&self, _pane_id: &str) -> std::result::Result<String, MuxError> {
            Ok("test output".to_string())
        }

        async fn list_sessions(&self) -> std::result::Result<Vec<Session>, MuxError> {
            Ok(vec![])
        }

        async fn kill_session(&self, _session_id: &str) -> std::result::Result<(), MuxError> {
            Ok(())
        }

        async fn kill_pane(&self, _pane_id: &str) -> std::result::Result<(), MuxError> {
            Ok(())
        }

        async fn resize_pane(
            &self,
            _pane_id: &str,
            _size: PaneSize,
        ) -> std::result::Result<(), MuxError> {
            Ok(())
        }

        async fn select_pane(&self, _pane_id: &str) -> std::result::Result<(), MuxError> {
            Ok(())
        }

        async fn list_panes(&self, _session_id: &str) -> std::result::Result<Vec<Pane>, MuxError> {
            Ok(vec![])
        }

        async fn attach_session(&self, _session_id: &str) -> std::result::Result<(), MuxError> {
            Ok(())
        }

        async fn detach_session(&self, _session_id: &str) -> std::result::Result<(), MuxError> {
            Ok(())
        }
    }

    // Mock file manager for testing
    struct MockFileManager;

    #[async_trait]
    impl FileManager for MockFileManager {
        async fn create_file(&self, path: &str, _content: Option<&str>) -> Result<()> {
            if path.contains("error") {
                Err(OrchflowError::General("Mock error".to_string()))
            } else {
                Ok(())
            }
        }

        async fn read_file(&self, path: &str) -> Result<String> {
            if path.contains("error") {
                Err(OrchflowError::General("Mock error".to_string()))
            } else {
                Ok(format!("Content of {path}"))
            }
        }

        async fn delete_file(&self, _path: &str) -> Result<()> {
            Ok(())
        }

        async fn rename_file(&self, _old_path: &str, _new_path: &str) -> Result<()> {
            Ok(())
        }

        async fn copy_file(&self, _source: &str, _destination: &str) -> Result<()> {
            Ok(())
        }

        async fn move_file(&self, _source: &str, _destination: &str) -> Result<()> {
            Ok(())
        }

        async fn create_directory(&self, _path: &str) -> Result<()> {
            Ok(())
        }

        async fn list_directory(&self, _path: &str) -> Result<Vec<String>> {
            Ok(vec!["file1.txt".to_string(), "file2.txt".to_string()])
        }
    }

    // Test plugin
    struct TestPlugin {
        id: String,
        events: tokio::sync::Mutex<Vec<Event>>,
    }

    impl TestPlugin {
        fn new(id: &str) -> Self {
            Self {
                id: id.to_string(),
                events: tokio::sync::Mutex::new(Vec::new()),
            }
        }
    }

    #[async_trait]
    impl Plugin for TestPlugin {
        fn id(&self) -> &str {
            &self.id
        }

        fn metadata(&self) -> crate::PluginMetadata {
            crate::PluginMetadata {
                name: "Test Plugin".to_string(),
                version: "1.0.0".to_string(),
                description: "Test plugin for unit tests".to_string(),
                author: "Test Author".to_string(),
                capabilities: vec![],
            }
        }

        async fn init(&mut self, _context: PluginContext) -> std::result::Result<(), String> {
            Ok(())
        }

        async fn handle_event(&mut self, event: &Event) -> std::result::Result<(), String> {
            let mut events = self.events.lock().await;
            events.push(event.clone());
            Ok(())
        }

        async fn shutdown(&mut self) -> std::result::Result<(), String> {
            Ok(())
        }
    }

    #[tokio::test]
    async fn test_state_manager_sessions() {
        let store = Arc::new(MemoryStore::new());
        let state_manager = StateManager::new(store);

        // Create session
        let session = state_manager
            .create_session("test-session".to_string())
            .await
            .unwrap();
        assert_eq!(session.name, "test-session");
        assert!(session.pane_ids.is_empty());

        // Get session
        let retrieved = state_manager.get_session(&session.id).await;
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().name, "test-session");

        // List sessions
        let sessions = state_manager.list_sessions().await;
        assert_eq!(sessions.len(), 1);

        // Delete session
        state_manager.delete_session(&session.id).await.unwrap();
        let sessions = state_manager.list_sessions().await;
        assert!(sessions.is_empty());
    }

    #[tokio::test]
    async fn test_state_manager_panes() {
        let store = Arc::new(MemoryStore::new());
        let state_manager = StateManager::new(store);

        // Create session first
        let session = state_manager
            .create_session("test-session".to_string())
            .await
            .unwrap();

        // Create pane
        let pane = crate::PaneState {
            id: "test-pane".to_string(),
            session_id: session.id.clone(),
            pane_type: PaneType::Terminal,
            title: Some("Test Pane".to_string()),
            command: Some("bash".to_string()),
            shell_type: Some("bash".to_string()),
            working_dir: None,
            backend_id: Some("backend-1".to_string()),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            width: 80,
            height: 24,
            x: 0,
            y: 0,
            active: true,
            metadata: std::collections::HashMap::new(),
        };

        let created_pane = state_manager.create_pane(pane).await.unwrap();
        assert_eq!(created_pane.id, "test-pane");

        // Get pane
        let retrieved = state_manager.get_pane(&created_pane.id).await;
        assert!(retrieved.is_some());

        // Update pane
        let mut updated_pane = created_pane.clone();
        updated_pane.width = 100;
        state_manager.update_pane(updated_pane).await.unwrap();

        let retrieved = state_manager.get_pane(&created_pane.id).await.unwrap();
        assert_eq!(retrieved.width, 100);

        // Delete pane
        state_manager.delete_pane(&created_pane.id).await.unwrap();
        let retrieved = state_manager.get_pane(&created_pane.id).await;
        assert!(retrieved.is_none());
    }

    #[tokio::test]
    async fn test_manager_with_file_operations() {
        let store = Arc::new(MemoryStore::new());
        let state_manager = StateManager::new(store);
        let backend = Arc::new(MockBackend);
        let manager = Manager::builder(backend, state_manager)
            .with_file_manager(Arc::new(MockFileManager))
            .build();

        // Test file creation
        let result = manager
            .execute_action(Action::CreateFile {
                path: "test.txt".to_string(),
                content: Some("Hello".to_string()),
            })
            .await
            .unwrap();

        assert_eq!(result["status"], "ok");

        // Test file reading
        let result = manager
            .execute_action(Action::OpenFile {
                path: "test.txt".to_string(),
            })
            .await
            .unwrap();

        assert_eq!(result["content"], "Content of test.txt");

        // Test error handling
        let result = manager
            .execute_action(Action::OpenFile {
                path: "error.txt".to_string(),
            })
            .await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_plugin_system() {
        let store = Arc::new(MemoryStore::new());
        let state_manager = StateManager::new(store);
        let backend = Arc::new(MockBackend);
        let manager = Manager::new(backend, state_manager);

        // Load plugin
        let plugin = Box::new(TestPlugin::new("test-plugin"));
        manager.load_plugin(plugin).await.unwrap();

        // Subscribe to events
        manager
            .subscribe_plugin("test-plugin", vec!["session_created".to_string()])
            .await
            .unwrap();

        // Create session to trigger event
        let _result = manager
            .execute_action(Action::CreateSession {
                name: "test-session".to_string(),
            })
            .await
            .unwrap();

        // Give time for event propagation
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;

        // Unload plugin
        manager.unload_plugin("test-plugin").await.unwrap();
    }

    #[tokio::test]
    async fn test_event_system() {
        let store = Arc::new(MemoryStore::new());
        let state_manager = StateManager::new(store);
        let backend = Arc::new(MockBackend);
        let manager = Manager::new(backend, state_manager);

        // Subscribe to events
        let mut event_rx = manager.event_tx.subscribe();

        // Create session
        let _result = manager
            .execute_action(Action::CreateSession {
                name: "test-session".to_string(),
            })
            .await
            .unwrap();

        // Check event was emitted
        let event = tokio::time::timeout(std::time::Duration::from_secs(1), event_rx.recv())
            .await
            .unwrap()
            .unwrap();

        match event {
            Event::SessionCreated { session } => {
                assert_eq!(session.name, "test-session");
            }
            _ => panic!("Expected SessionCreated event"),
        }
    }

    #[tokio::test]
    async fn test_pane_operations() {
        let store = Arc::new(MemoryStore::new());
        let state_manager = StateManager::new(store);
        let backend = Arc::new(MockBackend);
        let manager = Manager::new(backend, state_manager);

        // Create session
        let session_result = manager
            .execute_action(Action::CreateSession {
                name: "test-session".to_string(),
            })
            .await
            .unwrap();

        let session = serde_json::from_value::<crate::SessionState>(session_result).unwrap();

        // Create pane
        let pane_result = manager
            .execute_action(Action::CreatePane {
                session_id: session.id.clone(),
                pane_type: PaneType::Terminal,
                command: Some("bash".to_string()),
                shell_type: Some(ShellType::Bash),
                name: Some("Test Pane".to_string()),
            })
            .await
            .unwrap();

        let pane = serde_json::from_value::<crate::PaneState>(pane_result).unwrap();
        assert_eq!(pane.title, Some("Test Pane".to_string()));

        // Send keys
        let result = manager
            .execute_action(Action::SendKeys {
                pane_id: pane.id.clone(),
                keys: "echo test".to_string(),
            })
            .await
            .unwrap();

        assert_eq!(result["status"], "ok");

        // Run command
        let result = manager
            .execute_action(Action::RunCommand {
                pane_id: pane.id.clone(),
                command: "ls -la".to_string(),
            })
            .await
            .unwrap();

        assert_eq!(result["status"], "ok");

        // Get output
        let result = manager
            .execute_action(Action::GetPaneOutput {
                pane_id: pane.id.clone(),
                lines: Some(10),
            })
            .await
            .unwrap();

        assert_eq!(result["output"], "test output");

        // Resize pane
        let result = manager
            .execute_action(Action::ResizePane {
                pane_id: pane.id.clone(),
                width: 120,
                height: 40,
            })
            .await
            .unwrap();

        assert_eq!(result["width"], 120);
        assert_eq!(result["height"], 40);

        // Close pane
        let result = manager
            .execute_action(Action::ClosePane {
                pane_id: pane.id.clone(),
            })
            .await
            .unwrap();

        assert_eq!(result["status"], "ok");
    }
}
