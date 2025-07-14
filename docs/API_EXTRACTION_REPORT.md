# Orchflow API Extraction Report

## Overview
This report comprehensively documents all public APIs found in the Orchflow codebase, including JSON-RPC endpoints, REST APIs, IPC interfaces, WebSocket APIs, Tauri command handlers, and public function exports.

## 1. Tauri Command Handlers (IPC API)

### Session Management
- `create_session(manager: State<Manager>, name: String) -> Result<Value>`
- `get_sessions(manager: State<Manager>) -> Result<Vec<Value>>`
- `get_session(session_id: String, state_manager: State<StateManager>) -> Result<Value>`
- `list_sessions(state_manager: State<StateManager>) -> Result<Value>`
- `delete_session(manager: State<Manager>, session_id: String) -> Result<()>`
- `attach_backend_session(manager: State<Manager>, session_id: String) -> Result<()>`
- `detach_backend_session(manager: State<Manager>, session_id: String) -> Result<()>`
- `kill_backend_session(manager: State<Manager>, session_id: String) -> Result<()>`
- `list_backend_sessions(manager: State<Manager>) -> Result<Vec<BackendSession>>`
- `sync_backend_sessions(manager: State<Manager>) -> Result<SyncResult>`

### Pane Management
- `create_pane(manager: State<Manager>, session_id: String, pane_type: PaneType, command?: String, shell_type?: String, name?: String) -> Result<Value>`
- `get_pane(pane_id: String, state_manager: State<StateManager>) -> Result<Value>`
- `get_panes(manager: State<Manager>, session_id: String) -> Result<Vec<Value>>`
- `list_panes(manager: State<Manager>, session_id: String) -> Result<Vec<Value>>`
- `delete_pane(manager: State<Manager>, pane_id: String) -> Result<()>`
- `select_backend_pane(manager: State<Manager>, pane_id: String) -> Result<()>`
- `list_backend_panes(manager: State<Manager>, session_id: String) -> Result<Vec<BackendPane>>`

### Terminal Operations
- `create_terminal(params) -> Result<TerminalInfo>`
- `create_streaming_terminal(terminal_id: String, shell?: String, rows?: Number, cols?: Number, cwd?: String, env?: Map) -> Result<TerminalMetadata>`
- `send_terminal_input(terminal_id: String, input_type: String, data: String) -> Result<()>`
- `send_terminal_key(terminal_id: String, key: String, modifiers: Vec<String>) -> Result<()>`
- `broadcast_terminal_input(terminal_ids: Vec<String>, input_type: String, data: String) -> Result<Vec<(String, bool)>>`
- `resize_streaming_terminal(terminal_id: String, rows: Number, cols: Number) -> Result<()>`
- `stop_streaming_terminal(terminal_id: String) -> Result<()>`
- `get_terminal_state(terminal_id: String) -> Result<TerminalState>`
- `get_terminal_process_info(terminal_id: String) -> Result<ProcessInfo>`
- `monitor_terminal_health(terminal_id: String) -> Result<TerminalHealth>`
- `restart_terminal_process(terminal_id: String) -> Result<()>`
- `clear_terminal_scrollback(terminal_id: String) -> Result<()>`
- `get_terminal_scrollback(terminal_id: String, lines?: Number) -> Result<String>`
- `search_terminal_output(terminal_id: String, pattern: String) -> Result<Vec<SearchMatch>>`
- `search_streaming_terminal_output(terminal_id: String, pattern: String) -> Result<Vec<SearchMatch>>`
- `rename_terminal(terminal_id: String, name: String) -> Result<()>`
- `save_terminal_template(name: String, config: TerminalConfig) -> Result<()>`
- `get_terminal_groups() -> Result<Vec<TerminalGroup>>`
- `stream_terminal_output(terminal_id: String) -> Result<()>`
- `stop_terminal_stream(terminal_id: String) -> Result<()>`

