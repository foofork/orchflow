# Plugin Development Example

This example shows how to create a custom plugin for orchflow, including both Rust backend implementation and frontend integration.

## Plugin: Simple Todo Manager

We'll create a todo management plugin that demonstrates:
- Plugin trait implementation
- State management
- Custom actions and events
- Frontend integration

## Project Structure

```
examples/plugin-development/
├── rust/
│   ├── todo_plugin.rs      # Main plugin implementation
│   ├── todo_storage.rs     # Data persistence
│   └── todo_types.rs       # Type definitions
├── frontend/
│   ├── TodoPlugin.svelte   # UI component
│   ├── todo-api.ts         # API client
│   └── todo-store.ts       # State management
└── README.md
```

## Rust Implementation

### 1. Define Types (`todo_types.rs`)

```rust
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Todo {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub completed: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTodo {
    pub title: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTodo {
    pub title: Option<String>,
    pub description: Option<String>,
    pub completed: Option<bool>,
}
```

### 2. Storage Layer (`todo_storage.rs`)

```rust
use std::collections::HashMap;
use std::sync::RwLock;
use uuid::Uuid;
use chrono::Utc;
use crate::todo_types::*;

pub struct TodoStorage {
    todos: RwLock<HashMap<String, Todo>>,
}

impl TodoStorage {
    pub fn new() -> Self {
        Self {
            todos: RwLock::new(HashMap::new()),
        }
    }
    
    pub fn create_todo(&self, create: CreateTodo) -> Result<Todo, String> {
        let mut todos = self.todos.write().unwrap();
        let now = Utc::now();
        
        let todo = Todo {
            id: Uuid::new_v4().to_string(),
            title: create.title,
            description: create.description,
            completed: false,
            created_at: now,
            updated_at: now,
        };
        
        todos.insert(todo.id.clone(), todo.clone());
        Ok(todo)
    }
    
    pub fn list_todos(&self) -> Vec<Todo> {
        let todos = self.todos.read().unwrap();
        todos.values().cloned().collect()
    }
    
    pub fn update_todo(&self, id: &str, update: UpdateTodo) -> Result<Todo, String> {
        let mut todos = self.todos.write().unwrap();
        let todo = todos.get_mut(id).ok_or("Todo not found")?;
        
        if let Some(title) = update.title {
            todo.title = title;
        }
        if let Some(description) = update.description {
            todo.description = description;
        }
        if let Some(completed) = update.completed {
            todo.completed = completed;
        }
        todo.updated_at = Utc::now();
        
        Ok(todo.clone())
    }
    
    pub fn delete_todo(&self, id: &str) -> Result<(), String> {
        let mut todos = self.todos.write().unwrap();
        todos.remove(id).ok_or("Todo not found")?;
        Ok(())
    }
}
```

### 3. Plugin Implementation (`todo_plugin.rs`)

