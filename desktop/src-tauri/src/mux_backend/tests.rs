use super::*;
use async_trait::async_trait;
use std::collections::HashMap;
use tokio::sync::Mutex;
use std::sync::Arc;

/// Mock implementation for testing
#[derive(Clone)]
struct MockBackend {
    sessions: Arc<Mutex<HashMap<String, Session>>>,
    panes: Arc<Mutex<HashMap<String, Pane>>>,
    outputs: Arc<Mutex<HashMap<String, Vec<String>>>>,
    fail_next: Arc<Mutex<bool>>,
}

impl MockBackend {
    fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            panes: Arc::new(Mutex::new(HashMap::new())),
            outputs: Arc::new(Mutex::new(HashMap::new())),
            fail_next: Arc::new(Mutex::new(false)),
        }
    }
    
    async fn set_fail_next(&self, fail: bool) {
        *self.fail_next.lock().await = fail;
    }
}

#[async_trait]
impl MuxBackend for MockBackend {
    async fn create_session(&self, name: &str) -> Result<String, MuxError> {
        if *self.fail_next.lock().await {
            *self.fail_next.lock().await = false;
            return Err(MuxError::SessionCreationFailed(format!("Mock failure for {}", name)));
        }
        
        let session_id = format!("session_{}", name);
        let session = Session {
            id: session_id.clone(),
            name: name.to_string(),
            created_at: chrono::Utc::now(),
            window_count: 1,
            attached: false,
        };
        
        self.sessions.lock().await.insert(session_id.clone(), session);
        Ok(session_id)
    }
    
    async fn create_pane(&self, session_id: &str, _split: SplitType) -> Result<String, MuxError> {
        if !self.sessions.lock().await.contains_key(session_id) {
            return Err(MuxError::SessionNotFound(session_id.to_string()));
        }
        
        let pane_id = format!("{}:pane_{}", session_id, self.panes.lock().await.len());
        let pane = Pane {
            id: pane_id.clone(),
            session_id: session_id.to_string(),
            index: self.panes.lock().await.len() as u32,
            title: String::new(),
            active: false,
            size: PaneSize { width: 80, height: 24 },
        };
        
        self.panes.lock().await.insert(pane_id.clone(), pane);
        Ok(pane_id)
    }
    
    async fn send_keys(&self, pane_id: &str, keys: &str) -> Result<(), MuxError> {
        if !self.panes.lock().await.contains_key(pane_id) {
            return Err(MuxError::PaneNotFound(pane_id.to_string()));
        }
        
        let mut outputs = self.outputs.lock().await;
        outputs.entry(pane_id.to_string())
            .or_insert_with(Vec::new)
            .push(keys.to_string());
        Ok(())
    }
    
    async fn capture_pane(&self, pane_id: &str) -> Result<String, MuxError> {
        if !self.panes.lock().await.contains_key(pane_id) {
            return Err(MuxError::PaneNotFound(pane_id.to_string()));
        }
        
        let outputs = self.outputs.lock().await;
        Ok(outputs.get(pane_id)
            .map(|v| v.join("\n"))
            .unwrap_or_default())
    }
    
    async fn list_sessions(&self) -> Result<Vec<Session>, MuxError> {
        Ok(self.sessions.lock().await.values().cloned().collect())
    }
    
    async fn kill_session(&self, session_id: &str) -> Result<(), MuxError> {
        if self.sessions.lock().await.remove(session_id).is_none() {
            return Err(MuxError::SessionNotFound(session_id.to_string()));
        }
        
        // Remove all panes for this session
        let mut panes = self.panes.lock().await;
        let pane_ids: Vec<_> = panes.iter()
            .filter(|(_, p)| p.session_id == session_id)
            .map(|(id, _)| id.clone())
            .collect();
        
        for pane_id in pane_ids {
            panes.remove(&pane_id);
            self.outputs.lock().await.remove(&pane_id);
        }
        
        Ok(())
    }
    
    async fn kill_pane(&self, pane_id: &str) -> Result<(), MuxError> {
        if self.panes.lock().await.remove(pane_id).is_none() {
            return Err(MuxError::PaneNotFound(pane_id.to_string()));
        }
        self.outputs.lock().await.remove(pane_id);
        Ok(())
    }
    
    async fn resize_pane(&self, pane_id: &str, size: PaneSize) -> Result<(), MuxError> {
        let mut panes = self.panes.lock().await;
        match panes.get_mut(pane_id) {
            Some(pane) => {
                pane.size = size;
                Ok(())
            }
            None => Err(MuxError::PaneNotFound(pane_id.to_string()))
        }
    }
    
    async fn select_pane(&self, pane_id: &str) -> Result<(), MuxError> {
        let mut panes = self.panes.lock().await;
        
        // First check if pane exists
        if !panes.contains_key(pane_id) {
            return Err(MuxError::PaneNotFound(pane_id.to_string()));
        }
        
        // Deactivate all panes
        for pane in panes.values_mut() {
            pane.active = false;
        }
        
        // Activate selected pane
        if let Some(pane) = panes.get_mut(pane_id) {
            pane.active = true;
        }
        
        Ok(())
    }
    
    async fn list_panes(&self, session_id: &str) -> Result<Vec<Pane>, MuxError> {
        if !self.sessions.lock().await.contains_key(session_id) {
            return Err(MuxError::SessionNotFound(session_id.to_string()));
        }
        
        Ok(self.panes.lock().await
            .values()
            .filter(|p| p.session_id == session_id)
            .cloned()
            .collect())
    }
    
