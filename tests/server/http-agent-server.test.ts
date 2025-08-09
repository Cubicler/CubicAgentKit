import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HttpAgentServer } from '../../src/server/http-agent-server.js';
import { AgentRequest } from '../../src/model/agent.js';
import { AgentResponse } from "../../src/model/agent.js";
import { RequestHandler } from '../../src/interface/agent-server.js';
import { AgentInfo, AgentTool, ServerInfo, Message } from '../../src/model/types.js';
import axios from 'axios';

// Helper functions for creating valid mock data
function createMockAgentInfo(overrides?: Partial<AgentInfo>): AgentInfo {
  return {
    identifier: 'test-agent-id',
    name: 'test-agent',
    description: 'Test agent description',
    prompt: 'You are a helpful test agent',
    ...overrides
  };
}

function createMockMessage(overrides?: Partial<Message>): Message {
  return {
    sender: { id: 'user-1', name: 'User' },
    type: 'text',
    content: 'Test message',
    ...overrides
  };
}

function createMockAgentTool(overrides?: Partial<AgentTool>): AgentTool {
  return {
    name: 'test-tool',
    description: 'Test tool description',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    },
    ...overrides
  };
}

function createMockServerInfo(overrides?: Partial<ServerInfo>): ServerInfo {
  return {
    identifier: 'test-server-id',
    name: 'test-server',
    description: 'Test server description',
    ...overrides
  };
}

function createMockAgentResponse(overrides?: Partial<AgentResponse>): AgentResponse {
  return {
    timestamp: '2023-01-01T00:00:00.000Z',
    type: 'text',
    content: 'Test response',
    metadata: {
      usedToken: 10,
      usedTools: 0
    },
    ...overrides
  };
}

