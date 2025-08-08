import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StdioAgentServer } from '../../src/server/stdio-agent-server.js';
import { AgentRequest } from '../../src/model/agent.js';
import { AgentResponse } from "../../src/model/agent.js";
import { RequestHandler } from '../../src/interface/agent-server.js';

// Mock process.stdin and process.stdout
const mockStdin = {
  setEncoding: vi.fn(),
  on: vi.fn(),
  removeAllListeners: vi.fn(),
  resume: vi.fn(),
  pause: vi.fn()
};

const mockStdout = {
  write: vi.fn()
};

// Store original process methods
const originalStdin = process.stdin;
const originalStdout = process.stdout;

describe('StdioAgentServer', () => {
  let server: StdioAgentServer;

  beforeEach(() => {
    // Replace process streams with mocks
    Object.defineProperty(process, 'stdin', {
      value: mockStdin,
      writable: true
    });
    Object.defineProperty(process, 'stdout', {
      value: mockStdout,
      writable: true
    });

    server = new StdioAgentServer();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Stop the server if it's running to ensure clean state between tests
    try {
      await server.stop();
    } catch (error) {
      // Ignore errors if server wasn't running
    }
    
    // Restore original process streams
    Object.defineProperty(process, 'stdin', {
      value: originalStdin,
      writable: true
    });
    Object.defineProperty(process, 'stdout', {
      value: originalStdout,
      writable: true
    });
  });

  describe('start', () => {
    it('should set up stdin processing', async () => {
      const handler: RequestHandler = vi.fn();
      
      await server.start(handler);

      expect(mockStdin.setEncoding).toHaveBeenCalledWith('utf8');
      expect(mockStdin.on).toHaveBeenCalledWith('data', expect.any(Function));
      expect(mockStdin.resume).toHaveBeenCalled();
    });

    it('should throw error if already running', async () => {
      const handler: RequestHandler = vi.fn();
      
      await server.start(handler);
      
      expect(() => server.start(handler)).toThrow('StdioAgentServer is already running');
    });
  });

  describe('stop', () => {
    it('should clean up stdin listeners', async () => {
      const handler: RequestHandler = vi.fn();
      
      await server.start(handler);
      await server.stop();

      expect(mockStdin.removeAllListeners).toHaveBeenCalledWith('data');
      expect(mockStdin.pause).toHaveBeenCalled();
    });

    it('should be safe to call when not running', async () => {
      await expect(server.stop()).resolves.toBeUndefined();
    });
  });

  describe('message handling', () => {
    it('should handle JSON-RPC agent requests', async () => {
      const mockResponse: AgentResponse = {
        timestamp: '2023-01-01T00:00:00.000Z',
        type: 'text',
        content: 'Hello, world!',
        metadata: { usedToken: 10, usedTools: 0 }
      };

      const handler: RequestHandler = vi.fn().mockResolvedValue(mockResponse);
      await server.start(handler);

      // Get the data handler function
      const dataCall = mockStdin.on.mock.calls.find(call => call[0] === 'data');
      expect(dataCall).toBeDefined();
      const dataHandler = dataCall![1];

      // Simulate receiving a JSON-RPC request
      const agentRequest: AgentRequest = {
        agent: {
          identifier: 'test-agent',
          name: 'Test Agent',
          description: 'A test agent',
          prompt: 'You are a test agent'
        },
        tools: [],
        servers: [],
        messages: [
          {
            sender: { id: 'user1', name: 'User' },
            type: 'text',
            content: 'Hello'
          }
        ]
      };

      const jsonRpcRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'dispatch',
        params: agentRequest
      };

      // Simulate stdin data
      dataHandler(JSON.stringify(jsonRpcRequest) + '\n');

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify handler was called
      expect(handler).toHaveBeenCalledWith(agentRequest);

      // Verify response was sent
      expect(mockStdout.write).toHaveBeenCalledWith(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: mockResponse
        }) + '\n'
      );
    });

    it('should handle handler errors gracefully', async () => {
      const handler: RequestHandler = vi.fn().mockRejectedValue(new Error('Handler failed'));
      await server.start(handler);

      const dataCall = mockStdin.on.mock.calls.find(call => call[0] === 'data');
      expect(dataCall).toBeDefined();
      const dataHandler = dataCall![1];

      const agentRequest: AgentRequest = {
        agent: {
          identifier: 'test-agent',
          name: 'Test Agent',
          description: 'A test agent',
          prompt: 'You are a test agent'
        },
        tools: [],
        servers: [],
        messages: [
          { sender: { id: 'user1', name: 'User' }, type: 'text', content: 'Hello' }
        ]
      };

      const jsonRpcRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'dispatch',
        params: agentRequest
      };

      dataHandler(JSON.stringify(jsonRpcRequest) + '\n');

      await new Promise(resolve => setTimeout(resolve, 0));

      // Should send JSON-RPC error response
      expect(mockStdout.write).toHaveBeenCalledWith(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: -32000,
            message: 'Handler failed'
          }
        }) + '\n'
      );
    });

    it('should handle malformed JSON gracefully', async () => {
      const handler: RequestHandler = vi.fn();
      
      await server.start(handler);

      const dataCall = mockStdin.on.mock.calls.find(call => call[0] === 'data');
      expect(dataCall).toBeDefined();
      const dataHandler = dataCall![1];

      // Send malformed JSON
      dataHandler('invalid json\n');

      await new Promise(resolve => setTimeout(resolve, 0));

      // Should not call handler
      expect(handler).not.toHaveBeenCalled();
      
      // Should silently ignore malformed JSON (no error logged)
    });

    it('should ignore non-JSON-RPC messages', async () => {
      const handler: RequestHandler = vi.fn();
      await server.start(handler);

      const dataCall = mockStdin.on.mock.calls.find(call => call[0] === 'data');
      expect(dataCall).toBeDefined();
      const dataHandler = dataCall![1];

      // Send non-JSON-RPC message (should be ignored by server)
      const nonJsonRpcMessage = {
        type: 'some_other_message',
        data: { result: 'test' }
      };

      dataHandler(JSON.stringify(nonJsonRpcMessage) + '\n');

      await new Promise(resolve => setTimeout(resolve, 0));

      // Handler should not be called
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle missing handler gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Start server and then remove handler (this shouldn't happen in normal usage)
      const server = new StdioAgentServer();
      (server as any).isRunning = true;
      (server as any).handler = null;

      // Simulate JSON-RPC request
      const agentRequest: AgentRequest = {
        agent: {
          identifier: 'test-agent',
          name: 'Test Agent',
          description: 'A test agent',
          prompt: 'You are a test agent'
        },
        tools: [],
        servers: [],
        messages: []
      };

      const jsonRpcRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'dispatch',
        params: agentRequest
      };

      // Process message directly
      await (server as any).handleJsonRpcRequest(jsonRpcRequest);

      // Should send JSON-RPC error response
      expect(mockStdout.write).toHaveBeenCalledWith(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: -32603,
            message: 'No handler registered for agent requests'
          }
        }) + '\n'
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('buffer handling', () => {
    it('should handle partial messages correctly', async () => {
      const handler: RequestHandler = vi.fn().mockResolvedValue({
        timestamp: '2023-01-01T00:00:00.000Z',
        type: 'text',
        content: 'Response',
        metadata: { usedToken: 10, usedTools: 0 }
      });
      
      await server.start(handler);

      const dataCall = mockStdin.on.mock.calls.find(call => call[0] === 'data');
      expect(dataCall).toBeDefined();
      const dataHandler = dataCall![1];

      const jsonRpcRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'dispatch',
        params: {
          agent: {
            identifier: 'test-agent',
            name: 'Test Agent',
            description: 'A test agent',
            prompt: 'You are a test agent'
          },
          tools: [],
          servers: [],
          messages: [
            { sender: { id: 'user1', name: 'User' }, type: 'text', content: 'Hello' }
          ]
        }
      };

      const fullMessage = JSON.stringify(jsonRpcRequest) + '\n';
      
      // Send message in two parts
      dataHandler(fullMessage.substring(0, 10));
      dataHandler(fullMessage.substring(10));

      await new Promise(resolve => setTimeout(resolve, 0));

      // Handler should be called once with complete message
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple messages in one data chunk', async () => {
      const handler: RequestHandler = vi.fn().mockResolvedValue({
        timestamp: '2023-01-01T00:00:00.000Z',
        type: 'text',
        content: 'Response',
        metadata: { usedToken: 10, usedTools: 0 }
      });
      
      await server.start(handler);

      const dataCall = mockStdin.on.mock.calls.find(call => call[0] === 'data');
      expect(dataCall).toBeDefined();
      const dataHandler = dataCall![1];

      const jsonRpcRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'dispatch',
        params: {
          agent: {
            identifier: 'test-agent',
            name: 'Test Agent',
            description: 'A test agent',
            prompt: 'You are a test agent'
          },
          tools: [],
          servers: [],
          messages: [
            { sender: { id: 'user1', name: 'User' }, type: 'text', content: 'Hello' }
          ]
        }
      };

      // Send two messages in one chunk
      const message1 = JSON.stringify(jsonRpcRequest) + '\n';
      const message2 = JSON.stringify({ ...jsonRpcRequest, id: 2 }) + '\n';
      
      dataHandler(message1 + message2);

      await new Promise(resolve => setTimeout(resolve, 0));

      // Handler should be called twice
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });
});