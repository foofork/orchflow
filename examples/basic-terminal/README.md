# Basic Terminal Example

This example demonstrates how to create and interact with terminals using orchflow's Terminal Streaming API.

## Features Demonstrated

- Creating terminal instances
- Sending input to terminals
- Receiving output streams
- Managing terminal lifecycle
- Multiple terminal coordination

## Running the Example

1. Start orchflow in development mode:
   ```bash
   cd orchflow/frontend
   npm run tauri dev
   ```

2. Navigate to the terminal demo page:
   ```
   http://localhost:5173/terminal-demo
   ```

## What You'll See

- Multiple terminal instances
- Real-time output streaming
- Input synchronization across terminals
- Terminal resize handling
- Process monitoring

## Code Walkthrough

### 1. Terminal Creation

```typescript
// Create a new terminal
const terminalId = `terminal-${Date.now()}`;
await terminalIPC.createTerminal(terminalId, {
  shell: 'bash',
  cwd: process.cwd(),
  rows: 24,
  cols: 80
});
```

### 2. Output Handling

```typescript
// Listen for terminal output
const unlisten = await terminalIPC.onOutput(terminalId, (data) => {
  // Decode base64 data
  const text = atob(data);
  
  // Write to xterm.js terminal
  terminal.write(text);
});
```

### 3. Input Handling

```typescript
// Send user input to terminal
terminal.onData((data) => {
  terminalIPC.sendInput(terminalId, data);
});
```

### 4. Cleanup

```typescript
// Clean up when done
unlisten();
await terminalIPC.closeTerminal(terminalId);
terminal.dispose();
```

## Key Concepts

1. **PTY Management**: Each terminal is backed by a real pseudo-terminal
2. **IPC Streaming**: Output streams through Tauri's IPC for native performance
3. **Base64 Encoding**: Binary-safe transmission of terminal data
4. **Real-time Updates**: Output appears as soon as it's produced

## Extending the Example

Try these modifications:

1. **Add Commands**: Pre-populate with useful commands
2. **Terminal Groups**: Synchronize input across multiple terminals
3. **Session Persistence**: Save and restore terminal sessions
4. **Custom Shells**: Use different shells (zsh, fish, powershell)
5. **Process Monitoring**: Display process information and health

## Common Issues

### Terminal Not Responding
- Check if the process is still running
- Verify terminal ID is correct
- Try restarting the terminal

### Output Not Appearing
- Ensure base64 decoding is working
- Check for IPC event listener setup
- Verify xterm.js terminal is initialized

### Input Not Working
- Check input event handlers
- Verify terminal has focus
- Ensure IPC connection is active

## Next Steps

After understanding this example:

1. Explore the Manager API examples
2. Try building a custom plugin
3. Integrate with your preferred shell
4. Add custom terminal themes