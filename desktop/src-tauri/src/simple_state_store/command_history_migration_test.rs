#[cfg(test)]
mod tests {
    use crate::simple_state_store::{SimpleStateStore, CommandEntry};
    use chrono::Utc;
    use tempfile::TempDir;
    use std::sync::Arc;

    #[tokio::test]
    async fn test_command_history_migration() {
        // Create a temporary directory for the database
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test_migration.db");
        
        // Create store
        let store = Arc::new(SimpleStateStore::new_with_file(&db_path).unwrap());
        
        // Add some entries to the key-value store (old format)
        let entry1 = CommandEntry {
            id: "cmd1".to_string(),
            pane_id: "pane1".to_string(),
            session_id: "session1".to_string(),
            command: "ls -la".to_string(),
            timestamp: Utc::now(),
            working_dir: Some("/home/user".to_string()),
            exit_code: Some(0),
            duration_ms: Some(100),
            shell_type: Some("bash".to_string()),
        };
        
        let entry2 = CommandEntry {
            id: "cmd2".to_string(),
            pane_id: "pane1".to_string(),
            session_id: "session1".to_string(),
            command: "git status".to_string(),
            timestamp: Utc::now(),
            working_dir: Some("/home/user/project".to_string()),
            exit_code: Some(0),
            duration_ms: Some(200),
            shell_type: Some("bash".to_string()),
        };
        
        // Store in old format (key-value)
        let key1 = format!("command_history:{}", entry1.id);
        let key2 = format!("command_history:{}", entry2.id);
        
        store.set(&key1, &serde_json::to_string(&entry1).unwrap()).await.unwrap();
        store.set(&key2, &serde_json::to_string(&entry2).unwrap()).await.unwrap();
        
        // Verify they're in key-value store
        assert!(store.get(&key1).await.unwrap().is_some());
        assert!(store.get(&key2).await.unwrap().is_some());
        
        // Run migration
        let migrated = store.migrate_command_history_from_keyvalue().await.unwrap();
        assert_eq!(migrated, 2);
        
        // Verify entries are now in the new table
        let results = store.search_command_history("", None, None, 10).await.unwrap();
        assert_eq!(results.len(), 2);
        
        // Verify old entries were removed from key-value store
        assert!(store.get(&key1).await.unwrap().is_none());
        assert!(store.get(&key2).await.unwrap().is_none());
        
        // Verify idempotency - running migration again should migrate 0 entries
        let migrated_again = store.migrate_command_history_from_keyvalue().await.unwrap();
        assert_eq!(migrated_again, 0);
    }

    #[tokio::test]
    async fn test_partial_migration_with_existing_entries() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test_partial_migration.db");
        
        let store = Arc::new(SimpleStateStore::new_with_file(&db_path).unwrap());
        
        // Add one entry directly to the new table
        let existing_entry = CommandEntry {
            id: "existing".to_string(),
            pane_id: "pane1".to_string(),
            session_id: "session1".to_string(),
            command: "echo existing".to_string(),
            timestamp: Utc::now(),
            working_dir: None,
            exit_code: Some(0),
            duration_ms: Some(50),
            shell_type: Some("bash".to_string()),
        };
        
        store.save_command_history(existing_entry.clone()).await.unwrap();
        
        // Add the same entry to key-value store (simulating duplicate)
        let key = format!("command_history:{}", existing_entry.id);
        store.set(&key, &serde_json::to_string(&existing_entry).unwrap()).await.unwrap();
        
        // Add a new entry only in key-value store
        let new_entry = CommandEntry {
            id: "new".to_string(),
            pane_id: "pane1".to_string(),
            session_id: "session1".to_string(),
            command: "echo new".to_string(),
            timestamp: Utc::now(),
            working_dir: None,
            exit_code: Some(0),
            duration_ms: Some(75),
            shell_type: Some("bash".to_string()),
        };
        
        let new_key = format!("command_history:{}", new_entry.id);
        store.set(&new_key, &serde_json::to_string(&new_entry).unwrap()).await.unwrap();
        
        // Run migration
        let migrated = store.migrate_command_history_from_keyvalue().await.unwrap();
        
        // Should only migrate the new entry, not the duplicate
        assert_eq!(migrated, 1);
        
        // Verify we have 2 total entries
        let results = store.search_command_history("", None, None, 10).await.unwrap();
        assert_eq!(results.len(), 2);
        
        // Verify both old keys were removed
        assert!(store.get(&key).await.unwrap().is_none());
        assert!(store.get(&new_key).await.unwrap().is_none());
    }
}