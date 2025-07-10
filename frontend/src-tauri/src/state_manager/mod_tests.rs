#[cfg(test)]
mod tests {
    use crate::state_manager::{StateManager, PaneType};
    use crate::simple_state_store::SimpleStateStore;
    use std::sync::Arc;
    use tempfile::TempDir;
    
    fn create_test_manager() -> (StateManager, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let store = Arc::new(SimpleStateStore::new_with_file(temp_dir.path().join("test.db")).unwrap());
        let manager = StateManager::new(store);
        (manager, temp_dir)
    }
    
    #[tokio::test]
    async fn test_create_session() {
        let (manager, _temp) = create_test_manager();
        
        let session = manager.create_session("Test Session".to_string()).await.unwrap();
        
        assert!(!session.id.is_empty());
        assert_eq!(session.name, "Test Session");
        assert!(session.panes.is_empty());
    }
    
    #[tokio::test]
    async fn test_list_sessions() {
        let (manager, _temp) = create_test_manager();
        
        // Create multiple sessions
        let session1 = manager.create_session("Session 1".to_string()).await.unwrap();
        let session2 = manager.create_session("Session 2".to_string()).await.unwrap();
        
        let sessions = manager.list_sessions().await;
        assert_eq!(sessions.len(), 2);
        assert!(sessions.iter().any(|s| s.name == "Session 1"));
        assert!(sessions.iter().any(|s| s.name == "Session 2"));
    }
    
    #[tokio::test]
    async fn test_delete_session() {
        let (manager, _temp) = create_test_manager();
        
        let session = manager.create_session("Test".to_string()).await.unwrap();
        
        let result = manager.delete_session(&session.id).await;
        assert!(result.is_ok());
        
        let sessions = manager.list_sessions().await;
        assert_eq!(sessions.len(), 0);
    }
    
    #[tokio::test]
    async fn test_create_pane() {
        let (manager, _temp) = create_test_manager();
        
        // Create session first
        let session = manager.create_session("Test".to_string()).await.unwrap();
        
        // Create pane
        let pane = manager.create_pane(
            session.id.clone(),
            PaneType::Terminal,
            Some("pane-1".to_string())
        ).await.unwrap();
        
        assert_eq!(pane.backend_id, Some("pane-1".to_string()));
        assert_eq!(pane.pane_type, PaneType::Terminal);
        assert_eq!(pane.session_id, session.id);
    }
    
    #[tokio::test]
    async fn test_list_panes() {
        let (manager, _temp) = create_test_manager();
        
        // Create session and panes
        let session = manager.create_session("Test".to_string()).await.unwrap();
        manager.create_pane(session.id.clone(), PaneType::Terminal, Some("pane-1".to_string())).await.unwrap();
        manager.create_pane(session.id.clone(), PaneType::Editor, Some("pane-2".to_string())).await.unwrap();
        
        let panes = manager.list_panes(&session.id).await;
        assert_eq!(panes.len(), 2);
        assert!(panes.iter().any(|p| p.pane_type == PaneType::Terminal));
        assert!(panes.iter().any(|p| p.pane_type == PaneType::Editor));
    }
    
    #[tokio::test]
    async fn test_get_pane() {
        let (manager, _temp) = create_test_manager();
        
        // Create session and pane
        let session = manager.create_session("Test".to_string()).await.unwrap();
        let pane = manager.create_pane(session.id.clone(), PaneType::Terminal, Some("pane-1".to_string())).await.unwrap();
        
        // Get pane by ID
        let retrieved = manager.get_pane(&pane.id).await;
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().id, pane.id);
    }
    
    #[tokio::test]
    async fn test_delete_pane() {
        let (manager, _temp) = create_test_manager();
        
        // Create session and pane
        let session = manager.create_session("Test".to_string()).await.unwrap();
        let pane = manager.create_pane(session.id.clone(), PaneType::Terminal, None).await.unwrap();
        
        // Delete pane
        let result = manager.delete_pane(&pane.id).await;
        assert!(result.is_ok());
        
        // Verify deletion
        let retrieved = manager.get_pane(&pane.id).await;
        assert!(retrieved.is_none());
    }
    
    #[tokio::test]
    async fn test_set_active_pane() {
        let (manager, _temp) = create_test_manager();
        
        // Create session and panes
        let session = manager.create_session("Test".to_string()).await.unwrap();
        let pane1 = manager.create_pane(session.id.clone(), PaneType::Terminal, None).await.unwrap();
        let pane2 = manager.create_pane(session.id.clone(), PaneType::Editor, None).await.unwrap();
        
        // Set active pane
        let result = manager.set_active_pane(&session.id, &pane2.id).await;
        assert!(result.is_ok());
        
        // Verify
        let session = manager.get_session(&session.id).await.unwrap();
        assert_eq!(session.active_pane, Some(pane2.id));
    }
    
    #[tokio::test]
    async fn test_update_pane_title() {
        let (manager, _temp) = create_test_manager();
        
        // Create session and pane  
        let session = manager.create_session("Test".to_string()).await.unwrap();
        let mut pane = manager.create_pane(session.id.clone(), PaneType::Terminal, None).await.unwrap();
        
        // Update title
        pane.title = "New Title".to_string();
        let result = manager.update_pane(pane.clone()).await;
        assert!(result.is_ok());
        
        // Verify
        let updated = manager.get_pane(&pane.id).await.unwrap();
        assert_eq!(updated.title, "New Title");
    }
    
    #[tokio::test]
    async fn test_settings() {
        let (manager, _temp) = create_test_manager();
        
        // Set settings
        manager.set_setting("theme", "dark").await.unwrap();
        manager.set_setting("font.size", "14").await.unwrap();
        
        // Get single setting
        let theme = manager.get_setting("theme").await.unwrap();
        assert_eq!(theme, Some("dark".to_string()));
        
        // Delete setting
        manager.delete_setting("theme").await.unwrap();
        let theme = manager.get_setting("theme").await.unwrap();
        assert!(theme.is_none());
    }
    
    #[tokio::test]
    async fn test_session_ordering() {
        let (manager, _temp) = create_test_manager();
        
        // Create sessions with delays to ensure different timestamps
        let session1 = manager.create_session("First".to_string()).await.unwrap();
        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
        let session2 = manager.create_session("Second".to_string()).await.unwrap();
        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
        let session3 = manager.create_session("Third".to_string()).await.unwrap();
        
        let sessions = manager.list_sessions().await;
        
        // Should be ordered by creation time (oldest first)
        assert_eq!(sessions[0].name, "First");
        assert_eq!(sessions[1].name, "Second");
        assert_eq!(sessions[2].name, "Third");
    }
    
    #[tokio::test]
    async fn test_pane_ordering() {
        let (manager, _temp) = create_test_manager();
        
        // Create session and panes
        let session = manager.create_session("Test".to_string()).await.unwrap();
        
        let pane1 = manager.create_pane(session.id.clone(), PaneType::Terminal, None).await.unwrap();
        let pane2 = manager.create_pane(session.id.clone(), PaneType::Editor, None).await.unwrap();
        let pane3 = manager.create_pane(session.id.clone(), PaneType::FileTree, None).await.unwrap();
        
        let panes = manager.list_panes(&session.id).await;
        
        // Should maintain creation order
        assert_eq!(panes[0].id, pane1.id);
        assert_eq!(panes[1].id, pane2.id);
        assert_eq!(panes[2].id, pane3.id);
    }
}