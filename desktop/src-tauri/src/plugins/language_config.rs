use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Language configuration for syntax highlighting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageConfig {
    pub id: String,
    pub name: String,
    pub extensions: Vec<String>,
    pub aliases: Vec<String>,
    pub enabled: bool,
    pub tree_sitter_crate: String,
    pub highlight_query_path: Option<String>,
    pub injection_query_path: Option<String>,
    pub file_types: Vec<String>,
    pub root_patterns: Vec<String>,
    pub comment_tokens: CommentTokens,
    pub indent_config: IndentConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommentTokens {
    pub line_comment: Option<String>,
    pub block_comment_start: Option<String>,
    pub block_comment_end: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndentConfig {
    pub indent_size: usize,
    pub use_tabs: bool,
    pub continuation_indent: usize,
}

impl Default for IndentConfig {
    fn default() -> Self {
        Self {
            indent_size: 4,
            use_tabs: false,
            continuation_indent: 4,
        }
    }
}

/// Get default language configurations
pub fn get_default_languages() -> HashMap<String, LanguageConfig> {
    let mut languages = HashMap::new();
    
    // Rust
    languages.insert("rust".to_string(), LanguageConfig {
        id: "rust".to_string(),
        name: "Rust".to_string(),
        extensions: vec!["rs".to_string()],
        aliases: vec!["rust".to_string(), "rs".to_string()],
        enabled: true,
        tree_sitter_crate: "tree-sitter-rust".to_string(),
        highlight_query_path: None,
        injection_query_path: None,
        file_types: vec!["rust".to_string()],
        root_patterns: vec!["Cargo.toml".to_string()],
        comment_tokens: CommentTokens {
            line_comment: Some("//".to_string()),
            block_comment_start: Some("/*".to_string()),
            block_comment_end: Some("*/".to_string()),
        },
        indent_config: IndentConfig::default(),
    });
    
    // TypeScript
    languages.insert("typescript".to_string(), LanguageConfig {
        id: "typescript".to_string(),
        name: "TypeScript".to_string(),
        extensions: vec!["ts".to_string()],
        aliases: vec!["typescript".to_string(), "ts".to_string()],
        enabled: true,
        tree_sitter_crate: "tree-sitter-typescript".to_string(),
        highlight_query_path: None,
        injection_query_path: None,
        file_types: vec!["typescript".to_string()],
        root_patterns: vec!["tsconfig.json".to_string(), "package.json".to_string()],
        comment_tokens: CommentTokens {
            line_comment: Some("//".to_string()),
            block_comment_start: Some("/*".to_string()),
            block_comment_end: Some("*/".to_string()),
        },
        indent_config: IndentConfig {
            indent_size: 2,
            use_tabs: false,
            continuation_indent: 2,
        },
    });
    
    // Python
    languages.insert("python".to_string(), LanguageConfig {
        id: "python".to_string(),
        name: "Python".to_string(),
        extensions: vec!["py".to_string(), "pyw".to_string()],
        aliases: vec!["python".to_string(), "py".to_string(), "python3".to_string()],
        enabled: true,
        tree_sitter_crate: "tree-sitter-python".to_string(),
        highlight_query_path: None,
        injection_query_path: None,
        file_types: vec!["python".to_string()],
        root_patterns: vec!["setup.py".to_string(), "pyproject.toml".to_string(), "requirements.txt".to_string()],
        comment_tokens: CommentTokens {
            line_comment: Some("#".to_string()),
            block_comment_start: Some("\"\"\"".to_string()),
            block_comment_end: Some("\"\"\"".to_string()),
        },
        indent_config: IndentConfig::default(),
    });
    
    // Go
    languages.insert("go".to_string(), LanguageConfig {
        id: "go".to_string(),
        name: "Go".to_string(),
        extensions: vec!["go".to_string()],
        aliases: vec!["go".to_string(), "golang".to_string()],
        enabled: true,
        tree_sitter_crate: "tree-sitter-go".to_string(),
        highlight_query_path: None,
        injection_query_path: None,
        file_types: vec!["go".to_string()],
        root_patterns: vec!["go.mod".to_string(), "go.sum".to_string()],
        comment_tokens: CommentTokens {
            line_comment: Some("//".to_string()),
            block_comment_start: Some("/*".to_string()),
            block_comment_end: Some("*/".to_string()),
        },
        indent_config: IndentConfig {
            indent_size: 4,
            use_tabs: true,
            continuation_indent: 4,
        },
    });
    
    // C++
    languages.insert("cpp".to_string(), LanguageConfig {
        id: "cpp".to_string(),
        name: "C++".to_string(),
        extensions: vec!["cpp".to_string(), "cc".to_string(), "cxx".to_string(), "c++".to_string(), "hpp".to_string(), "hxx".to_string(), "h++".to_string()],
        aliases: vec!["cpp".to_string(), "c++".to_string()],
        enabled: false, // Disabled by default (requires tree-sitter-cpp)
        tree_sitter_crate: "tree-sitter-cpp".to_string(),
        highlight_query_path: None,
        injection_query_path: None,
        file_types: vec!["cpp".to_string()],
        root_patterns: vec!["CMakeLists.txt".to_string(), "Makefile".to_string()],
        comment_tokens: CommentTokens {
            line_comment: Some("//".to_string()),
            block_comment_start: Some("/*".to_string()),
            block_comment_end: Some("*/".to_string()),
        },
        indent_config: IndentConfig::default(),
    });
    
    // Java
    languages.insert("java".to_string(), LanguageConfig {
        id: "java".to_string(),
        name: "Java".to_string(),
        extensions: vec!["java".to_string()],
        aliases: vec!["java".to_string()],
        enabled: false,
        tree_sitter_crate: "tree-sitter-java".to_string(),
        highlight_query_path: None,
        injection_query_path: None,
        file_types: vec!["java".to_string()],
        root_patterns: vec!["pom.xml".to_string(), "build.gradle".to_string(), "build.gradle.kts".to_string()],
        comment_tokens: CommentTokens {
            line_comment: Some("//".to_string()),
            block_comment_start: Some("/*".to_string()),
            block_comment_end: Some("*/".to_string()),
        },
        indent_config: IndentConfig::default(),
    });
    
    // Ruby
    languages.insert("ruby".to_string(), LanguageConfig {
        id: "ruby".to_string(),
        name: "Ruby".to_string(),
        extensions: vec!["rb".to_string()],
        aliases: vec!["ruby".to_string(), "rb".to_string()],
        enabled: false,
        tree_sitter_crate: "tree-sitter-ruby".to_string(),
        highlight_query_path: None,
        injection_query_path: None,
        file_types: vec!["ruby".to_string()],
        root_patterns: vec!["Gemfile".to_string(), "Rakefile".to_string()],
        comment_tokens: CommentTokens {
            line_comment: Some("#".to_string()),
            block_comment_start: Some("=begin".to_string()),
            block_comment_end: Some("=end".to_string()),
        },
        indent_config: IndentConfig {
            indent_size: 2,
            use_tabs: false,
            continuation_indent: 2,
        },
    });
    
    // HTML
    languages.insert("html".to_string(), LanguageConfig {
        id: "html".to_string(),
        name: "HTML".to_string(),
        extensions: vec!["html".to_string(), "htm".to_string()],
        aliases: vec!["html".to_string()],
        enabled: false,
        tree_sitter_crate: "tree-sitter-html".to_string(),
        highlight_query_path: None,
        injection_query_path: None,
        file_types: vec!["html".to_string()],
        root_patterns: vec!["index.html".to_string()],
        comment_tokens: CommentTokens {
            line_comment: None,
            block_comment_start: Some("<!--".to_string()),
            block_comment_end: Some("-->".to_string()),
        },
        indent_config: IndentConfig {
            indent_size: 2,
            use_tabs: false,
            continuation_indent: 2,
        },
    });
    
    // Markdown
    languages.insert("markdown".to_string(), LanguageConfig {
        id: "markdown".to_string(),
        name: "Markdown".to_string(),
        extensions: vec!["md".to_string(), "markdown".to_string()],
        aliases: vec!["markdown".to_string(), "md".to_string()],
        enabled: false,
        tree_sitter_crate: "tree-sitter-md".to_string(),
        highlight_query_path: None,
        injection_query_path: None,
        file_types: vec!["markdown".to_string()],
        root_patterns: vec!["README.md".to_string()],
        comment_tokens: CommentTokens {
            line_comment: None,
            block_comment_start: Some("<!--".to_string()),
            block_comment_end: Some("-->".to_string()),
        },
        indent_config: IndentConfig::default(),
    });
    
    // Lua
    languages.insert("lua".to_string(), LanguageConfig {
        id: "lua".to_string(),
        name: "Lua".to_string(),
        extensions: vec!["lua".to_string()],
        aliases: vec!["lua".to_string()],
        enabled: false,
        tree_sitter_crate: "tree-sitter-lua".to_string(),
        highlight_query_path: None,
        injection_query_path: None,
        file_types: vec!["lua".to_string()],
        root_patterns: vec!["init.lua".to_string()],
        comment_tokens: CommentTokens {
            line_comment: Some("--".to_string()),
            block_comment_start: Some("--[[".to_string()),
            block_comment_end: Some("]]".to_string()),
        },
        indent_config: IndentConfig {
            indent_size: 2,
            use_tabs: false,
            continuation_indent: 2,
        },
    });
    
    languages
}

/// Load language configuration from a JSON file
pub fn load_language_config(path: &str) -> Result<HashMap<String, LanguageConfig>, Box<dyn std::error::Error>> {
    let content = std::fs::read_to_string(path)?;
    let configs: HashMap<String, LanguageConfig> = serde_json::from_str(&content)?;
    Ok(configs)
}

/// Save language configuration to a JSON file
pub fn save_language_config(configs: &HashMap<String, LanguageConfig>, path: &str) -> Result<(), Box<dyn std::error::Error>> {
    let content = serde_json::to_string_pretty(configs)?;
    std::fs::write(path, content)?;
    Ok(())
}