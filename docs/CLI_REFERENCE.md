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

### Development Installation (Current)
```bash
# Install claude-flow first (required dependency)
npm install -g claude-flow@2.0.0-alpha.50

# Clone and build OrchFlow
git clone https://github.com/orchflow/orchflow.git
cd orchflow/packages/orchflow-claude-flow
npm install
npm run build
npm install -g .

# Verify installation
orchflow --version
```

### Published Package (Coming Soon)
```bash
# Install claude-flow first (required dependency)
npm install -g claude-flow@2.0.0-alpha.50

# Install OrchFlow (when published)
npm install -g @orchflow/claude-flow

# Verify installation
orchflow --version
```

## Main Commands

### `orchflow`

Launch OrchFlow with Claude integration and automatic environment setup.

```bash
orchflow [options]
```

#### Options:
- `--mode <mode>` - Launch mode: 'tmux', 'inline', 'auto' (default: 'auto')
- `--port <number>` - Port for orchestration core (default: 3001)
- `--max-workers <number>` - Maximum concurrent workers (default: 8)
- `--no-auto-install-tmux` - Disable automatic tmux installation
- `--restore <name>` - Restore a saved session
- `--no-core` - Don't start orchestration core (connect to existing)
- `--debug` - Enable debug output
- `--help` - Show help message
- `--version` - Show version information

#### Examples:
```bash
# Start normally with auto-installation
orchflow

# Force tmux mode with auto-installation
orchflow --mode=tmux

# Use inline mode (no tmux)
orchflow --mode=inline

# Disable tmux auto-installation
orchflow --no-auto-install-tmux

# Start with custom configuration
orchflow --port 3002 --max-workers 12

# Restore saved session
orchflow --restore my-project

# Debug mode
orchflow --debug
```

## Options and Flags

### Global Options

All commands support these global options:

- `--version` - Show version information
- `--help` - Show help message
- `--debug` - Enable debug output
- `--config <path>` - Use custom config file
- `--mode <mode>` - Launch mode: 'tmux', 'inline', 'auto'
- `--max-workers <number>` - Maximum concurrent workers
- `--no-auto-install-tmux` - Disable automatic tmux installation

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

OrchFlow provides enhanced MCP (Model Context Protocol) tools for natural language orchestration:

### `orchflow_natural_task`

Process natural language task descriptions and automatically create appropriate workers.

**Parameters:**
- `task` (string, required) - Natural language description of what to accomplish
- `context` (object, optional) - Additional context for task execution
- `priority` (string, optional) - Task priority: 'low', 'medium', 'high', 'critical'

**Example:**
```json
{
  "task": "Build a complete authentication system with JWT tokens, password reset, and email verification",
  "context": {
    "framework": "React",
    "backend": "Node.js"
  },
  "priority": "high"
}
```

### `orchflow_smart_connect`

Intelligently connect to workers using natural language or worker identifiers.

**Parameters:**
- `identifier` (string, required) - Worker name, ID, or description
- `fuzzyMatch` (boolean, optional) - Enable fuzzy matching (default: true)

**Example:**
```json
{
  "identifier": "React developer",
  "fuzzyMatch": true
}
```

### `orchflow_status_rich`

Get comprehensive status information with real-time updates.

**Parameters:**
- `includeInactive` (boolean, optional) - Include stopped workers (default: false)
- `showProgress` (boolean, optional) - Show progress bars (default: true)
- `timeframe` (string, optional) - Metrics timeframe: '1h', '24h', '7d'

**Example:**
```json
{
  "includeInactive": true,
  "showProgress": true,
  "timeframe": "24h"
}
```

### `orchflow_quick_access`

Manage quick access key assignments for workers.

**Parameters:**
- `action` (string, required) - Action: 'list', 'assign', 'unassign', 'connect'
- `workerId` (string, optional) - Worker ID for assign/unassign
- `key` (number, optional) - Key number (1-9) for assign/connect

**Example:**
```json
{
  "action": "assign",
  "workerId": "worker-123",
  "key": 1
}
```

### `orchflow_session`

