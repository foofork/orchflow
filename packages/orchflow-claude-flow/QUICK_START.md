# OrchFlow Quick Start Guide 🚀

Get started with OrchFlow natural language orchestration in under 5 minutes.

## 📦 Installation

```bash
npm install -g @orchflow/claude-flow
```

## 🎯 First Launch

```bash
orchflow
```

You'll see the OrchFlow terminal with a 70/30 split layout:
- **Left (70%)**: Primary terminal for natural language interaction
- **Right (30%)**: Live status pane showing worker activity

## 💬 Your First Commands

### Create Workers with Natural Language

```bash
# In the OrchFlow terminal, type:
Build a React component for user profiles
```

This creates a "React Component Developer" worker and assigns it a quick access key.

### Check Worker Status

```bash
Show me all workers
```

You'll see:
```
[1] React Component Developer  🟢 Running (25%)
[2] API Builder               🟡 Idle
[3] Test Engineer            🟢 Running (80%)
```

### Connect to Workers

```bash
# Natural language
Connect to the React developer

# Or use quick access
Press 1
```

### More Examples

```bash
# Create different types of workers
Test the user authentication flow
Research modern CSS frameworks
Build an API endpoint for user data
Optimize database query performance

# Manage workers
Pause the test runner
Show me worker 2
Connect to the API builder
List all active workers
```

## 🎮 Quick Access Keys

- **Press 1-9**: Instantly connect to workers
- **Ctrl+D**: Return to primary terminal from worker
- **Tab**: Auto-complete worker names
- **Up/Down**: Navigate command history

## 🔧 Basic Configuration

Create `~/.orchflow/config.json`:

```json
{
  "maxWorkers": 8,
  "statusPaneWidth": 30,
  "enableQuickAccess": true,
  "theme": "dark",
  "autoSave": true
}
```

## 🎯 Common Workflows

### Development Workflow

```bash
# 1. Create development workers
Build a user registration system
Create API tests for authentication
Set up database migrations

# 2. Monitor progress
Show me all workers

# 3. Connect to specific workers
Press 1  # Registration system
Press 2  # API tests
Press 3  # Database setup

# 4. Check overall status
What's the system status?
```

### Research Workflow

```bash
# Create research workers
Research modern React patterns
Investigate GraphQL best practices
Analyze competitor authentication flows

# Connect and review findings
Connect to the React researcher
Show me the GraphQL analysis
```

## 🚨 Troubleshooting

### OrchFlow Won't Start

```bash
# Check claude-flow installation
claude-flow --version

# Check OrchFlow installation
orchflow --help

# Verify tmux is available
tmux -V

# Clear cache and retry
rm -rf ~/.orchflow/cache
orchflow
```

### Workers Not Responding

```bash
# Check worker status
Show me all workers

# Restart problematic worker
Restart worker 2

# Clear all workers
Stop all workers
```

### Status Pane Issues

```bash
# Refresh status pane
Refresh status

# Resize layout
Set status width to 40%
```

## 📚 Next Steps

1. **Read the [User Guide](USER_GUIDE.md)** for advanced features
2. **Check [API Documentation](API.md)** for programmatic usage  
3. **See [Examples](EXAMPLES.md)** for common patterns
4. **Visit [Troubleshooting](TROUBLESHOOTING.md)** for detailed help

## 💡 Tips

- Use descriptive task descriptions for better worker names
- Workers remember context between connections
- Status pane updates in real-time
- All standard claude-flow commands still work
- Quick access keys are assigned automatically

**That's it! You're ready to use OrchFlow's natural language orchestration.** 🎉

For more detailed information, see the complete [User Guide](USER_GUIDE.md).