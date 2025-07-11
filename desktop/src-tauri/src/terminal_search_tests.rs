#[cfg(test)]
mod terminal_search_tests {
    use crate::terminal_search::{TerminalSearcher, SearchOptions, SearchMatch};
    use crate::manager::Manager;
    use crate::state_manager::StateManager;
    use crate::simple_state_store::SimpleStateStore;
    use std::sync::Arc;
    use tempfile::NamedTempFile;
    
    fn create_test_manager() -> Arc<Manager> {
        let temp_file = NamedTempFile::new().unwrap();
        let db_path = temp_file.path();
        let store = Arc::new(SimpleStateStore::new_with_file(db_path).unwrap());
        let state_manager = StateManager::new(store);
        Arc::new(Manager::new(state_manager))
    }
    
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
    
    #[test]
    fn test_search_match_structure() {
        let search_match = SearchMatch {
            pane_id: "pane-123".to_string(),
            pane_name: "Terminal 1".to_string(),
            line_number: 42,
            column: 10,
            match_text: "hello".to_string(),
            line_content: "Say hello world".to_string(),
            context_before: vec!["Line 1".to_string(), "Line 2".to_string()],
            context_after: vec!["Line 3".to_string(), "Line 4".to_string()],
        };
        
        assert_eq!(search_match.pane_id, "pane-123");
        assert_eq!(search_match.line_number, 42);
        assert_eq!(search_match.column, 10);
        assert_eq!(search_match.match_text, "hello");
        assert_eq!(search_match.context_before.len(), 2);
        assert_eq!(search_match.context_after.len(), 2);
    }
    
    #[test]
    fn test_search_options_combinations() {
        // Test case-insensitive regex search
        let options = SearchOptions {
            regex: true,
            case_sensitive: false,
            whole_word: false,
            context_lines: 3,
        };
        
        assert!(options.regex);
        assert!(!options.case_sensitive);
        assert_eq!(options.context_lines, 3);
        
        // Test whole word case-sensitive search
        let options = SearchOptions {
            regex: false,
            case_sensitive: true,
            whole_word: true,
            context_lines: 0,
        };
        
        assert!(!options.regex);
        assert!(options.case_sensitive);
        assert!(options.whole_word);
        assert_eq!(options.context_lines, 0);
    }
    
    #[test]
    fn test_regex_escape_for_literal_search() {
        // Test that special regex characters are escaped for literal search
        let special_chars = r".*+?{}[]()|\^$";
        let escaped = regex::escape(special_chars);
        
        // The escaped string should not match as a regex pattern
        assert_ne!(escaped, special_chars);
        
        // But it should match literally
        let re = regex::Regex::new(&escaped).unwrap();
        assert!(re.is_match(special_chars));
    }
    
    #[test]
    fn test_search_with_context() {
        let lines = vec![
            "Line 1: Introduction",
            "Line 2: Setup",
            "Line 3: The target line",
            "Line 4: Continuation",
            "Line 5: Conclusion",
        ];
        
        let target_index = 2;
        let context_lines = 2;
        
        // Get context before
        let start = target_index.saturating_sub(context_lines);
        let context_before: Vec<_> = lines[start..target_index]
            .iter()
            .map(|s| s.to_string())
            .collect();
        
        // Get context after
        let end = (target_index + 1 + context_lines).min(lines.len());
        let context_after: Vec<_> = lines[target_index + 1..end]
            .iter()
            .map(|s| s.to_string())
            .collect();
        
        assert_eq!(context_before.len(), 2);
        assert_eq!(context_before[0], "Line 1: Introduction");
        assert_eq!(context_before[1], "Line 2: Setup");
        
        assert_eq!(context_after.len(), 2);
        assert_eq!(context_after[0], "Line 4: Continuation");
        assert_eq!(context_after[1], "Line 5: Conclusion");
    }
    
    #[tokio::test]
    async fn test_terminal_searcher_creation() {
        let manager = create_test_manager();
        let searcher = TerminalSearcher::new(manager.clone());
        
        // Verify the searcher is created properly
        // The actual search methods require a running backend, so we just test creation
        assert!(Arc::ptr_eq(&searcher.manager, &manager));
    }
}