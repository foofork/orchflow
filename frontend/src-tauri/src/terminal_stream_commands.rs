// Terminal Streaming Commands
//
// Tauri commands for terminal I/O streaming and management

use tauri::{State, AppHandle};
use crate::terminal_stream::{
    TerminalStreamManager, TerminalInput, CreateTerminalOptions,
    TerminalEvent, TerminalMode, TerminalMetadata,
};
use crate::error::Result;
use serde_json::Value;
use std::sync::Arc;
use tokio::sync::RwLock;

// Note: Terminal streaming manager should be initialized in main.rs setup, not via command

/// Create a new streaming terminal
#[tauri::command]
pub async fn create_streaming_terminal(
    terminal_id: String,
    shell: Option<String>,
    rows: u16,
    cols: u16,
    cwd: Option<String>,
    env: Option<std::collections::HashMap<String, String>>,
    manager: State<'_, Arc<TerminalStreamManager>>,
) -> Result<TerminalMetadata> {
    // Create terminal with PTY
    let pty_handle = manager.create_terminal(
        terminal_id.clone(),
        shell.clone(),
        rows,
        cols,
    ).await?;
    
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
        process_id: None, // TODO: Get from PTY
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
        _ => return Err(crate::error::OrchflowError::ValidationError {
            field: "input_type".to_string(),
            reason: format!("Unknown input type: {}", input_type),
        }),
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
        _ => return Err(crate::error::OrchflowError::ValidationError {
            field: "input_type".to_string(),
            reason: format!("Unknown input type: {}", input_type),
        }),
    };
    
    let mut results = Vec::new();
    
    for terminal_id in terminal_ids {
        let success = manager.send_input(&terminal_id, input.clone()).await.is_ok();
        results.push((terminal_id, success));
    }
    
    Ok(results)
}

/// Clear terminal scrollback
#[tauri::command]
pub async fn clear_terminal_scrollback(
    terminal_id: String,
    manager: State<'_, Arc<TerminalStreamManager>>,
) -> Result<()> {
    // Send clear screen sequence
    let clear_sequence = "\x1b[2J\x1b[H"; // Clear screen and move cursor to home
    let input = TerminalInput::Text(clear_sequence.to_string());
    manager.send_input(&terminal_id, input).await?;
    Ok(())
}

/// Search streaming terminal output
#[tauri::command]
pub async fn search_streaming_terminal_output(
    terminal_id: String,
    pattern: String,
    case_sensitive: bool,
    manager: State<'_, Arc<TerminalStreamManager>>,
) -> Result<Vec<Value>> {
    // TODO: Implement scrollback search
    // This will require adding search functionality to the terminal state
    Ok(vec![])
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

/// Restart terminal process
#[tauri::command]
pub async fn restart_terminal_process(
    terminal_id: String,
    manager: State<'_, Arc<TerminalStreamManager>>,
) -> Result<()> {
    manager.restart_terminal(&terminal_id).await?;
    Ok(())
}