// Core search types and structures

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchOptions {
    pub case_sensitive: bool,
    pub whole_word: bool,
    pub use_regex: bool,
    pub include_patterns: Vec<String>,
    pub exclude_patterns: Vec<String>,
    pub max_results: usize,
    pub context_lines: usize,
}

impl Default for SearchOptions {
    fn default() -> Self {
        Self {
            case_sensitive: false,
            whole_word: false,
            use_regex: false,
            include_patterns: vec![],
            exclude_patterns: vec![],
            max_results: 10000,
            context_lines: 2,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub file_path: String,
    pub line_number: usize,
    pub column_start: usize,
    pub column_end: usize,
    pub line_text: String,
    pub context_before: Vec<String>,
    pub context_after: Vec<String>,
    pub match_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileSearchRequest {
    pub query: String,
    pub root_path: String,
    pub options: SearchOptions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileSearchResponse {
    pub results: Vec<SearchResult>,
    pub files_searched: usize,
    pub total_matches: usize,
    pub search_time_ms: u128,
    pub truncated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplaceRequest {
    pub query: String,
    pub replacement: String,
    pub root_path: String,
    pub options: SearchOptions,
    pub dry_run: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplaceResult {
    pub file_path: String,
    pub replacements_made: usize,
    pub preview: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplaceResponse {
    pub results: Vec<ReplaceResult>,
    pub total_files_modified: usize,
    pub total_replacements: usize,
    pub dry_run: bool,
}