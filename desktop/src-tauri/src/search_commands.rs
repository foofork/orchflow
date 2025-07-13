use crate::error::Result;
use crate::manager::Manager;
use crate::project_search::{FileSearchResult, ReplaceResult, SearchOptions};
use serde::{Deserialize, Serialize};
use tauri::State;

/// Perform a project-wide search
#[tauri::command]
pub async fn search_project(
    manager: State<'_, Manager>,
    options: SearchOptions,
) -> Result<SearchResults> {
    if let Some(project_search) = &manager.project_search {
        let results = project_search.search(options).await.map_err(|e| {
            crate::error::OrchflowError::SearchError {
                operation: "project_search".to_string(),
                reason: e.to_string(),
            }
        })?;

        let total_matches = results.iter().map(|r| r.total_matches).sum();
        let max_results = 1000; // Could be configurable
        let truncated = results.len() >= max_results;

        Ok(SearchResults {
            results,
            total_matches,
            truncated,
        })
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "project_search".to_string(),
            reason: "Project search not initialized".to_string(),
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResults {
    pub results: Vec<FileSearchResult>,
    pub total_matches: usize,
    pub truncated: bool,
}

/// Perform a simple text search
#[tauri::command]
pub async fn search_text(
    manager: State<'_, Manager>,
    pattern: String,
    case_sensitive: bool,
) -> Result<SearchResults> {
    if let Some(project_search) = &manager.project_search {
        let options = SearchOptions {
            pattern,
            case_sensitive,
            ..Default::default()
        };

        let results = project_search.search(options).await.map_err(|e| {
            crate::error::OrchflowError::SearchError {
                operation: "text_search".to_string(),
                reason: e.to_string(),
            }
        })?;

        let total_matches = results.iter().map(|r| r.total_matches).sum();
        let max_results = 1000;
        let truncated = results.len() >= max_results;

        Ok(SearchResults {
            results,
            total_matches,
            truncated,
        })
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "project_search".to_string(),
            reason: "Project search not initialized".to_string(),
        })
    }
}

/// Search and replace in files
#[tauri::command]
pub async fn replace_in_files(
    manager: State<'_, Manager>,
    search_options: SearchOptions,
    replacement: String,
    dry_run: bool,
) -> Result<Vec<ReplaceResult>> {
    if let Some(project_search) = &manager.project_search {
        project_search
            .replace_in_files(search_options, &replacement, dry_run)
            .await
            .map_err(|e| crate::error::OrchflowError::SearchError {
                operation: "replace_in_files".to_string(),
                reason: e.to_string(),
            })
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "project_search".to_string(),
            reason: "Project search not initialized".to_string(),
        })
    }
}

/// Get search history
#[tauri::command]
pub async fn get_search_history(
    manager: State<'_, Manager>,
    limit: Option<usize>,
) -> Result<Vec<String>> {
    if let Some(project_search) = &manager.project_search {
        Ok(project_search.get_history(limit.unwrap_or(50)).await)
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "project_search".to_string(),
            reason: "Project search not initialized".to_string(),
        })
    }
}

/// Save a search
#[tauri::command]
pub async fn save_search(
    manager: State<'_, Manager>,
    name: String,
    options: SearchOptions,
) -> Result<()> {
    if let Some(project_search) = &manager.project_search {
        project_search.save_search(name, options).await;
        Ok(())
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "project_search".to_string(),
            reason: "Project search not initialized".to_string(),
        })
    }
}

/// Load a saved search
#[tauri::command]
pub async fn load_saved_search(
    manager: State<'_, Manager>,
    name: String,
) -> Result<Option<SearchOptions>> {
    if let Some(project_search) = &manager.project_search {
        Ok(project_search.load_search(&name).await)
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "project_search".to_string(),
            reason: "Project search not initialized".to_string(),
        })
    }
}

