use crate::error::{MuxdError, Result};
use crate::protocol::{SessionId, PaneId};
use crate::session::metadata::{RecoveryCommand, PaneRestartConfig, HealthCheck, HealthMonitoring};
use crate::session::{SessionManager, SessionMetadataManager};
use chrono::{DateTime, Utc, Duration};
use parking_lot::RwLock;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::time::{interval, timeout};
use tracing::{debug, error, info, warn};

/// Session recovery manager for handling session restoration and health monitoring
pub struct SessionRecoveryManager {
    /// Reference to session manager
    session_manager: Arc<SessionManager>,
    
    /// Reference to metadata manager
    metadata_manager: Arc<SessionMetadataManager>,
    
    /// Active recovery tasks
    recovery_tasks: Arc<RwLock<HashMap<SessionId, RecoveryTask>>>,
    
    /// Health monitoring tasks
    health_monitors: Arc<RwLock<HashMap<SessionId, HealthMonitor>>>,
    
    /// Recovery statistics
    recovery_stats: Arc<RwLock<RecoveryStatistics>>,
}

/// Recovery task state
#[derive(Debug, Clone)]
struct RecoveryTask {
    session_id: SessionId,
    status: RecoveryStatus,
    started_at: DateTime<Utc>,
    last_attempt: Option<DateTime<Utc>>,
    attempt_count: u32,
    errors: Vec<String>,
}

/// Recovery status
#[derive(Debug, Clone, PartialEq, Eq)]
enum RecoveryStatus {
    /// Recovery is pending
    Pending,
    /// Recovery is in progress
    InProgress,
    /// Recovery completed successfully
    Completed,
    /// Recovery failed after max attempts
    Failed,
    /// Recovery was cancelled
    Cancelled,
}

/// Health monitoring task
#[derive(Debug)]
struct HealthMonitor {
    session_id: SessionId,
    config: HealthMonitoring,
    last_check: Option<DateTime<Utc>>,
    consecutive_failures: u32,
    is_healthy: bool,
}

/// Recovery statistics
#[derive(Debug, Clone, Default)]
struct RecoveryStatistics {
    total_recoveries: u64,
    successful_recoveries: u64,
    failed_recoveries: u64,
    average_recovery_time_ms: u64,
    last_recovery: Option<DateTime<Utc>>,
}

impl SessionRecoveryManager {
    /// Create a new session recovery manager
    pub fn new(
        session_manager: Arc<SessionManager>,
        metadata_manager: Arc<SessionMetadataManager>,
    ) -> Self {
        Self {
            session_manager,
            metadata_manager,
            recovery_tasks: Arc::new(RwLock::new(HashMap::new())),
            health_monitors: Arc::new(RwLock::new(HashMap::new())),
            recovery_stats: Arc::new(RwLock::new(RecoveryStatistics::default())),
        }
    }
    
    /// Initialize the recovery manager and start background tasks
    pub async fn initialize(&self) -> Result<()> {
        // Start the health monitoring task
        self.start_health_monitoring().await;
        
        // Start the recovery cleanup task
        self.start_recovery_cleanup().await;
        
        info!("Session recovery manager initialized");
        Ok(())
    }
    
    /// Recover a session from metadata
    pub async fn recover_session(&self, session_id: &SessionId) -> Result<()> {
        let metadata = self.metadata_manager.get_metadata(session_id)
            .ok_or_else(|| MuxdError::SessionNotFound {
                session_id: session_id.to_string(),
            })?;
        
        if !metadata.recovery.auto_recover {
            return Err(MuxdError::InvalidRequest {
                reason: "Session recovery is not enabled".to_string(),
            });
        }
        
        // Create recovery task
        let task = RecoveryTask {
            session_id: session_id.clone(),
            status: RecoveryStatus::Pending,
            started_at: Utc::now(),
            last_attempt: None,
            attempt_count: 0,
            errors: Vec::new(),
        };
        
        self.recovery_tasks.write().insert(session_id.clone(), task);
        
        // Start recovery process
        self.execute_recovery(session_id).await
    }
    
