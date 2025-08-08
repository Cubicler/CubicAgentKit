import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StdioAgentServer } from '../../src/server/stdio-agent-server.js';
import { RequestHandler } from '../../src/interface/agent-server.js';
import { createMockAgentRequest, createMockAgentResponse } from '../mocks/test-helpers.js';
import { MCPRequest } from '../../src/model/mcp.js';

// Mock stdout write function
const mockWrittenData: string[] = [];
const mockStdoutWrite = vi.fn((data: string) => {
  mockWrittenData.push(data);
  return true;
});

// Mock stdin methods
const mockStdin = {
  setEncoding: vi.fn(),
  on: vi.fn(),
  removeAllListeners: vi.fn(),
  resume: vi.fn(),
  pause: vi.fn(),
};

describe('StdioAgentServer', () => {
  let server: StdioAgentServer;
  let mockHandler: RequestHandler & { mockResolvedValue: any; mockRejectedValue: any };
  let stdinDataHandler: (data: string) => void;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    mockWrittenData.length = 0;
    
    // Mock process globals
    vi.stubGlobal('process', {
      stdin: mockStdin,
      stdout: { write: mockStdoutWrite },
      on: vi.fn(),
    });
    
    server = new StdioAgentServer();
    mockHandler = vi.fn().mockResolvedValue(createMockAgentResponse());
    
    // Capture the stdin data handler
    mockStdin.on.mockImplementation((event: string, handler: any) => {
      if (event === 'data') {
        stdinDataHandler = handler;
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('constructor', () => {
    it('should create StdioAgentServer instance', () => {
      expect(server).toBeInstanceOf(StdioAgentServer);
    });

    it('should set up signal handlers', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const mockProcessOn = vi.mocked(process.on);
      expect(mockProcessOn).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(mockProcessOn).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });
  });

  describe('start', () => {
    it('should configure stdin and send capabilities', async () => {
      await server.start(mockHandler);

      expect(mockStdin.setEncoding).toHaveBeenCalledWith('utf8');
      expect(mockStdin.on).toHaveBeenCalledWith('data', expect.any(Function));
      expect(mockStdin.resume).toHaveBeenCalled();

      // Should send capabilities announcement
      expect(mockWrittenData).toHaveLength(1);
      const announcement = JSON.parse(mockWrittenData[0]!);
      expect(announcement).toMatchObject({
        jsonrpc: '2.0',
        method: 'notifications/capabilities',
        params: {
          capabilities: {
            agents: {
              dispatch: true
            }
          }
        }
      });
    });

    it('should throw error if already running', async () => {
      await server.start(mockHandler);
      
      await expect(server.start(mockHandler)).rejects.toThrow('StdioAgentServer is already running');
    });
  });

  describe('stop', () => {
    it('should cleanup stdin listeners and pause', async () => {
      await server.start(mockHandler);
      await server.stop();

      expect(mockStdin.removeAllListeners).toHaveBeenCalledWith('data');
      expect(mockStdin.pause).toHaveBeenCalled();
    });

    it('should handle stop when not running', async () => {
      await server.stop(); // Should not throw
      expect(mockStdin.removeAllListeners).not.toHaveBeenCalled();
    });
  });

  describe('request handling', () => {
    beforeEach(async () => {
      await server.start(mockHandler);
      mockWrittenData.length = 0; // Clear capabilities announcement
    });

    it('should handle initialize request', async () => {
      const initRequest: MCPRequest = {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {}
        },
        id: 1
      };

      stdinDataHandler(JSON.stringify(initRequest) + '\n');

      expect(mockWrittenData).toHaveLength(1);
      const response = JSON.parse(mockWrittenData[0]!);
      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 1,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            agents: {
              dispatch: true
            }
          },
          serverInfo: {
            name: 'CubicAgentKit',
            version: '2.1.0'
          }
        }
      });
    });

    it('should handle initialized notification', async () => {
      const initializedNotification = {
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      };

      stdinDataHandler(JSON.stringify(initializedNotification) + '\n');

      // Should not send any response for notifications
      expect(mockWrittenData).toHaveLength(0);
    });

    it('should handle agent dispatch request', async () => {
      const mockRequest = createMockAgentRequest();
      const mockResponse = createMockAgentResponse({
        type: 'text',
        content: 'Test response',
        metadata: { usedToken: 25, usedTools: 1 }
      });
      
      mockHandler.mockResolvedValue(mockResponse);

      const dispatchRequest: MCPRequest = {
        jsonrpc: '2.0',
        method: 'agent/dispatch',
        params: mockRequest as any, // AgentRequest doesn't match JSONObject interface exactly
        id: 2
      };

      stdinDataHandler(JSON.stringify(dispatchRequest) + '\n');

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockHandler).toHaveBeenCalledWith(mockRequest);
      expect(mockWrittenData).toHaveLength(1);
      
      const response = JSON.parse(mockWrittenData[0]!);
      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 2,
        result: mockResponse
      });
    });

    it('should handle trigger-only agent request', async () => {
      const triggerRequest = {
        agent: {
          identifier: 'agent-1', name: 'a', description: 'd', prompt: 'p'
        },
        tools: [],
        servers: [],
        trigger: {
          type: 'webhook', identifier: 't1', name: 'n', description: 'd', triggeredAt: '2024-01-01T00:00:00.000Z', payload: { a: 1 }
        }
      };

      const dispatchRequest: MCPRequest = {
        jsonrpc: '2.0',
        method: 'agent/dispatch',
        params: triggerRequest as any,
        id: 9
      };

      stdinDataHandler(JSON.stringify(dispatchRequest) + '\n');
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockHandler).toHaveBeenCalledWith(triggerRequest);
      expect(mockWrittenData).toHaveLength(1);
      const response = JSON.parse(mockWrittenData[0]!);
      expect(response.id).toBe(9);
      expect(response.result).toBeDefined();
    });

    it('should handle unknown method with error', async () => {
      const unknownRequest: MCPRequest = {
        jsonrpc: '2.0',
        method: 'unknown/method',
        params: {},
        id: 3
      };

      stdinDataHandler(JSON.stringify(unknownRequest) + '\n');

      expect(mockWrittenData).toHaveLength(1);
      const response = JSON.parse(mockWrittenData[0]!);
      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 3,
        error: {
          code: -32601,
          message: 'Method not found',
          data: 'Unknown method: unknown/method'
        }
      });
    });

    it('should handle malformed JSON with parse error', async () => {
      stdinDataHandler('invalid json\n');

      expect(mockWrittenData).toHaveLength(1);
      const response = JSON.parse(mockWrittenData[0]!);
      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error',
          data: 'Invalid JSON received'
        }
      });
    });

    it('should handle dispatch without handler', async () => {
      // Clear the handler
      (server as any).handler = null;

      const dispatchRequest: MCPRequest = {
        jsonrpc: '2.0',
        method: 'agent/dispatch',
        params: createMockAgentRequest() as any, // AgentRequest doesn't match JSONObject interface exactly
        id: 4
      };

      stdinDataHandler(JSON.stringify(dispatchRequest) + '\n');

      expect(mockWrittenData).toHaveLength(1);
      const response = JSON.parse(mockWrittenData[0]!);
      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 4,
        error: {
          code: -32603,
          message: 'Internal error',
          data: 'No request handler registered'
        }
      });
    });

    it('should handle dispatch without params', async () => {
      const dispatchRequest: MCPRequest = {
        jsonrpc: '2.0',
        method: 'agent/dispatch',
        id: 5
      };

      stdinDataHandler(JSON.stringify(dispatchRequest) + '\n');

      expect(mockWrittenData).toHaveLength(1);
      const response = JSON.parse(mockWrittenData[0]!);
      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 5,
        error: {
          code: -32602,
          message: 'Invalid params',
          data: 'Agent request parameters required'
        }
      });
    });

    it('should handle invalid agent request structure', async () => {
      const dispatchRequest: MCPRequest = {
        jsonrpc: '2.0',
        method: 'agent/dispatch',
        params: { invalid: 'structure' }, // Invalid AgentRequest
        id: 6
      };

      stdinDataHandler(JSON.stringify(dispatchRequest) + '\n');

      expect(mockWrittenData).toHaveLength(1);
      const response = JSON.parse(mockWrittenData[0]!);
      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 6,
        error: {
          code: -32602,
          message: 'Invalid params',
          data: 'Invalid AgentRequest structure'
        }
      });
    });

    it('should handle handler errors', async () => {
      mockHandler.mockRejectedValue(new Error('Handler failed'));

      const dispatchRequest: MCPRequest = {
        jsonrpc: '2.0',
        method: 'agent/dispatch',
        params: createMockAgentRequest() as any,
        id: 7
      };

      stdinDataHandler(JSON.stringify(dispatchRequest) + '\n');

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockWrittenData).toHaveLength(1);
      const response = JSON.parse(mockWrittenData[0]!);
      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 7,
        error: {
          code: -32603,
          message: 'Internal error',
          data: 'Handler failed'
        }
      });
    });
  });

  describe('input buffering', () => {
    beforeEach(async () => {
      await server.start(mockHandler);
      mockWrittenData.length = 0;
    });

    it('should handle multiple requests in single data chunk', async () => {
      const request1: MCPRequest = {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {},
        id: 1
      };

      const request2: MCPRequest = {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {},
        id: 2
      };

      const multipleRequests = JSON.stringify(request1) + '\n' + JSON.stringify(request2) + '\n';
      stdinDataHandler(multipleRequests);

      expect(mockWrittenData).toHaveLength(2);
      
      const response1 = JSON.parse(mockWrittenData[0]!);
      const response2 = JSON.parse(mockWrittenData[1]!);
      
      expect(response1.id).toBe(1);
      expect(response2.id).toBe(2);
    });

    it('should handle partial requests across multiple data chunks', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {},
        id: 1
      };

      const requestStr = JSON.stringify(request) + '\n';
      
      // Send in parts
      stdinDataHandler(requestStr.slice(0, 10));
      expect(mockWrittenData).toHaveLength(0); // No complete request yet
      
      stdinDataHandler(requestStr.slice(10));
      expect(mockWrittenData).toHaveLength(1); // Now complete
      
      const response = JSON.parse(mockWrittenData[0]!);
      expect(response.id).toBe(1);
    });

    it('should ignore empty lines', async () => {
      stdinDataHandler('\n\n\n');
      expect(mockWrittenData).toHaveLength(0);
    });
  });

  describe('agent request validation', () => {
    beforeEach(async () => {
      await server.start(mockHandler);
      mockWrittenData.length = 0;
    });

    it('should validate complete agent request structure', async () => {
      const validRequest = createMockAgentRequest();
      
      const dispatchRequest: MCPRequest = {
        jsonrpc: '2.0',
        method: 'agent/dispatch',
        params: validRequest as any,
        id: 1
      };

      stdinDataHandler(JSON.stringify(dispatchRequest) + '\n');

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockHandler).toHaveBeenCalledWith(validRequest);
      expect(mockWrittenData).toHaveLength(1);
      
      const response = JSON.parse(mockWrittenData[0]!);
      expect(response.result).toBeDefined();
      expect(response.error).toBeUndefined();
    });

    it('should reject request missing agent field', async () => {
      const invalidRequest = {
        tools: [],
        servers: [],
        messages: []
        // Missing agent field
      };

      const dispatchRequest: MCPRequest = {
        jsonrpc: '2.0',
        method: 'agent/dispatch',
        params: invalidRequest,
        id: 1
      };

      stdinDataHandler(JSON.stringify(dispatchRequest) + '\n');

      expect(mockHandler).not.toHaveBeenCalled();
      expect(mockWrittenData).toHaveLength(1);
      
      const response = JSON.parse(mockWrittenData[0]!);
      expect(response.error).toMatchObject({
        code: -32602,
        message: 'Invalid params'
      });
    });

    it('should reject request with invalid agent structure', async () => {
      const invalidRequest = {
        agent: { identifier: 'test' }, // Missing required fields
        tools: [],
        servers: [],
        messages: []
      };

      const dispatchRequest: MCPRequest = {
        jsonrpc: '2.0',
        method: 'agent/dispatch',
        params: invalidRequest,
        id: 1
      };

      stdinDataHandler(JSON.stringify(dispatchRequest) + '\n');

      expect(mockHandler).not.toHaveBeenCalled();
      expect(mockWrittenData).toHaveLength(1);
      
      const response = JSON.parse(mockWrittenData[0]!);
      expect(response.error).toMatchObject({
        code: -32602,
        message: 'Invalid params'
      });
    });
  });

  describe('response when not running', () => {
    it('should not send messages when stopped', async () => {
      await server.start(mockHandler);
      await server.stop();

      // Clear any messages sent during start/stop
      mockWrittenData.length = 0;

      const request: MCPRequest = {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {},
        id: 1
      };

      stdinDataHandler(JSON.stringify(request) + '\n');

      // Should not send any response when stopped
      expect(mockWrittenData).toHaveLength(0);
    });
  });
});
