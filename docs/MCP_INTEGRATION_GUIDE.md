# MCP (Model Context Protocol) Integration Guide for OrchFlow

## Overview

The Model Context Protocol (MCP) is an open standard introduced by Anthropic that enables seamless integration between AI systems and external data sources/tools. This guide provides comprehensive information for integrating MCP into OrchFlow and understanding Claude Code's MCP architecture.

## Table of Contents

1. [Protocol Specification](#protocol-specification)
2. [Architecture Overview](#architecture-overview)
3. [Claude Code Integration](#claude-code-integration)
4. [Implementation Details](#implementation-details)
5. [Performance & Scalability](#performance--scalability)
6. [Security Considerations](#security-considerations)
7. [Best Practices](#best-practices)
8. [Reference Implementations](#reference-implementations)

## Protocol Specification

### Core Foundation
- **Protocol Version**: 2024-11-05
- **Base Protocol**: JSON-RPC 2.0 (stateful)
- **Inspired By**: Language Server Protocol (LSP)

### Message Types

#### Request-Response Methods
```typescript
// Session lifecycle
initialize    // Protocol version negotiation
initialized   // Confirmation notification
shutdown      // Graceful termination

// Tools
tools/list    // List available tools
tools/call    // Execute a tool

// Prompts
prompts/list  // List available prompts
prompts/get   // Retrieve prompt template

// Resources
resources/list         // List available resources
resources/read         // Read resource content
resources/subscribe    // Subscribe to updates
resources/unsubscribe  // Cancel subscription

// Advanced features
sampling/createMessage // Server-initiated behaviors
logging/setLevel      // Adjust log verbosity
```

#### Notifications
```typescript
notifications/progress              // Progress updates
notifications/tools/list_changed    // Tool list updated
notifications/prompts/list_changed  // Prompt list updated
notifications/resources/list_changed // Resource list updated
```

### Core Primitives

1. **Tools**: Functions the AI can execute
   ```typescript
   interface MCPTool {
     name: string;
     description: string;
     inputSchema: {
       type: 'object';
       properties: Record<string, any>;
       required?: string[];
     };
   }
   ```

2. **Resources**: Data exposed by the server
   ```typescript
   interface MCPResource {
     uri: string;
     name: string;
     description?: string;
     mimeType?: string;
   }
   ```

3. **Prompts**: Conversation templates
   ```typescript
   interface MCPPrompt {
     name: string;
     description: string;
     arguments?: Array<{
       name: string;
       description: string;
       required: boolean;
     }>;
   }
   ```

## Architecture Overview

### Component Hierarchy
```
┌─────────────────────┐
│   Host (Claude)     │
├─────────────────────┤
│  MCP Client 1       │──────┐
│  MCP Client 2       │      │ 1:1 connections
│  MCP Client N       │      │
└─────────────────────┘      │
                             │
┌─────────────────────┐      │
│   MCP Servers       │◄─────┘
├─────────────────────┤
│  Server 1 (Local)   │ stdio transport
│  Server 2 (Remote)  │ HTTP/WebSocket
│  Server 3 (Custom)  │ Custom transport
└─────────────────────┘
```

### Transport Mechanisms

1. **Stdio (Local)**
   - For same-machine integrations
   - Uses stdin/stdout for communication
   - Lowest latency, highest security
   - Example: `npx claude-flow mcp start`

2. **HTTP + SSE**
   - For remote servers
   - HTTP for requests, SSE for responses
   - Supports authentication (OAuth 2.1)
   - Example: `https://api.example.com/mcp`

3. **WebSocket**
   - Bidirectional real-time communication
   - Persistent connections
   - Good for streaming updates
   - Example: `wss://api.example.com/mcp`

## Claude Code Integration

### Adding MCP Servers

```bash
# Basic syntax
claude mcp add <server-name> <command>

# Examples
claude mcp add claude-flow npx claude-flow mcp start
claude mcp add python-server python /path/to/server.py
claude mcp add node-server node /path/to/server.js
```

### Configuration Format

```json
{
  "mcpServers": {
    "claude-flow": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "claude-flow", "mcp", "start"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### Tool Naming Convention
- Format: `mcp__<server-name>__<tool-name>`
- Example: `mcp__claude-flow__swarm_init`

### Batch Operations
Claude Code supports parallel tool calls in a single message:

```javascript
// ✅ CORRECT - Single message with multiple operations
[BatchTool]:
  mcp__claude-flow__swarm_init { topology: "mesh" }
  mcp__claude-flow__agent_spawn { type: "researcher" }
  mcp__claude-flow__agent_spawn { type: "coder" }
  mcp__claude-flow__memory_usage { action: "store", key: "data" }
```

## Implementation Details

### OrchFlow MCP Architecture

#### Registry Pattern
```typescript
export class MCPRegistry {
  private servers: Map<string, MCPServer> = new Map();
  private clients: Map<string, MCPClient> = new Map();
  
  // Aggregated capabilities across all servers
  private allTools: Map<string, { serverId: string; tool: MCPTool }>;
  private allPrompts: Map<string, { serverId: string; prompt: MCPPrompt }>;
  private allResources: Map<string, { serverId: string; resource: MCPResource }>;
  
  async registerServer(config: MCPServerConfig): Promise<void> {
    // Create transport (stdio/http/websocket)
    // Initialize client with capabilities
    // Setup event handlers
    // Auto-connect if requested
  }
}
```

#### Key Features
1. **Multi-server support**: Connect to multiple MCP servers simultaneously
2. **Automatic reconnection**: Configurable retry logic with backoff
3. **Event-driven**: Integration with OrchFlow's event bus
4. **Metrics collection**: Performance tracking for all operations
5. **Aggregated capabilities**: Unified view of all tools/resources

### Creating an MCP Server

#### TypeScript Example
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({
  name: 'my-mcp-server',
  version: '1.0.0',
}, {
  capabilities: {
    tools: true,
    resources: true,
    prompts: true,
  },
});

// Register tools
server.setRequestHandler('tools/list', async () => ({
  tools: [{
    name: 'example_tool',
    description: 'An example tool',
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string' }
      },
      required: ['input']
    }
  }]
}));

// Handle tool calls
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;
  if (name === 'example_tool') {
    return { result: `Processed: ${args.input}` };
  }
  throw new Error('Unknown tool');
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

#### Python Example
```python
from mcp import Server, Tool
from mcp.server.stdio import stdio_server

server = Server("my-mcp-server")

@server.tool()
async def example_tool(input: str) -> str:
    """An example tool that processes input."""
    return f"Processed: {input}"

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options()
        )

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

## Performance & Scalability

### Performance Considerations

1. **RPC Overhead**
   - Each tool call is out-of-process
   - JSON serialization/deserialization cost
   - Network latency for remote servers

2. **Optimization Strategies**
   - Use JSON-RPC batching for multiple operations
   - Prefer stdio transport for local operations
   - Implement caching for frequently accessed resources
   - Monitor latency and throughput metrics

3. **Connection Management**
   - Clients maintain 1:1 persistent connections
   - No built-in load balancing (implement externally)
   - Connection pooling handled by registry

### Scalability Patterns

1. **Horizontal Scaling**
   ```typescript
   // Register multiple instances of same server type
   await registry.registerServer({
     id: 'worker-1',
     endpoint: 'http://worker1.example.com/mcp',
     // ...
   });
   
   await registry.registerServer({
     id: 'worker-2', 
     endpoint: 'http://worker2.example.com/mcp',
     // ...
   });
   ```

2. **Circuit Breakers**
   - Implement failure detection
   - Automatic fallback mechanisms
   - Gradual recovery strategies

3. **Resource Management**
   - Monitor memory usage
   - Implement connection limits
   - Clean up inactive sessions

## Security Considerations

### Authentication & Authorization

1. **OAuth 2.1 Support**
   - Required for remote HTTP servers
   - Token-based authentication
   - Refresh token handling

2. **Permission Model**
   - Explicit user consent for tool execution
   - Capability-based access control
   - Audit logging for all operations

### Best Practices

1. **Local-First**
   - Default to stdio transport
   - Minimize network exposure
   - Validate all inputs

2. **Input Validation**
   ```typescript
   // Always validate tool inputs
   const schema = tool.inputSchema;
   const valid = validateSchema(args, schema);
   if (!valid) {
     throw new Error('Invalid arguments');
   }
   ```

3. **Error Handling**
   - Use proper JSON-RPC error codes
   - Provide meaningful error messages
   - Log security-relevant events

## Best Practices

### Server Development

1. **Clear Tool Descriptions**
   ```typescript
   {
     name: 'fetch_user_data',
     description: 'Fetches user data by ID. Returns user profile including name, email, and preferences.',
     inputSchema: {
       type: 'object',
       properties: {
         userId: {
           type: 'string',
           description: 'The unique identifier of the user'
         }
       },
       required: ['userId']
     }
   }
   ```

2. **Resource Organization**
   - Use hierarchical URIs: `project://path/to/resource`
   - Include metadata in resource descriptions
   - Support pagination for large datasets

3. **State Management**
   - Maintain session context between calls
   - Implement proper cleanup on disconnect
   - Handle concurrent requests safely

### Client Integration

1. **Capability Discovery**
   ```typescript
   // Check server capabilities before use
   const capabilities = server.capabilities;
   if (capabilities.tools) {
     const tools = await client.listTools();
   }
   ```

2. **Error Recovery**
   ```typescript
   try {
     const result = await client.callTool('example', args);
   } catch (error) {
     if (error.code === -32601) {
       // Method not found - server doesn't support this tool
     }
   }
   ```

3. **Performance Monitoring**
   ```typescript
   const startTime = Date.now();
   const result = await client.callTool('example', args);
   const duration = Date.now() - startTime;
   metrics.record('tool.call.duration', duration);
   ```

## Reference Implementations

### Official Examples
- **modelcontextprotocol/servers**: Official server implementations
- **microsoft/mcp-for-beginners**: Comprehensive tutorials
- **FastMCP (Python)**: High-level Pythonic framework

### Community Resources
- **awesome-mcp-servers**: Curated list of MCP servers
- **create-mcp-ts**: TypeScript project generator
- **mcp-server-guide**: Implementation examples

### Common Patterns

1. **Database Connectivity**
   - SQLAlchemy for Python
   - TypeORM for TypeScript
   - Connection pooling

2. **API Integration**
   - REST API wrappers
   - GraphQL support
   - WebSocket streaming

3. **File System Access**
   - Safe path resolution
   - Permission checking
   - Watch for changes

## Conclusion

MCP provides a standardized way to extend AI capabilities with external tools and data sources. By following this guide and the best practices outlined, you can successfully integrate MCP into OrchFlow and create powerful, scalable AI-enhanced applications.

For the latest updates and specifications, visit:
- Official docs: https://modelcontextprotocol.io
- GitHub: https://github.com/modelcontextprotocol
- OrchFlow integration: See `/orchestrator/src/mcp/`