    /// Execute the recovery process for a session
    async fn execute_recovery(&self, session_id: &SessionId) -> Result<()> {
        let start_time = Utc::now();
        
        // Update task status
        self.update_recovery_task(session_id, |task| {
            task.status = RecoveryStatus::InProgress;
            task.last_attempt = Some(Utc::now());
            task.attempt_count += 1;
        });
        
        let metadata = self.metadata_manager.get_metadata(session_id)
            .ok_or_else(|| MuxdError::SessionNotFound {
                session_id: session_id.to_string(),
            })?;
        
        // Execute recovery commands
        for command in &metadata.recovery.recovery_commands {
            if let Err(e) = self.execute_recovery_command(session_id, command).await {
                self.record_recovery_error(session_id, &format!("Recovery command failed: {}", e));
                warn!("Recovery command failed for session {}: {}", session_id, e);
            }
        }
        
        // Setup pane restart monitoring
        if metadata.recovery.pane_restart.auto_restart {
            self.setup_pane_restart_monitoring(session_id, &metadata.recovery.pane_restart).await?;
        }
        
        // Setup health monitoring if configured
        if let Some(health_config) = &metadata.recovery.health_monitoring {
            self.setup_health_monitoring(session_id, health_config.clone()).await?;
        }
        
        // Mark recovery as completed
        self.update_recovery_task(session_id, |task| {
            task.status = RecoveryStatus::Completed;
        });
        
        // Update recovery statistics
        let recovery_time = (Utc::now() - start_time).num_milliseconds() as u64;
        self.update_recovery_stats(true, recovery_time);
        
        info!("Session {} recovered successfully in {}ms", session_id, recovery_time);
        Ok(())
    }
    
    /// Execute a recovery command
    async fn execute_recovery_command(
        &self,
        session_id: &SessionId,
        command: &RecoveryCommand,
    ) -> Result<()> {
        let timeout_duration = command.timeout_seconds
            .map(|s| std::time::Duration::from_secs(s))
            .unwrap_or(std::time::Duration::from_secs(30));
        
        // If target pane is specified, execute in that pane
        if let Some(target_pane_id) = &command.target_pane {
            let pane = self.session_manager.get_pane(session_id, target_pane_id)?;
            
            let command_bytes = format!("{}\n", command.command).into_bytes();
            let execution = async {
                pane.write(&command_bytes)
            };
            
            timeout(timeout_duration, execution).await
                .map_err(|_| MuxdError::InvalidRequest {
                    reason: "Recovery command timed out".to_string(),
                })?
        } else {
            // Create a new pane for the command
            let output_tx = tokio::sync::mpsc::unbounded_channel().0;
            let pane = self.session_manager.create_pane(
                session_id,
                crate::protocol::PaneType::Terminal,
                output_tx,
            )?;
            
            // Start the pane with the recovery command
            let mut env = command.env.clone();
            if let Some(wd) = &command.working_dir {
                env.insert("PWD".to_string(), wd.clone());
            }
            
            let execution = async {
                pane.start(
                    Some(command.command.clone()),
                    command.working_dir.clone(),
                    env,
                    None,
                ).await
            };
            
            timeout(timeout_duration, execution).await
                .map_err(|_| MuxdError::InvalidRequest {
                    reason: "Recovery command timed out".to_string(),
                })??;
            
            Ok(())
        }
    }
    
