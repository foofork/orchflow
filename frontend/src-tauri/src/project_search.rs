use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use serde::{Deserialize, Serialize};
use grep::regex::RegexMatcher;
use grep::searcher::{Searcher, SearcherBuilder, Sink, SinkMatch};
use ignore::{WalkBuilder, WalkState};
use std::collections::HashMap;
use crate::error::{OrchflowError, Result};

/// Search result for a single file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileSearchResult {
    pub path: PathBuf,
    pub matches: Vec<SearchMatch>,
    pub total_matches: usize,
}

/// Individual match within a file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchMatch {
    pub line_number: u64,
    pub line_text: String,
    pub match_start: usize,
    pub match_end: usize,
    pub context_before: Vec<String>,
    pub context_after: Vec<String>,
}

/// Search options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchOptions {
    pub pattern: String,
    pub path: Option<PathBuf>,
    pub case_sensitive: bool,
    pub whole_word: bool,
    pub regex: bool,
    pub include_patterns: Vec<String>,
    pub exclude_patterns: Vec<String>,
    pub max_results: Option<usize>,
    pub context_lines: usize,
    pub follow_symlinks: bool,
    pub search_hidden: bool,
    pub max_file_size: Option<u64>,
}

impl Default for SearchOptions {
    fn default() -> Self {
        Self {
            pattern: String::new(),
            path: None,
            case_sensitive: false,
            whole_word: false,
            regex: false,
            include_patterns: vec![],
            exclude_patterns: vec![
                "*.log".to_string(),
                "*.lock".to_string(),
                "node_modules/**".to_string(),
                "target/**".to_string(),
                ".git/**".to_string(),
                "dist/**".to_string(),
                "build/**".to_string(),
            ],
            max_results: Some(1000),
            context_lines: 2,
            follow_symlinks: false,
            search_hidden: false,
            max_file_size: Some(10 * 1024 * 1024), // 10MB
        }
    }
}

/// Project-wide search engine
pub struct ProjectSearch {
    root_path: PathBuf,
    search_cache: Arc<RwLock<HashMap<String, Vec<FileSearchResult>>>>,
}

impl ProjectSearch {
    pub fn new(root_path: PathBuf) -> Self {
        Self {
            root_path,
            search_cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    /// Perform a project-wide search
    pub async fn search(&self, options: SearchOptions) -> Result<Vec<FileSearchResult>> {
        let search_path = options.path.as_ref().unwrap_or(&self.root_path);
        
        // Build the pattern matcher
        let pattern = if options.whole_word {
            format!(r"\b{}\b", regex::escape(&options.pattern))
        } else if options.regex {
            options.pattern.clone()
        } else {
            regex::escape(&options.pattern)
        };
        
        let matcher = RegexMatcher::new_line_matcher(&pattern)
            .map_err(|e| OrchflowError::ValidationError {
                field: "pattern".to_string(),
                reason: e.to_string(),
            })?;
        
        // Configure the searcher
        let searcher = SearcherBuilder::new()
            .line_number(true)
            .before_context(options.context_lines)
            .after_context(options.context_lines)
            .build();
        
        // Set up the directory walker
        let mut walk_builder = WalkBuilder::new(search_path);
        walk_builder
            .follow_links(options.follow_symlinks)
            .hidden(!options.search_hidden)
            .max_depth(None)
            .threads(num_cpus::get());
        
        // Add include patterns
        for pattern in &options.include_patterns {
            walk_builder.add_custom_ignore_filename(pattern);
        }
        
        // Add exclude patterns
        for pattern in &options.exclude_patterns {
            walk_builder.add_custom_ignore_filename(pattern);
        }
        
        let (tx, mut rx) = mpsc::channel(100);
        let max_results = options.max_results.unwrap_or(usize::MAX);
        let max_file_size = options.max_file_size;
        
        // Perform parallel search
        let walker = walk_builder.build_parallel();
        walker.run(|| {
            let tx = tx.clone();
            let matcher = matcher.clone();
            let mut searcher = searcher.clone();
            let mut total_results = 0;
            
            Box::new(move |result| {
                if total_results >= max_results {
                    return WalkState::Quit;
                }
                
                let entry = match result {
                    Ok(entry) => entry,
                    Err(_) => return WalkState::Continue,
                };
                
                // Skip non-files
                if !entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
                    return WalkState::Continue;
                }
                
                // Check file size
                if let Some(max_size) = max_file_size {
                    if let Ok(metadata) = entry.metadata() {
                        if metadata.len() > max_size {
                            return WalkState::Continue;
                        }
                    }
                }
                
                // Search the file
                let path = entry.path();
                let mut sink = MatchCollector::new(path.to_path_buf());
                
                if let Err(_) = searcher.search_path(&matcher, path, &mut sink) {
                    return WalkState::Continue;
                }
                
                if !sink.matches.is_empty() {
                    total_results += sink.matches.len();
                    let result = FileSearchResult {
                        path: path.to_path_buf(),
                        total_matches: sink.matches.len(),
                        matches: sink.matches,
                    };
                    
                    let _ = tx.blocking_send(result);
                    
                    if total_results >= max_results {
                        return WalkState::Quit;
                    }
                }
                
                WalkState::Continue
            })
        });
        
        // Collect results
        drop(tx);
        let mut results = Vec::new();
        while let Some(result) = rx.recv().await {
            results.push(result);
            if results.len() >= max_results {
                break;
            }
        }
        
        // Cache results
        let cache_key = format!("{:?}", options);
        self.search_cache.write().await.insert(cache_key, results.clone());
        
        Ok(results)
    }
    
    /// Search with a simple string pattern
    pub async fn search_simple(&self, pattern: &str, case_sensitive: bool) -> Result<Vec<FileSearchResult>> {
        let options = SearchOptions {
            pattern: pattern.to_string(),
            case_sensitive,
            ..Default::default()
        };
        
        self.search(options).await
    }
    
    /// Get cached search results
    pub async fn get_cached_results(&self, pattern: &str) -> Option<Vec<FileSearchResult>> {
        let cache = self.search_cache.read().await;
        cache.iter()
            .find(|(k, _)| k.contains(pattern))
            .map(|(_, v)| v.clone())
    }
    
    /// Clear search cache
    pub async fn clear_cache(&self) {
        self.search_cache.write().await.clear();
    }
}

/// Collector for search matches within a file
struct MatchCollector {
    path: PathBuf,
    matches: Vec<SearchMatch>,
}

impl MatchCollector {
    fn new(path: PathBuf) -> Self {
        Self {
            path,
            matches: Vec::new(),
        }
    }
}

impl Sink for MatchCollector {
    type Error = std::io::Error;
    
