pub mod error;
pub mod mux_backend;
pub mod tmux;
pub mod manager;
pub mod simple_state_store;
pub mod layout;
pub mod state_manager;
pub mod terminal_commands;
pub mod command_history;
pub mod terminal_search;
pub mod file_manager;
pub mod file_commands;
pub mod file_watcher;
pub mod file_watcher_commands;
pub mod project_search;
pub mod search_commands;
pub mod plugin_system;
pub mod plugins;
pub mod backend_commands;
pub mod test_parser_commands;
pub mod modules;
pub mod module_commands;
pub mod terminal_stream;

#[cfg(test)]
mod working_tests;

#[cfg(test)]
mod performance_tests;

#[cfg(test)]
mod module_commands_tests;

// #[cfg(test)]
// mod state_manager_tests_v2;

#[cfg(test)]
mod terminal_stream_tests;

// #[cfg(test)]
// mod file_manager_tests;

// TODO: Fix these tests after completing error system updates
// #[cfg(test)]
// mod layout_tests;

// #[cfg(test)]
// mod state_manager_tests;

// #[cfg(test)]
// mod error_tests;

// #[cfg(test)]
// mod terminal_search_tests;

// #[cfg(test)]
// mod plugin_event_tests;

// #[cfg(test)]
// mod test_parser_tests;