Advanced session management with snapshots and restoration.

**Parameters:**
- `action` (string, required) - Action: 'save', 'restore', 'list', 'delete', 'snapshot'
- `name` (string, optional) - Session name
- `description` (string, optional) - Session description

**Example:**
```json
{
  "action": "save",
  "name": "auth-system-v2",
  "description": "Authentication system with advanced features"
}
```

### `orchflow_performance`

Get detailed performance metrics and system analytics.

**Parameters:**
- `metric` (string, optional) - Specific metric: 'system', 'workers', 'tasks', 'memory'
- `timeframe` (string, optional) - Time range: '1h', '24h', '7d', '30d'

**Example:**
```json
{
  "metric": "system",
  "timeframe": "24h"
}
```

### `orchflow_help`

Context-aware help system with examples and suggestions.

**Parameters:**
- `topic` (string, optional) - Help topic: 'getting-started', 'workers', 'sessions', 'mcp-tools'
- `includeExamples` (boolean, optional) - Include usage examples (default: true)

**Example:**
```json
{
  "topic": "workers",
  "includeExamples": true
}
```

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

### Legacy MCP Tools (Deprecated)

These tools are maintained for backward compatibility but the enhanced tools above are recommended:

- `orchflow_spawn_worker` - Use `orchflow_natural_task` instead
- `orchflow_worker_status` - Use `orchflow_status_rich` instead
- `orchflow_switch_context` - Use `orchflow_smart_connect` instead
- `orchflow_share_knowledge` - Automatic knowledge sharing is now built-in
- `orchflow_merge_work` - Automatic work coordination is now built-in
- `orchflow_save_session` - Use `orchflow_session` instead
- `orchflow_restore_session` - Use `orchflow_session` instead

## Configuration

### Configuration File Location

OrchFlow looks for configuration in:
- `~/.orchflow/config.json` (user-specific)
- `./orchflow.config.json` (project-specific)

### Configuration Options

```json
{
  "mode": "auto",
  "autoInstallTmux": true,
  "orchestratorPort": 3001,
  "statusPaneWidth": 30,
  "enableQuickAccess": true,
  "maxWorkers": 8,
  "logLevel": "info",
  "enablePersistence": true,
  "enableWebSocket": true,
  "unifiedArchitecture": true,
  "security": {
    "enableAuth": false,
    "allowedOrigins": ["*"]
  },
  "splitScreen": {
    "primaryWidth": 70,
    "statusWidth": 30,
    "sessionName": "orchflow_main"
  },
  "tmux": {
    "packageManagers": ["brew", "apt", "yum", "pacman", "zypper", "apk", "pkg", "dnf", "emerge"],
    "fallbackToInline": true,
    "configureAutomatically": true
  }
}
```

### Configuration Options Reference

#### Core Options:
- `mode` - Launch mode: 'tmux', 'inline', 'auto' (default: 'auto')
- `autoInstallTmux` - Enable automatic tmux installation (default: true)
- `orchestratorPort` - Port for orchestration API (default: 3001)
- `maxWorkers` - Maximum number of concurrent workers (default: 8)
- `logLevel` - Logging level: 'debug', 'info', 'warn', 'error' (default: 'info')
- `unifiedArchitecture` - Enable unified architecture optimizations (default: true)

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

#### Tmux Options:
- `packageManagers` - Supported package managers for tmux installation
- `fallbackToInline` - Fall back to inline mode if tmux fails (default: true)
- `configureAutomatically` - Auto-configure tmux settings (default: true)

## Environment Variables

### Core Environment Variables

