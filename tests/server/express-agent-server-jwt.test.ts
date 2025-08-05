import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExpressAgentServer } from '../../src/server/express-agent-server.js';
import { JWTMiddlewareConfig } from '../../src/interface/jwt-auth.js';
import { AgentRequest } from '../../src/model/agent-request.js';
import { Server } from 'http';

// Mock express module
vi.mock('express', () => {
  const mockApp = {
    use: vi.fn(),
    post: vi.fn(),
    listen: vi.fn()
  };

  const mockJsonMiddleware = vi.fn();

  const mockExpress: any = vi.fn(() => mockApp);
  mockExpress.json = vi.fn(() => mockJsonMiddleware);

  return {
    default: mockExpress,
    json: vi.fn(() => mockJsonMiddleware)
  };
});

describe('ExpressAgentServer with JWT Authentication', () => {
  let mockServer: Pick<Server, 'close'>;
  let mockApp: any;

  beforeEach(async () => {
    mockServer = {
      close: vi.fn()
    };

    // Get the mocked express and its app
    const express = await import('express');
    mockApp = (express.default as any)();
    
    vi.clearAllMocks();
  });

  describe('Constructor with JWT Config', () => {
    it('should create server with JWT configuration', () => {
      const jwtConfig: JWTMiddlewareConfig = {
        verification: {
          secret: 'test-secret',
          algorithms: ['HS256']
        }
      };

      const server = new ExpressAgentServer(3000, '/agent', jwtConfig);

      expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function)); // JSON middleware
    });

    it('should create server without JWT configuration', () => {
      const server = new ExpressAgentServer(3000, '/agent');

      expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function)); // JSON middleware
    });
  });

  describe('useJWTAuth method', () => {
    it('should configure JWT authentication', () => {
      const server = new ExpressAgentServer(3000, '/agent');
      
      const jwtConfig: JWTMiddlewareConfig = {
        verification: {
          secret: 'test-secret',
          algorithms: ['HS256']
        }
      };

      const result = server.useJWTAuth(jwtConfig);

      expect(result).toBe(server); // Should return this for chaining
    });

    it('should configure optional JWT authentication', () => {
      const server = new ExpressAgentServer(3000, '/agent');
      
      const jwtConfig: JWTMiddlewareConfig = {
        verification: {
          secret: 'test-secret',
          algorithms: ['HS256']
        }
      };

      const result = server.useJWTAuth(jwtConfig, true);

      expect(result).toBe(server); // Should return this for chaining
    });
  });

  describe('start method with JWT', () => {
    it('should apply JWT middleware when configured in constructor', async () => {
      const jwtConfig: JWTMiddlewareConfig = {
        verification: {
          secret: 'test-secret',
          ignoreExpiration: true
        }
      };

      const server = new ExpressAgentServer(3000, '/agent', jwtConfig);
      const handler = vi.fn();

      mockApp.listen.mockImplementation((port: number, callback: () => void) => {
        callback();
        return mockServer;
      });

      await server.start(handler);

      // Verify that POST endpoint was registered with middleware
      expect(mockApp.post).toHaveBeenCalledWith(
        '/agent',
        expect.any(Function), // JWT middleware
        expect.any(Function)  // Route handler
      );
    });

    it('should apply JWT middleware when configured via useJWTAuth', async () => {
      const server = new ExpressAgentServer(3000, '/agent');
      
      const jwtConfig: JWTMiddlewareConfig = {
        verification: {
          secret: 'test-secret',
          ignoreExpiration: true
        }
      };

      server.useJWTAuth(jwtConfig);

      const handler = vi.fn();

      mockApp.listen.mockImplementation((port: number, callback: () => void) => {
        callback();
        return mockServer;
      });

      await server.start(handler);

      // Verify that POST endpoint was registered with middleware
      expect(mockApp.post).toHaveBeenCalledWith(
        '/agent',
        expect.any(Function), // JWT middleware
        expect.any(Function)  // Route handler
      );
    });

    it('should not apply JWT middleware when not configured', async () => {
      const server = new ExpressAgentServer(3000, '/agent');
      const handler = vi.fn();

      mockApp.listen.mockImplementation((port: number, callback: () => void) => {
        callback();
        return mockServer;
      });

      await server.start(handler);

      // Verify that POST endpoint was registered without middleware
      expect(mockApp.post).toHaveBeenCalledWith(
        '/agent',
        expect.any(Function)  // Only route handler, no middleware
      );
    });
  });

  describe('JWT-protected endpoint behavior', () => {
    it('should process request with valid JWT', async () => {
      const jwtConfig: JWTMiddlewareConfig = {
        verification: {
          ignoreExpiration: true
        }
      };

      const server = new ExpressAgentServer(3000, '/agent', jwtConfig);
      const handler = vi.fn().mockResolvedValue({
        type: 'text',
        content: 'Test response',
        usedToken: 10
      });

      mockApp.listen.mockImplementation((port: number, callback: () => void) => {
        callback();
        return mockServer;
      });

      await server.start(handler);

      // Get the route handler (last argument to post)
      const routeHandler = mockApp.post.mock.calls[0][2];

      // Mock request with JWT payload (simulating successful JWT middleware)
      const mockReq = {
        body: {
          agent: { 
            identifier: 'test-agent-id',
            name: 'test-agent',
            description: 'Test agent for testing',
            prompt: 'Test prompt'
          },
          tools: [],
          servers: [],
          messages: []
        } as AgentRequest,
        jwt: {
          sub: 'user123',
          iat: Math.floor(Date.now() / 1000)
        },
        user: {
          sub: 'user123'
        }
      };

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis()
      };

      await routeHandler(mockReq, mockRes);

      expect(handler).toHaveBeenCalledWith(mockReq.body);
      expect(mockRes.json).toHaveBeenCalledWith({
        type: 'text',
        content: 'Test response',
        usedToken: 10
      });
    });

    it('should handle request validation errors with JWT context', async () => {
      const jwtConfig: JWTMiddlewareConfig = {
        verification: {
          ignoreExpiration: true
        }
      };

      const server = new ExpressAgentServer(3000, '/agent', jwtConfig);
      const handler = vi.fn();

      mockApp.listen.mockImplementation((port: number, callback: () => void) => {
        callback();
        return mockServer;
      });

      await server.start(handler);

      const routeHandler = mockApp.post.mock.calls[0][2];

      // Mock request with invalid body but valid JWT
      const mockReq = {
        body: null, // Invalid body
        jwt: {
          sub: 'user123'
        }
      };

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis()
      };

      await routeHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Bad Request',
        message: 'Request body must be a valid JSON object'
      });
    });
  });

  describe('Custom JWT middleware configuration', () => {
    it('should use custom token extraction function', () => {
      const customExtractToken = vi.fn();
      const jwtConfig: JWTMiddlewareConfig = {
        verification: {
          secret: 'test-secret'
        },
        extractToken: customExtractToken
      };

      const server = new ExpressAgentServer(3000, '/agent', jwtConfig);

      // The middleware creation is internal, so we can't directly test the custom function
      // but we can verify the server was created successfully with the config
      expect(server).toBeInstanceOf(ExpressAgentServer);
    });

    it('should use custom auth failure handler', () => {
      const customFailureHandler = vi.fn();
      const jwtConfig: JWTMiddlewareConfig = {
        verification: {
          secret: 'test-secret'
        },
        onAuthFailure: customFailureHandler
      };

      const server = new ExpressAgentServer(3000, '/agent', jwtConfig);

      expect(server).toBeInstanceOf(ExpressAgentServer);
    });
  });
});