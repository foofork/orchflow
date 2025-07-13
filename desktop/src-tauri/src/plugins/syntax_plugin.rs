use crate::manager::{Event, Plugin, PluginContext, PluginMetadata};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use tree_sitter::{Language, Node, Parser};
use tree_sitter_highlight::{HighlightConfiguration, Highlighter};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ThemeColors {
    keyword: String,
    function: String,
    string: String,
    number: String,
    comment: String,
    variable: String,
    type_name: String,
    operator: String,
    punctuation: String,
    constant: String,
}

impl Default for ThemeColors {
    fn default() -> Self {
        // VS Code Dark+ theme colors
        Self {
            keyword: "#569cd6".to_string(),     // Blue
            function: "#dcdcaa".to_string(),    // Yellow
            string: "#ce9178".to_string(),      // Orange
            number: "#b5cea8".to_string(),      // Light green
            comment: "#6a9955".to_string(),     // Green
            variable: "#9cdcfe".to_string(),    // Light blue
            type_name: "#4ec9b0".to_string(),   // Teal
            operator: "#d4d4d4".to_string(),    // Light gray
            punctuation: "#d4d4d4".to_string(), // Light gray
            constant: "#4fc1ff".to_string(),    // Bright blue
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct HighlightRange {
    start_line: usize,
    start_col: usize,
    end_line: usize,
    end_col: usize,
    scope: String,
    color: String,
}

/// Syntax Plugin - Tree-sitter based syntax highlighting
pub struct SyntaxPlugin {
    context: Option<PluginContext>,
    parsers: HashMap<String, Parser>,
    languages: HashMap<String, Language>,
    highlight_configs: HashMap<String, HighlightConfiguration>,
    theme: ThemeColors,
    highlighter: Highlighter,
}

impl SyntaxPlugin {
    pub fn new() -> Self {
        let mut languages = HashMap::new();
        let mut highlight_configs = HashMap::new();

        // Register languages - use the LANGUAGE constants
        {
            languages.insert("rust".to_string(), tree_sitter_rust::LANGUAGE.into());
            languages.insert(
                "typescript".to_string(),
                tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into(),
            );
            languages.insert("tsx".to_string(), tree_sitter_typescript::LANGUAGE_TSX.into());
            languages.insert("javascript".to_string(), tree_sitter_javascript::LANGUAGE.into());
            languages.insert("python".to_string(), tree_sitter_python::LANGUAGE.into());
            languages.insert("go".to_string(), tree_sitter_go::LANGUAGE.into());
            languages.insert("json".to_string(), tree_sitter_json::LANGUAGE.into());
        }

        // Additional languages (these would need their respective tree-sitter crates)
        // Note: These are commented out as they require additional dependencies
        // languages.insert("cpp".to_string(), tree_sitter_cpp::language());
        // languages.insert("c".to_string(), tree_sitter_c::language());
        // languages.insert("java".to_string(), tree_sitter_java::language());
        // languages.insert("csharp".to_string(), tree_sitter_c_sharp::language());
        // languages.insert("php".to_string(), tree_sitter_php::language());
        // languages.insert("ruby".to_string(), tree_sitter_ruby::language());
        // languages.insert("swift".to_string(), tree_sitter_swift::language());
        // languages.insert("kotlin".to_string(), tree_sitter_kotlin::language());
        // languages.insert("scala".to_string(), tree_sitter_scala::language());
        // languages.insert("haskell".to_string(), tree_sitter_haskell::language());
        // languages.insert("lua".to_string(), tree_sitter_lua::language());
        // languages.insert("bash".to_string(), tree_sitter_bash::language());
        // languages.insert("sql".to_string(), tree_sitter_sql::language());
        // languages.insert("yaml".to_string(), tree_sitter_yaml::language());
        // languages.insert("toml".to_string(), tree_sitter_toml::language());
        // languages.insert("html".to_string(), tree_sitter_html::language());
        // languages.insert("css".to_string(), tree_sitter_css::language());
        // languages.insert("markdown".to_string(), tree_sitter_md::language());
        // languages.insert("vue".to_string(), tree_sitter_vue::language());
        // languages.insert("svelte".to_string(), tree_sitter_svelte::language());

        // Load highlight queries for each language
        let highlight_names = vec![
            "attribute",
            "constant",
            "function.builtin",
            "function",
            "keyword",
            "operator",
            "property",
            "punctuation",
            "punctuation.bracket",
            "punctuation.delimiter",
            "string",
            "string.special",
            "tag",
            "type",
            "type.builtin",
            "variable",
            "variable.builtin",
            "variable.parameter",
            "comment",
            "number",
        ];

        // Rust highlighting configuration
        if let Ok(rust_config) = HighlightConfiguration::new(
            tree_sitter_rust::LANGUAGE.into(),
            tree_sitter_rust::HIGHLIGHTS_QUERY,
            "", // injections query - empty for now
            "", // locals query - empty for now
            "", // 5th parameter - empty highlights query for now
        ) {
            let mut config = rust_config;
            config.configure(&highlight_names);
            highlight_configs.insert("rust".to_string(), config);
        }

        // Add other language configurations similarly
        // (In real implementation, would load all language queries)

        Self {
            context: None,
            parsers: HashMap::new(),
            languages,
            highlight_configs,
            theme: ThemeColors::default(),
            highlighter: Highlighter::new(),
        }
    }

    /// Get language for file extension
    fn get_language_for_file(&self, file_path: &str) -> Option<String> {
        let extension = std::path::Path::new(file_path).extension()?.to_str()?;

        match extension {
            "rs" => Some("rust".to_string()),
            "ts" => Some("typescript".to_string()),
            "tsx" => Some("tsx".to_string()),
            "js" | "jsx" | "mjs" | "cjs" => Some("javascript".to_string()),
            "py" | "pyw" => Some("python".to_string()),
            "go" => Some("go".to_string()),
            "json" | "jsonc" => Some("json".to_string()),

            // Additional language mappings (when tree-sitter crates are added)
            "cpp" | "cc" | "cxx" | "c++" | "hpp" | "hxx" | "h++" => Some("cpp".to_string()),
            "c" | "h" => Some("c".to_string()),
            "java" => Some("java".to_string()),
            "cs" => Some("csharp".to_string()),
            "php" => Some("php".to_string()),
            "rb" => Some("ruby".to_string()),
            "swift" => Some("swift".to_string()),
            "kt" | "kts" => Some("kotlin".to_string()),
            "scala" | "sc" => Some("scala".to_string()),
            "hs" | "lhs" => Some("haskell".to_string()),
            "lua" => Some("lua".to_string()),
            "sh" | "bash" | "zsh" => Some("bash".to_string()),
            "sql" => Some("sql".to_string()),
            "yaml" | "yml" => Some("yaml".to_string()),
            "toml" => Some("toml".to_string()),
            "html" | "htm" => Some("html".to_string()),
            "css" | "scss" | "sass" | "less" => Some("css".to_string()),
            "md" | "markdown" => Some("markdown".to_string()),
            "vue" => Some("vue".to_string()),
            "svelte" => Some("svelte".to_string()),

            _ => None,
        }
    }

    /// Parse and highlight code
    fn highlight_code(
        &mut self,
        language: &str,
        code: &str,
    ) -> Result<Vec<HighlightRange>, String> {
        let lang = self
            .languages
            .get(language)
            .ok_or_else(|| format!("Language not supported: {}", language))?;

        // Get or create parser for language
        let parser = self.parsers.entry(language.to_string()).or_insert_with(|| {
            let mut parser = Parser::new();
            parser.set_language(lang).unwrap();
            parser
        });

        let tree = parser.parse(code, None).ok_or("Failed to parse code")?;

        let mut highlights = Vec::new();

        // Simple highlighting based on node types
        // (In real implementation, would use highlight configurations)
        let cursor = tree.walk();
        self.visit_node(cursor.node(), code, &mut highlights);

        Ok(highlights)
    }

    /// Visit tree nodes and collect highlights
    fn visit_node(&self, node: Node, source: &str, highlights: &mut Vec<HighlightRange>) {
        let node_kind = node.kind();

        // Map node kinds to highlight scopes and colors
        let (scope, color) = match node_kind {
            // Keywords (common across languages)
            "let" | "mut" | "const" | "fn" | "impl" | "trait" | "struct" | "enum" | 
            "pub" | "mod" | "use" | "async" | "await" | "return" | "if" | "else" |
            "match" | "for" | "while" | "loop" | "break" | "continue" |
            // Additional keywords for other languages
            "def" | "class" | "import" | "from" | "as" | "try" | "except" | "finally" |
            "raise" | "with" | "lambda" | "yield" | "pass" | "del" | "global" | "nonlocal" |
            "var" | "function" | "switch" | "case" | "default" | "throw" | "catch" |
            "new" | "delete" | "typeof" | "instanceof" | "void" | "null" | "undefined" |
            "public" | "private" | "protected" | "static" | "final" | "abstract" |
            "interface" | "extends" | "implements" | "package" | "namespace" |
            "goto" | "do" | "in" | "is" | "this" | "super" | "self" => 
                ("keyword", &self.theme.keyword),
            
            "string_literal" | "raw_string_literal" | "char_literal" => 
                ("string", &self.theme.string),
            
            "integer_literal" | "float_literal" => 
                ("number", &self.theme.number),
            
            "line_comment" | "block_comment" => 
                ("comment", &self.theme.comment),
            
            "identifier" if node.parent().map(|p| p.kind() == "function_item").unwrap_or(false) =>
                ("function", &self.theme.function),
            
            "type_identifier" | "primitive_type" => 
                ("type", &self.theme.type_name),
            
            "+" | "-" | "*" | "/" | "=" | "==" | "!=" | "<" | ">" | "<=" | ">=" |
            "&&" | "||" | "!" | "&" | "|" | "^" | "<<" | ">>" | "+=" | "-=" =>
                ("operator", &self.theme.operator),
            
            "(" | ")" | "[" | "]" | "{" | "}" | "," | ";" | ":" | "::" | "." | "->" =>
                ("punctuation", &self.theme.punctuation),
            
            _ => {
                // Recursively visit children
                for child in node.children(&mut node.walk()) {
                    self.visit_node(child, source, highlights);
                }
                return;
            }
        };

        let start = node.start_position();
        let end = node.end_position();

        highlights.push(HighlightRange {
            start_line: start.row,
            start_col: start.column,
            end_line: end.row,
            end_col: end.column,
            scope: scope.to_string(),
            color: color.to_string(),
        });

        // Still visit children for some node types
        if !matches!(
            node_kind,
            "string_literal"
                | "raw_string_literal"
                | "char_literal"
                | "integer_literal"
                | "float_literal"
                | "line_comment"
                | "block_comment"
        ) {
            for child in node.children(&mut node.walk()) {
                self.visit_node(child, source, highlights);
            }
        }
    }

    /// Get folding ranges for code blocks
    fn get_folding_ranges(&mut self, language: &str, code: &str) -> Result<Vec<Value>, String> {
        let lang = self
            .languages
            .get(language)
            .ok_or_else(|| format!("Language not supported: {}", language))?;

        // Get or create parser for language
        let parser = self.parsers.entry(language.to_string()).or_insert_with(|| {
            let mut parser = Parser::new();
            parser.set_language(lang).unwrap();
            parser
        });

        let tree = parser.parse(code, None).ok_or("Failed to parse code")?;
        let mut ranges = Vec::new();

        // Walk the tree and find foldable nodes
        let cursor = tree.walk();
        self.find_folding_ranges(cursor.node(), code, &mut ranges);

        Ok(ranges)
    }

    /// Find foldable ranges in the syntax tree
    fn find_folding_ranges(&self, node: Node, source: &str, ranges: &mut Vec<Value>) {
        let node_kind = node.kind();
        let start_pos = node.start_position();
        let end_pos = node.end_position();

        // Only consider nodes that span multiple lines
        if end_pos.row > start_pos.row {
            let is_foldable = match node_kind {
                // Block-like structures
                "block" | "compound_statement" | "statement_block" |
                // Function definitions
                "function_item" | "function_declaration" | "method_definition" |
                "impl_item" | "trait_item" | "mod_item" |
                // Control structures
                "if_expression" | "match_expression" | "for_expression" | "while_expression" | "loop_expression" |
                // Data structures
                "struct_item" | "enum_item" | "union_item" |
                // Arrays and objects
                "array_expression" | "object_expression" | "array_literal" | "object_literal" |
                // Modules and namespaces
                "module" | "namespace_declaration" |
                // Classes (for languages that have them)
                "class_declaration" | "class_definition" | "interface_declaration" |
                // Multi-line comments
                "block_comment" | "multiline_comment" |
                // Import/export blocks
                "use_list" | "use_declaration" |
                // Generic blocks that have braces
                "declaration_list" | "field_declaration_list" | "variant_list" |
                // Lambda/closure expressions
                "closure_expression" | "lambda_expression" |
                // Try/catch blocks
                "try_expression" | "catch_clause" |
                // Switch/match arms
                "match_arm_list" | "switch_statement" => true,
                
                _ => false,
            };

            if is_foldable {
                // For LSP folding ranges, we need start and end lines
                // Some editors expect the end line to be the last line with content
                let folding_range = json!({
                    "startLine": start_pos.row,
                    "startCharacter": start_pos.column,
                    "endLine": end_pos.row,
                    "endCharacter": end_pos.column,
                    "kind": self.get_folding_kind(node_kind)
                });
                
                ranges.push(folding_range);
            }
        }

        // Recursively check children
        for child in node.children(&mut node.walk()) {
            self.find_folding_ranges(child, source, ranges);
        }
    }

    /// Get the folding range kind for LSP
    fn get_folding_kind(&self, node_kind: &str) -> &'static str {
        match node_kind {
            "block_comment" | "multiline_comment" => "comment",
            "use_list" | "use_declaration" => "imports",
            _ => "region", // Default to region for code blocks
        }
    }

    /// Get semantic tokens for LSP
    fn get_semantic_tokens(&mut self, language: &str, code: &str) -> Result<Vec<Value>, String> {
        let highlights = self.highlight_code(language, code)?;

        let mut tokens = Vec::new();
        let mut prev_line = 0;
        let mut prev_col = 0;

        for highlight in highlights {
            // Delta encoding as per LSP spec
            let delta_line = highlight.start_line - prev_line;
            let delta_start = if delta_line == 0 {
                highlight.start_col - prev_col
            } else {
                highlight.start_col
            };

            let length = if highlight.start_line == highlight.end_line {
                highlight.end_col - highlight.start_col
            } else {
                // Multi-line tokens need special handling
                code.lines()
                    .nth(highlight.start_line)
                    .map(|line| line.len() - highlight.start_col)
                    .unwrap_or(0)
            };

            let token_type = match highlight.scope.as_str() {
                "keyword" => 0,
                "function" => 1,
                "string" => 2,
                "number" => 3,
                "comment" => 4,
                "variable" => 5,
                "type" => 6,
                "operator" => 7,
                "punctuation" => 8,
                _ => 9,
            };

            tokens.push(json!({
                "deltaLine": delta_line,
                "deltaStart": delta_start,
                "length": length,
                "tokenType": token_type,
                "tokenModifiers": 0
            }));

            prev_line = highlight.start_line;
            prev_col = highlight.start_col;
        }

        Ok(tokens)
    }
}

#[async_trait]
impl Plugin for SyntaxPlugin {
    fn id(&self) -> &str {
        "syntax-highlighter"
    }

    fn metadata(&self) -> PluginMetadata {
        PluginMetadata {
            name: "Syntax Highlighter".to_string(),
            version: "0.1.0".to_string(),
            author: "Orchflow Team".to_string(),
            description: "Tree-sitter based syntax highlighting".to_string(),
            capabilities: vec![
                "syntax.highlight".to_string(),
                "syntax.tokenize".to_string(),
                "syntax.parse".to_string(),
                "syntax.fold".to_string(),
                "syntax.indent".to_string(),
            ],
        }
    }

    async fn init(&mut self, context: PluginContext) -> Result<(), String> {
        context
            .subscribe(vec![
                "file_opened".to_string(),
                "file_changed".to_string(),
                "theme_changed".to_string(),
            ])
            .await?;

        self.context = Some(context);

        // Log available languages
        println!(
            "Syntax highlighter initialized with languages: {:?}",
            self.languages.keys().collect::<Vec<_>>()
        );

        Ok(())
    }

    async fn handle_event(&mut self, event: &Event) -> Result<(), String> {
        match event {
            // Handle file-related events that require syntax highlighting
            Event::FileOpened { path, pane_id } => {
                self.handle_file_opened(path, pane_id).await?;
            }
            Event::FileChanged { path } => {
                self.handle_file_changed(path).await?;
            }
            Event::FileSaved { path } => {
                self.handle_file_saved(path).await?;
            }
            // Handle other events that might affect syntax highlighting
            Event::PaneResized { pane_id, width, height } => {
                self.handle_pane_resized(pane_id, *width, *height).await?;
            }
            // Ignore events that don't affect syntax highlighting
            _ => {}
        }
        Ok(())
    }

    async fn handle_request(&mut self, method: &str, params: Value) -> Result<Value, String> {
        match method {
            "syntax.highlight" => {
                let code = params["code"].as_str().ok_or("Missing code parameter")?;

                // Get language string (either directly specified or detected from file path)
                let language_string = if let Some(lang) = params["language"].as_str() {
                    lang.to_string()
                } else if let Some(file_path) = params["file_path"].as_str() {
                    self.get_language_for_file(file_path)
                        .ok_or("Could not detect language from file path".to_string())?
                } else {
                    return Err("Missing language parameter".to_string());
                };

                let language = language_string.as_str();
                let highlights = self.highlight_code(language, code)?;
                Ok(json!({ "highlights": highlights }))
            }

            "syntax.semanticTokens" => {
                let code = params["code"].as_str().ok_or("Missing code parameter")?;

                // Get language string (either directly specified or detected from file path)
                let language_string = if let Some(lang) = params["language"].as_str() {
                    lang.to_string()
                } else if let Some(file_path) = params["file_path"].as_str() {
                    self.get_language_for_file(file_path)
                        .ok_or("Could not detect language from file path".to_string())?
                } else {
                    return Err("Missing language parameter".to_string());
                };

                let language = language_string.as_str();

                let tokens = self.get_semantic_tokens(language, code)?;
                Ok(json!({
                    "data": tokens,
                    "resultId": null
                }))
            }

            "syntax.getLanguage" => {
                let file_path = params["file_path"]
                    .as_str()
                    .ok_or("Missing file_path parameter")?;

                let language = self
                    .get_language_for_file(file_path)
                    .unwrap_or_else(|| "plaintext".to_string());

                Ok(json!({ "language": language }))
            }

            "syntax.getSupportedLanguages" => {
                let languages: Vec<_> = self.languages.keys().cloned().collect();
                Ok(json!({ "languages": languages }))
            }

            "syntax.getTheme" => Ok(serde_json::to_value(&self.theme).unwrap()),

            "syntax.setTheme" => {
                if let Ok(new_theme) = serde_json::from_value::<ThemeColors>(params) {
                    self.theme = new_theme;
                    Ok(json!({ "status": "ok" }))
                } else {
                    Err("Invalid theme format".to_string())
                }
            }

            "syntax.getFoldingRanges" => {
                let code = params["code"].as_str().ok_or("Missing code parameter")?;
                let language = params["language"]
                    .as_str()
                    .ok_or("Missing language parameter")?;

                let ranges = self.get_folding_ranges(language, code)?;
                Ok(json!({ "ranges": ranges }))
            }

            _ => Err(format!("Unknown method: {}", method)),
        }
    }

    async fn shutdown(&mut self) -> Result<(), String> {
        self.parsers.clear();
        Ok(())
    }
}

// Additional implementation for event handling helpers
impl SyntaxPlugin {
    /// Handle file opened event - set up syntax highlighting for the file
    async fn handle_file_opened(&mut self, path: &str, pane_id: &str) -> Result<(), String> {
        tracing::info!("Setting up syntax highlighting for file: {} in pane: {}", path, pane_id);
        
        // Detect language from file extension
        if let Some(language) = self.get_language_for_file(path) {
            tracing::debug!("Detected language '{}' for file: {}", language, path);
            
            // Store the file-pane association for future reference
            // This could be used to track which files are open in which panes
            // For now, we just log the association
            tracing::debug!("File '{}' opened in pane '{}' with language '{}'", path, pane_id, language);
        } else {
            tracing::debug!("No syntax highlighting available for file: {}", path);
        }
        
        Ok(())
    }

    /// Handle file changed event - refresh syntax highlighting if needed
    async fn handle_file_changed(&mut self, path: &str) -> Result<(), String> {
        tracing::debug!("File changed, may need to refresh syntax highlighting: {}", path);
        
        // For now, we just log the change
        // In a full implementation, this might trigger re-highlighting
        // if the file is currently being displayed
        
        Ok(())
    }

    /// Handle file saved event - update syntax highlighting if needed
    async fn handle_file_saved(&mut self, path: &str) -> Result<(), String> {
        tracing::debug!("File saved, updating syntax highlighting: {}", path);
        
        // For now, we just log the save
        // In a full implementation, this might trigger re-highlighting
        // to catch any syntax changes
        
        Ok(())
    }

    /// Handle pane resized event - adjust syntax highlighting display if needed
    async fn handle_pane_resized(&mut self, pane_id: &str, width: u32, height: u32) -> Result<(), String> {
        tracing::debug!("Pane '{}' resized to {}x{}, may need to adjust syntax highlighting display", pane_id, width, height);
        
        // For now, we just log the resize
        // In a full implementation, this might trigger re-rendering
        // of syntax highlighting to fit the new pane size
        
        Ok(())
    }
}
