import { AgentRequest } from '../../src/model/agent-request.js';
import { RawAgentResponse } from '../../src/model/agent-response.js';

/**
 * Helper to create mock AgentRequest for testing
 */
export function createMockAgentRequest(overrides: Partial<AgentRequest> = {}): AgentRequest {
  return {
    agent: {
      identifier: 'test-agent',
      name: 'Test Agent',
      description: 'A test agent',
      prompt: 'You are a helpful test agent'
    },
    tools: [
      {
        name: 'test_tool',
        description: 'A test tool',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          },
          required: ['input']
        }
      }
    ],
    servers: [
      {
        identifier: 'test-server',
        name: 'Test Server',
        description: 'A test server'
      }
    ],
    messages: [
      {
        sender: { id: 'user-123', name: 'Test User' },
        timestamp: '2025-01-01T00:00:00Z',
        type: 'text',
        content: 'Hello, agent!'
      }
    ],
    ...overrides
  };
}

/**
 * Helper to create mock RawAgentResponse for testing
 */
export function createMockRawAgentResponse(overrides: Partial<RawAgentResponse> = {}): RawAgentResponse {
  return {
    type: 'text',
    content: 'Mock response',
    usedToken: 10,
    ...overrides
  };
}
