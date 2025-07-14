use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};

/// Enhanced PaneType with rich metadata support
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EnhancedPaneType {
    Terminal,
    /// Custom pane with metadata
    Custom {
        name: String,
        category: PaneCategory,
        metadata: PaneMetadata,
    },
}

impl Default for EnhancedPaneType {
    fn default() -> Self {
        EnhancedPaneType::Terminal
    }
}

/// Predefined pane categories for classification
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PaneCategory {
    /// Build and compilation tasks
    Build,
    /// Testing and validation
    Test,
    /// AI agent interactions
    Agent,
    /// Debugging sessions
    Debug,
    /// Development server
    Server,
    /// Monitoring and logs
    Monitor,
    /// Database operations
    Database,
    /// Documentation and notes
    Docs,
    /// Custom category
    Custom(String),
}

impl Default for PaneCategory {
    fn default() -> Self {
        PaneCategory::Custom("general".to_string())
    }
}

/// Rich metadata for panes
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PaneMetadata {
    /// Human-readable description
    pub description: Option<String>,
    /// Tags for filtering and organization
    pub tags: Vec<String>,
    /// Key-value pairs for custom metadata
    pub attributes: HashMap<String, String>,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    /// Last modified timestamp
    pub modified_at: DateTime<Utc>,
    /// Priority level (1-10, higher is more important)
    pub priority: u8,
    /// Whether this pane should be automatically restored
    pub auto_restore: bool,
    /// Command to run when restoring
    pub restore_command: Option<String>,
    /// Environment variables for this pane
    pub environment: HashMap<String, String>,
    /// Working directory for this pane
    pub working_directory: Option<String>,
}

impl Default for PaneMetadata {
    fn default() -> Self {
        let now = Utc::now();
        Self {
            description: None,
            tags: Vec::new(),
            attributes: HashMap::new(),
            created_at: now,
            modified_at: now,
            priority: 5,
            auto_restore: false,
            restore_command: None,
            environment: HashMap::new(),
            working_directory: None,
        }
    }
}

impl PaneMetadata {
    /// Create new metadata with current timestamp
    pub fn new() -> Self {
        Self::default()
    }

    /// Update the modified timestamp
    pub fn touch(&mut self) {
        self.modified_at = Utc::now();
    }

    /// Add a tag if it doesn't exist
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

    /// Remove an attribute
    pub fn remove_attribute(&mut self, key: &str) {
        if self.attributes.remove(key).is_some() {
            self.touch();
        }
    }

    /// Check if pane matches a tag filter
    pub fn matches_tag(&self, tag: &str) -> bool {
        self.tags.iter().any(|t| t == tag)
    }

    /// Check if pane matches any of the provided tags
    pub fn matches_any_tag(&self, tags: &[String]) -> bool {
        tags.iter().any(|tag| self.matches_tag(tag))
    }

    /// Check if pane matches all of the provided tags
    pub fn matches_all_tags(&self, tags: &[String]) -> bool {
        tags.iter().all(|tag| self.matches_tag(tag))
    }

    /// Get attribute value
    pub fn get_attribute(&self, key: &str) -> Option<&String> {
        self.attributes.get(key)
    }
}

/// Query for filtering panes by classification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaneClassificationQuery {
    /// Filter by category
    pub category: Option<PaneCategory>,
    /// Filter by tags (must match all)
    pub tags: Vec<String>,
    /// Filter by tags (must match any)
    pub any_tags: Vec<String>,
    /// Filter by attributes
    pub attributes: HashMap<String, String>,
    /// Filter by priority range
    pub priority_range: Option<(u8, u8)>,
    /// Filter by auto-restore flag
    pub auto_restore: Option<bool>,
    /// Filter by creation date range
    pub created_after: Option<DateTime<Utc>>,
    pub created_before: Option<DateTime<Utc>>,
}

impl Default for PaneClassificationQuery {
    fn default() -> Self {
        Self {
            category: None,
            tags: Vec::new(),
            any_tags: Vec::new(),
            attributes: HashMap::new(),
            priority_range: None,
            auto_restore: None,
            created_after: None,
            created_before: None,
        }
    }
}

impl PaneClassificationQuery {
    /// Create an empty query (matches all panes)
    pub fn new() -> Self {
        Self::default()
    }

    /// Filter by category
    pub fn with_category(mut self, category: PaneCategory) -> Self {
        self.category = Some(category);
        self
    }

    /// Add a required tag
    pub fn with_tag(mut self, tag: String) -> Self {
        self.tags.push(tag);
        self
    }

    /// Add an optional tag (matches if any present)
    pub fn with_any_tag(mut self, tag: String) -> Self {
        self.any_tags.push(tag);
        self
    }

    /// Add an attribute filter
    pub fn with_attribute(mut self, key: String, value: String) -> Self {
        self.attributes.insert(key, value);
        self
    }

    /// Filter by priority range
    pub fn with_priority_range(mut self, min: u8, max: u8) -> Self {
        self.priority_range = Some((min, max));
        self
    }

    /// Filter by auto-restore setting
    pub fn with_auto_restore(mut self, auto_restore: bool) -> Self {
        self.auto_restore = Some(auto_restore);
        self
    }