- `ORCHFLOW_API` - OrchFlow API endpoint (default: http://localhost:3001)
- `ORCHFLOW_TOKEN` - Authentication token for API access
- `ORCHFLOW_DEBUG` - Enable debug mode (set to '1')
- `ORCHFLOW_CONFIG` - Path to custom configuration file

**Note**: Mode selection and configuration options are handled through the interactive setup wizard.

### Claude Integration Variables

- `CLAUDE_MCP_CONFIG` - Path to MCP configuration file
- `CLAUDE_SYSTEM_PROMPT_APPEND` - Path to system prompt additions
- `CLAUDE_FLOW_VERSION` - Required claude-flow version (2.0.0-alpha.50+)

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
# Start OrchFlow with auto-installation
orchflow

# In Claude conversation (natural language):
"Build a complete e-commerce platform with React frontend, Node.js backend, and PostgreSQL database"
"How's the frontend development going?"
"Show me all active workers"
"What's the current system status?"
```

### Project Development

```bash
# Start with custom configuration
orchflow --mode=tmux --max-workers=12 --port 3002

# In Claude conversation:
"Create a microservices architecture with authentication, payment processing, and inventory management"
"Save session as ecommerce-platform"
"Show me performance metrics for all workers"
```

### Session Management

```bash
# Restore previous session
orchflow --restore ecommerce-platform

# In Claude conversation:
"Continue work on the payment processing microservice"
"How's the authentication system integration?"
"Save session as ecommerce-platform-v2"
```

### Advanced Configuration

```bash
# Create custom config with unified architecture
cat > ~/.orchflow/config.json << EOF
{
  "mode": "tmux",
  "autoInstallTmux": true,
  "orchestratorPort": 3002,
  "maxWorkers": 15,
  "statusPaneWidth": 40,
  "logLevel": "debug",
  "unifiedArchitecture": true,
  "enableAuth": true,
  "apiKey": "your-secure-key",
  "tmux": {
    "packageManagers": ["brew", "apt", "yum"],
    "fallbackToInline": true,
    "configureAutomatically": true
  }
}
EOF

# Start with custom config
orchflow --debug
```

### Troubleshooting

```bash
# Check installation and dependencies
orchflow --version
claude-flow --version

# Test connection
curl http://localhost:3001/health

# Force tmux installation
orchflow --mode=tmux

# Use inline mode if tmux issues
orchflow --mode=inline

# Clear cache
rm -rf ~/.orchflow/cache

# Debug mode with detailed logging
orchflow --debug

# Check logs
tail -f ~/.orchflow/logs/orchflow.log

# Test tmux installation
tmux -V

# Check unified architecture status
curl http://localhost:3001/api/status
```

### Natural Language Commands

Once OrchFlow is running, use natural language in Claude:

#### Natural Language Orchestration:
- "Build a complete authentication system with JWT tokens, password reset, and email verification"
- "Create a microservices architecture with API gateway, user service, and payment processing"
- "Develop a real-time chat application with React frontend and WebSocket backend"
- "Set up a CI/CD pipeline with automated testing, security scanning, and deployment"

#### Project Management:
- "How's the frontend development progressing?"
- "What's the status of the database migrations?"
- "Show me performance metrics for all workers"
- "Are there any bottlenecks in the current workflow?"

#### Session Management:
- "Save session as enterprise-auth-system"
- "Show me all saved sessions with descriptions"
- "Restore session enterprise-auth-system"
- "Create a snapshot of the current work state"

#### System Queries:
- "What's the current system status and performance?"
- "Show me detailed worker analytics"
- "Display memory usage and optimization suggestions"
- "What's the overall project health score?"

---

## Performance Metrics

### System Performance
- **Startup Time**: < 2 seconds (improved with unified architecture)
- **Memory Overhead**: < 80MB for orchestration (reduced through consolidation)
- **Worker Capacity**: 8 concurrent workers (configurable up to 15)
- **Response Time**: Real-time orchestration via Claude
- **Build Time**: < 3 seconds for complete compilation

### Architecture Benefits
- **Unified Setup**: Single UnifiedSetupOrchestrator handles all initialization
- **5 Core Managers**: Consolidated from 11 managers for better performance
- **Type Safety**: 100% TypeScript compliance with zero production 'as any' casts
- **Auto-Installation**: Automatic tmux setup with 9 package manager support
- **Fallback Support**: Graceful degradation to inline mode

---

**For more examples and detailed workflows, see [EXAMPLES.md](EXAMPLES.md).**
**For architectural details, see [ARCHITECTURE.md](ARCHITECTURE.md).**