### File Operations
- `read_file(manager: State<Manager>, path: String) -> Result<String>`
- `save_file(manager: State<Manager>, path: String, content: String) -> Result<()>`
- `create_file(manager: State<Manager>, path: String, content?: String) -> Result<()>`
- `create_directory(manager: State<Manager>, path: String) -> Result<()>`
- `list_directory(manager: State<Manager>, path: String) -> Result<DirectoryContent>`
- `delete_path(manager: State<Manager>, path: String, permanent: bool) -> Result<()>`
- `rename_path(manager: State<Manager>, old_path: String, new_name: String) -> Result<()>`
- `copy_files(manager: State<Manager>, files: Vec<String>, destination: String) -> Result<()>`
- `move_files(manager: State<Manager>, files: Vec<String>, destination: String) -> Result<()>`
- `get_file_tree(manager: State<Manager>, root_path: String, max_depth?: Number) -> Result<FileNode>`
- `expand_directory(manager: State<Manager>, path: String) -> Result<Vec<FileNode>>`
- `collapse_directory(manager: State<Manager>, path: String) -> Result<()>`
- `get_file_preview(manager: State<Manager>, path: String, lines?: Number) -> Result<String>`
- `get_file_operation_history(manager: State<Manager>) -> Result<Vec<FileOperation>>`
- `undo_file_operation(manager: State<Manager>) -> Result<()>`

### File Watcher
- `watch_file(manager: State<Manager>, path: String, recursive: bool) -> Result<()>`
- `unwatch_file(manager: State<Manager>, path: String) -> Result<()>`
- `start_file_watcher(manager: State<Manager>, path: String, recursive: bool) -> Result<()>`
- `stop_file_watcher(manager: State<Manager>, path: String) -> Result<()>`
- `get_watched_paths(manager: State<Manager>) -> Result<Vec<String>>`
- `get_file_watch_events(manager: State<Manager>, since?: Timestamp) -> Result<Vec<FileWatchEvent>>`
- `clear_file_watch_buffer(manager: State<Manager>) -> Result<()>`
- `get_file_watcher_config(manager: State<Manager>) -> Result<FileWatchConfig>`
- `update_file_watcher_config(manager: State<Manager>, config: FileWatchConfig) -> Result<()>`

### Search Operations
- `search_project(manager: State<Manager>, query: String, options?: SearchOptions) -> Result<SearchResults>`
- `search_files(manager: State<Manager>, pattern: String, path?: String) -> Result<Vec<FileMatch>>`
- `search_text(manager: State<Manager>, text: String, options?: SearchOptions) -> Result<Vec<TextMatch>>`
- `search_with_highlights(manager: State<Manager>, query: String, file_path: String) -> Result<HighlightedResults>`
- `replace_in_files(manager: State<Manager>, search: String, replace: String, files: Vec<String>) -> Result<ReplaceResults>`
- `save_search(manager: State<Manager>, name: String, query: String, options?: SearchOptions) -> Result<()>`
- `load_saved_search(manager: State<Manager>, name: String) -> Result<SavedSearch>`
- `get_saved_searches(manager: State<Manager>) -> Result<Vec<SavedSearch>>`
- `get_search_history(manager: State<Manager>, limit?: Number) -> Result<Vec<SearchHistoryEntry>>`
- `clear_search_cache(manager: State<Manager>) -> Result<()>`

### Git Operations
- `git_status(manager: State<Manager>) -> Result<GitStatusResult>`
- `git_stage(path: String, manager: State<Manager>) -> Result<()>`
- `git_unstage(path: String, manager: State<Manager>) -> Result<()>`
- `git_stage_all(manager: State<Manager>) -> Result<()>`
- `git_unstage_all(manager: State<Manager>) -> Result<()>`
- `git_commit(message: String, manager: State<Manager>) -> Result<()>`
- `git_push(manager: State<Manager>) -> Result<()>`
- `git_pull(manager: State<Manager>) -> Result<()>`
- `git_diff(path: String, staged: bool, manager: State<Manager>) -> Result<String>`
- `get_git_branch_info(manager: State<Manager>) -> Result<BranchInfo>`
- `has_git_integration(manager: State<Manager>) -> Result<bool>`
- `has_uncommitted_changes(manager: State<Manager>) -> Result<bool>`
- `is_git_ignored(path: String, manager: State<Manager>) -> Result<bool>`
- `get_file_git_status(path: String, manager: State<Manager>) -> Result<FileGitStatus>`
- `get_all_git_statuses(paths: Vec<String>, manager: State<Manager>) -> Result<Map<String, FileGitStatus>>`

