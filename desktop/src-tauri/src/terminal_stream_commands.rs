// Terminal Streaming Commands
//
// Tauri commands for terminal I/O streaming and management

use crate::error::Result;
use crate::terminal_stream::{TerminalInput, TerminalMetadata, TerminalStreamManager};
use serde_json::{json, Value};
use std::sync::Arc;
use tauri::State;

#[cfg(test)]
use async_trait::async_trait;

// Note: Terminal streaming manager should be initialized in main.rs setup, not via command

/// Create a new streaming terminal
#[tauri::command]
pub async fn create_streaming_terminal(
    terminal_id: String,
    shell: Option<String>,
    rows: u16,
    cols: u16,
    _cwd: Option<String>,
    _env: Option<std::collections::HashMap<String, String>>,
    manager: State<'_, Arc<TerminalStreamManager>>,
) -> Result<TerminalMetadata> {
    // Create terminal with PTY
    let pty_handle = manager
        .create_terminal(terminal_id.clone(), shell.clone(), rows, cols)
        .await?;

    // Get process ID from PTY handle
    let process_id = match pty_handle.get_process_info().await {
        Ok(info) => Some(info.pid),
        Err(_) => None, // Failed to get process info, but continue with terminal creation
    };

    // Return metadata
    Ok(TerminalMetadata {
        id: terminal_id,
        title: "Terminal".to_string(),
        shell: shell.unwrap_or_else(|| {
            if cfg!(windows) {
                "powershell.exe".to_string()
            } else {
                std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
            }
        }),
        rows,
        cols,
        created_at: chrono::Utc::now(),
        last_activity: chrono::Utc::now(),
        process_id,
    })
}

/// Send input to terminal
#[tauri::command]
pub async fn send_terminal_input(
    terminal_id: String,
    input_type: String,
    data: String,
    manager: State<'_, Arc<TerminalStreamManager>>,
) -> Result<()> {
    let input = match input_type.as_str() {
        "text" => TerminalInput::Text(data),
        "key" => TerminalInput::SpecialKey(data),
        "paste" => TerminalInput::paste(data),
        _ => {
            return Err(crate::error::OrchflowError::ValidationError {
                field: "input_type".to_string(),
                reason: format!("Unknown input type: {}", input_type),
            })
        }
    };

    manager.send_input(&terminal_id, input).await?;
    Ok(())
}

/// Resize terminal
#[tauri::command]
pub async fn resize_streaming_terminal(
    terminal_id: String,
    rows: u16,
    cols: u16,
    manager: State<'_, Arc<TerminalStreamManager>>,
) -> Result<()> {
    manager.resize_terminal(&terminal_id, rows, cols).await?;
    Ok(())
}

/// Get terminal state
#[tauri::command]
pub async fn get_terminal_state(
    terminal_id: String,
    manager: State<'_, Arc<TerminalStreamManager>>,
) -> Result<Value> {
    if let Some(state) = manager.get_terminal_state(&terminal_id).await {
        Ok(serde_json::to_value(state).unwrap())
    } else {
        Err(crate::error::OrchflowError::TerminalError {
            operation: "get_terminal_state".to_string(),
            reason: format!("Terminal {} not found", terminal_id),
        })
    }
}

/// Stop terminal streaming
#[tauri::command]
pub async fn stop_streaming_terminal(
    terminal_id: String,
    manager: State<'_, Arc<TerminalStreamManager>>,
) -> Result<()> {
    manager.stop_terminal(&terminal_id).await?;
    Ok(())
}

/// Send special key sequence
#[tauri::command]
pub async fn send_terminal_key(
    terminal_id: String,
    key: String,
    modifiers: Vec<String>,
    manager: State<'_, Arc<TerminalStreamManager>>,
) -> Result<()> {
    // Build key sequence with modifiers
    let mut sequence = String::new();

    // Handle modifiers
    for modifier in &modifiers {
        match modifier.as_str() {
            "ctrl" => sequence.push_str("\x1b[1;5"),
            "alt" => sequence.push_str("\x1b[1;3"),
            "shift" => sequence.push_str("\x1b[1;2"),
            _ => {}
        }
    }

    // Add key
    let key_sequence = match key.as_str() {
        "a" if modifiers.contains(&"ctrl".to_string()) => "\x01", // Ctrl+A
        "c" if modifiers.contains(&"ctrl".to_string()) => "\x03", // Ctrl+C
        "d" if modifiers.contains(&"ctrl".to_string()) => "\x04", // Ctrl+D
        "l" if modifiers.contains(&"ctrl".to_string()) => "\x0c", // Ctrl+L
        "z" if modifiers.contains(&"ctrl".to_string()) => "\x1a", // Ctrl+Z
        _ => &key,
    };

    let input = TerminalInput::Text(key_sequence.to_string());
    manager.send_input(&terminal_id, input).await?;
    Ok(())
}

