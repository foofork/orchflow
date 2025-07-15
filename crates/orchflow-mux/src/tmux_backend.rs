//! Tmux backend implementation for terminal multiplexing

use crate::backend::{MuxBackend, MuxError, Pane, PaneSize, Session, SplitType};
use async_trait::async_trait;
use chrono::Utc;
use std::process::Command;
use tracing::{debug, info};

/// Tmux implementation of MuxBackend
#[derive(Clone, Default)]
pub struct TmuxBackend;

impl TmuxBackend {
    pub fn new() -> Self {
        Self
    }

    /// Execute a tmux command
    async fn tmux_command(&self, args: &[&str]) -> Result<String, MuxError> {
        let output = tokio::task::spawn_blocking({
            let args = args.iter().map(|s| s.to_string()).collect::<Vec<_>>();
            move || Command::new("tmux").args(&args).output()
        })
        .await
        .map_err(|e| MuxError::Other(format!("Failed to spawn tmux command: {e}")))?
        .map_err(|e| MuxError::CommandFailed(format!("Failed to execute tmux: {e}")))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(MuxError::CommandFailed(format!(
                "tmux command failed: {stderr}"
            )));
        }

        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }
}

#[async_trait]
impl MuxBackend for TmuxBackend {
    async fn create_session(&self, name: &str) -> Result<String, MuxError> {
        info!("Creating tmux session: {}", name);

        // Create detached session
        self.tmux_command(&["new-session", "-d", "-s", name])
            .await?;

        Ok(name.to_string())
    }

    async fn create_pane(&self, session_id: &str, split: SplitType) -> Result<String, MuxError> {
        debug!(
            "Creating pane in session: {} with split: {:?}",
            session_id, split
        );

        let split_arg = match split {
            SplitType::Horizontal => "-v",
            SplitType::Vertical => "-h",
            SplitType::None => {
                return Err(MuxError::NotSupported(
                    "Split type None not supported".to_string(),
                ))
            }
        };

        let output = self
            .tmux_command(&[
                "split-window",
                split_arg,
                "-t",
                session_id,
                "-P",
                "-F",
                "#{pane_id}",
            ])
            .await?;

        Ok(output.trim().to_string())
    }

    async fn send_keys(&self, pane_id: &str, keys: &str) -> Result<(), MuxError> {
        debug!("Sending keys to pane {}: {}", pane_id, keys);

        self.tmux_command(&["send-keys", "-t", pane_id, keys, "Enter"])
            .await?;
        Ok(())
    }

    async fn capture_pane(&self, pane_id: &str) -> Result<String, MuxError> {
        debug!("Capturing pane: {}", pane_id);

        self.tmux_command(&["capture-pane", "-t", pane_id, "-p"])
            .await
    }

    async fn list_sessions(&self) -> Result<Vec<Session>, MuxError> {
        debug!("Listing tmux sessions");

        let output = self.tmux_command(&[
            "list-sessions",
            "-F", "#{session_id}:#{session_name}:#{session_created}:#{session_windows}:#{session_attached}"
        ]).await?;

        let sessions = output
            .lines()
            .filter(|line| !line.is_empty())
            .map(|line| {
                let parts: Vec<&str> = line.split(':').collect();
                if parts.len() >= 5 {
                    Session {
                        id: parts[0].trim_start_matches('$').to_string(),
                        name: parts[1].to_string(),
                        created_at: Utc::now(), // tmux timestamp parsing is complex
                        window_count: parts[3].parse().unwrap_or(0),
                        attached: parts[4] == "1",
                    }
                } else {
                    Session {
                        id: line.to_string(),
                        name: line.to_string(),
                        created_at: Utc::now(),
                        window_count: 0,
                        attached: false,
                    }
                }
            })
            .collect();

        Ok(sessions)
    }

    async fn kill_session(&self, session_id: &str) -> Result<(), MuxError> {
        info!("Killing tmux session: {}", session_id);

        self.tmux_command(&["kill-session", "-t", session_id])
            .await?;
        Ok(())
    }

    async fn kill_pane(&self, pane_id: &str) -> Result<(), MuxError> {
        debug!("Killing pane: {}", pane_id);

        self.tmux_command(&["kill-pane", "-t", pane_id]).await?;
        Ok(())
    }

    async fn resize_pane(&self, pane_id: &str, size: PaneSize) -> Result<(), MuxError> {
        debug!(
            "Resizing pane {} to {}x{}",
            pane_id, size.width, size.height
        );

        // tmux doesn't support absolute sizing easily, this is a simplified version
        Err(MuxError::NotSupported(
            "Absolute pane resizing not implemented for tmux".to_string(),
        ))
    }

    async fn select_pane(&self, pane_id: &str) -> Result<(), MuxError> {
        debug!("Selecting pane: {}", pane_id);

        self.tmux_command(&["select-pane", "-t", pane_id]).await?;
        Ok(())
    }

    async fn list_panes(&self, session_id: &str) -> Result<Vec<Pane>, MuxError> {
        debug!("Listing panes for session: {}", session_id);

        let output = self.tmux_command(&[
            "list-panes",
            "-t", session_id,
            "-F", "#{pane_id}:#{pane_index}:#{pane_title}:#{pane_active}:#{pane_width}:#{pane_height}"
        ]).await?;

        let panes = output
            .lines()
            .filter(|line| !line.is_empty())
            .map(|line| {
                let parts: Vec<&str> = line.split(':').collect();
                if parts.len() >= 6 {
                    Pane {
                        id: parts[0].to_string(),
                        session_id: session_id.to_string(),
                        index: parts[1].parse().unwrap_or(0),
                        title: parts[2].to_string(),
                        active: parts[3] == "1",
                        size: PaneSize {
                            width: parts[4].parse().unwrap_or(80),
                            height: parts[5].parse().unwrap_or(24),
                        },
                    }
                } else {
                    Pane {
                        id: line.to_string(),
                        session_id: session_id.to_string(),
                        index: 0,
                        title: String::new(),
                        active: false,
                        size: PaneSize {
                            width: 80,
                            height: 24,
                        },
                    }
                }
            })
            .collect();

        Ok(panes)
    }

    async fn attach_session(&self, session_id: &str) -> Result<(), MuxError> {
        info!("Attaching to tmux session: {}", session_id);

        // This would normally attach the current terminal to the session
        // For a library, we just verify the session exists
        self.tmux_command(&["has-session", "-t", session_id])
            .await?;
        Ok(())
    }

    async fn detach_session(&self, session_id: &str) -> Result<(), MuxError> {
        info!("Detaching from tmux session: {}", session_id);

        self.tmux_command(&["detach-client", "-s", session_id])
            .await?;
        Ok(())
    }
}
