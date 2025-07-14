# UX Components Integration Guide

This document outlines the new UX components that have been implemented to enhance the Orchflow desktop application's user experience.

## Components Implemented

### 1. Toast Notification System 📋

**Files:**
- `/desktop/src/lib/components/ToastNotification.svelte`
- `/desktop/src/lib/components/ToastContainer.svelte`
- `/desktop/src/lib/stores/toast.ts`

**Features:**
- Multiple notification types: success, info, warning, error
- Action buttons for interactive notifications
- Auto-dismissal with customizable duration
- Persistent notifications for critical alerts
- Security-specific notification helpers
- Mobile-responsive design

**Usage Example:**
```typescript
import { toastManager } from '$lib/stores/toast';

// Basic notifications
toastManager.success('Operation completed!');
toastManager.error('Something went wrong');

// With actions
toastManager.errorWithActions(
  'Command failed to execute',
  [
    { label: 'Retry', handler: () => retryCommand() },
    { label: 'Dismiss', handler: () => {} }
  ]
);

// Security alerts
toastManager.securityAlert('Suspicious activity detected', 'warning');
```

**Integration:**
Add `<ToastContainer />` to your main application layout (typically in `App.svelte` or main layout component).

### 2. Enhanced Tooltip Component 💬

**Files:**
- `/desktop/src/lib/components/Tooltip.svelte`

**Features:**
- Multiple variants: default, security, warning, error
- Flexible positioning: top, bottom, left, right
- Interactive tooltips that stay open on hover
- Customizable delay and offset
- Accessibility support with ARIA attributes
- Automatic repositioning to stay in viewport

**Usage Example:**
```svelte
<Tooltip content="This explains the feature" placement="top">
  <button>Hover me</button>
</Tooltip>

<Tooltip 
  content="Security-related information" 
  variant="security" 
  interactive={true}
>
  <div class="security-indicator">🛡️</div>
</Tooltip>
```

**Integration:**
Already integrated into `TerminalSecurityIndicator.svelte` for security tooltips.

### 3. CodeMirror Formatting Support ⚡

**Files:**
- `/desktop/src/lib/components/CodeMirrorEditor.svelte` (enhanced)

**Features:**
- Prettier integration for JavaScript, TypeScript, JSON, YAML
- Format button in editor toolbar
- Keyboard shortcut (Shift+Alt+F)
- Language-specific formatting
- Error handling with toast notifications
- Loading states during formatting

**Usage Example:**
```svelte
<CodeMirrorEditor
  bind:value={code}
  language="javascript"
  showFormatButton={true}
  on:format={(e) => console.log('Formatted!')}
  on:formatError={(e) => console.log('Format failed:', e.detail.error)}
/>

<!-- Or programmatically -->
<script>
  let editor;
  
  function formatCode() {
    editor.format();
  }
</script>

<CodeMirrorEditor bind:this={editor} />
<button on:click={formatCode}>Format</button>
```

### 4. Real-time Security Events WebSocket/SSE 🔗

**Files:**
- `/desktop/src/lib/services/securityEvents.ts`
- `/desktop/src/lib/stores/terminalSecurity.ts` (enhanced)

**Features:**
- WebSocket and Server-Sent Events support
- Automatic reconnection with exponential backoff
- Event type handling: alerts, threats, compliance, audit
- Integration with toast notifications
- Connection status monitoring
- Development simulation mode

**Usage Example:**
```typescript
import { securityEventManager, enableAutoConnect } from '$lib/services/securityEvents';

// Auto-connect (happens automatically when imported)
enableAutoConnect();

// Manual connection
await securityEventManager.connect();

// Subscribe to events
const unsubscribe = securityEventManager.subscribe((event) => {
  console.log('Security event:', event);
});

// Check connection status
if (securityEventManager.isConnected()) {
  console.log('Connected to security events');
}
```

**Configuration:**
The service automatically attempts to connect to `ws://localhost:8080/security-events` for WebSocket or `http://localhost:8080/security-events/stream` for SSE. In development mode, it falls back to simulated events.

## Integration into Existing Components