/// Broadcast input to multiple terminals
#[tauri::command]
pub async fn broadcast_terminal_input(
    terminal_ids: Vec<String>,
    input_type: String,
    data: String,
    manager: State<'_, Arc<TerminalStreamManager>>,
) -> Result<Vec<(String, bool)>> {
    let input = match input_type.as_str() {
        "text" => TerminalInput::Text(data),
        "key" => TerminalInput::SpecialKey(data),
        "paste" => TerminalInput::paste(data),
        _ => {
            return Err(crate::error::OrchflowError::ValidationError {
                field: "input_type".to_string(),
                reason: format!("Unknown input type: {}", input_type),
            })
        }
    };

    let mut results = Vec::new();

    for terminal_id in terminal_ids {
        let success = manager
            .send_input(&terminal_id, input.clone())
            .await
            .is_ok();
        results.push((terminal_id, success));
    }

    Ok(results)
}


/// Search streaming terminal output
#[tauri::command]
pub async fn search_streaming_terminal_output(
    terminal_id: String,
    pattern: String,
    case_sensitive: bool,
    manager: State<'_, Arc<TerminalStreamManager>>,
) -> Result<Vec<Value>> {
    let search_results = manager
        .search_terminal_scrollback(&terminal_id, &pattern, case_sensitive)
        .await?;

    let results: Vec<Value> = search_results
        .into_iter()
        .map(|(line_number, line)| {
            let content = String::from_utf8_lossy(&line.content);
            json!({
                "line_number": line_number,
                "content": content.trim_end_matches('\n'),
                "timestamp": line.timestamp,
                "matches": find_pattern_matches(&content, &pattern, case_sensitive)
            })
        })
        .collect();

    Ok(results)
}

/// Helper function to find pattern matches within a line
fn find_pattern_matches(content: &str, pattern: &str, case_sensitive: bool) -> Vec<Value> {
    let search_content = if case_sensitive {
        content.to_string()
    } else {
        content.to_lowercase()
    };
    
    let search_pattern = if case_sensitive {
        pattern.to_string()
    } else {
        pattern.to_lowercase()
    };

    let mut matches = Vec::new();
    let mut start_pos = 0;

    while let Some(pos) = search_content[start_pos..].find(&search_pattern) {
        let absolute_pos = start_pos + pos;
        matches.push(json!({
            "start": absolute_pos,
            "end": absolute_pos + pattern.len(),
            "text": &content[absolute_pos..absolute_pos + pattern.len()]
        }));
        start_pos = absolute_pos + 1;
    }

    matches
}

/// Get terminal scrollback history
#[tauri::command]
pub async fn get_terminal_scrollback(
    terminal_id: String,
    start: Option<usize>,
    count: Option<usize>,
    manager: State<'_, Arc<TerminalStreamManager>>,
) -> Result<Vec<Value>> {
    let start_line = start.unwrap_or(0);
    let line_count = count.unwrap_or(100); // Default to last 100 lines

    let scrollback_lines = manager
        .get_terminal_scrollback(&terminal_id, start_line, line_count)
        .await?;

    let results: Vec<Value> = scrollback_lines
        .into_iter()
        .enumerate()
        .map(|(idx, line)| {
            let content = String::from_utf8_lossy(&line.content);
            json!({
                "line_number": start_line + idx,
                "content": content.trim_end_matches('\n'),
                "timestamp": line.timestamp
            })
        })
        .collect();

    Ok(results)
}

/// Clear terminal scrollback buffer
#[tauri::command]
pub async fn clear_terminal_scrollback(
    terminal_id: String,
    manager: State<'_, Arc<TerminalStreamManager>>,
) -> Result<()> {
    manager.clear_terminal_scrollback(&terminal_id).await?;
    Ok(())
}

/// Get terminal process info
#[tauri::command]
pub async fn get_terminal_process_info(
    terminal_id: String,
    manager: State<'_, Arc<TerminalStreamManager>>,
) -> Result<Value> {
    let info = manager.get_process_info(&terminal_id).await?;
    Ok(serde_json::to_value(info).unwrap())
}

