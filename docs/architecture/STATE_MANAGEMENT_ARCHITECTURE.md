# State Management Architecture in orchflow

## Overview

orchflow uses a unified state management system that maintains a single source of truth across the entire application. This document describes how state flows between the Rust backend and TypeScript frontend.

## Core Components

### Backend (Rust)

- **StateManager**: Central state coordination and event dispatch
- **SimpleStateStore**: SQLite-based persistence layer
- **State Types**: Session, Pane, Layout, Settings, Metrics
- **Event System**: Real-time state change notifications

### Frontend (TypeScript)

- **Svelte Stores**: Reactive state containers
- **Manager Store**: Mirrors backend state
- **WebSocket Bridge**: Real-time state synchronization
- **Derived Stores**: Computed state values

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│         Frontend (Svelte Stores)         │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐  │
│  │Sessions │ │ Panes   │ │ Settings │  │
│  │ Store   │ │ Store   │ │  Store   │  │
│  └────┬────┘ └────┬────┘ └────┬─────┘  │
│       └───────────┴────────────┘        │
│                   │                      │
│          ┌────────▼────────┐            │
│          │  Manager Store  │            │
│          └────────┬────────┘            │
└───────────────────┼─────────────────────┘
                    │ WebSocket Events
┌───────────────────┼─────────────────────┐
│                   ▼                      │
│          ┌─────────────────┐            │
│          │  State Events   │            │
│          └────────┬────────┘            │
│                   │                      │
│          ┌────────▼────────┐            │
│          │  StateManager   │ ← Central  │
│          └────────┬────────┘   State    │
│                   │                      │
│  ┌────────────────┼────────────────┐    │
│  ▼                ▼                ▼    │
│ Session         Pane            Layout  │
│ State          State            State   │
│                                         │
│          ┌─────────────────┐            │
│          │ SimpleStateStore│ ← SQLite  │
│          └─────────────────┘            │
│           Backend (Rust)                │
└─────────────────────────────────────────┘
```

## State Flow

### State Updates (Frontend → Backend)

1. User action triggers store update
2. Store calls Tauri command
3. Backend StateManager processes change
4. State persisted to SQLite
5. Event broadcast to all subscribers

### State Synchronization (Backend → Frontend)

1. Backend state changes
2. StateManager emits typed event
3. WebSocket broadcasts to frontend
4. Manager store receives update
5. Svelte stores reactively update UI

## Key Design Decisions

### Unified State Management

All state flows through StateManager to ensure:
- Consistency across components
- Atomic updates
- Event ordering guarantees
- Simplified debugging

### Event-Driven Architecture

```rust
// Backend event emission
state_manager.emit_event(StateEvent::SessionCreated { 
    session_id, 
    session_data 
});

// Frontend subscription
managerStore.subscribe(state => {
    // React to state changes
});
```

### Persistence Strategy

- Immediate write for critical data (sessions, settings)
- Batched writes for high-frequency updates (metrics)
- Automatic recovery on startup
- Schema migrations for upgrades

## Implementation Examples

### Backend State Update

```rust
// Creating a new session
impl StateManager {
    pub async fn create_session(&self, name: String) -> Result<Session> {
        let session = Session::new(name);
        
        // Update in-memory state
        self.sessions.write().await.insert(session.id.clone(), session.clone());
        
        // Persist to database
        self.store.save_session(&session).await?;
        
        // Emit event for subscribers
        self.emit_event(StateEvent::SessionCreated {
            session_id: session.id.clone(),
            session: session.clone(),
        }).await;
        
        Ok(session)
    }
}
```

### Frontend Store Pattern

```typescript
// Manager store with WebSocket sync
function createManagerStore() {
    const { subscribe, set, update } = writable<ManagerState>(initialState);
    
    // Listen for backend events
    ws.on('state:update', (event) => {
        update(state => ({
            ...state,
            ...event.data
        }));
    });
    
    return {
        subscribe,
        createSession: async (name: string) => {
            const session = await invoke('create_session', { name });
            // State automatically synced via WebSocket
            return session;
        }
    };
}
```

## State Types

### Core State Objects

- **Session**: Development session with project context
- **Pane**: Terminal or editor instance
- **Layout**: Window arrangement configuration
- **Settings**: User preferences and configuration
- **Metrics**: Performance and usage statistics

### Event Types

```rust
pub enum StateEvent {
    SessionCreated { session_id: String, session: Session },
    SessionDeleted { session_id: String },
    PaneCreated { pane_id: String, pane: Pane },
    PaneUpdated { pane_id: String, changes: PaneUpdate },
    LayoutChanged { session_id: String, layout: Layout },
    SettingChanged { key: String, value: serde_json::Value },
}
```

## Performance Optimizations

### Selective Updates
- Only emit events for changed fields
- Batch related updates together
- Debounce high-frequency changes

### Memory Management
- Lazy loading of session data
- Automatic cleanup of stale state
- Configurable cache sizes

### WebSocket Efficiency
- Binary encoding for large payloads
- Message compression
- Automatic reconnection

## Future Considerations

- State snapshots for time-travel debugging
- Distributed state for collaboration
- State migration tools
- Performance profiling integration

This architecture provides a robust foundation for state management while maintaining simplicity and performance.