# Playwright Port Conflicts Fix Summary

## Issues Fixed

### 1. Port Conflicts (EADDRINUSE)
**Problem:** Playwright tests failing because port 5173 was already in use by development servers.

**Solution:**
- **Dynamic port allocation**: Modified both Vite and Playwright configs to use environment variables for port selection
- **Fallback ports**: System now tries ports 5174, 5175, 5176, etc. when 5173 is unavailable  
- **Global setup**: Added port discovery logic in `tests/setup/global.setup.ts`
- **Cleanup automation**: Created cleanup scripts to kill leftover processes and remove socket files

### 2. Socket File Cleanup
**Problem:** Leftover socket files from previous test runs causing conflicts.

**Solution:**
- **Comprehensive cleanup**: Remove vite temp files, socket files, and lock files
- **Automated cleanup**: Added cleanup step to all test commands
- **Global teardown**: Proper cleanup after test completion

### 3. TypeScript Type Issues  
**Problem:** `toHaveScreenshot` method not recognized, missing Playwright types.

**Solution:**
- **Type definitions**: Added `@playwright/test` to `tsconfig.json` types
- **Custom types**: Created `tests/playwright.d.ts` for additional type support
- **Proper imports**: Updated test files with correct type imports

### 4. Process Management
**Problem:** Leftover development server processes interfering with new test runs.

**Solution:**
- **Process cleanup**: Kill leftover vite, npm dev, and node processes on startup
- **Port management**: Force kill processes on specific ports before tests
- **Global hooks**: Use Playwright's globalSetup/globalTeardown for coordination

## Files Modified/Created

### Configuration Files
- `playwright.config.ts` - Dynamic port allocation, global setup/teardown
- `vite.config.ts` - Environment variable port configuration  
- `tsconfig.json` - Added Playwright types
- `package.json` - Updated test scripts with cleanup

### Setup/Teardown Scripts
- `tests/setup/global.setup.ts` - Port discovery, cleanup, browser setup
- `tests/setup/global.teardown.ts` - Comprehensive cleanup after tests
- `tests/playwright.d.ts` - TypeScript type definitions

### Utility Scripts
- `scripts/cleanup-test-environment.js` - Manual cleanup utility
- `scripts/test-port-allocation.js` - Port allocation testing
- `scripts/verify-playwright-fix.js` - End-to-end verification

## Usage

### Running Tests
```bash
# All tests with automatic cleanup
npm run test:visual

# Individual commands
npm run test:visual:cleanup  # Manual cleanup
npm run test:visual:debug    # Debug mode
npm run test:visual:ui       # Interactive UI
```

### Manual Cleanup
```bash
# Clean up test environment
npm run test:visual:cleanup

# Or run directly
node scripts/cleanup-test-environment.js
```

### Port Configuration
```bash
# Set specific port
PLAYWRIGHT_PORT=5175 npm run test:visual

# Or set in environment
export PLAYWRIGHT_PORT=5176
npm run test:visual
```

## How It Works

### 1. Port Discovery Process
1. **Global setup** runs first and finds available port starting from 5174
2. **Environment variable** `PLAYWRIGHT_PORT` is set with discovered port
3. **Vite config** uses this port for development server  
4. **Playwright config** uses same port for baseURL

### 2. Cleanup Process
1. **Pre-test cleanup**: Kill leftover processes, remove temp files
2. **During tests**: Proper server lifecycle management
3. **Post-test cleanup**: Global teardown ensures clean state

### 3. Error Handling
- **Port conflicts**: Automatic fallback to next available port
- **Process conflicts**: Force kill conflicting processes
- **Socket conflicts**: Remove leftover socket files
- **Timeout handling**: Prevent hanging processes

## Benefits

- ✅ **No more port conflicts** - Dynamic allocation prevents EADDRINUSE errors
- ✅ **Clean test environment** - Automated cleanup removes interference  
- ✅ **TypeScript support** - Proper type definitions for Playwright methods
- ✅ **Robust process management** - Handles leftover processes gracefully
- ✅ **CI/CD ready** - Works in both local and CI environments
- ✅ **Easy debugging** - Clear error messages and cleanup utilities

## Troubleshooting

### If tests still fail with port errors:
```bash
# Manual cleanup and retry
npm run test:visual:cleanup
npm run test:visual
```

### To check port availability:
```bash
node scripts/test-port-allocation.js
```

### To verify the fix:
```bash
node scripts/verify-playwright-fix.js
```

### Common issues:
1. **Permission errors**: Run cleanup with appropriate permissions
2. **Process stuck**: Manually kill processes: `pkill -f vite`
3. **Socket files**: Remove manually: `find /tmp -name "*vite*" -delete`

The fix provides a robust, automated solution that prevents port conflicts while maintaining proper cleanup and TypeScript support.