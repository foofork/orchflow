use super::backend::{MuxBackend, MuxError, Pane, PaneSize, Session, SplitType};
use async_trait::async_trait;
use chrono::Utc;
use log::{debug, info};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Mock implementation of MuxBackend for testing
#[derive(Clone)]
pub struct MockBackend {
    sessions: Arc<RwLock<HashMap<String, Session>>>,
    panes: Arc<RwLock<HashMap<String, MockPane>>>,
    next_pane_id: Arc<RwLock<u32>>,
    /// If true, operations will fail with errors
    fail_mode: Arc<RwLock<bool>>,
    /// Track command history for assertions
    command_history: Arc<RwLock<Vec<(String, String)>>>, // (pane_id, command)
}

#[derive(Clone, Debug)]
struct MockPane {
    pane: Pane,
    output: String,
}

impl MockBackend {
    pub fn new() -> Self {
        info!("Creating new MockBackend instance");
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            panes: Arc::new(RwLock::new(HashMap::new())),
            next_pane_id: Arc::new(RwLock::new(1)),
            fail_mode: Arc::new(RwLock::new(false)),
            command_history: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Enable fail mode for testing error conditions
    pub async fn set_fail_mode(&self, fail: bool) {
        *self.fail_mode.write().await = fail;
    }

    /// Get command history for testing assertions
    pub async fn get_command_history(&self) -> Vec<(String, String)> {
        self.command_history.read().await.clone()
    }

    /// Clear all data (useful between tests)
    pub async fn clear(&self) {
        self.sessions.write().await.clear();
        self.panes.write().await.clear();
        *self.next_pane_id.write().await = 1;
        self.command_history.write().await.clear();
    }

    /// Set output for a specific pane (for testing capture_pane)
    pub async fn set_pane_output(&self, pane_id: &str, output: &str) -> Result<(), MuxError> {
        let mut panes = self.panes.write().await;
        if let Some(mock_pane) = panes.get_mut(pane_id) {
            mock_pane.output = output.to_string();
            Ok(())
        } else {
            Err(MuxError::pane_not_found(pane_id))
        }
    }
}

#[async_trait]
impl MuxBackend for MockBackend {
    async fn create_session(&self, name: &str) -> Result<String, MuxError> {
        debug!("MockBackend: create_session({})", name);

        if *self.fail_mode.read().await {
            return Err(MuxError::session_creation_failed(
                "Mock failure mode enabled",
            ));
        }

        // Validate name
        if name.is_empty() {
            return Err(MuxError::invalid_state("Session name cannot be empty"));
        }

        let mut sessions = self.sessions.write().await;

        // Check if session already exists
        if sessions.values().any(|s| s.name == name) {
            return Err(MuxError::session_creation_failed(format!(
                "Session '{}' already exists",
                name
            )));
        }

        let session = Session {
            id: format!("mock-session-{}", name),
            name: name.to_string(),
            created_at: Utc::now(),
            window_count: 1,
            attached: false,
        };

        sessions.insert(session.id.clone(), session.clone());
        info!("MockBackend: Created session '{}'", name);
        Ok(session.id)
    }

    async fn create_pane(&self, session_id: &str, split: SplitType) -> Result<String, MuxError> {
        debug!("MockBackend: create_pane({}, {:?})", session_id, split);

        if *self.fail_mode.read().await {
            return Err(MuxError::command_failed("Mock failure mode enabled"));
        }

        // Verify session exists
        let sessions = self.sessions.read().await;
        if !sessions.contains_key(session_id) {
            return Err(MuxError::session_not_found(session_id));
        }

        let mut pane_id_counter = self.next_pane_id.write().await;
        let pane_id = format!("mock-pane-{}", *pane_id_counter);
        *pane_id_counter += 1;

        let pane = Pane {
            id: pane_id.clone(),
            session_id: session_id.to_string(),
            index: *pane_id_counter - 1,
            title: "Mock Terminal".to_string(),
            active: true,
            size: PaneSize {
                width: 80,
                height: 24,
            },
        };

        let mock_pane = MockPane {
            pane: pane.clone(),
            output: String::new(),
        };

        self.panes.write().await.insert(pane_id.clone(), mock_pane);
        info!(
            "MockBackend: Created pane '{}' in session '{}'",
            pane_id, session_id
        );
        Ok(pane_id)
    }