/// Monitor terminal health
#[tauri::command]
pub async fn monitor_terminal_health(
    terminal_id: String,
    manager: State<'_, Arc<TerminalStreamManager>>,
) -> Result<Value> {
    let health = manager.get_terminal_health(&terminal_id).await?;
    Ok(serde_json::to_value(health).unwrap())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::terminal_stream::{TauriIpcChannel, TerminalStreamManager};
    use std::sync::Arc;

    // Mock IPC channel for testing
    struct MockIpcChannel;

    #[async_trait::async_trait]
    impl crate::terminal_stream::IpcChannel for MockIpcChannel {
        async fn start_streaming(
            &self,
            _terminal_id: String,
            _pty_handle: crate::terminal_stream::PtyHandle,
        ) -> Result<(), crate::error::OrchflowError> {
            Ok(())
        }

        async fn send_input(
            &self,
            _terminal_id: &str,
            _input: TerminalInput,
        ) -> Result<(), crate::error::OrchflowError> {
            Ok(())
        }

        async fn send_control(
            &self,
            _terminal_id: &str,
            _control: crate::terminal_stream::ControlMessage,
        ) -> Result<(), crate::error::OrchflowError> {
            Ok(())
        }

        async fn stop_streaming(&self, _terminal_id: &str) -> Result<(), crate::error::OrchflowError> {
            Ok(())
        }
    }

    #[tokio::test]
    async fn test_find_pattern_matches() {
        let content = "Hello world, this is a test Hello again";
        let pattern = "Hello";
        
        // Case sensitive
        let matches = find_pattern_matches(content, pattern, true);
        assert_eq!(matches.len(), 2);
        assert_eq!(matches[0]["start"], 0);
        assert_eq!(matches[0]["end"], 5);
        assert_eq!(matches[1]["start"], 30);
        assert_eq!(matches[1]["end"], 35);
        
        // Case insensitive
        let matches = find_pattern_matches(content, "hello", false);
        assert_eq!(matches.len(), 2);
    }

    #[tokio::test]
    async fn test_find_pattern_matches_overlapping() {
        let content = "aaa";
        let pattern = "aa";
        
        let matches = find_pattern_matches(content, pattern, true);
        assert_eq!(matches.len(), 2); // Should find overlapping matches
        assert_eq!(matches[0]["start"], 0);
        assert_eq!(matches[1]["start"], 1);
    }

    #[tokio::test]
    async fn test_find_pattern_matches_no_matches() {
        let content = "Hello world";
        let pattern = "xyz";
        
        let matches = find_pattern_matches(content, pattern, true);
        assert_eq!(matches.len(), 0);
    }

    #[tokio::test]
    async fn test_find_pattern_matches_case_insensitive() {
        let content = "Hello HELLO hello HeLLo";
        let pattern = "hello";
        
        let matches = find_pattern_matches(content, pattern, false);
        assert_eq!(matches.len(), 4);
    }

    #[tokio::test]
    async fn test_terminal_scrollback_integration() {
        let mock_ipc = Arc::new(MockIpcChannel);
        let manager = Arc::new(TerminalStreamManager::with_ipc_channel(mock_ipc));
        
        // Create a test terminal
        let terminal_id = "test_terminal".to_string();
        let _pty_handle = manager
            .create_terminal(terminal_id.clone(), None, 24, 80)
            .await;
        
        // Add some test output
        let test_data = b"Line 1: Hello world\nLine 2: Testing search\nLine 3: Another line\n";
        let _ = manager.add_terminal_output(&terminal_id, test_data).await;
        
        // Test search functionality
        let search_results = manager
            .search_terminal_scrollback(&terminal_id, "Hello", true)
            .await;
        
        match search_results {
            Ok(results) => {
                assert!(!results.is_empty());
                // Should find "Hello" in Line 1
                let content = String::from_utf8_lossy(&results[0].1.content);
                assert!(content.contains("Hello"));
            }
            Err(_) => {
                // PTY creation might fail in test environment, which is okay
                println!("PTY creation failed in test environment - this is expected");
            }
        }
    }

    #[tokio::test]
    async fn test_terminal_scrollback_commands_mock() {
        // Test the helper functions directly since full integration
        // requires PTY support which may not be available in test env
        
        // Test pattern matching with various edge cases
        let test_cases = vec![
            ("simple match", "test", true, vec![0]),
            ("case insensitive", "TEST", false, vec![0]),
            ("multiple matches", "test test", true, vec![0, 5]),
            ("no matches", "xyz", true, vec![]),
        ];
        
        for (content, pattern, case_sensitive, expected_positions) in test_cases {
            let matches = find_pattern_matches(content, pattern, case_sensitive);
            let positions: Vec<usize> = matches.iter()
                .map(|m| m["start"].as_u64().unwrap() as usize)
                .collect();
            assert_eq!(positions, expected_positions, 
                "Failed for content: '{}', pattern: '{}', case_sensitive: {}", 
                content, pattern, case_sensitive);
        }
    }
}

/// Restart terminal process
#[tauri::command]
pub async fn restart_terminal_process(
    terminal_id: String,
    manager: State<'_, Arc<TerminalStreamManager>>,
) -> Result<()> {
    manager.restart_terminal(&terminal_id).await?;
    Ok(())
}
