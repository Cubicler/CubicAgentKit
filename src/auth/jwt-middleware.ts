import { Request, Response, NextFunction } from 'express';
import { JWTMiddlewareConfig, JWTVerificationOptions } from '../interface/jwt-auth.js';

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
  [key: string]: any;
}

/**
 * Extended Express Request with JWT payload
 */
export interface JWTRequest extends Request {
  jwt?: JWTPayload;
  user?: any;
}

/**
 * Simple JWT verification implementation
 * Note: This is a basic implementation. For production use, consider using
 * a library like 'jsonwebtoken' for more robust JWT handling.
 */
class SimpleJWTVerifier {
  constructor(private options: JWTVerificationOptions) {}

  verify(token: string): JWTPayload {
    try {
      // Split the JWT into its parts
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      // Decode the header and payload
      const header = JSON.parse(this.base64UrlDecode(parts[0]!));
      const payload = JSON.parse(this.base64UrlDecode(parts[1]!));

      // Basic algorithm check
      if (this.options.algorithms && !this.options.algorithms.includes(header.alg)) {
        throw new Error(`Unsupported algorithm: ${header.alg}`);
      }

      // Check expiration
      if (!this.options.ignoreExpiration && payload.exp) {
        const now = Math.floor(Date.now() / 1000);
        if (now >= payload.exp) {
          throw new Error('JWT token has expired');
        }
      }

      // Check not before
      if (payload.nbf) {
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
          throw new Error(`Invalid audience: ${payload.aud}`);
        }
      }

      // Note: Signature verification is not implemented in this simple version
      // For production use, implement proper signature verification based on the algorithm
      if (this.options.secret || this.options.publicKey) {
        // TODO: Implement signature verification
        console.warn('JWT signature verification not implemented in SimpleJWTVerifier');
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
function defaultAuthFailureHandler(error: Error, req: Request, res: Response, next: NextFunction): void {
  console.error('JWT Authentication failed:', error.message);
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
      console.warn('Optional JWT verification failed:', (error as Error).message);
      next();
    }
  };
}