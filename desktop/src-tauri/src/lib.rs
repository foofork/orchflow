pub mod app_dirs;
pub mod backend_commands;
pub mod command_history;
pub mod command_history_commands;
pub mod core_manager_commands;
pub mod error;
pub mod file_commands;
pub mod file_manager;
pub mod file_watcher;
pub mod file_watcher_commands;
pub mod git_commands;
pub mod layout;
pub mod layout_commands;
pub mod manager;
pub mod metrics;
pub mod module_commands;
pub mod modules;
pub mod mux_backend;
pub mod neovim;
pub mod plugin_system;
pub mod plugins;
pub mod project_search;
pub mod search_commands;
pub mod sharing_service;
pub mod simple_state_store;
pub mod startup;
pub mod state_manager;
pub mod terminal_commands;
pub mod terminal_search;
pub mod terminal_stream;
pub mod terminal_stream_commands;
pub mod test_parser_commands;
pub mod test_results_v2;
pub mod tmux;
pub mod trash_commands;
pub mod unified_state_commands;
pub mod updater;
pub mod websocket_server;
pub mod window_state;

#[cfg(test)]
mod working_tests;

#[cfg(test)]
mod performance_tests;

#[cfg(test)]
mod module_commands_tests;

#[cfg(test)]
mod state_manager_tests_v2;

#[cfg(test)]
mod terminal_stream_tests;

#[cfg(test)]
mod file_manager_tests;

#[cfg(test)]
mod layout_tests;

#[cfg(test)]
mod state_manager_tests;

#[cfg(test)]
mod error_tests;

#[cfg(test)]
mod terminal_search_tests;

#[cfg(test)]
mod plugin_event_tests;

#[cfg(test)]
mod test_parser_tests;

#[cfg(test)]
mod command_history_tests;

#[cfg(test)]
mod error_handling_tests;

#[cfg(test)]
mod integration_tests;

#[cfg(test)]
mod manager_mux_tests;

#[cfg(test)]
mod project_search_tests;

#[cfg(test)]
mod test_results_v2_tests;
