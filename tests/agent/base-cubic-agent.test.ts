import express from 'express';
import request from 'supertest';
import { BaseCubicAgent } from '../../src/agent/base-cubic-agent';
import { AgentConfig, ICubiclerClient, ProviderSpecResponse, FunctionCallResult } from '../../src/models/types';

// Create a concrete implementation for testing
class TestCubicAgent extends BaseCubicAgent {
  private app = express();

  constructor(config: AgentConfig) {
    super(config);
    this.app.use(express.json());
    this.setupRoutes(this.app);
  }

  getApp() {
    return this.app;
  }
}

// Mock CubiclerClient
class MockCubiclerClient implements ICubiclerClient {
  async getProviderSpec(providerName: string): Promise<ProviderSpecResponse> {
    return {
      context: `Mock context for ${providerName}`,
      functions: [
        {
          name: 'mockFunction',
          description: 'A mock function',
          parameters: {
            type: 'object',
            properties: {
              param1: { type: 'string', required: true }
            },
            required: ['param1']
          }
        }
      ]
    };
  }

  async executeFunction(functionName: string, parameters: any): Promise<FunctionCallResult> {
    return {
      result: `Mock result for ${functionName}`,
      parameters
    };
  }
}

describe('BaseCubicAgent', () => {
  let agent: TestCubicAgent;
  let mockClient: MockCubiclerClient;

  beforeEach(() => {
    mockClient = new MockCubiclerClient();
    agent = new TestCubicAgent({
      port: 3000,
      agentName: 'test-agent',
      logLevel: 'info',
      cubiclerClient: mockClient
    });
  });

  describe('constructor', () => {
    it('should create agent with provided config', () => {
      expect(agent).toBeInstanceOf(BaseCubicAgent);
      expect(agent).toBeInstanceOf(TestCubicAgent);
    });
  });

  describe('health endpoint', () => {
    it('should return health status', async () => {
      const response = await request(agent.getApp())
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        agent: 'test-agent'
      });
    });
  });

  describe('call endpoint', () => {
    it('should return error when no handler is set', async () => {
      const requestBody = {
        prompt: 'Test prompt',
        providers: [{ name: 'test-provider', description: 'Test provider' }],
        messages: [{ sender: 'user', content: 'Hello' }]
      };

      const response = await request(agent.getApp())
        .post('/call')
        .send(requestBody)
        .expect(500);

      expect(response.body).toEqual({
        error: 'Agent handler not configured. Call onCall() first.'
      });
    });

    it('should validate request format', async () => {
      agent.onCall(async () => 'test response');

      const response = await request(agent.getApp())
        .post('/call')
        .send({ invalid: 'request' })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid request format. Expected: { prompt, providers, messages }'
      });
    });

    it('should process valid request with handler', async () => {
      agent.onCall(async (request, context) => {
        // Verify the agent header is prepended to the prompt
        expect(request.prompt).toContain('# Note');
        expect(request.prompt).toContain('You are an agent with identifier "test-agent"');
        expect(request.prompt).toContain('other agents or custom entities');
        expect(request.prompt).toContain('Test prompt');
        expect(request.providers).toHaveLength(1);
        expect(request.messages).toHaveLength(1);
        return 'Handler response';
      });

      const requestBody = {
        prompt: 'Test prompt',
        providers: [{ name: 'test-provider', description: 'Test provider' }],
        messages: [{ sender: 'user', content: 'Hello' }]
      };

      const response = await request(agent.getApp())
        .post('/call')
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Handler response'
      });
    });

    it('should prepend agent header to original prompt', async () => {
      let receivedPrompt = '';
      
      agent.onCall(async (request) => {
        receivedPrompt = request.prompt;
        return 'Test response';
      });

      const requestBody = {
        prompt: 'Original user prompt content',
        providers: [{ name: 'test-provider', description: 'Test provider' }],
        messages: [{ sender: 'user', content: 'Hello' }]
      };

      await request(agent.getApp())
        .post('/call')
        .send(requestBody)
        .expect(200);

      // Verify the header was prepended correctly
      expect(receivedPrompt).toMatch(/^# Note\n/);
      expect(receivedPrompt).toContain('identifier "test-agent"');
      expect(receivedPrompt).toContain('other agents or custom entities');
      expect(receivedPrompt).toContain('Original user prompt content');
      expect(receivedPrompt.indexOf('# Note')).toBe(0);
      expect(receivedPrompt.indexOf('Original user prompt content')).toBeGreaterThan(0);
    });

    it('should provide context with provider spec access', async () => {
      const getProviderSpecSpy = jest.spyOn(mockClient, 'getProviderSpec');
      
      agent.onCall(async (request, context) => {
        const spec = await context.getProviderSpec('weather_api');
        expect(spec.context).toBe('Mock context for weather_api');
        return 'Context test passed';
      });

      const requestBody = {
        prompt: 'Test prompt',
        providers: [{ name: 'weather_api', description: 'Weather provider' }],
        messages: [{ sender: 'user', content: 'Weather?' }]
      };

      await request(agent.getApp())
        .post('/call')
        .send(requestBody)
        .expect(200);

      expect(getProviderSpecSpy).toHaveBeenCalledWith('weather_api');
    });

    it('should provide context with function execution', async () => {
      const executeFunctionSpy = jest.spyOn(mockClient, 'executeFunction');
      
      agent.onCall(async (request, context) => {
        const result = await context.executeFunction('mockFunction', { param1: 'value1' });
        expect(typeof result).toBe('object');
        if (typeof result === 'object' && result !== null && 'result' in result) {
          expect((result as any).result).toBe('Mock result for mockFunction');
        }
        return 'Function test passed';
      });

      const requestBody = {
        prompt: 'Test prompt',
        providers: [{ name: 'test-provider', description: 'Test provider' }],
        messages: [{ sender: 'user', content: 'Execute function' }]
      };

      await request(agent.getApp())
        .post('/call')
        .send(requestBody)
        .expect(200);

      expect(executeFunctionSpy).toHaveBeenCalledWith('mockFunction', { param1: 'value1' });
    });

    it('should handle handler errors gracefully', async () => {
      agent.onCall(async () => {
        throw new Error('Handler error');
      });

      const requestBody = {
        prompt: 'Test prompt',
        providers: [{ name: 'test-provider', description: 'Test provider' }],
        messages: [{ sender: 'user', content: 'Hello' }]
      };

      const response = await request(agent.getApp())
        .post('/call')
        .send(requestBody)
        .expect(500);

      expect(response.body).toEqual({
        error: 'Internal server error',
        details: 'Handler error'
      });
    });

    it('should handle context errors gracefully', async () => {
      const errorClient = {
        getProviderSpec: jest.fn().mockRejectedValue(new Error('Provider error')),
        executeFunction: jest.fn()
      };

      const errorAgent = new TestCubicAgent({
        port: 3001,
        agentName: 'error-agent',
        logLevel: 'info',
        cubiclerClient: errorClient
      });

      errorAgent.onCall(async (request, context) => {
        await context.getProviderSpec('failing-provider');
        return 'Should not reach here';
      });

      const requestBody = {
        prompt: 'Test prompt',
        providers: [{ name: 'failing-provider', description: 'Failing provider' }],
        messages: [{ sender: 'user', content: 'Hello' }]
      };

      const response = await request(errorAgent.getApp())
        .post('/call')
        .send(requestBody)
        .expect(500);

      expect(response.body.error).toBe('Internal server error');
      expect(response.body.details).toBe('Provider error');
    });
  });

  describe('onCall method', () => {
    it('should register handler function', () => {
      const handler = jest.fn();
      agent.onCall(handler);
      // Handler is registered (tested implicitly through call endpoint tests)
      expect(typeof agent.onCall).toBe('function');
    });

    it('should allow handler replacement', async () => {
      agent.onCall(async () => 'First handler');
      agent.onCall(async () => 'Second handler');

      const requestBody = {
        prompt: 'Test prompt',
        providers: [{ name: 'test-provider', description: 'Test provider' }],
        messages: [{ sender: 'user', content: 'Hello' }]
      };

      const response = await request(agent.getApp())
        .post('/call')
        .send(requestBody)
        .expect(200);

      expect(response.body.message).toBe('Second handler');
    });
  });
});
