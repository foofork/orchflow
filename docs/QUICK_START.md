# OrchFlow Quick Start Guide 🚀

Get started with OrchFlow natural language orchestration in under 5 minutes.

## 📦 Installation

### Prerequisites
- Node.js 16+
- [claude-flow](https://github.com/anthropics/claude-flow) 2.0.0-alpha.50+

### Install
```bash
# Install claude-flow first
npm install -g claude-flow@2.0.0-alpha.50

# Install OrchFlow
npm install -g @orchflow/claude-flow
```

## 🎯 First Launch

```bash
orchflow
```

**Auto-Installation Features:**
- **tmux**: Automatically installs if missing (supports 9 package managers)
- **Configuration**: Sets up optimal tmux settings automatically
- **Fallback**: Gracefully falls back to inline mode if tmux unavailable

You'll see the OrchFlow terminal with enhanced Claude integration:
- **Natural Language**: Direct conversation with Claude enhanced by orchestration
- **Auto-Orchestration**: Claude automatically creates workers when needed
- **Status Monitoring**: Real-time progress tracking in status pane

## 💬 Your First Commands

### Natural Language Orchestration

```bash
# In the OrchFlow terminal, just talk to Claude naturally:
Build a complete authentication system with API, frontend, and tests
```

Claude will automatically:
- Create specialized workers (API Dev, Frontend Dev, Test Engineer)
- Coordinate work between them
- Share knowledge and decisions
- Maintain conversation flow

### Check Orchestration Status

```bash
# Ask Claude about progress
How's the authentication system coming along?
Show me all workers
What's the status of the API endpoints?
```

### Context Switching

```bash
# Claude automatically switches context when you ask:
How's the frontend login component?
Are the API tests passing?
Show me the database schema progress
```

### More Examples

```bash
# Complex orchestration tasks
Build a complete e-commerce platform with payment processing
Create a microservices architecture with authentication
Develop a real-time chat application with React and WebSocket
Set up CI/CD pipeline with automated testing and deployment

# Research and analysis
Research modern React patterns for large-scale applications
Analyze the best authentication strategies for enterprise apps
Compare database solutions for high-traffic applications

# Quality assurance
Review the codebase for security vulnerabilities
Optimize the application for performance
Create comprehensive test coverage for all modules
```

## 🎮 Enhanced Features

### Automatic Orchestration
- **Smart Worker Creation**: Claude automatically creates workers when tasks require parallel work
- **Context Switching**: Seamless switching between different aspects of your project
- **Knowledge Sharing**: Workers automatically share information and decisions
- **Session Persistence**: All work is saved and can be restored

### Optional Split-Screen Mode
- **Primary Terminal**: Natural conversation with Claude
- **Status Pane**: Real-time worker activity monitoring
- **Quick Access**: Press 1-9 to focus on specific workers

## 🔧 Configuration Options

### Command Line Options
```bash
# Launch with specific mode
orchflow --mode=tmux          # Force tmux mode
orchflow --mode=inline        # Force inline mode
orchflow --no-auto-install-tmux  # Disable auto tmux installation
```

### Configuration File
Create `~/.orchflow/config.json`:

```json
{
  "mode": "tmux",
  "autoInstallTmux": true,
  "maxWorkers": 8,
  "statusPaneWidth": 30,
  "enableQuickAccess": true,
  "theme": "dark",
  "autoSave": true,
  "mcpPort": 3001
}
```

## 🎯 Common Workflows

### Full-Stack Development

```bash
# Single natural language request
Build a complete task management app with React frontend, 
Express API, PostgreSQL database, and comprehensive tests

# Claude automatically orchestrates:
# - Frontend developer for React components
# - Backend developer for API endpoints
# - Database specialist for schema design
# - Test engineer for comprehensive testing

# Check progress naturally
How's the frontend coming along?
Are the API endpoints ready?
What's the database schema looking like?
```

### Research and Analysis

```bash
# Complex research task
Research and compare authentication strategies for a 
multi-tenant SaaS application with enterprise requirements

# Claude coordinates multiple research angles:
# - Security researcher for authentication patterns
# - Architecture analyst for multi-tenancy
# - Compliance specialist for enterprise requirements

# Review findings
What did you find about OAuth 2.0 vs SAML?
Show me the multi-tenancy analysis
What are the compliance considerations?
```

### Code Review and Quality

```bash
# Comprehensive code review
Review the entire codebase for security, performance, 
and maintainability issues

# Claude creates specialized reviewers:
# - Security auditor
# - Performance optimizer
# - Code quality analyst

# Get specific feedback
What security issues did you find?
Show me the performance bottlenecks
What's the overall code quality assessment?
```

## 🚨 Troubleshooting

### Installation Issues

```bash
# Check claude-flow installation
claude-flow --version

# Check OrchFlow installation
orchflow --help

# Force tmux installation
orchflow --mode=tmux

# Use inline mode if tmux issues
orchflow --mode=inline

# Clear cache and retry
rm -rf ~/.orchflow/cache
orchflow
```

### Orchestration Issues

```bash
# Check orchestration status
Show me system status
What workers are active?

# Debug mode
ORCHFLOW_DEBUG=true orchflow

# Reset orchestration
Stop all workers and restart
```

### Performance Issues

```bash
# Check system performance
Show me performance metrics

# Reduce worker count
orchflow --max-workers=4

# Monitor memory usage
Show me memory usage
```

## 📚 Next Steps

1. **Read the [Architecture Guide](ARCHITECTURE.md)** for technical details
2. **Check [CLI Reference](CLI_REFERENCE.md)** for all command options
3. **See [Integration Guide](INTEGRATION_GUIDE.md)** for MCP integration
4. **Visit [Troubleshooting](TROUBLESHOOTING.md)** for detailed help

## 💡 Tips

### Best Practices
- **Be specific**: Detailed descriptions help Claude create better orchestration
- **Think parallel**: Describe complex projects that benefit from multiple workers
- **Ask naturally**: Just talk to Claude as you normally would
- **Check progress**: Ask about specific aspects of your project
- **Use context**: Claude remembers all previous work and decisions

### Advanced Features
- **Session persistence**: All work is automatically saved
- **Knowledge sharing**: Workers automatically coordinate
- **Auto-optimization**: System learns and improves over time
- **Unified interfaces**: All components use consistent type definitions
- **Type safety**: 100% TypeScript compliance with no 'as any' casts

### Performance
- **Startup**: < 2 seconds with unified architecture
- **Memory**: < 80MB overhead for orchestration
- **Concurrency**: Up to 8 workers (configurable)
- **Build time**: < 3 seconds for complete compilation

**That's it! You're ready to use OrchFlow's natural language orchestration.** 🎉

Just launch `orchflow` and start describing what you want to build!