# Muxd Protocol Specification v1.0

## Overview

Muxd (Multiplexer Daemon) is a high-performance terminal multiplexer designed specifically for orchflow. It provides a JSON-RPC 2.0 based protocol over WebSocket for managing terminal sessions, panes, and layouts.

## Design Goals

1. **Performance**: Sub-millisecond response times for common operations
2. **Simplicity**: Clean JSON-RPC protocol that's easy to implement
3. **Reliability**: Robust error handling and session persistence
4. **Extensibility**: Support for custom pane types and future features
5. **Security**: Authentication and authorization support

## Transport Layer

- **Protocol**: WebSocket (with optional Unix socket support)
- **Default Port**: 7070
- **Message Format**: JSON-RPC 2.0
- **Encoding**: UTF-8

## Authentication

### Connection Flow
```
1. Client connects to WebSocket
2. Server sends: {"method": "auth.challenge", "params": {"nonce": "..."}}
3. Client sends: {"method": "auth.response", "params": {"token": "...", "nonce": "..."}}
4. Server sends: {"result": {"authenticated": true, "session_id": "..."}}
```

## Core Methods

### Session Management

#### `session.create`
Creates a new session.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "session.create",
  "params": {
    "name": "main",
    "working_dir": "/home/user/project",
    "env": {
      "TERM": "xterm-256color"
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "session_id": "sess_123abc",
    "name": "main",
    "created_at": "2024-01-06T10:30:00Z"
  }
}
```

#### `session.list`
Lists all sessions.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "session.list",
  "params": {}
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "sessions": [
      {
        "session_id": "sess_123abc",
        "name": "main",
        "pane_count": 3,
        "created_at": "2024-01-06T10:30:00Z",
        "updated_at": "2024-01-06T11:45:00Z"
      }
    ]
  }
}
```

#### `session.delete`
Deletes a session and all its panes.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "session.delete",
  "params": {
    "session_id": "sess_123abc"
  }
}
```

### Pane Management

#### `pane.create`
Creates a new pane in a session.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "pane.create",
  "params": {
    "session_id": "sess_123abc",
    "pane_type": "terminal",
    "command": "/bin/zsh",
    "working_dir": "/home/user/project",
    "env": {
      "CUSTOM_VAR": "value"
    },
    "size": {
      "rows": 24,
      "cols": 80
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "pane_id": "pane_456def",
    "session_id": "sess_123abc",
    "pane_type": "terminal",
    "pid": 12345
  }
}
```

#### `pane.write`
Writes data to a pane (stdin).

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "pane.write",
  "params": {
    "pane_id": "pane_456def",
    "data": "ls -la\\n"
  }
}
```

#### `pane.resize`
Resizes a pane.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "pane.resize",
  "params": {
    "pane_id": "pane_456def",
    "size": {
      "rows": 30,
      "cols": 120
    }
  }
}
```

#### `pane.read`
Reads output from a pane (stdout/stderr).

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "pane.read",
  "params": {
    "pane_id": "pane_456def",
    "lines": 100,
    "from": "end"
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "result": {
    "data": "total 48\\ndrwxr-xr-x  6 user  staff   192 Jan  6 10:30 .\\n...",
    "cursor": {
      "row": 5,
      "col": 0
    }
  }
}
```

### Layout Management

#### `layout.set`
Sets the layout for a session.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 8,
  "method": "layout.set",
  "params": {
    "session_id": "sess_123abc",
    "layout": {
      "type": "split",
      "direction": "horizontal",
      "ratio": 0.5,
      "children": [
        {
          "type": "pane",
          "pane_id": "pane_456def"
        },
        {
          "type": "split",
          "direction": "vertical",
          "ratio": 0.7,
          "children": [
            {
              "type": "pane",
              "pane_id": "pane_789ghi"
            },
            {
              "type": "pane",
              "pane_id": "pane_012jkl"
            }
          ]
        }
      ]
    }
  }
}
```

## Event Notifications

The server sends events to subscribed clients for real-time updates.

### `pane.output`
Sent when a pane produces output.

```json
{
  "jsonrpc": "2.0",
  "method": "pane.output",
  "params": {
    "pane_id": "pane_456def",
    "data": "Hello, world!\\n",
    "timestamp": "2024-01-06T10:30:00.123Z"
  }
}
```

### `pane.exit`
Sent when a pane's process exits.

```json
{
  "jsonrpc": "2.0",
  "method": "pane.exit",
  "params": {
    "pane_id": "pane_456def",
    "exit_code": 0,
    "timestamp": "2024-01-06T10:35:00.456Z"
  }
}
```

### `session.changed`
Sent when session properties change.

```json
{
  "jsonrpc": "2.0",
  "method": "session.changed",
  "params": {
    "session_id": "sess_123abc",
    "changes": {
      "name": "renamed-session",
      "active_pane": "pane_789ghi"
    }
  }
}
```

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| -32700 | Parse error | Invalid JSON |
| -32600 | Invalid Request | Invalid JSON-RPC |
| -32601 | Method not found | Unknown method |
| -32602 | Invalid params | Invalid parameters |
| -32603 | Internal error | Server error |
| 1001 | Session not found | Session ID doesn't exist |
| 1002 | Pane not found | Pane ID doesn't exist |
| 1003 | Permission denied | Unauthorized operation |
| 1004 | Resource limit | Too many sessions/panes |
| 1005 | Invalid state | Operation not allowed in current state |

## Performance Targets

- **Pane creation**: < 10ms
- **Data write**: < 1ms
- **Data read**: < 1ms  
- **Layout change**: < 5ms
- **Session list**: < 1ms (up to 1000 sessions)

## Implementation Notes

1. **Buffering**: Implement intelligent output buffering to batch updates
2. **Compression**: Optional zlib compression for large data transfers
3. **Heartbeat**: Implement ping/pong for connection health monitoring
4. **Persistence**: Sessions should survive daemon restart
5. **Resource Limits**: Configurable limits on sessions, panes, and buffer sizes