use super::backend::{MuxBackend, MuxError, Pane, PaneSize, Session, SplitType};
use crate::tmux::{TmuxError as OldTmuxError, TmuxManager, TmuxSession};
use async_trait::async_trait;
use log::{debug, error, info, warn};
use std::sync::Arc;
use tokio::sync::Mutex;

/// Tmux implementation of MuxBackend
#[derive(Clone)]
pub struct TmuxBackend {
    tmux_manager: Arc<Mutex<TmuxManager>>,
}

impl TmuxBackend {
    pub fn new() -> Self {
        info!("Creating new TmuxBackend instance");
        Self {
            tmux_manager: Arc::new(Mutex::new(TmuxManager::new())),
        }
    }

    /// Convert old TmuxError to new MuxError
    fn convert_error(err: OldTmuxError) -> MuxError {
        error!("TmuxError: {}", err.message);
        MuxError::Other(err.message)
    }

    /// Convert TmuxSession to Session
    fn convert_session(tmux_session: TmuxSession) -> Session {
        Session {
            id: tmux_session.name.clone(), // Use name as ID for now
            name: tmux_session.name,
            created_at: chrono::Utc::now(), // Parse from tmux_session.created if needed
            window_count: tmux_session.windows.len(),
            attached: tmux_session.attached,
        }
    }

    /// Execute a tmux command directly (for operations not in TmuxManager)
    async fn tmux_command(&self, args: Vec<&str>) -> Result<String, MuxError> {
        debug!("Executing tmux command: {:?}", args);

        // Build the command with the socket path from home directory
        let mut socket_path = home::home_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
        socket_path.push(".orchflow");
        socket_path.push("tmux.sock");

        debug!("Using tmux socket path: {:?}", socket_path);

        let output = tokio::process::Command::new("tmux")
            .arg("-S")
            .arg(&socket_path)
            .args(&args)
            .output()
            .await
            .map_err(|e| {
                error!("Failed to execute tmux command: {}", e);
                MuxError::command_failed(format!("Failed to execute tmux: {}", e))
            })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            error!("Tmux command failed with stderr: {}", stderr);

            // Check for common error patterns
            if stderr.contains("session not found") || stderr.contains("can't find session") {
                return Err(MuxError::session_not_found(stderr.trim().to_string()));
            } else if stderr.contains("pane not found") || stderr.contains("can't find pane") {
                return Err(MuxError::pane_not_found(stderr.trim().to_string()));
            } else if stderr.contains("server not found") || stderr.contains("no server running") {
                return Err(MuxError::backend_unavailable("Tmux server is not running"));
            }

            return Err(MuxError::command_failed(format!(
                "Tmux command failed: {}",
                stderr
            )));
        }

        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        debug!("Tmux command output: {}", stdout);
        Ok(stdout)
    }
}

#[async_trait]
impl MuxBackend for TmuxBackend {
    async fn create_session(&self, name: &str) -> Result<String, MuxError> {
        // Validate session name
        if name.is_empty() {
            error!("Attempted to create session with empty name");
            return Err(MuxError::invalid_state("Session name cannot be empty"));
        }

        if name.contains(':') || name.contains('.') {
            error!(
                "Invalid session name '{}': contains illegal characters",
                name
            );
            return Err(MuxError::invalid_state(format!(
                "Session name '{}' contains illegal characters (: or .)",
                name
            )));
        }

        info!("Creating tmux session: {}", name);
        let manager = self.tmux_manager.lock().await;
        let session = manager.create_session(name).map_err(|e| {
            error!("Failed to create session '{}': {:?}", name, e);
            Self::convert_error(e)
        })?;
        info!("Successfully created session: {}", session.name);
        Ok(session.name) // Return name as ID
    }

    async fn create_pane(&self, session_id: &str, split: SplitType) -> Result<String, MuxError> {
        info!(
            "Creating pane in session '{}' with split type: {:?}",
            session_id, split
        );
        let manager = self.tmux_manager.lock().await;
        // TmuxManager's create_pane takes session and optional command
        // TODO: Handle split type properly
        if !matches!(split, SplitType::None) {
            warn!(
                "Split type {:?} not yet implemented, using default split",
                split
            );
        }
        let pane = manager.create_pane(session_id, None).map_err(|e| {
            error!("Failed to create pane in session '{}': {:?}", session_id, e);
            Self::convert_error(e)
        })?;
        info!("Successfully created pane: {}", pane.id);
        Ok(pane.id)
    }

