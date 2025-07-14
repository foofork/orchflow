use crate::error::{MuxdError, Result};
use crate::protocol::SessionId;
use crate::session::metadata::{SessionMetadata, SessionTemplate, ProjectContext};
use chrono::{DateTime, Utc};
use parking_lot::RwLock;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::fs;
use tracing::{debug, error, info, warn};

/// Session metadata manager for enhanced session capabilities
pub struct SessionMetadataManager {
    /// In-memory metadata cache
    metadata_cache: Arc<RwLock<HashMap<SessionId, SessionMetadata>>>,
    
    /// Session templates storage
    templates: Arc<RwLock<HashMap<String, SessionTemplate>>>,
    
    /// Metadata storage directory
    metadata_dir: PathBuf,
    
    /// Templates storage directory
    templates_dir: PathBuf,
}

impl SessionMetadataManager {
    /// Create a new session metadata manager
    pub fn new(data_dir: PathBuf) -> Self {
        let metadata_dir = data_dir.join("metadata");
        let templates_dir = data_dir.join("templates");
        
        Self {
            metadata_cache: Arc::new(RwLock::new(HashMap::new())),
            templates: Arc::new(RwLock::new(HashMap::new())),
            metadata_dir,
            templates_dir,
        }
    }
    
    /// Initialize the metadata manager
    pub async fn initialize(&self) -> Result<()> {
        // Create directories
        fs::create_dir_all(&self.metadata_dir).await.map_err(|e| {
            MuxdError::IoError(format!("Failed to create metadata directory: {}", e))
        })?;
        
        fs::create_dir_all(&self.templates_dir).await.map_err(|e| {
            MuxdError::IoError(format!("Failed to create templates directory: {}", e))
        })?;
        
        // Load existing metadata and templates
        self.load_all_metadata().await?;
        self.load_all_templates().await?;
        
        info!("Session metadata manager initialized");
        Ok(())
    }
    
    /// Create new session metadata
    pub async fn create_metadata(&self, session_id: SessionId, name: String) -> Result<()> {
        let metadata = SessionMetadata::new(session_id.clone(), name);
        
        // Store in cache
        self.metadata_cache.write().insert(session_id.clone(), metadata.clone());
        
        // Persist to disk
        self.save_metadata(&session_id, &metadata).await?;
        
        info!("Created metadata for session {}", session_id);
        Ok(())
    }
    
    /// Get session metadata
    pub fn get_metadata(&self, session_id: &SessionId) -> Option<SessionMetadata> {
        self.metadata_cache.read().get(session_id).cloned()
    }
    
    /// Update session metadata
    pub async fn update_metadata<F>(&self, session_id: &SessionId, update_fn: F) -> Result<()>
    where
        F: FnOnce(&mut SessionMetadata),
    {
        let mut cache = self.metadata_cache.write();
        
        if let Some(metadata) = cache.get_mut(session_id) {
            update_fn(metadata);
            metadata.touch();
            
            let metadata_clone = metadata.clone();
            drop(cache); // Release lock before async operation
            
            // Persist to disk
            self.save_metadata(session_id, &metadata_clone).await?;
            
            info!("Updated metadata for session {}", session_id);
            Ok(())
        } else {
            Err(MuxdError::SessionNotFound {
                session_id: session_id.to_string(),
            })
        }
    }
    
    /// Delete session metadata
    pub async fn delete_metadata(&self, session_id: &SessionId) -> Result<()> {
        // Remove from cache
        self.metadata_cache.write().remove(session_id);
        
        // Delete from disk
        let metadata_file = self.metadata_file_path(session_id);
        if metadata_file.exists() {
            fs::remove_file(&metadata_file).await.map_err(|e| {
                MuxdError::IoError(format!("Failed to delete metadata file: {}", e))
            })?;
        }
        
        info!("Deleted metadata for session {}", session_id);
        Ok(())
    }
    
    /// Set project context for a session
    pub async fn set_project_context(
        &self,
        session_id: &SessionId,
        project_context: ProjectContext,
    ) -> Result<()> {
        self.update_metadata(session_id, |metadata| {
            metadata.project_context = project_context;
        }).await
    }
    
