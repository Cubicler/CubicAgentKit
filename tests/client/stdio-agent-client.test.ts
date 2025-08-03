import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { MCPRequest, MCPResponse } from '../../src/model/mcp.js';

// Mock child_process.spawn
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

import { StdioAgentClient } from '../../src/client/stdio-agent-client.js';
import { spawn } from 'child_process';

const mockSpawn = vi.mocked(spawn);

// Mock process class that extends EventEmitter
class MockChildProcess extends EventEmitter {
  public stdin = new MockWritableStream();
  public stdout = new MockReadableStream();
  public stderr = new MockReadableStream();
  public killed = false;

  kill() {
    this.killed = true;
    // Don't emit exit immediately to avoid circular calls
    setTimeout(() => this.emit('exit', 0, null), 0);
  }
}

class MockWritableStream extends EventEmitter {
  public writtenData: string[] = [];

  write(data: string): boolean {
    this.writtenData.push(data);
    return true;
  }
}

class MockReadableStream extends EventEmitter {
  simulateData(data: string) {
    this.emit('data', Buffer.from(data));
  }
}

describe('StdioAgentClient', () => {
  let client: StdioAgentClient;
  let mockProcess: MockChildProcess;

  beforeEach(() => {
    mockProcess = new MockChildProcess();
    mockSpawn.mockReturnValue(mockProcess as any);
    client = new StdioAgentClient('npx', ['cubicler', '--server'], '/tmp');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create StdioAgentClient with provided parameters', () => {
      const testClient = new StdioAgentClient('test-command', ['arg1', 'arg2'], '/test/dir');
      expect(testClient).toBeInstanceOf(StdioAgentClient);
    });

    it('should create StdioAgentClient with default args', () => {
      const testClient = new StdioAgentClient('test-command');
      expect(testClient).toBeInstanceOf(StdioAgentClient);
    });
  });

  describe('initialize', () => {
    it('should spawn process and send initialize request', async () => {
      // Mock successful initialization response
      const initPromise = client.initialize();
      
      // Simulate MCP initialize response
      const initResponse: MCPResponse = {
        jsonrpc: '2.0',
        id: 1,
        result: { capabilities: {} }
      };
      
      mockProcess.stdout.simulateData(JSON.stringify(initResponse) + '\n');
      
      await initPromise;

      expect(mockSpawn).toHaveBeenCalledWith('npx', ['cubicler', '--server'], {
        cwd: '/tmp',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Should send initialize request
      expect(mockProcess.stdin.writtenData).toHaveLength(2); // init + initialized notification
      const initRequest = JSON.parse(mockProcess.stdin.writtenData[0]!);
      expect(initRequest).toMatchObject({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'CubicAgentKit',
            version: '2.1.0'
          }
        },
        id: 1
      });

      // Should send initialized notification
      const initializedNotification = JSON.parse(mockProcess.stdin.writtenData[1]!);
      expect(initializedNotification).toMatchObject({
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      });
    });

    it('should handle initialization error response', async () => {
      const initPromise = client.initialize();
      
      // Simulate MCP error response
      const errorResponse: MCPResponse = {
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32600,
          message: 'Invalid Request'
        }
      };
      
      mockProcess.stdout.simulateData(JSON.stringify(errorResponse) + '\n');
      
      await expect(initPromise).rejects.toThrow('MCP Error -32600: Invalid Request');
    });

    it('should only initialize once', async () => {
      // First initialization
      const initPromise1 = client.initialize();
      mockProcess.stdout.simulateData(JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }) + '\n');
      await initPromise1;

      // Second initialization should return immediately
      await client.initialize();
      
      // Should only spawn once
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });

    it('should handle missing stdio streams', async () => {
      const mockProcessWithoutStdio = {
        stdin: null,
        stdout: null,
        stderr: null,
        on: vi.fn(),
      };
      mockSpawn.mockReturnValue(mockProcessWithoutStdio as any);

      await expect(client.initialize()).rejects.toThrow('Failed to create stdio streams for cubicler process');
    });
  });

  describe('callTool', () => {
    beforeEach(async () => {
      // Initialize client first
      const initPromise = client.initialize();
      mockProcess.stdout.simulateData(JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }) + '\n');
      await initPromise;
    });

    it('should send tool call request and return result', async () => {
      const toolCallPromise = client.callTool('weatherService_getCurrentWeather', { city: 'Paris' });
      
      // Simulate tool call response
      const toolResponse: MCPResponse = {
        jsonrpc: '2.0',
        id: 2,
        result: {
          content: [{ type: 'text', text: '{"temperature": 20, "condition": "sunny"}' }]
        }
      };
      
      mockProcess.stdout.simulateData(JSON.stringify(toolResponse) + '\n');
      
      const result = await toolCallPromise;

      expect(result).toEqual({ temperature: 20, condition: 'sunny' });

      // Check the tool call request
      const toolCallRequest = JSON.parse(mockProcess.stdin.writtenData[2]!); // After init and initialized
      expect(toolCallRequest).toMatchObject({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'weatherService_getCurrentWeather',
          arguments: { city: 'Paris' }
        },
        id: 2
      });
    });

    it('should handle tool call error response', async () => {
      const toolCallPromise = client.callTool('invalidTool', {});
      
      const errorResponse: MCPResponse = {
        jsonrpc: '2.0',
        id: 2,
        error: {
          code: -32601,
          message: 'Method not found'
        }
      };
      
      mockProcess.stdout.simulateData(JSON.stringify(errorResponse) + '\n');
      
      await expect(toolCallPromise).rejects.toThrow('MCP Error -32601: Method not found');
    });

    it('should handle raw text response without JSON parsing', async () => {
      const toolCallPromise = client.callTool('textTool', {});
      
      const toolResponse: MCPResponse = {
        jsonrpc: '2.0',
        id: 2,
        result: {
          content: [{ type: 'text', text: 'Plain text response' }]
        }
      };
      
      mockProcess.stdout.simulateData(JSON.stringify(toolResponse) + '\n');
      
      const result = await toolCallPromise;
      expect(result).toBe('Plain text response');
    });

    it('should handle response without content structure', async () => {
      const toolCallPromise = client.callTool('simpleTool', {});
      
      const toolResponse: MCPResponse = {
        jsonrpc: '2.0',
        id: 2,
        result: 'Simple string result'
      };
      
      mockProcess.stdout.simulateData(JSON.stringify(toolResponse) + '\n');
      
      const result = await toolCallPromise;
      expect(result).toBe('Simple string result');
    });

    it('should handle null result', async () => {
      const toolCallPromise = client.callTool('nullTool', {});
      
      const toolResponse: MCPResponse = {
        jsonrpc: '2.0',
        id: 2,
        result: null
      };
      
      mockProcess.stdout.simulateData(JSON.stringify(toolResponse) + '\n');
      
      const result = await toolCallPromise;
      expect(result).toBe(null);
    });

    it('should throw error if not initialized', async () => {
      const uninitializedClient = new StdioAgentClient('test');
      
      await expect(uninitializedClient.callTool('tool', {})).rejects.toThrow('StdioAgentClient not initialized');
    });
  });

  describe('response parsing', () => {
    beforeEach(async () => {
      const initPromise = client.initialize();
      mockProcess.stdout.simulateData(JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }) + '\n');
      await initPromise;
    });

    it('should handle multiple responses on single line', async () => {
      const toolCall1 = client.callTool('tool1', {});
      const toolCall2 = client.callTool('tool2', {});
      
      // Send both responses in one data chunk
      const response1 = JSON.stringify({ jsonrpc: '2.0', id: 2, result: 'result1' });
      const response2 = JSON.stringify({ jsonrpc: '2.0', id: 3, result: 'result2' });
      mockProcess.stdout.simulateData(response1 + '\n' + response2 + '\n');
      
      const [result1, result2] = await Promise.all([toolCall1, toolCall2]);
      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
    });

    it('should handle partial JSON responses across data chunks', async () => {
      const toolCallPromise = client.callTool('tool', {});
      
      const response = JSON.stringify({ jsonrpc: '2.0', id: 2, result: 'test' });
      
      // Send response in parts
      mockProcess.stdout.simulateData(response.slice(0, 10));
      mockProcess.stdout.simulateData(response.slice(10) + '\n');
      
      const result = await toolCallPromise;
      expect(result).toBe('test');
    });

    it('should ignore notifications (responses with null id)', async () => {
      const toolCallPromise = client.callTool('tool', {});
      
      // Send notification first
      const notification = JSON.stringify({ jsonrpc: '2.0', method: 'notification', params: {} });
      mockProcess.stdout.simulateData(notification + '\n');
      
      // Then send actual response
      const response = JSON.stringify({ jsonrpc: '2.0', id: 2, result: 'test' });
      mockProcess.stdout.simulateData(response + '\n');
      
      const result = await toolCallPromise;
      expect(result).toBe('test');
    });

    it('should handle malformed JSON gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Send malformed JSON
      mockProcess.stdout.simulateData('invalid json\n');
      
      // Should continue processing valid responses
      const toolCallPromise = client.callTool('tool', {});
      const response = JSON.stringify({ jsonrpc: '2.0', id: 2, result: 'test' });
      mockProcess.stdout.simulateData(response + '\n');
      
      const result = await toolCallPromise;
      expect(result).toBe('test');
      expect(consoleSpy).toHaveBeenCalledWith('Failed to parse MCP response:', 'invalid json', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('process lifecycle', () => {
    it('should handle process stderr output', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const initPromise = client.initialize();
      
      // Simulate stderr output
      mockProcess.stderr.simulateData('Error log message');
      
      // Complete initialization
      mockProcess.stdout.simulateData(JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }) + '\n');
      await initPromise;
      
      expect(consoleSpy).toHaveBeenCalledWith('Cubicler stderr:', 'Error log message');
      consoleSpy.mockRestore();
    });
  });

  describe('shutdown', () => {
    it('should kill process and cleanup resources', async () => {
      const initPromise = client.initialize();
      mockProcess.stdout.simulateData(JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }) + '\n');
      await initPromise;

      await client.shutdown();

      expect(mockProcess.killed).toBe(true);
    });
  });
});