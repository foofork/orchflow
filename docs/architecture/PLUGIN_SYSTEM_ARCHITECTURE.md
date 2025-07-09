# Plugin System Architecture in orchflow

## Overview

orchflow's plugin system provides extensibility through a well-defined interface that allows both built-in and external plugins to enhance functionality. Plugins can add new commands, respond to events, and integrate with the core system.

## Core Concepts

The plugin system is built on:
- **Plugin Trait**: Common interface for all plugins
- **Plugin Registry**: Central management of loaded plugins
- **Event System**: Plugins can subscribe to and emit events
- **Command Router**: Plugins register commands they handle
- **Sandboxed Execution**: Plugins run with controlled permissions

## Architecture Diagram

```
┌─────────────────────────────────────────────┐
│             Frontend UI                      │
│                                             │
│      ┌──────────────────────────┐          │
│      │   Plugin Commands/UI     │          │
│      └────────────┬─────────────┘          │
└───────────────────┼─────────────────────────┘
                    │ IPC
┌───────────────────┼─────────────────────────┐
│                   ▼                          │
│         ┌─────────────────┐                 │
│         │     Manager     │                 │
│         └────────┬────────┘                 │
│                  │                           │
│         ┌────────▼────────┐                 │
│         │ Plugin System   │ ← Registry      │
│         └────────┬────────┘                 │
│                  │                           │
│    ┌─────────────┼─────────────┐            │
│    │             │             │            │
│ ┌──▼───┐  ┌─────▼────┐  ┌────▼────┐       │
│ │Search│  │   Git    │  │  LSP   │ ...    │
│ │Plugin│  │ Plugin   │  │ Plugin │        │
│ └──┬───┘  └─────┬────┘  └────┬────┘       │
│    │            │             │            │
│ ┌──▼────────────▼─────────────▼───┐        │
│ │        Plugin Context           │        │
│ │  • State Access                 │        │
│ │  • Event Bus                    │        │
│ │  • System APIs                  │        │
│ └─────────────────────────────────┘        │
│            Backend (Rust)                   │
└─────────────────────────────────────────────┘
```

## Plugin Interface

### Core Plugin Trait

```rust
#[async_trait]
pub trait Plugin: Send + Sync {
    /// Unique identifier for the plugin
    fn id(&self) -> &str;
    
    /// Plugin metadata
    fn metadata(&self) -> PluginMetadata;
    
    /// Called when plugin is loaded
    async fn activate(&mut self, context: PluginContext) -> Result<()>;
    
    /// Called when plugin is unloaded
    async fn deactivate(&mut self) -> Result<()>;
    
    /// Handle a command directed to this plugin
    async fn handle_command(
        &self,
        command: &str,
        args: Value,
        context: PluginContext,
    ) -> Result<Value>;
    
    /// Subscribe to system events
    fn subscribed_events(&self) -> Vec<String> {
        vec![]
    }
    
    /// Handle system events
    async fn handle_event(&self, event: &Event) -> Result<()> {
        Ok(())
    }
}
```

