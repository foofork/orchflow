use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::Mutex;
use ignore::{WalkBuilder, WalkState, DirEntry};
use grep::regex::RegexMatcher;
use regex::{RegexBuilder, Regex};
use grep::searcher::{BinaryDetection, SearcherBuilder, Searcher, SinkMatch};
use grep::matcher::Matcher;
use crate::orchestrator::{Plugin, PluginMetadata, PluginContext, Event};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SearchOptions {
    case_sensitive: bool,
    whole_word: bool,
    use_regex: bool,
    include_patterns: Vec<String>,
    exclude_patterns: Vec<String>,
    max_results: usize,
    context_lines: usize,
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
struct SearchResult {
    file_path: String,
    line_number: usize,
    column_start: usize,
    column_end: usize,
    line_text: String,
    context_before: Vec<String>,
    context_after: Vec<String>,
    match_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SearchQuery {
    pattern: String,
    options: SearchOptions,
    timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ReplaceOptions {
    dry_run: bool,
    create_backup: bool,
}

/// Search Plugin - Fast project-wide search using ripgrep's libraries
pub struct SearchPlugin {
    context: Option<PluginContext>,
    search_history: Vec<SearchQuery>,
    current_search: Option<Arc<Mutex<Vec<SearchResult>>>>,
    max_history_size: usize,
}

impl SearchPlugin {
    pub fn new() -> Self {
        Self {
            context: None,
            search_history: Vec::new(),
            current_search: None,
            max_history_size: 100,
        }
    }
    
    /// Build regex matcher from pattern and options
    fn build_matcher(&self, pattern: &str, options: &SearchOptions) -> Result<RegexMatcher, String> {
        let mut pattern_str = pattern.to_string();
        
        // Handle whole word matching
        if options.whole_word && !options.use_regex {
            pattern_str = format!(r"\b{}\b", regex::escape(&pattern_str));
        } else if !options.use_regex {
            pattern_str = regex::escape(&pattern_str);
        }
        
        RegexMatcher::new(&pattern_str)
            .map_err(|e| format!("Failed to create regex matcher: {}", e))
    }
    
    /// Search in a single file
    async fn search_file(
        &self,
        path: &Path,
        matcher: &RegexMatcher,
        options: &SearchOptions,
        results: Arc<Mutex<Vec<SearchResult>>>,
    ) -> Result<(), String> {
        let file_path = path.to_string_lossy().to_string();
        
        let mut searcher = SearcherBuilder::new()
            .binary_detection(BinaryDetection::quit(b'\x00'))
            .line_number(true)
            .before_context(options.context_lines)
            .after_context(options.context_lines)
            .build();
        
        // Custom sink to collect results
        struct ResultSink {
            file_path: String,
            results: Arc<Mutex<Vec<SearchResult>>>,
            context_before: Vec<String>,
            max_results: usize,
        }
        
        impl ResultSink {
            fn new(file_path: String, results: Arc<Mutex<Vec<SearchResult>>>, max_results: usize) -> Self {
                Self {
                    file_path,
                    results,
                    context_before: Vec::new(),
                    max_results,
                }
            }
        }
        
        impl grep::searcher::Sink for ResultSink {
            type Error = std::io::Error;
            
            fn matched(
                &mut self,
                searcher: &Searcher,
                mat: &SinkMatch<'_>,
            ) -> Result<bool, Self::Error> {
                let line_text = String::from_utf8_lossy(mat.bytes()).to_string();
                let line_number = mat.line_number().unwrap_or(0) as usize;
                
                // Find match positions within the line
                let line_offset = mat.absolute_byte_offset() - mat.bytes().len() as u64;
                let match_start = (mat.absolute_byte_offset() - line_offset) as usize;
                let match_end = match_start + mat.bytes().len();
                
                let result = SearchResult {
                    file_path: self.file_path.clone(),
                    line_number,
                    column_start: match_start,
                    column_end: match_end,
                    line_text: line_text.trim_end().to_string(),
                    context_before: self.context_before.clone(),
                    context_after: vec![], // Will be filled by context_break
                    match_text: String::from_utf8_lossy(mat.bytes()).to_string(),
                };
                
                let mut results = futures::executor::block_on(self.results.lock());
                results.push(result);
                
                // Stop searching if we've hit the max results
                Ok(results.len() < self.max_results)
            }
            
            fn context(
                &mut self,
                searcher: &Searcher,
                context: &grep::searcher::SinkContext<'_>,
            ) -> Result<bool, Self::Error> {
                let line_text = String::from_utf8_lossy(context.bytes()).trim_end().to_string();
                
                if matches!(context.kind(), grep::searcher::SinkContextKind::Before) {
                    self.context_before.push(line_text);
                    // Keep only the last N context lines
                    if self.context_before.len() > 3 {
                        self.context_before.remove(0);
                    }
                } else if matches!(context.kind(), grep::searcher::SinkContextKind::After) {
                    // Add to the last result's context_after
                    let mut results = futures::executor::block_on(self.results.lock());
                    if let Some(last_result) = results.last_mut() {
                        last_result.context_after.push(line_text);
                    }
                }
                
                Ok(true)
            }
            
            fn context_break(
                &mut self,
                searcher: &Searcher,
            ) -> Result<bool, Self::Error> {
                // Clear context for next match
                self.context_before.clear();
                Ok(true)
            }
        }
        
        let mut sink = ResultSink::new(file_path, results.clone(), options.max_results);
        
        searcher.search_path(matcher, path, &mut sink)
            .map_err(|e| format!("Search error in file: {}", e))?;
        
        Ok(())
    }
    
    /// Perform project-wide search
    async fn search_project(
        &mut self,
        root_path: &str,
        pattern: &str,
        options: SearchOptions,
    ) -> Result<Vec<SearchResult>, String> {
        // Save to history
        let query = SearchQuery {
            pattern: pattern.to_string(),
            options: options.clone(),
            timestamp: chrono::Utc::now(),
        };
        self.search_history.push(query);
        if self.search_history.len() > self.max_history_size {
            self.search_history.remove(0);
        }
        
        let matcher = self.build_matcher(pattern, &options)?;
        let results = Arc::new(Mutex::new(Vec::new()));
        self.current_search = Some(results.clone());
        
        // Build file walker
        let mut builder = WalkBuilder::new(root_path);
        builder
            .standard_filters(true) // Respect .gitignore
            .hidden(false) // Don't skip hidden files by default
            .parents(true) // Respect parent .gitignore files
            .git_ignore(true)
            .git_global(true)
            .git_exclude(true);
        
        // Add include patterns
        for pattern in &options.include_patterns {
            builder.add_custom_ignore_filename(pattern);
        }
        
        // Configure parallelism
        let walker = builder.threads(num_cpus::get()).build_parallel();
        
        let search_results = results.clone();
        let search_options = options.clone();
        
        // Perform parallel search
        walker.run(|| {
            let matcher = matcher.clone();
            let results = search_results.clone();
            let options = search_options.clone();
            let search_self = self.clone();
            
            Box::new(move |entry_result| {
                let entry = match entry_result {
                    Ok(entry) => entry,
                    Err(_) => return WalkState::Continue,
                };
                
                if !entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
                    return WalkState::Continue;
                }
                
                // Check if we should skip this file
                let path = entry.path();
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
                
                // Skip binary files
                if matches!(ext, "exe" | "dll" | "so" | "dylib" | "jpg" | "png" | "gif" | "mp4" | "zip" | "tar" | "gz") {
                    return WalkState::Continue;
                }
                
                // Apply exclude patterns
                let path_str = path.to_string_lossy();
                for exclude in &options.exclude_patterns {
                    if path_str.contains(exclude) {
                        return WalkState::Continue;
                    }
                }
                
                // Search the file
                let search_future = search_self.search_file(path, &matcher, &options, results.clone());
                futures::executor::block_on(search_future).ok();
                
                // Check if we've hit max results
                let current_count = futures::executor::block_on(results.lock()).len();
                if current_count >= options.max_results {
                    return WalkState::Quit;
                }
                
                WalkState::Continue
            })
        });
        
        let final_results = results.lock().await.clone();
        self.current_search = None;
        
        Ok(final_results)
    }
    
    /// Replace text in files
    async fn replace_in_files(
        &self,
        files: Vec<String>,
        search_pattern: &str,
        replacement: &str,
        options: ReplaceOptions,
    ) -> Result<HashMap<String, usize>, String> {
        let mut replacements = HashMap::new();
        
        for file_path in files {
            let path = Path::new(&file_path);
            if !path.exists() {
                continue;
            }
            
            let content = tokio::fs::read_to_string(&path).await
                .map_err(|e| format!("Failed to read file {}: {}", file_path, e))?;
            
            // Count replacements
            let matcher = regex::RegexBuilder::new(search_pattern)
                .multi_line(true)
                .build()
                .map_err(|e| format!("Invalid regex: {}", e))?;
            
            let mut count = 0;
            let new_content = matcher.replace_all(&content, |_: &regex::Captures| {
                count += 1;
                replacement
            }).to_string();
            
            if count > 0 {
                replacements.insert(file_path.clone(), count);
                
                if !options.dry_run {
                    // Create backup if requested
                    if options.create_backup {
                        let backup_path = format!("{}.bak", file_path);
                        tokio::fs::copy(&path, &backup_path).await
                            .map_err(|e| format!("Failed to create backup: {}", e))?;
                    }
                    
                    // Write new content
                    tokio::fs::write(&path, new_content).await
                        .map_err(|e| format!("Failed to write file {}: {}", file_path, e))?;
                }
            }
        }
        
        Ok(replacements)
    }
}

// Implement Clone manually to handle the Arc<Mutex<>>
impl Clone for SearchPlugin {
    fn clone(&self) -> Self {
        Self {
            context: self.context.clone(),
            search_history: self.search_history.clone(),
            current_search: None, // Don't clone active search
            max_history_size: self.max_history_size,
        }
    }
}

#[async_trait]
impl Plugin for SearchPlugin {
    fn id(&self) -> &str {
        "search"
    }
    
    fn metadata(&self) -> PluginMetadata {
        PluginMetadata {
            name: "Search Plugin".to_string(),
            version: "0.1.0".to_string(),
            author: "Orchflow Team".to_string(),
            description: "Fast project-wide search using ripgrep".to_string(),
            capabilities: vec![
                "search.find".to_string(),
                "search.findInFiles".to_string(),
                "search.replace".to_string(),
                "search.replaceAll".to_string(),
                "search.history".to_string(),
            ],
        }
    }
    
    async fn init(&mut self, context: PluginContext) -> Result<(), String> {
        self.context = Some(context);
        Ok(())
    }
    
    async fn handle_event(&mut self, event: &Event) -> Result<(), String> {
        // No events to handle currently
        Ok(())
    }
    
    async fn handle_request(&mut self, method: &str, params: Value) -> Result<Value, String> {
        match method {
            "search.findInFiles" => {
                let pattern = params["pattern"].as_str()
                    .ok_or("Missing pattern parameter")?;
                let root_path = params["rootPath"].as_str()
                    .unwrap_or(".");
                
                let options = if let Some(opts) = params.get("options") {
                    serde_json::from_value(opts.clone()).unwrap_or_default()
                } else {
                    SearchOptions::default()
                };
                
                let results = self.search_project(root_path, pattern, options).await?;
                Ok(json!({ 
                    "results": results,
                    "total": results.len()
                }))
            }
            
            "search.find" => {
                // Single file search
                let pattern = params["pattern"].as_str()
                    .ok_or("Missing pattern parameter")?;
                let file_path = params["filePath"].as_str()
                    .ok_or("Missing filePath parameter")?;
                
                let options = if let Some(opts) = params.get("options") {
                    serde_json::from_value(opts.clone()).unwrap_or_default()
                } else {
                    SearchOptions::default()
                };
                
                let matcher = self.build_matcher(pattern, &options)?;
                let results = Arc::new(Mutex::new(Vec::new()));
                
                self.search_file(Path::new(file_path), &matcher, &options, results.clone()).await?;
                
                let final_results = results.lock().await.clone();
                Ok(json!({ "results": final_results }))
            }
            
            "search.replace" => {
                let files = params["files"].as_array()
                    .ok_or("Missing files parameter")?
                    .iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect();
                
                let search_pattern = params["searchPattern"].as_str()
                    .ok_or("Missing searchPattern parameter")?;
                let replacement = params["replacement"].as_str()
                    .ok_or("Missing replacement parameter")?;
                
                let options = if let Some(opts) = params.get("options") {
                    serde_json::from_value(opts.clone()).unwrap_or(ReplaceOptions {
                        dry_run: false,
                        create_backup: true,
                    })
                } else {
                    ReplaceOptions {
                        dry_run: false,
                        create_backup: true,
                    }
                };
                
                let replacements = self.replace_in_files(files, search_pattern, replacement, options).await?;
                Ok(json!({ 
                    "replacements": replacements,
                    "totalFiles": replacements.len(),
                    "totalReplacements": replacements.values().sum::<usize>()
                }))
            }
            
            "search.history" => {
                let limit = params["limit"].as_u64().unwrap_or(50) as usize;
                let history: Vec<_> = self.search_history.iter()
                    .rev()
                    .take(limit)
                    .cloned()
                    .collect();
                    
                Ok(json!({ "history": history }))
            }
            
            "search.clearHistory" => {
                self.search_history.clear();
                Ok(json!({ "status": "ok" }))
            }
            
            "search.cancel" => {
                // In a real implementation, would support cancellation
                self.current_search = None;
                Ok(json!({ "status": "ok" }))
            }
            
            _ => Err(format!("Unknown method: {}", method))
        }
    }
    
    async fn shutdown(&mut self) -> Result<(), String> {
        self.current_search = None;
        Ok(())
    }
}