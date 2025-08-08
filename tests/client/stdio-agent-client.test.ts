import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StdioAgentClient } from '../../src/client/stdio-agent-client.js';

// Mock process.stdin and process.stdout
const mockStdin = {
  setEncoding: vi.fn(),
  on: vi.fn(),
  resume: vi.fn()
};

const mockStdout = {
  write: vi.fn()
};

// Store original process methods
const originalStdin = process.stdin;
const originalStdout = process.stdout;

describe('StdioAgentClient', () => {
  let client: StdioAgentClient;

  beforeEach(() => {
    // Clear mocks first
    vi.clearAllMocks();
    
    // Replace process streams with mocks
    Object.defineProperty(process, 'stdin', {
      value: mockStdin,
      writable: true
    });
    Object.defineProperty(process, 'stdout', {
      value: mockStdout,
      writable: true
    });

    // Create client after mocks are set up
    client = new StdioAgentClient();
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

  describe('constructor', () => {
    it('should set up stdin processing', () => {
      expect(mockStdin.setEncoding).toHaveBeenCalledWith('utf8');
      expect(mockStdin.on).toHaveBeenCalledWith('data', expect.any(Function));
    });
  });

  describe('initialize', () => {
    it('should resolve immediately', async () => {
      await expect(client.initialize()).resolves.toBeUndefined();
    });
  });

  describe('callTool', () => {
    it('should send mcp_request and handle mcp_response', async () => {
      // Get the data handler function
      const dataCall = mockStdin.on.mock.calls.find(call => call[0] === 'data');
      expect(dataCall).toBeDefined();
      const dataHandler = dataCall![1];

      // Start the call
      const toolPromise = client.callTool('test-tool', { param: 'value' });

      // Check that MCP request was sent
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('"type":"mcp_request"')
      );

      // Extract request ID from sent message
      const writeCall = mockStdout.write.mock.calls[0];
      expect(writeCall).toBeDefined();
      const sentMessage = JSON.parse(writeCall![0]);
      expect(sentMessage.type).toBe('mcp_request');
      expect(sentMessage.data.method).toBe('tools/call');
      expect(sentMessage.data.params).toEqual({
        name: 'test-tool',
        arguments: { param: 'value' }
      });

      // Simulate MCP response
      const mcpResponse = {
        type: 'mcp_response',
        id: sentMessage.id,
        data: {
          jsonrpc: '2.0',
          id: 1,
          result: { success: true }
        }
      };

      // Send response after short delay
      setTimeout(() => {
        dataHandler(JSON.stringify(mcpResponse) + '\n');
      }, 10);

      const result = await toolPromise;
      expect(result).toEqual({ success: true });
    });

    it('should handle MCP errors', async () => {
      const dataCall = mockStdin.on.mock.calls.find(call => call[0] === 'data');
      expect(dataCall).toBeDefined();
      const dataHandler = dataCall![1];

      const toolPromise = client.callTool('failing-tool', {});

      // Extract request ID
      const writeCall = mockStdout.write.mock.calls[0];
      expect(writeCall).toBeDefined();
      const sentMessage = JSON.parse(writeCall![0]);

      // Simulate error response
      const errorResponse = {
        type: 'mcp_response',
        id: sentMessage.id,
        data: {
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: -1,
            message: 'Tool failed'
          }
        }
      };

      setTimeout(() => {
        dataHandler(JSON.stringify(errorResponse) + '\n');
      }, 10);

      await expect(toolPromise).rejects.toThrow('MCP Error -1: Tool failed');
    });

    it('should handle timeout', async () => {
      // Mock setTimeout to fire immediately
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = ((fn: any) => fn()) as any;

      try {
        await expect(client.callTool('timeout-tool', {})).rejects.toThrow('MCP request timeout');
      } finally {
        global.setTimeout = originalSetTimeout;
      }
    });

    it('should handle malformed JSON gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const dataCall = mockStdin.on.mock.calls.find(call => call[0] === 'data');
      expect(dataCall).toBeDefined();
      const dataHandler = dataCall![1];

      // Send malformed JSON
      dataHandler('invalid json\n');

      // Should not throw, just log error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[StdioAgentClient]',
        'Failed to parse MCP response:',
        'invalid json',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('message handling', () => {
    it('should ignore non-mcp_response messages', async () => {
      const dataCall = mockStdin.on.mock.calls.find(call => call[0] === 'data');
      expect(dataCall).toBeDefined();
      const dataHandler = dataCall![1];

      // Send agent_request message (should be ignored by client)
      const agentRequest = {
        type: 'agent_request',
        data: { test: 'data' }
      };

      dataHandler(JSON.stringify(agentRequest) + '\n');

      // Should not cause any errors or side effects
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    it('should handle unknown mcp_response IDs gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const dataCall = mockStdin.on.mock.calls.find(call => call[0] === 'data');
      expect(dataCall).toBeDefined();  
      const dataHandler = dataCall![1];

      const unknownResponse = {
        type: 'mcp_response',
        id: 'unknown-id',
        data: { result: 'test' }
      };

      dataHandler(JSON.stringify(unknownResponse) + '\n');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[StdioAgentClient]',
        'Received MCP response for unknown request ID:',
        'unknown-id'
      );

      consoleErrorSpy.mockRestore();
    });
  });
});