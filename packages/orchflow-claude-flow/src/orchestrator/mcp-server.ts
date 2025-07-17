// Mock MCP imports until package is properly available
interface MCPServerBase {
  setRequestHandler(method: string, handler: any): void;
  connect(transport: any): Promise<void>;
  close(): Promise<void>;
}

interface StdioServerTransport {
  // Mock transport
}

// Mock implementations
const MockMCPServer = class implements MCPServerBase {
  constructor(config: any, options: any) {}
  setRequestHandler(method: string, handler: any): void {}
  async connect(transport: any): Promise<void> {}
  async close(): Promise<void> {}
};

const MockStdioTransport = class implements StdioServerTransport {
  constructor() {}
};
import WebSocket from 'ws';
import http from 'http';
import { EventEmitter } from 'events';

export interface MCPTool {
  name: string;
  description: string;
  parameters: any;
  handler: (params: any) => Promise<any>;
}

export class MCPServer extends EventEmitter {
  private port: number;
  private server?: MCPServerBase;
  private wsServer?: WebSocket.Server;
  private httpServer?: http.Server;
  private tools: Map<string, MCPTool> = new Map();
  private connectedClients: Set<WebSocket> = new Set();

  constructor(port: number) {
    super();
    this.port = port;
  }

  async start(): Promise<void> {
    console.log(`Starting MCP Server on port ${this.port}...`);

    // Create HTTP server for WebSocket
    this.httpServer = http.createServer();
    
    // Initialize WebSocket server for MCP communication
    this.wsServer = new WebSocket.Server({ 
      server: this.httpServer,
      path: '/mcp'
    });

    this.wsServer.on('connection', (ws) => {
      console.log('New MCP client connected');
      this.connectedClients.add(ws);
      
      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          await this.handleMCPMessage(ws, data);
        } catch (error) {
          this.sendError(ws, error);
        }
      });

      ws.on('close', () => {
        this.connectedClients.delete(ws);
        console.log('MCP client disconnected');
      });

      // Send initial capabilities
      this.sendCapabilities(ws);
    });

    // Start HTTP server
    await new Promise<void>((resolve) => {
      this.httpServer!.listen(this.port, () => {
        console.log(`MCP Server listening on port ${this.port}`);
        resolve();
      });
    });

    // Initialize standard MCP server for stdio transport
    this.server = new MockMCPServer({
      name: 'orchflow-mcp-server',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    });

    // Register default tools
    this.registerDefaultTools();
  }

  registerTool(name: string, tool: MCPTool): void {
    this.tools.set(name, tool);
    
    // Register with MCP server if initialized
    if (this.server) {
      this.server.setRequestHandler('tools/call', async (request) => {
        if (request.params.name === name) {
          try {
            const result = await tool.handler(request.params.arguments || {});
            return { content: [{ type: 'text', text: JSON.stringify(result) }] };
          } catch (error: any) {
            return { 
              content: [{ 
                type: 'text', 
                text: `Error: ${error.message}` 
              }],
              isError: true 
            };
          }
        }
        return { content: [{ type: 'text', text: 'Tool not found' }], isError: true };
      });
    }

    // Notify connected clients of new tool
    this.broadcastToolUpdate();
  }

  private registerDefaultTools(): void {
    // List available tools
    this.server?.setRequestHandler('tools/list', async () => {
      return {
        tools: Array.from(this.tools.entries()).map(([name, tool]) => ({
          name,
          description: tool.description,
          inputSchema: {
            type: 'object',
            properties: tool.parameters.properties || {},
            required: tool.parameters.required || []
          }
        }))
      };
    });

    // Handle tool calls
    this.server?.setRequestHandler('tools/call', async (request) => {
      const toolName = request.params.name;
      const tool = this.tools.get(toolName);
      
      if (!tool) {
        return { 
          content: [{ type: 'text', text: `Tool ${toolName} not found` }],
          isError: true 
        };
      }

      try {
        const result = await tool.handler(request.params.arguments || {});
        return { 
          content: [{ 
            type: 'text', 
            text: JSON.stringify(result, null, 2) 
          }] 
        };
      } catch (error: any) {
        return { 
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true 
        };
      }
    });
  }

  private async handleMCPMessage(ws: WebSocket, message: any): Promise<void> {
    const { id, method, params } = message;

    try {
      let result: any;

      switch (method) {
        case 'tools/list':
          result = await this.listTools();
          break;
          
        case 'tools/call':
          result = await this.callTool(params.name, params.arguments);
          break;
          
        case 'capabilities':
          result = this.getCapabilities();
          break;
          
        default:
          throw new Error(`Unknown method: ${method}`);
      }

      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id,
        result
      }));
    } catch (error: any) {
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: error.message
        }
      }));
    }
  }

  private async listTools(): Promise<any> {
    return {
      tools: Array.from(this.tools.entries()).map(([name, tool]) => ({
        name,
        description: tool.description,
        inputSchema: {
          type: 'object',
          properties: tool.parameters.properties || {},
          required: tool.parameters.required || []
        }
      }))
    };
  }

  private async callTool(name: string, args: any): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }

    try {
      const result = await tool.handler(args);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error: any) {
      throw new Error(`Tool execution failed: ${error.message}`);
    }
  }

  private getCapabilities(): any {
    return {
      capabilities: {
        tools: {
          listChanged: true,
          call: true
        }
      }
    };
  }

  private sendCapabilities(ws: WebSocket): void {
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      method: 'capabilities',
      params: this.getCapabilities()
    }));
  }

  private sendError(ws: WebSocket, error: any): void {
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: error.message || 'Internal error'
      }
    }));
  }

  private broadcastToolUpdate(): void {
    const update = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/listChanged',
      params: {}
    });

    this.connectedClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(update);
      }
    });
  }

  async connectStdio(): Promise<void> {
    if (!this.server) {
      throw new Error('Server not initialized');
    }

    const transport = new MockStdioTransport();
    await this.server.connect(transport);
  }

  async stop(): Promise<void> {
    console.log('Stopping MCP Server...');

    // Close all WebSocket connections
    this.connectedClients.forEach(client => {
      client.close();
    });

    // Close WebSocket server
    if (this.wsServer) {
      this.wsServer.close();
    }

    // Close HTTP server
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve());
      });
    }

    // Close MCP server
    if (this.server) {
      await this.server.close();
    }

    this.removeAllListeners();
    console.log('MCP Server stopped');
  }
}