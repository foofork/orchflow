// Search pattern matching utilities

use super::types::SearchOptions;
use grep::regex::RegexMatcher;
use regex::{Regex, RegexBuilder};

pub struct MatcherBuilder;

impl MatcherBuilder {
    /// Create a regex matcher from query and options
    pub fn build_regex_matcher(
        query: &str,
        options: &SearchOptions,
    ) -> Result<RegexMatcher, String> {
        let mut pattern = query.to_string();

        // Apply whole word matching
        if options.whole_word && !options.use_regex {
            pattern = format!(r"\b{}\b", regex::escape(&pattern));
        }

        // Create regex with appropriate flags
        let _regex = RegexBuilder::new(&pattern)
            .case_insensitive(!options.case_sensitive)
            .multi_line(true)
            .build()
            .map_err(|e| format!("Invalid regex pattern: {}", e))?;

        RegexMatcher::new(&pattern).map_err(|e| format!("Failed to create matcher: {}", e))
    }

    /// Create a simple regex for validation
    pub fn build_simple_regex(query: &str, options: &SearchOptions) -> Result<Regex, String> {
        let mut pattern = query.to_string();

        if options.whole_word && !options.use_regex {
            pattern = format!(r"\b{}\b", regex::escape(&pattern));
        }

        RegexBuilder::new(&pattern)
            .case_insensitive(!options.case_sensitive)
            .build()
            .map_err(|e| format!("Invalid regex pattern: {}", e))
    }

    /// Check if a file path should be included in search
    pub fn should_include_file(file_path: &str, options: &SearchOptions) -> bool {
        // Check include patterns (if any)
        if !options.include_patterns.is_empty() {
            let included = options
                .include_patterns
                .iter()
                .any(|pattern| Self::matches_glob_pattern(file_path, pattern));
            if !included {
                return false;
            }
        }

        // Check exclude patterns
        let excluded = options
            .exclude_patterns
            .iter()
            .any(|pattern| Self::matches_glob_pattern(file_path, pattern));

        !excluded
    }

    /// Simple glob pattern matching
    fn matches_glob_pattern(file_path: &str, pattern: &str) -> bool {
        // Convert glob pattern to regex
        let regex_pattern = pattern
            .replace(".", r"\.")
            .replace("*", ".*")
            .replace("?", ".");

        if let Ok(regex) = Regex::new(&format!("^{}$", regex_pattern)) {
            regex.is_match(file_path)
        } else {
            // Fallback to simple string matching
            file_path.contains(pattern)
        }
    }

    /// Extract match positions from a line of text
    pub fn find_match_positions(text: &str, regex: &Regex) -> Vec<(usize, usize)> {
        regex
            .find_iter(text)
            .map(|m| (m.start(), m.end()))
            .collect()
    }

    /// Extract the matched text from a line
    pub fn extract_match_text(text: &str, start: usize, end: usize) -> String {
        if start < text.len() && end <= text.len() && start <= end {
            text[start..end].to_string()
        } else {
            String::new()
        }
    }
}
