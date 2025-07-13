// File system walking for search operations

use super::matcher::MatcherBuilder;
use super::types::SearchOptions;
use ignore::WalkBuilder;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct FileWalker;

impl FileWalker {
    /// Walk directory and collect files to search
    pub fn collect_files(&self, root_path: &Path, options: &SearchOptions) -> Vec<PathBuf> {
        let mut files = Vec::new();

        let walker = WalkBuilder::new(root_path)
            .hidden(false) // Include hidden files by default
            .git_ignore(true) // Respect .gitignore
            .git_global(true)
            .git_exclude(true)
            .build();

        for result in walker {
            match result {
                Ok(entry) => {
                    let path = entry.path();

                    // Skip directories
                    if path.is_dir() {
                        continue;
                    }

                    // Check if file should be included
                    let path_str = path.to_string_lossy();
                    if MatcherBuilder::should_include_file(&path_str, options) {
                        files.push(path.to_path_buf());
                    }
                }
                Err(err) => {
                    eprintln!("Error walking directory: {}", err);
                }
            }
        }

        files
    }

    /// Walk directory in parallel and collect files
    pub async fn collect_files_parallel(
        &self,
        root_path: &Path,
        options: &SearchOptions,
    ) -> Vec<PathBuf> {
        let files = Arc::new(Mutex::new(Vec::new()));
        let root_path = root_path.to_path_buf();
        let options = options.clone();

        // Use blocking task for file system operations
        let files_clone = files.clone();
        let task = tokio::task::spawn_blocking(move || {
            let walker = FileWalker;
            let collected = walker.collect_files(&root_path, &options);

            // Update the shared files vector
            let mut files = futures::executor::block_on(files_clone.lock());
            files.extend(collected);
        });

        if let Err(e) = task.await {
            eprintln!("File collection task failed: {}", e);
        }

        let files = files.lock().await;
        files.clone()
    }

    /// Walk directory with custom filter function
    pub fn collect_files_with_filter<F>(&self, root_path: &Path, filter: F) -> Vec<PathBuf>
    where
        F: Fn(&Path) -> bool,
    {
        let mut files = Vec::new();

        let walker = WalkBuilder::new(root_path)
            .hidden(false)
            .git_ignore(true)
            .git_global(true)
            .git_exclude(true)
            .build();

        for result in walker {
            match result {
                Ok(entry) => {
                    let path = entry.path();

                    if path.is_file() && filter(path) {
                        files.push(path.to_path_buf());
                    }
                }
                Err(err) => {
                    eprintln!("Error walking directory: {}", err);
                }
            }
        }

        files
    }

    /// Get file counts by extension
    pub fn analyze_directory(&self, root_path: &Path) -> DirectoryAnalysis {
        let mut analysis = DirectoryAnalysis::new();

        let walker = WalkBuilder::new(root_path)
            .hidden(false)
            .git_ignore(true)
            .build();

        for result in walker {
            match result {
                Ok(entry) => {
                    let path = entry.path();

                    if path.is_file() {
                        analysis.total_files += 1;

                        if let Some(ext) = path.extension() {
                            let ext_str = ext.to_string_lossy().to_lowercase();
                            *analysis.extensions.entry(ext_str).or_insert(0) += 1;
                        } else {
                            analysis.no_extension += 1;
                        }
                    } else if path.is_dir() {
                        analysis.total_directories += 1;
                    }
                }
                Err(_) => {
                    analysis.errors += 1;
                }
            }
        }

        analysis
    }
}

#[derive(Debug, Clone)]
pub struct DirectoryAnalysis {
    pub total_files: usize,
    pub total_directories: usize,
    pub no_extension: usize,
    pub errors: usize,
    pub extensions: std::collections::HashMap<String, usize>,
}

impl DirectoryAnalysis {
    fn new() -> Self {
        Self {
            total_files: 0,
            total_directories: 0,
            no_extension: 0,
            errors: 0,
            extensions: std::collections::HashMap::new(),
        }
    }

    pub fn most_common_extensions(&self, limit: usize) -> Vec<(String, usize)> {
        let mut extensions: Vec<_> = self
            .extensions
            .iter()
            .map(|(ext, count)| (ext.clone(), *count))
            .collect();

        extensions.sort_by(|a, b| b.1.cmp(&a.1));
        extensions.truncate(limit);

        extensions
    }
}
