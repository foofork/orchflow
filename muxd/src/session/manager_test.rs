#[cfg(test)]
mod tests {
    
    use crate::session::SessionManager;
    use crate::error::MuxdError;
    use crate::protocol::PaneType;
    use bytes::Bytes;
    use tokio::sync::mpsc;

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
        assert_eq!(sessions[0].0, session_id);
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
        let (tx, _rx) = mpsc::unbounded_channel::<Bytes>();
        
        let result = manager.create_pane(
            &session_id,
            PaneType::Terminal,
            tx,
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
        let (tx1, _rx1) = mpsc::unbounded_channel::<Bytes>();
        let (tx2, _rx2) = mpsc::unbounded_channel::<Bytes>();
        let (tx3, _rx3) = mpsc::unbounded_channel::<Bytes>();
        
        let _pane1 = manager.create_pane(&session_id, PaneType::Terminal, tx1).unwrap();
        let _pane2 = manager.create_pane(&session_id, PaneType::Terminal, tx2).unwrap();
        
        // Try to create one more
        let result = manager.create_pane(&session_id, PaneType::Terminal, tx3);
        assert!(result.is_err());
        
        match result.unwrap_err() {
            MuxdError::ResourceLimit { resource, limit } => {
                assert_eq!(resource, "panes per session");
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
        let (tx1, _rx1) = mpsc::unbounded_channel::<Bytes>();
        let (tx2, _rx2) = mpsc::unbounded_channel::<Bytes>();
        
        let pane1 = manager.create_pane(&session_id, PaneType::Terminal, tx1).unwrap();
        let pane2 = manager.create_pane(&session_id, PaneType::Custom("editor".to_string()), tx2).unwrap();
        
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
        let (tx1, _rx1) = mpsc::unbounded_channel::<Bytes>();
        let (tx2, _rx2) = mpsc::unbounded_channel::<Bytes>();
        
        let pane1 = manager.create_pane(&session_id, PaneType::Terminal, tx1).unwrap();
        let pane2 = manager.create_pane(&session_id, PaneType::Terminal, tx2).unwrap();
        
        // Set active pane
        manager.set_active_pane(&session_id, &pane2.id).unwrap();
        
        // Verify active pane through session
        let session = manager.get_session(&session_id).unwrap();
        let session_guard = session.read();
        assert_eq!(session_guard.active_pane, Some(pane2.id.clone()));
        drop(session_guard);
        
        // Switch active pane
        manager.set_active_pane(&session_id, &pane1.id).unwrap();
        let session_guard = session.read();
        assert_eq!(session_guard.active_pane, Some(pane1.id.clone()));
    }

    #[test]
    fn test_kill_pane() {
        let manager = create_test_manager();
        
        let session_id = manager.create_session("test-session".to_string()).unwrap();
        let (tx, _rx) = mpsc::unbounded_channel::<Bytes>();
        let pane = manager.create_pane(&session_id, PaneType::Terminal, tx).unwrap();
        
        // Kill pane
        manager.kill_pane(&session_id, &pane.id).unwrap();
        
        // Verify pane is gone
        let panes = manager.list_panes(&session_id).unwrap();
        assert_eq!(panes.len(), 0);
        
        // Try to get killed pane
        let result = manager.get_pane(&session_id, &pane.id);
        assert!(result.is_err());
    }

    #[test]
    fn test_close_session() {
        let manager = create_test_manager();
        
        let session_id = manager.create_session("test-session".to_string()).unwrap();
        
        // Create some panes
        let (tx1, _rx1) = mpsc::unbounded_channel::<Bytes>();
        let (tx2, _rx2) = mpsc::unbounded_channel::<Bytes>();
        
        manager.create_pane(&session_id, PaneType::Terminal, tx1).unwrap();
        manager.create_pane(&session_id, PaneType::Custom("editor".to_string()), tx2).unwrap();
        
        // Delete session
        manager.delete_session(&session_id).unwrap();
        
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