    /// Setup pane restart monitoring
    async fn setup_pane_restart_monitoring(
        &self,
        session_id: &SessionId,
        config: &PaneRestartConfig,
    ) -> Result<()> {
        let session_id_clone = session_id.clone();
        let config = config.clone();
        let session_manager = self.session_manager.clone();
        
        tokio::spawn(async move {
            let mut check_interval = interval(std::time::Duration::from_secs(5));
            let mut restart_counts: HashMap<PaneId, u32> = HashMap::new();
            
            loop {
                check_interval.tick().await;
                
                // Get current panes
                if let Ok(panes) = session_manager.list_panes(&session_id_clone) {
                    for pane in panes {
                        if !pane.is_alive() {
                            let restart_count = restart_counts.entry(pane.id.clone()).or_insert(0);
                            
                            if *restart_count < config.max_restarts {
                                // Attempt to restart the pane
                                if let Some(persistent_command) = config.persistent_commands.get(&pane.id) {
                                    info!("Restarting pane {} with command: {}", pane.id, persistent_command);
                                    
                                    let env = std::collections::HashMap::new();
                                    if config.preserve_environment {
                                        // TODO: Restore environment from metadata
                                    }
                                    
                                    // Wait for restart delay
                                    tokio::time::sleep(std::time::Duration::from_secs(config.restart_delay)).await;
                                    
                                    match pane.start(
                                        Some(persistent_command.clone()),
                                        pane.working_dir(),
                                        env,
                                        Some(pane.size()),
                                    ).await {
                                        Ok(_) => {
                                            *restart_count += 1;
                                            info!("Successfully restarted pane {} (attempt {})", pane.id, restart_count);
                                        }
                                        Err(e) => {
                                            error!("Failed to restart pane {}: {}", pane.id, e);
                                            *restart_count += 1;
                                        }
                                    }
                                }
                            } else {
                                warn!("Pane {} exceeded maximum restart attempts ({})", pane.id, config.max_restarts);
                                restart_counts.remove(&pane.id);
                            }
                        }
                    }
                } else {
                    // Session no longer exists, exit monitoring
                    break;
                }
            }
        });
        
        debug!("Setup pane restart monitoring for session {}", session_id);
        Ok(())
    }
    
    /// Setup health monitoring for a session
    async fn setup_health_monitoring(
        &self,
        session_id: &SessionId,
        config: HealthMonitoring,
    ) -> Result<()> {
        let monitor = HealthMonitor {
            session_id: session_id.clone(),
            config: config.clone(),
            last_check: None,
            consecutive_failures: 0,
            is_healthy: true,
        };
        
        self.health_monitors.write().insert(session_id.clone(), monitor);
        
        let session_id_clone = session_id.clone();
        let session_manager = self.session_manager.clone();
        let health_monitors = self.health_monitors.clone();
        
        tokio::spawn(async move {
            let mut check_interval = interval(std::time::Duration::from_secs(config.check_interval));
            
            loop {
                check_interval.tick().await;
                
                // Perform health checks
                let mut all_healthy = true;
                for health_check in &config.health_checks {
                    match Self::execute_health_check(&session_manager, &session_id_clone, health_check).await {
                        Ok(is_healthy) => {
                            if !is_healthy {
                                all_healthy = false;
                                warn!("Health check '{}' failed for session {}", health_check.name, session_id_clone);
                            }
                        }
                        Err(e) => {
                            all_healthy = false;
                            error!("Health check '{}' error for session {}: {}", health_check.name, session_id_clone, e);
                        }
                    }
                }
                
                // Update monitor state (separate scope to avoid holding lock across await)
                let should_execute_recovery = {
                    let mut monitors = health_monitors.write();
                    if let Some(monitor) = monitors.get_mut(&session_id_clone) {
                        monitor.last_check = Some(Utc::now());
                        
                        if all_healthy {
                            monitor.consecutive_failures = 0;
                            monitor.is_healthy = true;
                            false
                        } else {
                            monitor.consecutive_failures += 1;
                            monitor.is_healthy = false;
                            true
                        }
                    } else {
                        false
                    }
                };
                
                // Execute recovery actions if needed (outside of lock)
                if should_execute_recovery {
                    for action in &config.recovery_actions {
                        if let Err(e) = Self::execute_recovery_action(&session_manager, &session_id_clone, action).await {
                            error!("Recovery action failed for session {}: {}", session_id_clone, e);
                        }
                    }
                }
                
                // Check if session still exists
                if session_manager.get_session(&session_id_clone).is_none() {
                    health_monitors.write().remove(&session_id_clone);
                    break;
                }
            }
        });
        
        debug!("Setup health monitoring for session {}", session_id);
        Ok(())
    }
    