### Plugin Management
- `list_plugins(manager: State<Manager>) -> Result<Vec<PluginInfo>>`
- `get_plugin_metadata(manager: State<Manager>, plugin_id: String) -> Result<PluginMetadata>`
- `execute_plugin_command(manager: State<Manager>, plugin_id: String, command: String, args?: Value) -> Result<Value>`
- `get_plugin_commands(plugin_id: String) -> Result<Vec<PluginCommand>>`
- `register_plugin_commands(plugin_id: String, commands: Vec<PluginCommand>) -> Result<()>`
- `list_registered_plugins() -> Result<Vec<PluginMetadata>>`

### Module Management
- `list_modules() -> Result<Vec<ModuleInfo>>`
- `install_module(module_id: String, version?: String) -> Result<()>`
- `uninstall_module(module_id: String) -> Result<()>`
- `enable_module(module_id: String) -> Result<()>`
- `get_module(module_id: String) -> Result<ModuleInfo>`
- `get_module_config(module_id: String) -> Result<ModuleConfig>`
- `update_module_config(module_id: String, config: ModuleConfig) -> Result<()>`
- `execute_module_command(module_id: String, command: String, args?: Value) -> Result<Value>`
- `get_module_commands(module_id: String) -> Result<Vec<ModuleCommand>>`
- `create_module_template(name: String, template_type: String) -> Result<ModulePath>`
- `validate_module_manifest(manifest: Value) -> Result<bool>`
- `search_module_registry(query: String) -> Result<Vec<ModuleRegistryEntry>>`
- `get_module_details_from_registry(module_id: String) -> Result<ModuleDetails>`
- `module_list() -> Result<Vec<ModuleInfo>>`
- `module_enable(module_id: String) -> Result<()>`
- `module_execute(module_id: String, command: String, args?: Value) -> Result<Value>`
- `module_scan() -> Result<Vec<ModuleInfo>>`

### Command History
- `get_command_history(pane_id?: String, limit?: Number) -> Result<Vec<CommandHistoryEntry>>`
- `search_command_history(pattern: String, pane_id?: String) -> Result<Vec<CommandHistoryEntry>>`
- `search_command_history_advanced(query: CommandHistoryQuery) -> Result<Vec<CommandHistoryEntry>>`
- `get_command_stats(pane_id?: String) -> Result<CommandStats>`
- `get_command_suggestions(prefix: String, pane_id?: String) -> Result<Vec<String>>`
- `cleanup_command_history(days_to_keep: Number) -> Result<Number>`
- `export_command_history(format: String, pane_id?: String) -> Result<String>`
- `import_command_history(data: String, format: String) -> Result<Number>`

### Tmux Integration
- `tmux_create_session(name: String) -> Result<TmuxSession>`
- `tmux_list_sessions() -> Result<Vec<TmuxSession>>`
- `tmux_create_pane(session_id: String, split_type?: String) -> Result<TmuxPane>`
- `tmux_kill_pane(pane_id: String) -> Result<()>`
- `tmux_send_keys(pane_id: String, keys: String) -> Result<()>`
- `tmux_capture_pane(pane_id: String, lines?: Number) -> Result<String>`
- `tmux_resize_pane(pane_id: String, width: Number, height: Number) -> Result<()>`
- `tmux_split_pane(pane_id: String, direction: String, size?: Number) -> Result<TmuxPane>`

