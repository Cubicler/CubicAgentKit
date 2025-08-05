/**
 * JWT authentication configuration and interfaces
 */

/**
 * Static JWT authentication configuration
 */
export interface StaticJWTAuth {
  type: 'static';
  token: string;
}

/**
 * OAuth JWT authentication configuration
 */
export interface OAuthJWTAuth {
  type: 'oauth';
  clientId: string;
  clientSecret: string;
  tokenEndpoint: string;
  scope?: string;
  grantType?: 'client_credentials' | 'authorization_code';
  refreshToken?: string;
  accessToken?: string;
  expiresAt?: number;
}

/**
 * JWT authentication configuration union type
 */
export type JWTAuthConfig = StaticJWTAuth | OAuthJWTAuth;

/**
 * OAuth token response structure
 */
export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

/**
 * JWT authentication provider interface
 */
export interface JWTAuthProvider {
  /**
   * Get a valid JWT token
   * @returns Promise resolving to a valid JWT token
   */
  getToken(): Promise<string>;

  /**
   * Check if the current token is valid/not expired
   * @returns true if token is valid, false otherwise
   */
  isTokenValid(): boolean;

  /**
   * Refresh the token if supported (OAuth only)
   * @returns Promise resolving when token is refreshed
   */
  refreshToken(): Promise<void>;
}

/**
 * JWT verification options for server-side validation
 */
export interface JWTVerificationOptions {
  secret?: string;
  publicKey?: string;
  algorithms?: string[];
  issuer?: string;
  audience?: string;
  ignoreExpiration?: boolean;
}

/**
 * JWT middleware configuration for Express server
 */
export interface JWTMiddlewareConfig {
  verification: JWTVerificationOptions;
  extractToken?: (req: any) => string | undefined;
  onAuthFailure?: (error: Error, req: any, res: any, next: any) => void;
}