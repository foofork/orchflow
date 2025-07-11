// Comprehensive tests for StateManager
// Achieves high coverage for state management operations

#[cfg(test)]
mod tests {
    use crate::state_manager::StateManager;
    use crate::manager::ShellType;
    use crate::error::{OrchflowError, Result};
    use std::sync::Arc;
    use uuid::Uuid;

    async fn setup_state_manager() -> Arc<StateManager> {
        let store = Arc::new(crate::simple_state_store::SimpleStateStore::new().unwrap());
        Arc::new(StateManager::new(store))
    }

    #[tokio::test]
    async fn test_session_crud_operations() {
        let manager = setup_state_manager().await;
        
        // Create session
        let session = manager.create_session("Test Session".to_string()).await.unwrap();
        assert_eq!(session.name, "Test Session");
        assert!(!session.id.is_empty());
        
        // Get session
        let retrieved = manager.get_session(&session.id).await.unwrap();
        assert_eq!(retrieved.id, session.id);
        assert_eq!(retrieved.name, session.name);
        
        // List sessions
        let sessions = manager.list_sessions().await.unwrap();
        assert!(!sessions.is_empty());
        assert!(sessions.iter().any(|s| s.id == session.id));
        
        // Delete session
        manager.delete_session(&session.id).await.unwrap();
        
        // Verify deletion
        let result = manager.get_session(&session.id).await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), OrchflowError::SessionNotFound { .. }));
    }

    #[tokio::test]
    async fn test_pane_management() {
        let manager = setup_state_manager().await;
        
        // Create session first
        let session = manager.create_session("Pane Test".to_string()).await.unwrap();
        
        // Create pane with shell type
        let pane = manager.create_pane(
            session.id.clone(),
            "terminal".to_string(),
            Some(ShellType::Bash),
            Some("Test Pane".to_string()),
        ).await.unwrap();
        
        assert_eq!(pane.session_id, session.id);
        assert_eq!(pane.pane_type, "terminal");
        
        // Get pane
        let retrieved = manager.get_pane(&pane.id).await.unwrap();
        assert_eq!(retrieved.id, pane.id);
        
        // List panes for session
        let panes = manager.list_panes(&session.id).await.unwrap();
        assert_eq!(panes.len(), 1);
        assert_eq!(panes[0].id, pane.id);
        
        // Delete pane
        manager.delete_pane(&pane.id).await.unwrap();
        
        // Verify deletion
        let result = manager.get_pane(&pane.id).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_settings_management() {
        let manager = setup_state_manager().await;
        
        // Set settings
        manager.set_setting("theme", "dark").await.unwrap();
        manager.set_setting("font.size", "14").await.unwrap();
        manager.set_setting("editor.tabs", "4").await.unwrap();
        
        // Get setting
        let theme = manager.get_setting("theme").await.unwrap();
        assert_eq!(theme, Some("dark".to_string()));
        
        // Get non-existent setting
        let missing = manager.get_setting("missing").await.unwrap();
        assert_eq!(missing, None);
        
        // Get settings with prefix
        let font_settings = manager.get_settings_with_prefix("font").await.unwrap();
        assert_eq!(font_settings.len(), 1);
        assert_eq!(font_settings[0].0, "font.size");
        assert_eq!(font_settings[0].1, "14");
    }

    #[tokio::test]
    async fn test_concurrent_session_operations() {
        let manager = setup_state_manager().await;
        let mut handles = vec![];
        
        // Create multiple sessions concurrently
        for i in 0..10 {
            let manager = manager.clone();
            let handle = tokio::spawn(async move {
                manager.create_session(format!("Concurrent Session {}", i)).await
            });
            handles.push(handle);
        }
        
        // Wait for all operations
        let mut session_ids = vec![];
        for handle in handles {
            let result = handle.await.unwrap();
            assert!(result.is_ok());
            session_ids.push(result.unwrap().id);
        }
        
        // Verify all sessions exist
        let sessions = manager.list_sessions().await.unwrap();
        for id in session_ids {
            assert!(sessions.iter().any(|s| s.id == id));
        }
    }

    #[tokio::test]
    async fn test_error_handling() {
        let manager = setup_state_manager().await;
        
        // Test non-existent session
        let result = manager.get_session("non-existent-id").await;
        assert!(result.is_err());
        match result.unwrap_err() {
            OrchflowError::SessionNotFound { id } => {
                assert_eq!(id, "non-existent-id");
            }
            _ => panic!("Wrong error type"),
        }
        
        // Test non-existent pane
        let result = manager.get_pane("non-existent-pane").await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), OrchflowError::PaneNotFound { .. }));
        
        // Test deleting non-existent session
        let result = manager.delete_session("non-existent").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_shell_type_detection() {
        let manager = setup_state_manager().await;
        
        // Test available shells
        let shells = manager.get_available_shells().await;
        assert!(!shells.is_empty());
        
        // Common shells that might be available
        let common_shells = vec!["bash", "sh", "zsh", "fish"];
        let available_names: Vec<String> = shells.iter().map(|s| s.name.clone()).collect();
        
        // At least one common shell should be available
        let has_common_shell = common_shells.iter().any(|&shell| {
            available_names.iter().any(|name| name == shell)
        });
        assert!(has_common_shell, "No common shells found");
    }

    #[tokio::test]
    async fn test_session_with_multiple_panes() {
        let manager = setup_state_manager().await;
        
        // Create session
        let session = manager.create_session("Multi-pane Session".to_string()).await.unwrap();
        
        // Create multiple panes
        let pane_ids: Vec<String> = (0..5).map(|i| {
            let manager = manager.clone();
            let session_id = session.id.clone();
            tokio::spawn(async move {
                let pane = manager.create_pane(
                    session_id,
                    "terminal".to_string(),
                    Some(ShellType::Bash),
                    Some(format!("Pane {}", i)),
                ).await.unwrap();
                pane.id
            })
        })
        .collect::<Vec<_>>()
        .into_iter()
        .map(|h| tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current().block_on(h).unwrap()
        }))
        .collect();
        
        // List panes
        let panes = manager.list_panes(&session.id).await.unwrap();
        assert_eq!(panes.len(), 5);
        
        // Verify all pane IDs
        for id in pane_ids {
            assert!(panes.iter().any(|p| p.id == id));
        }
        
        // Delete session (should cascade delete panes)
        manager.delete_session(&session.id).await.unwrap();
        
        // Verify panes are gone
        let panes = manager.list_panes(&session.id).await.unwrap();
        assert!(panes.is_empty());
    }

    #[tokio::test]
    async fn test_session_persistence() {
        let temp_db = format!("/tmp/test_state_{}.db", Uuid::new_v4());
        
        let session_id = {
            // Create manager with file-based store
            let store = Arc::new(
                crate::simple_state_store::SimpleStateStore::new_with_file(&temp_db).unwrap()
            );
            let manager = Arc::new(StateManager::new(store));
            
            // Create session
            let session = manager.create_session("Persistent Session".to_string()).await.unwrap();
            
            // Set some settings
            manager.set_setting("test.key", "test.value").await.unwrap();
            
            session.id
        };
        
        // Create new manager instance
        let store = Arc::new(
            crate::simple_state_store::SimpleStateStore::new_with_file(&temp_db).unwrap()
        );
        let manager = Arc::new(StateManager::new(store));
        
        // Verify session persisted
        let session = manager.get_session(&session_id).await.unwrap();
        assert_eq!(session.name, "Persistent Session");
        
        // Verify settings persisted
        let setting = manager.get_setting("test.key").await.unwrap();
        assert_eq!(setting, Some("test.value".to_string()));
        
        // Cleanup
        std::fs::remove_file(&temp_db).ok();
    }

    #[tokio::test]
    async fn test_pane_content_management() {
        let manager = setup_state_manager().await;
        
        // Create session and pane
        let session = manager.create_session("Content Test".to_string()).await.unwrap();
        let pane = manager.create_pane(
            session.id.clone(),
            "editor".to_string(),
            None,
            None,
        ).await.unwrap();
        
        // Update pane content
        let content = "Hello, World!";
        manager.update_pane_content(&pane.id, content).await.unwrap();
        
        // Retrieve and verify
        let retrieved = manager.get_pane(&pane.id).await.unwrap();
        assert_eq!(retrieved.content, Some(content.to_string()));
    }

    #[tokio::test]
    async fn test_setting_edge_cases() {
        let manager = setup_state_manager().await;
        
        // Test empty key
        let result = manager.set_setting("", "value").await;
        assert!(result.is_ok()); // Should handle gracefully
        
        // Test empty value
        manager.set_setting("empty", "").await.unwrap();
        let value = manager.get_setting("empty").await.unwrap();
        assert_eq!(value, Some("".to_string()));
        
        // Test special characters
        manager.set_setting("special.chars", "!@#$%^&*()").await.unwrap();
        let value = manager.get_setting("special.chars").await.unwrap();
        assert_eq!(value, Some("!@#$%^&*()".to_string()));
        
        // Test very long key/value
        let long_key = "a".repeat(1000);
        let long_value = "b".repeat(10000);
        manager.set_setting(&long_key, &long_value).await.unwrap();
        let value = manager.get_setting(&long_key).await.unwrap();
        assert_eq!(value, Some(long_value));
    }
}