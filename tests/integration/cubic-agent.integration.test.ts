import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CubicAgent } from '../../src/core/cubic-agent.js';
import { AxiosAgentClient } from '../../src/client/axios-agent-client.js';
import { ExpressAgentServer } from '../../src/server/express-agent-server.js';
import { AgentRequest } from '../../src/model/agent-request.js';
import { RawAgentResponse } from '../../src/model/agent-response.js';
import { AgentClient } from '../../src/interface/agent-client.js';
import { CallContext } from '../../src/interface/agent-server.js';
import { setTimeout } from 'timers/promises';

describe('CubicAgent Integration Tests', () => {
  const cubiclerUrl = process.env.CUBICLER_URL || 'http://localhost:1504';

  describe('Agent Lifecycle', () => {
    const agentPort = 3021; // Use port 3021 for the lifecycle test
    let cubicAgent: CubicAgent;
    let client: AxiosAgentClient;
    let server: ExpressAgentServer;

    beforeAll(async () => {
      client = new AxiosAgentClient(cubiclerUrl);
      server = new ExpressAgentServer(agentPort, '/agent');
      cubicAgent = new CubicAgent(client, server);
    });

    afterAll(async () => {
      try {
        await cubicAgent.stop();
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should start and stop successfully', async () => {
      const handler = async (request: AgentRequest): Promise<RawAgentResponse> => {
        return {
          type: 'text',
          content: 'Hello from test agent',
          usedToken: 10
        };
      };

      await expect(cubicAgent.start(handler)).resolves.not.toThrow();
      await expect(cubicAgent.stop()).resolves.not.toThrow();
    });
  });

  describe('Request Handling', () => {
    const agentPort = 3022; // Use port 3022 for the request handling tests
    let cubicAgent: CubicAgent;
    let client: AxiosAgentClient;
    let server: ExpressAgentServer;

    beforeAll(async () => {
      client = new AxiosAgentClient(cubiclerUrl);
      server = new ExpressAgentServer(agentPort, '/agent');
      cubicAgent = new CubicAgent(client, server);

      const handler = async (request: AgentRequest, client: AgentClient, context: CallContext): Promise<RawAgentResponse> => {
        const lastMessage = request.messages[request.messages.length - 1];
        
        if (lastMessage?.content?.includes('weather')) {
          // Try to call a Cubicler tool
          try {
            const servers = await client.callTool('cubicler_available_servers', {});
            const serverCount = (servers as any)?.servers?.length || 0;
            return {
              type: 'text',
              content: `Found ${serverCount} servers. Tool calls: ${context.toolCallCount}`,
              usedToken: 25
            };
          } catch (error) {
            return {
              type: 'text',
              content: `Error calling tools: ${(error as Error).message}`,
              usedToken: 15
            };
          }
        }
        
        return {
          type: 'text',
          content: `Echo: ${lastMessage?.content || 'no content'}`,
          usedToken: 10
        };
      };

      await cubicAgent.start(handler);
      // Give the server a moment to start
      await setTimeout(1000);
    });

    afterAll(async () => {
      await cubicAgent.stop();
    });

    it('should handle basic agent requests', async () => {
      const testRequest = {
        agent: {
          identifier: 'test-agent',
          name: 'Test Agent',
          description: 'A test agent',
          prompt: 'You are a test agent'
        },
        tools: [],
        servers: [],
        messages: [{
          sender: { id: 'user', name: 'Test User' },
          type: 'text' as const,
          content: 'Hello, agent!'
        }]
      };

      const response = await fetch(`http://localhost:${agentPort}/agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testRequest)
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('type', 'text');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('metadata');
      expect(result.metadata).toHaveProperty('usedToken');
      expect(result.metadata).toHaveProperty('usedTools');
      expect(result.content).toContain('Echo: Hello, agent!');
    });

    it('should handle requests that use Cubicler tools', async () => {
      const testRequest = {
        agent: {
          identifier: 'test-agent',
          name: 'Test Agent',
          description: 'A test agent',
          prompt: 'You are a test agent'
        },
        tools: [],
        servers: [],
        messages: [{
          sender: { id: 'user', name: 'Test User' },
          type: 'text' as const,
          content: 'What is the weather like?'
        }]
      };

      const response = await fetch(`http://localhost:${agentPort}/agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testRequest)
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      
      expect(result).toHaveProperty('metadata');
      expect(result.metadata.usedTools).toBeGreaterThanOrEqual(1);
      expect(result.content).toMatch(/Found \d+ servers|Error calling tools/);
    });

    it('should handle malformed requests', async () => {
      const response = await fetch(`http://localhost:${agentPort}/agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ invalid: 'request' })
      });

      expect(response.status).toBe(400);
    });

    it('should handle empty requests', async () => {
      const response = await fetch(`http://localhost:${agentPort}/agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: ''
      });

      expect(response.status).toBe(400);
    });
  });
});
