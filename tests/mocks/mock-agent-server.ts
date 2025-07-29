import { vi } from 'vitest';
import { AgentServer, RequestHandler } from '../../src/interface/agent-server.js';
import { AgentRequest } from '../../src/model/agent-request.js';
import { AgentResponse } from '../../src/model/agent-response.js';

/**
 * Mock implementation of AgentServer for testing
 */
export class MockAgentServer implements AgentServer {
  public startCalled = false;
  public stopCalled = false;
  public registeredHandler?: RequestHandler;
  
  // Control server behavior
  public shouldFailStart = false;
  public shouldFailStop = false;

  async start(handler: RequestHandler): Promise<void> {
    this.startCalled = true;
    this.registeredHandler = handler;
    
    if (this.shouldFailStart) {
      throw new Error('Mock server start failed');
    }
  }

  async stop(): Promise<void> {
    this.stopCalled = true;
    
    if (this.shouldFailStop) {
      throw new Error('Mock server stop failed');
    }
  }

  // Test helper to simulate an incoming request
  async simulateRequest(request: AgentRequest): Promise<AgentResponse> {
    if (!this.registeredHandler) {
      throw new Error('No handler registered');
    }
    return await this.registeredHandler(request);
  }

  reset(): void {
    this.startCalled = false;
    this.stopCalled = false;
    this.registeredHandler = undefined;
    this.shouldFailStart = false;
    this.shouldFailStop = false;
  }
}
