# OrchFlow Installation Guide

## 🚀 Quick Start

OrchFlow provides a **completely automatic installation** that handles all dependencies for you. When you choose the tmux option, everything will be installed and configured automatically.

```bash
# Install OrchFlow
npm install -g @orchflow/claude-flow

# Launch with automatic setup
npx orchflow
```

## 📋 What to Expect During Installation

### 1. **Environment Detection** (< 1 second)
OrchFlow automatically detects your environment:
- ✅ Operating system (macOS, Linux, Windows)
- ✅ Terminal type (VS Code, iTerm, Terminal.app, etc.)
- ✅ Existing tmux installation
- ✅ Available package managers (brew, apt, yum, etc.)
- ✅ GitHub Codespaces detection

### 2. **Setup Options** (Interactive)
You'll see a friendly menu with options:

```
🎯 Setup Options
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

How would you like to use OrchFlow?

1. 🖥️  Split Terminal (tmux) - Full featured with live status pane
   └─ 70/30 split with worker navigation and status updates
   └─ Will automatically install tmux for you

2. 📄 Inline Mode - Status updates in main terminal
   └─ Lightweight, works in any terminal

Choose [1-2] or Enter for recommended: 
```

### 3. **Automatic Dependency Installation** (30 seconds - 2 minutes)
When you choose tmux, OrchFlow handles **everything automatically**:

#### **macOS** 📱
```bash
✓ Detecting environment...
✓ Homebrew detected
📦 Installing tmux via Homebrew...
✓ tmux 3.3a installed successfully
✓ OrchFlow tmux configuration applied
```

#### **Linux** 🐧
```bash
✓ Detecting environment...
✓ APT package manager detected
📦 Installing tmux via APT...
✓ tmux 3.2a installed successfully
✓ OrchFlow tmux configuration applied
```

#### **Windows** 🪟
```bash
✓ Detecting environment...
✓ WSL detected
📦 Installing tmux in WSL...
✓ tmux 3.2a installed successfully
✓ OrchFlow tmux configuration applied
```

### 4. **Configuration Setup** (< 5 seconds)
OrchFlow automatically creates optimized configurations:
- ✅ **tmux config** at `~/.orchflow/tmux.conf`
- ✅ **Key bindings** for worker navigation (Ctrl+O, 1-9)
- ✅ **Status bar** with OrchFlow branding
- ✅ **Mouse support** enabled
- ✅ **Session management** configured

### 5. **Validation** (< 2 seconds)
OrchFlow verifies everything works:
- ✅ tmux installation verified
- ✅ Configuration files validated
- ✅ Key bindings tested
- ✅ Split-screen functionality confirmed

## 🎯 Installation Flows by Environment

### **Already Inside tmux**
```bash
$ npx orchflow
✓ Tmux session detected
✓ Creating 70/30 horizontal split...
✓ OrchFlow Terminal ready
```

### **VS Code Terminal**
```bash
$ npx orchflow
🎯 OrchFlow Setup - VS Code Detected
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

How would you like to see live status updates?

1. Split Terminal (recommended if tmux installed)
   └─ 70/30 split with live status pane
   └─ Will automatically install tmux for you

2. Inline Status
   └─ Status updates in main terminal
   
3. VS Code Status Bar
   └─ Minimal updates in bottom bar
   
4. Separate Window
   └─ Status in new VS Code window

Choose [1-4] or Enter for recommended: 
```

### **GitHub Codespaces**
```bash
$ npx orchflow
🎯 OrchFlow Ready (Codespaces Edition)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Tmux configured
✓ Status monitor active
✓ Cloud resources optimized
```

### **Basic Terminal (No tmux)**
```bash
$ npx orchflow
🎯 OrchFlow Setup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
tmux not found. Install automatically? [Y/n]: y

📦 Installing tmux...
✓ tmux 3.3a installed via Homebrew
✓ OrchFlow tmux configuration applied
✓ Split-screen layout ready (70/30)
```

## 🔧 What Gets Installed

### **tmux Installation**
OrchFlow automatically installs tmux using your system's package manager:

| Platform | Package Manager | Command |
|----------|----------------|---------|
| macOS | Homebrew | `brew install tmux` |
| macOS | MacPorts | `sudo port install tmux` |
| Ubuntu/Debian | APT | `sudo apt install tmux` |
| RHEL/CentOS | YUM | `sudo yum install tmux` |
| Fedora | DNF | `sudo dnf install tmux` |
| Arch Linux | Pacman | `sudo pacman -S tmux` |
| Alpine | APK | `sudo apk add tmux` |
| Windows | WSL/Chocolatey/Scoop | Various methods |