/// Get list of saved searches
#[tauri::command]
pub async fn get_saved_searches(manager: State<'_, Manager>) -> Result<Vec<SavedSearch>> {
    if let Some(project_search) = &manager.project_search {
        let saved_searches = project_search.get_saved_searches().await;
        let result = saved_searches
            .into_iter()
            .map(|(name, options)| SavedSearch { name, options })
            .collect();
        Ok(result)
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "project_search".to_string(),
            reason: "Project search not initialized".to_string(),
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SavedSearch {
    pub name: String,
    pub options: SearchOptions,
}

/// Clear search cache
#[tauri::command]
pub async fn clear_search_cache(manager: State<'_, Manager>) -> Result<()> {
    if let Some(project_search) = &manager.project_search {
        project_search.clear_cache().await;
        Ok(())
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "project_search".to_string(),
            reason: "Project search not initialized".to_string(),
        })
    }
}

/// Advanced search with syntax highlighting
#[derive(Debug, Serialize, Deserialize)]
pub struct HighlightedMatch {
    pub line_number: u64,
    pub line_html: String,
    pub context_before_html: Vec<String>,
    pub context_after_html: Vec<String>,
}

/// Get highlighted search results
#[tauri::command]
pub async fn search_with_highlights(
    manager: State<'_, Manager>,
    options: SearchOptions,
) -> Result<Vec<HighlightedSearchResult>> {
    if let Some(project_search) = &manager.project_search {
        let results = project_search.search(options.clone()).await.map_err(|e| {
            crate::error::OrchflowError::SearchError {
                operation: "search_with_highlights".to_string(),
                reason: e.to_string(),
            }
        })?;

        let highlighted_results = results
            .into_iter()
            .map(|file_result| {
                let language = detect_language_from_path(&file_result.path);
                let highlighted_matches = file_result
                    .matches
                    .into_iter()
                    .map(|search_match| {
                        let line_html =
                            highlight_line(&search_match.line_text, &options.pattern, &language);
                        let context_before_html = search_match
                            .context_before
                            .iter()
                            .map(|line| highlight_line(line, "", &language))
                            .collect();
                        let context_after_html = search_match
                            .context_after
                            .iter()
                            .map(|line| highlight_line(line, "", &language))
                            .collect();

                        HighlightedMatch {
                            line_number: search_match.line_number,
                            line_html,
                            context_before_html,
                            context_after_html,
                        }
                    })
                    .collect();

                HighlightedSearchResult {
                    path: file_result.path.to_string_lossy().to_string(),
                    language,
                    matches: highlighted_matches,
                }
            })
            .collect();

        Ok(highlighted_results)
    } else {
        Err(crate::error::OrchflowError::ConfigurationError {
            component: "project_search".to_string(),
            reason: "Project search not initialized".to_string(),
        })
    }
}

/// Detect language from file extension
fn detect_language_from_path(path: &std::path::Path) -> String {
    match path.extension().and_then(|ext| ext.to_str()) {
        Some("rs") => "rust".to_string(),
        Some("js") | Some("mjs") => "javascript".to_string(),
        Some("ts") => "typescript".to_string(),
        Some("py") => "python".to_string(),
        Some("java") => "java".to_string(),
        Some("cpp") | Some("cc") | Some("cxx") => "cpp".to_string(),
        Some("c") => "c".to_string(),
        Some("go") => "go".to_string(),
        Some("rb") => "ruby".to_string(),
        Some("php") => "php".to_string(),
        Some("sh") | Some("bash") => "bash".to_string(),
        Some("html") => "html".to_string(),
        Some("css") => "css".to_string(),
        Some("json") => "json".to_string(),
        Some("xml") => "xml".to_string(),
        Some("yaml") | Some("yml") => "yaml".to_string(),
        Some("toml") => "toml".to_string(),
        Some("md") => "markdown".to_string(),
        _ => "text".to_string(),
    }
}

