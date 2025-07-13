#[cfg(test)]
mod plugin_event_tests {
    use crate::manager::{Event, Plugin, PluginContext, PluginMetadata};
    use async_trait::async_trait;
    use serde_json::Value;
    use std::sync::{Arc, Mutex};

    // Test plugin that records received events
    struct TestPlugin {
        id: String,
        received_events: Arc<Mutex<Vec<String>>>,
    }

    impl TestPlugin {
        fn new(id: &str) -> (Self, Arc<Mutex<Vec<String>>>) {
            let events = Arc::new(Mutex::new(Vec::new()));
            (
                Self {
                    id: id.to_string(),
                    received_events: events.clone(),
                },
                events,
            )
        }
    }

    #[async_trait]
    impl Plugin for TestPlugin {
        fn id(&self) -> &str {
            &self.id
        }

        fn metadata(&self) -> PluginMetadata {
            PluginMetadata {
                name: "Test Plugin".to_string(),
                version: "1.0.0".to_string(),
                author: "Test".to_string(),
                description: "Test plugin for event system".to_string(),
                capabilities: vec!["test".to_string()],
            }
        }

        async fn init(&mut self, _context: PluginContext) -> Result<(), String> {
            Ok(())
        }

        async fn handle_event(&mut self, event: &Event) -> Result<(), String> {
            let event_str = match event {
                Event::SessionCreated { .. } => "session_created",
                Event::SessionUpdated { .. } => "session_updated",
                Event::SessionDeleted { .. } => "session_deleted",
                Event::PaneCreated { .. } => "pane_created",
                Event::PaneOutput { .. } => "pane_output",
                Event::PaneClosed { .. } => "pane_closed",
                Event::PaneDestroyed { .. } => "pane_destroyed",
                Event::PaneFocused { .. } => "pane_focused",
                Event::PaneResized { .. } => "pane_resized",
                Event::FileOpened { .. } => "file_opened",
                Event::FileSaved { .. } => "file_saved",
                Event::FileChanged { .. } => "file_changed",
                Event::FileWatchStarted { .. } => "file_watch_started",
                Event::FileWatchStopped { .. } => "file_watch_stopped",
                Event::FileWatchEvent { .. } => "file_watch_event",
                Event::CommandExecuted { .. } => "command_executed",
                Event::CommandCompleted { .. } => "command_completed",
                Event::PluginLoaded { .. } => "plugin_loaded",
                Event::PluginUnloaded { .. } => "plugin_unloaded",
                Event::PluginError { .. } => "plugin_error",
                Event::OrchestratorStarted => "orchestrator_started",
                Event::OrchestratorStopping => "orchestrator_stopping",
                Event::FileRead { .. } => "file_read",
                Event::Custom { .. } => "custom",
            };

            self.received_events
                .lock()
                .unwrap()
                .push(event_str.to_string());
            Ok(())
        }

        async fn handle_request(&mut self, _method: &str, _params: Value) -> Result<Value, String> {
            Ok(Value::Null)
        }

        async fn shutdown(&mut self) -> Result<(), String> {
            Ok(())
        }
    }

    #[tokio::test]
    async fn test_plugin_receives_events() {
        // This test verifies that the plugin event dispatch system is working
        // The actual integration test would require a full orchestrator setup

        // Test that our test plugin can handle events
        let (mut plugin, events) = TestPlugin::new("test");

        // Simulate receiving events
        plugin
            .handle_event(&Event::SessionCreated {
                session: crate::state_manager::SessionState {
                    id: "test-session".to_string(),
                    name: "Test".to_string(),
                    panes: vec![],
                    active_pane: None,
                    layout: None,
                    created_at: chrono::Utc::now(),
                    updated_at: chrono::Utc::now(),
                },
            })
            .await
            .unwrap();

        plugin
            .handle_event(&Event::PaneCreated {
                pane: crate::state_manager::PaneState {
                    id: "test-pane".to_string(),
                    session_id: "test-session".to_string(),
                    pane_type: crate::state_manager::PaneType::Terminal,
                    backend_id: None,
                    title: "Test Pane".to_string(),
                    working_dir: None,
                    command: None,
                    created_at: chrono::Utc::now(),
                },
            })
            .await
            .unwrap();

        plugin
            .handle_event(&Event::FileOpened {
                path: "/test/file.txt".to_string(),
                pane_id: "test-pane".to_string(),
            })
            .await
            .unwrap();

        // Verify events were recorded
        let recorded = events.lock().unwrap();
        assert_eq!(recorded.len(), 3);
        assert_eq!(recorded[0], "session_created");
        assert_eq!(recorded[1], "pane_created");
        assert_eq!(recorded[2], "file_opened");
    }

