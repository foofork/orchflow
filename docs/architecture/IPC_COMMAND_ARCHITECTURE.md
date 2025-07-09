# IPC Command Architecture in orchflow

## Overview

orchflow uses Tauri's IPC (Inter-Process Communication) system to bridge the frontend UI and backend services. This document describes the command structure, data flow, and patterns used for reliable frontend-backend communication.

## Core Components

### Frontend Side
- **Tauri API**: `@tauri-apps/api` for invoking commands
- **Type Definitions**: Shared TypeScript interfaces
- **Error Handling**: Typed error responses
- **Event Listeners**: For backend-initiated updates

### Backend Side
- **Command Handlers**: `#[tauri::command]` decorated functions
- **Command Registry**: Organized by feature modules
- **State Access**: Via Tauri's state management
- **Event Emission**: Push updates to frontend

## Architecture Diagram

```
┌─────────────────────────────────────────────┐
│           Frontend (TypeScript)              │
│                                             │
│  ┌─────────────┐      ┌─────────────────┐  │
│  │  UI Action  │      │ Event Listeners │  │
│  └──────┬──────┘      └────────▲────────┘  │
│         │ invoke()              │ listen()  │
│  ┌──────▼──────────────────────┴────────┐  │
│  │          Tauri IPC Bridge            │  │
│  └──────┬──────────────────────▲────────┘  │
└─────────┼──────────────────────┼────────────┘
          │ JSON/Binary          │ Events
┌─────────┼──────────────────────┼────────────┐
│  ┌──────▼──────────────────────┴────────┐  │
│  │         Command Router               │  │
│  └──────┬─────────┬──────────┬─────────┘  │
│         │         │          │              │
│    ┌────▼───┐ ┌──▼───┐ ┌───▼────┐         │
│    │Terminal│ │ File │ │ Search │ ...      │
│    │Commands│ │ Cmds │ │  Cmds  │         │
│    └────┬───┘ └──┬───┘ └───┬────┘         │
│         │        │         │               │
│    ┌────▼────────▼─────────▼────┐          │
│    │      Manager / Services    │          │
│    └────────────────────────────┘          │
│            Backend (Rust)                   │
└─────────────────────────────────────────────┘
```

## Command Categories

### Organization Structure

```
src-tauri/src/
├── terminal_stream_commands.rs    # Terminal operations
├── file_commands.rs              # File system operations
├── search_commands.rs            # Search functionality
├── git_commands.rs              # Git integration
├── unified_state_commands.rs    # State management
├── manager/commands.rs          # Orchestration commands
└── main.rs                      # Command registration
```

## Command Patterns

### Basic Command Structure

```rust
#[tauri::command]
async fn create_file(
    path: String,
    content: String,
    state: State<'_, Arc<Manager>>,
) -> Result<FileInfo, CommandError> {
    // Validate inputs
    validate_path(&path)?;
    
    // Execute operation
    let file_info = state.file_service
        .create_file(&path, &content)
        .await
        .map_err(|e| CommandError::FileOperation(e.to_string()))?;
    
    // Return typed result
    Ok(file_info)
}
```

### Frontend Invocation

```typescript
// Type-safe command invocation
interface CreateFileArgs {
    path: string;
    content: string;
}

interface FileInfo {
    path: string;
    size: number;
    created: number;
}

async function createFile(args: CreateFileArgs): Promise<FileInfo> {
    try {
        return await invoke<FileInfo>('create_file', args);
    } catch (error) {
        handleCommandError(error);
        throw error;
    }
}
```

## Data Serialization

### JSON for Structured Data

Most commands use JSON serialization:
```rust
#[derive(Serialize, Deserialize)]
pub struct TerminalConfig {
    pub shell: Option<String>,
    pub cwd: Option<String>,
    pub env: HashMap<String, String>,
}
```

### Binary Data Handling

For terminal output and file contents:
```rust
#[tauri::command]
async fn get_terminal_output(
    terminal_id: String,
    state: State<'_, TerminalManager>,
) -> Result<String, CommandError> {
    let output = state.get_output(&terminal_id).await?;
    // Encode binary data as Base64
    Ok(base64::encode(output))
}
```

