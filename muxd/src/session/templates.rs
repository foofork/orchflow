use crate::error::{MuxdError, Result};
use crate::protocol::{SessionId, PaneId, PaneType};
use crate::session::metadata::{SessionTemplate, PaneTemplate, LayoutConfig, TemplateMetadata};
use crate::session::{SessionManager, SessionMetadataManager, SessionMetadata};
use chrono::{DateTime, Utc};
use parking_lot::RwLock;
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{debug, info, warn};

/// Session template and bookmark manager
pub struct SessionTemplateManager {
    /// Reference to session manager
    session_manager: Arc<SessionManager>,
    
    /// Reference to metadata manager
    metadata_manager: Arc<SessionMetadataManager>,
    
    /// Session bookmarks (session_id -> bookmark_name)
    bookmarks: Arc<RwLock<HashMap<String, SessionBookmark>>>,
    
    /// Template usage statistics
    template_stats: Arc<RwLock<HashMap<String, TemplateUsageStats>>>,
}

/// Session bookmark information
#[derive(Debug, Clone)]
pub struct SessionBookmark {
    /// Bookmark name
    pub name: String,
    
    /// Description
    pub description: Option<String>,
    
    /// Associated session ID
    pub session_id: SessionId,
    
    /// Bookmark tags
    pub tags: Vec<String>,
    
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    
    /// Last accessed timestamp
    pub last_accessed: Option<DateTime<Utc>>,
    
    /// Access count
    pub access_count: u64,
    
    /// Auto-launch on startup
    pub auto_launch: bool,
    
    /// Favorite bookmark
    pub is_favorite: bool,
}

/// Template usage statistics
#[derive(Debug, Clone)]
struct TemplateUsageStats {
    /// Number of times template was used
    usage_count: u64,
    
    /// Last used timestamp
    last_used: Option<DateTime<Utc>>,
    
    /// Average session duration when using this template
    average_session_duration_hours: f64,
    
    /// Success rate (sessions that completed successfully)
    success_rate: f64,
    
    /// User rating for the template
    user_rating: Option<f32>,
}