    /// Check if a pane matches this query
    pub fn matches(&self, pane_type: &EnhancedPaneType) -> bool {
        match pane_type {
            EnhancedPaneType::Terminal => {
                // Terminal panes only match if no specific criteria are set
                self.category.is_none() 
                    && self.tags.is_empty() 
                    && self.any_tags.is_empty()
                    && self.attributes.is_empty()
            }
            EnhancedPaneType::Custom { category, metadata, .. } => {
                // Check category filter
                if let Some(ref filter_category) = self.category {
                    if category != filter_category {
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

                // Check attributes
                for (key, value) in &self.attributes {
                    if metadata.get_attribute(key) != Some(value) {
                        return false;
                    }
                }

                // Check priority range
                if let Some((min, max)) = self.priority_range {
                    if metadata.priority < min || metadata.priority > max {
                        return false;
                    }
                }

                // Check auto-restore filter
                if let Some(auto_restore) = self.auto_restore {
                    if metadata.auto_restore != auto_restore {
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

                true
            }
        }
    }
}

/// Request to update pane classification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatePaneClassificationRequest {
    pub session_id: crate::protocol::SessionId,
    pub pane_id: crate::protocol::PaneId,
    pub pane_type: EnhancedPaneType,
}

/// Request to query panes by classification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryPanesByClassificationRequest {
    pub session_id: Option<crate::protocol::SessionId>,
    pub query: PaneClassificationQuery,
}

/// Response with filtered panes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryPanesByClassificationResponse {
    pub panes: Vec<PaneClassificationInfo>,
    pub total_count: usize,
}

/// Information about a pane's classification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaneClassificationInfo {
    pub session_id: crate::protocol::SessionId,
    pub pane_id: crate::protocol::PaneId,
    pub pane_type: EnhancedPaneType,
    pub is_active: bool,
    pub last_activity: Option<DateTime<Utc>>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pane_metadata_tags() {
        let mut metadata = PaneMetadata::new();
        
        metadata.add_tag("build".to_string());
        metadata.add_tag("rust".to_string());
        
        assert!(metadata.matches_tag("build"));
        assert!(metadata.matches_tag("rust"));
        assert!(!metadata.matches_tag("test"));
        
        assert!(metadata.matches_any_tag(&["build".to_string(), "test".to_string()]));
        assert!(metadata.matches_all_tags(&["build".to_string(), "rust".to_string()]));
        assert!(!metadata.matches_all_tags(&["build".to_string(), "test".to_string()]));
        
        metadata.remove_tag("rust");
        assert!(!metadata.matches_tag("rust"));
    }

    #[test]
    fn test_pane_metadata_attributes() {
        let mut metadata = PaneMetadata::new();
        
        metadata.set_attribute("project".to_string(), "orchflow".to_string());
        metadata.set_attribute("language".to_string(), "rust".to_string());
        
        assert_eq!(metadata.get_attribute("project"), Some(&"orchflow".to_string()));
        assert_eq!(metadata.get_attribute("language"), Some(&"rust".to_string()));
        assert_eq!(metadata.get_attribute("nonexistent"), None);
        
        metadata.remove_attribute("language");
        assert_eq!(metadata.get_attribute("language"), None);
    }

    #[test]
    fn test_classification_query_matching() {
        let pane_type = EnhancedPaneType::Custom {
            name: "build-server".to_string(),
            category: PaneCategory::Build,
            metadata: {
                let mut metadata = PaneMetadata::new();
                metadata.add_tag("cargo".to_string());
                metadata.add_tag("rust".to_string());
                metadata.set_attribute("project".to_string(), "orchflow".to_string());
                metadata.priority = 8;
                metadata
            },
        };

        // Test category matching
        let query = PaneClassificationQuery::new().with_category(PaneCategory::Build);
        assert!(query.matches(&pane_type));

        let query = PaneClassificationQuery::new().with_category(PaneCategory::Test);
        assert!(!query.matches(&pane_type));

        // Test tag matching
        let query = PaneClassificationQuery::new().with_tag("cargo".to_string());
        assert!(query.matches(&pane_type));

        let query = PaneClassificationQuery::new().with_tag("npm".to_string());
        assert!(!query.matches(&pane_type));

        // Test attribute matching
        let query = PaneClassificationQuery::new()
            .with_attribute("project".to_string(), "orchflow".to_string());
        assert!(query.matches(&pane_type));

        let query = PaneClassificationQuery::new()
            .with_attribute("project".to_string(), "other".to_string());
        assert!(!query.matches(&pane_type));

        // Test priority range
        let query = PaneClassificationQuery::new().with_priority_range(5, 10);
        assert!(query.matches(&pane_type));

        let query = PaneClassificationQuery::new().with_priority_range(1, 5);
        assert!(!query.matches(&pane_type));
    }

    #[test]
    fn test_terminal_pane_matching() {
        let terminal_pane = EnhancedPaneType::Terminal;

        // Empty query should match terminal
        let query = PaneClassificationQuery::new();
        assert!(query.matches(&terminal_pane));

        // Query with criteria should not match terminal
        let query = PaneClassificationQuery::new().with_category(PaneCategory::Build);
        assert!(!query.matches(&terminal_pane));
    }

    #[test]
    fn test_pane_metadata_serialization() {
        let metadata = PaneMetadata {
            description: Some("Build server for Rust project".to_string()),
            tags: vec!["build".to_string(), "rust".to_string()],
            attributes: {
                let mut attrs = HashMap::new();
                attrs.insert("project".to_string(), "orchflow".to_string());
                attrs
            },
            priority: 8,
            auto_restore: true,
            ..Default::default()
        };

        let json = serde_json::to_string(&metadata).unwrap();
        let deserialized: PaneMetadata = serde_json::from_str(&json).unwrap();
        
        assert_eq!(metadata.description, deserialized.description);
        assert_eq!(metadata.tags, deserialized.tags);
        assert_eq!(metadata.attributes, deserialized.attributes);
        assert_eq!(metadata.priority, deserialized.priority);
        assert_eq!(metadata.auto_restore, deserialized.auto_restore);
    }
}