    fn matched(&mut self, _searcher: &Searcher, mat: &SinkMatch<'_>) -> std::result::Result<bool, Self::Error> {
        let line_text = String::from_utf8_lossy(mat.bytes()).to_string();
        
        let match_start = mat.absolute_byte_offset() as usize;
        let match_end = match_start + mat.bytes().len();
        
        let search_match = SearchMatch {
            line_number: mat.line_number().unwrap_or(0),
            line_text: line_text.trim_end().to_string(),
            match_start,
            match_end,
            context_before: vec![], // TODO: Implement context collection
            context_after: vec![],  // TODO: Implement context collection
        };
        
        self.matches.push(search_match);
        Ok(true)
    }
}

/// Advanced search features
pub struct AdvancedSearch {
    search_engine: ProjectSearch,
    search_history: Arc<RwLock<Vec<String>>>,
    saved_searches: Arc<RwLock<HashMap<String, SearchOptions>>>,
}

impl AdvancedSearch {
    pub fn new(root_path: PathBuf) -> Self {
        Self {
            search_engine: ProjectSearch::new(root_path),
            search_history: Arc::new(RwLock::new(Vec::new())),
            saved_searches: Arc::new(RwLock::new(HashMap::new())),
        }
    }
    
    /// Search with history tracking
    pub async fn search_with_history(&self, options: SearchOptions) -> Result<Vec<FileSearchResult>> {
        // Add to history
        self.search_history.write().await.push(options.pattern.clone());
        
        // Perform search
        self.search_engine.search(options).await
    }
    
    /// Save a search for later use
    pub async fn save_search(&self, name: String, options: SearchOptions) {
        self.saved_searches.write().await.insert(name, options);
    }
    
    /// Load a saved search
    pub async fn load_search(&self, name: &str) -> Option<SearchOptions> {
        self.saved_searches.read().await.get(name).cloned()
    }
    
    /// Get search history
    pub async fn get_history(&self, limit: usize) -> Vec<String> {
        let history = self.search_history.read().await;
        history.iter()
            .rev()
            .take(limit)
            .cloned()
            .collect()
    }
    