### CommandBar.svelte
- ✅ Integrated toast notifications for command success/failure
- ✅ User-friendly error messages
- ✅ Success confirmations for all commands

### PluginCommandPalette.svelte
- ✅ Integrated toast notifications for plugin command execution
- ✅ Error handling with detailed messages

### TerminalSecurityIndicator.svelte
- ✅ Enhanced with tooltip support for security tier descriptions
- ✅ Tooltips for tier selection options
- ✅ Real-time security event integration

## Installation Requirements

### NPM Dependencies
The following dependencies should be added to your `package.json`:

```json
{
  "dependencies": {
    "prettier": "^3.0.0"
  },
  "devDependencies": {
    "prettier": "^3.0.0",
    "@types/prettier": "^3.0.0"
  }
}
```

### Prettier Plugins (dynamically imported)
```json
{
  "dependencies": {
    "prettier": "^3.0.0",
    "prettier/plugins/babel": "*",
    "prettier/plugins/estree": "*",
    "prettier/plugins/typescript": "*",
    "prettier/plugins/yaml": "*"
  }
}
```

## CSS Variables

The components use CSS custom properties for theming. Ensure these are defined in your global styles:

```css
:root {
  /* Colors */
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --bg-tertiary: #f1f5f9;
  --fg-primary: #1a1a1a;
  --fg-secondary: #6b7280;
  --fg-tertiary: #9ca3af;
  --border: #e1e5e9;
  
  /* Accent colors */
  --accent: #3b82f6;
  --accent-fg: #ffffff;
  --accent-hover: #2563eb;
  
  /* Status colors */
  --success: #10b981;
  --warning: #f59e0b;
  --error: #ef4444;
  
  /* Spacing */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  
  /* Border radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  
  /* Transitions */
  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --ease-out: cubic-bezier(0.4, 0, 0.2, 1);
  
  /* Typography */
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', monospace;
  --font-body: 14px;
  --font-body-sm: 12px;
  --font-body-xs: 11px;
}
```

## Demo Component

A comprehensive demo component has been created at `/desktop/src/lib/components/UXEnhancementsDemo.svelte` that showcases all the new features:

- Toast notification examples
- Tooltip variants demonstration
- Code formatting functionality
- Security indicator integration
- Real-time connection status

## Security Event Server Setup

For production use, you'll need a security event server that provides:

1. **WebSocket endpoint**: `ws://your-server/security-events`
2. **SSE endpoint**: `http://your-server/security-events/stream`

### Example Event Format

```json
{
  "type": "threat",
  "severity": "error",
  "timestamp": "2024-01-15T10:30:00Z",
  "terminalId": "terminal-123",
  "sessionId": "session-456",
  "data": {
    "threatType": "malicious_command",
    "command": "rm -rf /*",
    "riskScore": 9,
    "indicators": ["Destructive command", "No confirmation"],
    "recommendation": "Block command and investigate"
  }
}
```

## Performance Considerations

1. **Lazy Loading**: Prettier is dynamically imported to reduce initial bundle size
2. **Toast Limits**: Toast container automatically limits to prevent memory leaks
3. **WebSocket Optimization**: Heartbeat and reconnection logic minimize connection overhead
4. **Tooltip Debouncing**: Tooltips use proper delays to prevent excessive rendering

## Testing

All components include comprehensive tests and are designed to work in:
- Development mode with simulation
- Production mode with real backends
- Offline scenarios with graceful degradation

## Future Enhancements

Potential improvements for future versions:
1. Notification persistence across sessions
2. More formatter integrations (rustfmt, black, etc.)
3. Advanced security event filtering
4. Tooltip positioning intelligence
5. Toast notification grouping
6. Keyboard shortcuts for toast actions

## Troubleshooting

### Common Issues

1. **Prettier not working**: Ensure all required plugins are installed
2. **WebSocket connection failing**: Check server endpoint and CORS settings
3. **Tooltips not showing**: Verify CSS variables are defined
4. **Toasts not appearing**: Ensure `ToastContainer` is added to your app

### Debug Mode

Enable debug logging by setting:
```javascript
localStorage.setItem('debug', 'orchflow:*');
```

This will provide detailed logging for all component interactions and event handling.