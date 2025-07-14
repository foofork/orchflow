# Muxd Backend Timestamp Parsing Implementation

## Overview

This document describes the implementation of proper timestamp parsing from muxd backend responses in the OrchFlow desktop application.

## Implementation Details

### 1. Backend (Rust) Changes

#### Timestamp Parsing Helper (`src-tauri/src/mux_backend/muxd_backend.rs`)

Added a helper function to parse timestamps from various formats that muxd might send:

```rust
/// Parse timestamp from various formats that muxd might send
fn parse_timestamp(value: &Value) -> Option<chrono::DateTime<chrono::Utc>> {
    if let Some(s) = value.as_str() {
        // Try ISO/RFC3339 format first
        chrono::DateTime::parse_from_rfc3339(s)
            .ok()
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .or_else(|| {
                // Try parsing as Unix timestamp string
                s.parse::<i64>().ok().and_then(|ts| {
                    let ts_ms = if ts > 1_000_000_000_000 { ts } else { ts * 1000 };
                    chrono::DateTime::from_timestamp_millis(ts_ms)
                })
            })
    } else if let Some(n) = value.as_i64() {
        // Unix timestamp as number
        let ts_ms = if n > 1_000_000_000_000 { n } else { n * 1000 };
        chrono::DateTime::from_timestamp_millis(ts_ms)
    } else if let Some(obj) = value.as_object() {
        // Timestamp object with secs/nanos fields
        let secs = obj.get("secs")
            .or_else(|| obj.get("secs_since_epoch"))
            .and_then(|s| s.as_i64())?;
        let nanos = obj.get("nanos")
            .or_else(|| obj.get("nanos_since_epoch"))
            .and_then(|n| n.as_u64())
            .unwrap_or(0);
        chrono::DateTime::from_timestamp(secs, nanos as u32)
    } else {
        None
    }
}
```

This helper handles:
- ISO/RFC3339 formatted strings
- Unix timestamps as strings (seconds or milliseconds)
- Unix timestamps as numbers (seconds or milliseconds)
- Objects with `secs`/`nanos` or `secs_since_epoch`/`nanos_since_epoch` fields

#### Session List Parsing

Updated the `list_sessions` method to use the timestamp parser:

```rust
// Parse created_at timestamp from response
let created_at = session_data
    .get("created_at")
    .or_else(|| session_data.get("created"))
    .and_then(Self::parse_timestamp)
    .unwrap_or_else(chrono::Utc::now);
```

#### Tmux Backend Update

Also updated the tmux backend to parse timestamps from tmux sessions:

```rust
// Parse created timestamp - tmux typically provides Unix timestamps
let created_at = tmux_session.created.parse::<i64>()
    .ok()
    .and_then(chrono::DateTime::from_timestamp)
    .unwrap_or_else(chrono::Utc::now);
```

### 2. Frontend (TypeScript) Changes

#### Enhanced Timestamp Parser (`src/lib/utils/timestamp.ts`)

Enhanced the `parseMuxdTimestamp` function to handle all the same formats as the backend:

```typescript
export function parseMuxdTimestamp(value: unknown): Date | null {
  if (!value) return null;
  
  // Handle different timestamp formats from muxd
  if (typeof value === 'string') {
    // Check if it looks like a Unix timestamp string first (all digits)
    if (/^\d+$/.test(value)) {
      const numValue = parseInt(value, 10);
      const timestamp = numValue > 1e10 ? numValue : numValue * 1000;
      return new Date(timestamp);
    }
    
    // Otherwise try to parse as ISO string
    return parseTimestamp(value);
  } else if (typeof value === 'number') {
    // Unix timestamp (seconds or milliseconds)
    const timestamp = value > 1e10 ? value : value * 1000;
    return new Date(timestamp);
  } else if (value instanceof Date) {
    return value;
  } else if (typeof value === 'object' && value !== null) {
    // Handle object with timestamp properties (e.g., { secs: number, nanos: number })
    const obj = value as any;
    if ('secs' in obj || 'secs_since_epoch' in obj) {
      const secs = obj.secs || obj.secs_since_epoch || 0;
      const nanos = obj.nanos || obj.nanos_since_epoch || 0;
      // Convert to milliseconds
      const ms = secs * 1000 + Math.floor(nanos / 1_000_000);
      return new Date(ms);
    }
  }
  
  console.warn('Unknown timestamp format:', value);
  return null;
}
```

