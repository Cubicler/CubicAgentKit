import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CubicAgent } from '../../src/core/cubic-agent.js';
import { MessageHandler, TriggerHandler } from '../../src/interface/agent-server.js';
import { MockAgentClient } from '../mocks/mock-agent-client.js';
import { MockAgentServer } from '../mocks/mock-agent-server.js';
import { createMockMessageRequest, createMockTriggerRequest, createMockRawAgentResponse } from '../mocks/test-helpers.js';

describe('CubicAgent Builder Pattern', () => {
  let mockClient: MockAgentClient;
  let mockServer: MockAgentServer;
  let cubicAgent: CubicAgent;
  let mockMessageHandler: MessageHandler;
  let mockTriggerHandler: TriggerHandler;

  beforeEach(() => {
    mockClient = new MockAgentClient();
    mockServer = new MockAgentServer();
    cubicAgent = new CubicAgent(mockClient, mockServer);
    
    mockMessageHandler = vi.fn().mockResolvedValue(createMockRawAgentResponse({
      content: 'Message response',
      usedToken: 25
    }));
    
    mockTriggerHandler = vi.fn().mockResolvedValue(createMockRawAgentResponse({
      content: 'Trigger response',
      usedToken: 15
    }));
  });

  describe('builder interface', () => {
    it('should return builder from start method', () => {
      const builder = cubicAgent.start();
      expect(builder).toBeDefined();
      expect(typeof builder.onMessage).toBe('function');
      expect(typeof builder.onTrigger).toBe('function');
      expect(typeof builder.listen).toBe('function');
    });

    it('should allow chaining builder methods', () => {
      const builder = cubicAgent.start()
        .onMessage(mockMessageHandler)
        .onTrigger(mockTriggerHandler);
      
      expect(builder).toBeDefined();
      expect(typeof builder.listen).toBe('function');
    });

    it('should start server when listen is called', async () => {
      await cubicAgent.start()
        .onMessage(mockMessageHandler)
        .onTrigger(mockTriggerHandler)
        .listen();

      expect(mockServer.startCalled).toBe(true);
      expect(mockServer.registeredHandler).toBeDefined();
    });

    it('should throw error when listen is called twice', async () => {
      const builder = cubicAgent.start()
        .onMessage(mockMessageHandler)
        .onTrigger(mockTriggerHandler);
      
      await builder.listen();
      
      await expect(builder.listen()).rejects.toThrow('Agent server has already been started. Cannot call listen() multiple times.');
    });

    it('should allow starting without any handlers', async () => {
      await cubicAgent.start().listen();
      expect(mockServer.startCalled).toBe(true);
    });
  });

  describe('message handler routing', () => {
    it('should route message requests to message handler', async () => {
      await cubicAgent.start()
        .onMessage(mockMessageHandler)
        .onTrigger(mockTriggerHandler)
        .listen();

      const messageRequest = createMockMessageRequest();
      const response = await mockServer.simulateRequest(messageRequest);

      expect(mockMessageHandler).toHaveBeenCalledWith(
        messageRequest,
        expect.any(Object), // tracking client
        expect.objectContaining({
          toolCallCount: 0,
          memory: undefined
        })
      );
      expect(mockTriggerHandler).not.toHaveBeenCalled();
      expect(response.content).toBe('Message response');
      expect(response.metadata.usedToken).toBe(25);
    });

    it('should throw error when message request comes but no message handler is registered', async () => {
      await cubicAgent.start()
        .onTrigger(mockTriggerHandler)
        .listen();

      const messageRequest = createMockMessageRequest();
      
      await expect(mockServer.simulateRequest(messageRequest))
        .rejects.toThrow('Received message request but no message handler was registered. Use onMessage() to register a handler.');
    });
  });

  describe('trigger handler routing', () => {
    it('should route trigger requests to trigger handler', async () => {
      await cubicAgent.start()
        .onMessage(mockMessageHandler)
        .onTrigger(mockTriggerHandler)
        .listen();

      const triggerRequest = createMockTriggerRequest();
      const response = await mockServer.simulateRequest(triggerRequest);

      expect(mockTriggerHandler).toHaveBeenCalledWith(
        triggerRequest,
        expect.any(Object), // tracking client
        expect.objectContaining({
          toolCallCount: 0,
          memory: undefined
        })
      );
      expect(mockMessageHandler).not.toHaveBeenCalled();
      expect(response.content).toBe('Trigger response');
      expect(response.metadata.usedToken).toBe(15);
    });

    it('should throw error when trigger request comes but no trigger handler is registered', async () => {
      await cubicAgent.start()
        .onMessage(mockMessageHandler)
        .listen();

      const triggerRequest = createMockTriggerRequest();
      
      await expect(mockServer.simulateRequest(triggerRequest))
        .rejects.toThrow('Received trigger request but no trigger handler was registered. Use onTrigger() to register a handler.');
    });
  });

  describe('request validation', () => {
    it('should throw error for invalid request with neither messages nor trigger', async () => {
      await cubicAgent.start()
        .onMessage(mockMessageHandler)
        .onTrigger(mockTriggerHandler)
        .listen();

      // Create invalid request without messages or trigger
      const invalidRequest = {
        agent: {
          identifier: 'test-agent',
          name: 'Test Agent',
          description: 'A test agent',
          prompt: 'You are a helpful test agent'
        },
        tools: [],
        servers: []
      };

      await expect(mockServer.simulateRequest(invalidRequest))
        .rejects.toThrow('Invalid request: neither messages nor trigger provided');
    });
  });

  describe('handler context', () => {
    it('should provide tracking client with tool call counting', async () => {
      let capturedClient: any;
      let capturedContext: any;
      
      const trackingMessageHandler: MessageHandler = vi.fn().mockImplementation(async (_request, client, context) => {
        capturedClient = client;
        capturedContext = context;
        
        // Make some tool calls
        await client.callTool('tool1', { param: 'value1' });
        await client.callTool('tool2', { param: 'value2' });
        
        return createMockRawAgentResponse();
      });

      await cubicAgent.start()
        .onMessage(trackingMessageHandler)
        .listen();

      const messageRequest = createMockMessageRequest();
      const response = await mockServer.simulateRequest(messageRequest);

      expect(capturedContext.toolCallCount).toBe(2);
      expect(response.metadata.usedTools).toBe(2);
      expect(capturedClient).toBeDefined();
    });

    it('should provide memory repository when available', async () => {
      const mockMemory = {
        remember: vi.fn(),
        search: vi.fn(),
        recall: vi.fn()
      };
      
      const agentWithMemory = new CubicAgent(mockClient, mockServer, mockMemory as any);
      let capturedContext: any;
      
      const memoryMessageHandler: MessageHandler = vi.fn().mockImplementation(async (_request, _client, context) => {
        capturedContext = context;
        return createMockRawAgentResponse();
      });

      await agentWithMemory.start()
        .onMessage(memoryMessageHandler)
        .listen();

      const messageRequest = createMockMessageRequest();
      await mockServer.simulateRequest(messageRequest);

      expect(capturedContext.memory).toBe(mockMemory);
    });
  });

  describe('error handling', () => {
    it('should propagate handler errors', async () => {
      const errorHandler: MessageHandler = vi.fn().mockRejectedValue(new Error('Handler failed'));

      await cubicAgent.start()
        .onMessage(errorHandler)
        .listen();

      const messageRequest = createMockMessageRequest();
      
      await expect(mockServer.simulateRequest(messageRequest))
        .rejects.toThrow('Handler failed');
    });

    it('should propagate server start failures', async () => {
      mockServer.shouldFailStart = true;

      await expect(
        cubicAgent.start()
          .onMessage(mockMessageHandler)
          .listen()
      ).rejects.toThrow('Mock server start failed');
    });
  });

  describe('lazy initialization', () => {
    it('should initialize client only on first request', async () => {
      await cubicAgent.start()
        .onMessage(mockMessageHandler)
        .onTrigger(mockTriggerHandler)
        .listen();
      
      expect(mockClient.initializeCalled).toBe(false);

      const messageRequest = createMockMessageRequest();
      await mockServer.simulateRequest(messageRequest);
      
      expect(mockClient.initializeCalled).toBe(true);
    });
  });

  describe('manual dispatch', () => {
    it('should dispatch requests using stored handler', async () => {
      await cubicAgent.start()
        .onMessage(mockMessageHandler)
        .onTrigger(mockTriggerHandler)
        .listen();

      const messageRequest = createMockMessageRequest();
      const response = await cubicAgent.dispatch(messageRequest);

      expect(mockMessageHandler).toHaveBeenCalledWith(
        messageRequest,
        expect.any(Object),
        expect.objectContaining({
          toolCallCount: 0,
          memory: undefined
        })
      );
      expect(response.content).toBe('Message response');
      expect(response.metadata.usedToken).toBe(25);
    });

    it('should throw error when dispatching before starting', async () => {
      const messageRequest = createMockMessageRequest();
      
      await expect(cubicAgent.dispatch(messageRequest))
        .rejects.toThrow('No handler configured. Start the agent first using start().onMessage().onTrigger().listen()');
    });

    it('should dispatch trigger requests using stored handler', async () => {
      await cubicAgent.start()
        .onMessage(mockMessageHandler)
        .onTrigger(mockTriggerHandler)
        .listen();

      const triggerRequest = createMockTriggerRequest();
      const response = await cubicAgent.dispatch(triggerRequest);

      expect(mockTriggerHandler).toHaveBeenCalledWith(
        triggerRequest,
        expect.any(Object),
        expect.objectContaining({
          toolCallCount: 0,
          memory: undefined
        })
      );
      expect(response.content).toBe('Trigger response');
      expect(response.metadata.usedToken).toBe(15);
    });
  });
});