    async fn attach_session(&self, session_id: &str) -> Result<(), MuxError> {
        let mut sessions = self.sessions.lock().await;
        match sessions.get_mut(session_id) {
            Some(session) => {
                session.attached = true;
                Ok(())
            }
            None => Err(MuxError::SessionNotFound(session_id.to_string()))
        }
    }
    
    async fn detach_session(&self, session_id: &str) -> Result<(), MuxError> {
        let mut sessions = self.sessions.lock().await;
        match sessions.get_mut(session_id) {
            Some(session) => {
                session.attached = false;
                Ok(())
            }
            None => Err(MuxError::SessionNotFound(session_id.to_string()))
        }
    }
}

#[cfg(test)]
mod backend_tests {
    use super::*;
    
    #[tokio::test]
    async fn test_create_session() {
        let backend = MockBackend::new();
        
        // Test successful session creation
        let session_id = backend.create_session("test").await.unwrap();
        assert_eq!(session_id, "session_test");
        
        // Verify session exists
        let sessions = backend.list_sessions().await.unwrap();
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].name, "test");
    }
    
    #[tokio::test]
    async fn test_create_session_failure() {
        let backend = MockBackend::new();
        backend.set_fail_next(true).await;
        
        let result = backend.create_session("test").await;
        assert!(result.is_err());
        match result {
            Err(MuxError::SessionCreationFailed(msg)) => {
                assert!(msg.contains("Mock failure"));
            }
            _ => panic!("Expected SessionCreationFailed error"),
        }
    }
    
    #[tokio::test]
    async fn test_create_and_manage_panes() {
        let backend = MockBackend::new();
        
        // Create session first
        let session_id = backend.create_session("test").await.unwrap();
        
        // Create panes
        let _pane1 = backend.create_pane(&session_id, SplitType::Horizontal).await.unwrap();
        let pane2 = backend.create_pane(&session_id, SplitType::Vertical).await.unwrap();
        
        // List panes
        let panes = backend.list_panes(&session_id).await.unwrap();
        assert_eq!(panes.len(), 2);
        
        // Test pane selection
        backend.select_pane(&pane2).await.unwrap();
        let panes = backend.list_panes(&session_id).await.unwrap();
        let active_pane = panes.iter().find(|p| p.active).unwrap();
        assert_eq!(active_pane.id, pane2);
    }
    
    #[tokio::test]
    async fn test_send_keys_and_capture() {
        let backend = MockBackend::new();
        
        let session_id = backend.create_session("test").await.unwrap();
        let pane_id = backend.create_pane(&session_id, SplitType::None).await.unwrap();
        
        // Send keys
        backend.send_keys(&pane_id, "echo hello").await.unwrap();
        backend.send_keys(&pane_id, "echo world").await.unwrap();
        
        // Capture output
        let output = backend.capture_pane(&pane_id).await.unwrap();
        assert_eq!(output, "echo hello\necho world");
    }
    
    #[tokio::test]
    async fn test_resize_pane() {
        let backend = MockBackend::new();
        
        let session_id = backend.create_session("test").await.unwrap();
        let pane_id = backend.create_pane(&session_id, SplitType::None).await.unwrap();
        
        // Resize pane
        let new_size = PaneSize { width: 120, height: 40 };
        backend.resize_pane(&pane_id, new_size).await.unwrap();
        
        // Verify size changed
        let panes = backend.list_panes(&session_id).await.unwrap();
        let pane = panes.iter().find(|p| p.id == pane_id).unwrap();
        assert_eq!(pane.size.width, 120);
        assert_eq!(pane.size.height, 40);
    }
    
    #[tokio::test]
    async fn test_kill_operations() {
        let backend = MockBackend::new();
        
        let session_id = backend.create_session("test").await.unwrap();
        let pane_id = backend.create_pane(&session_id, SplitType::None).await.unwrap();
        
        // Kill pane
        backend.kill_pane(&pane_id).await.unwrap();
        let panes = backend.list_panes(&session_id).await.unwrap();
        assert_eq!(panes.len(), 0);
        
        // Kill session
        backend.kill_session(&session_id).await.unwrap();
        let sessions = backend.list_sessions().await.unwrap();
        assert_eq!(sessions.len(), 0);
    }
    
    #[tokio::test]
    async fn test_attach_detach_session() {
        let backend = MockBackend::new();
        
        let session_id = backend.create_session("test").await.unwrap();
        
        // Initially not attached
        let sessions = backend.list_sessions().await.unwrap();
        assert!(!sessions[0].attached);
        
        // Attach
        backend.attach_session(&session_id).await.unwrap();
        let sessions = backend.list_sessions().await.unwrap();
        assert!(sessions[0].attached);
        
        // Detach
        backend.detach_session(&session_id).await.unwrap();
        let sessions = backend.list_sessions().await.unwrap();
        assert!(!sessions[0].attached);
    }
    
    #[tokio::test]
    async fn test_error_handling() {
        let backend = MockBackend::new();
        
        // Try to create pane in non-existent session
        let result = backend.create_pane("fake_session", SplitType::None).await;
        assert!(matches!(result, Err(MuxError::SessionNotFound(_))));
        
        // Try to send keys to non-existent pane
        let result = backend.send_keys("fake_pane", "test").await;
        assert!(matches!(result, Err(MuxError::PaneNotFound(_))));
        
        // Try to kill non-existent session
        let result = backend.kill_session("fake_session").await;
        assert!(matches!(result, Err(MuxError::SessionNotFound(_))));
    }
}