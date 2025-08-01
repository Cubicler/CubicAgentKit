import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AxiosAgentClient } from '../../src/core/axios-agent-client.js';

describe('AxiosAgentClient Integration Tests', () => {
  const cubiclerUrl = process.env.CUBICLER_URL || 'http://localhost:1504';
  let client: AxiosAgentClient;

  beforeAll(async () => {
    client = new AxiosAgentClient(cubiclerUrl);
  });

  describe('Client Initialization', () => {
    it('should successfully initialize connection to Cubicler', async () => {
      await expect(client.initialize()).resolves.not.toThrow();
    });

    it('should handle initialization with invalid URL', async () => {
      const invalidClient = new AxiosAgentClient('http://invalid-url:9999');
      await expect(invalidClient.initialize()).rejects.toThrow(/Failed to initialize connection/);
    });
  });

  describe('Cubicler Internal Tools', () => {
    beforeAll(async () => {
      await client.initialize();
    });

    it('should call cubicler_available_servers successfully', async () => {
      const result = await client.callTool('cubicler_available_servers', {});
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('servers');
      expect(Array.isArray((result as any).servers)).toBe(true);
    });

    it('should call cubicler_fetch_server_tools successfully', async () => {
      // Test the cubicler_fetch_server_tools internal tool
      // In Cubicler 2.3.0, both internal tools work perfectly!
      const serverList = await client.callTool('cubicler_available_servers', {});
      expect(serverList).toBeDefined();
      
      // Verify the new structured format from Cubicler 2.3.0
      expect(serverList).toHaveProperty('total');
      expect(serverList).toHaveProperty('servers');
      expect(Array.isArray((serverList as any).servers)).toBe(true);
      
      // If we have servers, try to fetch tools for the first one
      const servers = (serverList as any).servers;
      if (servers.length > 0) {
        const serverId = servers[0].identifier;
        expect(serverId).toBeDefined();
        
        const serverTools = await client.callTool('cubicler_fetch_server_tools', { 
          serverIdentifier: serverId 
        });
        expect(serverTools).toBeDefined();
        expect(serverTools).toHaveProperty('tools');
        expect(Array.isArray((serverTools as any).tools)).toBe(true);
        
        // Verify we get actual tools back
        const tools = (serverTools as any).tools;
        expect(tools.length).toBeGreaterThan(0);
        
        // Verify tool structure
        tools.forEach((tool: any) => {
          expect(tool).toHaveProperty('name');
          expect(tool).toHaveProperty('description');
          expect(tool).toHaveProperty('parameters');
        });
      } else {
        console.warn('No servers available for cubicler_fetch_server_tools test');
      }
    });

    it('should handle invalid tool names', async () => {
      await expect(
        client.callTool('invalid_tool_name', {})
      ).rejects.toThrow(/MCP Error/);
    });

    it('should handle malformed parameters', async () => {
      await expect(
        client.callTool('cubicler_fetch_server_tools', { 
          invalidParam: 'value' 
        })
      ).rejects.toThrow();
    });
  });

  describe('Client Middleware', () => {
    it('should support request middleware', async () => {
      const testClient = new AxiosAgentClient(cubiclerUrl);
      
      // Add middleware to add a custom header
      testClient.useMiddleware((config) => {
        config.headers['X-Test-Header'] = 'test-value';
        return config;
      });

      await testClient.initialize();
      
      // The middleware should work without throwing errors
      const result = await testClient.callTool('cubicler_available_servers', {});
      expect(result).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    beforeAll(async () => {
      await client.initialize();
    });

    it('should handle network timeouts gracefully', async () => {
      const timeoutClient = new AxiosAgentClient(cubiclerUrl, 1); // 1ms timeout
      
      await expect(
        timeoutClient.initialize()
      ).rejects.toThrow(/timeout|exceeded/i);
    });

    it('should provide detailed error messages for MCP errors', async () => {
      try {
        await client.callTool('nonexistent_tool', {});
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toMatch(/MCP Error/);
      }
    });
  });
});