```rust
use async_trait::async_trait;
use serde_json::{Value, json};
use crate::plugins::{Plugin, PluginContext};
use crate::manager::Event;
use crate::todo_storage::TodoStorage;
use crate::todo_types::*;

pub struct TodoPlugin {
    context: Option<PluginContext>,
    storage: TodoStorage,
}

impl TodoPlugin {
    pub fn new() -> Self {
        Self {
            context: None,
            storage: TodoStorage::new(),
        }
    }
}

#[async_trait]
impl Plugin for TodoPlugin {
    fn id(&self) -> &str {
        "todo-manager"
    }
    
    fn name(&self) -> &str {
        "Todo Manager"
    }
    
    fn version(&self) -> &str {
        "1.0.0"
    }
    
    fn author(&self) -> &str {
        "orchflow team"
    }
    
    async fn initialize(&mut self, context: PluginContext) -> Result<(), String> {
        self.context = Some(context);
        println!("Todo plugin initialized");
        Ok(())
    }
    
    async fn shutdown(&mut self) -> Result<(), String> {
        println!("Todo plugin shutting down");
        Ok(())
    }
    
    async fn handle_action(&mut self, action: &str, params: Value) -> Result<Value, String> {
        match action {
            "create_todo" => {
                let create: CreateTodo = serde_json::from_value(params)
                    .map_err(|e| format!("Invalid parameters: {}", e))?;
                
                let todo = self.storage.create_todo(create)?;
                
                // Emit event
                if let Some(ctx) = &self.context {
                    let event = Event::PluginOutput {
                        plugin_id: self.id().to_string(),
                        output: json!({
                            "type": "todo_created",
                            "todo": todo
                        }),
                    };
                    // Emit event (implementation depends on your event system)
                }
                
                Ok(json!(todo))
            }
            
            "list_todos" => {
                let todos = self.storage.list_todos();
                Ok(json!(todos))
            }
            
            "update_todo" => {
                let id = params["id"].as_str().ok_or("Missing todo ID")?;
                let update: UpdateTodo = serde_json::from_value(params["update"].clone())
                    .map_err(|e| format!("Invalid update parameters: {}", e))?;
                
                let todo = self.storage.update_todo(id, update)?;
                
                // Emit event
                if let Some(ctx) = &self.context {
                    let event = Event::PluginOutput {
                        plugin_id: self.id().to_string(),
                        output: json!({
                            "type": "todo_updated",
                            "todo": todo
                        }),
                    };
                    // Emit event
                }
                
                Ok(json!(todo))
            }
            
            "delete_todo" => {
                let id = params["id"].as_str().ok_or("Missing todo ID")?;
                self.storage.delete_todo(id)?;
                
                // Emit event
                if let Some(ctx) = &self.context {
                    let event = Event::PluginOutput {
                        plugin_id: self.id().to_string(),
                        output: json!({
                            "type": "todo_deleted",
                            "id": id
                        }),
                    };
                    // Emit event
                }
                
                Ok(json!({"success": true}))
            }
            
            _ => Err(format!("Unknown action: {}", action))
        }
    }
    
    async fn handle_event(&mut self, event: &Event) -> Result<(), String> {
        // Handle relevant events
        match event {
            Event::SessionCreated { .. } => {
                // Maybe load todos for the session
            }
            _ => {}
        }
        Ok(())
    }
}
```

## Frontend Integration

### 1. API Client (`todo-api.ts`)

```typescript
import { invoke } from '@tauri-apps/api/tauri';

export interface Todo {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTodo {
  title: string;
  description?: string;
}

export interface UpdateTodo {
  title?: string;
  description?: string;
  completed?: boolean;
}

export class TodoAPI {
  private pluginId = 'todo-manager';
  
  async createTodo(todo: CreateTodo): Promise<Todo> {
    return await invoke('execute_plugin_command', {
      plugin_id: this.pluginId,
      command: 'create_todo',
      args: todo
    });
  }
  
  async listTodos(): Promise<Todo[]> {
    return await invoke('execute_plugin_command', {
      plugin_id: this.pluginId,
      command: 'list_todos',
      args: {}
    });
  }
  
  async updateTodo(id: string, update: UpdateTodo): Promise<Todo> {
    return await invoke('execute_plugin_command', {
      plugin_id: this.pluginId,
      command: 'update_todo',
      args: { id, update }
    });
  }
  
  async deleteTodo(id: string): Promise<void> {
    await invoke('execute_plugin_command', {
      plugin_id: this.pluginId,
      command: 'delete_todo',
      args: { id }
    });
  }
}
```

### 2. Svelte Store (`todo-store.ts`)

```typescript
import { writable } from 'svelte/store';
import { TodoAPI, type Todo } from './todo-api';

class TodoStore {
  private api = new TodoAPI();
  public todos = writable<Todo[]>([]);
  
  async loadTodos() {
    const todos = await this.api.listTodos();
    this.todos.set(todos);
  }
  
  async createTodo(title: string, description?: string) {
    const todo = await this.api.createTodo({ title, description });
    this.todos.update(todos => [...todos, todo]);
    return todo;
  }
  
  async toggleTodo(id: string) {
    const todos = get(this.todos);
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    
    const updated = await this.api.updateTodo(id, { 
      completed: !todo.completed 
    });
    
    this.todos.update(todos => 
      todos.map(t => t.id === id ? updated : t)
    );
  }
  
  async deleteTodo(id: string) {
    await this.api.deleteTodo(id);
    this.todos.update(todos => todos.filter(t => t.id !== id));
  }
}

export const todoStore = new TodoStore();
```

