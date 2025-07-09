# Search Integration Architecture in orchflow

## Overview

orchflow's search system provides fast, powerful search capabilities across projects using ripgrep at its core. It supports project-wide search, terminal output search, and advanced features like search-and-replace with real-time streaming results.

## Core Components

### Backend Components
- **SearchPlugin**: Main plugin coordinating search operations
- **RipgrepWrapper**: Safe Rust wrapper around ripgrep
- **SearchCache**: Results caching and deduplication
- **FileWalker**: Intelligent file traversal with gitignore support

### Frontend Components
- **SearchReplace.svelte**: Main search UI component
- **SearchResults**: Results display with syntax highlighting
- **SearchHistory**: Recent searches and saved patterns

## Architecture Diagram

```
┌─────────────────────────────────────────────┐
│           Frontend (Svelte)                  │
│                                             │
│  ┌─────────────┐    ┌──────────────────┐   │
│  │ SearchInput │    │ SearchResults    │   │
│  └──────┬──────┘    └────────▲─────────┘   │
│         │ query              │ results      │
│  ┌──────▼────────────────────┴──────────┐  │
│  │        SearchReplace Component       │  │
│  └──────┬────────────────────▲──────────┘  │
└─────────┼────────────────────┼──────────────┘
          │ invoke()           │ events
┌─────────┼────────────────────┼──────────────┐
│  ┌──────▼────────────────────┴──────────┐  │
│  │         Search Commands              │  │
│  └──────┬────────────────────┬──────────┘  │
│         │                    │              │
│  ┌──────▼──────┐      ┌─────▼───────┐     │
│  │SearchPlugin │      │TermSearch   │     │
│  └──────┬──────┘      └─────┬───────┘     │
│         │                    │              │
│  ┌──────▼────────────────────▼──────────┐  │
│  │         Ripgrep Engine              │  │
│  │  • Pattern matching                 │  │
│  │  • File filtering                   │  │
│  │  • Binary detection                 │  │
│  └──────┬────────────────────┬──────────┘  │
│         │                    │              │
│  ┌──────▼──────┐      ┌─────▼───────┐     │
│  │ File System │      │Terminal Bufs│     │
│  └─────────────┘      └─────────────┘     │
│            Backend (Rust)                   │
└─────────────────────────────────────────────┘
```

## Search Flow

### Project Search Pipeline

1. **Query Processing**
   - Parse search query and options
   - Build ripgrep arguments
   - Apply include/exclude patterns

2. **File Discovery**
   - Walk directory tree
   - Respect .gitignore rules
   - Filter by file patterns

3. **Content Matching**
   - Execute ripgrep search
   - Stream results as found
   - Handle binary files

4. **Result Processing**
   - Parse ripgrep output
   - Extract context lines
   - Add syntax highlighting hints

## Core Implementation

