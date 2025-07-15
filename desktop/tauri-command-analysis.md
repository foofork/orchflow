# Tauri Command Analysis

## Commands Invoked from Frontend (82 total)
- broadcast_terminal_input
- cleanup_old_trash
- clear_terminal_scrollback
- close_terminal
- close_unified_layout_pane
- copy_files
- create_directory
- create_file
- create_flow
- create_project
- create_session
- create_share_package
- create_terminal
- db_create_session
- db_get_active_layout
- db_get_session
- db_get_setting
- db_install_module
- db_list_layouts
- db_list_modules
- db_list_sessions
- db_save_layout
- db_save_pane
- db_set_setting
- db_update_pane_content
- db_update_session_activity
- delete_path
- delete_share_package
- download_and_install_update
- empty_trash
- get_all_git_statuses
- get_available_shells
- get_command_history
- get_current_dir
- get_current_version
- get_file_operation_history
- get_flows
- get_git_branch_info
- get_pane
- get_panes
- get_plugin_metadata
- get_saved_searches
- get_search_history
- get_session
- get_sessions
- get_system_metrics
- get_terminal_output
- get_test_history
- get_trash_from_directory
- get_trash_stats
- get_unified_layout
- get_unified_layout_leaf_panes
- git_add_all
- git_commit
- git_status
- has_git_integration
- import_security_configuration
- import_share_package
- list_directory
- list_plugins
- list_share_packages
- list_trash
- manager_execute
- manager_subscribe
- module_enable
- module_execute
- module_list
- module_scan
- move_files
- nvim_close_instance
- nvim_create_instance
- nvim_eval
- nvim_execute_command
- nvim_get_buffer
- nvim_get_mode
- nvim_open_file
- nvim_set_buffer_content
- persist_state
- read_file
- rename_path
- replace_in_files
- resize_streaming_terminal
- resize_terminal
- resize_unified_layout_pane
- restart_app
- restart_terminal_process
- run_flow
- save_file
- save_search
- search_command_history
- search_in_files
- search_project
- search_trash
- select_backend_pane
- send_terminal_input
- send_terminal_key
- split_unified_layout_pane
- stop_streaming_terminal
- tmux_capture_pane
- tmux_create_pane
- tmux_create_session
- tmux_kill_pane
- tmux_list_sessions
- tmux_resize_pane
- tmux_send_keys
- trust_workspace
- unwatch_file
- update_terminal_security_tier
- upload_share_package
- watch_file
- write_terminal

## Commands Defined in Rust but NOT Invoked (124 total)
1. attach_backend_session
2. check_for_update
3. cleanup_command_history
4. cleanup_test_data
5. clear_file_watch_buffer
6. clear_search_cache
7. close_tab
8. collapse_directory
9. create_module_template
10. create_neovim_editor
11. create_pane
12. create_streaming_terminal
13. create_tab
14. create_test_result_v2
15. create_test_run_v2
16. create_test_suite_v2
17. delete_pane
18. delete_session
19. detach_backend_session
20. enable_module
21. execute_module_command
22. execute_neovim_command
23. execute_plugin_command
24. expand_directory
25. export_command_history
26. find_trashed_item
27. generate_updater_keys
28. get_command_stats
29. get_command_suggestions
30. get_file_git_status
31. get_file_preview
32. get_file_tree
33. get_file_watch_events
34. get_file_watcher_config
35. get_module
36. get_module_commands
37. get_module_config
38. get_module_details_from_registry
39. get_neovim_buffer
40. get_output
41. get_plugin_commands
42. get_recent_trash
43. get_saved_search (note: get_saved_searches is used)
44. get_setting
45. get_supported_test_frameworks
46. get_tabs
47. get_terminal_groups
48. get_terminal_process_info
49. get_terminal_scrollback
50. get_terminal_state
51. get_test_failure_trends_v2
52. get_test_results
53. get_test_results_for_run_v2
54. get_test_run_summaries_v2
55. get_test_run_summary
56. get_test_runs
57. get_test_statistics
58. get_trash_location
59. get_watched_paths
60. git_diff
61. git_pull
62. git_push
63. git_stage
64. git_stage_all
65. git_unstage
66. git_unstage_all
67. has_uncommitted_changes
68. import_command_history
69. install_module
70. is_git_ignored
71. kill_backend_session
72. list_backend_panes
73. list_backend_sessions
74. list_panes
75. list_registered_plugins
76. list_sessions
77. load_saved_search
78. monitor_terminal_health
79. orchestrator_execute
80. orchestrator_subscribe
81. parse_and_store_test_output
82. register_plugin_commands
83. rename_terminal
84. restore_file_from_trash
85. restore_multiple_files_from_trash
86. save_terminal_template
87. search_command_history_advanced
88. search_files
89. search_module_registry
90. search_streaming_terminal_output
91. search_terminal_output
92. search_text
93. search_with_highlights
94. set_setting
95. start_file_watcher
96. stop_file_watcher
97. stop_terminal_stream
98. stream_terminal_output
99. switch_tab
100. sync_backend_sessions
101. tmux_split_pane
102. undo_file_operation
103. uninstall_module
104. update_file_watcher_config
105. update_layout
106. update_module_config
107. validate_module_manifest