    async fn send_keys(&self, pane_id: &str, keys: &str) -> Result<(), MuxError> {
        debug!("MockBackend: send_keys({}, {})", pane_id, keys);

        if *self.fail_mode.read().await {
            return Err(MuxError::command_failed("Mock failure mode enabled"));
        }

        let mut panes = self.panes.write().await;
        if let Some(mock_pane) = panes.get_mut(pane_id) {
            // Simulate command execution by appending to output
            mock_pane.output.push_str(&format!("$ {}\n", keys));

            // Simple command simulation
            if keys.starts_with("echo ") {
                let output = keys.trim_start_matches("echo ").trim();
                mock_pane.output.push_str(&format!("{}\n", output));
            } else if keys == "pwd" {
                mock_pane.output.push_str("/mock/working/directory\n");
            } else if keys == "ls" {
                mock_pane
                    .output
                    .push_str("file1.txt\nfile2.txt\ndirectory/\n");
            }

            // Track command history
            self.command_history
                .write()
                .await
                .push((pane_id.to_string(), keys.to_string()));

            Ok(())
        } else {
            Err(MuxError::pane_not_found(pane_id))
        }
    }

    async fn capture_pane(&self, pane_id: &str) -> Result<String, MuxError> {
        debug!("MockBackend: capture_pane({})", pane_id);

        if *self.fail_mode.read().await {
            return Err(MuxError::command_failed("Mock failure mode enabled"));
        }

        let panes = self.panes.read().await;
        if let Some(mock_pane) = panes.get(pane_id) {
            Ok(mock_pane.output.clone())
        } else {
            Err(MuxError::pane_not_found(pane_id))
        }
    }

    async fn list_sessions(&self) -> Result<Vec<Session>, MuxError> {
        debug!("MockBackend: list_sessions()");

        if *self.fail_mode.read().await {
            return Err(MuxError::command_failed("Mock failure mode enabled"));
        }

        let sessions = self.sessions.read().await;
        Ok(sessions.values().cloned().collect())
    }

    async fn kill_session(&self, session_id: &str) -> Result<(), MuxError> {
        debug!("MockBackend: kill_session({})", session_id);

        if *self.fail_mode.read().await {
            return Err(MuxError::command_failed("Mock failure mode enabled"));
        }

        let mut sessions = self.sessions.write().await;
        if sessions.remove(session_id).is_some() {
            // Remove all panes belonging to this session
            let mut panes = self.panes.write().await;
            panes.retain(|_, mock_pane| mock_pane.pane.session_id != session_id);

            info!("MockBackend: Killed session '{}'", session_id);
            Ok(())
        } else {
            Err(MuxError::session_not_found(session_id))
        }
    }

    async fn kill_pane(&self, pane_id: &str) -> Result<(), MuxError> {
        debug!("MockBackend: kill_pane({})", pane_id);

        if *self.fail_mode.read().await {
            return Err(MuxError::command_failed("Mock failure mode enabled"));
        }

        let mut panes = self.panes.write().await;
        if panes.remove(pane_id).is_some() {
            info!("MockBackend: Killed pane '{}'", pane_id);
            Ok(())
        } else {
            Err(MuxError::pane_not_found(pane_id))
        }
    }

    async fn resize_pane(&self, pane_id: &str, size: PaneSize) -> Result<(), MuxError> {
        debug!("MockBackend: resize_pane({}, {:?})", pane_id, size);

        if *self.fail_mode.read().await {
            return Err(MuxError::command_failed("Mock failure mode enabled"));
        }

        if size.width == 0 || size.height == 0 {
            return Err(MuxError::invalid_state("Invalid pane size"));
        }

        let mut panes = self.panes.write().await;
        if let Some(mock_pane) = panes.get_mut(pane_id) {
            mock_pane.pane.size = size;
            info!(
                "MockBackend: Resized pane '{}' to {}x{}",
                pane_id, size.width, size.height
            );
            Ok(())
        } else {
            Err(MuxError::pane_not_found(pane_id))
        }
    }