### **Configuration Files Created**
```
~/.orchflow/
├── tmux.conf              # OrchFlow tmux configuration
├── config.yml             # User preferences
└── sessions/              # Session backups

~/.tmux.conf               # Updated to source OrchFlow config
```

### **Key Bindings Configured**
| Keys | Action |
|------|--------|
| `Ctrl+O, 1-9` | Quick access to workers |
| `Ctrl+O, 0` | Return to primary terminal |
| `Ctrl+O, s` | Session switcher |
| `Ctrl+O, f` | Fullscreen toggle |
| `Ctrl+O, d` | Detach session |
| `Ctrl+O, r` | Reload configuration |

## 🚨 Troubleshooting

### **Permission Issues**
If you see permission errors:
```bash
# macOS/Linux
sudo chown -R $(whoami) ~/.orchflow

# Or run with sudo (not recommended)
sudo npx orchflow
```

### **Package Manager Not Found**
OrchFlow tries multiple package managers. If none are found:
```bash
# macOS - Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Linux - Update package lists
sudo apt update  # Ubuntu/Debian
sudo yum update   # RHEL/CentOS
```

### **tmux Installation Fails**
If automatic installation fails, OrchFlow provides manual instructions:
```bash
❌ tmux installation failed

Please install tmux manually:
  Ubuntu/Debian: sudo apt install tmux
  macOS: brew install tmux
  
Then run: npx orchflow
```

### **Configuration Issues**
If tmux configuration fails:
```bash
# Reset OrchFlow configuration
rm -rf ~/.orchflow
npx orchflow

# Or manually fix tmux config
tmux source-file ~/.tmux.conf
```

## 🎯 Advanced Configuration

### **Command Line Options**
```bash
# Force specific mode
npx orchflow --mode=tmux
npx orchflow --mode=inline

# Skip interactive prompts
npx orchflow --auto-detect

# Custom tmux configuration
npx orchflow --split=vertical --split-size=40

# Install dependencies automatically
npx orchflow --install-dependencies
```

### **Environment Variables**
```bash
# Skip tmux installation
export ORCHFLOW_NO_TMUX=true

# Use custom tmux config
export ORCHFLOW_TMUX_CONFIG=~/.my-tmux.conf

# Debug mode
export ORCHFLOW_DEBUG=true
```

## 📊 Performance Expectations

### **Installation Times**
- **Environment detection**: < 1 second
- **tmux installation**: 30 seconds - 2 minutes
- **Configuration setup**: < 5 seconds
- **Total setup time**: 1-3 minutes

### **Resource Usage**
- **Memory**: < 50MB additional
- **CPU**: < 5% during setup
- **Disk**: < 10MB for configurations

### **Network Requirements**
- **Download size**: 5-20MB (depends on tmux version)
- **Bandwidth**: Any connection sufficient for package downloads

## 🎉 Success Indicators

After successful installation, you'll see:
```bash
🎉 OrchFlow Setup Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Setup completed in 1200ms
✓ Mode: Split Terminal
✓ tmux: Installed via Homebrew
✓ tmux: OrchFlow configuration applied

🚀 Key Features Enabled:
  • Ctrl+O prefix key for OrchFlow commands
  • Ctrl+O, 1-9 for quick worker access
  • Ctrl+O, 0 to return to primary terminal
  • Mouse support enabled
  • Enhanced status bar with OrchFlow branding

📋 Next Steps:
  1. OrchFlow will now use tmux for split-screen layout
  2. Your workers will appear in separate panes
  3. Use the key bindings above for efficient navigation
  4. Status updates will appear in the right pane

🚀 OrchFlow is ready! Natural language orchestration active.
```

## 💡 Pro Tips

1. **First-time users**: Choose tmux mode for the full experience
2. **Existing tmux users**: OrchFlow preserves your existing config
3. **VS Code users**: Try the status bar mode for minimal UI
4. **Remote work**: tmux mode works great over SSH
5. **Performance**: Inline mode uses less resources

## 🔄 Updating OrchFlow

```bash
# Update to latest version
npm update -g @orchflow/claude-flow

# Reinstall with fresh configuration
npm uninstall -g @orchflow/claude-flow
rm -rf ~/.orchflow
npm install -g @orchflow/claude-flow
```

## 📞 Support

If you encounter any issues:
1. Check the [troubleshooting section](#-troubleshooting)
2. Run with debug mode: `npx orchflow --debug`
3. Report issues: https://github.com/ruvnet/orchflow/issues

---

**Remember**: OrchFlow handles **everything automatically**. Just choose your preferred mode and let it do the work!