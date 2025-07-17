/**
 * Integration tests for MCP tool registration through public API
 * Tests registration, discovery, and execution of MCP tools
 */

import { OrchFlowMCPServer } from '../../src/mcp/orchflow-mcp-server';
import { MCPTool, MCPRequest, MCPResponse } from '../../src/types/unified-interfaces';
import { OrchFlowCore } from '../../src/core/orchflow-core';
import { ConfigurationManager } from '../../src/managers/configuration-manager';

describe('MCP Registration Integration Tests', () => {
  let mcpServer: OrchFlowMCPServer;
  let orchFlowCore: OrchFlowCore;
  let configManager: ConfigurationManager;

  beforeEach(async () => {
    configManager = ConfigurationManager.getInstance();
    orchFlowCore = OrchFlowCore.getInstance();
    mcpServer = new OrchFlowMCPServer();
    
    // Initialize the server
    await mcpServer.initialize();
  });

  afterEach(async () => {
    await mcpServer.shutdown();
  });

  describe('Tool Registration', () => {
    it('should register MCP tools correctly', async () => {
      const testTool: MCPTool = {
        name: 'test-tool',
        description: 'A test tool for integration testing',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          }
        },
        handler: async (params: any) => {
          return { result: `Processed: ${params.input}` };
        }
      };

      const success = await mcpServer.registerTool(testTool);
      expect(success).toBe(true);

      // Verify tool was registered
      const tools = await mcpServer.listTools();
      expect(tools.find(t => t.name === 'test-tool')).toBeDefined();
    });

    it('should handle tool registration conflicts', async () => {
      const tool1: MCPTool = {
        name: 'duplicate-tool',
        description: 'First tool',
        parameters: { type: 'object' },
        handler: async () => ({ result: 'first' })
      };

      const tool2: MCPTool = {
        name: 'duplicate-tool',
        description: 'Second tool',
        parameters: { type: 'object' },
        handler: async () => ({ result: 'second' })
      };

      const success1 = await mcpServer.registerTool(tool1);
      expect(success1).toBe(true);

      const success2 = await mcpServer.registerTool(tool2);
      expect(success2).toBe(false); // Should fail due to duplicate name
    });

    it('should register built-in OrchFlow tools', async () => {
      const tools = await mcpServer.listTools();
      
      // Check for expected built-in tools
      const expectedTools = [
        'orchflow-spawn-worker',
        'orchflow-list-workers',
        'orchflow-worker-status',
        'orchflow-execute-task',
        'orchflow-get-session-data'
      ];

      expectedTools.forEach(toolName => {
        expect(tools.find(t => t.name === toolName)).toBeDefined();
      });
    });
  });

  describe('Tool Discovery', () => {
    it('should discover registered tools', async () => {
      const tools = await mcpServer.listTools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      tools.forEach(tool => {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
      });
    });

    it('should provide tool information', async () => {
      const tools = await mcpServer.listTools();
      
      if (tools.length > 0) {
        const tool = tools[0];
        const info = await mcpServer.getToolInfo(tool.name);
        
        expect(info).toBeDefined();
        expect(info.name).toBe(tool.name);
        expect(info.description).toBe(tool.description);
        expect(info.inputSchema).toBeDefined();
      }
    });

    it('should handle tool info requests for non-existent tools', async () => {
      const info = await mcpServer.getToolInfo('non-existent-tool');
      expect(info).toBeNull();
    });
  });

  describe('Tool Execution', () => {
    it('should execute registered tools correctly', async () => {
      const testTool: MCPTool = {
        name: 'execution-test',
        description: 'Test tool execution',
        parameters: {
          type: 'object',
          properties: {
            value: { type: 'number' }
          }
        },
        handler: async (params: any) => {
          return { result: params.value * 2 };
        }
      };

      await mcpServer.registerTool(testTool);
      
      const request: MCPRequest = {
        method: 'tools/call',
        params: {
          name: 'execution-test',
          arguments: { value: 5 }
        }
      };

      const response = await mcpServer.handleRequest(request);
      
      expect(response.result).toBeDefined();
      expect(response.result.result).toBe(10);
    });

    it('should handle tool execution errors', async () => {
      const errorTool: MCPTool = {
        name: 'error-tool',
        description: 'Tool that throws errors',
        parameters: { type: 'object' },
        handler: async () => {
          throw new Error('Test error');
        }
      };

      await mcpServer.registerTool(errorTool);
      
      const request: MCPRequest = {
        method: 'tools/call',
        params: {
          name: 'error-tool',
          arguments: {}
        }
      };

      const response = await mcpServer.handleRequest(request);
      
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('Test error');
    });

    it('should execute built-in OrchFlow tools', async () => {
      const request: MCPRequest = {
        method: 'tools/call',
        params: {
          name: 'orchflow-list-workers',
          arguments: {}
        }
      };

      const response = await mcpServer.handleRequest(request);
      
      expect(response.result).toBeDefined();
      expect(Array.isArray(response.result.workers)).toBe(true);
    });
  });

  describe('OrchFlow Core Integration', () => {
    it('should integrate with OrchFlow core for worker management', async () => {
      const request: MCPRequest = {
        method: 'tools/call',
        params: {
          name: 'orchflow-spawn-worker',
          arguments: {
            type: 'researcher',
            task: 'Test research task'
          }
        }
      };

      const response = await mcpServer.handleRequest(request);
      
      expect(response.result).toBeDefined();
      expect(response.result.workerId).toBeDefined();
      expect(response.result.success).toBe(true);
    });

    it('should provide session data through MCP', async () => {
      const request: MCPRequest = {
        method: 'tools/call',
        params: {
          name: 'orchflow-get-session-data',
          arguments: {}
        }
      };

      const response = await mcpServer.handleRequest(request);
      
      expect(response.result).toBeDefined();
      expect(response.result.sessionData).toBeDefined();
      expect(response.result.sessionData.workers).toBeDefined();
      expect(response.result.sessionData.tasks).toBeDefined();
    });

    it('should handle worker status requests', async () => {
      // First spawn a worker
      const spawnRequest: MCPRequest = {
        method: 'tools/call',
        params: {
          name: 'orchflow-spawn-worker',
          arguments: {
            type: 'coder',
            task: 'Test coding task'
          }
        }
      };

      const spawnResponse = await mcpServer.handleRequest(spawnRequest);
      expect(spawnResponse.result?.success).toBe(true);

      // Then get worker status
      const statusRequest: MCPRequest = {
        method: 'tools/call',
        params: {
          name: 'orchflow-worker-status',
          arguments: {
            workerId: spawnResponse.result?.workerId
          }
        }
      };

      const statusResponse = await mcpServer.handleRequest(statusRequest);
      
      expect(statusResponse.result).toBeDefined();
      expect(statusResponse.result.worker).toBeDefined();
      expect(statusResponse.result.worker.id).toBe(spawnResponse.result?.workerId);
    });
  });

  describe('Configuration Integration', () => {
    it('should respect configuration settings', async () => {
      const config = await configManager.load();
      
      // Test if MCP server respects configuration
      expect(mcpServer.isRunning()).toBe(true);
      
      // Test configuration-dependent behavior
      const tools = await mcpServer.listTools();
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should handle configuration updates', async () => {
      const originalConfig = await configManager.load();
      
      // Update configuration
      await configManager.updateConfig({
        server: {
          ...originalConfig.server,
          enableMCP: true
        }
      });

      // Verify MCP server adapts to configuration changes
      expect(mcpServer.isRunning()).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed requests', async () => {
      const malformedRequest = {
        method: 'invalid-method',
        params: 'invalid-params'
      } as any;

      const response = await mcpServer.handleRequest(malformedRequest);
      
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBeDefined();
      expect(response.error?.message).toBeDefined();
    });

    it('should handle missing tool calls', async () => {
      const request: MCPRequest = {
        method: 'tools/call',
        params: {
          name: 'non-existent-tool',
          arguments: {}
        }
      };

      const response = await mcpServer.handleRequest(request);
      
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('Tool not found');
    });

    it('should handle invalid tool parameters', async () => {
      const testTool: MCPTool = {
        name: 'param-test',
        description: 'Test parameter validation',
        parameters: {
          type: 'object',
          properties: {
            required: { type: 'string' }
          },
          required: ['required']
        },
        handler: async (params: any) => {
          return { result: params.required };
        }
      };

      await mcpServer.registerTool(testTool);
      
      const request: MCPRequest = {
        method: 'tools/call',
        params: {
          name: 'param-test',
          arguments: {} // Missing required parameter
        }
      };

      const response = await mcpServer.handleRequest(request);
      
      expect(response.error).toBeDefined();
    });
  });

  describe('Performance Integration', () => {
    it('should handle concurrent tool executions', async () => {
      const concurrentTool: MCPTool = {
        name: 'concurrent-tool',
        description: 'Tool for concurrent testing',
        parameters: {
          type: 'object',
          properties: {
            delay: { type: 'number' }
          }
        },
        handler: async (params: any) => {
          await new Promise(resolve => setTimeout(resolve, params.delay || 10));
          return { result: Date.now() };
        }
      };

      await mcpServer.registerTool(concurrentTool);
      
      const requests = Array.from({ length: 5 }, (_, i) => ({
        method: 'tools/call',
        params: {
          name: 'concurrent-tool',
          arguments: { delay: 10 }
        }
      }));

      const startTime = Date.now();
      const responses = await Promise.all(
        requests.map(req => mcpServer.handleRequest(req))
      );
      const endTime = Date.now();

      // Should complete in parallel, not sequentially
      expect(endTime - startTime).toBeLessThan(100); // Should be much faster than 5 * 10ms
      
      responses.forEach(response => {
        expect(response.result).toBeDefined();
        expect(response.result.result).toBeDefined();
      });
    });

    it('should handle large parameter sets', async () => {
      const largeTool: MCPTool = {
        name: 'large-tool',
        description: 'Tool for large parameter testing',
        parameters: { type: 'object' },
        handler: async (params: any) => {
          return { result: Object.keys(params).length };
        }
      };

      await mcpServer.registerTool(largeTool);
      
      const largeParams = Array.from({ length: 1000 }, (_, i) => [`key${i}`, `value${i}`])
        .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});

      const request: MCPRequest = {
        method: 'tools/call',
        params: {
          name: 'large-tool',
          arguments: largeParams
        }
      };

      const response = await mcpServer.handleRequest(request);
      
      expect(response.result).toBeDefined();
      expect(response.result.result).toBe(1000);
    });
  });

  describe('Public API Integration', () => {
    it('should expose public API methods', () => {
      expect(typeof mcpServer.registerTool).toBe('function');
      expect(typeof mcpServer.unregisterTool).toBe('function');
      expect(typeof mcpServer.listTools).toBe('function');
      expect(typeof mcpServer.getToolInfo).toBe('function');
      expect(typeof mcpServer.handleRequest).toBe('function');
    });

    it('should allow tool unregistration', async () => {
      const testTool: MCPTool = {
        name: 'unregister-test',
        description: 'Test tool unregistration',
        parameters: { type: 'object' },
        handler: async () => ({ result: 'test' })
      };

      await mcpServer.registerTool(testTool);
      
      let tools = await mcpServer.listTools();
      expect(tools.find(t => t.name === 'unregister-test')).toBeDefined();

      const success = await mcpServer.unregisterTool('unregister-test');
      expect(success).toBe(true);

      tools = await mcpServer.listTools();
      expect(tools.find(t => t.name === 'unregister-test')).toBeUndefined();
    });
  });
});