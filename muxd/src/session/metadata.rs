use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};
use crate::protocol::{SessionId, PaneId};

/// Enhanced session metadata with project context and environment preservation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMetadata {
    /// Basic session info
    pub session_id: SessionId,
    pub name: String,
    pub description: Option<String>,
    
    /// Project context
    pub project_context: ProjectContext,
    
    /// Environment preservation
    pub environment: EnvironmentConfig,
    
    /// Session recovery settings
    pub recovery: SessionRecovery,
    
    /// Session templates and bookmarks
    pub template: Option<SessionTemplate>,
    
    /// Metadata timestamps
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    
    /// User-defined tags for organization
    pub tags: Vec<String>,
    
    /// Custom attributes
    pub attributes: HashMap<String, String>,
}

/// Project context information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectContext {
    /// Project name/identifier
    pub name: Option<String>,
    
    /// Project root directory
    pub root_directory: Option<String>,
    
    /// Git repository information
    pub git_info: Option<GitContext>,
    
    /// Build system configuration
    pub build_config: Option<BuildConfig>,
    
    /// Development environment type
    pub environment_type: ProjectEnvironmentType,
    
    /// Project-specific environment variables
    pub project_env: HashMap<String, String>,
    
    /// IDE/Editor configuration
    pub editor_config: Option<EditorConfig>,
    
    /// Associated documentation URLs
    pub documentation: Vec<String>,
}

/// Git repository context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitContext {
    /// Remote repository URL
    pub remote_url: Option<String>,
    
    /// Current branch
    pub current_branch: Option<String>,
    
    /// Last known commit hash
    pub commit_hash: Option<String>,
    
    /// Working directory status
    pub dirty: bool,
    
    /// Stash information
    pub stashes: Vec<String>,
}

/// Build system configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildConfig {
    /// Build system type (cargo, npm, make, etc.)
    pub build_system: String,
    
    /// Build targets/scripts
    pub targets: Vec<String>,
    
    /// Default build command
    pub default_command: Option<String>,
    
    /// Test command
    pub test_command: Option<String>,
    
    /// Development server command
    pub dev_command: Option<String>,
    
    /// Build-specific environment variables
    pub build_env: HashMap<String, String>,
}

/// Project environment type
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProjectEnvironmentType {
    /// Rust project (Cargo-based)
    Rust,
    /// Node.js project (npm/yarn/pnpm)
    NodeJs,
    /// Python project (pip/poetry/pipenv)
    Python,
    /// Go project
    Go,
    /// Java/Maven project
    Java,
    /// C/C++ project (Make/CMake)
    Cpp,
    /// Generic/other project type
    Generic(String),
}

impl Default for ProjectEnvironmentType {
    fn default() -> Self {
        ProjectEnvironmentType::Generic("unknown".to_string())
    }
}

/// Editor/IDE configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorConfig {
    /// Preferred editor (vim, vscode, etc.)
    pub editor: String,
    
    /// Editor-specific configuration
    pub config: HashMap<String, String>,
    
    /// Workspace file path
    pub workspace_file: Option<String>,
}

/// Environment configuration and preservation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentConfig {
    /// Global environment variables to preserve
    pub global_env: HashMap<String, String>,
    
    /// PATH additions/modifications
    pub path_modifications: Vec<PathModification>,
    
    /// Shell configuration
    pub shell_config: ShellConfig,
    
    /// Language-specific environments (e.g., Python venv, Node version)
    pub language_envs: HashMap<String, LanguageEnvironment>,
    
    /// Container/virtualization settings
    pub container_config: Option<ContainerConfig>,
}

/// PATH modification operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathModification {
    /// Operation type
    pub operation: PathOperation,
    
    /// Path to add/remove
    pub path: String,
    
    /// Priority (higher values applied first)
    pub priority: i32,
}

/// PATH modification operations
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PathOperation {
    /// Prepend to PATH
    Prepend,
    /// Append to PATH
    Append,
    /// Remove from PATH
    Remove,
}

/// Shell configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellConfig {
    /// Shell executable path
    pub shell_path: String,
    
    /// Shell initialization files to source
    pub init_files: Vec<String>,
    
    /// Shell aliases
    pub aliases: HashMap<String, String>,
    
    /// Shell functions
    pub functions: HashMap<String, String>,
    
    /// History configuration
    pub history_config: Option<HistoryConfig>,
}