    /// Auto-detect project context from working directory
    pub async fn auto_detect_project_context(
        &self,
        session_id: &SessionId,
        working_dir: &str,
    ) -> Result<ProjectContext> {
        let mut context = ProjectContext::default();
        let working_path = PathBuf::from(working_dir);
        
        // Set root directory
        context.root_directory = Some(working_dir.to_string());
        
        // Auto-detect project type and configuration
        if working_path.join("Cargo.toml").exists() {
            context.environment_type = crate::session::metadata::ProjectEnvironmentType::Rust;
            context.build_config = Some(self.detect_rust_build_config(&working_path).await?);
        } else if working_path.join("package.json").exists() {
            context.environment_type = crate::session::metadata::ProjectEnvironmentType::NodeJs;
            context.build_config = Some(self.detect_nodejs_build_config(&working_path).await?);
        } else if working_path.join("pyproject.toml").exists() || working_path.join("requirements.txt").exists() {
            context.environment_type = crate::session::metadata::ProjectEnvironmentType::Python;
            context.build_config = Some(self.detect_python_build_config(&working_path).await?);
        } else if working_path.join("go.mod").exists() {
            context.environment_type = crate::session::metadata::ProjectEnvironmentType::Go;
            context.build_config = Some(self.detect_go_build_config(&working_path).await?);
        }
        
        // Detect Git repository
        if working_path.join(".git").exists() {
            context.git_info = Some(self.detect_git_context(&working_path).await?);
        }
        
        // Auto-detect project name from directory or git
        if context.name.is_none() {
            if let Some(git_info) = &context.git_info {
                if let Some(remote_url) = &git_info.remote_url {
                    // Extract project name from Git URL
                    if let Some(name) = self.extract_project_name_from_git_url(remote_url) {
                        context.name = Some(name);
                    }
                }
            }
            
            // Fallback to directory name
            if context.name.is_none() {
                if let Some(dir_name) = working_path.file_name() {
                    context.name = Some(dir_name.to_string_lossy().to_string());
                }
            }
        }
        
        // Update the session metadata
        self.set_project_context(session_id, context.clone()).await?;
        
        Ok(context)
    }
    
    /// Search sessions by metadata criteria
    pub fn search_sessions(&self, query: &SessionMetadataQuery) -> Vec<SessionMetadata> {
        self.metadata_cache
            .read()
            .values()
            .filter(|metadata| query.matches(metadata))
            .cloned()
            .collect()
    }
    
    /// List all sessions with basic info
    pub fn list_all_sessions(&self) -> Vec<(SessionId, String, DateTime<Utc>, Vec<String>)> {
        self.metadata_cache
            .read()
            .values()
            .map(|metadata| {
                (
                    metadata.session_id.clone(),
                    metadata.name.clone(),
                    metadata.updated_at,
                    metadata.tags.clone(),
                )
            })
            .collect()
    }
    
    /// Create session template from existing session
    pub async fn create_template_from_session(
        &self,
        session_id: &SessionId,
        template_name: String,
        template_description: Option<String>,
    ) -> Result<SessionTemplate> {
        let metadata = self.get_metadata(session_id)
            .ok_or_else(|| MuxdError::SessionNotFound {
                session_id: session_id.to_string(),
            })?;
        
        // Create template from session metadata
        let template = SessionTemplate {
            name: template_name.clone(),
            description: template_description,
            category: metadata.project_context.environment_type.to_string(),
            tags: metadata.tags.clone(),
            panes: Vec::new(), // TODO: Extract pane configuration from actual panes
            layout: crate::session::metadata::LayoutConfig {
                layout_type: crate::session::metadata::LayoutType::Horizontal,
                parameters: HashMap::new(),
                initial_active_pane: None,
            },
            template_metadata: crate::session::metadata::TemplateMetadata {
                version: "1.0".to_string(),
                author: None,
                created_at: Utc::now(),
                updated_at: Utc::now(),
                usage_count: 0,
                rating: None,
            },
        };
        
        // Store template
        self.templates.write().insert(template_name.clone(), template.clone());
        self.save_template(&template_name, &template).await?;
        
        info!("Created template '{}' from session {}", template_name, session_id);
        Ok(template)
    }
    
