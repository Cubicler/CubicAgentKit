import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StdioAgentServer } from '../../src/server/stdio-agent-server.js';
import { AgentRequest } from '../../src/model/agent-request.js';
import { AgentResponse } from '../../src/model/agent-response.js';
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

  afterEach(() => {
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
      
      await expect(server.start(handler)).rejects.toThrow('StdioAgentServer is already running');
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
    it('should handle agent_request messages', async () => {
      const mockResponse: AgentResponse = {
        timestamp: '2023-01-01T00:00:00.000Z',
        type: 'text',
        content: 'Hello, world!',
        metadata: { usedToken: 10, usedTools: 0 }
      };

      const handler: RequestHandler = vi.fn().mockResolvedValue(mockResponse);
      await server.start(handler);

      // Get the data handler function
      const dataHandler = mockStdin.on.mock.calls.find(call => call[0] === 'data')[1];

      // Simulate receiving an agent request
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

      const requestMessage = {
        type: 'agent_request',
        data: agentRequest
      };

      // Simulate stdin data
      dataHandler(JSON.stringify(requestMessage) + '\n');

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify handler was called
      expect(handler).toHaveBeenCalledWith(agentRequest);

      // Verify response was sent
      expect(mockStdout.write).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'agent_response',
          data: mockResponse
        }) + '\n'
      );
    });

    it('should handle handler errors gracefully', async () => {
      const handler: RequestHandler = vi.fn().mockRejectedValue(new Error('Handler failed'));
      await server.start(handler);

      const dataHandler = mockStdin.on.mock.calls.find(call => call[0] === 'data')[1];

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

      const requestMessage = {
        type: 'agent_request',
        data: agentRequest
      };

      dataHandler(JSON.stringify(requestMessage) + '\n');

      await new Promise(resolve => setTimeout(resolve, 0));

      // Should send error response
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('"content":"Error: Handler failed"')
      );
    });

    it('should handle malformed JSON gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const handler: RequestHandler = vi.fn();
      
      await server.start(handler);

      const dataHandler = mockStdin.on.mock.calls.find(call => call[0] === 'data')[1];

      // Send malformed JSON
      dataHandler('invalid json\n');

      await new Promise(resolve => setTimeout(resolve, 0));

      // Should not call handler
      expect(handler).not.toHaveBeenCalled();
      
      // Should log error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[StdioAgentServer]',
        'Failed to parse message:',
        'invalid json',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should ignore non-agent_request messages', async () => {
      const handler: RequestHandler = vi.fn();
      await server.start(handler);

      const dataHandler = mockStdin.on.mock.calls.find(call => call[0] === 'data')[1];

      // Send mcp_response message (should be ignored by server)
      const mcpResponse = {
        type: 'mcp_response',
        id: 'test-id',
        data: { result: 'test' }
      };

      dataHandler(JSON.stringify(mcpResponse) + '\n');

      await new Promise(resolve => setTimeout(resolve, 0));

      // Handler should not be called
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle missing handler gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Start without handler (this shouldn't happen in normal usage)
      const server = new StdioAgentServer();
      (server as any).isRunning = true;
      (server as any).handler = null;

      // Directly call handleAgentRequest
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

      await (server as any).handleAgentRequest(agentRequest);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[StdioAgentServer]',
        'No handler registered for agent requests'
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

      const dataHandler = mockStdin.on.mock.calls.find(call => call[0] === 'data')[1];

      const agentRequest = {
        type: 'agent_request',
        data: {
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

      const fullMessage = JSON.stringify(agentRequest) + '\n';
      
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

      const dataHandler = mockStdin.on.mock.calls.find(call => call[0] === 'data')[1];

      const agentRequest = {
        type: 'agent_request',
        data: {
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
      const message1 = JSON.stringify(agentRequest) + '\n';
      const message2 = JSON.stringify(agentRequest) + '\n';
      
      dataHandler(message1 + message2);

      await new Promise(resolve => setTimeout(resolve, 0));

      // Handler should be called twice
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });
});