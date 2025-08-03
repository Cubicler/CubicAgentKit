import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockAgentClient } from '../mocks/mock-agent-client.js';
import { JSONValue, JSONObject } from '../../src/model/types.js';
import { AgentClient } from '../../src/interface/agent-client.js';

// Since TrackingAgentClient is internal to CubicAgent, we'll recreate it for testing
class TrackingAgentClient implements AgentClient {
  private toolCallCount = 0;

  constructor(private readonly client: AgentClient) {}

  async initialize(): Promise<void> {
    return this.client.initialize();
  }

  async callTool(toolName: string, parameters: JSONObject): Promise<JSONValue> {
    this.toolCallCount++;
    return this.client.callTool(toolName, parameters);
  }

  getCallCount(): number {
    return this.toolCallCount;
  }
}

describe('TrackingAgentClient', () => {
  let mockClient: MockAgentClient;
  let trackingClient: TrackingAgentClient;

  beforeEach(() => {
    mockClient = new MockAgentClient();
    trackingClient = new TrackingAgentClient(mockClient);
  });

  describe('initialize', () => {
    it('should delegate initialize to wrapped client', async () => {
      await trackingClient.initialize();

      expect(mockClient.initializeCalled).toBe(true);
    });

    it('should propagate initialization errors', async () => {
      mockClient.shouldFailInitialize = true;

      await expect(trackingClient.initialize()).rejects.toThrow('Mock initialization failed');
    });
  });

  describe('callTool', () => {
    it('should delegate tool calls to wrapped client', async () => {
      const toolName = 'test_tool';
      const parameters = { param1: 'value1' };
      mockClient.setMockResponse(toolName, 'mock result');

      const result = await trackingClient.callTool(toolName, parameters);

      expect(mockClient.toolCalls).toHaveLength(1);
      expect(mockClient.toolCalls[0]).toEqual({ toolName, parameters });
      expect(result).toBe('mock result');
    });

    it('should propagate tool call errors', async () => {
      mockClient.shouldFailToolCall = true;

      await expect(trackingClient.callTool('test_tool', {})).rejects.toThrow('Mock tool call failed');
    });

    it('should increment call count on each tool call', async () => {
      expect(trackingClient.getCallCount()).toBe(0);

      await trackingClient.callTool('tool1', {});
      expect(trackingClient.getCallCount()).toBe(1);

      await trackingClient.callTool('tool2', {});
      expect(trackingClient.getCallCount()).toBe(2);

      await trackingClient.callTool('tool3', {});
      expect(trackingClient.getCallCount()).toBe(3);
    });

    it('should increment call count even if tool call fails', async () => {
      mockClient.shouldFailToolCall = true;

      try {
        await trackingClient.callTool('failing_tool', {});
      } catch (error) {
        // Expected to fail
      }

      expect(trackingClient.getCallCount()).toBe(1);
    });

    it('should track different tool calls independently', async () => {
      mockClient.setMockResponse('weather', { temperature: 25 });
      mockClient.setMockResponse('news', { headline: 'Breaking news' });

      await trackingClient.callTool('weather', { city: 'Paris' });
      expect(trackingClient.getCallCount()).toBe(1);

      await trackingClient.callTool('news', { category: 'tech' });
      expect(trackingClient.getCallCount()).toBe(2);

      expect(mockClient.toolCalls).toHaveLength(2);
      expect(mockClient.toolCalls[0]!.toolName).toBe('weather');
      expect(mockClient.toolCalls[1]!.toolName).toBe('news');
    });
  });

  describe('getCallCount', () => {
    it('should return 0 initially', () => {
      expect(trackingClient.getCallCount()).toBe(0);
    });

    it('should return current count after multiple calls', async () => {
      await trackingClient.callTool('tool1', {});
      await trackingClient.callTool('tool2', {});
      await trackingClient.callTool('tool3', {});

      expect(trackingClient.getCallCount()).toBe(3);
    });

    it('should be consistent with actual tool calls made', async () => {
      const expectedCalls = 5;
      
      for (let i = 0; i < expectedCalls; i++) {
        await trackingClient.callTool(`tool_${i}`, { index: i });
      }

      expect(trackingClient.getCallCount()).toBe(expectedCalls);
      expect(mockClient.toolCalls).toHaveLength(expectedCalls);
    });
  });

  describe('integration with wrapped client', () => {
    it('should maintain wrapped client state', async () => {
      // Initialize the tracking client
      await trackingClient.initialize();
      expect(mockClient.initializeCalled).toBe(true);

      // Make tool calls through tracking client
      await trackingClient.callTool('tool1', { param: 'value1' });
      await trackingClient.callTool('tool2', { param: 'value2' });

      // Verify wrapped client received all calls
      expect(mockClient.toolCalls).toHaveLength(2);
      expect(mockClient.toolCalls[0]!.toolName).toBe('tool1');
      expect(mockClient.toolCalls[1]!.toolName).toBe('tool2');

      // Verify tracking client counted correctly
      expect(trackingClient.getCallCount()).toBe(2);
    });

    it('should not interfere with wrapped client responses', async () => {
      const expectedResponse = { success: true, data: 'test data' };
      mockClient.setMockResponse('complex_tool', expectedResponse);

      const result = await trackingClient.callTool('complex_tool', { 
        complexParam: { nested: 'value' } 
      });

      expect(result).toEqual(expectedResponse);
      expect(trackingClient.getCallCount()).toBe(1);
    });
  });

  describe('isolation between instances', () => {
    it('should maintain separate counts for different tracking instances', async () => {
      const anotherMockClient = new MockAgentClient();
      const anotherTrackingClient = new TrackingAgentClient(anotherMockClient);

      // Make calls on first tracking client
      await trackingClient.callTool('tool1', {});
      await trackingClient.callTool('tool2', {});

      // Make calls on second tracking client
      await anotherTrackingClient.callTool('tool3', {});

      // Verify counts are independent
      expect(trackingClient.getCallCount()).toBe(2);
      expect(anotherTrackingClient.getCallCount()).toBe(1);
    });
  });
});