### Neovim Integration
- `create_neovim_editor(file_path?: String) -> Result<NeovimInstance>`
- `nvim_create_instance(instance_id: String, embedded: bool) -> Result<()>`
- `nvim_execute_command(instance_id: String, command: String) -> Result<Value>`
- `nvim_eval(instance_id: String, expression: String) -> Result<Value>`
- `nvim_get_buffer(instance_id: String, buffer_id?: Number) -> Result<Buffer>`
- `nvim_set_buffer_content(instance_id: String, buffer_id: Number, content: Vec<String>) -> Result<()>`
- `nvim_open_file(instance_id: String, file_path: String) -> Result<()>`
- `nvim_get_mode(instance_id: String) -> Result<NeovimMode>`
- `nvim_close_instance(instance_id: String) -> Result<()>`
- `execute_neovim_command(instance_id: String, command: String) -> Result<Value>`
- `get_neovim_buffer(instance_id: String) -> Result<Buffer>`

### Trash/Recycle Bin
- `list_trash(manager: State<Manager>) -> Result<Vec<TrashItem>>`
- `empty_trash(manager: State<Manager>) -> Result<()>`
- `restore_file_from_trash(item_id: String, manager: State<Manager>) -> Result<Value>`
- `restore_multiple_files_from_trash(item_ids: Vec<String>, manager: State<Manager>) -> Result<RestoreResults>`
- `get_trash_stats(manager: State<Manager>) -> Result<TrashStats>`
- `get_recent_trash(limit: usize, manager: State<Manager>) -> Result<Vec<TrashItem>>`
- `find_trashed_item(item_id: String, manager: State<Manager>) -> Result<Option<TrashItem>>`
- `search_trash(query: String, manager: State<Manager>) -> Result<Vec<TrashItem>>`
- `get_trash_from_directory(path: String, manager: State<Manager>) -> Result<Vec<TrashItem>>`
- `cleanup_old_trash(days: i64, manager: State<Manager>) -> Result<Vec<Value>>`
- `get_trash_location() -> Option<String>`

### Test Management
- `create_test_suite_v2(name: String, framework: String) -> Result<TestSuite>`
- `create_test_run_v2(suite_id: String, trigger: String) -> Result<TestRun>`
- `create_test_result_v2(run_id: String, result: TestResult) -> Result<()>`
- `get_test_results_for_run_v2(run_id: String) -> Result<Vec<TestResult>>`
- `get_test_run_summary(run_id: String) -> Result<TestRunSummary>`
- `get_test_run_summaries_v2(suite_id?: String, limit?: Number) -> Result<Vec<TestRunSummary>>`
- `get_test_failure_trends_v2(suite_id?: String, days?: Number) -> Result<FailureTrends>`
- `parse_and_store_test_output(output: String, parser_type: String) -> Result<TestParseResult>`
- `get_supported_test_frameworks() -> Result<Vec<TestFrameworkInfo>>`
- `get_test_results(run_id: String) -> Result<Vec<TestResult>>`
- `get_test_runs(suite_id?: String) -> Result<Vec<TestRun>>`
- `get_test_statistics(suite_id?: String) -> Result<TestStatistics>`
- `cleanup_test_data(days_to_keep: Number) -> Result<CleanupResult>`

### Layout Management
- `create_tab(layout_id: String, name?: String) -> Result<Tab>`
- `close_tab(tab_id: String) -> Result<()>`
- `switch_tab(tab_id: String) -> Result<()>`
- `get_tabs(layout_id: String) -> Result<Vec<Tab>>`
- `update_layout(layout_id: String, layout_data: Value) -> Result<()>`
- `get_unified_layout(layout_id: String) -> Result<UnifiedLayout>`
- `create_unified_layout_pane(parent_id: String, pane_type: String, direction?: String) -> Result<UnifiedPane>`
- `close_unified_layout_pane(pane_id: String) -> Result<()>`
- `split_unified_layout_pane(pane_id: String, direction: String, pane_type: String) -> Result<UnifiedPane>`
- `resize_unified_layout_pane(pane_id: String, size: Number) -> Result<()>`
- `get_unified_layout_leaf_panes(layout_id: String) -> Result<Vec<LeafPane>>`

