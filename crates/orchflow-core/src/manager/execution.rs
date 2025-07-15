use super::handlers;
use super::{Action, Manager};
use crate::error::Result;
use serde_json::Value;

/// Execute an action through the action channel
pub async fn execute_action(manager: &Manager, action: Action) -> Result<Value> {
    let (tx, mut rx) = tokio::sync::mpsc::channel(1);

    manager
        .action_tx
        .send((action, tx))
        .await
        .map_err(|_| crate::error::OrchflowError::General("Failed to send action".to_string()))?;

    rx.recv()
        .await
        .ok_or_else(|| crate::error::OrchflowError::General("No response received".to_string()))?
}

/// Process an action directly
pub async fn process_action(manager: &Manager, action: Action) -> Result<Value> {
    match action {
        // Session management
        Action::CreateSession { name } => handlers::session::create_session(manager, name).await,

        Action::DeleteSession { session_id } => {
            handlers::session::delete_session(manager, session_id).await
        }

        Action::SaveSession { session_id, name } => {
            // For now, just return success since session persistence is handled by state manager
            Ok(serde_json::json!({
                "status": "ok",
                "session_id": session_id,
                "name": name
            }))
        }

        // Pane management
        Action::CreatePane {
            session_id,
            pane_type,
            command,
            shell_type,
            name,
        } => {
            handlers::pane::create_pane(manager, session_id, pane_type, command, shell_type, name)
                .await
        }

        Action::ClosePane { pane_id } => handlers::pane::close_pane(manager, pane_id).await,

        Action::ResizePane {
            pane_id,
            width,
            height,
        } => handlers::pane::resize_pane(manager, &pane_id, width, height).await,

        Action::RenamePane { pane_id, name } => {
            handlers::pane::rename_pane(manager, &pane_id, &name).await
        }

        // File management
        Action::CreateFile { path, content } => {
            handlers::file::create_file(manager, &path, content.as_deref()).await
        }

        Action::OpenFile { path } => handlers::file::open_file(manager, &path).await,

        Action::CreateDirectory { path } => handlers::file::create_directory(manager, &path).await,

        Action::DeletePath { path, permanent } => {
            handlers::file::delete_path(manager, &path, permanent).await
        }

        Action::RenamePath { old_path, new_name } => {
            handlers::file::rename_path(manager, &old_path, &new_name).await
        }

        Action::CopyPath {
            source,
            destination,
        } => handlers::file::copy_path(manager, &source, &destination).await,

        Action::MovePath {
            source,
            destination,
        } => handlers::file::move_path(manager, &source, &destination).await,

        Action::MoveFiles { files, destination } => {
            handlers::file::move_files(manager, &files, &destination).await
        }

        Action::CopyFiles { files, destination } => {
            handlers::file::copy_files(manager, &files, &destination).await
        }

        Action::GetFileTree { path, max_depth } => {
            handlers::file::get_file_tree(manager, path.as_deref(), max_depth).await
        }

        Action::SearchFiles { pattern, path } => {
            handlers::file::search_files(manager, &pattern, path.as_deref()).await
        }

        // Search operations
        Action::SearchProject { pattern, options } => {
            handlers::search::search_project(manager, &pattern, options).await
        }

        Action::SearchInFile { file_path, pattern } => {
            handlers::search::search_in_file(manager, &file_path, &pattern).await
        }

        // Terminal operations
        Action::SendKeys { pane_id, keys } => {
            handlers::terminal::send_keys(manager, &pane_id, &keys).await
        }

        Action::RunCommand { pane_id, command } => {
            handlers::terminal::run_command(manager, &pane_id, &command).await
        }

        Action::GetPaneOutput { pane_id, lines } => {
            handlers::terminal::get_pane_output(manager, &pane_id, lines).await
        }

        // Plugin management
        Action::LoadPlugin { id: _, config: _ } => Err(crate::error::OrchflowError::General(
            "Plugin loading must be done through Manager::load_plugin".to_string(),
        )),

        Action::UnloadPlugin { id } => {
            manager.unload_plugin(&id).await?;
            Ok(serde_json::json!({
                "status": "ok",
                "plugin_id": id,
                "unloaded": true
            }))
        }
    }
}
