# OrchFlow Troubleshooting Guide 🔧

Complete troubleshooting guide for OrchFlow issues and solutions.

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Startup Problems](#startup-problems)
3. [Worker Issues](#worker-issues)
4. [Performance Problems](#performance-problems)
5. [Terminal Layout Issues](#terminal-layout-issues)
6. [Natural Language Problems](#natural-language-problems)
7. [Configuration Issues](#configuration-issues)
8. [Network and Connectivity](#network-and-connectivity)
9. [Debug Mode](#debug-mode)
10. [Getting Help](#getting-help)

## Installation Issues

### NPM Installation Fails

**Symptoms:**
```bash
npm install -g @orchflow/claude-flow
# Error: EACCES permission denied
```

**Solutions:**

1. **Use sudo (Linux/macOS):**
```bash
sudo npm install -g @orchflow/claude-flow
```

2. **Fix npm permissions:**
```bash
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm install -g @orchflow/claude-flow
```

3. **Use nvm:**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install --lts
nvm use --lts
npm install -g @orchflow/claude-flow
```

### Missing Dependencies

**Symptoms:**
```bash
claude-flow orchflow
# Error: claude-flow not found
```

**Solutions:**

1. **Install claude-flow first:**
```bash
npm install -g claude-flow@2.0.0-alpha.50
claude-flow --version  # Verify installation
```

2. **Check PATH:**
```bash
echo $PATH
which claude-flow
which node
```

3. **Reinstall both packages:**
```bash
npm uninstall -g @orchflow/claude-flow claude-flow
npm install -g claude-flow@2.0.0-alpha.50
npm install -g @orchflow/claude-flow
```

### TypeScript Compilation Errors

**Symptoms:**
```bash
npm run build
# Error: Cannot find module 'typescript'
```

**Solutions:**

1. **Install TypeScript:**
```bash
npm install -g typescript
npm install --save-dev typescript @types/node
```

2. **Clear cache and reinstall:**
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

3. **Use npx for builds:**
```bash
npx tsc --build
```

## Startup Problems

### OrchFlow Won't Start

**Symptoms:**
```bash
claude-flow orchflow
# Hangs or shows no output
```

**Solutions:**

1. **Check dependencies:**
```bash
# Verify all required tools
claude-flow --version
tmux -V
node --version
npm --version
```

2. **Clear cache:**
```bash
rm -rf ~/.orchflow/cache
rm -rf ~/.orchflow/logs
claude-flow orchflow --debug
```

3. **Check ports:**
```bash
# Default port 3001 might be in use
lsof -i :3001
claude-flow orchflow --port=3002
```

4. **Run with debug:**
```bash
claude-flow orchflow --debug
```

### Permission Errors

**Symptoms:**
```bash
# Error: EACCES: permission denied, mkdir '/home/user/.orchflow'
```

**Solutions:**

1. **Fix home directory permissions:**
```bash
chmod 755 ~
mkdir ~/.orchflow
chmod 755 ~/.orchflow
```

2. **Use different data directory:**
```bash
export ORCHFLOW_HOME=/tmp/orchflow
claude-flow orchflow
```

3. **Check file ownership:**
```bash
ls -la ~/.orchflow
sudo chown -R $USER:$USER ~/.orchflow
```

### Tmux Not Available

**Symptoms:**
```bash
# Error: tmux command not found
```

**Solutions:**

1. **Install tmux:**
```bash
# Ubuntu/Debian
sudo apt-get install tmux

# macOS
brew install tmux

# CentOS/RHEL
sudo yum install tmux
```

2. **Verify tmux works:**
```bash
tmux new-session -d -s test
tmux list-sessions
tmux kill-session -t test
```

3. **Use alternative backend:**
```bash
# OrchFlow can fall back to process management
claude-flow orchflow --no-tmux
```

## Worker Issues

### Workers Not Spawning

**Symptoms:**
```bash
Build a React component
# No worker appears in status pane
```

**Solutions:**

1. **Check worker limits:**
```bash
# Show current configuration
Show me system information

# Increase worker limit
export ORCHFLOW_MAX_WORKERS=10
claude-flow orchflow
```

2. **Verify claude-flow accessibility:**
```bash
which claude-flow
claude-flow --help
```

3. **Check resource usage:**
```bash
# Monitor system resources
htop
# or
top

# Check disk space
df -h
```

4. **Manual worker spawn:**
```bash
# Try spawning worker directly
Show me all workers
Create worker manually for testing
```

### Workers Stuck or Unresponsive

**Symptoms:**
```bash
[1] React Developer  🟡 Stuck (0%)
```

**Solutions:**

1. **Restart specific worker:**
```bash
Restart worker 1
# or
Stop worker 1
Build a React component  # Creates new worker
```

2. **Check worker logs:**
```bash
tail -f ~/.orchflow/logs/workers.log
```

3. **Kill all workers:**
```bash
Stop all workers
Show me all workers  # Should be empty
```

4. **Restart OrchFlow:**
```bash
# Exit OrchFlow (Ctrl+C)
claude-flow orchflow
```

### Worker Connection Fails

**Symptoms:**
```bash
Connect to React developer
# Error: Worker not found or connection failed
```

**Solutions:**

1. **Check worker status:**
```bash
Show me all workers
Show worker 1 details
```

2. **Use exact worker name:**
```bash
# List workers to see exact names
Show me all workers
Connect to "React Component Developer"  # Use exact name
```

3. **Use quick access:**
```bash
Press 1  # Direct access to worker 1
```

4. **Restart worker connection:**
```bash
Disconnect from worker
Connect to React developer
```

## Performance Problems

### High CPU Usage

**Symptoms:**
- System becomes slow
- Fans spinning loudly
- High CPU in activity monitor

**Solutions:**

1. **Check resource usage:**
```bash
Show performance report
Display system metrics
```

2. **Reduce worker count:**
```bash
Stop some workers
Set max workers to 4
```

3. **Monitor specific workers:**
```bash
Show worker performance
Display resource usage by worker
```

4. **Optimize worker settings:**
```bash
# Add to ~/.orchflow/config.json
{
  "workers": {
    "resourceLimits": {
      "cpu": 50,
      "memory": 1024
    }
  }
}
```

### High Memory Usage

**Symptoms:**
- System running out of memory
- OrchFlow becomes slow or crashes

**Solutions:**

1. **Check memory usage:**
```bash
Show memory usage
Display worker memory consumption
```

2. **Clear cache:**
```bash
Clear old logs
Remove cached data
Restart OrchFlow
```

3. **Reduce memory limits:**
```bash
# In config.json
{
  "workers": {
    "resourceLimits": {
      "memory": 512
    }
  }
}
```

4. **Stop idle workers:**
```bash
Stop inactive workers
Show me idle workers
```

### Slow Response Times

**Symptoms:**
- Commands take long time to execute
- Status pane updates slowly

**Solutions:**

1. **Check system load:**
```bash
Show system resources
Display performance metrics
```

2. **Optimize settings:**
```bash
# Reduce update frequency
{
  "ui": {
    "updateInterval": 5000,
    "animateUpdates": false
  }
}
```

3. **Clear accumulated data:**
```bash
Clear worker logs
Remove old session data
Compress state database
```

## Terminal Layout Issues

### Split Screen Not Working

**Symptoms:**
- Only see primary terminal
- Status pane missing or corrupted

**Solutions:**

1. **Check tmux:**
```bash
tmux list-sessions
tmux list-panes
```

2. **Reset layout:**
```bash
Reset terminal layout
Resize status pane to 30%
```

3. **Restart with fresh session:**
```bash
# Exit OrchFlow
rm -rf ~/.orchflow/sessions/*
claude-flow orchflow
```

4. **Manual tmux check:**
```bash
tmux new-session -d -s test
tmux split-window -h -t test
tmux list-panes -t test
tmux kill-session -t test
```

### Status Pane Issues

**Symptoms:**
- Status pane blank or shows errors
- Worker information not updating

**Solutions:**

1. **Refresh status:**
```bash
Refresh status pane
Reload worker information
```

2. **Check WebSocket connection:**
```bash
# Look for WebSocket errors in logs
tail -f ~/.orchflow/logs/system.log
```

3. **Reset status pane:**
```bash
Clear status data
Restart status monitoring
```

4. **Adjust status pane width:**
```bash
Set status width to 35%
Resize layout to 70/30
```

### Pane Switching Problems

**Symptoms:**
- Can't switch between panes
- Quick access keys not working

**Solutions:**

1. **Check tmux key bindings:**
```bash
tmux list-keys | grep 1-9
```

2. **Manual pane switching:**
```bash
# In tmux session
Ctrl+B + O  # Switch panes manually
```

3. **Reset key bindings:**
```bash
# Exit OrchFlow and restart
claude-flow orchflow
```

4. **Alternative switching:**
```bash
Switch to primary terminal
Switch to status pane
```

## Natural Language Problems

### Commands Not Recognized

**Symptoms:**
```bash
Build a React component
# Response: "I didn't understand that command"
```

**Solutions:**

1. **Use clearer language:**
```bash
# Instead of ambiguous commands, be specific
Create a React component for user profiles
Build an API endpoint for authentication
Test the user registration system
```

2. **Claude handles orchestration naturally:**
```bash
# Just describe what you need - Claude understands
Build a React component for user profiles
Create an authentication system
Test the payment integration
```

3. **Use structured commands:**
```bash
# Use task-focused language
Build [something specific]
Test [specific functionality]
Research [specific topic]
Analyze [specific area]
```

4. **Check debug output:**
```bash
orchflow --debug
# Watch for MCP tool calls and orchestration logs
```

### Worker Names Not Descriptive

**Symptoms:**
- Workers named generically (e.g., "Code Worker 1")
- Hard to identify worker purpose

**Solutions:**

1. **Use more specific descriptions:**
```bash
# Instead of: "Build a component"
Build a React user profile component with avatar upload

# Instead of: "Create API"
Create REST API endpoint for user authentication with JWT

# Instead of: "Test app"
Test user registration flow including email verification
```

2. **Include context keywords:**
```bash
Build authentication system with JWT tokens
Create database schema for e-commerce products
Test payment processing with Stripe integration
```

3. **Manual worker naming:**
```bash
# Some workers allow custom names
Create worker named "Custom React Developer"
```

### Quick Access Not Working

**Symptoms:**
- Pressing 1-9 doesn't connect to workers
- No response to numeric keys

**Solutions:**

1. **Check key assignments:**
```bash
Show quick access assignments
List worker keys
```

2. **Verify terminal focus:**
```bash
# Make sure you're in primary terminal
# Click in primary terminal area
Press 1
```

3. **Re-assign keys:**
```bash
Assign key 1 to React developer
Set quick access for worker
```

4. **Use alternative access:**
```bash
Connect to worker 1
Switch to "React Component Developer"
```

## Configuration Issues

### Config File Problems

**Symptoms:**
- Settings not applying
- OrchFlow using default settings

**Solutions:**

1. **Check config file location:**
```bash
ls -la ~/.orchflow/config.json
cat ~/.orchflow/config.json
```

2. **Validate JSON syntax:**
```bash
# Use JSON validator
python -m json.tool ~/.orchflow/config.json
```

3. **Reset to defaults:**
```bash
rm ~/.orchflow/config.json
claude-flow orchflow  # Creates new default config
```

4. **Example valid config:**
```json
{
  "ui": {
    "theme": "dark",
    "statusPaneWidth": 30
  },
  "workers": {
    "maxWorkers": 8,
    "autoRestart": true
  },
  "orchestrator": {
    "port": 3001,
    "logLevel": "info"
  }
}
```

### Environment Variables Not Working

**Symptoms:**
- Environment variables ignored
- Default values used instead

**Solutions:**

1. **Check variable syntax:**
```bash
echo $ORCHFLOW_MAX_WORKERS
echo $ORCHFLOW_PORT
env | grep ORCHFLOW
```

2. **Set variables correctly:**
```bash
export ORCHFLOW_MAX_WORKERS=10
export ORCHFLOW_PORT=3002
claude-flow orchflow
```

3. **Use config file instead:**
```bash
# More reliable than environment variables
echo '{"workers": {"maxWorkers": 10}}' > ~/.orchflow/config.json
```

4. **Check variable precedence:**
```bash
# Order: CLI args > config file > env vars > defaults
claude-flow orchflow --max-workers=5  # Overrides all others
```

## Network and Connectivity

### Port Already in Use

**Symptoms:**
```bash
# Error: Port 3001 already in use
```

**Solutions:**

1. **Find process using port:**
```bash
lsof -i :3001
# Kill the process if safe
kill -9 [PID]
```

2. **Use different port:**
```bash
claude-flow orchflow --port=3002
# or set in config
{"orchestrator": {"port": 3002}}
```

3. **Check for other OrchFlow instances:**
```bash
ps aux | grep orchflow
# Kill old instances
pkill -f orchflow
```

### WebSocket Connection Issues

**Symptoms:**
- Status pane not updating
- Worker information stale

**Solutions:**

1. **Check WebSocket server:**
```bash
# Look for WebSocket errors
tail -f ~/.orchflow/logs/system.log | grep -i websocket
```

2. **Test connection manually:**
```bash
# Use browser developer tools
# Navigate to ws://localhost:3001
```

3. **Restart with clean state:**
```bash
rm -rf ~/.orchflow/cache/websocket
claude-flow orchflow
```

4. **Disable WebSocket (fallback):**
```bash
# In config.json
{"orchestrator": {"enableWebSocket": false}}
```

## Debug Mode

### Enabling Debug Mode

```bash
# Command line
claude-flow orchflow --debug

# Environment variable
export ORCHFLOW_DEBUG=true
claude-flow orchflow

# Config file
{"debugMode": true}
```

### Debug Output Analysis

**System Initialization:**
```bash
[DEBUG] Initializing OrchFlow Orchestrator...
[DEBUG] ✅ Core orchestrator initialized
[DEBUG] ✅ Split-screen layout created (70/30)
[DEBUG] ✅ Enhanced MCP tools registered
```

**Worker Management:**
```bash
[DEBUG] 👤 Worker spawned: React Component Developer
[DEBUG] 🔗 Connected to worker: auth_builder_123
[DEBUG] 💤 Worker stopped: Test Engineer
```

**Natural Language Processing:**
```bash
[DEBUG] 🧠 Intent recognized: create_task (confidence: 0.8)
[DEBUG] 📝 Task created: task_123 → React Component Developer
[DEBUG] 🎯 Worker assigned quick key: 1
```

**Performance Monitoring:**
```bash
[DEBUG] 📊 CPU usage: 45%
[DEBUG] 🧠 Memory usage: 1.2GB
[DEBUG] 👥 Active workers: 3
[DEBUG] ⚡ WebSocket clients: 1
```

### Debug Log Files

```bash
# System logs
tail -f ~/.orchflow/logs/debug.log

# Worker-specific logs
tail -f ~/.orchflow/logs/worker_123.log

# Network logs
tail -f ~/.orchflow/logs/network.log

# Error logs
tail -f ~/.orchflow/logs/errors.log
```

### Common Debug Patterns

**Worker Spawn Issues:**
```bash
[DEBUG] Spawning worker: code
[ERROR] Failed to spawn worker: claude-flow not found
# Solution: Check claude-flow installation
```

**Intent Recognition Problems:**
```bash
[DEBUG] Processing input: "build something"
[DEBUG] Intent confidence: 0.3 (too low)
# Solution: Use more specific language
```

**Resource Issues:**
```bash
[DEBUG] CPU usage: 95% (high)
[DEBUG] Memory usage: 7.8GB (high)
# Solution: Reduce worker count or limits
```

## Getting Help

### Self-Help Resources

1. **Documentation:**
   - [Quick Start Guide](QUICK_START.md)
   - [User Guide](USER_GUIDE.md)
   - [API Documentation](API.md)
   - [Examples](EXAMPLES.md)

2. **Debug Information:**
```bash
# Collect system information
claude-flow orchflow --debug > debug.log 2>&1
# Include debug.log when reporting issues
```

3. **System Information:**
```bash
# Gather system details
echo "OS: $(uname -a)"
echo "Node: $(node --version)"
echo "NPM: $(npm --version)"
echo "Claude-flow: $(claude-flow --version)"
echo "Tmux: $(tmux -V)"
```

### Reporting Issues

When reporting issues, include:

1. **System Information:**
   - Operating system and version
   - Node.js version
   - OrchFlow version
   - claude-flow version

2. **Debug Logs:**
```bash
# Enable debug mode and capture logs
claude-flow orchflow --debug > issue_debug.log 2>&1
```

3. **Reproduction Steps:**
   - Exact commands that cause the issue
   - Expected vs actual behavior
   - Screenshots if relevant

4. **Configuration:**
   - Config file contents (remove sensitive data)
   - Environment variables used
   - Command line arguments

### Community Support

- **GitHub Issues**: [github.com/orchflow/orchflow/issues](https://github.com/orchflow/orchflow/issues)
- **Discussions**: [github.com/orchflow/orchflow/discussions](https://github.com/orchflow/orchflow/discussions)
- **Discord**: [discord.gg/orchflow](https://discord.gg/orchflow)
- **Documentation**: [orchflow.ai/docs](https://orchflow.ai/docs)

### Emergency Recovery

If OrchFlow is completely broken:

1. **Nuclear reset:**
```bash
# Stop all processes
pkill -f orchflow
pkill -f claude-flow

# Remove all data
rm -rf ~/.orchflow

# Reinstall
npm uninstall -g @orchflow/claude-flow
npm install -g @orchflow/claude-flow

# Start fresh
claude-flow orchflow
```

2. **Backup important data first:**
```bash
# Backup session snapshots
cp -r ~/.orchflow/snapshots ~/orchflow_backup_snapshots

# Backup custom config
cp ~/.orchflow/config.json ~/orchflow_backup_config.json
```

3. **Restore after reset:**
```bash
# Restore snapshots
mkdir -p ~/.orchflow/snapshots
cp -r ~/orchflow_backup_snapshots/* ~/.orchflow/snapshots/

# Restore config
cp ~/orchflow_backup_config.json ~/.orchflow/config.json
```

---

**Still having issues? Join our [Discord community](https://discord.gg/orchflow) for real-time help!** 💬