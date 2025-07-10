#[cfg(test)]
mod tests {
    use crate::command_history::{CommandHistory, CommandEntry};
    use crate::simple_state_store::SimpleStateStore;
    use std::sync::Arc;
    use tempfile::TempDir;
    use chrono::Utc;
    
    fn create_test_history() -> (CommandHistory, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let store = Arc::new(SimpleStateStore::new_with_file(temp_dir.path().join("test.db")).unwrap());
        let history = CommandHistory::new(store);
        (history, temp_dir)
    }
    
    fn create_test_entry(command: &str) -> CommandEntry {
        CommandEntry {
            id: uuid::Uuid::new_v4().to_string(),
            pane_id: "test-pane".to_string(),
            session_id: "test-session".to_string(),
            command: command.to_string(),
            timestamp: Utc::now(),
            working_dir: Some("/test/dir".to_string()),
            exit_code: Some(0),
            duration_ms: Some(100),
            shell_type: Some("bash".to_string()),
        }
    }
    
    #[tokio::test]
    async fn test_add_command() {
        let (history, _temp) = create_test_history();
        
        let entry = create_test_entry("ls -la");
        let result = history.add_command(entry.clone()).await;
        
        assert!(result.is_ok());
        
        // Verify it's in the cache
        let cache = history.memory_cache.read().await;
        assert_eq!(cache.len(), 1);
        assert_eq!(cache[0].command, "ls -la");
    }
    
    #[tokio::test]
    async fn test_command_too_long() {
        let (history, _temp) = create_test_history();
        
        let long_command = "x".repeat(5000); // Exceeds MAX_COMMAND_LENGTH
        let entry = create_test_entry(&long_command);
        let result = history.add_command(entry).await;
        
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Command too long"));
    }
    
    #[tokio::test]
    async fn test_search_commands() {
        let (history, _temp) = create_test_history();
        
        // Add multiple commands
        let commands = vec![
            "git status",
            "git add .",
            "git commit -m 'test'",
            "ls -la",
            "cd /home",
        ];
        
        for cmd in &commands {
            history.add_command(create_test_entry(cmd)).await.unwrap();
        }
        
        // Search for git commands
        let results = history.search("git", None, None, 10).await.unwrap();
        assert_eq!(results.len(), 3);
        
        // Search with pane filter
        let results = history.search("", Some("test-pane"), None, 10).await.unwrap();
        assert_eq!(results.len(), 5);
        
        // Search with limit
        let results = history.search("", None, None, 2).await.unwrap();
        assert_eq!(results.len(), 2);
    }
    
    #[tokio::test]
    async fn test_search_recent() {
        let (history, _temp) = create_test_history();
        
        // Add commands
        for i in 0..5 {
            let mut entry = create_test_entry(&format!("command {}", i));
            entry.timestamp = Utc::now() - chrono::Duration::seconds(i as i64);
            history.add_command(entry).await.unwrap();
        }
        
        // Search for recent commands
        let recent = history.search("", None, None, 3).await.unwrap();
        assert_eq!(recent.len(), 3);
        assert!(recent.iter().any(|e| e.command.starts_with("command")));
    }
    