    /// Execute a health check
    async fn execute_health_check(
        _session_manager: &Arc<SessionManager>,
        _session_id: &SessionId,
        _health_check: &HealthCheck,
    ) -> Result<bool> {
        // Simplified health check - just return healthy for now
        // In a real implementation, this would execute the health check command
        // and verify the exit code
        Ok(true)
    }
    
    /// Execute a recovery action
    async fn execute_recovery_action(
        _session_manager: &Arc<SessionManager>,
        session_id: &SessionId,
        _action: &crate::session::metadata::RecoveryAction,
    ) -> Result<()> {
        // For now, just log the action
        // In a real implementation, this would perform the specific recovery action
        debug!("Executing recovery action for session {}", session_id);
        Ok(())
    }
    
    /// Get recovery status for a session
    pub fn get_recovery_status(&self, session_id: &SessionId) -> Option<RecoveryStatus> {
        self.recovery_tasks.read().get(session_id).map(|task| task.status.clone())
    }
    
    /// Get recovery statistics
    pub fn get_recovery_statistics(&self) -> RecoveryStatistics {
        self.recovery_stats.read().clone()
    }
    
    /// Cancel recovery for a session
    pub fn cancel_recovery(&self, session_id: &SessionId) -> Result<()> {
        self.update_recovery_task(session_id, |task| {
            task.status = RecoveryStatus::Cancelled;
        });
        
        info!("Cancelled recovery for session {}", session_id);
        Ok(())
    }
    
    /// Get health status for a session
    pub fn get_health_status(&self, session_id: &SessionId) -> Option<bool> {
        self.health_monitors.read().get(session_id).map(|monitor| monitor.is_healthy)
    }
    
    /// Update a recovery task
    fn update_recovery_task<F>(&self, session_id: &SessionId, update_fn: F)
    where
        F: FnOnce(&mut RecoveryTask),
    {
        if let Some(task) = self.recovery_tasks.write().get_mut(session_id) {
            update_fn(task);
        }
    }
    
    /// Record a recovery error
    fn record_recovery_error(&self, session_id: &SessionId, error: &str) {
        self.update_recovery_task(session_id, |task| {
            task.errors.push(error.to_string());
        });
    }
    
    /// Update recovery statistics
    fn update_recovery_stats(&self, success: bool, recovery_time_ms: u64) {
        let mut stats = self.recovery_stats.write();
        stats.total_recoveries += 1;
        
        if success {
            stats.successful_recoveries += 1;
        } else {
            stats.failed_recoveries += 1;
        }
        
        // Update average recovery time
        let total_successful = stats.successful_recoveries;
        if total_successful > 0 {
            stats.average_recovery_time_ms = 
                (stats.average_recovery_time_ms * (total_successful - 1) + recovery_time_ms) / total_successful;
        }
        
        stats.last_recovery = Some(Utc::now());
    }
    
    /// Start background health monitoring task
    async fn start_health_monitoring(&self) {
        let health_monitors = self.health_monitors.clone();
        let session_manager = self.session_manager.clone();
        
        tokio::spawn(async move {
            let mut cleanup_interval = interval(std::time::Duration::from_secs(60));
            
            loop {
                cleanup_interval.tick().await;
                
                // Clean up monitors for non-existent sessions
                let monitors_to_remove: Vec<SessionId> = {
                    let monitors = health_monitors.read();
                    monitors.keys()
                        .filter(|session_id| session_manager.get_session(session_id).is_none())
                        .cloned()
                        .collect()
                };
                
                if !monitors_to_remove.is_empty() {
                    let mut monitors = health_monitors.write();
                    for session_id in monitors_to_remove {
                        monitors.remove(&session_id);
                        debug!("Removed health monitor for non-existent session {}", session_id);
                    }
                }
            }
        });
    }
    
