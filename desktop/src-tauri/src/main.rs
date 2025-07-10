// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod error;
mod tmux;
mod mux_backend;
mod layout;
mod layout_commands;
mod neovim;
mod simple_state_store;
// mod state_commands; // REMOVED - legacy module replaced by unified_state_commands
mod manager;
mod state_manager;
mod unified_state_commands;
mod terminal_commands;
mod terminal_stream;
mod terminal_stream_commands;
mod file_manager;
mod file_commands;
mod file_watcher;
mod file_watcher_commands;
mod project_search;
mod search_commands;
mod command_history;
mod terminal_search;
mod plugins;
mod websocket_server;
mod modules;
mod module_commands;
mod startup;
mod updater;
// mod test_results; // Legacy SQLx-based implementation - DEPRECATED
mod test_results_v2; // New SimpleStateStore implementation
mod test_results_v2_tests; // Tests for v2 implementation
mod error_handling_tests; // Tests for error handling
mod integration_tests; // Integration tests
mod experimental;
mod window_state;
mod metrics;
mod app_dirs;
mod sharing_service;
mod command_history_commands;
mod backend_commands;
mod test_parser_commands;
mod trash_commands;
mod git_commands;
#[cfg(test)]
mod project_search_tests;

use tmux::*;
use layout::*;
use layout_commands::*;
use neovim::*;
// use simple_state_store::*; // Not needed - using unified_state_commands
// Removed legacy state_commands - using unified_state_commands instead
// use unified_state_commands::*; // Using explicit imports in invoke_handler
// use terminal_commands::*; // Unused top-level import - commands accessed via module::
// use file_commands::*; // Unused top-level import - commands accessed via module::
use modules::*;
use updater::*;
// Legacy SQLx-based implementation removed - use test_results_v2
// test_results_v2 commands imported explicitly in invoke_handler
use metrics::*;
use sharing_service::SharingService;
use simple_state_store::SimpleStateStore;
use std::sync::{Arc, Mutex};
use tauri::Manager;

// Legacy AppState - being phased out in favor of StateManager
// TODO: Remove this once all commands are migrated to unified_state_commands
struct AppState {
    layouts: Mutex<std::collections::HashMap<String, GridLayout>>,
}

// Neovim manager is directly managed, no wrapper needed