### Plugin Metadata

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginMetadata {
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub commands: Vec<CommandInfo>,
    pub capabilities: Vec<String>,
    pub min_orchflow_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandInfo {
    pub name: String,
    pub description: String,
    pub args: Vec<ArgInfo>,
}
```

## Plugin Types

### Built-in Plugins

Located in `src-tauri/src/plugins/`:

1. **SearchPlugin**: Ripgrep-based project search
2. **TerminalPlugin**: Terminal management operations  
3. **FilePlugin**: File system operations
4. **GitPlugin**: Git integration
5. **LSPPlugin**: Language server protocol support

### External Plugins

Support for JavaScript/TypeScript plugins:
```javascript
// External plugin example
export default {
    id: 'my-plugin',
    metadata: {
        name: 'My Plugin',
        version: '1.0.0',
        commands: [{
            name: 'my-command',
            description: 'Does something cool'
        }]
    },
    
    async activate(context) {
        console.log('Plugin activated');
    },
    
    async handleCommand(command, args) {
        if (command === 'my-command') {
            return { result: 'success' };
        }
    }
};
```

## Plugin Lifecycle

### Loading Process

1. **Discovery**: Scan plugin directories
2. **Validation**: Check metadata and compatibility
3. **Registration**: Add to plugin registry
4. **Activation**: Call `activate()` with context
5. **Command Registration**: Register plugin commands

```rust
impl PluginSystem {
    pub async fn load_plugin(&mut self, plugin: Box<dyn Plugin>) -> Result<()> {
        let id = plugin.id().to_string();
        let metadata = plugin.metadata();
        
        // Validate compatibility
        self.validate_plugin(&metadata)?;
        
        // Create plugin context
        let context = self.create_context(&id);
        
        // Activate plugin
        plugin.activate(context.clone()).await?;
        
        // Register commands
        for cmd in &metadata.commands {
            self.command_registry.register(&id, &cmd.name);
        }
        
        // Store in registry
        self.plugins.insert(id, plugin);
        
        Ok(())
    }
}
```

## Plugin Context

### Context API

```rust
pub struct PluginContext {
    pub plugin_id: String,
    pub state_manager: Arc<StateManager>,
    pub event_bus: Arc<EventBus>,
    pub app_handle: tauri::AppHandle,
    permissions: HashSet<Permission>,
}

impl PluginContext {
    /// Access state with permission check
    pub async fn get_state<T>(&self, key: &str) -> Result<T> {
        self.check_permission(Permission::ReadState)?;
        self.state_manager.get(key).await
    }
    
    /// Emit event to system
    pub async fn emit_event(&self, event: Event) -> Result<()> {
        self.check_permission(Permission::EmitEvents)?;
        self.event_bus.emit(event).await
    }
    
    /// Call another plugin's command
    pub async fn call_plugin(
        &self, 
        plugin_id: &str, 
        command: &str, 
        args: Value
    ) -> Result<Value> {
        self.check_permission(Permission::CallPlugins)?;
        // Route through plugin system
    }
}
```

## Command Routing

### Command Execution Flow

```rust
impl PluginSystem {
    pub async fn execute_command(
        &self,
        plugin_id: &str,
        command: &str,
        args: Value,
    ) -> Result<Value> {
        // Get plugin
        let plugin = self.plugins.get(plugin_id)
            .ok_or_else(|| Error::PluginNotFound(plugin_id.to_string()))?;
        
        // Check if plugin handles this command
        if !self.command_registry.handles(plugin_id, command) {
            return Err(Error::CommandNotFound(command.to_string()));
        }
        
        // Create context for this execution
        let context = self.create_context(plugin_id);
        
        // Execute with timeout
        let result = timeout(
            Duration::from_secs(30),
            plugin.handle_command(command, args, context)
        ).await??;
        
        Ok(result)
    }
}
```

## Event System Integration

### Event Subscription

```rust
impl PluginSystem {
    pub async fn dispatch_event(&self, event: &Event) -> Result<()> {
        // Find plugins subscribed to this event
        let subscribers = self.get_event_subscribers(&event.event_type);
        
        // Dispatch to each subscriber
        for plugin_id in subscribers {
            if let Some(plugin) = self.plugins.get(&plugin_id) {
                // Handle in separate task to avoid blocking
                let plugin_clone = plugin.clone();
                let event_clone = event.clone();
                
                tokio::spawn(async move {
                    if let Err(e) = plugin_clone.handle_event(&event_clone).await {
                        error!("Plugin {} failed to handle event: {}", plugin_id, e);
                    }
                });
            }
        }
        
        Ok(())
    }
}
```

## Example: Search Plugin

```rust
pub struct SearchPlugin {
    searcher: ProjectSearcher,
}

#[async_trait]
impl Plugin for SearchPlugin {
    fn id(&self) -> &str {
        "orchflow.search"
    }
    
    fn metadata(&self) -> PluginMetadata {
        PluginMetadata {
            name: "Search Plugin".to_string(),
            version: "1.0.0".to_string(),
            commands: vec![
                CommandInfo {
                    name: "search_project".to_string(),
                    description: "Search across project files".to_string(),
                    args: vec![
                        ArgInfo { name: "query".to_string(), type: "string" },
                        ArgInfo { name: "options".to_string(), type: "object" },
                    ],
                },
            ],
            capabilities: vec!["search".to_string()],
            min_orchflow_version: "0.1.0".to_string(),
        }
    }
    
    async fn handle_command(
        &self,
        command: &str,
        args: Value,
        context: PluginContext,
    ) -> Result<Value> {
        match command {
            "search_project" => {
                let query = args["query"].as_str()
                    .ok_or_else(|| Error::InvalidArgs("query required"))?;
                
                let results = self.searcher.search(query).await?;
                
                // Emit results as events for streaming
                for result in results {
                    context.emit_event(Event::SearchResult {
                        plugin_id: self.id().to_string(),
                        result,
                    }).await?;
                }
                
                Ok(json!({ "status": "complete" }))
            }
            _ => Err(Error::CommandNotFound(command.to_string())),
        }
    }
}
```

## Security & Sandboxing

### Permission Model

```rust
#[derive(Debug, Clone, Hash, Eq, PartialEq)]
pub enum Permission {
    ReadState,
    WriteState,
    EmitEvents,
    CallPlugins,
    FileSystemRead,
    FileSystemWrite,
    NetworkAccess,
    SystemCommand,
}
```

### Resource Limits

- CPU time limits per command
- Memory usage caps
- File handle limits
- Network connection restrictions

## Performance Considerations

### Async Execution
- All plugin operations are async
- Parallel command execution where safe
- Event dispatch in separate tasks

### Caching
- Plugin metadata cached on load
- Command registry for fast lookup
- Permission checks cached per context

## Best Practices

1. **Keep plugins focused** - Single responsibility
2. **Handle errors gracefully** - Don't crash the system
3. **Use events for long operations** - Stream results
4. **Document commands clearly** - Help users understand
5. **Version compatibility** - Check orchflow version
6. **Clean up resources** - Implement deactivate properly

## Future Enhancements

- Plugin marketplace with auto-install
- WASM plugin support for sandboxing
- Plugin dependency management
- Hot-reload for development
- Performance profiling per plugin
- Plugin composition/pipelines

The plugin system provides a robust foundation for extending orchflow while maintaining stability and security.