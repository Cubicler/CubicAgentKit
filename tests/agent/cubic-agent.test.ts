import request from 'supertest';
import { CubicAgent } from '../../src/agent/cubic-agent';
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

describe('CubicAgent', () => {
  let agent: CubicAgent;
  let mockClient: MockCubiclerClient;
  let currentPort = 4000; // Start from 4000 to avoid conflicts

  beforeEach(() => {
    mockClient = new MockCubiclerClient();
    agent = new CubicAgent({
      port: currentPort++, // Use unique port for each test
      agentName: 'test-standalone-agent',
      logLevel: 'info',
      cubiclerClient: mockClient
    });
  });

  afterEach((done) => {
    if (agent) {
      agent.stop();
      // Give some time for cleanup
      setTimeout(() => done(), 50);
    } else {
      done();
    }
  });

  describe('constructor', () => {
    it('should create agent with provided config', () => {
      expect(agent).toBeInstanceOf(CubicAgent);
    });

    it('should have Express app configured', () => {
      const app = agent.getApp();
      expect(app).toBeDefined();
    });
  });

  describe('server lifecycle', () => {
    it('should start and stop server', (done) => {
      let serverStarted = false;

      agent.start(() => {
        serverStarted = true;
        expect(serverStarted).toBe(true);
        
        // Test that server is actually running
        request(agent.getApp())
          .get('/health')
          .expect(200)
          .end((err) => {
            if (err) return done(err);
            
            // Stop the server
            agent.stop();
            done();
          });
      });
    });

    it('should handle multiple starts/stops gracefully', (done) => {
      agent.start(() => {
        agent.stop();
        
        // Start again on different port to avoid conflicts
        const agent2 = new CubicAgent({
          port: currentPort++,
          agentName: 'test-agent-2',
          logLevel: 'info',
          cubiclerClient: mockClient
        });

        agent2.start(() => {
          agent2.stop();
          setTimeout(() => done(), 50); // Give cleanup time
        });
      });
    });
  });

  describe('inherited functionality', () => {
    beforeEach((done) => {
      agent.start(() => done());
    });

    it('should inherit health endpoint', async () => {
      const response = await request(agent.getApp())
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        agent: 'test-standalone-agent'
      });
    });

    it('should inherit call endpoint functionality', async () => {
      agent.onCall(async (request) => {
        // Extract the original prompt from the enhanced prompt with header
        const originalPrompt = request.prompt.replace(/^# Note\nYou are an agent with identifier "test-standalone-agent"[.\s\S]*?\n\n/, '');
        return `Processed: ${originalPrompt}`;
      });

      const requestBody = {
        prompt: 'Test standalone prompt',
        providers: [{ name: 'test-provider', description: 'Test provider' }],
        messages: [{ sender: 'user', content: 'Hello standalone' }]
      };

      const response = await request(agent.getApp())
        .post('/call')
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Processed: Test standalone prompt'
      });
    });
  });

  describe('getApp method', () => {
    it('should return Express app instance', () => {
      const app = agent.getApp();
      expect(app).toBeDefined();
      expect(typeof app).toBe('function'); // Express app is a function
    });

    it('should allow adding custom routes to the app', (done) => {
      const app = agent.getApp();
      
      // Add custom route
      app.get('/custom', (req, res) => {
        res.json({ custom: 'route' });
      });

      agent.start(() => {
        request(app)
          .get('/custom')
          .expect(200)
          .end((err, res) => {
            if (err) return done(err);
            expect(res.body).toEqual({ custom: 'route' });
            done();
          });
      });
    });
  });

  describe('configuration', () => {
    it('should use provided port', (done) => {
      const customAgent = new CubicAgent({
        port: currentPort++,
        agentName: 'custom-port-agent',
        logLevel: 'debug',
        cubiclerClient: mockClient
      });

      customAgent.start(() => {
        // The fact that it starts without error indicates it's using the port
        customAgent.stop();
        setTimeout(() => done(), 50);
      });
    });

    it('should use provided agent name', (done) => {
      const customAgent = new CubicAgent({
        port: currentPort++,
        agentName: 'my-custom-agent',
        logLevel: 'error',
        cubiclerClient: mockClient
      });

      customAgent.start(async () => {
        try {
          const response = await request(customAgent.getApp())
            .get('/health')
            .expect(200);

          expect(response.body.agent).toBe('my-custom-agent');
          customAgent.stop();
          setTimeout(() => done(), 50);
        } catch (error) {
          customAgent.stop();
          setTimeout(() => done(error), 50);
        }
      });
    });
  });
});
