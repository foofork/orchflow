# OrchFlow CLI Reference

Complete command-line interface documentation for OrchFlow.

## Table of Contents

1. [Installation](#installation)
2. [Main Commands](#main-commands)
3. [Options and Flags](#options-and-flags)
4. [MCP Tools](#mcp-tools)
5. [Configuration](#configuration)
6. [Environment Variables](#environment-variables)
7. [Examples](#examples)

## Installation

```bash
# Install OrchFlow
npm install -g @orchflow/claude-flow

# Verify installation
orchflow --version
```

## Main Commands

### `orchflow`

Launch OrchFlow with Claude integration.

```bash
orchflow [options]
```

#### Options:
- `--port <number>` - Port for orchestration core (default: 3001)
- `--restore <name>` - Restore a saved session
- `--no-core` - Don't start orchestration core (connect to existing)
- `--debug` - Enable debug output
- `--help` - Show help message

#### Examples:
```bash
# Start normally
orchflow

# Start with custom port
orchflow --port 3002

# Restore saved session
orchflow --restore my-project

# Debug mode
orchflow --debug

# Connect to existing core
orchflow --no-core
```

## Options and Flags

### Global Options

All commands support these global options:

- `--version` - Show version information
- `--help` - Show help message
- `--debug` - Enable debug output
- `--config <path>` - Use custom config file

### Session Management

```bash
# Save current session
# (Use natural language in Claude conversation)
"Save session as project-name"

# Restore session
orchflow --restore project-name

# List saved sessions
# (Use natural language in Claude conversation)
"Show me all saved sessions"
```

### Worker Management

Workers are managed through natural language in the Claude conversation:

```bash
# Create workers
"Build a React component for user profiles"
"Test the authentication system"
"Research GraphQL best practices"

# Check worker status
"Show me all workers"
"What's the status of worker 2?"

# Connect to workers
"Connect to the React developer"
"Switch to worker 3"
# Or use quick access keys 1-9
```

## MCP Tools

OrchFlow provides MCP (Model Context Protocol) tools for Claude integration:

### `orchflow_spawn_worker`

Create a new worker for parallel task execution.

**Parameters:**
- `task` (string, required) - Description of what the worker will do
- `type` (string, optional) - Worker type: 'developer', 'tester', 'researcher', 'analyst', 'architect', 'reviewer'
- `parentContext` (object, optional) - Context to share with the worker

**Example:**
```json
{
  "task": "Build REST API for user management",
  "type": "developer",
  "parentContext": {
    "sharedKnowledge": {
      "apiVersion": "v1",
      "authMethod": "JWT"
    }
  }
}
```

### `orchflow_worker_status`

Get status of workers.

**Parameters:**
- `workerId` (string, optional) - Specific worker ID to check

**Example:**
```json
{
  "workerId": "worker-123"
}
```

### `orchflow_switch_context`

Switch conversation context to a specific worker.

**Parameters:**
- `workerId` (string, required) - ID of worker to switch to
- `preserveHistory` (boolean, optional) - Keep current conversation history

**Example:**
```json
{
  "workerId": "worker-123",
  "preserveHistory": true
}
```

### `orchflow_share_knowledge`

Share information between workers.

**Parameters:**
- `knowledge` (object, required) - Information to share
- `targetWorkers` (array, optional) - Worker IDs to share with (empty = all)

**Example:**
```json
{
  "knowledge": {
    "apiEndpoint": "https://api.example.com/v1",
    "authToken": "Bearer token-here"
  },
  "targetWorkers": ["worker-123", "worker-456"]
}
```

### `orchflow_merge_work`

Merge results from multiple workers.

**Parameters:**
- `workerIds` (array, required) - Workers whose work to merge
- `strategy` (string, optional) - Merge strategy: 'combine', 'sequential', 'overlay'

**Example:**
```json
{
  "workerIds": ["worker-123", "worker-456"],
  "strategy": "combine"
}
```

### `orchflow_save_session`

Save current session state.

**Parameters:**
- `name` (string, required) - Session name
- `description` (string, optional) - Session description

**Example:**
```json
{
  "name": "auth-system-project",
  "description": "Authentication system development session"
}
```

### `orchflow_restore_session`

Restore a saved session.

**Parameters:**
- `name` (string, required) - Session name to restore

**Example:**
```json
{
  "name": "auth-system-project"
}
```

## Configuration

### Configuration File Location

OrchFlow looks for configuration in:
- `~/.orchflow/config.json` (user-specific)
- `./orchflow.config.json` (project-specific)

### Configuration Options

```json
{
  "orchestratorPort": 3001,
  "statusPaneWidth": 30,
  "enableQuickAccess": true,
  "maxWorkers": 10,
  "logLevel": "info",
  "enablePersistence": true,
  "enableWebSocket": true,
  "security": {
    "enableAuth": false,
    "allowedOrigins": ["*"]
  },
  "splitScreen": {
    "primaryWidth": 70,
    "statusWidth": 30,
    "sessionName": "orchflow_main"
  }
}
```

### Configuration Options Reference

#### Core Options:
- `orchestratorPort` - Port for orchestration API (default: 3001)
- `maxWorkers` - Maximum number of concurrent workers (default: 10)
- `logLevel` - Logging level: 'debug', 'info', 'warn', 'error' (default: 'info')

#### UI Options:
- `statusPaneWidth` - Width of status pane in percentage (default: 30)
- `enableQuickAccess` - Enable quick access keys 1-9 (default: true)

#### Storage Options:
- `enablePersistence` - Enable session persistence (default: true)
- `storageDir` - Directory for persistent storage (default: ~/.orchflow)

#### Security Options:
- `enableAuth` - Enable API authentication (default: false)
- `apiKey` - API key for authentication
- `allowedOrigins` - CORS allowed origins (default: ["*"])

## Environment Variables

### Core Environment Variables

- `ORCHFLOW_API` - OrchFlow API endpoint (default: http://localhost:3001)
- `ORCHFLOW_TOKEN` - Authentication token for API access
- `ORCHFLOW_DEBUG` - Enable debug mode (set to '1')
- `ORCHFLOW_CONFIG` - Path to custom configuration file

### Claude Integration Variables

- `CLAUDE_MCP_CONFIG` - Path to MCP configuration file
- `CLAUDE_SYSTEM_PROMPT_APPEND` - Path to system prompt additions

### Example Environment Setup

```bash
# Basic setup
export ORCHFLOW_API=http://localhost:3001
export ORCHFLOW_TOKEN=your-token-here

# Debug mode
export ORCHFLOW_DEBUG=1

# Custom config
export ORCHFLOW_CONFIG=/path/to/custom/config.json
```

## Examples

### Basic Usage

```bash
# Start OrchFlow
orchflow

# In Claude conversation:
"Build a todo application with React frontend and Node.js backend"
"Show me all workers"
"Connect to the React developer"
"Test the todo application"
```

### Project Development

```bash
# Start with custom port
orchflow --port 3002

# In Claude conversation:
"Create workers for frontend, backend, database, and testing"
"Save session as todo-project"
"Show me progress across all workers"
```

### Session Management

```bash
# Restore previous session
orchflow --restore todo-project

# In Claude conversation:
"Continue work on the authentication system"
"Switch to the backend developer"
"Save session as todo-project-v2"
```

### Advanced Configuration

```bash
# Create custom config
cat > ~/.orchflow/config.json << EOF
{
  "orchestratorPort": 3002,
  "maxWorkers": 15,
  "statusPaneWidth": 40,
  "logLevel": "debug",
  "enableAuth": true,
  "apiKey": "your-secure-key"
}
EOF

# Start with custom config
orchflow --debug
```

### Troubleshooting

```bash
# Check installation
orchflow --version

# Test connection
curl http://localhost:3001/health

# Clear cache
rm -rf ~/.orchflow/cache

# Debug mode
orchflow --debug

# Check logs
tail -f ~/.orchflow/logs/orchflow.log
```

### Natural Language Commands

Once OrchFlow is running, use natural language in Claude:

#### Creating Workers:
- "Build a React component for user profiles"
- "Test the authentication system"
- "Research GraphQL best practices"
- "Analyze application performance"

#### Managing Workers:
- "Show me all workers"
- "What's the status of the API developer?"
- "Connect to worker 3"
- "Pause the test runner"

#### Session Management:
- "Save session as project-name"
- "Show me all saved sessions"
- "Restore session project-name"

#### System Queries:
- "What's the system status?"
- "Show me worker performance"
- "Display quick access assignments"

---

**For more examples and detailed workflows, see [EXAMPLES.md](EXAMPLES.md).**