// Central export file for all stores
export { manager, sessions, activeSession, panes, activePaneId, activePane, plugins, loadedPlugins, terminalOutputs, isConnected, error } from './manager';
export { settings } from './settings';
export { terminalSecurity } from './terminalSecurity';

// Legacy alias for backward compatibility
export { manager as TerminalManager } from './manager';