## Notable Findings

### Backend/Session Management Commands (Unused)
- attach_backend_session
- detach_backend_session
- kill_backend_session
- list_backend_sessions
- list_backend_panes
- sync_backend_sessions

### File Watcher Commands (Unused)
- start_file_watcher
- stop_file_watcher
- clear_file_watch_buffer
- get_file_watch_events
- get_file_watcher_config
- update_file_watcher_config

### Test Framework Commands (Unused)
- create_test_result_v2
- create_test_run_v2
- create_test_suite_v2
- get_test_results
- get_test_results_for_run_v2
- get_test_run_summaries_v2
- get_test_run_summary
- get_test_runs
- get_test_statistics
- get_test_failure_trends_v2
- get_supported_test_frameworks
- parse_and_store_test_output
- cleanup_test_data

### Git Commands (Partially Unused)
- git_diff
- git_pull
- git_push
- git_stage
- git_stage_all
- git_unstage
- git_unstage_all
- has_uncommitted_changes
- is_git_ignored
- get_file_git_status

### Terminal Management (Partially Unused)
- create_streaming_terminal
- search_streaming_terminal_output
- search_terminal_output
- get_terminal_scrollback
- get_terminal_state
- get_terminal_process_info
- monitor_terminal_health
- save_terminal_template
- rename_terminal
- get_terminal_groups
- stream_terminal_output
- stop_terminal_stream

### Module System (Partially Unused)
- get_module
- get_module_commands
- get_module_config
- update_module_config
- install_module
- uninstall_module
- enable_module (used in frontend)
- execute_module_command
- validate_module_manifest
- create_module_template
- get_module_details_from_registry
- search_module_registry

### Tab Management (Unused)
- get_tabs
- create_tab
- switch_tab
- close_tab

### Plugin System (Partially Unused)
- execute_plugin_command
- register_plugin_commands
- get_plugin_commands
- list_registered_plugins

### Orchestrator Commands (Unused)
- orchestrator_execute
- orchestrator_subscribe

### Command History (Partially Unused)
- search_command_history_advanced
- get_command_stats
- get_command_suggestions
- cleanup_command_history
- export_command_history
- import_command_history

### File Operations (Partially Unused)
- expand_directory
- collapse_directory
- get_file_tree
- get_file_preview
- undo_file_operation
- search_files
- search_text
- search_with_highlights

### Trash Management (Partially Unused)
- find_trashed_item
- restore_file_from_trash
- restore_multiple_files_from_trash
- get_recent_trash
- get_trash_location