#[tokio::main]
async fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle();
            
            // Initialize terminal streaming manager
            let terminal_stream_manager = Arc::new(terminal_stream::TerminalStreamManager::new(handle.clone()));
            handle.manage(terminal_stream_manager);
            
            // Spawn async initialization without non-Send plugin registry
            let handle_clone = handle.clone();
            tauri::async_runtime::spawn(async move {
                match startup::initialize_app(&handle_clone).await {
                    Ok(metrics) => {
                        println!("App initialized successfully");
                        // Emit startup metrics to frontend if needed
                        handle_clone.emit_all("startup-complete", metrics).ok();
                    }
                    Err(e) => {
                        eprintln!("Startup error: {}", e);
                        // Still continue - app might be partially functional
                    }
                }
            });
            
            // Run synchronous startup tasks
            startup::preload_resources(&handle);
            window_state::setup_window_state_persistence(&handle);
            setup_auto_update_check(&handle);
            
            Ok(())
        })
        .manage(AppState {
            layouts: Mutex::new(std::collections::HashMap::new()),
        })
        .manage(NeovimManager::new())
        .manage(UpdaterState::new())
        .manage(SharingService::new())
        .manage(MetricsState::new())
        .manage({
            let store = SimpleStateStore::new_with_file("orchflow.db").unwrap();
            // Initialize SQLx pool synchronously in setup since we can't await here
            // The pool will be initialized during startup
            Arc::new(store)
        })
        .manage({
            // Initialize ModuleLoader
            let store = Arc::new(SimpleStateStore::new_with_file("orchflow.db").unwrap());
            let modules_dir = app_dirs::get_modules_dir().unwrap_or_else(|_| {
                std::env::current_dir().unwrap().join("modules")
            });
            let module_loader = ModuleLoader::new(modules_dir, store);
            Arc::new(tokio::sync::Mutex::new(module_loader))
        })
        .invoke_handler(tauri::generate_handler![
            // Tmux commands
            tmux_create_session,
            tmux_list_sessions,
            tmux_create_pane,
            tmux_split_pane,
            tmux_send_keys,
            tmux_capture_pane,
            tmux_resize_pane,
            tmux_kill_pane,
            // Layout commands
            create_layout,
            get_layout,
            split_layout_pane,
            close_layout_pane,
            resize_layout_pane,
            get_layout_leaf_panes,
            // Neovim commands
            nvim_create_instance,
            nvim_open_file,
            nvim_get_buffer,
            nvim_set_buffer_content,
            nvim_execute_command,
            nvim_close_instance,
            // Legacy commands removed - using unified_state_commands for all state management
            // Module commands
            module_scan,
            module_list,
            module_enable,
            module_execute,
            // Updater commands
            check_for_update,
            download_and_install_update,
            get_current_version,
            // Manager/Orchestrator commands
            manager::orchestrator_execute,
            manager::orchestrator_subscribe,
            manager::list_plugins,
            manager::get_plugin_metadata,
            manager::persist_state,
            manager::select_backend_pane,
            manager::get_sessions,
            manager::get_panes,
            manager::get_command_history,
            manager::list_directory,
            manager::read_file,
            manager::save_file,
            manager::watch_file,
            manager::unwatch_file,
            // Test results commands (legacy SQLx-based - DEPRECATED)
            // NOTE: These commands are no longer functional as SQLx pool has been removed
            // Use the v2 commands below instead
            // test_results::create_test_suite,
            // test_results::start_test_run,
            // test_results::update_test_run,
            // test_results::add_test_result,
            // test_results::add_test_coverage,
            // test_results::get_test_history,
            // test_results::get_test_results,
            // test_results::get_test_coverage,
            // test_results::get_test_failure_trends,
            // Test results commands (new SimpleStateStore-based implementation)
            test_results_v2::create_test_suite_v2,
            test_results_v2::create_test_run_v2,
            test_results_v2::create_test_result_v2,
            test_results_v2::get_test_run_summaries_v2,
            test_results_v2::get_test_results_for_run_v2,
            test_results_v2::get_test_failure_trends_v2,
            // Metrics commands
            get_system_metrics,
            // Unified State commands (NEW - using StateManager)
            unified_state_commands::create_session,
            unified_state_commands::list_sessions,
            unified_state_commands::delete_session,
            unified_state_commands::create_pane,
            unified_state_commands::list_panes,
            unified_state_commands::delete_pane,
            unified_state_commands::get_unified_layout,
            unified_state_commands::update_layout,
            unified_state_commands::split_unified_layout_pane,
            unified_state_commands::close_unified_layout_pane,
            unified_state_commands::resize_unified_layout_pane,
            unified_state_commands::get_unified_layout_leaf_panes,
            // Settings and modules (unified modern API)
            unified_state_commands::set_setting,
            unified_state_commands::get_setting,
            // Module commands (NEW - using ModuleLoader)
            module_commands::install_module,
            module_commands::list_modules,
            module_commands::get_module,
            module_commands::enable_module,
            module_commands::uninstall_module,
            module_commands::execute_module_command,
            module_commands::get_module_commands,
            module_commands::update_module_config,
            module_commands::get_module_config,
            module_commands::search_module_registry,
            module_commands::get_module_details_from_registry,
            module_commands::validate_module_manifest,
            module_commands::create_module_template,
            // Terminal commands (Enhanced Terminal Management)
            terminal_commands::create_terminal,
            terminal_commands::rename_terminal,
            terminal_commands::get_available_shells,
            terminal_commands::get_terminal_groups,
            terminal_commands::save_terminal_template,
            // Terminal streaming commands
            terminal_stream_commands::create_streaming_terminal,
            terminal_stream_commands::send_terminal_input,
            terminal_stream_commands::resize_streaming_terminal,
            terminal_stream_commands::get_terminal_state,
            terminal_stream_commands::stop_streaming_terminal,
            terminal_stream_commands::send_terminal_key,
            terminal_stream_commands::broadcast_terminal_input,
            terminal_stream_commands::clear_terminal_scrollback,
            terminal_stream_commands::search_streaming_terminal_output,
            terminal_stream_commands::get_terminal_process_info,
            terminal_stream_commands::monitor_terminal_health,
            terminal_stream_commands::restart_terminal_process,
            // File management commands
            file_commands::get_file_tree,
            file_commands::create_file,
            file_commands::create_directory,
            file_commands::delete_path,
            file_commands::rename_path,
            file_commands::move_files,
            file_commands::copy_files,
            file_commands::search_files,
            file_commands::expand_directory,
            file_commands::collapse_directory,
            file_commands::get_file_preview,
            file_commands::get_file_operation_history,
            file_commands::undo_file_operation,
            // Search commands
            search_commands::search_project,
            search_commands::search_text,
            search_commands::replace_in_files,
            search_commands::get_search_history,
            search_commands::save_search,
            search_commands::load_saved_search,
            search_commands::get_saved_searches,
            search_commands::clear_search_cache,
            search_commands::search_with_highlights,
            // File watcher commands
            file_watcher_commands::start_file_watcher,
            file_watcher_commands::stop_file_watcher,
            file_watcher_commands::get_watched_paths,
            file_watcher_commands::get_file_watch_events,
            file_watcher_commands::update_file_watcher_config,
            file_watcher_commands::get_file_watcher_config,
            file_watcher_commands::clear_file_watch_buffer,
            // Command history commands
            command_history_commands::get_command_stats,
            command_history_commands::get_command_suggestions,
            command_history_commands::cleanup_command_history,
            command_history_commands::export_command_history,
            command_history_commands::import_command_history,
            // Backend management commands
            backend_commands::list_backend_sessions,
            backend_commands::attach_backend_session,
            backend_commands::detach_backend_session,
            backend_commands::kill_backend_session,
            backend_commands::list_backend_panes,
            backend_commands::sync_backend_sessions,
            // Test parser commands
            test_parser_commands::parse_and_store_test_output,
            test_parser_commands::get_supported_test_frameworks,
            // Trash commands
            trash_commands::list_trash,
            trash_commands::get_trash_from_directory,
            trash_commands::search_trash,
            trash_commands::get_trash_stats,
            trash_commands::get_recent_trash,
            trash_commands::cleanup_old_trash,
            trash_commands::empty_trash,
            trash_commands::get_trash_location,
            // Git commands
            git_commands::get_file_git_status,
            git_commands::get_all_git_statuses,
            git_commands::get_git_branch_info,
            git_commands::has_uncommitted_changes,
            git_commands::has_git_integration,
            git_commands::is_git_ignored,
            git_commands::git_status,
            git_commands::git_diff,
            git_commands::git_stage,
            git_commands::git_unstage,
            git_commands::git_stage_all,
            git_commands::git_unstage_all,
            git_commands::git_commit,
            git_commands::git_push,
            git_commands::git_pull,
            // Utility commands
            get_current_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Utility command to get current directory
#[tauri::command]
fn get_current_dir() -> Result<String, String> {
    std::env::current_dir()
        .map(|path| path.to_string_lossy().to_string())
        .map_err(|e| format!("Failed to get current directory: {}", e))
}