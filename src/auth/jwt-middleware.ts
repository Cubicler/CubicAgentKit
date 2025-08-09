import { Request, Response, NextFunction } from 'express';
import { JWTMiddlewareConfig, JWTVerificationOptions } from '../interface/jwt-auth.js';
import { createHttpLogger } from '../utils/logger.js';
import type { Logger } from 'pino';

/**
 * JWT Header interface
 */
interface JWTHeader {
  alg: string;
  typ?: string;
  [key: string]: unknown;
}

/**
 * Decoded JWT payload interface
 */
export interface JWTPayload {
  sub?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  nbf?: number;
  jti?: string;
  [key: string]: unknown;
}

/**
 * Extended Express Request with JWT payload
 */
export interface JWTRequest extends Request {
  jwt?: JWTPayload;
  user?: unknown;
}

/**
 * Simple JWT verification implementation
 * Note: This is a basic implementation. For production use, consider using
 * a library like 'jsonwebtoken' for more robust JWT handling.
 */
class SimpleJWTVerifier {
  private readonly logger: Logger;
  
  constructor(private readonly options: JWTVerificationOptions) {
    this.logger = createHttpLogger('SimpleJWTVerifier');
  }

  verify(token: string): JWTPayload {
    try {
      // Split the JWT into its parts
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      // Decode the header and payload
      const headerPart = parts[0];
      const payloadPart = parts[1];
      
      if (!headerPart || !payloadPart) {
        throw new Error('Invalid JWT structure');
      }

      const header = JSON.parse(this.base64UrlDecode(headerPart)) as JWTHeader;
      const payload = JSON.parse(this.base64UrlDecode(payloadPart)) as JWTPayload;

      // Basic algorithm check
      if (this.options.algorithms && !this.options.algorithms.includes(header.alg)) {
        throw new Error(`Unsupported algorithm: ${header.alg}`);
      }

      // Check expiration
      if (!this.options.ignoreExpiration && typeof payload.exp === 'number') {
        const now = Math.floor(Date.now() / 1000);
        if (now >= payload.exp) {
          throw new Error('JWT token has expired');
        }
      }

      // Check not before
      if (typeof payload.nbf === 'number') {
        const now = Math.floor(Date.now() / 1000);
        if (now < payload.nbf) {
          throw new Error('JWT token not active yet');
        }
      }

      // Check issuer
      if (this.options.issuer && payload.iss !== this.options.issuer) {
        throw new Error(`Invalid issuer: ${payload.iss}`);
      }

      // Check audience
      if (this.options.audience) {
        const audiences = Array.isArray(payload.aud) ? payload.aud : (payload.aud ? [payload.aud] : []);
        if (!audiences.includes(this.options.audience)) {
          const audValue = Array.isArray(payload.aud) ? payload.aud.join(', ') : (payload.aud ?? 'undefined');
          throw new Error(`Invalid audience: ${audValue}`);
        }
      }

      // Note: Signature verification is not implemented in this simple version
      // For production use, implement proper signature verification based on the algorithm
      if (this.options.secret || this.options.publicKey) {
        // TODO: Implement signature verification
        this.logger.warn('JWT signature verification not implemented in SimpleJWTVerifier');
      }

      return payload;
    } catch (error) {
      throw new Error(`JWT verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private base64UrlDecode(str: string): string {
    // Convert base64url to base64
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    
    // Add padding if needed
    while (str.length % 4) {
      str += '=';
    }
    
    // Decode base64
    return Buffer.from(str, 'base64').toString('utf8');
  }
}

/**
 * Default token extraction function - looks for Bearer token in Authorization header
 */
function defaultExtractToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return undefined;
}

/**
 * Default authentication failure handler
 */
function defaultAuthFailureHandler(error: Error, req: Request, res: Response, _next: NextFunction): void {
  const logger = createHttpLogger('JWTMiddleware');
  logger.error('JWT Authentication failed: %s', error.message);
  res.status(401).json({
    error: 'Unauthorized',
    message: 'Invalid or missing JWT token'
  });
}

/**
 * Creates JWT authentication middleware for Express
 * @param config - JWT middleware configuration
 * @returns Express middleware function
 */
export function createJWTMiddleware(config: JWTMiddlewareConfig) {
  const verifier = new SimpleJWTVerifier(config.verification);
  const extractToken = config.extractToken || defaultExtractToken;
  const onAuthFailure = config.onAuthFailure || defaultAuthFailureHandler;

  return (req: JWTRequest, res: Response, next: NextFunction): void => {
    try {
      // Extract token from request
      const token = extractToken(req);
      
      if (!token) {
        throw new Error('No JWT token provided');
      }

      // Verify token
      const payload = verifier.verify(token);
      
      // Attach payload to request
      req.jwt = payload;
      req.user = payload; // For convenience, also set as user
      
      next();
    } catch (error) {
      onAuthFailure(error as Error, req, res, next);
    }
  };
}

/**
 * Creates optional JWT middleware that doesn't fail if no token is provided
 * Useful for endpoints that can work with or without authentication
 */
export function createOptionalJWTMiddleware(config: JWTMiddlewareConfig) {
  const verifier = new SimpleJWTVerifier(config.verification);
  const extractToken = config.extractToken || defaultExtractToken;
  const logger = createHttpLogger('OptionalJWTMiddleware');

  return (req: JWTRequest, res: Response, next: NextFunction): void => {
    try {
      const token = extractToken(req);
      
      if (token) {
        // Only verify if token is present
        const payload = verifier.verify(token);
        req.jwt = payload;
        req.user = payload;
      }
      
      next();
    } catch (error) {
      // For optional middleware, we continue even if verification fails
      logger.warn('Optional JWT verification failed: %s', (error as Error).message);
      next();
    }
  };
}