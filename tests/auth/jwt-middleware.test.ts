import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { 
  createJWTMiddleware, 
  createOptionalJWTMiddleware,
  JWTRequest 
} from '../../src/auth/jwt-middleware.js';
import { JWTMiddlewareConfig } from '../../src/interface/jwt-auth.js';

describe('JWT Middleware', () => {
  let req: Partial<JWTRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      headers: {}
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
    next = vi.fn();
  });

  describe('createJWTMiddleware', () => {
    const config: JWTMiddlewareConfig = {
      verification: {
        ignoreExpiration: true // For testing, ignore expiration
      }
    };

    it('should authenticate valid JWT token', () => {
      // Create a simple JWT payload (header.payload.signature)
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: 'user123', iat: Math.floor(Date.now() / 1000) })).toString('base64url');
      const signature = 'fake-signature';
      const token = `${header}.${payload}.${signature}`;

      req.headers = {
        authorization: `Bearer ${token}`
      };

      const middleware = createJWTMiddleware(config);
      middleware(req as JWTRequest, res as Response, next);

      expect(req.jwt).toBeDefined();
      expect(req.jwt?.sub).toBe('user123');
      expect(req.user).toBeDefined();
      expect(next).toHaveBeenCalledWith();
    });

    it('should reject request without token', () => {
      const middleware = createJWTMiddleware(config);
      middleware(req as JWTRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid or missing JWT token'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject malformed JWT token', () => {
      req.headers = {
        authorization: 'Bearer invalid-token'
      };

      const middleware = createJWTMiddleware(config);
      middleware(req as JWTRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid or missing JWT token'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should use custom token extraction function', () => {
      const customConfig: JWTMiddlewareConfig = {
        verification: { ignoreExpiration: true },
        extractToken: (req) => req.query?.token as string
      };

      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: 'user123' })).toString('base64url');
      const signature = 'fake-signature';
      const token = `${header}.${payload}.${signature}`;

      req.query = { token };

      const middleware = createJWTMiddleware(customConfig);
      middleware(req as JWTRequest, res as Response, next);

      expect(req.jwt?.sub).toBe('user123');
      expect(next).toHaveBeenCalledWith();
    });

    it('should use custom auth failure handler', () => {
      const customHandler = vi.fn();
      const customConfig: JWTMiddlewareConfig = {
        verification: { ignoreExpiration: true },
        onAuthFailure: customHandler
      };

      const middleware = createJWTMiddleware(customConfig);
      middleware(req as JWTRequest, res as Response, next);

      expect(customHandler).toHaveBeenCalledWith(
        expect.any(Error),
        req,
        res,
        next
      );
    });

    it('should validate token expiration when not ignored', () => {
      const configWithExpiration: JWTMiddlewareConfig = {
        verification: {
          ignoreExpiration: false
        }
      };

      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const expiredPayload = Buffer.from(JSON.stringify({ 
        sub: 'user123', 
        exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
      })).toString('base64url');
      const signature = 'fake-signature';
      const token = `${header}.${expiredPayload}.${signature}`;

      req.headers = {
        authorization: `Bearer ${token}`
      };

      const middleware = createJWTMiddleware(configWithExpiration);
      middleware(req as JWTRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should validate issuer when specified', () => {
      const configWithIssuer: JWTMiddlewareConfig = {
        verification: {
          ignoreExpiration: true,
          issuer: 'https://expected-issuer.com'
        }
      };

      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ 
        sub: 'user123', 
        iss: 'https://wrong-issuer.com'
      })).toString('base64url');
      const signature = 'fake-signature';
      const token = `${header}.${payload}.${signature}`;

      req.headers = {
        authorization: `Bearer ${token}`
      };

      const middleware = createJWTMiddleware(configWithIssuer);
      middleware(req as JWTRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should validate audience when specified', () => {
      const configWithAudience: JWTMiddlewareConfig = {
        verification: {
          ignoreExpiration: true,
          audience: 'expected-audience'
        }
      };

      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ 
        sub: 'user123', 
        aud: 'wrong-audience'
      })).toString('base64url');
      const signature = 'fake-signature';
      const token = `${header}.${payload}.${signature}`;

      req.headers = {
        authorization: `Bearer ${token}`
      };

      const middleware = createJWTMiddleware(configWithAudience);
      middleware(req as JWTRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('createOptionalJWTMiddleware', () => {
    const config: JWTMiddlewareConfig = {
      verification: {
        ignoreExpiration: true
      }
    };

    it('should continue without token', () => {
      const middleware = createOptionalJWTMiddleware(config);
      middleware(req as JWTRequest, res as Response, next);

      expect(req.jwt).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });

    it('should authenticate valid token when present', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: 'user123' })).toString('base64url');
      const signature = 'fake-signature';
      const token = `${header}.${payload}.${signature}`;

      req.headers = {
        authorization: `Bearer ${token}`
      };

      const middleware = createOptionalJWTMiddleware(config);
      middleware(req as JWTRequest, res as Response, next);

      expect(req.jwt?.sub).toBe('user123');
      expect(next).toHaveBeenCalledWith();
    });

    it('should continue even with invalid token', () => {
      req.headers = {
        authorization: 'Bearer invalid-token'
      };

      const middleware = createOptionalJWTMiddleware(config);
      middleware(req as JWTRequest, res as Response, next);

      expect(req.jwt).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('limitations and claims enforcement', () => {
    it('should NOT verify token signature (dev-only verifier)', () => {
      const config: JWTMiddlewareConfig = {
        verification: {
          ignoreExpiration: true,
          secret: 'unused-secret',
          algorithms: ['HS256']
        }
      };

      // Well-formed token with arbitrary signature
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: 'user123' })).toString('base64url');
      const badSignature = 'this-is-not-a-real-signature';
      const token = `${header}.${payload}.${badSignature}`;

      req.headers = { authorization: `Bearer ${token}` };

      const middleware = createJWTMiddleware(config);
      middleware(req as JWTRequest, res as Response, next);

      // Should accept token without signature verification (development behavior)
      expect(req.jwt?.sub).toBe('user123');
      expect(next).toHaveBeenCalled();
      // Note: In production, proper signature verification should be implemented
    });

    it('should enforce allowed algorithms list', () => {
      const config: JWTMiddlewareConfig = {
        verification: {
          ignoreExpiration: true,
          algorithms: ['HS256']
        }
      };

      // Token declares RS256 but config only allows HS256
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: 'user123' })).toString('base64url');
      const signature = 'sig';
      const token = `${header}.${payload}.${signature}`;

      req.headers = { authorization: `Bearer ${token}` };

      const middleware = createJWTMiddleware(config);
      middleware(req as JWTRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject tokens with not-before (nbf) in the future', () => {
      const config: JWTMiddlewareConfig = {
        verification: {
          ignoreExpiration: true
        }
      };

      const future = Math.floor(Date.now() / 1000) + 3600; // 1h in future
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: 'user123', nbf: future })).toString('base64url');
      const signature = 'sig';
      const token = `${header}.${payload}.${signature}`;

      req.headers = { authorization: `Bearer ${token}` };

      const middleware = createJWTMiddleware(config);
      middleware(req as JWTRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
