// Event types for orchflow orchestration

export enum OrchflowEvents {
  // Terminal events
  TERMINAL_SPAWNED = 'terminal:spawned',
  TERMINAL_CLOSED = 'terminal:closed',
  TERMINAL_OUTPUT = 'terminal:output',
  TERMINAL_ERROR = 'terminal:error',
  
  // Agent events
  AGENT_CREATED = 'agent:created',
  AGENT_STARTED = 'agent:started',
  AGENT_STOPPED = 'agent:stopped',
  AGENT_MESSAGE = 'agent:message',
  AGENT_ERROR = 'agent:error',
  AGENT_STATUS_CHANGED = 'agent:status:changed',
  
  // File system events
  FILE_OPENED = 'file:opened',
  FILE_CLOSED = 'file:closed',
  FILE_SAVED = 'file:saved',
  FILE_CHANGED = 'file:changed',
  
  // WebSocket events
  WS_CLIENT_CONNECTED = 'ws:client:connected',
  WS_CLIENT_DISCONNECTED = 'ws:client:disconnected',
  WS_MESSAGE_RECEIVED = 'ws:message:received',
  
  // Tmux events
  TMUX_SESSION_CREATED = 'tmux:session:created',
  TMUX_SESSION_DESTROYED = 'tmux:session:destroyed',
  TMUX_PANE_CREATED = 'tmux:pane:created',
  TMUX_PANE_CLOSED = 'tmux:pane:closed',
  
  // Command events
  COMMAND_EXECUTED = 'command:executed',
  COMMAND_COMPLETED = 'command:completed',
  COMMAND_FAILED = 'command:failed',
  
  // System events
  SYSTEM_READY = 'system:ready',
  SYSTEM_ERROR = 'system:error',
  SYSTEM_SHUTDOWN = 'system:shutdown',
  
  // MCP events
  MCP_SERVER_REGISTERED = 'mcp:server:registered',
  MCP_SERVER_UNREGISTERED = 'mcp:server:unregistered',
  MCP_SERVER_CONNECTED = 'mcp:server:connected',
  MCP_SERVER_DISCONNECTED = 'mcp:server:disconnected',
  MCP_SERVER_ERROR = 'mcp:server:error',
  MCP_TOOLS_CHANGED = 'mcp:tools:changed',
  MCP_PROMPTS_CHANGED = 'mcp:prompts:changed',
  MCP_RESOURCES_CHANGED = 'mcp:resources:changed',
  MCP_NOTIFICATION = 'mcp:notification',
  MCP_PROGRESS = 'mcp:progress',
}

// Event payload types
export interface TerminalSpawnedEvent {
  terminalId: string;
  agentId?: string;
  sessionName: string;
  paneId: string;
}

export interface TerminalOutputEvent {
  terminalId: string;
  output: string;
  timestamp: Date;
}

export interface AgentCreatedEvent {
  agentId: string;
  name: string;
  type: string;
  config?: any;
}

export interface AgentStatusChangedEvent {
  agentId: string;
  oldStatus: string;
  newStatus: string;
}

export interface AgentMessageEvent {
  agentId: string;
  message: string;
  level: 'info' | 'warn' | 'error';
}

export interface FileOpenedEvent {
  filePath: string;
  editorId?: string;
}

export interface WebSocketMessageEvent {
  clientId: string;
  type: string;
  data: any;
}

export interface CommandExecutedEvent {
  command: string;
  args?: string[];
  agentId?: string;
}

// Event map for type safety
export interface OrchflowEventMap {
  [OrchflowEvents.TERMINAL_SPAWNED]: TerminalSpawnedEvent;
  [OrchflowEvents.TERMINAL_CLOSED]: { terminalId: string };
  [OrchflowEvents.TERMINAL_OUTPUT]: TerminalOutputEvent;
  [OrchflowEvents.TERMINAL_ERROR]: { terminalId: string; error: string };
  
  [OrchflowEvents.AGENT_CREATED]: AgentCreatedEvent;
  [OrchflowEvents.AGENT_STARTED]: { agentId: string };
  [OrchflowEvents.AGENT_STOPPED]: { agentId: string };
  [OrchflowEvents.AGENT_MESSAGE]: AgentMessageEvent;
  [OrchflowEvents.AGENT_ERROR]: { agentId: string; error: string };
  [OrchflowEvents.AGENT_STATUS_CHANGED]: AgentStatusChangedEvent;
  
  [OrchflowEvents.FILE_OPENED]: FileOpenedEvent;
  [OrchflowEvents.FILE_CLOSED]: { filePath: string };
  [OrchflowEvents.FILE_SAVED]: { filePath: string };
  [OrchflowEvents.FILE_CHANGED]: { filePath: string };
  
  [OrchflowEvents.WS_CLIENT_CONNECTED]: { clientId: string };
  [OrchflowEvents.WS_CLIENT_DISCONNECTED]: { clientId: string };
  [OrchflowEvents.WS_MESSAGE_RECEIVED]: WebSocketMessageEvent;
  
  [OrchflowEvents.TMUX_SESSION_CREATED]: { sessionName: string };
  [OrchflowEvents.TMUX_SESSION_DESTROYED]: { sessionName: string };
  [OrchflowEvents.TMUX_PANE_CREATED]: { sessionName: string; paneId: string };
  [OrchflowEvents.TMUX_PANE_CLOSED]: { sessionName: string; paneId: string };
  
  [OrchflowEvents.COMMAND_EXECUTED]: CommandExecutedEvent;
  [OrchflowEvents.COMMAND_COMPLETED]: { command: string; result: any };
  [OrchflowEvents.COMMAND_FAILED]: { command: string; error: string };
  
  [OrchflowEvents.SYSTEM_READY]: void;
  [OrchflowEvents.SYSTEM_ERROR]: { error: string };
  [OrchflowEvents.SYSTEM_SHUTDOWN]: void;
  
  [OrchflowEvents.MCP_SERVER_REGISTERED]: { serverId: string; server: any };
  [OrchflowEvents.MCP_SERVER_UNREGISTERED]: { serverId: string };
  [OrchflowEvents.MCP_SERVER_CONNECTED]: { serverId: string };
  [OrchflowEvents.MCP_SERVER_DISCONNECTED]: { serverId: string };
  [OrchflowEvents.MCP_SERVER_ERROR]: { serverId: string; error: any };
  [OrchflowEvents.MCP_TOOLS_CHANGED]: { serverId: string };
  [OrchflowEvents.MCP_PROMPTS_CHANGED]: { serverId: string };
  [OrchflowEvents.MCP_RESOURCES_CHANGED]: { serverId: string };
  [OrchflowEvents.MCP_NOTIFICATION]: { serverId: string; notification: any };
  [OrchflowEvents.MCP_PROGRESS]: { serverId: string; progress: any };
}