# Core Manager API Implementation

This document describes the newly implemented Core Manager API methods that were previously missing from the backend.

## Implemented Methods

### 1. Plugin Command Execution

#### `execute_plugin_command`
- **Purpose**: Execute commands through loaded plugins
- **Parameters**: 
  - `plugin_id: String` - The ID of the plugin to execute
  - `command: String` - The command to execute
  - `params: Option<Value>` - Optional parameters for the command
- **Returns**: `Result<Value>` - The result of the command execution
- **Usage**: Allows frontend to execute plugin-specific commands

#### `register_plugin_commands`
- **Purpose**: Register available commands for a plugin
- **Parameters**: 
  - `plugin_id: String` - The plugin ID
  - `metadata: PluginMetadata` - Plugin metadata including available commands
- **Returns**: `Result<()>`

#### `get_plugin_commands`
- **Purpose**: Get available commands for a specific plugin
- **Parameters**: 
  - `plugin_id: String` - The plugin ID
- **Returns**: `Result<Vec<PluginCommand>>` - List of available commands

#### `list_registered_plugins`
- **Purpose**: List all registered plugins
- **Returns**: `Result<Vec<PluginMetadata>>` - List of all registered plugins

### 2. Terminal Output Streaming

#### `get_output`
- **Purpose**: Get terminal output with optional streaming support
- **Parameters**:
  - `pane_id: String` - The pane ID to get output from
  - `lines: Option<u32>` - Number of lines to retrieve
  - `follow: Option<bool>` - Whether to follow/stream output
- **Returns**: `Result<TerminalOutput>` - Terminal content and metadata

#### `stream_terminal_output`
- **Purpose**: Start streaming terminal output updates
- **Parameters**:
  - `pane_id: String` - The pane ID to stream
  - `start_line: Option<u32>` - Starting line number
- **Returns**: `Result<String>` - Stream ID for tracking the stream
- **Events**: Emits `terminal-output-{stream_id}` events with new output

#### `stop_terminal_stream`
- **Purpose**: Stop an active terminal output stream
- **Parameters**:
  - `stream_id: String` - The stream ID to stop
- **Returns**: `Result<()>`

### 3. Tab Management Integration

#### `get_tabs`
- **Purpose**: Get all tabs for a session
- **Parameters**:
  - `session_id: String` - The session ID
- **Returns**: `Result<Vec<TabInfo>>` - List of tabs in the session

#### `create_tab`
- **Purpose**: Create a new tab
- **Parameters**:
  - `session_id: String` - The session ID
  - `title: Option<String>` - Tab title (optional)
  - `pane_type: Option<String>` - Type of pane to create (terminal, editor, etc.)
- **Returns**: `Result<TabInfo>` - Information about the created tab

#### `switch_tab`
- **Purpose**: Switch to a different tab
- **Parameters**:
  - `session_id: String` - The session ID
  - `tab_id: String` - The tab ID to switch to
- **Returns**: `Result<()>`

#### `close_tab`
- **Purpose**: Close a tab
- **Parameters**:
  - `tab_id: String` - The tab ID to close
- **Returns**: `Result<()>`

### 4. Neovim Editor Integration

#### `create_neovim_editor`
- **Purpose**: Create a new Neovim editor instance
- **Parameters**:
  - `session_id: String` - The session ID
  - `file_path: Option<String>` - File to open (optional)
- **Returns**: `Result<NeovimEditorInfo>` - Information about the created editor

#### `get_neovim_buffer`
- **Purpose**: Get the current buffer content from a Neovim instance
- **Parameters**:
  - `neovim_id: String` - The Neovim instance ID
- **Returns**: `Result<Value>` - Buffer content and metadata

#### `execute_neovim_command`
- **Purpose**: Execute a command in a Neovim instance
- **Parameters**:
  - `neovim_id: String` - The Neovim instance ID
  - `command: String` - The command to execute
- **Returns**: `Result<String>` - Command output

## Data Types

### `TerminalOutput`
```rust
pub struct TerminalOutput {
    pub pane_id: String,
    pub content: String,
    pub lines_returned: usize,
    pub has_more: bool,
    pub cursor_position: Option<CursorPosition>,
    pub follow: bool,
}
```

### `TabInfo`
```rust
pub struct TabInfo {
    pub id: String,
    pub session_id: String,
    pub title: String,
    pub pane_ids: Vec<String>,
    pub active_pane_id: Option<String>,
    pub is_active: bool,
    pub order: usize,
}
```

### `NeovimEditorInfo`
```rust
pub struct NeovimEditorInfo {
    pub pane_id: String,
    pub neovim_id: String,
    pub session_id: String,
    pub file_path: Option<String>,
    pub is_modified: bool,
}
```

### `PluginMetadata`
```rust
pub struct PluginMetadata {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub commands: Vec<PluginCommand>,
}
```

### `PluginCommand`
```rust
pub struct PluginCommand {
    pub name: String,
    pub description: String,
    pub parameters: Vec<PluginParameter>,
}
```

## Integration Points

### Plugin System
- The plugin command execution integrates with the existing plugin system in `src/manager/plugins.rs`
- Plugins must implement the `Plugin` trait with `handle_request` method
- Plugin registry is managed in memory with `once_cell::sync::Lazy`

### Terminal System
- Terminal output streaming uses existing `Action::GetPaneOutput` from the manager
- Integrates with the state manager for pane information
- Emits Tauri events for real-time updates

### Tab Management
- Currently treats each pane as a tab (1:1 mapping)
- Uses session state to track active panes
- Future enhancement: Support multiple panes per tab

### Neovim Integration
- Integrates with existing `NeovimManager` in `src/neovim.rs`
- Creates panes with `PaneType::Editor`
- Supports headless Neovim instances with RPC communication

## Files Modified

1. **Created**: `src/core_manager_commands.rs` - Main implementation
2. **Modified**: `src/lib.rs` - Added module export
3. **Modified**: `src/main.rs` - Registered new commands
4. **Modified**: `src/error/mod.rs` - Added `EditorError` and `StateError` variants
5. **Modified**: `Cargo.toml` - Added `once_cell` dependency

## Frontend Integration

The frontend can now use these commands through the Tauri API:

```javascript
// Execute plugin command
await invoke('execute_plugin_command', {
  pluginId: 'my-plugin',
  command: 'do-something',
  params: { key: 'value' }
});

// Get terminal output
const output = await invoke('get_output', {
  paneId: 'pane-123',
  lines: 100,
  follow: true
});

// Create new tab
const tab = await invoke('create_tab', {
  sessionId: 'session-123',
  title: 'My Tab',
  paneType: 'terminal'
});

// Create Neovim editor
const editor = await invoke('create_neovim_editor', {
  sessionId: 'session-123',
  filePath: '/path/to/file.js'
});
```

## Error Handling

All methods return `Result<T>` types with structured error information:
- `PluginError` - Plugin-related errors
- `TerminalError` - Terminal operation errors
- `EditorError` - Editor-related errors
- `StateError` - State management errors
- `ValidationError` - Input validation errors

## Future Enhancements

1. **Terminal Streaming**: Implement proper cancellation tokens for streams
2. **Tab Grouping**: Support multiple panes per tab
3. **Plugin Security**: Add permission system for plugin commands
4. **Performance**: Implement output buffering and pagination
5. **Events**: Add more granular event types for better frontend reactivity