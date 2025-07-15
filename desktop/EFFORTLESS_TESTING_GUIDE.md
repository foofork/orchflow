# Effortless Testing Guide

## 🚀 Quick Start

### Manual Testing - The Simplest Way

```bash
# Web only (for development)
npm run dev

# Desktop app (Tauri)
npm run dev -- --desktop

# That's it! No port conflicts, no manual configuration needed.
```

### Running Tests

```bash
# Visual regression tests (Playwright)
npm run test:visual

# All tests
npm test
```

## 💡 How It Works

The new system uses a single, smart launcher script that:

1. **Automatically finds an available port** - No more port conflicts
2. **Updates Tauri config dynamically** - Desktop mode just works
3. **Handles all cleanup** - Ctrl+C stops everything cleanly
4. **Shows clear status messages** - You always know what's happening

## 🎯 Common Scenarios

### Scenario 1: Quick Frontend Development
```bash
npm run dev
# ✅ Starts on http://localhost:5173 (or next available)
# ✅ Hot reload enabled
# ✅ Just open your browser
```

### Scenario 2: Testing Desktop Features
```bash
npm run dev -- --desktop
# ✅ Starts web server
# ✅ Updates Tauri to use correct port
# ✅ Launches desktop window
# ✅ Both frontend and backend logs visible
```

### Scenario 3: Running Visual Tests
```bash
npm run test:visual
# ✅ Starts dedicated test server
# ✅ Runs Playwright tests
# ✅ Generates screenshots
# ✅ No conflicts with dev server
```

### Scenario 4: Parallel Development
```bash
# Terminal 1: Main development
npm run dev

# Terminal 2: Running tests
npm run test:visual

# Terminal 3: Desktop testing
npm run dev test --desktop

# All run on different ports automatically!
```

## 🛠️ Advanced Usage

### Using Different Port Ranges
```bash
npm run dev test        # Uses test ports (5181-5190)
npm run dev e2e         # Uses e2e ports (5300-5320)
npm run dev visual      # Uses visual ports (5201-5210)
```

### Checking Port Status
```bash
cat .port-locks.json    # See all allocated ports
```

### Force Clean All Ports
```bash
rm .port-locks.json     # Nuclear option - removes all locks
```

## 🎨 Port Allocation Strategy

| Environment | Port Range | Purpose |
|------------|------------|---------|
| dev | 5173-5180 | Daily development |
| test | 5181-5190 | Unit/integration tests |
| visual | 5201-5210 | Playwright visual tests |
| e2e | 5300-5320 | E2E test suites |

## ✨ Benefits

1. **Zero Configuration** - Just run and go
2. **No Port Conflicts** - Automatic allocation
3. **Desktop Ready** - Tauri integration built-in
4. **Test Friendly** - Playwright works out of the box
5. **Clear Feedback** - Always know what's running where
6. **Easy Cleanup** - Ctrl+C stops everything

## 🚫 What You DON'T Need to Do Anymore

- ❌ Manually edit tauri.conf.json
- ❌ Check which ports are in use
- ❌ Start multiple terminals for Tauri
- ❌ Wonder why tests are failing
- ❌ Kill stuck processes

## 📝 Implementation Details

The system consists of:

1. **Smart Launcher** (`scripts/dev.js`) - Unified entry point
2. **Port Manager** (`scripts/port-manager.js`) - Handles allocation
3. **Lock File** (`.port-locks.json`) - Tracks active ports
4. **NPM Scripts** - Simple wrappers for the launcher

## 🐛 Troubleshooting

**Q: Port is already in use?**
A: The port manager will automatically find the next available port.

**Q: Desktop app won't start?**
A: Make sure you have Rust/Tauri dependencies installed.

**Q: Tests failing with connection errors?**
A: Check `.port-locks.json` and remove if corrupted.

**Q: How to run on a specific port?**
A: Currently not supported - the system manages ports for you to avoid conflicts.

## 🎉 That's It!

Testing is now effortless. Just `npm run dev` for web or `npm run dev -- --desktop` for the full app. The system handles everything else.