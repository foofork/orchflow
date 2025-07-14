// Terminal Security Manager Implementation
//
// Provides configurable security mechanisms for terminal operations
// with support for multiple security tiers and granular controls.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use regex::Regex;
use chrono::{DateTime, Utc};
use crate::error::{OrchflowError, Result};

/// Security tier levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[repr(u8)]
pub enum SecurityTier {
    /// Unrestricted - for trusted local development
    Unrestricted = 0,
    /// Basic - command history sanitization, credential masking
    Basic = 1,
    /// Enhanced - command filtering, directory restrictions
    Enhanced = 2,
    /// Restricted - strict allowlisting, read-only access
    Restricted = 3,
    /// Isolated - full process isolation, containerized
    Isolated = 4,
}

/// Command security policy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandSecurityPolicy {
    pub mode: CommandSecurityMode,
    pub allowlist: Vec<CommandPattern>,
    pub denylist: Vec<CommandPattern>,
    pub require_confirmation: Vec<CommandPattern>,
    pub audit_commands: bool,
    pub mask_sensitive_args: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CommandSecurityMode {
    Unrestricted,
    AllowlistOnly,
    DenylistFilter,
    Interactive,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandPattern {
    pub pattern: String,
    #[serde(skip)]
    pub regex: Option<Regex>,
    pub is_regex: bool,
    pub risk_level: RiskLevel,
    pub reason: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

/// Result of command security check
#[derive(Debug)]
pub enum CommandCheckResult {
    Allow,
    Deny(String),
    RequireConfirmation(SecurityWarning),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityWarning {
    pub message: String,
    pub risk_level: RiskLevel,
    pub risk_factors: Vec<String>,
    pub matched_pattern: Option<String>,
}

/// Process isolation configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessIsolationConfig {
    pub enabled: bool,
    pub isolation_type: IsolationType,
    pub resource_limits: ResourceLimits,
    pub network_policy: NetworkPolicy,
    pub filesystem_policy: FilesystemPolicy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IsolationType {
    None,
    ProcessNamespace,
    Container { image: String },
    VM { config: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLimits {
    pub max_memory_mb: Option<u64>,
    pub max_cpu_percent: Option<f32>,
    pub max_processes: Option<u32>,
    pub max_open_files: Option<u32>,
    pub execution_timeout_sec: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkPolicy {
    pub allow_network: bool,
    pub allowed_hosts: Vec<String>,
    pub blocked_ports: Vec<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilesystemPolicy {
    pub read_only: bool,
    pub allowed_paths: Vec<PathBuf>,
    pub temp_dir_only: bool,
}

/// Workspace trust configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceTrustConfig {
    pub enabled: bool,
    pub trust_on_first_use: bool,
    pub trusted_paths: Vec<PathBuf>,
    pub parent_folder_trust: bool,
    pub untrusted_restrictions: UntrustedRestrictions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UntrustedRestrictions {
    pub disable_task_running: bool,
    pub disable_debugging: bool,
    pub disable_terminal_creation: bool,
    pub restrict_terminal_commands: bool,
    pub disable_workspace_extensions: bool,
}

/// Complete security context for a terminal
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityContext {
    pub tier: SecurityTier,
    pub command_policy: CommandSecurityPolicy,
    pub isolation: ProcessIsolationConfig,
    pub workspace_trust: WorkspaceTrustConfig,
    pub audit_config: AuditConfig,
}

/// Audit configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditConfig {
    pub enabled: bool,
    pub log_level: AuditLogLevel,
    pub destinations: Vec<AuditDestination>,
    pub retention_days: u32,
    pub encrypt_logs: bool,
    pub exclude_patterns: Vec<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum AuditLogLevel {
    CommandsOnly,
    CommandsAndOutput,
    Full,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuditDestination {
    File { path: PathBuf },
    Syslog { endpoint: String },
    Database { connection_string: String },
}

/// Audit event structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub event_type: AuditEventType,
    pub user: String,
    pub session_id: String,
    pub terminal_id: Option<String>,
    pub command: Option<String>,
    pub working_dir: Option<PathBuf>,
    pub environment: Option<HashMap<String, String>>,
    pub risk_score: u8,
    pub outcome: AuditOutcome,
    pub details: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuditEventType {
    TerminalCreated,
    CommandExecuted,
    CommandBlocked,
    SecurityViolation,
    ConfigurationChanged,
    PluginLoaded,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuditOutcome {
    Success,
    Denied,
    Failed,
    RequiresConfirmation,
}

/// Main terminal security manager
pub struct TerminalSecurityManager {
    contexts: Arc<RwLock<HashMap<String, SecurityContext>>>,
    default_context: SecurityContext,
    audit_logger: Option<Arc<dyn AuditLogger>>,
    session_lookup: Option<Arc<dyn SessionLookup>>,
    workspace_trust_store: Arc<RwLock<WorkspaceTrustStore>>,
}

/// Trait for audit logging implementations
#[async_trait::async_trait]
pub trait AuditLogger: Send + Sync {
    async fn log(&self, event: AuditEvent) -> Result<()>;
    async fn query(&self, filter: AuditFilter) -> Result<Vec<AuditEvent>>;
}

/// Trait for looking up session information from terminal/pane IDs
#[async_trait::async_trait]
pub trait SessionLookup: Send + Sync {
    async fn get_session_id_for_terminal(&self, terminal_id: &str) -> Option<String>;
}

/// Implementation of SessionLookup using the StateManager
pub struct StateManagerSessionLookup {
    state_manager: Arc<crate::state_manager::StateManager>,
}

impl StateManagerSessionLookup {
    pub fn new(state_manager: Arc<crate::state_manager::StateManager>) -> Self {
        Self { state_manager }
    }
}

#[async_trait::async_trait]
impl SessionLookup for StateManagerSessionLookup {
    async fn get_session_id_for_terminal(&self, terminal_id: &str) -> Option<String> {
        // Try to get the pane first (terminal_id might be a pane_id)
        if let Some(pane) = self.state_manager.get_pane(terminal_id).await {
            return Some(pane.session_id);
        }
        
        // If not found as pane_id, search all panes for one with backend_id matching terminal_id
        let all_panes = self.state_manager.list_all_panes().await;
        for pane in all_panes {
            if let Some(backend_id) = &pane.backend_id {
                if backend_id == terminal_id {
                    return Some(pane.session_id);
                }
            }
        }
        
        None
    }
}

/// Workspace trust store
pub struct WorkspaceTrustStore {
    trusted_workspaces: HashMap<PathBuf, TrustDecision>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrustDecision {
    pub path: PathBuf,
    pub trusted: bool,
    pub timestamp: DateTime<Utc>,
    pub reason: String,
}

/// Audit query filter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditFilter {
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
    pub event_types: Option<Vec<AuditEventType>>,
    pub terminal_id: Option<String>,
    pub risk_level_min: Option<u8>,
}

impl TerminalSecurityManager {
    /// Create a new security manager with default configuration
    pub fn new(default_tier: SecurityTier) -> Self {
        Self {
            contexts: Arc::new(RwLock::new(HashMap::new())),
            default_context: SecurityContext::default_for_tier(default_tier),
            audit_logger: None,
            session_lookup: None,
            workspace_trust_store: Arc::new(RwLock::new(WorkspaceTrustStore {
                trusted_workspaces: HashMap::new(),
            })),
        }
    }
    
    /// Set audit logger implementation
    pub fn with_audit_logger(mut self, logger: Arc<dyn AuditLogger>) -> Self {
        self.audit_logger = Some(logger);
        self
    }
    
    /// Set session lookup implementation
    pub fn with_session_lookup(mut self, session_lookup: Arc<dyn SessionLookup>) -> Self {
        self.session_lookup = Some(session_lookup);
        self
    }
    
    /// Get session ID for a terminal, returning empty string if not found
    async fn get_session_id(&self, terminal_id: &str) -> String {
        match &self.session_lookup {
            Some(lookup) => lookup.get_session_id_for_terminal(terminal_id).await.unwrap_or_default(),
            None => String::new(),
        }
    }
    
    /// Create security context for a new terminal
    pub async fn create_context(
        &self,
        terminal_id: &str,
        workspace_path: Option<&Path>,
        override_tier: Option<SecurityTier>,
    ) -> Result<SecurityContext> {
        // Check workspace trust if enabled
        let mut context = self.default_context.clone();
        
        if let Some(path) = workspace_path {
            if context.workspace_trust.enabled {
                let trusted = self.is_workspace_trusted(path).await?;
                if !trusted {
                    // Apply untrusted restrictions
                    context = self.apply_untrusted_restrictions(context);
                }
            }
        }
        
        // Apply tier override if provided
        if let Some(tier) = override_tier {
            context.tier = tier;
            context = context.adjust_for_tier(tier);
        }
        
        // Store context
        self.contexts.write().await.insert(terminal_id.to_string(), context.clone());
        
        // Audit terminal creation
        if let Some(logger) = &self.audit_logger {
            let session_id = self.get_session_id(terminal_id).await;
            let event = AuditEvent {
                id: uuid::Uuid::new_v4().to_string(),
                timestamp: Utc::now(),
                event_type: AuditEventType::TerminalCreated,
                user: whoami::username(),
                session_id,
                terminal_id: Some(terminal_id.to_string()),
                command: None,
                working_dir: workspace_path.map(|p| p.to_path_buf()),
                environment: None,
                risk_score: context.tier as u8,
                outcome: AuditOutcome::Success,
                details: None,
            };
            let _ = logger.log(event).await;
        }
        
        Ok(context)
    }
    
    /// Check if a command is allowed to execute
    pub async fn check_command(
        &self,
        terminal_id: &str,
        command: &str,
        working_dir: Option<&Path>,
    ) -> Result<CommandCheckResult> {
        let contexts = self.contexts.read().await;
        let context = contexts.get(terminal_id)
            .ok_or_else(|| OrchflowError::SecurityError {
                reason: "No security context for terminal".to_string(),
            })?;
        
        // Tier 0: Unrestricted
        if context.tier == SecurityTier::Unrestricted {
            return Ok(CommandCheckResult::Allow);
        }
        
        // Check command against policy
        let result = self.evaluate_command(command, &context.command_policy)?;
        
        // Audit if needed
        if context.audit_config.enabled && !self.should_exclude_from_audit(command, &context.audit_config) {
            if let Some(logger) = &self.audit_logger {
                let session_id = self.get_session_id(terminal_id).await;
                let event = AuditEvent {
                    id: uuid::Uuid::new_v4().to_string(),
                    timestamp: Utc::now(),
                    event_type: match &result {
                        CommandCheckResult::Allow => AuditEventType::CommandExecuted,
                        CommandCheckResult::Deny(_) => AuditEventType::CommandBlocked,
                        CommandCheckResult::RequireConfirmation(_) => AuditEventType::CommandExecuted,
                    },
                    user: whoami::username(),
                    session_id,
                    terminal_id: Some(terminal_id.to_string()),
                    command: Some(command.to_string()),
                    working_dir: working_dir.map(|p| p.to_path_buf()),
                    environment: None,
                    risk_score: self.calculate_risk_score(command, &result),
                    outcome: match &result {
                        CommandCheckResult::Allow => AuditOutcome::Success,
                        CommandCheckResult::Deny(_) => AuditOutcome::Denied,
                        CommandCheckResult::RequireConfirmation(_) => AuditOutcome::RequiresConfirmation,
                    },
                    details: None,
                };
                let _ = logger.log(event).await;
            }
        }
        
        Ok(result)
    }
    
    /// Evaluate command against security policy
    fn evaluate_command(
        &self,
        command: &str,
        policy: &CommandSecurityPolicy,
    ) -> Result<CommandCheckResult> {
        // First check denylist
        for pattern in &policy.denylist {
            if self.matches_pattern(command, pattern)? {
                return Ok(CommandCheckResult::Deny(pattern.reason.clone()));
            }
        }
        
        // Check if confirmation required
        for pattern in &policy.require_confirmation {
            if self.matches_pattern(command, pattern)? {
                return Ok(CommandCheckResult::RequireConfirmation(SecurityWarning {
                    message: format!("This command matches a security pattern: {}", pattern.reason),
                    risk_level: pattern.risk_level,
                    risk_factors: self.analyze_risk_factors(command),
                    matched_pattern: Some(pattern.pattern.clone()),
                }));
            }
        }
        
        // Check allowlist if in allowlist-only mode
        if policy.mode == CommandSecurityMode::AllowlistOnly {
            let allowed = policy.allowlist.iter().any(|pattern| {
                self.matches_pattern(command, pattern).unwrap_or(false)
            });
            
            if !allowed {
                return Ok(CommandCheckResult::Deny(
                    "Command not in allowlist".to_string()
                ));
            }
        }
        
        Ok(CommandCheckResult::Allow)
    }
    
    /// Check if command matches a pattern
    fn matches_pattern(&self, command: &str, pattern: &CommandPattern) -> Result<bool> {
        if pattern.is_regex {
            // Use regex matching
            let re = Regex::new(&pattern.pattern)
                .map_err(|e| OrchflowError::ValidationError {
                    field: "pattern".to_string(),
                    reason: e.to_string(),
                })?;
            Ok(re.is_match(command))
        } else {
            // Simple string matching
            Ok(command.contains(&pattern.pattern))
        }
    }
    
    /// Analyze risk factors in a command
    fn analyze_risk_factors(&self, command: &str) -> Vec<String> {
        let mut factors = Vec::new();
        
        // Check for sudo/admin elevation
        if command.starts_with("sudo") || command.contains("| sudo") {
            factors.push("Requests administrative privileges".to_string());
        }
        
        // Check for remote execution
        if command.contains("curl") && command.contains("| bash") {
            factors.push("Executes remote script".to_string());
        }
        
        // Check for system modification
        if command.contains("rm -rf") || command.contains("dd if=") {
            factors.push("Can modify or destroy system files".to_string());
        }
        
        // Check for network operations
        if command.contains("nc ") || command.contains("netcat") {
            factors.push("Opens network connections".to_string());
        }
        
        // Check for credential exposure risk
        if command.contains("env") || command.contains("printenv") {
            factors.push("May expose environment variables".to_string());
        }
        
        factors
    }
    
    /// Calculate risk score for audit
    fn calculate_risk_score(&self, command: &str, result: &CommandCheckResult) -> u8 {
        let base_score = match result {
            CommandCheckResult::Allow => 0,
            CommandCheckResult::Deny(_) => 80,
            CommandCheckResult::RequireConfirmation(warning) => {
                match warning.risk_level {
                    RiskLevel::Low => 20,
                    RiskLevel::Medium => 40,
                    RiskLevel::High => 60,
                    RiskLevel::Critical => 80,
                }
            }
        };
        
        // Add factors
        let mut score = base_score;
        if command.contains("sudo") {
            score += 10;
        }
        if command.contains("rm ") {
            score += 5;
        }
        
        score.min(100)
    }
    
    /// Check if command should be excluded from audit
    fn should_exclude_from_audit(&self, command: &str, config: &AuditConfig) -> bool {
        config.exclude_patterns.iter().any(|pattern| {
            command.starts_with(pattern) || command == pattern
        })
    }
    
    /// Check if workspace is trusted
    async fn is_workspace_trusted(&self, path: &Path) -> Result<bool> {
        let store = self.workspace_trust_store.read().await;
        
        // Check exact path
        if let Some(decision) = store.trusted_workspaces.get(path) {
            return Ok(decision.trusted);
        }
        
        // Check parent paths if enabled
        if self.default_context.workspace_trust.parent_folder_trust {
            let mut current = path.parent();
            while let Some(parent) = current {
                if let Some(decision) = store.trusted_workspaces.get(parent) {
                    return Ok(decision.trusted);
                }
                current = parent.parent();
            }
        }
        
        // Check against trusted paths list
        for trusted_path in &self.default_context.workspace_trust.trusted_paths {
            if path.starts_with(trusted_path) {
                return Ok(true);
            }
        }
        
        Ok(false)
    }
    
    /// Apply untrusted workspace restrictions
    fn apply_untrusted_restrictions(&self, mut context: SecurityContext) -> SecurityContext {
        let restrictions = &context.workspace_trust.untrusted_restrictions;
        
        if restrictions.restrict_terminal_commands {
            // Switch to restrictive command mode
            context.command_policy.mode = CommandSecurityMode::AllowlistOnly;
            
            // Set basic safe commands allowlist
            context.command_policy.allowlist = vec![
                CommandPattern {
                    pattern: "ls".to_string(),
                    regex: None,
                    is_regex: false,
                    risk_level: RiskLevel::Low,
                    reason: "List files".to_string(),
                },
                CommandPattern {
                    pattern: "pwd".to_string(),
                    regex: None,
                    is_regex: false,
                    risk_level: RiskLevel::Low,
                    reason: "Show working directory".to_string(),
                },
                CommandPattern {
                    pattern: "cd ".to_string(),
                    regex: None,
                    is_regex: false,
                    risk_level: RiskLevel::Low,
                    reason: "Change directory".to_string(),
                },
                CommandPattern {
                    pattern: "cat ".to_string(),
                    regex: None,
                    is_regex: false,
                    risk_level: RiskLevel::Low,
                    reason: "View file contents".to_string(),
                },
            ];
        }
        
        context
    }
}

impl SecurityContext {
    /// Create default context for a security tier
    pub fn default_for_tier(tier: SecurityTier) -> Self {
        match tier {
            SecurityTier::Unrestricted => Self::unrestricted(),
            SecurityTier::Basic => Self::basic(),
            SecurityTier::Enhanced => Self::enhanced(),
            SecurityTier::Restricted => Self::restricted(),
            SecurityTier::Isolated => Self::isolated(),
        }
    }
    
    /// Unrestricted tier configuration
    fn unrestricted() -> Self {
        Self {
            tier: SecurityTier::Unrestricted,
            command_policy: CommandSecurityPolicy {
                mode: CommandSecurityMode::Unrestricted,
                allowlist: vec![],
                denylist: vec![],
                require_confirmation: vec![],
                audit_commands: false,
                mask_sensitive_args: false,
            },
            isolation: ProcessIsolationConfig {
                enabled: false,
                isolation_type: IsolationType::None,
                resource_limits: ResourceLimits::unlimited(),
                network_policy: NetworkPolicy::unrestricted(),
                filesystem_policy: FilesystemPolicy::unrestricted(),
            },
            workspace_trust: WorkspaceTrustConfig {
                enabled: false,
                trust_on_first_use: true,
                trusted_paths: vec![],
                parent_folder_trust: true,
                untrusted_restrictions: UntrustedRestrictions::none(),
            },
            audit_config: AuditConfig {
                enabled: false,
                log_level: AuditLogLevel::CommandsOnly,
                destinations: vec![],
                retention_days: 7,
                encrypt_logs: false,
                exclude_patterns: vec![],
            },
        }
    }
    
    /// Basic tier configuration
    fn basic() -> Self {
        Self {
            tier: SecurityTier::Basic,
            command_policy: CommandSecurityPolicy {
                mode: CommandSecurityMode::DenylistFilter,
                allowlist: vec![],
                denylist: vec![
                    CommandPattern {
                        pattern: "rm -rf /".to_string(),
                        regex: None,
                        is_regex: false,
                        risk_level: RiskLevel::Critical,
                        reason: "Dangerous recursive deletion of root".to_string(),
                    },
                ],
                require_confirmation: vec![
                    CommandPattern {
                        pattern: r"curl .* \| .*sh".to_string(),
                        regex: None,
                        is_regex: true,
                        risk_level: RiskLevel::High,
                        reason: "Executing remote scripts".to_string(),
                    },
                ],
                audit_commands: true,
                mask_sensitive_args: true,
            },
            isolation: ProcessIsolationConfig {
                enabled: false,
                isolation_type: IsolationType::None,
                resource_limits: ResourceLimits::unlimited(),
                network_policy: NetworkPolicy::unrestricted(),
                filesystem_policy: FilesystemPolicy::unrestricted(),
            },
            workspace_trust: WorkspaceTrustConfig {
                enabled: true,
                trust_on_first_use: true,
                trusted_paths: vec![],
                parent_folder_trust: true,
                untrusted_restrictions: UntrustedRestrictions::basic(),
            },
            audit_config: AuditConfig {
                enabled: true,
                log_level: AuditLogLevel::CommandsOnly,
                destinations: vec![],
                retention_days: 30,
                encrypt_logs: false,
                exclude_patterns: vec![
                    "ls".to_string(),
                    "pwd".to_string(),
                    "cd ".to_string(),
                ],
            },
        }
    }
    
    /// Enhanced tier configuration
    fn enhanced() -> Self {
        let mut basic = Self::basic();
        basic.tier = SecurityTier::Enhanced;
        
        // Add more restrictions
        basic.command_policy.denylist.extend(vec![
            CommandPattern {
                pattern: ":(){ :|:& };:".to_string(),
                regex: None,
                is_regex: false,
                risk_level: RiskLevel::Critical,
                reason: "Fork bomb".to_string(),
            },
            CommandPattern {
                pattern: "dd if=/dev/zero".to_string(),
                regex: None,
                is_regex: false,
                risk_level: RiskLevel::High,
                reason: "Disk filling operation".to_string(),
            },
        ]);
        
        basic.isolation.resource_limits = ResourceLimits {
            max_memory_mb: Some(2048),
            max_cpu_percent: Some(75.0),
            max_processes: Some(100),
            max_open_files: Some(1024),
            execution_timeout_sec: Some(3600),
        };
        
        basic
    }
    
    /// Restricted tier configuration
    fn restricted() -> Self {
        Self {
            tier: SecurityTier::Restricted,
            command_policy: CommandSecurityPolicy {
                mode: CommandSecurityMode::AllowlistOnly,
                allowlist: Self::safe_command_allowlist(),
                denylist: vec![],
                require_confirmation: vec![],
                audit_commands: true,
                mask_sensitive_args: true,
            },
            isolation: ProcessIsolationConfig {
                enabled: true,
                isolation_type: IsolationType::ProcessNamespace,
                resource_limits: ResourceLimits {
                    max_memory_mb: Some(1024),
                    max_cpu_percent: Some(50.0),
                    max_processes: Some(50),
                    max_open_files: Some(512),
                    execution_timeout_sec: Some(1800),
                },
                network_policy: NetworkPolicy {
                    allow_network: false,
                    allowed_hosts: vec![],
                    blocked_ports: vec![],
                },
                filesystem_policy: FilesystemPolicy {
                    read_only: true,
                    allowed_paths: vec![],
                    temp_dir_only: false,
                },
            },
            workspace_trust: WorkspaceTrustConfig {
                enabled: true,
                trust_on_first_use: false,
                trusted_paths: vec![],
                parent_folder_trust: false,
                untrusted_restrictions: UntrustedRestrictions::strict(),
            },
            audit_config: AuditConfig {
                enabled: true,
                log_level: AuditLogLevel::Full,
                destinations: vec![],
                retention_days: 90,
                encrypt_logs: true,
                exclude_patterns: vec![],
            },
        }
    }
    
    /// Isolated tier configuration
    fn isolated() -> Self {
        let mut restricted = Self::restricted();
        restricted.tier = SecurityTier::Isolated;
        
        restricted.isolation = ProcessIsolationConfig {
            enabled: true,
            isolation_type: IsolationType::Container {
                image: "orchflow/secure-terminal:latest".to_string(),
            },
            resource_limits: ResourceLimits {
                max_memory_mb: Some(512),
                max_cpu_percent: Some(25.0),
                max_processes: Some(20),
                max_open_files: Some(256),
                execution_timeout_sec: Some(900),
            },
            network_policy: NetworkPolicy {
                allow_network: false,
                allowed_hosts: vec![],
                blocked_ports: vec![],
            },
            filesystem_policy: FilesystemPolicy {
                read_only: true,
                allowed_paths: vec![],
                temp_dir_only: true,
            },
        };
        
        restricted
    }
    
    /// Get safe command allowlist
    fn safe_command_allowlist() -> Vec<CommandPattern> {
        vec![
            CommandPattern {
                pattern: "ls".to_string(),
                regex: None,
                is_regex: false,
                risk_level: RiskLevel::Low,
                reason: "List directory contents".to_string(),
            },
            CommandPattern {
                pattern: "pwd".to_string(),
                regex: None,
                is_regex: false,
                risk_level: RiskLevel::Low,
                reason: "Print working directory".to_string(),
            },
            CommandPattern {
                pattern: "cd ".to_string(),
                regex: None,
                is_regex: false,
                risk_level: RiskLevel::Low,
                reason: "Change directory".to_string(),
            },
            CommandPattern {
                pattern: "cat ".to_string(),
                regex: None,
                is_regex: false,
                risk_level: RiskLevel::Low,
                reason: "Display file contents".to_string(),
            },
            CommandPattern {
                pattern: "grep ".to_string(),
                regex: None,
                is_regex: false,
                risk_level: RiskLevel::Low,
                reason: "Search file contents".to_string(),
            },
            CommandPattern {
                pattern: "find ".to_string(),
                regex: None,
                is_regex: false,
                risk_level: RiskLevel::Low,
                reason: "Find files".to_string(),
            },
            CommandPattern {
                pattern: "echo ".to_string(),
                regex: None,
                is_regex: false,
                risk_level: RiskLevel::Low,
                reason: "Display text".to_string(),
            },
            CommandPattern {
                pattern: "git status".to_string(),
                regex: None,
                is_regex: false,
                risk_level: RiskLevel::Low,
                reason: "Check git status".to_string(),
            },
            CommandPattern {
                pattern: "git log".to_string(),
                regex: None,
                is_regex: false,
                risk_level: RiskLevel::Low,
                reason: "View git history".to_string(),
            },
        ]
    }
    
    /// Adjust context for a specific tier
    fn adjust_for_tier(mut self, tier: SecurityTier) -> Self {
        self.tier = tier;
        // Apply tier-specific adjustments
        match tier {
            SecurityTier::Unrestricted => {
                self.command_policy.mode = CommandSecurityMode::Unrestricted;
                self.isolation.enabled = false;
            }
            SecurityTier::Basic => {
                self.command_policy.mode = CommandSecurityMode::DenylistFilter;
            }
            SecurityTier::Enhanced => {
                self.command_policy.audit_commands = true;
            }
            SecurityTier::Restricted => {
                self.command_policy.mode = CommandSecurityMode::AllowlistOnly;
                self.isolation.enabled = true;
            }
            SecurityTier::Isolated => {
                self.command_policy.mode = CommandSecurityMode::AllowlistOnly;
                self.isolation.enabled = true;
                self.isolation.isolation_type = IsolationType::Container {
                    image: "orchflow/secure-terminal:latest".to_string(),
                };
            }
        }
        self
    }
}

impl ResourceLimits {
    fn unlimited() -> Self {
        Self {
            max_memory_mb: None,
            max_cpu_percent: None,
            max_processes: None,
            max_open_files: None,
            execution_timeout_sec: None,
        }
    }
}

impl NetworkPolicy {
    fn unrestricted() -> Self {
        Self {
            allow_network: true,
            allowed_hosts: vec![],
            blocked_ports: vec![],
        }
    }
}

impl FilesystemPolicy {
    fn unrestricted() -> Self {
        Self {
            read_only: false,
            allowed_paths: vec![],
            temp_dir_only: false,
        }
    }
}

impl UntrustedRestrictions {
    fn none() -> Self {
        Self {
            disable_task_running: false,
            disable_debugging: false,
            disable_terminal_creation: false,
            restrict_terminal_commands: false,
            disable_workspace_extensions: false,
        }
    }
    
    fn basic() -> Self {
        Self {
            disable_task_running: false,
            disable_debugging: false,
            disable_terminal_creation: false,
            restrict_terminal_commands: true,
            disable_workspace_extensions: true,
        }
    }
    
    fn strict() -> Self {
        Self {
            disable_task_running: true,
            disable_debugging: true,
            disable_terminal_creation: false,
            restrict_terminal_commands: true,
            disable_workspace_extensions: true,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state_manager::{StateManager, types::{PaneState, PaneType}};
    use crate::simple_state_store::SimpleStateStore;
    use std::sync::Arc;
    
    // Mock session lookup for testing
    struct MockSessionLookup {
        sessions: HashMap<String, String>,
    }
    
    impl MockSessionLookup {
        fn new() -> Self {
            let mut sessions = HashMap::new();
            sessions.insert("terminal-1".to_string(), "session-123".to_string());
            sessions.insert("pane-1".to_string(), "session-456".to_string());
            Self { sessions }
        }
    }
    
    #[async_trait::async_trait]
    impl SessionLookup for MockSessionLookup {
        async fn get_session_id_for_terminal(&self, terminal_id: &str) -> Option<String> {
            self.sessions.get(terminal_id).cloned()
        }
    }
    
    // Mock audit logger for testing
    struct MockAuditLogger {
        events: Arc<tokio::sync::Mutex<Vec<AuditEvent>>>,
    }
    
    impl MockAuditLogger {
        fn new() -> Self {
            Self {
                events: Arc::new(tokio::sync::Mutex::new(Vec::new())),
            }
        }
        
        async fn get_events(&self) -> Vec<AuditEvent> {
            self.events.lock().await.clone()
        }
    }
    
    #[async_trait::async_trait]
    impl AuditLogger for MockAuditLogger {
        async fn log(&self, event: AuditEvent) -> Result<()> {
            self.events.lock().await.push(event);
            Ok(())
        }
        
        async fn query(&self, _filter: AuditFilter) -> Result<Vec<AuditEvent>> {
            Ok(self.events.lock().await.clone())
        }
    }
    
    #[tokio::test]
    async fn test_security_tiers() {
        let manager = TerminalSecurityManager::new(SecurityTier::Basic);
        
        // Test context creation
        let context = manager.create_context("test-terminal", None, None).await.unwrap();
        assert_eq!(context.tier, SecurityTier::Basic);
        
        // Test command checking
        let result = manager.check_command("test-terminal", "ls -la", None).await.unwrap();
        assert!(matches!(result, CommandCheckResult::Allow));
        
        // Test dangerous command
        let result = manager.check_command("test-terminal", "rm -rf /", None).await.unwrap();
        assert!(matches!(result, CommandCheckResult::Deny(_)));
    }
    
    #[tokio::test]
    async fn test_session_id_in_audit_logs() {
        let audit_logger = Arc::new(MockAuditLogger::new());
        let session_lookup = Arc::new(MockSessionLookup::new());
        
        let manager = TerminalSecurityManager::new(SecurityTier::Basic)
            .with_audit_logger(audit_logger.clone())
            .with_session_lookup(session_lookup);
        
        // Create terminal context - should log with session ID
        let _context = manager.create_context("terminal-1", None, None).await.unwrap();
        
        // Check command - should log with session ID
        let _result = manager.check_command("terminal-1", "echo test", None).await.unwrap();
        
        // Verify audit events have correct session IDs
        let events = audit_logger.get_events().await;
        
        // Should have 2 events: terminal creation and command execution
        assert_eq!(events.len(), 2);
        
        // First event: terminal creation
        let terminal_created_event = &events[0];
        assert_eq!(terminal_created_event.session_id, "session-123");
        assert_eq!(terminal_created_event.terminal_id, Some("terminal-1".to_string()));
        assert!(matches!(terminal_created_event.event_type, AuditEventType::TerminalCreated));
        
        // Second event: command execution
        let command_event = &events[1];
        assert_eq!(command_event.session_id, "session-123");
        assert_eq!(command_event.terminal_id, Some("terminal-1".to_string()));
        assert_eq!(command_event.command, Some("echo test".to_string()));
        assert!(matches!(command_event.event_type, AuditEventType::CommandExecuted));
    }
    
    #[tokio::test]
    async fn test_session_id_fallback_when_no_lookup() {
        let audit_logger = Arc::new(MockAuditLogger::new());
        
        // Manager without session lookup
        let manager = TerminalSecurityManager::new(SecurityTier::Basic)
            .with_audit_logger(audit_logger.clone());
        
        // Create terminal context
        let _context = manager.create_context("unknown-terminal", None, None).await.unwrap();
        
        // Verify audit event has empty session ID as fallback
        let events = audit_logger.get_events().await;
        assert_eq!(events.len(), 1);
        
        let event = &events[0];
        assert_eq!(event.session_id, ""); // Should be empty when no lookup available
        assert_eq!(event.terminal_id, Some("unknown-terminal".to_string()));
    }
    
    #[test]
    fn test_pattern_matching() {
        let manager = TerminalSecurityManager::new(SecurityTier::Basic);
        
        let pattern = CommandPattern {
            pattern: "rm ".to_string(),
            regex: None,
            is_regex: false,
            risk_level: RiskLevel::Medium,
            reason: "File deletion".to_string(),
        };
        
        assert!(manager.matches_pattern("rm -rf /tmp/test", &pattern).unwrap());
        assert!(!manager.matches_pattern("ls -la", &pattern).unwrap());
    }
}