### System Operations
- `get_current_dir() -> Result<String>`
- `get_available_shells() -> Result<Vec<ShellInfo>>`
- `get_system_metrics(state: State<MetricsState>) -> Result<SystemMetrics>`
- `persist_state(manager: State<Manager>) -> Result<Value>`
- `get_setting(key: String) -> Result<Value>`
- `set_setting(key: String, value: Value) -> Result<()>`

### Update Management
- `check_for_update<R: Runtime>(app: AppHandle<R>) -> Result<UpdateInfo>`
- `download_and_install_update<R: Runtime>(app: AppHandle<R>) -> Result<()>`
- `get_current_version(app: AppHandle) -> String`
- `generate_updater_keys() -> Result<(String, String)>`

### Orchestrator (claude-flow)
- `orchestrator_execute(action: String, params?: Value) -> Result<Value>`
- `orchestrator_subscribe(event_types: Vec<String>) -> Result<()>`

## 2. Manager Client API (TypeScript/JavaScript)

The Manager Client provides a TypeScript interface for interacting with the Tauri backend:

### Actions
```typescript
type Action = 
  // Session management
  | { type: 'CreateSession'; name: string }
  | { type: 'DeleteSession'; session_id: string }
  | { type: 'SaveSession'; session_id: string; name?: string }
  
  // Pane management
  | { type: 'CreatePane'; session_id: string; pane_type?: PaneType; command?: string; shell_type?: string; name?: string }
  | { type: 'ClosePane'; pane_id: string }
  | { type: 'ResizePane'; pane_id: string; width: number; height: number }
  | { type: 'RenamePane'; pane_id: string; name: string }
  
  // Terminal operations
  | { type: 'SendInput'; pane_id: string; data: string }
  | { type: 'SendKeys'; pane_id: string; keys: string }
  | { type: 'RunCommand'; pane_id: string; command: string }
  | { type: 'GetPaneOutput'; pane_id: string; lines?: number }
  | { type: 'ClearPane'; pane_id: string }
  
  // File operations
  | { type: 'CreateFile'; path: string; content?: string }
  | { type: 'OpenFile'; path: string }
  | { type: 'SaveFile'; path: string; content: string }
  | { type: 'CreateDirectory'; path: string }
  | { type: 'DeletePath'; path: string; permanent?: boolean }
  | { type: 'RenamePath'; old_path: string; new_name: string }
  | { type: 'CopyPath'; source: string; destination: string }
  | { type: 'MovePath'; source: string; destination: string }
  | { type: 'MoveFiles'; files: string[]; destination: string }
  | { type: 'CopyFiles'; files: string[]; destination: string }
  
  // Search operations
  | { type: 'SearchProject'; query: string; options?: SearchOptions }
  | { type: 'SearchInFile'; path: string; query: string; options?: SearchOptions }
  | { type: 'ReplaceInFile'; path: string; search: string; replace: string; options?: SearchOptions }
  
  // Plugin management
  | { type: 'LoadPlugin'; id: string; config?: Record<string, unknown> }
  | { type: 'UnloadPlugin'; id: string }
  | { type: 'ExecutePluginCommand'; plugin_id: string; command: string; args?: Record<string, unknown> }
  
  // Terminal streaming
  | { type: 'CreateStreamingTerminal'; terminal_id: string; shell?: string; rows?: number; cols?: number }
  | { type: 'ResizeStreamingTerminal'; terminal_id: string; rows: number; cols: number }
  | { type: 'StopStreamingTerminal'; terminal_id: string };
```

