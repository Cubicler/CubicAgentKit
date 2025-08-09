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
    it('should send JSON-RPC request and handle JSON-RPC response', async () => {
      // Get the data handler function
      const dataCall = mockStdin.on.mock.calls.find(call => call[0] === 'data');
      expect(dataCall).toBeDefined();
      const dataHandler = dataCall![1];

      // Start the call
      const toolPromise = client.callTool('test-tool', { param: 'value' });

      // Check that JSON-RPC request was sent
      expect(mockStdout.write).toHaveBeenCalledWith(
        expect.stringContaining('"jsonrpc":"2.0"')
      );

      // Extract request ID from sent message
      const writeCall = mockStdout.write.mock.calls[0];
      expect(writeCall).toBeDefined();
      const sentMessage = JSON.parse(writeCall![0]);
      expect(sentMessage.jsonrpc).toBe('2.0');
      expect(sentMessage.method).toBe('tools/call');
      expect(sentMessage.params).toEqual({
        name: 'test-tool',
        arguments: { param: 'value' }
      });

      // Simulate STDIO JSON-RPC response
      const stdioResponse = {
        jsonrpc: '2.0',
        id: sentMessage.id,
        result: { success: true }
      };

      // Send response after short delay
      setTimeout(() => {
        dataHandler(JSON.stringify(stdioResponse) + '\n');
      }, 10);

      const result = await toolPromise;
      expect(result).toEqual({ success: true });
    });

    it('should handle JSON-RPC errors', async () => {
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
        jsonrpc: '2.0',
        id: sentMessage.id,
        error: {
          code: -1,
          message: 'Tool failed'
        }
      };

      setTimeout(() => {
        dataHandler(JSON.stringify(errorResponse) + '\n');
      }, 10);

      await expect(toolPromise).rejects.toThrow('JSON-RPC Error -1: Tool failed');
    });

    it('should handle timeout', async () => {
      // Mock setTimeout to fire immediately
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = ((fn: any) => fn()) as any;

      try {
        await expect(client.callTool('timeout-tool', {})).rejects.toThrow('JSON-RPC request timeout');
      } finally {
        global.setTimeout = originalSetTimeout;
      }
    });

    it('should handle malformed JSON gracefully', async () => {
      const dataCall = mockStdin.on.mock.calls.find(call => call[0] === 'data');
      expect(dataCall).toBeDefined();
      const dataHandler = dataCall![1];

      // Send malformed JSON - should not throw or break the client
      expect(() => dataHandler('invalid json\n')).not.toThrow();
      
      // Client should still be functional after malformed input
      expect(client).toBeDefined();
    });
  });

  describe('message handling', () => {
    it('should ignore non-JSON-RPC messages', async () => {
      const dataCall = mockStdin.on.mock.calls.find(call => call[0] === 'data');
      expect(dataCall).toBeDefined();
      const dataHandler = dataCall![1];

      // Send non-JSON-RPC message (should be ignored by client)
      const regularMessage = {
        type: 'some_other_message',
        data: { test: 'data' }
      };

      dataHandler(JSON.stringify(regularMessage) + '\n');

      // Should not cause any errors or side effects
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    it('should handle unknown JSON-RPC response IDs gracefully', async () => {
      const dataCall = mockStdin.on.mock.calls.find(call => call[0] === 'data');
      expect(dataCall).toBeDefined();  
      const dataHandler = dataCall![1];

      const unknownResponse = {
        jsonrpc: '2.0',
        id: 'unknown-id',
        result: { test: 'data' }
      };

      // Should not throw or break the client when receiving unknown response ID
      expect(() => dataHandler(JSON.stringify(unknownResponse) + '\n')).not.toThrow();
      
      // Client should still be functional
      expect(client).toBeDefined();
    });
  });
});