    /// Replace in files
    pub async fn replace_in_files(
        &self,
        search_options: SearchOptions,
        replacement: &str,
        dry_run: bool,
    ) -> Result<Vec<ReplaceResult>> {
        let search_results = self.search_engine.search(search_options.clone()).await?;
        let mut replace_results = Vec::new();
        
        for file_result in search_results {
            let mut result = ReplaceResult {
                path: file_result.path.clone(),
                replacements: 0,
                success: true,
                error: None,
            };
            
            if dry_run {
                // Just report what would be replaced
                result.replacements = file_result.total_matches;
                replace_results.push(result);
            } else {
                // Perform actual file replacement
                match self.replace_in_file(&file_result, &search_options, replacement).await {
                    Ok(count) => {
                        result.replacements = count;
                    },
                    Err(e) => {
                        result.success = false;
                        result.error = Some(e.to_string());
                    }
                }
                replace_results.push(result);
            }
        }
        
        Ok(replace_results)
    }
    
    /// Replace occurrences in a single file
    async fn replace_in_file(
        &self,
        file_result: &FileSearchResult,
        search_options: &SearchOptions,
        replacement: &str,
    ) -> Result<usize> {
        use tokio::fs;
        use regex::Regex;
        
        // Read the file
        let content = fs::read_to_string(&file_result.path).await
            .map_err(|e| crate::error::OrchflowError::FileError {
                operation: "read_file".to_string(),
                path: file_result.path.to_string_lossy().to_string(),
                reason: e.to_string(),
            })?;
        
        // Perform replacements
        let (new_content, count) = if search_options.regex {
            // Regex replacement
            let pattern = if search_options.whole_word {
                format!(r"\b{}\b", &search_options.pattern)
            } else {
                search_options.pattern.clone()
            };
            
            match Regex::new(&pattern) {
                Ok(re) => {
                    let mut count = 0;
                    let new_content = re.replace_all(&content, |_: &regex::Captures| {
                        count += 1;
                        replacement
                    });
                    (new_content.into_owned(), count)
                },
                Err(e) => return Err(crate::error::OrchflowError::ValidationError {
                    field: "pattern".to_string(),
                    reason: format!("Invalid regex: {}", e),
                }),
            }
        } else {
            // Simple string replacement
            let search_str = &search_options.pattern;
            let mut count = 0;
            let mut new_content = String::with_capacity(content.len());
            let mut last_end = 0;
            
            let matches: Vec<_> = if search_options.case_sensitive {
                content.match_indices(search_str).collect()
            } else {
                content.to_lowercase()
                    .match_indices(&search_str.to_lowercase())
                    .map(|(pos, _)| (pos, &content[pos..pos + search_str.len()]))
                    .collect()
            };
            
            for (pos, _) in matches {
                // Check whole word boundary if needed
                if search_options.whole_word {
                    let before_ok = pos == 0 || !content.chars().nth(pos - 1).unwrap_or(' ').is_alphanumeric();
                    let after_ok = pos + search_str.len() >= content.len() || 
                        !content.chars().nth(pos + search_str.len()).unwrap_or(' ').is_alphanumeric();
                    
                    if !before_ok || !after_ok {
                        continue;
                    }
                }
                
                new_content.push_str(&content[last_end..pos]);
                new_content.push_str(replacement);
                last_end = pos + search_str.len();
                count += 1;
            }
            
            new_content.push_str(&content[last_end..]);
            (new_content, count)
        };
        
        // Only write if we made changes
        if count > 0 {
            fs::write(&file_result.path, new_content).await
                .map_err(|e| crate::error::OrchflowError::FileError {
                    operation: "write_file".to_string(),
                    path: file_result.path.to_string_lossy().to_string(),
                    reason: e.to_string(),
                })?;
        }
        
        Ok(count)
    }

    /// Clear search cache
    pub async fn clear_cache(&self) {
        self.search_engine.clear_cache().await;
    }
}

/// Result of a replace operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplaceResult {
    pub path: PathBuf,
    pub replacements: usize,
    pub success: bool,
    pub error: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use tokio::fs;
    
    #[tokio::test]
    async fn test_simple_search() -> Result<()> {
        let temp_dir = TempDir::new().unwrap();
        let search = ProjectSearch::new(temp_dir.path().to_path_buf());
        
        // Create test files
        let file1 = temp_dir.path().join("test1.txt");
        fs::write(&file1, "Hello world\nThis is a test\nHello again").await.unwrap();
        
        let file2 = temp_dir.path().join("test2.txt");
        fs::write(&file2, "Another file\nWith hello in it").await.unwrap();
        
        // Search for "hello" (case insensitive)
        let results = search.search_simple("hello", false).await?;
        
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].total_matches + results[1].total_matches, 3);
        
        Ok(())
    }
}