    /// Start background recovery cleanup task
    async fn start_recovery_cleanup(&self) {
        let recovery_tasks = self.recovery_tasks.clone();
        
        tokio::spawn(async move {
            let mut cleanup_interval = interval(std::time::Duration::from_secs(300)); // 5 minutes
            
            loop {
                cleanup_interval.tick().await;
                
                // Clean up old completed/failed recovery tasks
                let cutoff_time = Utc::now() - Duration::hours(1);
                let tasks_to_remove: Vec<SessionId> = {
                    let tasks = recovery_tasks.read();
                    tasks.iter()
                        .filter(|(_, task)| {
                            (task.status == RecoveryStatus::Completed || 
                             task.status == RecoveryStatus::Failed ||
                             task.status == RecoveryStatus::Cancelled) &&
                            task.started_at < cutoff_time
                        })
                        .map(|(session_id, _)| session_id.clone())
                        .collect()
                };
                
                if !tasks_to_remove.is_empty() {
                    let mut tasks = recovery_tasks.write();
                    for session_id in tasks_to_remove {
                        tasks.remove(&session_id);
                        debug!("Cleaned up old recovery task for session {}", session_id);
                    }
                }
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use crate::session::{SessionManager, SessionMetadataManager};
    use crate::state::StatePersistence;
    
    #[tokio::test]
    async fn test_recovery_manager_creation() {
        let temp_dir = tempdir().unwrap();
        let state_persistence = Arc::new(StatePersistence::new(temp_dir.path().to_path_buf()));
        let session_manager = Arc::new(SessionManager::with_persistence(10, 10, state_persistence));
        let metadata_manager = Arc::new(SessionMetadataManager::new(temp_dir.path().to_path_buf()));
        
        let recovery_manager = SessionRecoveryManager::new(session_manager, metadata_manager);
        assert!(recovery_manager.initialize().await.is_ok());
    }
    
    #[tokio::test]
    async fn test_recovery_status_tracking() {
        let temp_dir = tempdir().unwrap();
        let state_persistence = Arc::new(StatePersistence::new(temp_dir.path().to_path_buf()));
        let session_manager = Arc::new(SessionManager::with_persistence(10, 10, state_persistence));
        let metadata_manager = Arc::new(SessionMetadataManager::new(temp_dir.path().to_path_buf()));
        metadata_manager.initialize().await.unwrap();
        
        let recovery_manager = SessionRecoveryManager::new(session_manager.clone(), metadata_manager.clone());
        recovery_manager.initialize().await.unwrap();
        
        // Create a session with recovery enabled
        let session_id = session_manager.create_session("Test Session".to_string()).unwrap();
        metadata_manager.create_metadata(session_id.clone(), "Test Session".to_string()).await.unwrap();
        
        metadata_manager.update_metadata(&session_id, |metadata| {
            metadata.recovery.auto_recover = true;
        }).await.unwrap();
        
        // Test recovery
        assert!(recovery_manager.recover_session(&session_id).await.is_ok());
        
        // Check status
        let status = recovery_manager.get_recovery_status(&session_id);
        assert!(status.is_some());
    }
    
    #[tokio::test]
    async fn test_recovery_statistics() {
        let temp_dir = tempdir().unwrap();
        let state_persistence = Arc::new(StatePersistence::new(temp_dir.path().to_path_buf()));
        let session_manager = Arc::new(SessionManager::with_persistence(10, 10, state_persistence));
        let metadata_manager = Arc::new(SessionMetadataManager::new(temp_dir.path().to_path_buf()));
        
        let recovery_manager = SessionRecoveryManager::new(session_manager, metadata_manager);
        recovery_manager.initialize().await.unwrap();
        
        // Test initial statistics
        let stats = recovery_manager.get_recovery_statistics();
        assert_eq!(stats.total_recoveries, 0);
        assert_eq!(stats.successful_recoveries, 0);
        assert_eq!(stats.failed_recoveries, 0);
        
        // Simulate a successful recovery
        recovery_manager.update_recovery_stats(true, 1000);
        let stats = recovery_manager.get_recovery_statistics();
        assert_eq!(stats.total_recoveries, 1);
        assert_eq!(stats.successful_recoveries, 1);
        assert_eq!(stats.average_recovery_time_ms, 1000);
    }
}