/// Shell history configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryConfig {
    /// History file path
    pub history_file: Option<String>,
    
    /// History size limit
    pub max_size: Option<usize>,
    
    /// Share history across sessions
    pub shared: bool,
}

/// Language-specific environment configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageEnvironment {
    /// Environment type
    pub env_type: String,
    
    /// Environment path or identifier
    pub env_path: String,
    
    /// Activation command
    pub activation_command: Option<String>,
    
    /// Deactivation command
    pub deactivation_command: Option<String>,
    
    /// Environment-specific variables
    pub env_vars: HashMap<String, String>,
}

/// Container/virtualization configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerConfig {
    /// Container type (docker, podman, lxc, etc.)
    pub container_type: String,
    
    /// Container image or configuration
    pub image: String,
    
    /// Mount points
    pub mounts: Vec<MountPoint>,
    
    /// Container-specific environment
    pub container_env: HashMap<String, String>,
    
    /// Network configuration
    pub network_config: Option<NetworkConfig>,
}

/// Mount point configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MountPoint {
    /// Host path
    pub host_path: String,
    
    /// Container path
    pub container_path: String,
    
    /// Mount options
    pub options: Vec<String>,
}

/// Network configuration for containers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkConfig {
    /// Network mode
    pub mode: String,
    
    /// Port mappings
    pub ports: Vec<PortMapping>,
}

/// Port mapping configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortMapping {
    /// Host port
    pub host_port: u16,
    
    /// Container port
    pub container_port: u16,
    
    /// Protocol (tcp/udp)
    pub protocol: String,
}

/// Session recovery configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionRecovery {
    /// Enable automatic recovery on startup
    pub auto_recover: bool,
    
    /// Commands to run on recovery
    pub recovery_commands: Vec<RecoveryCommand>,
    
    /// Pane restart configuration
    pub pane_restart: PaneRestartConfig,
    
    /// Session health monitoring
    pub health_monitoring: Option<HealthMonitoring>,
    
    /// Backup configuration
    pub backup_config: BackupConfig,
}

/// Recovery command configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryCommand {
    /// Command to execute
    pub command: String,
    
    /// Working directory for command
    pub working_dir: Option<String>,
    
    /// Environment variables for command
    pub env: HashMap<String, String>,
    
    /// Target pane (if specific pane)
    pub target_pane: Option<PaneId>,
    
    /// Execution priority
    pub priority: i32,
    
    /// Timeout for command execution
    pub timeout_seconds: Option<u64>,
}

/// Pane restart configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaneRestartConfig {
    /// Enable automatic pane restart on failure
    pub auto_restart: bool,
    
    /// Maximum restart attempts
    pub max_restarts: u32,
    
    /// Restart delay in seconds
    pub restart_delay: u64,
    
    /// Commands to preserve across restarts
    pub persistent_commands: HashMap<PaneId, String>,
    
    /// Environment preservation
    pub preserve_environment: bool,
}

/// Health monitoring configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthMonitoring {
    /// Health check interval in seconds
    pub check_interval: u64,
    
    /// Health check commands
    pub health_checks: Vec<HealthCheck>,
    
    /// Recovery actions on health failure
    pub recovery_actions: Vec<RecoveryAction>,
}

/// Health check configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheck {
    /// Check name/identifier
    pub name: String,
    
    /// Command to execute for health check
    pub command: String,
    
    /// Expected exit code (default: 0)
    pub expected_exit_code: i32,
    
    /// Timeout for health check
    pub timeout_seconds: u64,
    
    /// Target pane for check (if specific)
    pub target_pane: Option<PaneId>,
}

/// Recovery action configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryAction {
    /// Action type
    pub action_type: RecoveryActionType,
    
    /// Action parameters
    pub parameters: HashMap<String, String>,
    
    /// Conditions for triggering action
    pub conditions: Vec<String>,
}

/// Types of recovery actions
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RecoveryActionType {
    /// Restart pane
    RestartPane,
    /// Run command
    RunCommand,
    /// Send notification
    Notify,
    /// Log event
    Log,
    /// Custom action
    Custom(String),
}

/// Backup configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupConfig {
    /// Enable automatic backups
    pub enabled: bool,
    
    /// Backup interval in seconds
    pub interval: u64,
    
    /// Maximum number of backups to keep
    pub max_backups: u32,
    
    /// Backup storage location
    pub backup_location: String,
    
    /// Compression settings
    pub compression: Option<CompressionConfig>,
}

/// Compression configuration for backups
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompressionConfig {
    /// Compression algorithm (gzip, lz4, etc.)
    pub algorithm: String,
    
    /// Compression level (0-9)
    pub level: u8,
}