impl SessionTemplateManager {
    /// Create a new session template manager
    pub fn new(
        session_manager: Arc<SessionManager>,
        metadata_manager: Arc<SessionMetadataManager>,
    ) -> Self {
        Self {
            session_manager,
            metadata_manager,
            bookmarks: Arc::new(RwLock::new(HashMap::new())),
            template_stats: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    /// Initialize the template manager
    pub async fn initialize(&self) -> Result<()> {
        // Load existing bookmarks and statistics
        self.load_bookmarks().await?;
        self.load_template_stats().await?;
        
        info!("Session template manager initialized");
        Ok(())
    }
    
    /// Create a new session template from an existing session
    pub async fn create_template_from_session(
        &self,
        session_id: &SessionId,
        template_name: String,
        description: Option<String>,
        category: Option<String>,
    ) -> Result<SessionTemplate> {
        // Get session metadata
        let session_metadata = self.metadata_manager.get_metadata(session_id)
            .ok_or_else(|| MuxdError::SessionNotFound {
                session_id: session_id.to_string(),
            })?;
        
        // Get session panes
        let panes = self.session_manager.list_panes(session_id)?;
        
        // Convert panes to pane templates
        let pane_templates: Vec<PaneTemplate> = panes.iter()
            .map(|pane| PaneTemplate {
                name: format!("pane_{}", pane.id),
                command: None, // TODO: Extract command from pane history
                working_dir: pane.working_dir(),
                env: HashMap::new(), // TODO: Extract environment from pane
                size: None,
                auto_start: true,
            })
            .collect();
        
        // Create template
        let template = SessionTemplate {
            name: template_name.clone(),
            description: description.clone(),
            category: category.unwrap_or_else(|| {
                session_metadata.project_context.environment_type.to_string()
            }),
            tags: session_metadata.tags.clone(),
            panes: pane_templates,
            layout: LayoutConfig {
                layout_type: crate::session::metadata::LayoutType::Horizontal,
                parameters: HashMap::new(),
                initial_active_pane: None,
            },
            template_metadata: TemplateMetadata {
                version: "1.0".to_string(),
                author: None,
                created_at: Utc::now(),
                updated_at: Utc::now(),
                usage_count: 0,
                rating: None,
            },
        };
        
        // Save template via metadata manager
        self.metadata_manager.create_template_from_session(
            session_id,
            template_name.clone(),
            description,
        ).await?;
        
        // Initialize template statistics
        let stats = TemplateUsageStats {
            usage_count: 0,
            last_used: None,
            average_session_duration_hours: 0.0,
            success_rate: 1.0,
            user_rating: None,
        };
        self.template_stats.write().insert(template_name.clone(), stats);
        
        info!("Created template '{}' from session {}", template_name, session_id);
        Ok(template)
    }
    
    /// Create a new session from a template
    pub async fn create_session_from_template(
        &self,
        template_name: &str,
        session_name: Option<String>,
    ) -> Result<SessionId> {
        // Get template
        let template = self.metadata_manager.get_template(template_name)
            .ok_or_else(|| MuxdError::InvalidRequest {
                reason: format!("Template '{}' not found", template_name),
            })?;
        
        // Create session
        let session_name = session_name.unwrap_or_else(|| {
            format!("{}-{}", template.name, Utc::now().format("%Y%m%d-%H%M%S"))
        });
        let session_id = self.session_manager.create_session(session_name.clone())?;
        
        // Create session metadata based on template
        self.metadata_manager.create_metadata(session_id.clone(), session_name).await?;
        
        // Apply template configuration to session metadata
        self.metadata_manager.update_metadata(&session_id, |metadata| {
            metadata.tags = template.tags.clone();
            metadata.description = template.description.clone();
            
            // Set template reference
            metadata.template = Some(template.clone());
            
            // Configure recovery based on template
            if let Some(auto_launch) = metadata.template.as_ref()
                .and_then(|t| t.panes.first())
                .map(|p| p.auto_start) {
                metadata.recovery.auto_recover = auto_launch;
            }
        }).await?;
        
        // Create panes based on template
        for pane_template in &template.panes {
            let output_tx = tokio::sync::mpsc::unbounded_channel().0;
            let pane = self.session_manager.create_pane(
                &session_id,
                PaneType::Terminal,
                output_tx,
            )?;
            
            // Start pane with template configuration
            if pane_template.auto_start {
                if let Some(command) = &pane_template.command {
                    pane.start(
                        Some(command.clone()),
                        pane_template.working_dir.clone(),
                        pane_template.env.clone(),
                        None,
                    ).await?;
                }
            }
        }
        
        // Update template usage statistics
        self.update_template_usage(template_name).await?;
        
        info!("Created session {} from template '{}'", session_id, template_name);
        Ok(session_id)
    }
    
    /// Create a bookmark for a session
    pub async fn create_bookmark(
        &self,
        session_id: &SessionId,
        bookmark_name: String,
        description: Option<String>,
        tags: Vec<String>,
        auto_launch: bool,
    ) -> Result<()> {
        // Verify session exists
        if self.session_manager.get_session(session_id).is_none() {
            return Err(MuxdError::SessionNotFound {
                session_id: session_id.to_string(),
            });
        }
        
        let bookmark = SessionBookmark {
            name: bookmark_name.clone(),
            description,
            session_id: session_id.clone(),
            tags,
            created_at: Utc::now(),
            last_accessed: None,
            access_count: 0,
            auto_launch,
            is_favorite: false,
        };
        
        self.bookmarks.write().insert(bookmark_name.clone(), bookmark);
        
        info!("Created bookmark '{}' for session {}", bookmark_name, session_id);
        Ok(())
    }
    
    /// Access a bookmark (restore/switch to session)
    pub async fn access_bookmark(&self, bookmark_name: &str) -> Result<SessionId> {
        let session_id = {
            let mut bookmarks = self.bookmarks.write();
            let bookmark = bookmarks.get_mut(bookmark_name)
                .ok_or_else(|| MuxdError::InvalidRequest {
                    reason: format!("Bookmark '{}' not found", bookmark_name),
                })?;
            
            // Update access statistics
            bookmark.last_accessed = Some(Utc::now());
            bookmark.access_count += 1;
            
            bookmark.session_id.clone()
        };
        
        // Check if session still exists
        if self.session_manager.get_session(&session_id).is_none() {
            return Err(MuxdError::SessionNotFound {
                session_id: session_id.to_string(),
            });
        }
        
        info!("Accessed bookmark '{}' for session {}", bookmark_name, session_id);
        Ok(session_id)
    }
    
    /// Delete a bookmark
    pub async fn delete_bookmark(&self, bookmark_name: &str) -> Result<()> {
        if self.bookmarks.write().remove(bookmark_name).is_none() {
            return Err(MuxdError::InvalidRequest {
                reason: format!("Bookmark '{}' not found", bookmark_name),
            });
        }
        
        info!("Deleted bookmark '{}'", bookmark_name);
        Ok(())
    }
    
    /// Toggle bookmark as favorite
    pub async fn toggle_bookmark_favorite(&self, bookmark_name: &str) -> Result<bool> {
        let mut bookmarks = self.bookmarks.write();
        let bookmark = bookmarks.get_mut(bookmark_name)
            .ok_or_else(|| MuxdError::InvalidRequest {
                reason: format!("Bookmark '{}' not found", bookmark_name),
            })?;
        
        bookmark.is_favorite = !bookmark.is_favorite;
        let is_favorite = bookmark.is_favorite;
        
        info!("Toggled bookmark '{}' favorite status: {}", bookmark_name, is_favorite);
        Ok(is_favorite)
    }
    
    /// List all bookmarks
    pub fn list_bookmarks(&self) -> Vec<SessionBookmark> {
        self.bookmarks.read().values().cloned().collect()
    }
    
    /// List bookmarks by tags
    pub fn list_bookmarks_by_tags(&self, tags: &[String]) -> Vec<SessionBookmark> {
        self.bookmarks.read()
            .values()
            .filter(|bookmark| {
                tags.iter().any(|tag| bookmark.tags.contains(tag))
            })
            .cloned()
            .collect()
    }
    
    /// Get favorite bookmarks
    pub fn get_favorite_bookmarks(&self) -> Vec<SessionBookmark> {
        self.bookmarks.read()
            .values()
            .filter(|bookmark| bookmark.is_favorite)
            .cloned()
            .collect()
    }
    
    /// Get auto-launch bookmarks
    pub fn get_auto_launch_bookmarks(&self) -> Vec<SessionBookmark> {
        self.bookmarks.read()
            .values()
            .filter(|bookmark| bookmark.auto_launch)
            .cloned()
            .collect()
    }
    
    /// List all templates with usage statistics
    pub fn list_templates_with_stats(&self) -> Vec<(SessionTemplate, Option<TemplateUsageStats>)> {
        let templates = self.metadata_manager.list_templates();
        let stats = self.template_stats.read();
        
        templates.into_iter()
            .filter_map(|(name, _, _)| {
                self.metadata_manager.get_template(&name)
                    .map(|template| (template, stats.get(&name).cloned()))
            })
            .collect()
    }
    
    /// Get template usage statistics
    pub fn get_template_stats(&self, template_name: &str) -> Option<TemplateUsageStats> {
        self.template_stats.read().get(template_name).cloned()
    }
    
    /// Rate a template
    pub async fn rate_template(&self, template_name: &str, rating: f32) -> Result<()> {
        if !(1.0..=5.0).contains(&rating) {
            return Err(MuxdError::InvalidRequest {
                reason: "Rating must be between 1.0 and 5.0".to_string(),
            });
        }
        
        let mut stats = self.template_stats.write();
        let template_stats = stats.entry(template_name.to_string())
            .or_insert_with(|| TemplateUsageStats {
                usage_count: 0,
                last_used: None,
                average_session_duration_hours: 0.0,
                success_rate: 1.0,
                user_rating: None,
            });
        
        template_stats.user_rating = Some(rating);
        
        info!("Rated template '{}' with rating {}", template_name, rating);
        Ok(())
    }
    
    /// Get popular templates based on usage
    pub fn get_popular_templates(&self, limit: usize) -> Vec<(String, u64)> {
        let mut template_usage: Vec<(String, u64)> = self.template_stats.read()
            .iter()
            .map(|(name, stats)| (name.clone(), stats.usage_count))
            .collect();
        
        template_usage.sort_by(|a, b| b.1.cmp(&a.1));
        template_usage.truncate(limit);
        template_usage
    }
    
    /// Search templates by criteria
    pub fn search_templates(&self, query: &TemplateQuery) -> Vec<SessionTemplate> {
        let templates = self.metadata_manager.list_templates();
        let stats = self.template_stats.read();
        
        templates.into_iter()
            .filter_map(|(name, category, _)| {
                self.metadata_manager.get_template(&name)
                    .filter(|template| query.matches(template, stats.get(&name)))
            })
            .collect()
    }
    
    /// Update template usage statistics
    async fn update_template_usage(&self, template_name: &str) -> Result<()> {
        let mut stats = self.template_stats.write();
        let template_stats = stats.entry(template_name.to_string())
            .or_insert_with(|| TemplateUsageStats {
                usage_count: 0,
                last_used: None,
                average_session_duration_hours: 0.0,
                success_rate: 1.0,
                user_rating: None,
            });
        
        template_stats.usage_count += 1;
        template_stats.last_used = Some(Utc::now());
        
        debug!("Updated usage stats for template '{}'", template_name);
        Ok(())
    }
    
    /// Load bookmarks from storage
    async fn load_bookmarks(&self) -> Result<()> {
        // In a real implementation, this would load from persistent storage
        // For now, we'll start with empty bookmarks
        debug!("Loaded bookmarks from storage");
        Ok(())
    }
    
    /// Load template statistics from storage
    async fn load_template_stats(&self) -> Result<()> {
        // In a real implementation, this would load from persistent storage
        // For now, we'll start with empty statistics
        debug!("Loaded template statistics from storage");
        Ok(())
    }
}

/// Query for searching templates
#[derive(Debug, Clone)]
pub struct TemplateQuery {
    /// Filter by template name (partial match)
    pub name_contains: Option<String>,
    
    /// Filter by category
    pub category: Option<String>,
    
    /// Filter by tags (must match all)
    pub tags: Vec<String>,
    
    /// Filter by tags (must match any)
    pub any_tags: Vec<String>,
    
    /// Filter by minimum usage count
    pub min_usage_count: Option<u64>,
    
    /// Filter by minimum rating
    pub min_rating: Option<f32>,
    
    /// Sort by usage count (descending)
    pub sort_by_usage: bool,
    
    /// Sort by rating (descending)
    pub sort_by_rating: bool,
    
    /// Sort by creation date (newest first)
    pub sort_by_date: bool,
}

impl Default for TemplateQuery {
    fn default() -> Self {
        Self {
            name_contains: None,
            category: None,
            tags: Vec::new(),
            any_tags: Vec::new(),
            min_usage_count: None,
            min_rating: None,
            sort_by_usage: false,
            sort_by_rating: false,
            sort_by_date: false,
        }
    }
}

impl TemplateQuery {
    /// Create an empty query (matches all templates)
    pub fn new() -> Self {
        Self::default()
    }
    
    /// Check if a template matches this query
    pub fn matches(&self, template: &SessionTemplate, stats: Option<&TemplateUsageStats>) -> bool {
        // Check name filter
        if let Some(name_filter) = &self.name_contains {
            if !template.name.to_lowercase().contains(&name_filter.to_lowercase()) {
                return false;
            }
        }
        
        // Check category filter
        if let Some(category_filter) = &self.category {
            if &template.category != category_filter {
                return false;
            }
        }
        
        // Check required tags
        if !self.tags.is_empty() {
            if !self.tags.iter().all(|tag| template.tags.contains(tag)) {
                return false;
            }
        }
        
        // Check optional tags
        if !self.any_tags.is_empty() {
            if !self.any_tags.iter().any(|tag| template.tags.contains(tag)) {
                return false;
            }
        }
        
        // Check usage count filter
        if let Some(min_usage) = self.min_usage_count {
            if let Some(stats) = stats {
                if stats.usage_count < min_usage {
                    return false;
                }
            } else if min_usage > 0 {
                return false;
            }
        }
        
        // Check rating filter
        if let Some(min_rating) = self.min_rating {
            if let Some(stats) = stats {
                if let Some(rating) = stats.user_rating {
                    if rating < min_rating {
                        return false;
                    }
                } else {
                    return false;
                }
            } else {
                return false;
            }
        }
        
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use crate::state::StatePersistence;
    
    #[tokio::test]
    async fn test_template_manager_creation() {
        let temp_dir = tempdir().unwrap();
        let state_persistence = Arc::new(StatePersistence::new(temp_dir.path().to_path_buf()));
        let session_manager = Arc::new(SessionManager::with_persistence(10, 10, state_persistence));
        let metadata_manager = Arc::new(SessionMetadataManager::new(temp_dir.path().to_path_buf()));
        
        let template_manager = SessionTemplateManager::new(session_manager, metadata_manager);
        assert!(template_manager.initialize().await.is_ok());
    }
    
    #[tokio::test]
    async fn test_bookmark_management() {
        let temp_dir = tempdir().unwrap();
        let state_persistence = Arc::new(StatePersistence::new(temp_dir.path().to_path_buf()));
        let session_manager = Arc::new(SessionManager::with_persistence(10, 10, state_persistence));
        let metadata_manager = Arc::new(SessionMetadataManager::new(temp_dir.path().to_path_buf()));
        metadata_manager.initialize().await.unwrap();
        
        let template_manager = SessionTemplateManager::new(session_manager.clone(), metadata_manager);
        template_manager.initialize().await.unwrap();
        
        // Create a session
        let session_id = session_manager.create_session("Test Session".to_string()).unwrap();
        
        // Create bookmark
        template_manager.create_bookmark(
            &session_id,
            "test-bookmark".to_string(),
            Some("Test bookmark".to_string()),
            vec!["test".to_string()],
            false,
        ).await.unwrap();
        
        // List bookmarks
        let bookmarks = template_manager.list_bookmarks();
        assert_eq!(bookmarks.len(), 1);
        assert_eq!(bookmarks[0].name, "test-bookmark");
        
        // Access bookmark
        let accessed_session_id = template_manager.access_bookmark("test-bookmark").await.unwrap();
        assert_eq!(accessed_session_id, session_id);
        
        // Toggle favorite
        let is_favorite = template_manager.toggle_bookmark_favorite("test-bookmark").await.unwrap();
        assert!(is_favorite);
        
        // Get favorites
        let favorites = template_manager.get_favorite_bookmarks();
        assert_eq!(favorites.len(), 1);
        
        // Delete bookmark
        template_manager.delete_bookmark("test-bookmark").await.unwrap();
        let bookmarks = template_manager.list_bookmarks();
        assert_eq!(bookmarks.len(), 0);
    }
    
    #[tokio::test]
    async fn test_template_search() {
        let temp_dir = tempdir().unwrap();
        let state_persistence = Arc::new(StatePersistence::new(temp_dir.path().to_path_buf()));
        let session_manager = Arc::new(SessionManager::with_persistence(10, 10, state_persistence));
        let metadata_manager = Arc::new(SessionMetadataManager::new(temp_dir.path().to_path_buf()));
        
        let template_manager = SessionTemplateManager::new(session_manager, metadata_manager);
        template_manager.initialize().await.unwrap();
        
        // Test search by name
        let query = TemplateQuery {
            name_contains: Some("rust".to_string()),
            ..Default::default()
        };
        let results = template_manager.search_templates(&query);
        // Results will be empty since we haven't created any templates
        assert_eq!(results.len(), 0);
        
        // Test search by category
        let query = TemplateQuery {
            category: Some("development".to_string()),
            ..Default::default()
        };
        let results = template_manager.search_templates(&query);
        assert_eq!(results.len(), 0);
    }
    
    #[tokio::test]
    async fn test_template_rating() {
        let temp_dir = tempdir().unwrap();
        let state_persistence = Arc::new(StatePersistence::new(temp_dir.path().to_path_buf()));
        let session_manager = Arc::new(SessionManager::with_persistence(10, 10, state_persistence));
        let metadata_manager = Arc::new(SessionMetadataManager::new(temp_dir.path().to_path_buf()));
        
        let template_manager = SessionTemplateManager::new(session_manager, metadata_manager);
        template_manager.initialize().await.unwrap();
        
        // Rate a template
        assert!(template_manager.rate_template("test-template", 4.5).await.is_ok());
        
        // Check rating
        let stats = template_manager.get_template_stats("test-template");
        assert!(stats.is_some());
        assert_eq!(stats.unwrap().user_rating, Some(4.5));
        
        // Test invalid rating
        assert!(template_manager.rate_template("test-template", 6.0).await.is_err());
    }
}