describe('HttpAgentServer', () => {
  let server: HttpAgentServer;
  let mockHandler: RequestHandler;
  const testPort = 3001;

  beforeEach(() => {
    mockHandler = vi.fn();
    server = new HttpAgentServer(testPort);
  });

  afterEach(async () => {
    try {
      await server.stop();
      // Add a small delay to ensure the server has fully stopped
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  describe('constructor', () => {
    it('should create server with default endpoint', () => {
      const testServer = new HttpAgentServer(3000);
      expect(testServer).toBeInstanceOf(HttpAgentServer);
    });

    it('should create server with custom endpoint', () => {
      const testServer = new HttpAgentServer(3000, '/custom');
      expect(testServer).toBeInstanceOf(HttpAgentServer);
    });

    it('should create server with JWT config', () => {
      const jwtConfig = {
        verification: {
          secret: 'test-secret',
          algorithms: ['HS256']
        }
      };
      const testServer = new HttpAgentServer(3000, '/agent', jwtConfig);
      expect(testServer).toBeInstanceOf(HttpAgentServer);
    });
  });

  describe('useMiddleware', () => {
    it('should return this for method chaining', () => {
      const middleware = (req: any, res: any, next: any) => {
        next();
      };
      const result = server.useMiddleware(middleware);
      expect(result).toBe(server);
    });
  });

  describe('useJWTAuth', () => {
    it('should configure JWT authentication', () => {
      const jwtConfig = {
        verification: {
          secret: 'test-secret',
          algorithms: ['HS256']
        }
      };
      
      const result = server.useJWTAuth(jwtConfig);
      expect(result).toBe(server);
    });

    it('should configure optional JWT authentication', () => {
      const jwtConfig = {
        verification: {
          secret: 'test-secret',
          algorithms: ['HS256']
        }
      };
      
      const result = server.useJWTAuth(jwtConfig, true);
      expect(result).toBe(server);
    });
  });

  describe('start and stop', () => {
    it('should start server successfully', async () => {
      await expect(server.start(mockHandler)).resolves.not.toThrow();
    });

    it('should stop server successfully', async () => {
      await server.start(mockHandler);
      await expect(server.stop()).resolves.not.toThrow();
    });

    it('should handle stopping server that is not running', async () => {
      await expect(server.stop()).resolves.not.toThrow();
    });

    it('should handle start with custom endpoint', async () => {
      const customServer = new HttpAgentServer(3002, '/custom-endpoint');
      
      try {
        await customServer.start(mockHandler);
      } finally {
        await customServer.stop();
      }
    });
  });

  describe('request handling', () => {
    beforeEach(async () => {
      await server.start(mockHandler);
    });

    it('should handle valid agent request', async () => {
      const mockResponse: AgentResponse = {
        timestamp: '2023-01-01T00:00:00.000Z',
        type: 'text',
        content: 'Test response',
        metadata: {
          usedToken: 10,
          usedTools: 0
        }
      };
      (mockHandler as any).mockResolvedValue(mockResponse);

      const validRequest: AgentRequest = {
        agent: { 
          identifier: 'test-agent-id',
          name: 'test-agent', 
          description: 'Test agent',
          prompt: 'You are a test agent'
        },
        tools: [],
        servers: [],
        messages: [{
          sender: { id: 'user-1', name: 'User' },
          type: 'text',
          content: 'Test message'
        }]
      };

      const response = await axios.post(`http://localhost:${testPort}/agent`, validRequest);

      expect(response.status).toBe(200);
      expect(response.data).toEqual(mockResponse);
      expect(mockHandler).toHaveBeenCalledWith(validRequest);
    });

    it('should handle trigger-only agent request', async () => {
      const mockResponse: AgentResponse = {
        timestamp: '2023-01-01T00:00:00.000Z',
        type: 'text',
        content: 'Triggered',
        metadata: { usedToken: 0, usedTools: 0 }
      };
      (mockHandler as any).mockResolvedValue(mockResponse);

      const triggerRequest: AgentRequest = {
        agent: createMockAgentInfo(),
        tools: [],
        servers: [],
        trigger: {
          type: 'webhook',
          identifier: 'id-1',
          name: 'test',
          description: 'desc',
          triggeredAt: '2024-01-01T00:00:00.000Z',
          payload: { ok: true }
        }
      };

      const response = await axios.post(`http://localhost:${testPort}/agent`, triggerRequest);
      expect(response.status).toBe(200);
      expect(response.data).toEqual(mockResponse);
      expect(mockHandler).toHaveBeenCalledWith(triggerRequest);
    });

    it('should return 400 for invalid JSON', async () => {
      try {
        await axios.post(`http://localhost:${testPort}/agent`, 'invalid json', {
          headers: { 'Content-Type': 'application/json' }
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response?.status).toBe(400);
      }
    });

    it('should return 400 for missing required fields - no agent', async () => {
      const invalidRequest = {
        tools: [],
        servers: [],
        messages: []
      };

      try {
        await axios.post(`http://localhost:${testPort}/agent`, invalidRequest);
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.message).toContain('agent, tools, servers, and exactly one of messages or trigger');
      }
    });

    it('should return 400 for missing required fields - no tools', async () => {
      const invalidRequest = {
        agent: createMockAgentInfo(),
        servers: [],
        messages: []
      };

      try {
        await axios.post(`http://localhost:${testPort}/agent`, invalidRequest);
      } catch (error: any) {
        expect(error.response?.status).toBe(400);
        expect(error.response?.data.message).toContain('agent, tools, servers, and exactly one of messages or trigger');
      }
    });

    it('should return 400 for missing required fields - no servers', async () => {
      const invalidRequest = {
        agent: createMockAgentInfo(),
        tools: [],
        messages: []
      };

      try {
        await axios.post(`http://localhost:${testPort}/agent`, invalidRequest);
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.message).toContain('agent, tools, servers, and exactly one of messages or trigger');
      }
    });

    it('should return 400 for missing required fields - no messages', async () => {
      const invalidRequest = {
        agent: createMockAgentInfo(),
        tools: [],
        servers: []
      };

      try {
        await axios.post(`http://localhost:${testPort}/agent`, invalidRequest);
      } catch (error: any) {
        expect(error.response?.status).toBe(400);
        expect(error.response?.data.message).toContain('agent, tools, servers, and exactly one of messages or trigger');
      }
    });

    it('should return 400 for non-object body', async () => {
      try {
        await axios.post(`http://localhost:${testPort}/agent`, null);
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.message).toContain('Request body must be a valid JSON object');
      }
    });

    it('should return 500 when handler throws error', async () => {
      const errorMessage = 'Handler error';
      (mockHandler as any).mockRejectedValue(new Error(errorMessage));
      const errorTestPort = 3005; // Use different port to avoid conflicts
      const errorTestServer = new HttpAgentServer(errorTestPort);

      const validRequest: AgentRequest = {
        agent: createMockAgentInfo(),
        tools: [],
        servers: [],
        messages: []
      };

      try {
        await errorTestServer.start(mockHandler);

        try {
          await axios.post(`http://localhost:${errorTestPort}/agent`, validRequest);
        } catch (error: any) {
          expect(error.response?.status).toBe(500);
          expect(error.response?.data.message).toBe(errorMessage);
        }
      } finally {
        await errorTestServer.stop();
      }
    });

    it('should return 500 when handler throws non-Error', async () => {
      (mockHandler as any).mockRejectedValue('String error');
      const nonErrorTestPort = 3006; // Use different port to avoid conflicts  
      const nonErrorTestServer = new HttpAgentServer(nonErrorTestPort);

      const validRequest: AgentRequest = {
        agent: createMockAgentInfo(),
        tools: [],
        servers: [],
        messages: []
      };

      try {
        await nonErrorTestServer.start(mockHandler);

        try {
          await axios.post(`http://localhost:${nonErrorTestPort}/agent`, validRequest);
        } catch (error: any) {
          expect(error.response.status).toBe(500);
          expect(error.response.data.message).toBe('Unknown error');
        }
      } finally {
        await nonErrorTestServer.stop();
      }
    });

    it('should handle complex agent request with all fields populated', async () => {
      const mockResponse = createMockAgentResponse({
        content: 'Complex response'
      });
      (mockHandler as any).mockResolvedValue(mockResponse);

      const complexRequest: AgentRequest = {
        agent: createMockAgentInfo({
          name: 'complex-agent',
          description: 'A complex test agent'
        }),
        tools: [
          createMockAgentTool({
            name: 'calculator',
            description: 'Math operations',
            parameters: {
              type: 'object',
              properties: {
                operation: { type: 'string' },
                numbers: { type: 'array' }
              },
              required: ['operation', 'numbers']
            }
          }),
          createMockAgentTool({
            name: 'weather',
            description: 'Weather information'
          })
        ],
        servers: [
          createMockServerInfo({
            name: 'db-server',
            description: 'Database server'
          })
        ],
        messages: [
          createMockMessage({
            sender: { id: 'system', name: 'System' },
            content: 'You are a helpful assistant'
          }),
          createMockMessage({
            content: 'Calculate 2+2 and tell me the weather'
          }),
          createMockMessage({
            sender: { id: 'assistant', name: 'Assistant' },
            content: 'I can help with that calculation and weather'
          }),
          createMockMessage({
            content: 'Please proceed'
          })
        ]
      };

      const response = await axios.post(`http://localhost:${testPort}/agent`, complexRequest);

      expect(response.status).toBe(200);
      expect(response.data).toEqual(mockResponse);
      expect(mockHandler).toHaveBeenCalledWith(complexRequest);
    });

    it('should handle request with empty arrays for required fields', async () => {
      const mockResponse = createMockAgentResponse({
        content: 'Empty arrays response'
      });
      (mockHandler as any).mockResolvedValue(mockResponse);

      const requestWithEmptyArrays: AgentRequest = {
        agent: createMockAgentInfo({ name: 'empty-agent' }),
        tools: [],
        servers: [],
        messages: []
      };

      const response = await axios.post(`http://localhost:${testPort}/agent`, requestWithEmptyArrays);

      expect(response.status).toBe(200);
      expect(response.data).toEqual(mockResponse);
      expect(mockHandler).toHaveBeenCalledWith(requestWithEmptyArrays);
    });

    it('should handle messages with different types including images', async () => {
      const mockResponse = createMockAgentResponse({
        content: 'Mixed message types response'
      });
      (mockHandler as any).mockResolvedValue(mockResponse);

      const requestWithMixedMessages: AgentRequest = {
        agent: createMockAgentInfo(),
        tools: [],
        servers: [],
        messages: [
          createMockMessage({
            type: 'text',
            content: 'Hello, can you analyze this image?'
          }),
          createMockMessage({
            type: 'image',
            content: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD...',
            metadata: {
              fileName: 'test-image.jpg',
              fileSize: 15420,
              fileExtension: 'jpg',
              format: 'base64'
            }
          }),
          createMockMessage({
            type: 'url',
            content: 'https://example.com/image.png',
            metadata: {
              fileName: 'remote-image.png',
              format: 'url'
            }
          })
        ]
      };

      const response = await axios.post(`http://localhost:${testPort}/agent`, requestWithMixedMessages);

      expect(response.status).toBe(200);
      expect(response.data).toEqual(mockResponse);
      expect(mockHandler).toHaveBeenCalledWith(requestWithMixedMessages);
    });
  });

  describe('middleware integration', () => {
    it('should apply custom middleware', async () => {
      const customServer = new HttpAgentServer(3003);
      let middlewareCalled = false;

      const customMiddleware = (req: any, res: any, next: any) => {
        middlewareCalled = true;
        req.customProperty = 'test-value';
        next();
      };

      customServer.useMiddleware(customMiddleware);

      // Mock handler that checks for the custom property
      const testHandler = vi.fn().mockResolvedValue({
        messages: [{ role: 'assistant', content: 'Middleware test' }]
      });

      try {
        await customServer.start(testHandler);

        const validRequest: AgentRequest = {
          agent: createMockAgentInfo(),
          tools: [],
          servers: [],
          messages: []
        };

        const response = await axios.post('http://localhost:3003/agent', validRequest);

        expect(response.status).toBe(200);
        expect(middlewareCalled).toBe(true);
        expect(testHandler).toHaveBeenCalledWith(validRequest);
      } finally {
        await customServer.stop();
      }
    });
  });

  describe('error scenarios', () => {
    it('should handle port already in use gracefully', async () => {
      const server1 = new HttpAgentServer(3004);
      const server2 = new HttpAgentServer(3004);

      try {
        await server1.start(mockHandler);
        
        // Attempt to start second server on same port should fail
        await expect(server2.start(mockHandler)).rejects.toThrow();
      } finally {
        // Try to stop servers, but don't fail if they're not running
        try {
          await server1.stop();
        } catch (error) {
          // Ignore errors when stopping servers
        }
        try {
          await server2.stop();
        } catch (error) {
          // Ignore errors when stopping servers
        }
      }
    });
  });

  describe('HTTP methods', () => {
    beforeEach(async () => {
      await server.start(mockHandler);
    });

    it('should reject GET requests', async () => {
      try {
        await axios.get(`http://localhost:${testPort}/agent`);
      } catch (error: any) {
        expect(error.response.status).toBe(404);
      }
    });

    it('should reject PUT requests', async () => {
      try {
        await axios.put(`http://localhost:${testPort}/agent`, {});
      } catch (error: any) {
        expect(error.response?.status).toBe(404);
      }
    });

    it('should reject DELETE requests', async () => {
      try {
        await axios.delete(`http://localhost:${testPort}/agent`);
      } catch (error: any) {
        expect(error.response.status).toBe(404);
      }
    });
  });

  describe('content type handling', () => {
    beforeEach(async () => {
      await server.start(mockHandler);
    });

    it('should handle requests without content-type header', async () => {
      const mockResponse = createMockAgentResponse({
        content: 'No content type'
      });
      (mockHandler as any).mockResolvedValue(mockResponse);

      const validRequest: AgentRequest = {
        agent: createMockAgentInfo(),
        tools: [],
        servers: [],
        messages: []
      };

      // Send request without explicit content-type (axios should set it automatically for JSON)
      const response = await axios.post(`http://localhost:${testPort}/agent`, validRequest);

      expect(response.status).toBe(200);
      expect(response.data).toEqual(mockResponse);
    });
  });
});