    /// Get session template
    pub fn get_template(&self, template_name: &str) -> Option<SessionTemplate> {
        self.templates.read().get(template_name).cloned()
    }
    
    /// List all templates
    pub fn list_templates(&self) -> Vec<(String, String, DateTime<Utc>)> {
        self.templates
            .read()
            .values()
            .map(|template| {
                (
                    template.name.clone(),
                    template.category.clone(),
                    template.template_metadata.updated_at,
                )
            })
            .collect()
    }
    
    /// Save metadata to disk
    async fn save_metadata(&self, session_id: &SessionId, metadata: &SessionMetadata) -> Result<()> {
        let metadata_file = self.metadata_file_path(session_id);
        let temp_file = metadata_file.with_extension("tmp");
        
        let json = serde_json::to_string_pretty(metadata).map_err(|e| {
            MuxdError::InvalidRequest {
                reason: format!("Failed to serialize metadata: {}", e),
            }
        })?;
        
        fs::write(&temp_file, json).await.map_err(|e| {
            MuxdError::IoError(format!("Failed to write metadata file: {}", e))
        })?;
        
        fs::rename(&temp_file, &metadata_file).await.map_err(|e| {
            MuxdError::IoError(format!("Failed to rename metadata file: {}", e))
        })?;
        
        debug!("Saved metadata for session {} to {:?}", session_id, metadata_file);
        Ok(())
    }
    
    /// Load metadata from disk
    async fn load_metadata(&self, session_id: &SessionId) -> Result<Option<SessionMetadata>> {
        let metadata_file = self.metadata_file_path(session_id);
        
        if !metadata_file.exists() {
            return Ok(None);
        }
        
        let content = fs::read_to_string(&metadata_file).await.map_err(|e| {
            MuxdError::IoError(format!("Failed to read metadata file: {}", e))
        })?;
        
        let metadata: SessionMetadata = serde_json::from_str(&content).map_err(|e| {
            MuxdError::InvalidRequest {
                reason: format!("Failed to deserialize metadata: {}", e),
            }
        })?;
        
        Ok(Some(metadata))
    }
    
    /// Load all metadata from disk
    async fn load_all_metadata(&self) -> Result<()> {
        let mut entries = fs::read_dir(&self.metadata_dir).await.map_err(|e| {
            MuxdError::IoError(format!("Failed to read metadata directory: {}", e))
        })?;
        
        while let Some(entry) = entries.next_entry().await.map_err(|e| {
            MuxdError::IoError(format!("Failed to read directory entry: {}", e))
        })? {
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "json") {
                if let Some(file_stem) = path.file_stem() {
                    let session_id_str = file_stem.to_string_lossy();
                    let session_id = SessionId(session_id_str.to_string());
                    
                    match self.load_metadata(&session_id).await {
                        Ok(Some(metadata)) => {
                            self.metadata_cache.write().insert(session_id.clone(), metadata);
                            debug!("Loaded metadata for session {}", session_id);
                        }
                        Ok(None) => {
                            warn!("No metadata found for session {}", session_id);
                        }
                        Err(e) => {
                            error!("Failed to load metadata for session {}: {}", session_id, e);
                        }
                    }
                }
            }
        }
        
