import { describe, it, expect } from 'vitest';
import { SSEAgentServer } from '../../src/server/sse-agent-server.js';

describe('SSEAgentServer - Basic Tests', () => {
  it('should create SSEAgentServer instance with correct configuration', () => {
    const server = new SSEAgentServer('http://localhost:8080', 'test-agent');
    expect(server).toBeInstanceOf(SSEAgentServer);
  });

  it('should create SSEAgentServer with custom timeout', () => {
    const server = new SSEAgentServer('http://localhost:8080', 'test-agent', 5000);
    expect(server).toBeInstanceOf(SSEAgentServer);
  });

  it('should throw error when starting without handler', async () => {
    const server = new SSEAgentServer('http://localhost:8080', 'test-agent');
    
    // @ts-expect-error - testing invalid call
    await expect(server.start()).rejects.toThrow();
  });

  it('should handle stop when not running', async () => {
    const server = new SSEAgentServer('http://localhost:8080', 'test-agent');
    
    await expect(server.stop()).resolves.toBeUndefined();
  });
});