### Search Request Structure

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct SearchRequest {
    pub query: String,
    pub search_type: SearchType,
    pub options: SearchOptions,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchOptions {
    pub case_sensitive: bool,
    pub whole_word: bool,
    pub regex: bool,
    pub include_patterns: Vec<String>,
    pub exclude_patterns: Vec<String>,
    pub max_results: Option<usize>,
    pub context_lines: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum SearchType {
    Project { path: String },
    Terminal { terminal_ids: Vec<String> },
    OpenFiles { file_paths: Vec<String> },
}
```

### Ripgrep Integration

```rust
impl RipgrepWrapper {
    pub async fn search(&self, request: SearchRequest) -> Result<SearchStream> {
        let mut cmd = Command::new("rg");
        
        // Build command arguments
        self.apply_search_options(&mut cmd, &request.options);
        
        // Set search pattern
        if request.options.regex {
            cmd.arg("--regexp").arg(&request.query);
        } else {
            cmd.arg("--fixed-strings").arg(&request.query);
        }
        
        // Add paths
        match request.search_type {
            SearchType::Project { path } => cmd.arg(path),
            _ => return Err(Error::UnsupportedSearchType),
        };
        
        // Execute and stream results
        let output = cmd.stdout(Stdio::piped()).spawn()?;
        Ok(SearchStream::new(output))
    }
    
    fn apply_search_options(&self, cmd: &mut Command, options: &SearchOptions) {
        // Case sensitivity
        if options.case_sensitive {
            cmd.arg("--case-sensitive");
        } else {
            cmd.arg("--ignore-case");
        }
        
        // Word boundaries
        if options.whole_word {
            cmd.arg("--word-regexp");
        }
        
        // Context lines
        cmd.arg("--context").arg(options.context_lines.to_string());
        
        // Include patterns
        for pattern in &options.include_patterns {
            cmd.arg("--glob").arg(pattern);
        }
        
        // Exclude patterns
        for pattern in &options.exclude_patterns {
            cmd.arg("--glob").arg(format!("!{}", pattern));
        }
        
        // Output format
        cmd.arg("--json");
    }
}
```

## Result Streaming

### Streaming Architecture

```rust
pub struct SearchStream {
    reader: BufReader<ChildStdout>,
    buffer: String,
}

impl SearchStream {
    pub async fn next_result(&mut self) -> Option<SearchResult> {
        self.buffer.clear();
        
        match self.reader.read_line(&mut self.buffer) {
            Ok(0) => None, // EOF
            Ok(_) => {
                // Parse JSON line from ripgrep
                match serde_json::from_str::<RipgrepMessage>(&self.buffer) {
                    Ok(msg) => self.process_message(msg),
                    Err(_) => self.next_result().await, // Skip invalid lines
                }
            }
            Err(_) => None,
        }
    }
    
    fn process_message(&self, msg: RipgrepMessage) -> Option<SearchResult> {
        match msg {
            RipgrepMessage::Match(m) => Some(SearchResult {
                file_path: m.path.text,
                line_number: m.line_number,
                line_text: m.lines.text,
                match_ranges: m.submatches.into_iter()
                    .map(|s| (s.start, s.end))
                    .collect(),
                context: self.extract_context(&m),
            }),
            _ => None,
        }
    }
}
```

### Frontend Result Handling

```typescript
// Listen for streaming results
const searchId = await invoke('search_project', {
    query: searchQuery,
    options: searchOptions
});

const unsubscribe = await listen<SearchResultEvent>(`search:result:${searchId}`, (event) => {
    const result = event.payload;
    
    // Add to results array
    searchResults.update(results => [...results, result]);
    
    // Update UI with syntax highlighting
    highlightResult(result);
});

// Handle completion
await listen<SearchCompleteEvent>(`search:complete:${searchId}`, () => {
    searching = false;
    unsubscribe();
});
```

## Search and Replace

### Replace Implementation

```rust
impl SearchPlugin {
    pub async fn replace_in_files(
        &self,
        search_query: String,
        replace_with: String,
        files: Vec<String>,
        options: SearchOptions,
    ) -> Result<Vec<FileChange>> {
        let mut changes = Vec::new();
        
        for file_path in files {
            // Search in file
            let matches = self.search_in_file(&file_path, &search_query, &options).await?;
            
            if !matches.is_empty() {
                // Read file content
                let content = fs::read_to_string(&file_path).await?;
                let mut new_content = content.clone();
                
                // Apply replacements (reverse order to maintain positions)
                for m in matches.iter().rev() {
                    let start = m.byte_offset;
                    let end = start + m.match_length;
                    new_content.replace_range(start..end, &replace_with);
                }
                
                changes.push(FileChange {
                    path: file_path,
                    original: content,
                    modified: new_content,
                    match_count: matches.len(),
                });
            }
        }
        
        Ok(changes)
    }
}
```

## Terminal Search

### Terminal Output Search

```rust
impl TerminalSearcher {
    pub async fn search_terminal_output(
        &self,
        terminal_id: &str,
        query: &str,
        options: SearchOptions,
    ) -> Result<Vec<TerminalMatch>> {
        // Get terminal buffer
        let buffer = self.terminal_manager
            .get_terminal_buffer(terminal_id)
            .await?;
        
        // Convert to searchable format
        let lines: Vec<String> = buffer.lines()
            .map(|line| line.to_string())
            .collect();
        
        // Search using regex
        let pattern = self.build_pattern(query, &options)?;
        let mut matches = Vec::new();
        
        for (line_idx, line) in lines.iter().enumerate() {
            if let Some(captures) = pattern.captures(line) {
                matches.push(TerminalMatch {
                    terminal_id: terminal_id.to_string(),
                    line_number: line_idx,
                    line_text: line.clone(),
                    match_ranges: captures.iter()
                        .skip(1)
                        .filter_map(|m| m.map(|m| (m.start(), m.end())))
                        .collect(),
                });
            }
        }
        
        Ok(matches)
    }
}
```

## Performance Optimizations

### Caching Strategy

```rust
pub struct SearchCache {
    results: LruCache<SearchCacheKey, Vec<SearchResult>>,
    ttl: Duration,
}

impl SearchCache {
    pub fn get(&mut self, key: &SearchCacheKey) -> Option<&Vec<SearchResult>> {
        if let Some((results, timestamp)) = self.results.get(key) {
            if timestamp.elapsed() < self.ttl {
                return Some(results);
            }
        }
        None
    }
}
```

### Parallel Search

For searching multiple directories or terminals:
```rust
pub async fn parallel_search(
    paths: Vec<PathBuf>,
    query: String,
    options: SearchOptions,
) -> Result<Vec<SearchResult>> {
    let futures: Vec<_> = paths.into_iter()
        .map(|path| {
            let q = query.clone();
            let opts = options.clone();
            tokio::spawn(async move {
                search_in_path(path, q, opts).await
            })
        })
        .collect();
    
    let results = futures::future::join_all(futures).await;
    
    // Flatten results
    Ok(results.into_iter()
        .filter_map(|r| r.ok())
        .flatten()
        .collect())
}
```

## Advanced Features

### Syntax-Aware Search

Integration with tree-sitter for language-aware search:
```rust
pub struct SyntaxSearcher {
    parser: Parser,
    language: Language,
}

impl SyntaxSearcher {
    pub fn search_symbols(&self, query: &str) -> Result<Vec<Symbol>> {
        // Parse file with tree-sitter
        // Search for specific node types (functions, classes, etc.)
        // Return structured results
    }
}
```

### Search History

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct SearchHistoryEntry {
    pub query: String,
    pub options: SearchOptions,
    pub timestamp: DateTime<Utc>,
    pub result_count: usize,
    pub search_duration: Duration,
}

impl SearchHistory {
    pub fn add_entry(&mut self, entry: SearchHistoryEntry) {
        self.entries.push(entry);
        // Keep only last N entries
        if self.entries.len() > self.max_entries {
            self.entries.remove(0);
        }
        self.save().ok();
    }
}
```

## Integration Points

### File Watcher Integration

Re-run searches when files change:
```rust
watcher.on_change(move |path| {
    if active_search.matches_path(&path) {
        // Re-run search for this file
        let results = search_file(&path, &active_search.query).await?;
        // Emit update event
        event_bus.emit(SearchUpdateEvent { path, results }).await;
    }
});
```

## Best Practices

1. **Stream results** - Don't wait for complete search
2. **Respect gitignore** - Unless explicitly requested
3. **Handle binary files** - Skip or warn user
4. **Limit results** - Prevent UI overload
5. **Cache wisely** - Balance memory vs speed
6. **Sanitize regex** - Prevent catastrophic backtracking

## Future Enhancements

- Fuzzy search support
- Search indexing for instant results
- Search query builder UI
- Cross-terminal search
- Search result previews with syntax highlighting
- Saved search queries and filters
- Integration with LSP for semantic search

The search integration provides powerful, fast search capabilities while maintaining responsiveness through streaming and intelligent caching.