#### Mux Event Handler Service (`src/lib/services/mux-event-handler.ts`)

Created a new service to handle mux backend events with proper timestamp parsing:

```typescript
export interface MuxEventHandlers {
  onPaneOutput?: (paneId: string, data: string, timestamp: Date) => void;
  onPaneExit?: (paneId: string, exitCode: number | null, timestamp: Date) => void;
  onSessionCreated?: (sessionId: string, name: string, timestamp: Date) => void;
  onPaneCreated?: (paneId: string, sessionId: string, timestamp: Date) => void;
  onMuxError?: (error: string, context: string | null, timestamp: Date) => void;
}

class MuxEventHandlerService {
  async startListening(handlers: MuxEventHandlers): Promise<void> {
    const unlisten = await listen<MuxUIEvent>('mux-event', (event) => {
      const payload = event.payload;
      
      // Parse timestamp from backend
      const timestamp = parseMuxdTimestamp(payload.timestamp);
      if (!timestamp) {
        console.error('Invalid timestamp in mux event:', payload.timestamp);
        return;
      }

      // Handle different event types...
    });
  }
}
```

#### Terminal IPC Service Updates

Updated the existing terminal IPC service to use the timestamp parser:

```typescript
// Parse timestamps from backend response
if (metadata.created_at) {
  const parsedDate = parseMuxdTimestamp(metadata.created_at);
  if (parsedDate) {
    metadata.created_at = parsedDate.toISOString();
  }
}
```

### 3. Example Usage

Created `MuxTerminalExample.svelte` to demonstrate how to use the mux event handler:

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { muxEventHandler } from '$lib/services/mux-event-handler';
  
  let unsubscribe: (() => void) | null = null;
  
  onMount(() => {
    unsubscribe = muxEventHandler.subscribe({
      onPaneOutput: (paneId, data, timestamp) => {
        console.log(`Pane ${paneId} output at ${timestamp}: ${data}`);
      },
      onPaneExit: (paneId, exitCode, timestamp) => {
        console.log(`Pane ${paneId} exited at ${timestamp}`);
      }
    });
  });
  
  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe();
    }
  });
</script>
```

## Testing

### Unit Tests

1. **Timestamp Parsing Tests** (`src/lib/utils/__tests__/timestamp.test.ts`)
   - Tests for ISO string parsing
   - Tests for Unix timestamp parsing (seconds and milliseconds)
   - Tests for object format with secs/nanos
   - Tests for error handling

2. **Mux Event Handler Tests** (`src/lib/services/__tests__/mux-event-handler.test.ts`)
   - Tests for all event types
   - Tests for timestamp parsing in events
   - Tests for error handling
   - Tests for subscription/unsubscription

### Backend Tests

Updated backend test files to include timestamp validation in the muxd backend tests.

## Files Modified

1. `/workspaces/orchflow/desktop/src/lib/utils/timestamp.ts` - Enhanced timestamp parser
2. `/workspaces/orchflow/desktop/src/lib/utils/__tests__/timestamp.test.ts` - Added comprehensive tests
3. `/workspaces/orchflow/desktop/src/lib/services/mux-event-handler.ts` - New service for handling mux events
4. `/workspaces/orchflow/desktop/src/lib/services/__tests__/mux-event-handler.test.ts` - Tests for the new service
5. `/workspaces/orchflow/desktop/src/lib/services/terminal-ipc.ts` - Updated to use timestamp parser
6. `/workspaces/orchflow/desktop/src-tauri/src/mux_backend/muxd_backend.rs` - Added timestamp parsing helper
7. `/workspaces/orchflow/desktop/src-tauri/src/mux_backend/tmux_backend.rs` - Updated to parse tmux timestamps
8. `/workspaces/orchflow/desktop/src/lib/components/MuxTerminalExample.svelte` - Example component

## Key Features

1. **Robust Parsing**: Handles multiple timestamp formats that muxd might send
2. **Type Safety**: Full TypeScript types for events and handlers
3. **Error Handling**: Graceful handling of invalid timestamps with console warnings
4. **Consistent API**: Same timestamp parsing logic on both frontend and backend
5. **Event-Driven**: Uses Tauri's event system for real-time updates
6. **Easy Integration**: Simple subscribe/unsubscribe pattern for components

## Future Improvements

1. Add timezone support for displaying timestamps in user's local timezone
2. Add caching of parsed timestamps to improve performance
3. Add more detailed error reporting for debugging
4. Consider adding a timestamp format configuration option