import axios, { AxiosInstance } from 'axios';
import { 
  JWTAuthProvider, 
  JWTAuthConfig, 
  StaticJWTAuth, 
  OAuthJWTAuth, 
  OAuthTokenResponse 
} from '../interface/jwt-auth.js';

/**
 * Static JWT authentication provider - uses a pre-configured token
 */
export class StaticJWTAuthProvider implements JWTAuthProvider {
  constructor(private readonly config: StaticJWTAuth) {}

  async getToken(): Promise<string> {
    return this.config.token;
  }

  isTokenValid(): boolean {
    // For static tokens, we assume they're always valid
    // In a real implementation, you might want to decode and check expiration
    return true;
  }

  async refreshToken(): Promise<void> {
    // Static tokens cannot be refreshed
    throw new Error('Static JWT tokens cannot be refreshed');
  }
}

/**
 * OAuth JWT authentication provider - handles token acquisition and refresh
 */
export class OAuthJWTAuthProvider implements JWTAuthProvider {
  private readonly httpClient: AxiosInstance;
  private tokenData: OAuthJWTAuth;

  constructor(config: OAuthJWTAuth) {
    this.tokenData = { ...config };
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }

  async getToken(): Promise<string> {
    // If we have a valid token, return it
    if (this.tokenData.accessToken && this.isTokenValid()) {
      return this.tokenData.accessToken;
    }

    // Otherwise, acquire a new token
    await this.acquireToken();
    
    if (!this.tokenData.accessToken) {
      throw new Error('Failed to acquire OAuth access token');
    }

    return this.tokenData.accessToken;
  }

  isTokenValid(): boolean {
    if (!this.tokenData.accessToken) {
      return false;
    }

    if (!this.tokenData.expiresAt) {
      // If no expiration time, assume token is valid
      return true;
    }

    // Check if token expires within the next 60 seconds (buffer for network latency)
    const bufferTime = 60 * 1000; // 60 seconds in milliseconds
    return Date.now() < (this.tokenData.expiresAt - bufferTime);
  }

  async refreshToken(): Promise<void> {
    if (this.tokenData.refreshToken) {
      await this.acquireTokenWithRefresh();
    } else {
      // Fall back to client credentials flow
      await this.acquireToken();
    }
  }

  private async acquireToken(): Promise<void> {
    const grantType = this.tokenData.grantType || 'client_credentials';
    
    const params = new URLSearchParams();
    params.append('grant_type', grantType);
    params.append('client_id', this.tokenData.clientId);
    params.append('client_secret', this.tokenData.clientSecret);
    
    if (this.tokenData.scope) {
      params.append('scope', this.tokenData.scope);
    }

    try {
      const response = await this.httpClient.post<OAuthTokenResponse>(
        this.tokenData.tokenEndpoint,
        params
      );

      const tokenResponse = response.data;
      this.updateTokenData(tokenResponse);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`OAuth token acquisition failed: ${error.response?.data?.error_description || error.message}`);
      }
      throw error;
    }
  }

  private async acquireTokenWithRefresh(): Promise<void> {
    if (!this.tokenData.refreshToken) {
      throw new Error('No refresh token available');
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', this.tokenData.refreshToken);
    params.append('client_id', this.tokenData.clientId);
    params.append('client_secret', this.tokenData.clientSecret);

    try {
      const response = await this.httpClient.post<OAuthTokenResponse>(
        this.tokenData.tokenEndpoint,
        params
      );

      const tokenResponse = response.data;
      this.updateTokenData(tokenResponse);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // If refresh fails, try to acquire a new token
        await this.acquireToken();
      } else {
        throw error;
      }
    }
  }

  private updateTokenData(tokenResponse: OAuthTokenResponse): void {
    this.tokenData.accessToken = tokenResponse.access_token;
    
    if (tokenResponse.refresh_token) {
      this.tokenData.refreshToken = tokenResponse.refresh_token;
    }

    if (tokenResponse.expires_in) {
      this.tokenData.expiresAt = Date.now() + (tokenResponse.expires_in * 1000);
    }
  }
}

/**
 * Factory function to create appropriate JWT auth provider based on configuration
 */
export function createJWTAuthProvider(config: JWTAuthConfig): JWTAuthProvider {
  switch (config.type) {
    case 'static':
      return new StaticJWTAuthProvider(config);
    case 'oauth':
      return new OAuthJWTAuthProvider(config);
    default:
      throw new Error(`Unsupported JWT auth type: ${(config as any).type}`);
  }
}