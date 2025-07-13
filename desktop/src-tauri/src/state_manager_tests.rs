#[cfg(test)]
mod state_manager_tests {
    use super::*;
    use crate::simple_state_store::SimpleStateStore;
    use crate::state_manager::{PaneType, StateManager};
    use std::sync::Arc;
    use tempfile::NamedTempFile;

    fn create_test_state_manager() -> StateManager {
        let temp_file = NamedTempFile::new().unwrap();
        let db_path = temp_file.path();
        let store = Arc::new(SimpleStateStore::new_with_file(db_path).unwrap());
        StateManager::new(store)
    }

    #[tokio::test]
    async fn test_session_lifecycle() {
        let state_manager = create_test_state_manager();

        // Create session
        let session = state_manager
            .create_session("test-session".to_string())
            .await
            .unwrap();
        assert_eq!(session.name, "test-session");
        assert_eq!(session.panes.len(), 0);
        assert!(session.layout.is_some());

        // Get session
        let retrieved = state_manager.get_session(&session.id).await.unwrap();
        assert_eq!(retrieved.id, session.id);
        assert_eq!(retrieved.name, session.name);

        // List sessions
        let sessions = state_manager.list_sessions().await;
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].id, session.id);

        // Delete session
        state_manager.delete_session(&session.id).await.unwrap();
        let deleted = state_manager.get_session(&session.id).await;
        assert!(deleted.is_none());
    }

    #[tokio::test]
    async fn test_pane_lifecycle() {
        let state_manager = create_test_state_manager();

        // Create session first
        let session = state_manager
            .create_session("test-session".to_string())
            .await
            .unwrap();

        // Create pane
        let pane = state_manager
            .create_pane(
                session.id.clone(),
                PaneType::Terminal,
                Some("backend-pane-1".to_string()),
            )
            .await
            .unwrap();

        assert_eq!(pane.session_id, session.id);
        assert_eq!(pane.backend_id, Some("backend-pane-1".to_string()));
        assert!(matches!(pane.pane_type, PaneType::Terminal));

        // Check session was updated with pane
        let updated_session = state_manager.get_session(&session.id).await.unwrap();
        assert_eq!(updated_session.panes.len(), 1);
        assert_eq!(updated_session.panes[0], pane.id);
        assert_eq!(updated_session.active_pane, Some(pane.id.clone()));

        // Get pane
        let retrieved = state_manager.get_pane(&pane.id).await.unwrap();
        assert_eq!(retrieved.id, pane.id);

        // List panes for session
        let panes = state_manager.list_panes(&session.id).await;
        assert_eq!(panes.len(), 1);
        assert_eq!(panes[0].id, pane.id);

        // Update pane
        let mut updated_pane = pane.clone();
        updated_pane.title = "Updated Terminal".to_string();
        state_manager
            .update_pane(updated_pane.clone())
            .await
            .unwrap();

        let retrieved_updated = state_manager.get_pane(&pane.id).await.unwrap();
        assert_eq!(retrieved_updated.title, "Updated Terminal");

        // Delete pane
        state_manager.delete_pane(&pane.id).await.unwrap();
        let deleted = state_manager.get_pane(&pane.id).await;
        assert!(deleted.is_none());

        // Check session pane list was updated
        let session_after_delete = state_manager.get_session(&session.id).await.unwrap();
        assert_eq!(session_after_delete.panes.len(), 0);
        assert_eq!(session_after_delete.active_pane, None);
    }

    #[tokio::test]
    async fn test_layout_management() {
        let state_manager = create_test_state_manager();

        // Create session
        let session = state_manager
            .create_session("test-session".to_string())
            .await
            .unwrap();

        // Get initial layout
        let layout = state_manager.get_layout(&session.id).await.unwrap();
        assert_eq!(layout.session_id, session.id);
        assert_eq!(layout.panes.len(), 1); // Default root pane

        // Update layout
        let mut updated_layout = layout.clone();
        // Split the root pane to create a more complex layout
        let root_id = updated_layout.root_id.clone();
        let (child1_id, child2_id) = updated_layout
            .split_pane(&root_id, crate::layout::SplitType::Horizontal, 60)
            .unwrap();

        state_manager
            .update_layout(&session.id, updated_layout.clone())
            .await
            .unwrap();

        // Get updated layout
        let retrieved_layout = state_manager.get_layout(&session.id).await.unwrap();
        assert_eq!(retrieved_layout.panes.len(), 3); // Root + 2 children
        assert!(retrieved_layout.panes.contains_key(&child1_id));
        assert!(retrieved_layout.panes.contains_key(&child2_id));
    }

    #[tokio::test]
    async fn test_multiple_sessions_and_panes() {
        let state_manager = create_test_state_manager();

        // Create multiple sessions
        let session1 = state_manager
            .create_session("session-1".to_string())
            .await
            .unwrap();
        let session2 = state_manager
            .create_session("session-2".to_string())
            .await
            .unwrap();

        // Create panes in each session
        let pane1 = state_manager
            .create_pane(
                session1.id.clone(),
                PaneType::Terminal,
                Some("backend-1".to_string()),
            )
            .await
            .unwrap();

        let pane2 = state_manager
            .create_pane(
                session1.id.clone(),
                PaneType::Editor,
                Some("backend-2".to_string()),
            )
            .await
            .unwrap();

        let pane3 = state_manager
            .create_pane(
                session2.id.clone(),
                PaneType::Terminal,
                Some("backend-3".to_string()),
            )
            .await
            .unwrap();

        // Check session 1 has 2 panes
        let session1_panes = state_manager.list_panes(&session1.id).await;
        assert_eq!(session1_panes.len(), 2);

        // Check session 2 has 1 pane
        let session2_panes = state_manager.list_panes(&session2.id).await;
        assert_eq!(session2_panes.len(), 1);

        // Check total sessions
        let all_sessions = state_manager.list_sessions().await;
        assert_eq!(all_sessions.len(), 2);

        // Delete session 1 and check that its panes are also deleted
        state_manager.delete_session(&session1.id).await.unwrap();

        let remaining_sessions = state_manager.list_sessions().await;
        assert_eq!(remaining_sessions.len(), 1);
        assert_eq!(remaining_sessions[0].id, session2.id);

        // Check that panes from session 1 are gone
        assert!(state_manager.get_pane(&pane1.id).await.is_none());
        assert!(state_manager.get_pane(&pane2.id).await.is_none());

        // Check that pane from session 2 still exists
        assert!(state_manager.get_pane(&pane3.id).await.is_some());
    }

    #[tokio::test]
    async fn test_state_persistence() {
        let temp_file = NamedTempFile::new().unwrap();
        let db_path = temp_file.path().to_str().unwrap();

        // Create state manager and add some data
        {
            let store = Arc::new(SimpleStateStore::new(db_path).unwrap());
            let state_manager = StateManager::new(store);

            let session = state_manager
                .create_session("persistent-session".to_string())
                .await
                .unwrap();
            let pane = state_manager
                .create_pane(
                    session.id.clone(),
                    PaneType::Terminal,
                    Some("backend-pane".to_string()),
                )
                .await
                .unwrap();

            // Force persistence
            state_manager.persist_all().await.unwrap();
        }

        // Create new state manager with same database
        {
            let store = Arc::new(SimpleStateStore::new(db_path).unwrap());
            let state_manager = StateManager::new(store);

            // Load from persistence
            state_manager.load_from_store().await.unwrap();

            // Check data was persisted
            let sessions = state_manager.list_sessions().await;
            assert_eq!(sessions.len(), 1);
            assert_eq!(sessions[0].name, "persistent-session");

            let panes = state_manager.list_panes(&sessions[0].id).await;
            assert_eq!(panes.len(), 1);
            assert_eq!(panes[0].backend_id, Some("backend-pane".to_string()));
        }
    }

    #[tokio::test]
    async fn test_event_emission() {
        let state_manager = create_test_state_manager();
        let mut event_rx = state_manager.subscribe();

        // Create session and check event
        let session = state_manager
            .create_session("event-test".to_string())
            .await
            .unwrap();

        let event = tokio::time::timeout(tokio::time::Duration::from_millis(100), event_rx.recv())
            .await
            .unwrap()
            .unwrap();

        match event {
            crate::state_manager::StateEvent::SessionCreated {
                session: event_session,
            } => {
                assert_eq!(event_session.id, session.id);
            }
            _ => panic!("Expected SessionCreated event"),
        }

        // Create pane and check event
        let pane = state_manager
            .create_pane(
                session.id.clone(),
                PaneType::Terminal,
                Some("backend-test".to_string()),
            )
            .await
            .unwrap();

        let event = tokio::time::timeout(tokio::time::Duration::from_millis(100), event_rx.recv())
            .await
            .unwrap()
            .unwrap();

        match event {
            crate::state_manager::StateEvent::PaneCreated { pane: event_pane } => {
                assert_eq!(event_pane.id, pane.id);
            }
            _ => panic!("Expected PaneCreated event"),
        }
    }
}