    async fn select_pane(&self, pane_id: &str) -> Result<(), MuxError> {
        debug!("MockBackend: select_pane({})", pane_id);

        if *self.fail_mode.read().await {
            return Err(MuxError::command_failed("Mock failure mode enabled"));
        }

        let mut panes = self.panes.write().await;

        // First check if pane exists
        if !panes.contains_key(pane_id) {
            return Err(MuxError::pane_not_found(pane_id));
        }

        // Deactivate all panes in the same session
        let session_id = panes.get(pane_id).unwrap().pane.session_id.clone();
        for (_, mock_pane) in panes.iter_mut() {
            if mock_pane.pane.session_id == session_id {
                mock_pane.pane.active = false;
            }
        }

        // Activate the selected pane
        if let Some(mock_pane) = panes.get_mut(pane_id) {
            mock_pane.pane.active = true;
            info!("MockBackend: Selected pane '{}'", pane_id);
            Ok(())
        } else {
            Err(MuxError::pane_not_found(pane_id))
        }
    }

    async fn list_panes(&self, session_id: &str) -> Result<Vec<Pane>, MuxError> {
        debug!("MockBackend: list_panes({})", session_id);

        if *self.fail_mode.read().await {
            return Err(MuxError::command_failed("Mock failure mode enabled"));
        }

        // Verify session exists
        let sessions = self.sessions.read().await;
        if !sessions.contains_key(session_id) {
            return Err(MuxError::session_not_found(session_id));
        }

        let panes = self.panes.read().await;
        let session_panes: Vec<Pane> = panes
            .values()
            .filter(|mp| mp.pane.session_id == session_id)
            .map(|mp| mp.pane.clone())
            .collect();

        Ok(session_panes)
    }

    async fn attach_session(&self, session_id: &str) -> Result<(), MuxError> {
        debug!("MockBackend: attach_session({})", session_id);

        if *self.fail_mode.read().await {
            return Err(MuxError::command_failed("Mock failure mode enabled"));
        }

        let mut sessions = self.sessions.write().await;
        if let Some(session) = sessions.get_mut(session_id) {
            session.attached = true;
            info!("MockBackend: Attached to session '{}'", session_id);
            Ok(())
        } else {
            Err(MuxError::session_not_found(session_id))
        }
    }

    async fn detach_session(&self, session_id: &str) -> Result<(), MuxError> {
        debug!("MockBackend: detach_session({})", session_id);

        if *self.fail_mode.read().await {
            return Err(MuxError::command_failed("Mock failure mode enabled"));
        }

        let mut sessions = self.sessions.write().await;
        if let Some(session) = sessions.get_mut(session_id) {
            session.attached = false;
            info!("MockBackend: Detached from session '{}'", session_id);
            Ok(())
        } else {
            Err(MuxError::session_not_found(session_id))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_mock_backend_basic_operations() {
        let backend = MockBackend::new();

        // Create session
        let session_id = backend.create_session("test").await.unwrap();
        assert_eq!(session_id, "mock-session-test");

        // List sessions
        let sessions = backend.list_sessions().await.unwrap();
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].name, "test");

        // Create pane
        let pane_id = backend
            .create_pane(&session_id, SplitType::None)
            .await
            .unwrap();
        assert!(pane_id.starts_with("mock-pane-"));

        // Send keys
        backend.send_keys(&pane_id, "echo hello").await.unwrap();

        // Capture output
        let output = backend.capture_pane(&pane_id).await.unwrap();
        assert!(output.contains("$ echo hello"));
        assert!(output.contains("hello"));

        // Clean up
        backend.kill_session(&session_id).await.unwrap();
    }

    #[tokio::test]
    async fn test_mock_backend_fail_mode() {
        let backend = MockBackend::new();
        backend.set_fail_mode(true).await;

        // All operations should fail
        assert!(backend.create_session("test").await.is_err());
        assert!(backend.list_sessions().await.is_err());
    }

    #[tokio::test]
    async fn test_mock_backend_command_history() {
        let backend = MockBackend::new();

        let session_id = backend.create_session("test").await.unwrap();
        let pane_id = backend
            .create_pane(&session_id, SplitType::None)
            .await
            .unwrap();

        backend.send_keys(&pane_id, "command1").await.unwrap();
        backend.send_keys(&pane_id, "command2").await.unwrap();

        let history = backend.get_command_history().await;
        assert_eq!(history.len(), 2);
        assert_eq!(history[0].1, "command1");
        assert_eq!(history[1].1, "command2");
    }
}
