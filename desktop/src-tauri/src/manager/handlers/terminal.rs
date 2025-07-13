// Terminal operation handlers

use crate::manager::{Event, Manager};
use serde_json::Value;

pub async fn send_keys(manager: &Manager, pane_id: &str, keys: &str) -> Result<Value, String> {
    // Send keys to pane
    manager
        .mux_backend
        .send_keys(pane_id, keys)
        .await
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "sent": true,
        "pane_id": pane_id
    }))
}

pub async fn run_command(manager: &Manager, pane_id: &str, command: &str) -> Result<Value, String> {
    // Get session ID from pane info
    let session_id = if let Some(pane) = manager.state_manager.get_pane(pane_id).await {
        pane.session_id
    } else {
        // Fallback to empty string if pane not found (shouldn't happen in normal operation)
        tracing::warn!("Could not find pane {} for command history", pane_id);
        String::new()
    };

    // Store command in history
    let entry = crate::command_history::CommandEntry {
        id: uuid::Uuid::new_v4().to_string(),
        pane_id: pane_id.to_string(),
        session_id,
        command: command.to_string(),
        timestamp: chrono::Utc::now(),
        working_dir: None,
        exit_code: None,
        duration_ms: None,
        shell_type: None,
    };
    manager
        .command_history
        .add_command(entry)
        .await
        .map_err(|e| e.to_string())?;

    // Emit command executed event
    manager.emit_event(Event::CommandExecuted {
        pane_id: pane_id.to_string(),
        command: command.to_string(),
    });

    // Send command to pane
    manager
        .mux_backend
        .send_keys(pane_id, &format!("{}\n", command))
        .await
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "executed": true,
        "pane_id": pane_id,
        "command": command
    }))
}

pub async fn get_pane_output(
    manager: &Manager,
    pane_id: &str,
    lines: Option<u32>,
) -> Result<Value, String> {
    // Get output from backend
    let output = manager
        .mux_backend
        .capture_pane(pane_id)
        .await
        .map_err(|e| e.to_string())?;

    // If lines is specified, take only the last N lines
    let output = if let Some(line_count) = lines {
        let lines: Vec<&str> = output.lines().collect();
        let start = lines.len().saturating_sub(line_count as usize);
        lines[start..].join("\n")
    } else {
        output
    };

    Ok(serde_json::json!({
        "pane_id": pane_id,
        "output": output,
        "lines": lines
    }))
}