### Events
```typescript
type ManagerEvent = 
  // Session events
  | { type: 'SessionCreated'; session_id: string; name: string }
  | { type: 'SessionDeleted'; session_id: string }
  | { type: 'SessionRenamed'; session_id: string; new_name: string }
  
  // Pane events  
  | { type: 'PaneCreated'; pane_id: string; session_id: string }
  | { type: 'PaneClosed'; pane_id: string }
  | { type: 'PaneResized'; pane_id: string; width: number; height: number }
  | { type: 'PaneFocused'; pane_id: string }
  | { type: 'PaneOutput'; pane_id: string; data: string }
  
  // File events
  | { type: 'FileCreated'; path: string }
  | { type: 'FileModified'; path: string }
  | { type: 'FileDeleted'; path: string }
  | { type: 'FileRenamed'; old_path: string; new_path: string }
  | { type: 'FileSaved'; path: string }
  | { type: 'FileRead'; path: string; size: number }
  
  // File watch events
  | { type: 'FileWatchStarted'; path: string; recursive: boolean }
  | { type: 'FileWatchStopped'; path: string }
  | { type: 'FileChanged'; path: string; change_type: string }
  
  // Plugin events
  | { type: 'PluginLoaded'; plugin_id: string }
  | { type: 'PluginUnloaded'; plugin_id: string }
  | { type: 'PluginEvent'; plugin_id: string; event_type: string; data?: Record<string, unknown> }
  
  // Custom events
  | { type: 'Custom'; event_type: string; data?: Record<string, unknown> };
```

## 3. JSON-RPC 2.0 API (Muxd Server)

The Muxd server provides a JSON-RPC 2.0 interface over WebSocket (default port 3333):

### Session Methods
- `session.create` - Create a new session
- `session.list` - List all sessions
- `session.delete` - Delete a session

### Pane Methods
- `pane.create` - Create a new pane
- `pane.write` - Write data to a pane
- `pane.resize` - Resize a pane
- `pane.read` - Read output from a pane
- `pane.kill` - Kill a pane
- `pane.info` - Get pane information
- `pane.list` - List panes in a session
- `pane.update_title` - Update pane title
- `pane.update_working_dir` - Update pane working directory
- `pane.search` - Search pane output

### State Methods
- `state.save` - Save current state
- `state.restore` - Restore saved state

### Server Methods
- `server_status` - Get server status
- `server_shutdown` - Shutdown the server

## 4. WebSocket APIs

### Manager WebSocket Server (Port 50505)
Provides real-time event streaming and JSON-RPC interface for the Manager.

### Terminal IPC Events
The terminal IPC service uses Tauri events for real-time terminal communication:
- `terminal:output` - Terminal output data (base64 encoded)
- `terminal:exit` - Terminal process exit
- `terminal:error` - Terminal errors
- `terminal:state` - Terminal state changes

## 5. REST API Endpoints

### AI Streaming API
- `POST /api/ai/stream` - Stream AI responses for code assistance
  - Request body: `{ filePath, content, selection, model, prompt }`
  - Response: Server-sent events stream

### Metrics API
- `GET /api/metrics` - Get system metrics
  - Response: JSON with CPU, memory, disk, network, process metrics

## 6. Cursor API (Muxd Protocol Extension)

Enhanced cursor tracking and session management:
- Cursor position tracking across panes
- Session classification (development, infrastructure, documentation, monitoring)
- Terminal type detection
- Process lifecycle management

## 7. Public Module Exports

### Manager Client (`/lib/api/manager-client.ts`)
- `ManagerClient` class
- `managerClient` singleton instance
- Type exports: `Session`, `Pane`, `PaneType`, `PluginInfo`, `PluginMetadata`, `CommandHistoryEntry`, `Action`, `ManagerEvent`, `SearchOptions`

### Terminal IPC Service (`/lib/services/terminal-ipc.ts`)
- `terminalIPC` singleton instance
- Type exports: `TerminalMetadata`, `TerminalState`, `ProcessInfo`, `ProcessStatus`, `TerminalHealth`, `HealthStatus`, `TerminalEvent`, `CreateTerminalOptions`

## API Authentication & Security

- Tauri commands are secured through the Tauri IPC bridge
- WebSocket connections are localhost-only by default
- File operations respect OS-level permissions
- Plugin execution is sandboxed

## Error Codes

Standard JSON-RPC 2.0 error codes are used:
- `-32700` - Parse error
- `-32600` - Invalid Request
- `-32601` - Method not found
- `-32602` - Invalid params
- `-32603` - Internal error

Custom error codes:
- `1000` - Session not found
- `1001` - Pane not found
- `1002` - Plugin not found
- `1003` - File not found
- `1004` - Permission denied
- `1005` - Terminal error
- `1006` - Git operation failed