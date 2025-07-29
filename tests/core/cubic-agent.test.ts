import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CubicAgent } from '../../src/core/cubic-agent.js';
import { DispatchHandler } from '../../src/interface/agent-server.js';
import { MockAgentClient } from '../mocks/mock-agent-client.js';
import { MockAgentServer } from '../mocks/mock-agent-server.js';
import { createMockAgentRequest, createMockRawAgentResponse } from '../mocks/test-helpers.js';

describe('CubicAgent', () => {
  let mockClient: MockAgentClient;
  let mockServer: MockAgentServer;
  let cubicAgent: CubicAgent;
  let mockHandler: DispatchHandler;

  beforeEach(() => {
    mockClient = new MockAgentClient();
    mockServer = new MockAgentServer();
    cubicAgent = new CubicAgent(mockClient, mockServer);
    
    mockHandler = vi.fn().mockResolvedValue(createMockRawAgentResponse());
  });

  describe('constructor', () => {
    it('should create CubicAgent with required dependencies', () => {
      expect(cubicAgent).toBeInstanceOf(CubicAgent);
    });
  });

  describe('start', () => {
    it('should start server with handler without initializing client', async () => {
      await cubicAgent.start(mockHandler);

      expect(mockClient.initializeCalled).toBe(false); // Client not initialized until first request
      expect(mockServer.startCalled).toBe(true);
      expect(mockServer.registeredHandler).toBeDefined();
    });

    it('should throw error if server start fails', async () => {
      mockServer.shouldFailStart = true;

      await expect(cubicAgent.start(mockHandler)).rejects.toThrow('Mock server start failed');
      expect(mockClient.initializeCalled).toBe(false);
    });
  });

  describe('lazy initialization', () => {
    it('should initialize client only on first request', async () => {
      await cubicAgent.start(mockHandler);
      expect(mockClient.initializeCalled).toBe(false);

      // First request should trigger initialization
      const mockRequest = createMockAgentRequest();
      await mockServer.simulateRequest(mockRequest);
      expect(mockClient.initializeCalled).toBe(true);
    });

    it('should initialize client only once across multiple requests', async () => {
      const mockRequest = createMockAgentRequest();
      let initializeCallCount = 0;
      
      // Override the mock to count calls
      const originalInitialize = mockClient.initialize.bind(mockClient);
      mockClient.initialize = vi.fn().mockImplementation(async () => {
        initializeCallCount++;
        return originalInitialize();
      });

      await cubicAgent.start(mockHandler);

      // Make multiple requests
      await mockServer.simulateRequest(mockRequest);
      await mockServer.simulateRequest(mockRequest);
      await mockServer.simulateRequest(mockRequest);

      expect(initializeCallCount).toBe(1);
      expect(mockClient.initializeCalled).toBe(true);
    });

    it('should throw error if client initialization fails on first request', async () => {
      mockClient.shouldFailInitialize = true;

      await cubicAgent.start(mockHandler);
      const mockRequest = createMockAgentRequest();

      await expect(mockServer.simulateRequest(mockRequest)).rejects.toThrow('Mock initialization failed');
      expect(mockClient.initializeCalled).toBe(true);
    });

    it('should retry initialization after failure', async () => {
      const mockRequest = createMockAgentRequest();
      let initializeCallCount = 0;

      // Make initialization fail on first call but succeed on subsequent calls
      mockClient.initialize = vi.fn().mockImplementation(async () => {
        initializeCallCount++;
        if (initializeCallCount === 1) {
          throw new Error('Mock initialization failed');
        }
        mockClient.initializeCalled = true;
      });

      await cubicAgent.start(mockHandler);

      // First request should fail
      await expect(mockServer.simulateRequest(mockRequest)).rejects.toThrow('Mock initialization failed');
      expect(initializeCallCount).toBe(1);
      expect(mockClient.initializeCalled).toBe(false);

      // Second request should retry and succeed
      const response = await mockServer.simulateRequest(mockRequest);
      expect(initializeCallCount).toBe(2); // Should retry
      expect(mockClient.initializeCalled).toBe(true);
      expect(response).toBeDefined();
    });
  });

  describe('stop', () => {
    it('should stop the server', async () => {
      await cubicAgent.stop();

      expect(mockServer.stopCalled).toBe(true);
    });

    it('should throw error if server stop fails', async () => {
      mockServer.shouldFailStop = true;

      await expect(cubicAgent.stop()).rejects.toThrow('Mock server stop failed');
    });
  });

  describe('request handling', () => {
    beforeEach(async () => {
      await cubicAgent.start(mockHandler);
    });

    it('should handle request and add timestamp and tool count to response', async () => {
      const mockRequest = createMockAgentRequest();
      const mockRawResponse = createMockRawAgentResponse({
        type: 'text',
        content: 'Test response',
        usedToken: 25
      });
      
      mockHandler = vi.fn().mockResolvedValue(mockRawResponse);
      await cubicAgent.start(mockHandler);

      const response = await mockServer.simulateRequest(mockRequest);

      expect(mockClient.initializeCalled).toBe(true); // Should be initialized after first request
      expect(response).toEqual({
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        type: 'text',
        content: 'Test response',
        metadata: {
          usedToken: 25,
          usedTools: 0 // No tools called in this test
        }
      });
    });

    it('should provide fresh tracking client for each request', async () => {
      const mockRequest = createMockAgentRequest();
      let capturedClient1: any;
      let capturedClient2: any;

      const handler1 = vi.fn().mockImplementation(async (request, client, context) => {
        capturedClient1 = client;
        return createMockRawAgentResponse();
      });

      const handler2 = vi.fn().mockImplementation(async (request, client, context) => {
        capturedClient2 = client;
        return createMockRawAgentResponse();
      });

      // Start with first handler and simulate request
      await cubicAgent.start(handler1);
      await mockServer.simulateRequest(mockRequest);

      // Start with second handler and simulate request
      await cubicAgent.start(handler2);
      await mockServer.simulateRequest(mockRequest);

      // Each request should get a different tracking client instance
      expect(capturedClient1).not.toBe(capturedClient2);
      expect(capturedClient1).not.toBe(mockClient);
      expect(capturedClient2).not.toBe(mockClient);
    });

    it('should track tool calls per request', async () => {
      const mockRequest = createMockAgentRequest();
      let capturedContext: any;

      const toolCallingHandler = vi.fn().mockImplementation(async (request, client, context) => {
        capturedContext = context;
        
        // Make some tool calls
        await client.callTool('tool1', { param: 'value1' });
        await client.callTool('tool2', { param: 'value2' });
        
        return createMockRawAgentResponse();
      });

      await cubicAgent.start(toolCallingHandler);
      const response = await mockServer.simulateRequest(mockRequest);

      expect(capturedContext.toolCallCount).toBe(2);
      expect(response.metadata.usedTools).toBe(2);
    });

    it('should provide call context with dynamic tool count', async () => {
      const mockRequest = createMockAgentRequest();
      const toolCounts: number[] = [];

      const handler = vi.fn().mockImplementation(async (request, client, context) => {
        toolCounts.push(context.toolCallCount); // Should be 0 initially
        
        await client.callTool('tool1', {});
        toolCounts.push(context.toolCallCount); // Should be 1
        
        await client.callTool('tool2', {});
        toolCounts.push(context.toolCallCount); // Should be 2
        
        return createMockRawAgentResponse();
      });

      await cubicAgent.start(handler);
      await mockServer.simulateRequest(mockRequest);

      expect(toolCounts).toEqual([0, 1, 2]);
    });

    it('should handle handler errors gracefully', async () => {
      const mockRequest = createMockAgentRequest();
      const errorHandler = vi.fn().mockRejectedValue(new Error('Handler failed'));

      await cubicAgent.start(errorHandler);

      await expect(mockServer.simulateRequest(mockRequest)).rejects.toThrow('Handler failed');
    });

    it('should handle null content responses', async () => {
      const mockRequest = createMockAgentRequest();
      const nullHandler = vi.fn().mockResolvedValue(createMockRawAgentResponse({
        type: 'null',
        content: null,
        usedToken: 0
      }));

      await cubicAgent.start(nullHandler);
      const response = await mockServer.simulateRequest(mockRequest);

      expect(response.type).toBe('null');
      expect(response.content).toBe(null);
      expect(response.metadata.usedToken).toBe(0);
    });
  });
});