        info!("Loaded {} session metadata entries", self.metadata_cache.read().len());
        Ok(())
    }
    
    /// Save template to disk
    async fn save_template(&self, template_name: &str, template: &SessionTemplate) -> Result<()> {
        let template_file = self.template_file_path(template_name);
        let temp_file = template_file.with_extension("tmp");
        
        let json = serde_json::to_string_pretty(template).map_err(|e| {
            MuxdError::InvalidRequest {
                reason: format!("Failed to serialize template: {}", e),
            }
        })?;
        
        fs::write(&temp_file, json).await.map_err(|e| {
            MuxdError::IoError(format!("Failed to write template file: {}", e))
        })?;
        
        fs::rename(&temp_file, &template_file).await.map_err(|e| {
            MuxdError::IoError(format!("Failed to rename template file: {}", e))
        })?;
        
        debug!("Saved template '{}' to {:?}", template_name, template_file);
        Ok(())
    }
    
    /// Load all templates from disk
    async fn load_all_templates(&self) -> Result<()> {
        if !self.templates_dir.exists() {
            return Ok(());
        }
        
        let mut entries = fs::read_dir(&self.templates_dir).await.map_err(|e| {
            MuxdError::IoError(format!("Failed to read templates directory: {}", e))
        })?;
        
        while let Some(entry) = entries.next_entry().await.map_err(|e| {
            MuxdError::IoError(format!("Failed to read directory entry: {}", e))
        })? {
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "json") {
                if let Some(file_stem) = path.file_stem() {
                    let template_name = file_stem.to_string_lossy().to_string();
                    
                    match self.load_template(&template_name).await {
                        Ok(Some(template)) => {
                            self.templates.write().insert(template_name.clone(), template);
                            debug!("Loaded template '{}'", template_name);
                        }
                        Ok(None) => {
                            warn!("No template found for '{}'", template_name);
                        }
                        Err(e) => {
                            error!("Failed to load template '{}': {}", template_name, e);
                        }
                    }
                }
            }
        }
        
        info!("Loaded {} session templates", self.templates.read().len());
        Ok(())
    }
    
    /// Load template from disk
    async fn load_template(&self, template_name: &str) -> Result<Option<SessionTemplate>> {
        let template_file = self.template_file_path(template_name);
        
        if !template_file.exists() {
            return Ok(None);
        }
        
        let content = fs::read_to_string(&template_file).await.map_err(|e| {
            MuxdError::IoError(format!("Failed to read template file: {}", e))
        })?;
        
        let template: SessionTemplate = serde_json::from_str(&content).map_err(|e| {
            MuxdError::InvalidRequest {
                reason: format!("Failed to deserialize template: {}", e),
            }
        })?;
        
        Ok(Some(template))
    }
    
    /// Get metadata file path
    fn metadata_file_path(&self, session_id: &SessionId) -> PathBuf {
        self.metadata_dir.join(format!("{}.json", session_id.0))
    }
    
    /// Get template file path
    fn template_file_path(&self, template_name: &str) -> PathBuf {
        self.templates_dir.join(format!("{}.json", template_name))
    }
    
    /// Extract project name from Git URL
    fn extract_project_name_from_git_url(&self, git_url: &str) -> Option<String> {
        // Handle various Git URL formats
        if let Some(captures) = regex::Regex::new(r"[:/]([^/]+)/([^/]+?)(?:\.git)?/?$")
            .ok()?
            .captures(git_url)
        {
            if let Some(project_name) = captures.get(2) {
                return Some(project_name.as_str().to_string());
            }
        }
        None
    }
    
    // Project type detection methods
    async fn detect_rust_build_config(&self, _project_path: &PathBuf) -> Result<crate::session::metadata::BuildConfig> {
        Ok(crate::session::metadata::BuildConfig {
            build_system: "cargo".to_string(),
            targets: vec!["build".to_string(), "test".to_string(), "run".to_string()],
            default_command: Some("cargo build".to_string()),
            test_command: Some("cargo test".to_string()),
            dev_command: Some("cargo run".to_string()),
            build_env: HashMap::new(),
        })
    }
    
    async fn detect_nodejs_build_config(&self, _project_path: &PathBuf) -> Result<crate::session::metadata::BuildConfig> {
        Ok(crate::session::metadata::BuildConfig {
            build_system: "npm".to_string(),
            targets: vec!["build".to_string(), "test".to_string(), "start".to_string()],
            default_command: Some("npm run build".to_string()),
            test_command: Some("npm test".to_string()),
            dev_command: Some("npm run dev".to_string()),
            build_env: HashMap::new(),
        })
    }
    
    async fn detect_python_build_config(&self, _project_path: &PathBuf) -> Result<crate::session::metadata::BuildConfig> {
        Ok(crate::session::metadata::BuildConfig {
            build_system: "pip".to_string(),
            targets: vec!["install".to_string(), "test".to_string()],
            default_command: Some("pip install -r requirements.txt".to_string()),
            test_command: Some("python -m pytest".to_string()),
            dev_command: Some("python app.py".to_string()),
            build_env: HashMap::new(),
        })
    }
    
    async fn detect_go_build_config(&self, _project_path: &PathBuf) -> Result<crate::session::metadata::BuildConfig> {
        Ok(crate::session::metadata::BuildConfig {
            build_system: "go".to_string(),
            targets: vec!["build".to_string(), "test".to_string(), "run".to_string()],
            default_command: Some("go build".to_string()),
            test_command: Some("go test".to_string()),
            dev_command: Some("go run .".to_string()),
            build_env: HashMap::new(),
        })
    }
    
    async fn detect_git_context(&self, _project_path: &PathBuf) -> Result<crate::session::metadata::GitContext> {
        // In a real implementation, this would use git2 or command-line git
        // For now, return a basic structure
        Ok(crate::session::metadata::GitContext {
            remote_url: None,
            current_branch: Some("main".to_string()),
            commit_hash: None,
            dirty: false,
            stashes: Vec::new(),
        })
    }
}