    async fn send_keys(&self, pane_id: &str, keys: &str) -> Result<(), MuxError> {
        if pane_id.is_empty() {
            return Err(MuxError::invalid_state("Pane ID cannot be empty"));
        }

        if keys.len() > 10000 {
            warn!(
                "Sending very large key sequence ({} chars) to pane '{}'",
                keys.len(),
                pane_id
            );
        }

        debug!(
            "Sending keys to pane '{}': {}",
            pane_id,
            if keys.len() > 100 {
                format!("{}... ({} chars total)", &keys[..100], keys.len())
            } else {
                keys.to_string()
            }
        );

        let manager = self.tmux_manager.lock().await;
        manager.send_keys(pane_id, keys).map_err(|e| {
            error!("Failed to send keys to pane '{}': {:?}", pane_id, e);
            Self::convert_error(e)
        })?;
        debug!("Successfully sent keys to pane '{}'", pane_id);
        Ok(())
    }

    async fn capture_pane(&self, pane_id: &str) -> Result<String, MuxError> {
        debug!("Capturing content from pane: {}", pane_id);
        let manager = self.tmux_manager.lock().await;
        let content = manager.capture_pane(pane_id, None).map_err(|e| {
            error!("Failed to capture pane '{}': {:?}", pane_id, e);
            Self::convert_error(e)
        })?;
        debug!("Captured {} bytes from pane '{}'", content.len(), pane_id);
        Ok(content)
    }

    async fn list_sessions(&self) -> Result<Vec<Session>, MuxError> {
        debug!("Listing all tmux sessions");
        let manager = self.tmux_manager.lock().await;
        let tmux_sessions = manager.list_sessions().map_err(|e| {
            error!("Failed to list sessions: {:?}", e);
            Self::convert_error(e)
        })?;
        let session_count = tmux_sessions.len();
        let sessions: Vec<Session> = tmux_sessions
            .into_iter()
            .map(Self::convert_session)
            .collect();
        info!("Found {} tmux sessions", session_count);
        Ok(sessions)
    }

    async fn kill_session(&self, session_id: &str) -> Result<(), MuxError> {
        info!("Killing tmux session: {}", session_id);
        self.tmux_command(vec!["kill-session", "-t", session_id])
            .await
            .map_err(|e| {
                error!("Failed to kill session '{}': {:?}", session_id, e);
                e
            })?;
        info!("Successfully killed session: {}", session_id);
        Ok(())
    }

    async fn kill_pane(&self, pane_id: &str) -> Result<(), MuxError> {
        info!("Killing tmux pane: {}", pane_id);
        let manager = self.tmux_manager.lock().await;
        manager.kill_pane(pane_id).map_err(|e| {
            error!("Failed to kill pane '{}': {:?}", pane_id, e);
            Self::convert_error(e)
        })?;
        info!("Successfully killed pane: {}", pane_id);
        Ok(())
    }

    async fn resize_pane(&self, pane_id: &str, size: PaneSize) -> Result<(), MuxError> {
        if size.width == 0 || size.height == 0 {
            error!("Invalid pane size: {}x{}", size.width, size.height);
            return Err(MuxError::invalid_state(format!(
                "Invalid pane size: {}x{} (dimensions must be > 0)",
                size.width, size.height
            )));
        }

        if size.width > 9999 || size.height > 9999 {
            warn!(
                "Very large pane size requested: {}x{}",
                size.width, size.height
            );
        }

        info!(
            "Resizing pane '{}' to {}x{}",
            pane_id, size.width, size.height
        );
        let manager = self.tmux_manager.lock().await;
        manager
            .resize_pane(pane_id, size.width as i32, size.height as i32)
            .map_err(|e| {
                error!("Failed to resize pane '{}': {:?}", pane_id, e);
                Self::convert_error(e)
            })?;
        info!("Successfully resized pane '{}'", pane_id);
        Ok(())
    }

    async fn select_pane(&self, pane_id: &str) -> Result<(), MuxError> {
        info!("Selecting (focusing) pane: {}", pane_id);
        self.tmux_command(vec!["select-pane", "-t", pane_id])
            .await
            .map_err(|e| {
                error!("Failed to select pane '{}': {:?}", pane_id, e);
                e
            })?;
        info!("Successfully selected pane: {}", pane_id);
        Ok(())
    }

    async fn list_panes(&self, session_id: &str) -> Result<Vec<Pane>, MuxError> {
        debug!("Listing panes in session: {}", session_id);

        // List panes with format: pane_id:index:width:height:active:title
        let output = self.tmux_command(vec![
            "list-panes",
            "-t", session_id,
            "-F", "#{pane_id}:#{pane_index}:#{pane_width}:#{pane_height}:#{pane_active}:#{pane_title}"
        ]).await
        .map_err(|e| {
            error!("Failed to list panes for session '{}': {:?}", session_id, e);
            e
        })?;

        let mut panes = Vec::new();
        for line in output.lines() {
            let parts: Vec<&str> = line.split(':').collect();
            if parts.len() >= 6 {
                let pane = Pane {
                    id: parts[0].to_string(),
                    session_id: session_id.to_string(),
                    index: parts[1].parse().unwrap_or_else(|e| {
                        warn!("Failed to parse pane index '{}': {:?}", parts[1], e);
                        0
                    }),
                    title: parts[5].to_string(),
                    active: parts[4] == "1",
                    size: PaneSize {
                        width: parts[2].parse().unwrap_or_else(|e| {
                            warn!("Failed to parse pane width '{}': {:?}", parts[2], e);
                            80
                        }),
                        height: parts[3].parse().unwrap_or_else(|e| {
                            warn!("Failed to parse pane height '{}': {:?}", parts[3], e);
                            24
                        }),
                    },
                };
                debug!("Found pane: {:?}", pane);
                panes.push(pane);
            } else {
                warn!("Invalid pane format in line: {}", line);
            }
        }

        info!("Found {} panes in session '{}'", panes.len(), session_id);
        Ok(panes)
    }

