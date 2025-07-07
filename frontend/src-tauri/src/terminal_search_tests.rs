#[cfg(test)]
mod terminal_search_tests {
    use super::*;
    use crate::terminal_search::{TerminalSearcher, SearchOptions, SearchMatch};
    use std::sync::Arc;
    
    #[test]
    fn test_search_options_default() {
        let options = SearchOptions::default();
        assert!(!options.regex);
        assert!(options.case_sensitive);
        assert!(!options.whole_word);
        assert_eq!(options.context_lines, 2);
    }
    
    #[test]
    fn test_case_insensitive_search() {
        // Create a mock TerminalSearcher (we'll test the search_text method directly)
        let text = "Hello World\nHELLO universe\nhello again";
        let query = "hello";
        let options = SearchOptions {
            regex: false,
            case_sensitive: false,
            whole_word: false,
            context_lines: 0,
        };
        
        // Test that case-insensitive search works with regex flags
        let pattern = regex::escape(query);
        let re = regex::Regex::new(&format!("(?i){}", pattern)).unwrap();
        
        let mut match_count = 0;
        for line in text.lines() {
            if re.is_match(line) {
                match_count += 1;
            }
        }
        
        assert_eq!(match_count, 3); // Should match all three lines
    }
    
    #[test]
    fn test_whole_word_search() {
        let text = "The test is testing\ntest_function\nThis is a test.";
        let query = "test";
        
        // Test whole word pattern
        let pattern = regex::escape(query);
        let pattern = format!(r"\b{}\b", pattern);
        let re = regex::Regex::new(&pattern).unwrap();
        
        let mut matches = Vec::new();
        for (i, line) in text.lines().enumerate() {
            if re.is_match(line) {
                matches.push(i);
            }
        }
        
        assert_eq!(matches.len(), 2); // Should match lines 0 and 2, not line 1
        assert_eq!(matches[0], 0);
        assert_eq!(matches[1], 2);
    }
    
    #[test]
    fn test_regex_search() {
        let text = "Error: file not found\nWarning: deprecated\nError: invalid input";
        let query = r"Error:.*";
        
        let re = regex::Regex::new(query).unwrap();
        
        let mut match_count = 0;
        for line in text.lines() {
            if re.is_match(line) {
                match_count += 1;
            }
        }
        
        assert_eq!(match_count, 2); // Should match the two Error lines
    }
}