/// Query for searching session metadata
#[derive(Debug, Clone)]
pub struct SessionMetadataQuery {
    /// Filter by session name (partial match)
    pub name_contains: Option<String>,
    
    /// Filter by tags (must match all)
    pub tags: Vec<String>,
    
    /// Filter by tags (must match any)
    pub any_tags: Vec<String>,
    
    /// Filter by project environment type
    pub environment_type: Option<crate::session::metadata::ProjectEnvironmentType>,
    
    /// Filter by creation date range
    pub created_after: Option<DateTime<Utc>>,
    pub created_before: Option<DateTime<Utc>>,
    
    /// Filter by update date range
    pub updated_after: Option<DateTime<Utc>>,
    pub updated_before: Option<DateTime<Utc>>,
    
    /// Filter by attributes
    pub attributes: HashMap<String, String>,
}

impl Default for SessionMetadataQuery {
    fn default() -> Self {
        Self {
            name_contains: None,
            tags: Vec::new(),
            any_tags: Vec::new(),
            environment_type: None,
            created_after: None,
            created_before: None,
            updated_after: None,
            updated_before: None,
            attributes: HashMap::new(),
        }
    }
}

impl SessionMetadataQuery {
    /// Create an empty query (matches all sessions)
    pub fn new() -> Self {
        Self::default()
    }
    
    /// Check if a session matches this query
    pub fn matches(&self, metadata: &SessionMetadata) -> bool {
        // Check name filter
        if let Some(name_filter) = &self.name_contains {
            if !metadata.name.to_lowercase().contains(&name_filter.to_lowercase()) {
                return false;
            }
        }
        
        // Check required tags
        if !self.tags.is_empty() && !metadata.matches_all_tags(&self.tags) {
            return false;
        }
        
        // Check optional tags
        if !self.any_tags.is_empty() && !metadata.matches_any_tag(&self.any_tags) {
            return false;
        }
        
        // Check environment type
        if let Some(env_type) = &self.environment_type {
            if &metadata.project_context.environment_type != env_type {
                return false;
            }
        }
        
        // Check creation date filters
        if let Some(after) = self.created_after {
            if metadata.created_at <= after {
                return false;
            }
        }
        
        if let Some(before) = self.created_before {
            if metadata.created_at >= before {
                return false;
            }
        }
        
        // Check update date filters
        if let Some(after) = self.updated_after {
            if metadata.updated_at <= after {
                return false;
            }
        }
        
        if let Some(before) = self.updated_before {
            if metadata.updated_at >= before {
                return false;
            }
        }
        
        // Check attributes
        for (key, value) in &self.attributes {
            if metadata.get_attribute(key) != Some(value) {
                return false;
            }
        }
        
        true
    }
}

