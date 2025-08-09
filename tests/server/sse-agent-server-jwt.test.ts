import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios, { AxiosInstance } from 'axios';
import { SSEAgentServer } from '../../src/server/sse-agent-server.js';
import { JWTAuthConfig } from '../../src/interface/jwt-auth.js';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Mock JWT auth provider
vi.mock('../../src/auth/jwt-auth-provider.js', () => ({
  createJWTAuthProvider: vi.fn().mockReturnValue({
    getToken: vi.fn().mockResolvedValue('mock-jwt-token'),
    isTokenValid: vi.fn().mockReturnValue(true),
    refreshToken: vi.fn().mockResolvedValue(undefined)
  })
}));

// Mock EventSource
const MockEventSource = vi.fn();
MockEventSource.prototype.close = vi.fn();
vi.mock('eventsource', () => ({
  default: MockEventSource,
  EventSource: MockEventSource
}));

describe('SSEAgentServer with JWT Authentication', () => {
  let mockAxiosInstance: any;
  let mockJWTAuthProvider: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock axios instance
    mockAxiosInstance = {
      post: vi.fn().mockResolvedValue({ data: {} })
    } as unknown as AxiosInstance;

    (mockedAxios.create as any).mockReturnValue(mockAxiosInstance);

    // Get mocked JWT auth provider
    const { createJWTAuthProvider } = await import('../../src/auth/jwt-auth-provider.js');
    mockJWTAuthProvider = (createJWTAuthProvider as any)();
  });

  describe('Constructor with JWT Config', () => {
    it('should create SSE server with static JWT configuration', () => {
      const jwtConfig: JWTAuthConfig = {
        type: 'static',
        token: 'test-token-123'
      };

      const server = new SSEAgentServer('http://localhost:8080', 'test-agent', 30000, jwtConfig);
      expect(server).toBeInstanceOf(SSEAgentServer);
    });

    it('should create SSE server with OAuth JWT configuration', () => {
      const jwtConfig: JWTAuthConfig = {
        type: 'oauth',
        clientId: 'test-client',
        clientSecret: 'test-secret',
        tokenEndpoint: 'http://auth.example.com/token'
      };

      const server = new SSEAgentServer('http://localhost:8080', 'test-agent', 30000, jwtConfig);
      expect(server).toBeInstanceOf(SSEAgentServer);
    });
  });

  describe('useJWTAuth method', () => {
    it('should allow configuring JWT auth after construction', () => {
      const server = new SSEAgentServer('http://localhost:8080', 'test-agent');
      const jwtConfig: JWTAuthConfig = {
        type: 'static',
        token: 'test-token-123'
      };

      const result = server.useJWTAuth(jwtConfig);
      expect(result).toBe(server); // Should return this for chaining
    });
  });

  describe('Response sending with JWT', () => {
    it('should include Authorization header when sending responses', async () => {
      const jwtConfig: JWTAuthConfig = {
        type: 'static',
        token: 'test-token-123'
      };

      const server = new SSEAgentServer('http://localhost:8080', 'test-agent', 30000, jwtConfig);
      
      // Access the private sendResponse method for testing
      const sendResponse = (server as any).sendResponse.bind(server);
      
      const mockResponse = {
        timestamp: '2023-01-01T00:00:00Z',
        type: 'text' as const,
        content: 'Test response',
        metadata: {
          usedTools: 0,
          usedToken: 10
        }
      };

      await sendResponse(mockResponse, 'test-request-123');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/sse/test-agent',
        {
          requestId: 'test-request-123',
          response: mockResponse
        },
        {
          headers: {
            'Authorization': 'Bearer mock-jwt-token'
          }
        }
      );
    });

    it('should handle JWT token retrieval failures gracefully', async () => {
      const jwtConfig: JWTAuthConfig = {
        type: 'static',
        token: 'test-token-123'
      };

      const server = new SSEAgentServer('http://localhost:8080', 'test-agent', 30000, jwtConfig);
      
      // Mock token retrieval failure
      mockJWTAuthProvider.getToken.mockRejectedValueOnce(new Error('Token expired'));
      
      // Access the private sendResponse method for testing
      const sendResponse = (server as any).sendResponse.bind(server);
      
      const mockResponse = {
        timestamp: '2023-01-01T00:00:00Z',
        type: 'text' as const,
        content: 'Test response',
        metadata: {
          usedTools: 0,
          usedToken: 10
        }
      };

      await sendResponse(mockResponse, 'test-request-123');

      // Should continue without auth headers when JWT token retrieval fails
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/sse/test-agent',
        {
          requestId: 'test-request-123',
          response: mockResponse
        },
        {
          headers: {}
        }
      );
    });
  });

  describe('stop', () => {
    it('should handle stop when not running', async () => {
      const server = new SSEAgentServer('http://localhost:8080', 'test-agent');
      await expect(server.stop()).resolves.toBeUndefined();
    });
  });
});
