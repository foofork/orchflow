// File content searching implementation

use std::path::Path;
use std::sync::Arc;
use tokio::sync::Mutex;
use grep::regex::RegexMatcher;
use grep::searcher::{BinaryDetection, SearcherBuilder, Searcher, SinkMatch};
use super::types::{SearchOptions, SearchResult};

pub struct FileSearcher;

impl FileSearcher {
    /// Search for matches in a single file
    pub async fn search_file(
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
        let mut sink = ResultSink::new(file_path, results.clone(), options.max_results);
        
        searcher
            .search_path(matcher, path, &mut sink)
            .map_err(|e| format!("Search error in {}: {}", path.display(), e))?;
        
        Ok(())
    }
    
    /// Search multiple files concurrently
    pub async fn search_files(
        &self,
        paths: Vec<&Path>,
        matcher: &RegexMatcher,
        options: &SearchOptions,
    ) -> Result<Vec<SearchResult>, String> {
        let results = Arc::new(Mutex::new(Vec::new()));
        let mut tasks = Vec::new();
        
        for path in paths {
            let path = path.to_owned();
            let matcher = matcher.clone();
            let options = options.clone();
            let results = results.clone();
            
            let task = tokio::spawn(async move {
                let searcher = FileSearcher;
                searcher.search_file(&path, &matcher, &options, results).await
            });
            
            tasks.push(task);
        }
        
        // Wait for all searches to complete
        for task in tasks {
            if let Err(e) = task.await {
                eprintln!("Search task failed: {}", e);
            }
        }
        
        let results = results.lock().await;
        Ok(results.clone())
    }
}

// Custom sink to collect search results
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
        _searcher: &Searcher,
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
            context_after: vec![], // Will be filled by context method
            match_text: String::from_utf8_lossy(mat.bytes()).to_string(),
        };
        
        let mut results = futures::executor::block_on(self.results.lock());
        results.push(result);
        
        // Stop searching if we've hit the max results
        Ok(results.len() < self.max_results)
    }
    
    fn context(
        &mut self,
        _searcher: &Searcher,
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
        _searcher: &Searcher,
    ) -> Result<bool, Self::Error> {
        // Clear context for next match
        self.context_before.clear();
        Ok(true)
    }
}