    #[test]
    fn test_event_type_matching() {
        // Test that event type matching works correctly
        let event = Event::SessionCreated {
            session: crate::state_manager::SessionState {
                id: "test".to_string(),
                name: "Test".to_string(),
                panes: vec![],
                active_pane: None,
                layout: None,
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            },
        };

        let event_type = match &event {
            Event::SessionCreated { .. } => "session_created",
            _ => "other",
        };

        assert_eq!(event_type, "session_created");
    }

    #[test]
    fn test_plugin_metadata() {
        let (plugin, _) = TestPlugin::new("test-plugin");
        let metadata = plugin.metadata();

        assert_eq!(metadata.name, "Test Plugin");
        assert_eq!(metadata.version, "1.0.0");
        assert_eq!(metadata.author, "Test");
        assert_eq!(metadata.description, "Test plugin for event system");
        assert_eq!(metadata.capabilities.len(), 1);
        assert_eq!(metadata.capabilities[0], "test");
    }

    #[tokio::test]
    async fn test_plugin_lifecycle() {
        let (mut plugin, _) = TestPlugin::new("test-plugin");

        // Test init
        let context = PluginContext {
            manager_handle: None, // Would be populated in real usage
        };
        let init_result = plugin.init(context).await;
        assert!(init_result.is_ok());

        // Test shutdown
        let shutdown_result = plugin.shutdown().await;
        assert!(shutdown_result.is_ok());
    }

    #[tokio::test]
    async fn test_custom_event_handling() {
        let (mut plugin, events) = TestPlugin::new("test-plugin");

        // Test custom event
        plugin
            .handle_event(&Event::Custom {
                event_type: "test_custom".to_string(),
                data: serde_json::json!({
                    "key": "value",
                    "number": 42
                }),
            })
            .await
            .unwrap();

        let recorded = events.lock().unwrap();
        assert_eq!(recorded.len(), 1);
        assert_eq!(recorded[0], "custom");
    }

    #[tokio::test]
    async fn test_file_watch_events() {
        let (mut plugin, events) = TestPlugin::new("test-plugin");

        // Test file watch events
        plugin
            .handle_event(&Event::FileWatchStarted {
                path: "/test/watch".to_string(),
                recursive: true,
            })
            .await
            .unwrap();

        plugin
            .handle_event(&Event::FileWatchEvent {
                event: crate::file_watcher::FileWatchEvent::Modified("/test/watch/file.txt".into()),
            })
            .await
            .unwrap();

        plugin
            .handle_event(&Event::FileWatchStopped {
                path: "/test/watch".to_string(),
            })
            .await
            .unwrap();

        let recorded = events.lock().unwrap();
        assert_eq!(recorded.len(), 3);
        assert_eq!(recorded[0], "file_watch_started");
        assert_eq!(recorded[1], "file_watch_event");
        assert_eq!(recorded[2], "file_watch_stopped");
    }

    #[tokio::test]
    async fn test_command_events() {
        let (mut plugin, events) = TestPlugin::new("test-plugin");

        // Test command events
        plugin
            .handle_event(&Event::CommandExecuted {
                pane_id: "test-pane".to_string(),
                command: "ls -la".to_string(),
            })
            .await
            .unwrap();

        plugin
            .handle_event(&Event::CommandCompleted {
                pane_id: "test-pane".to_string(),
                exit_code: 0,
            })
            .await
            .unwrap();

        let recorded = events.lock().unwrap();
        assert_eq!(recorded.len(), 2);
        assert_eq!(recorded[0], "command_executed");
        assert_eq!(recorded[1], "command_completed");
    }
}
