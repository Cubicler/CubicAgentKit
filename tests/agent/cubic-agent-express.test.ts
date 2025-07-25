import express from 'express';
import request from 'supertest';
import { CubicAgentExpress } from '../../src/agent/cubic-agent-express';
import { ICubiclerClient, ProviderSpecResponse, FunctionCallResult } from '../../src/models/types';

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

describe('CubicAgentExpress', () => {
  let app: express.Express;
  let agent: CubicAgentExpress;
  let mockClient: MockCubiclerClient;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    mockClient = new MockCubiclerClient();
    agent = new CubicAgentExpress(app, {
      agentName: 'test-express-agent',
      logLevel: 'info',
      cubiclerClient: mockClient
    });
  });

  describe('constructor', () => {
    it('should create agent with provided Express app', () => {
      expect(agent).toBeInstanceOf(CubicAgentExpress);
    });

    it('should integrate with existing Express app', () => {
      const retrievedApp = agent.getApp();
      expect(retrievedApp).toBe(app);
    });
  });

  describe('Express integration', () => {
    it('should add routes to existing Express app', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        agent: 'test-express-agent'
      });
    });

    it('should preserve existing routes', async () => {
      // Add custom route before creating agent
      app.get('/existing', (req, res) => {
        res.json({ existing: 'route' });
      });

      const response = await request(app)
        .get('/existing')
        .expect(200);

      expect(response.body).toEqual({ existing: 'route' });
    });

    it('should allow adding routes after agent creation', async () => {
      // Add custom route after creating agent
      app.get('/after', (req, res) => {
        res.json({ after: 'creation' });
      });

      const response = await request(app)
        .get('/after')
        .expect(200);

      expect(response.body).toEqual({ after: 'creation' });
    });

    it('should work with existing middleware', async () => {
      // Create new app with middleware
      const middlewareApp = express();
      middlewareApp.use(express.json());
      
      // Add custom middleware
      middlewareApp.use((req, res, next) => {
        res.setHeader('X-Custom-Header', 'test-value');
        next();
      });

      const middlewareAgent = new CubicAgentExpress(middlewareApp, {
        agentName: 'middleware-test-agent',
        logLevel: 'info',
        cubiclerClient: mockClient
      });

      const response = await request(middlewareApp)
        .get('/health')
        .expect(200);

      expect(response.headers['x-custom-header']).toBe('test-value');
      expect(response.body.agent).toBe('middleware-test-agent');
    });
  });

  describe('inherited functionality', () => {
    it('should inherit health endpoint functionality', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        agent: 'test-express-agent'
      });
    });

    it('should inherit call endpoint functionality', async () => {
      agent.onCall(async (request) => {
        // Extract the original prompt from the enhanced prompt with header
        const originalPrompt = request.prompt.replace(/^# Note\nYou are an agent with identifier "test-express-agent"[.\s\S]*?\n\n/, '');
        return `Express processed: ${originalPrompt}`;
      });

      const requestBody = {
        prompt: 'Test express prompt',
        providers: [{ name: 'test-provider', description: 'Test provider' }],
        messages: [{ sender: 'user', content: 'Hello express' }]
      };

      const response = await request(app)
        .post('/call')
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Express processed: Test express prompt'
      });
    });

    it('should provide context access like base class', async () => {
      const getProviderSpecSpy = jest.spyOn(mockClient, 'getProviderSpec');

      agent.onCall(async (request, context) => {
        const spec = await context.getProviderSpec('weather_api');
        expect(spec.context).toBe('Mock context for weather_api');
        return 'Context access works in Express';
      });

      const requestBody = {
        prompt: 'Test context access',
        providers: [{ name: 'weather_api', description: 'Weather provider' }],
        messages: [{ sender: 'user', content: 'Weather?' }]
      };

      await request(app)
        .post('/call')
        .send(requestBody)
        .expect(200);

      expect(getProviderSpecSpy).toHaveBeenCalledWith('weather_api');
    });
  });

  describe('getApp method', () => {
    it('should return the same Express app instance', () => {
      const retrievedApp = agent.getApp();
      expect(retrievedApp).toBe(app);
    });
  });

  describe('multiple agents on same app', () => {
    it('should handle multiple agents gracefully (first one wins)', async () => {
      // Set up first agent handler
      agent.onCall(async () => 'First agent response');
      
      // Create second agent on the same app
      const secondAgent = new CubicAgentExpress(app, {
        agentName: 'second-agent',
        logLevel: 'debug',
        cubiclerClient: mockClient
      });

      secondAgent.onCall(async () => 'Second agent response');

      const requestBody = {
        prompt: 'Test prompt',
        providers: [{ name: 'test-provider', description: 'Test provider' }],
        messages: [{ sender: 'user', content: 'Hello' }]
      };

      const response = await request(app)
        .post('/call')
        .send(requestBody)
        .expect(200);

      // The first agent's handler should be used (Express uses first registered route)
      expect(response.body.message).toBe('First agent response');
    });
  });

  describe('error handling', () => {
    it('should handle errors in Express context', async () => {
      agent.onCall(async () => {
        throw new Error('Express handler error');
      });

      const requestBody = {
        prompt: 'Test error',
        providers: [{ name: 'test-provider', description: 'Test provider' }],
        messages: [{ sender: 'user', content: 'Error test' }]
      };

      const response = await request(app)
        .post('/call')
        .send(requestBody)
        .expect(500);

      expect(response.body).toEqual({
        error: 'Internal server error',
        details: 'Express handler error'
      });
    });
  });
});