    #[tokio::test]
    async fn test_search_by_command() {
        let (history, _temp) = create_test_history();
        
        let entry = create_test_entry("test command");
        history.add_command(entry.clone()).await.unwrap();
        
        // Search for the command
        let results = history.search("test command", None, None, 10).await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].command, "test command");
        
        // Search for non-existent command
        let results = history.search("non-existent", None, None, 10).await.unwrap();
        assert_eq!(results.len(), 0);
    }
    
    #[tokio::test]
    async fn test_add_command_with_exit_code() {
        let (history, _temp) = create_test_history();
        
        let mut entry = create_test_entry("test command");
        entry.exit_code = Some(1);
        entry.duration_ms = Some(500);
        history.add_command(entry.clone()).await.unwrap();
        
        // Verify it was added with the exit code
        let results = history.search("test command", None, None, 1).await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].exit_code, Some(1));
        assert_eq!(results[0].duration_ms, Some(500));
    }
    
    #[tokio::test]
    async fn test_get_suggestions() {
        let (history, _temp) = create_test_history();
        
        // Add commands with different frequencies
        for _ in 0..5 {
            history.add_command(create_test_entry("git status")).await.unwrap();
        }
        for _ in 0..3 {
            history.add_command(create_test_entry("git add .")).await.unwrap();
        }
        history.add_command(create_test_entry("git commit")).await.unwrap();
        
        // Get suggestions
        let suggestions = history.get_suggestions("git", None, 5).await.unwrap();
        assert!(!suggestions.is_empty());
        
        // Most frequent should be first (frecency algorithm)
        assert!(suggestions.contains(&"git status".to_string()));
    }
    
    #[tokio::test]
    async fn test_get_stats() {
        let (history, _temp) = create_test_history();
        
        // Add commands with different frequencies
        for _ in 0..5 {
            history.add_command(create_test_entry("git status")).await.unwrap();
        }
        for _ in 0..3 {
            history.add_command(create_test_entry("ls -la")).await.unwrap();
        }
        history.add_command(create_test_entry("cd /home")).await.unwrap();
        
        // Stats should update automatically with add_command
        
        // Get stats
        let stats = history.get_stats(10).await.unwrap();
        assert!(!stats.is_empty());
        
        // Check most frequent command
        let git_stats = stats.iter().find(|s| s.command == "git status");
        assert!(git_stats.is_some());
        assert_eq!(git_stats.unwrap().frequency, 5);
    }
    
    #[tokio::test]
    async fn test_cleanup_old_entries() {
        let (history, _temp) = create_test_history();
        
        // Add old commands
        for i in 0..3 {
            let mut entry = create_test_entry(&format!("old command {}", i));
            entry.timestamp = Utc::now() - chrono::Duration::days(10);
            history.add_command(entry).await.unwrap();
        }
        
        // Add recent commands
        for i in 0..2 {
            history.add_command(create_test_entry(&format!("recent command {}", i))).await.unwrap();
        }
        
        // Clean up entries older than 7 days
        let deleted = history.cleanup_old_entries(7).await.unwrap();
        assert_eq!(deleted, 3);
        
        // Verify only recent commands remain
        let results = history.search("", None, None, 10).await.unwrap();
        assert_eq!(results.len(), 2);
        assert!(results.iter().all(|e| e.command.starts_with("recent")));
    }
    
    #[tokio::test]
    async fn test_search_with_filters() {
        let (history, _temp) = create_test_history();
        
        // Add commands for different panes and sessions
        let mut entry1 = create_test_entry("cmd1");
        entry1.pane_id = "pane1".to_string();
        entry1.session_id = "session1".to_string();
        history.add_command(entry1).await.unwrap();
        
        let mut entry2 = create_test_entry("cmd2");
        entry2.pane_id = "pane2".to_string();
        entry2.session_id = "session1".to_string();
        history.add_command(entry2).await.unwrap();
        
        let mut entry3 = create_test_entry("cmd3");
        entry3.pane_id = "pane1".to_string();
        entry3.session_id = "session2".to_string();
        history.add_command(entry3).await.unwrap();
        
        // Search by pane
        let results = history.search("", Some("pane1"), None, 10).await.unwrap();
        assert_eq!(results.len(), 2);
        
        // Search by session
        let results = history.search("", None, Some("session1"), 10).await.unwrap();
        assert_eq!(results.len(), 2);
        
        // Search by both
        let results = history.search("", Some("pane1"), Some("session1"), 10).await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].command, "cmd1");
    }
    
    #[tokio::test]
    async fn test_cache_overflow() {
        let (history, _temp) = create_test_history();
        
        // Add more than cache capacity (1000)
        for i in 0..1100 {
            history.add_command(create_test_entry(&format!("command {}", i))).await.unwrap();
        }
        
        // Check cache size doesn't exceed limit
        let cache = history.memory_cache.read().await;
        assert!(cache.len() <= 1000);
        
        // Verify most recent commands are kept
        assert!(cache.iter().any(|e| e.command == "command 1099"));
        assert!(!cache.iter().any(|e| e.command == "command 0"));
    }
}