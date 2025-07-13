// Command implementations for search operations

use super::matcher::MatcherBuilder;
use super::replacer::TextReplacer;
use super::searcher::FileSearcher;
use super::types::*;
use super::walker::FileWalker;
use serde_json::Value;
use std::path::Path;
use std::time::Instant;

pub struct SearchCommands;

impl SearchCommands {
    /// Execute a file search command
    pub async fn execute_search(
        &self,
        request: FileSearchRequest,
    ) -> Result<FileSearchResponse, String> {
        let start_time = Instant::now();

        // Validate input
        if request.query.is_empty() {
            return Err("Search query cannot be empty".to_string());
        }

        let root_path = Path::new(&request.root_path);
        if !root_path.exists() {
            return Err(format!("Root path does not exist: {}", request.root_path));
        }

        // Create matcher
        let matcher = MatcherBuilder::build_regex_matcher(&request.query, &request.options)?;

        // Collect files to search
        let walker = FileWalker;
        let files = walker.collect_files(root_path, &request.options);
        let files_searched = files.len();

        // Convert to Path references for search
        let file_refs: Vec<&Path> = files.iter().map(|p| p.as_path()).collect();

        // Execute search
        let searcher = FileSearcher;
        let mut results = searcher
            .search_files(file_refs, &matcher, &request.options)
            .await?;

        // Sort results by file path and line number
        results.sort_by(|a, b| {
            a.file_path
                .cmp(&b.file_path)
                .then(a.line_number.cmp(&b.line_number))
        });

        let total_matches = results.len();
        let truncated = total_matches >= request.options.max_results;

        // Limit results to max_results
        results.truncate(request.options.max_results);

        let search_time_ms = start_time.elapsed().as_millis();

        Ok(FileSearchResponse {
            results,
            files_searched,
            total_matches,
            search_time_ms,
            truncated,
        })
    }

    /// Execute a text replacement command
    pub async fn execute_replace(
        &self,
        request: ReplaceRequest,
    ) -> Result<ReplaceResponse, String> {
        // Validate replacement
        let replacer = TextReplacer;
        replacer.validate_replacement(&request).await?;

        let root_path = Path::new(&request.root_path);

        // Collect files to process
        let walker = FileWalker;
        let files = walker.collect_files(root_path, &request.options);
        let file_refs: Vec<&Path> = files.iter().map(|p| p.as_path()).collect();

        // Execute replacement
        let results = replacer.replace_in_files(&file_refs, &request).await?;

        let total_files_modified = results.len();
        let total_replacements: usize = results.iter().map(|r| r.replacements_made).sum();

        Ok(ReplaceResponse {
            results,
            total_files_modified,
            total_replacements,
            dry_run: request.dry_run,
        })
    }

    /// Execute search-and-replace in one operation
    pub async fn execute_search_and_replace(
        &self,
        search_request: FileSearchRequest,
        replacement: String,
        dry_run: bool,
    ) -> Result<(FileSearchResponse, ReplaceResponse), String> {
        // First, execute search
        let search_response = self.execute_search(search_request.clone()).await?;

        // If no results, return early
        if search_response.results.is_empty() {
            return Ok((
                search_response,
                ReplaceResponse {
                    results: vec![],
                    total_files_modified: 0,
                    total_replacements: 0,
                    dry_run,
                },
            ));
        }

        // Create replace request from search results
        let replace_request = ReplaceRequest {
            query: search_request.query,
            replacement,
            root_path: search_request.root_path,
            options: search_request.options,
            dry_run,
        };

        // Execute replacement
        let replace_response = self.execute_replace(replace_request).await?;

        Ok((search_response, replace_response))
    }

    /// Get search statistics for a directory
    pub async fn get_search_stats(&self, root_path: &str) -> Result<Value, String> {
        let path = Path::new(root_path);
        if !path.exists() {
            return Err(format!("Path does not exist: {}", root_path));
        }

        let walker = FileWalker;
        let analysis = walker.analyze_directory(path);

        Ok(serde_json::json!({
            "total_files": analysis.total_files,
            "total_directories": analysis.total_directories,
            "files_without_extension": analysis.no_extension,
            "errors": analysis.errors,
            "most_common_extensions": analysis.most_common_extensions(10),
            "total_extensions": analysis.extensions.len()
        }))
    }

    /// Validate a search pattern
    pub fn validate_pattern(&self, query: &str, options: &SearchOptions) -> Result<(), String> {
        if query.is_empty() {
            return Err("Search query cannot be empty".to_string());
        }

        // Try to build the matcher to validate the pattern
        MatcherBuilder::build_regex_matcher(query, options)?;

        Ok(())
    }

    /// Get supported file extensions for search
    pub fn get_supported_extensions(&self) -> Vec<String> {
        vec![
            "rs",
            "py",
            "js",
            "ts",
            "jsx",
            "tsx",
            "go",
            "java",
            "c",
            "cpp",
            "h",
            "hpp",
            "cs",
            "php",
            "rb",
            "swift",
            "kt",
            "scala",
            "clj",
            "ex",
            "elixir",
            "hs",
            "ml",
            "fs",
            "r",
            "m",
            "pl",
            "sh",
            "bash",
            "zsh",
            "fish",
            "ps1",
            "cmd",
            "html",
            "htm",
            "css",
            "scss",
            "sass",
            "less",
            "xml",
            "svg",
            "json",
            "yaml",
            "yml",
            "toml",
            "ini",
            "cfg",
            "conf",
            "properties",
            "env",
            "txt",
            "md",
            "rst",
            "org",
            "tex",
            "log",
            "sql",
            "graphql",
            "gql",
            "proto",
            "thrift",
            "dockerfile",
            "makefile",
            "cmake",
            "gradle",
            "pom",
            "sbt",
            "cargo",
        ]
        .into_iter()
        .map(String::from)
        .collect()
    }
}