impl ToString for crate::session::metadata::ProjectEnvironmentType {
    fn to_string(&self) -> String {
        match self {
            crate::session::metadata::ProjectEnvironmentType::Rust => "rust".to_string(),
            crate::session::metadata::ProjectEnvironmentType::NodeJs => "nodejs".to_string(),
            crate::session::metadata::ProjectEnvironmentType::Python => "python".to_string(),
            crate::session::metadata::ProjectEnvironmentType::Go => "go".to_string(),
            crate::session::metadata::ProjectEnvironmentType::Java => "java".to_string(),
            crate::session::metadata::ProjectEnvironmentType::Cpp => "cpp".to_string(),
            crate::session::metadata::ProjectEnvironmentType::Generic(name) => name.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    
    #[tokio::test]
    async fn test_metadata_manager_creation() {
        let temp_dir = tempdir().unwrap();
        let manager = SessionMetadataManager::new(temp_dir.path().to_path_buf());
        
        assert!(manager.initialize().await.is_ok());
    }
    
    #[tokio::test]
    async fn test_session_metadata_crud() {
        let temp_dir = tempdir().unwrap();
        let manager = SessionMetadataManager::new(temp_dir.path().to_path_buf());
        manager.initialize().await.unwrap();
        
        let session_id = SessionId::new();
        let session_name = "Test Session".to_string();
        
        // Create metadata
        manager.create_metadata(session_id.clone(), session_name.clone()).await.unwrap();
        
        // Get metadata
        let metadata = manager.get_metadata(&session_id).unwrap();
        assert_eq!(metadata.name, session_name);
        
        // Update metadata
        manager.update_metadata(&session_id, |metadata| {
            metadata.add_tag("test".to_string());
            metadata.set_attribute("project".to_string(), "orchflow".to_string());
        }).await.unwrap();
        
        // Verify update
        let updated_metadata = manager.get_metadata(&session_id).unwrap();
        assert!(updated_metadata.matches_tag("test"));
        assert_eq!(updated_metadata.get_attribute("project"), Some(&"orchflow".to_string()));
        
        // Delete metadata
        manager.delete_metadata(&session_id).await.unwrap();
        assert!(manager.get_metadata(&session_id).is_none());
    }
    
    #[tokio::test]
    async fn test_session_search() {
        let temp_dir = tempdir().unwrap();
        let manager = SessionMetadataManager::new(temp_dir.path().to_path_buf());
        manager.initialize().await.unwrap();
        
        // Create test sessions
        let session1 = SessionId::new();
        manager.create_metadata(session1.clone(), "Rust Project".to_string()).await.unwrap();
        manager.update_metadata(&session1, |metadata| {
            metadata.add_tag("rust".to_string());
            metadata.project_context.environment_type = crate::session::metadata::ProjectEnvironmentType::Rust;
        }).await.unwrap();
        
        let session2 = SessionId::new();
        manager.create_metadata(session2.clone(), "Node.js App".to_string()).await.unwrap();
        manager.update_metadata(&session2, |metadata| {
            metadata.add_tag("nodejs".to_string());
            metadata.project_context.environment_type = crate::session::metadata::ProjectEnvironmentType::NodeJs;
        }).await.unwrap();
        
        // Search by tag
        let query = SessionMetadataQuery {
            tags: vec!["rust".to_string()],
            ..Default::default()
        };
        let results = manager.search_sessions(&query);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].session_id, session1);
        
        // Search by environment type
        let query = SessionMetadataQuery {
            environment_type: Some(crate::session::metadata::ProjectEnvironmentType::NodeJs),
            ..Default::default()
        };
        let results = manager.search_sessions(&query);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].session_id, session2);
        
        // Search by name
        let query = SessionMetadataQuery {
            name_contains: Some("rust".to_string()),
            ..Default::default()
        };
        let results = manager.search_sessions(&query);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].session_id, session1);
    }
}