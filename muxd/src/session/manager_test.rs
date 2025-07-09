#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::PaneType;

    fn create_test_manager() -> SessionManager {
        SessionManager::new(10, 20)
    }

    #[test]
    fn test_session_creation() {
        let manager = create_test_manager();
        
        let result = manager.create_session("test-session".to_string());
        assert!(result.is_ok(), "Failed to create session");
        
        let session_id = result.unwrap();
        assert!(!session_id.0.is_empty());
    }

    #[test]
    fn test_session_retrieval() {
        let manager = create_test_manager();
        
        let session_id = manager.create_session("test-session".to_string()).unwrap();
        
        let sessions = manager.list_sessions();
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].0, session_id.0);
    }

    #[test]
    fn test_session_limit() {
        let manager = SessionManager::new(2, 10);
        
        // Create max sessions
        let _session1 = manager.create_session("session1".to_string()).unwrap();
        let _session2 = manager.create_session("session2".to_string()).unwrap();
        
        // Try to create one more
        let result = manager.create_session("session3".to_string());
        assert!(result.is_err());
        
        match result.unwrap_err() {
            MuxdError::ResourceLimit { resource, limit } => {
                assert_eq!(resource, "sessions");
                assert_eq!(limit, 2);
            }
            _ => panic!("Expected ResourceLimit error"),
        }
    }

    #[test]
    fn test_pane_creation() {
        let manager = create_test_manager();
        
        let session_id = manager.create_session("test-session".to_string()).unwrap();
        
        let result = manager.create_pane(
            &session_id,
            PaneType::Terminal,
            None,
            None,
        );
        
        assert!(result.is_ok(), "Failed to create pane");
        
        let pane = result.unwrap();
        assert_eq!(pane.session_id, session_id.0);
        assert_eq!(pane.pane_type, PaneType::Terminal);
    }

    #[test]
    fn test_pane_limit() {
        let manager = SessionManager::new(10, 2);
        
        let session_id = manager.create_session("test-session".to_string()).unwrap();
        
        // Create max panes
        let _pane1 = manager.create_pane(&session_id, PaneType::Terminal, None, None).unwrap();
        let _pane2 = manager.create_pane(&session_id, PaneType::Terminal, None, None).unwrap();
        
        // Try to create one more
        let result = manager.create_pane(&session_id, PaneType::Terminal, None, None);
        assert!(result.is_err());
        
        match result.unwrap_err() {
            MuxdError::ResourceLimit { resource, limit } => {
                assert_eq!(resource, "panes");
                assert_eq!(limit, 2);
            }
            _ => panic!("Expected ResourceLimit error"),
        }
    }

    #[test]
    fn test_list_panes() {
        let manager = create_test_manager();
        
        let session_id = manager.create_session("test-session".to_string()).unwrap();
        
        // Create multiple panes
        let pane1 = manager.create_pane(&session_id, PaneType::Terminal, None, None).unwrap();
        let pane2 = manager.create_pane(&session_id, PaneType::Custom("editor".to_string()), None, None).unwrap();
        
        let panes = manager.list_panes(&session_id).unwrap();
        assert_eq!(panes.len(), 2);
        
        let pane_ids: Vec<_> = panes.iter().map(|p| &p.id).collect();
        assert!(pane_ids.contains(&&pane1.id));
        assert!(pane_ids.contains(&&pane2.id));
    }

    #[test]
    fn test_active_pane() {
        let manager = create_test_manager();
        
        let session_id = manager.create_session("test-session".to_string()).unwrap();
        
        // Create panes
        let pane1 = manager.create_pane(&session_id, PaneType::Terminal, None, None).unwrap();
        let pane2 = manager.create_pane(&session_id, PaneType::Terminal, None, None).unwrap();
        
        // Set active pane
        manager.set_active_pane(&session_id, &pane2.id).unwrap();
        
        // Get active pane
        let active = manager.get_active_pane(&session_id).unwrap();
        assert_eq!(active.id, pane2.id);
        
        // Switch active pane
        manager.set_active_pane(&session_id, &pane1.id).unwrap();
        let active = manager.get_active_pane(&session_id).unwrap();
        assert_eq!(active.id, pane1.id);
    }

    #[test]
    fn test_close_pane() {
        let manager = create_test_manager();
        
        let session_id = manager.create_session("test-session".to_string()).unwrap();
        let pane = manager.create_pane(&session_id, PaneType::Terminal, None, None).unwrap();
        
        // Close pane
        manager.close_pane(&session_id, &pane.id).unwrap();
        
        // Verify pane is gone
        let panes = manager.list_panes(&session_id).unwrap();
        assert_eq!(panes.len(), 0);
        
        // Try to get closed pane
        let result = manager.get_pane(&session_id, &pane.id);
        assert!(result.is_err());
    }

    #[test]
    fn test_close_session() {
        let manager = create_test_manager();
        
        let session_id = manager.create_session("test-session".to_string()).unwrap();
        
        // Create some panes
        manager.create_pane(&session_id, PaneType::Terminal, None, None).unwrap();
        manager.create_pane(&session_id, PaneType::Custom("editor".to_string()), None, None).unwrap();
        
        // Close session
        manager.close_session(&session_id).unwrap();
        
        // Verify session is gone
        let sessions = manager.list_sessions();
        assert_eq!(sessions.len(), 0);
        
        // Try to access closed session
        let result = manager.list_panes(&session_id);
        assert!(result.is_err());
    }

    #[test]
    fn test_concurrent_session_creation() {
        use std::thread;
        use std::sync::Arc;
        
        let manager = Arc::new(SessionManager::new(20, 10));
        let mut handles = vec![];
        
        for i in 0..10 {
            let mgr = manager.clone();
            let handle = thread::spawn(move || {
                mgr.create_session(format!("session-{}", i))
            });
            handles.push(handle);
        }
        
        let mut success_count = 0;
        for handle in handles {
            if handle.join().unwrap().is_ok() {
                success_count += 1;
            }
        }
        
        assert_eq!(success_count, 10);
        assert_eq!(manager.list_sessions().len(), 10);
    }
}