## Error Handling

### Typed Error Responses

```rust
#[derive(Debug, Serialize)]
pub enum CommandError {
    NotFound(String),
    PermissionDenied(String),
    InvalidInput(String),
    Internal(String),
}

impl From<std::io::Error> for CommandError {
    fn from(err: std::io::Error) -> Self {
        match err.kind() {
            io::ErrorKind::NotFound => CommandError::NotFound(err.to_string()),
            io::ErrorKind::PermissionDenied => CommandError::PermissionDenied(err.to_string()),
            _ => CommandError::Internal(err.to_string()),
        }
    }
}
```

### Frontend Error Handling

```typescript
interface CommandError {
    type: 'NotFound' | 'PermissionDenied' | 'InvalidInput' | 'Internal';
    message: string;
}

function handleCommandError(error: unknown): void {
    if (isCommandError(error)) {
        switch (error.type) {
            case 'NotFound':
                showNotification('File not found', 'error');
                break;
            case 'PermissionDenied':
                showNotification('Permission denied', 'error');
                break;
            default:
                showNotification('Operation failed', 'error');
        }
    }
}
```

## Event System

### Backend Event Emission

```rust
// Emit typed events to frontend
app_handle.emit_all("terminal:output", TerminalOutputEvent {
    terminal_id: id.clone(),
    data: base64::encode(&output),
})?;

app_handle.emit_all("file:changed", FileChangedEvent {
    path: path.to_string(),
    change_type: ChangeType::Modified,
})?;
```

### Frontend Event Subscription

```typescript
import { listen } from '@tauri-apps/api/event';

// Listen for terminal output
const unlisten = await listen<TerminalOutputEvent>('terminal:output', (event) => {
    const { terminal_id, data } = event.payload;
    const decoded = atob(data); // Decode Base64
    updateTerminalDisplay(terminal_id, decoded);
});

// Clean up when done
onDestroy(() => unlisten());
```

## Performance Patterns

### Command Batching

For operations that might be called frequently:
```rust
#[tauri::command]
async fn batch_file_operations(
    operations: Vec<FileOperation>,
    state: State<'_, Arc<Manager>>,
) -> Result<Vec<OperationResult>, CommandError> {
    // Process in parallel where possible
    let results = futures::future::join_all(
        operations.into_iter().map(|op| async {
            process_operation(op, &state).await
        })
    ).await;
    
    Ok(results)
}
```

### Streaming Large Data

For large datasets, use events instead of return values:
```rust
#[tauri::command]
async fn search_project_streaming(
    query: String,
    app: tauri::AppHandle,
) -> Result<String, CommandError> {
    let search_id = Uuid::new_v4().to_string();
    
    // Spawn background task
    tokio::spawn(async move {
        let mut searcher = ProjectSearcher::new(&query);
        while let Some(result) = searcher.next().await {
            app.emit_all("search:result", SearchResultEvent {
                search_id: search_id.clone(),
                result,
            }).ok();
        }
        app.emit_all("search:complete", SearchCompleteEvent {
            search_id: search_id.clone(),
        }).ok();
    });
    
    Ok(search_id)
}
```

## Best Practices

1. **Type Safety**: Always use typed parameters and returns
2. **Validation**: Validate inputs at the command boundary
3. **Error Context**: Provide meaningful error messages
4. **Async by Default**: Use async commands for I/O operations
5. **Event for Push**: Use events for backend-initiated updates
6. **Binary Encoding**: Base64 encode binary data
7. **Batch When Possible**: Reduce IPC overhead

## Security Considerations

- Validate all paths to prevent directory traversal
- Sanitize user inputs before processing
- Use Tauri's permission system for sensitive operations
- Avoid exposing internal system details in errors

## Future Enhancements

- Command middleware for logging/metrics
- Request/response correlation IDs
- Command versioning for backwards compatibility
- Performance profiling integration

The IPC command architecture provides a robust, type-safe bridge between orchflow's frontend and backend while maintaining security and performance.