use crate::error::Result;
use crate::manager::Manager;
use serde_json::Value;

pub async fn send_keys(manager: &Manager, pane_id: &str, keys: &str) -> Result<Value> {
    // Get pane
    let pane = manager
        .state_manager
        .get_pane(pane_id)
        .await
        .ok_or_else(|| {
            crate::error::OrchflowError::NotFound(format!("Pane not found: {pane_id}"))
        })?;

    // Send keys to backend
    if let Some(backend_id) = &pane.backend_id {
        manager.mux_backend.send_keys(backend_id, keys).await?;
    }

    Ok(serde_json::json!({
        "status": "ok",
        "pane_id": pane_id
    }))
}

pub async fn run_command(manager: &Manager, pane_id: &str, command: &str) -> Result<Value> {
    // Get pane
    let pane = manager
        .state_manager
        .get_pane(pane_id)
        .await
        .ok_or_else(|| {
            crate::error::OrchflowError::NotFound(format!("Pane not found: {pane_id}"))
        })?;

    // Send command with newline
    if let Some(backend_id) = &pane.backend_id {
        let command_with_newline = format!("{command}\n");
        manager
            .mux_backend
            .send_keys(backend_id, &command_with_newline)
            .await?;
    }

    // Emit event
    manager.emit_event(crate::manager::Event::CommandExecuted {
        pane_id: pane_id.to_string(),
        command: command.to_string(),
    });

    // Record in command history if available
    if let Some(history) = &manager.command_history {
        let _ = history.add_command(&pane.session_id, command).await;
    }

    Ok(serde_json::json!({
        "status": "ok",
        "pane_id": pane_id,
        "command": command
    }))
}

pub async fn get_pane_output(
    manager: &Manager,
    pane_id: &str,
    lines: Option<u32>,
) -> Result<Value> {
    // Get pane
    let pane = manager
        .state_manager
        .get_pane(pane_id)
        .await
        .ok_or_else(|| {
            crate::error::OrchflowError::NotFound(format!("Pane not found: {pane_id}"))
        })?;

    // Capture output from backend
    let output = if let Some(backend_id) = &pane.backend_id {
        manager.mux_backend.capture_pane(backend_id).await?
    } else {
        String::new()
    };

    // Limit lines if requested
    let output = if let Some(line_count) = lines {
        let lines: Vec<&str> = output.lines().collect();
        let start = lines.len().saturating_sub(line_count as usize);
        lines[start..].join("\n")
    } else {
        output
    };

    Ok(serde_json::json!({
        "status": "ok",
        "pane_id": pane_id,
        "output": output
    }))
}
