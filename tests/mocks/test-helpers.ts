import { AgentRequest, MessageRequest, TriggerRequest } from '../../src/model/agent.js';
import { RawAgentResponse, AgentResponse } from "../../src/model/agent.js";

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
 * Helper to create mock MessageRequest for testing
 */
export function createMockMessageRequest(overrides: Partial<MessageRequest> = {}): MessageRequest {
  const baseRequest = createMockAgentRequest();
  return {
    agent: baseRequest.agent,
    tools: baseRequest.tools,
    servers: baseRequest.servers,
    messages: baseRequest.messages!,
    ...overrides
  };
}

/**
 * Helper to create mock TriggerRequest for testing
 */
export function createMockTriggerRequest(overrides: Partial<TriggerRequest> = {}): TriggerRequest {
  const baseRequest = createMockAgentRequest();
  return {
    agent: baseRequest.agent,
    tools: baseRequest.tools,
    servers: baseRequest.servers,
    trigger: {
      type: 'webhook',
      identifier: 'test-webhook',
      name: 'Test Webhook',
      description: 'A test webhook for unit testing',
      triggeredAt: '2025-01-01T00:00:00Z',
      payload: { test: 'data', value: 42 }
    },
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

/**
 * Helper to create mock AgentResponse for testing
 */
export function createMockAgentResponse(overrides: Partial<AgentResponse> = {}): AgentResponse {
  return {
    timestamp: '2025-01-01T00:00:00.000Z',
    type: 'text',
    content: 'Mock response',
    metadata: {
      usedToken: 10,
      usedTools: 0
    },
    ...overrides
  };
}