    async fn attach_session(&self, session_id: &str) -> Result<(), MuxError> {
        warn!("Attempting to attach to session '{}'. Note: This may not work in non-interactive contexts", session_id);

        // Note: attach-session is typically interactive, so this might not work as expected
        // in a non-interactive context. For now, we'll implement it for completeness.
        self.tmux_command(vec!["attach-session", "-t", session_id])
            .await
            .map_err(|e| {
                error!("Failed to attach to session '{}': {:?}", session_id, e);
                e
            })?;
        info!("Attach command sent for session: {}", session_id);
        Ok(())
    }

    async fn detach_session(&self, session_id: &str) -> Result<(), MuxError> {
        info!("Detaching all clients from session: {}", session_id);

        // Detach all clients from the session
        self.tmux_command(vec!["detach-client", "-s", session_id])
            .await
            .map_err(|e| {
                error!("Failed to detach from session '{}': {:?}", session_id, e);
                e
            })?;
        info!("Successfully detached from session: {}", session_id);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // These tests define the expected behavior for TmuxBackend
    // They will fail until we implement the backend properly

    #[tokio::test]
    #[ignore = "Requires tmux implementation"]
    async fn test_create_and_list_sessions() {
        let backend = TmuxBackend::new();

        // Create a test session
        let session_id = backend
            .create_session("test_session")
            .await
            .expect("Should create session");

        // Verify session exists in list
        let sessions = backend.list_sessions().await.expect("Should list sessions");

        assert!(sessions.iter().any(|s| s.name == "test_session"));

        // Clean up
        let _ = backend.kill_session(&session_id).await;
    }

    #[tokio::test]
    #[ignore = "Requires tmux implementation"]
    async fn test_pane_lifecycle() {
        let backend = TmuxBackend::new();

        // Create session
        let session_id = backend
            .create_session("pane_test")
            .await
            .expect("Should create session");

        // Create pane
        let pane_id = backend
            .create_pane(&session_id, SplitType::None)
            .await
            .expect("Should create pane");

        // List panes
        let panes = backend
            .list_panes(&session_id)
            .await
            .expect("Should list panes");
        assert_eq!(panes.len(), 1);

        // Send keys
        backend
            .send_keys(&pane_id, "echo hello")
            .await
            .expect("Should send keys");

        // Capture output (may need delay for command to execute)
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let output = backend
            .capture_pane(&pane_id)
            .await
            .expect("Should capture pane");
        assert!(output.contains("hello") || output.contains("echo"));

        // Clean up
        let _ = backend.kill_session(&session_id).await;
    }

    #[tokio::test]
    #[ignore = "Requires tmux implementation"]
    async fn test_pane_resize() {
        let backend = TmuxBackend::new();

        let session_id = backend
            .create_session("resize_test")
            .await
            .expect("Should create session");

        let pane_id = backend
            .create_pane(&session_id, SplitType::None)
            .await
            .expect("Should create pane");

        // Resize pane
        let new_size = PaneSize {
            width: 100,
            height: 30,
        };
        backend
            .resize_pane(&pane_id, new_size)
            .await
            .expect("Should resize pane");

        // Verify size (would need to query tmux)
        let panes = backend
            .list_panes(&session_id)
            .await
            .expect("Should list panes");

        // Note: Actual size verification would require parsing tmux output
        assert_eq!(panes.len(), 1);

        // Clean up
        let _ = backend.kill_session(&session_id).await;
    }

    #[tokio::test]
    #[ignore = "Requires tmux implementation"]
    async fn test_error_handling() {
        let backend = TmuxBackend::new();

        // Try to create pane in non-existent session
        let result = backend
            .create_pane("non_existent_session", SplitType::None)
            .await;
        assert!(result.is_err());

        // Try to send keys to non-existent pane
        let result = backend.send_keys("non_existent_pane", "test").await;
        assert!(result.is_err());

        // Try to kill non-existent session
        let result = backend.kill_session("non_existent_session").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_basic_implementation_works() {
        let backend = TmuxBackend::new();
        // This should no longer panic but may error if tmux isn't available
        let result = backend.create_session("test").await;
        // We expect an error since we're not actually running tmux in tests
        assert!(result.is_err());
    }
}