/// Apply basic syntax highlighting to a line
fn highlight_line(line: &str, search_pattern: &str, language: &str) -> String {
    let mut highlighted = html_escape(line);

    // Highlight the search pattern if provided
    if !search_pattern.is_empty() {
        let pattern_escaped = html_escape(search_pattern);
        highlighted = highlighted.replace(
            &pattern_escaped,
            &format!(
                "<mark class=\"search-highlight\">{}</mark>",
                pattern_escaped
            ),
        );
    }

    // Apply basic language-specific highlighting
    highlighted = match language {
        "rust" => highlight_rust(&highlighted),
        "javascript" | "typescript" => highlight_javascript(&highlighted),
        "python" => highlight_python(&highlighted),
        "json" => highlight_json(&highlighted),
        _ => highlighted,
    };

    highlighted
}

/// HTML escape special characters
fn html_escape(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#x27;")
}

/// Basic Rust syntax highlighting
fn highlight_rust(line: &str) -> String {
    let keywords = [
        "fn", "let", "mut", "const", "static", "impl", "trait", "struct", "enum", "mod", "use",
        "pub", "crate", "super", "self", "Self", "where", "for", "while", "loop", "if", "else",
        "match", "return", "break", "continue", "async", "await", "move", "ref", "in", "as", "dyn",
        "unsafe",
    ];

    let mut result = line.to_string();
    for keyword in &keywords {
        let _pattern = format!(r"\b{}\b", keyword);
        result = result.replace(
            keyword,
            &format!("<span class=\"keyword\">{}</span>", keyword),
        );
    }

    result
}

/// Basic JavaScript/TypeScript syntax highlighting
fn highlight_javascript(line: &str) -> String {
    let keywords = [
        "function",
        "const",
        "let",
        "var",
        "class",
        "extends",
        "implements",
        "interface",
        "type",
        "enum",
        "namespace",
        "module",
        "import",
        "export",
        "default",
        "from",
        "as",
        "if",
        "else",
        "for",
        "while",
        "do",
        "switch",
        "case",
        "break",
        "continue",
        "return",
        "try",
        "catch",
        "finally",
        "throw",
        "new",
        "this",
        "super",
        "async",
        "await",
        "yield",
    ];

    let mut result = line.to_string();
    for keyword in &keywords {
        result = result.replace(
            keyword,
            &format!("<span class=\"keyword\">{}</span>", keyword),
        );
    }

    result
}

/// Basic Python syntax highlighting
fn highlight_python(line: &str) -> String {
    let keywords = [
        "def", "class", "import", "from", "as", "if", "elif", "else", "for", "while", "try",
        "except", "finally", "with", "yield", "return", "break", "continue", "pass", "raise",
        "assert", "global", "nonlocal", "lambda", "async", "await", "and", "or", "not", "in", "is",
        "True", "False", "None",
    ];

    let mut result = line.to_string();
    for keyword in &keywords {
        result = result.replace(
            keyword,
            &format!("<span class=\"keyword\">{}</span>", keyword),
        );
    }

    result
}

/// Basic JSON syntax highlighting
fn highlight_json(line: &str) -> String {
    let mut result = line.to_string();

    // Highlight strings
    result = regex::Regex::new(r#""([^"\\]|\\.)*""#)
        .unwrap()
        .replace_all(&result, "<span class=\"string\">$0</span>")
        .to_string();

    // Highlight numbers
    result = regex::Regex::new(r"-?\d+(\.\d+)?([eE][+-]?\d+)?")
        .unwrap()
        .replace_all(&result, "<span class=\"number\">$0</span>")
        .to_string();

    // Highlight booleans and null
    for literal in &["true", "false", "null"] {
        result = result.replace(
            literal,
            &format!("<span class=\"literal\">{}</span>", literal),
        );
    }

    result
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HighlightedSearchResult {
    pub path: String,
    pub language: String,
    pub matches: Vec<HighlightedMatch>,
}