### Settings (Unused)
- get_setting
- set_setting
Note: db_get_setting and db_set_setting are used instead

### Layout/Pane Management (Partially Unused)
- create_pane
- delete_pane
- list_panes
- update_layout

### Neovim Commands (Partially Unused)
- create_neovim_editor
- execute_neovim_command (different from nvim_execute_command)
- get_neovim_buffer (different from nvim_get_buffer)

### Search Cache (Unused)
- clear_search_cache
- load_saved_search (get_saved_searches is used instead)

### Update System (Partially Unused)
- check_for_update
- generate_updater_keys

### Session Management (Unused)
- delete_session
- list_sessions (different from db_list_sessions)

## Background Tasks and Event Emissions

### Background Tasks (tokio::spawn)
The following background tasks are running but may not be connected to the frontend:

1. **Startup Tasks** (src-tauri/src/startup.rs)
   - Neovim binary check
   - Tmux binary check
   - Module scanning (delayed)
   - WebSocket server (commented out)
   - Module manifest preloading

2. **Window State Management** (src-tauri/src/window_state.rs)
   - Window state restoration on startup
   - Debounced window state saving

3. **Auto-Update System** (src-tauri/src/updater.rs)
   - Update download task
   - Startup update check (30s delay)
   - Periodic update check (every 4 hours)

4. **Manager Core** (src-tauri/src/manager/mod.rs)
   - Action processor loop
   - State event dispatcher
   - Plugin event dispatcher
   - Command history migration

5. **Terminal Streaming** (src-tauri/src/terminal_stream/ipc_handler.rs)
   - Output streaming task for each terminal
   - Terminal state monitoring

6. **WebSocket Server** (src-tauri/src/websocket_server.rs)
   - Connection handler (currently commented out in startup)
   - Event forwarding task
   - Message sending task

7. **Session Plugin** (src-tauri/src/plugins/session_plugin.rs)
   - Auto-save task (if enabled)

8. **MuxD Backend** (src-tauri/src/mux_backend/muxd_backend.rs)
   - PTY output reader for each pane

### Event Emissions
The following events are emitted but may not have listeners in the frontend:

1. **System Events**
   - `startup-complete` - Emitted when app initialization is complete
   - `update-available` - Update system notifications
   - `update-downloaded` - Update ready to install
   - `update-error` - Update system errors

2. **Terminal Events**
   - `terminal-output-{streamId}` - Dynamic terminal output events
   - `terminal-output` - General terminal output
   - `terminal-exit` - Terminal process exit
   - `terminal-state` - Terminal state changes
   - `terminal-error` - Terminal errors

3. **Mux Events**
   - `mux-event` - Various multiplexer events (session/pane created, output, exit)

4. **State Manager Events** (Internal)
   - `StateEvent::SessionCreated`
   - `StateEvent::SessionUpdated`
   - `StateEvent::SessionDeleted`
   - `StateEvent::PaneCreated`
   - `StateEvent::PaneUpdated`
   - `StateEvent::PaneDeleted`
   - `StateEvent::LayoutUpdated`
   - `StateEvent::LayoutReset`

## Summary
Out of approximately 206 Tauri commands defined in the Rust backend:
- 82 commands are actively being invoked from the frontend
- 124 commands are defined but never invoked
- This represents about 60% of commands being unused

Additionally:
- 8 major background task systems are running
- 4 categories of events are being emitted
- WebSocket server code exists but is commented out
- Many background tasks appear to be working correctly (startup, updates, terminal streaming)

Many of these unused commands appear to be:
1. Alternative implementations (e.g., db_* vs regular versions)
2. Advanced features not yet integrated into the UI
3. Backend management commands that might be used internally
4. Test framework integration that may not be exposed to users yet
5. File watcher functionality that appears to be completely unused
6. WebSocket server functionality (currently disabled)
7. Orchestrator system (unused commands: orchestrator_execute, orchestrator_subscribe)