/// Session template for creating new sessions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionTemplate {
    /// Template name
    pub name: String,
    
    /// Template description
    pub description: Option<String>,
    
    /// Template category
    pub category: String,
    
    /// Template tags
    pub tags: Vec<String>,
    
    /// Pane definitions
    pub panes: Vec<PaneTemplate>,
    
    /// Layout configuration
    pub layout: LayoutConfig,
    
    /// Template metadata
    pub template_metadata: TemplateMetadata,
}

/// Pane template definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaneTemplate {
    /// Pane name
    pub name: String,
    
    /// Initial command
    pub command: Option<String>,
    
    /// Working directory
    pub working_dir: Option<String>,
    
    /// Environment variables
    pub env: HashMap<String, String>,
    
    /// Pane size configuration
    pub size: Option<PaneSizeConfig>,
    
    /// Auto-start command
    pub auto_start: bool,
}

/// Pane size configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaneSizeConfig {
    /// Size type
    pub size_type: PaneSizeType,
    
    /// Size value
    pub value: f32,
}

/// Pane size types
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PaneSizeType {
    /// Percentage of available space
    Percentage,
    /// Fixed size in rows/columns
    Fixed,
    /// Minimum size
    Minimum,
    /// Maximum size
    Maximum,
}

/// Layout configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutConfig {
    /// Layout type
    pub layout_type: LayoutType,
    
    /// Layout parameters
    pub parameters: HashMap<String, String>,
    
    /// Initial active pane
    pub initial_active_pane: Option<String>,
}

/// Layout types
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LayoutType {
    /// Horizontal split
    Horizontal,
    /// Vertical split
    Vertical,
    /// Grid layout
    Grid,
    /// Custom layout
    Custom(String),
}

/// Template metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateMetadata {
    /// Template version
    pub version: String,
    
    /// Template author
    pub author: Option<String>,
    
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    
    /// Last modified timestamp
    pub updated_at: DateTime<Utc>,
    
    /// Usage count
    pub usage_count: u64,
    
    /// Template rating/score
    pub rating: Option<f32>,
}

impl Default for SessionMetadata {
    fn default() -> Self {
        let now = Utc::now();
        Self {
            session_id: SessionId::new(),
            name: "Untitled Session".to_string(),
            description: None,
            project_context: ProjectContext::default(),
            environment: EnvironmentConfig::default(),
            recovery: SessionRecovery::default(),
            template: None,
            created_at: now,
            updated_at: now,
            tags: Vec::new(),
            attributes: HashMap::new(),
        }
    }
}

impl Default for ProjectContext {
    fn default() -> Self {
        Self {
            name: None,
            root_directory: None,
            git_info: None,
            build_config: None,
            environment_type: ProjectEnvironmentType::default(),
            project_env: HashMap::new(),
            editor_config: None,
            documentation: Vec::new(),
        }
    }
}

impl Default for EnvironmentConfig {
    fn default() -> Self {
        Self {
            global_env: HashMap::new(),
            path_modifications: Vec::new(),
            shell_config: ShellConfig::default(),
            language_envs: HashMap::new(),
            container_config: None,
        }
    }
}

impl Default for ShellConfig {
    fn default() -> Self {
        Self {
            shell_path: std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string()),
            init_files: Vec::new(),
            aliases: HashMap::new(),
            functions: HashMap::new(),
            history_config: None,
        }
    }
}

impl Default for SessionRecovery {
    fn default() -> Self {
        Self {
            auto_recover: false,
            recovery_commands: Vec::new(),
            pane_restart: PaneRestartConfig::default(),
            health_monitoring: None,
            backup_config: BackupConfig::default(),
        }
    }
}

impl Default for PaneRestartConfig {
    fn default() -> Self {
        Self {
            auto_restart: false,
            max_restarts: 3,
            restart_delay: 5,
            persistent_commands: HashMap::new(),
            preserve_environment: true,
        }
    }
}

impl Default for BackupConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            interval: 300, // 5 minutes
            max_backups: 10,
            backup_location: "~/.muxd/backups".to_string(),
            compression: None,
        }
    }
}

impl SessionMetadata {
    /// Create new session metadata with basic info
    pub fn new(session_id: SessionId, name: String) -> Self {
        Self {
            session_id,
            name,
            ..Default::default()
        }
    }
    
    /// Update the modified timestamp
    pub fn touch(&mut self) {
        self.updated_at = Utc::now();
    }
    
