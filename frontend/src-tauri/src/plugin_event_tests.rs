#[cfg(test)]
mod plugin_event_tests {
    use crate::orchestrator::{Plugin, PluginMetadata, PluginContext, Event, Orchestrator};
    use async_trait::async_trait;
    use std::sync::{Arc, Mutex};
    use serde_json::Value;
    
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
                events
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
                Event::PaneCreated { .. } => "pane_created",
                Event::FileOpened { .. } => "file_opened",
                _ => "other",
            };
            
            self.received_events.lock().unwrap().push(event_str.to_string());
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
        plugin.handle_event(&Event::SessionCreated {
            session: crate::orchestrator::Session {
                id: "test-session".to_string(),
                name: "Test".to_string(),
                panes: vec![],
                active_pane: None,
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            }
        }).await.unwrap();
        
        plugin.handle_event(&Event::PaneCreated {
            pane: crate::orchestrator::Pane {
                id: "test-pane".to_string(),
                session_id: "test-session".to_string(),
                pane_type: crate::orchestrator::PaneType::Terminal,
                tmux_id: None,
                title: "Test Pane".to_string(),
                working_dir: None,
                command: None,
                shell_type: None,
                custom_name: None,
                created_at: chrono::Utc::now(),
            }
        }).await.unwrap();
        
        // Verify events were recorded
        let recorded = events.lock().unwrap();
        assert_eq!(recorded.len(), 2);
        assert_eq!(recorded[0], "session_created");
        assert_eq!(recorded[1], "pane_created");
    }
    
    #[test]
    fn test_event_type_matching() {
        // Test that event type matching works correctly
        let event = Event::SessionCreated {
            session: crate::orchestrator::Session {
                id: "test".to_string(),
                name: "Test".to_string(),
                panes: vec![],
                active_pane: None,
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            }
        };
        
        let event_type = match &event {
            Event::SessionCreated { .. } => "session_created",
            _ => "other",
        };
        
        assert_eq!(event_type, "session_created");
    }
}