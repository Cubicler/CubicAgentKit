import { AgentClient } from '../../src/interface/agent-client.js';
import { JSONValue, JSONObject } from '../../src/model/types.js';

/**
 * Mock implementation of AgentClient for testing
 */
export class MockAgentClient implements AgentClient {
  public initializeCalled = false;
  public toolCalls: Array<{ toolName: string; parameters: JSONObject }> = [];
  
  // Mock responses for different tool calls
  private readonly mockResponses: Map<string, JSONValue> = new Map();
  
  // Control initialization behavior
  public shouldFailInitialize = false;
  public shouldFailToolCall = false;

  async initialize(): Promise<void> {
    this.initializeCalled = true;
    if (this.shouldFailInitialize) {
      throw new Error('Mock initialization failed');
    }
  }

  async callTool(toolName: string, parameters: JSONObject): Promise<JSONValue> {
    this.toolCalls.push({ toolName, parameters });
    
    if (this.shouldFailToolCall) {
      throw new Error('Mock tool call failed');
    }
    
    return this.mockResponses.get(toolName) || `Mock result for ${toolName}`;
  }

  // Test helpers
  setMockResponse(toolName: string, response: JSONValue): void {
    this.mockResponses.set(toolName, response);
  }

  reset(): void {
    this.initializeCalled = false;
    this.toolCalls = [];
    this.mockResponses.clear();
    this.shouldFailInitialize = false;
    this.shouldFailToolCall = false;
  }
}