### 3. UI Component (`TodoPlugin.svelte`)

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { todoStore } from './todo-store';
  import type { Todo } from './todo-api';
  
  let newTodoTitle = '';
  let newTodoDescription = '';
  
  onMount(() => {
    todoStore.loadTodos();
  });
  
  async function addTodo() {
    if (!newTodoTitle.trim()) return;
    
    await todoStore.createTodo(newTodoTitle, newTodoDescription);
    newTodoTitle = '';
    newTodoDescription = '';
  }
  
  async function toggleTodo(todo: Todo) {
    await todoStore.toggleTodo(todo.id);
  }
  
  async function deleteTodo(todo: Todo) {
    await todoStore.deleteTodo(todo.id);
  }
</script>

<div class="todo-plugin">
  <h2>Todo Manager</h2>
  
  <form on:submit|preventDefault={addTodo} class="add-todo">
    <input
      bind:value={newTodoTitle}
      placeholder="Todo title..."
      required
    />
    <input
      bind:value={newTodoDescription}
      placeholder="Description (optional)..."
    />
    <button type="submit">Add Todo</button>
  </form>
  
  <div class="todo-list">
    {#each $todoStore.todos as todo (todo.id)}
      <div class="todo-item" class:completed={todo.completed}>
        <label>
          <input
            type="checkbox"
            checked={todo.completed}
            on:change={() => toggleTodo(todo)}
          />
          <span class="todo-title">{todo.title}</span>
        </label>
        
        {#if todo.description}
          <p class="todo-description">{todo.description}</p>
        {/if}
        
        <button on:click={() => deleteTodo(todo)} class="delete-btn">
          Delete
        </button>
      </div>
    {/each}
    
    {#if $todoStore.todos.length === 0}
      <p class="empty-state">No todos yet. Add one above!</p>
    {/if}
  </div>
</div>

<style>
  .todo-plugin {
    padding: 1rem;
    max-width: 600px;
  }
  
  .add-todo {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  
  .add-todo input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
  
  .todo-item {
    border: 1px solid #eee;
    border-radius: 4px;
    padding: 0.75rem;
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .todo-item.completed {
    opacity: 0.6;
  }
  
  .todo-item.completed .todo-title {
    text-decoration: line-through;
  }
  
  .todo-title {
    flex: 1;
    font-weight: 500;
  }
  
  .todo-description {
    margin: 0.25rem 0;
    color: #666;
    font-size: 0.875rem;
  }
  
  .delete-btn {
    background: #ff4444;
    color: white;
    border: none;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .empty-state {
    text-align: center;
    color: #666;
    font-style: italic;
  }
</style>
```

## Plugin Registration

Add to `PluginRegistry`:

```rust
impl PluginRegistry {
    pub fn create(&self, plugin_id: &str) -> Option<Box<dyn Plugin>> {
        match plugin_id {
            "todo-manager" => Some(Box::new(TodoPlugin::new())),
            // ... other plugins
            _ => None,
        }
    }
}
```

## Key Learning Points

1. **Plugin Trait**: All plugins implement the same interface
2. **Action Handling**: Plugins respond to custom actions
3. **Event Emission**: Plugins can emit events for real-time updates
4. **State Management**: Plugins manage their own state
5. **Frontend Integration**: Standard API patterns for frontend communication

## Best Practices

1. **Error Handling**: Always return meaningful error messages
2. **State Persistence**: Consider persisting plugin data
3. **Event Emission**: Emit events for state changes
4. **Validation**: Validate all input parameters
5. **Documentation**: Document your plugin's API

## Extending the Plugin

Ideas for enhancements:
- Persistence to file/database
- Todo categories and tags
- Due dates and reminders
- Collaboration features
- Export/import functionality

This example provides a foundation for building more complex plugins!