    /// Add a tag
    pub fn add_tag(&mut self, tag: String) {
        if !self.tags.contains(&tag) {
            self.tags.push(tag);
            self.touch();
        }
    }
    
    /// Remove a tag
    pub fn remove_tag(&mut self, tag: &str) {
        if let Some(pos) = self.tags.iter().position(|t| t == tag) {
            self.tags.remove(pos);
            self.touch();
        }
    }
    
    /// Set an attribute
    pub fn set_attribute(&mut self, key: String, value: String) {
        self.attributes.insert(key, value);
        self.touch();
    }
    
    /// Get an attribute
    pub fn get_attribute(&self, key: &str) -> Option<&String> {
        self.attributes.get(key)
    }
    
    /// Remove an attribute
    pub fn remove_attribute(&mut self, key: &str) {
        if self.attributes.remove(key).is_some() {
            self.touch();
        }
    }
    
    /// Check if session matches a tag
    pub fn matches_tag(&self, tag: &str) -> bool {
        self.tags.iter().any(|t| t == tag)
    }
    
    /// Check if session matches any of the provided tags
    pub fn matches_any_tag(&self, tags: &[String]) -> bool {
        tags.iter().any(|tag| self.matches_tag(tag))
    }
    
    /// Check if session matches all of the provided tags
    pub fn matches_all_tags(&self, tags: &[String]) -> bool {
        tags.iter().all(|tag| self.matches_tag(tag))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_metadata_creation() {
        let session_id = SessionId::new();
        let metadata = SessionMetadata::new(session_id.clone(), "Test Session".to_string());
        
        assert_eq!(metadata.session_id, session_id);
        assert_eq!(metadata.name, "Test Session");
        assert!(metadata.description.is_none());
        assert_eq!(metadata.project_context.environment_type, ProjectEnvironmentType::Generic("unknown".to_string()));
    }
    
    #[test]
    fn test_session_metadata_tags() {
        let mut metadata = SessionMetadata::default();
        
        metadata.add_tag("rust".to_string());
        metadata.add_tag("development".to_string());
        
        assert!(metadata.matches_tag("rust"));
        assert!(metadata.matches_tag("development"));
        assert!(!metadata.matches_tag("python"));
        
        assert!(metadata.matches_any_tag(&["rust".to_string(), "python".to_string()]));
        assert!(metadata.matches_all_tags(&["rust".to_string(), "development".to_string()]));
        assert!(!metadata.matches_all_tags(&["rust".to_string(), "python".to_string()]));
        
        metadata.remove_tag("rust");
        assert!(!metadata.matches_tag("rust"));
    }
    
    #[test]
    fn test_session_metadata_attributes() {
        let mut metadata = SessionMetadata::default();
        
        metadata.set_attribute("project".to_string(), "orchflow".to_string());
        metadata.set_attribute("language".to_string(), "rust".to_string());
        
        assert_eq!(metadata.get_attribute("project"), Some(&"orchflow".to_string()));
        assert_eq!(metadata.get_attribute("language"), Some(&"rust".to_string()));
        assert_eq!(metadata.get_attribute("nonexistent"), None);
        
        metadata.remove_attribute("language");
        assert_eq!(metadata.get_attribute("language"), None);
    }
    
    #[test]
    fn test_project_environment_types() {
        let rust_env = ProjectEnvironmentType::Rust;
        let node_env = ProjectEnvironmentType::NodeJs;
        let custom_env = ProjectEnvironmentType::Generic("my-custom".to_string());
        
        assert_eq!(rust_env, ProjectEnvironmentType::Rust);
        assert_ne!(rust_env, node_env);
        assert_eq!(custom_env, ProjectEnvironmentType::Generic("my-custom".to_string()));
    }
    
    #[test]
    fn test_session_metadata_serialization() {
        let metadata = SessionMetadata {
            session_id: SessionId::new(),
            name: "Test Session".to_string(),
            description: Some("A test session".to_string()),
            tags: vec!["test".to_string(), "rust".to_string()],
            ..Default::default()
        };
        
        let json = serde_json::to_string(&metadata).unwrap();
        let deserialized: SessionMetadata = serde_json::from_str(&json).unwrap();
        
        assert_eq!(metadata.session_id, deserialized.session_id);
        assert_eq!(metadata.name, deserialized.name);
        assert_eq!(metadata.description, deserialized.description);
        assert_eq!(metadata.tags, deserialized.tags);
    }
}