import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { 
  StaticJWTAuthProvider, 
  OAuthJWTAuthProvider,
  createJWTAuthProvider 
} from '../../src/auth/jwt-auth-provider.js';
import { StaticJWTAuth, OAuthJWTAuth } from '../../src/interface/jwt-auth.js';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('StaticJWTAuthProvider', () => {
  const config: StaticJWTAuth = {
    type: 'static',
    token: 'test-static-token'
  };

  let provider: StaticJWTAuthProvider;

  beforeEach(() => {
    provider = new StaticJWTAuthProvider(config);
  });

  it('should return the configured token', async () => {
    const token = await provider.getToken();
    expect(token).toBe('test-static-token');
  });

  it('should always return true for isTokenValid', () => {
    expect(provider.isTokenValid()).toBe(true);
  });

  it('should throw error when trying to refresh static token', async () => {
    await expect(provider.refreshToken()).rejects.toThrow('Static JWT tokens cannot be refreshed');
  });
});

describe('OAuthJWTAuthProvider', () => {
  const config: OAuthJWTAuth = {
    type: 'oauth',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    tokenEndpoint: 'https://example.com/token',
    scope: 'read write'
  };

  let provider: OAuthJWTAuthProvider;
  let mockAxiosInstance: any;

  beforeEach(() => {
    mockAxiosInstance = {
      post: vi.fn()
    };
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    
    provider = new OAuthJWTAuthProvider(config);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getToken', () => {
    it('should acquire new token when none exists', async () => {
      const tokenResponse = {
        access_token: 'new-access-token',
        token_type: 'Bearer',
        expires_in: 3600
      };

      mockAxiosInstance.post.mockResolvedValue({ data: tokenResponse });

      const token = await provider.getToken();

      expect(token).toBe('new-access-token');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'https://example.com/token',
        expect.any(URLSearchParams)
      );
    });

    it('should return existing valid token', async () => {
      // First call to get a token
      const tokenResponse = {
        access_token: 'existing-token',
        token_type: 'Bearer',
        expires_in: 3600
      };

      mockAxiosInstance.post.mockResolvedValue({ data: tokenResponse });
      
      const firstToken = await provider.getToken();
      expect(firstToken).toBe('existing-token');
      
      // Second call should return the same token without API call
      const secondToken = await provider.getToken();
      expect(secondToken).toBe('existing-token');
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it('should handle token acquisition failure', async () => {
      const error = new Error('Network error');
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(provider.getToken()).rejects.toThrow('Network error');
    });
  });

  describe('isTokenValid', () => {
    it('should return false when no token exists', () => {
      expect(provider.isTokenValid()).toBe(false);
    });

    it('should return true for valid token without expiration', async () => {
      const tokenResponse = {
        access_token: 'valid-token',
        token_type: 'Bearer'
      };

      mockAxiosInstance.post.mockResolvedValue({ data: tokenResponse });
      await provider.getToken();

      expect(provider.isTokenValid()).toBe(true);
    });

    it('should return true for non-expired token', async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const tokenResponse = {
        access_token: 'valid-token',
        token_type: 'Bearer',
        expires_in: 3600
      };

      mockAxiosInstance.post.mockResolvedValue({ data: tokenResponse });
      await provider.getToken();

      expect(provider.isTokenValid()).toBe(true);
    });

    it('should return false for expired token', async () => {
      const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const tokenResponse = {
        access_token: 'expired-token',
        token_type: 'Bearer',
        expires_in: -3600 // Expired
      };

      mockAxiosInstance.post.mockResolvedValue({ data: tokenResponse });
      await provider.getToken();

      expect(provider.isTokenValid()).toBe(false);
    });
  });

  describe('refreshToken', () => {
    it('should refresh token using refresh token', async () => {
      const configWithRefresh: OAuthJWTAuth = {
        ...config,
        refreshToken: 'refresh-token'
      };

      const providerWithRefresh = new OAuthJWTAuthProvider(configWithRefresh);
      
      const refreshResponse = {
        access_token: 'refreshed-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'new-refresh-token'
      };

      mockAxiosInstance.post.mockResolvedValue({ data: refreshResponse });

      await providerWithRefresh.refreshToken();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'https://example.com/token',
        expect.any(URLSearchParams)
      );
    });

    it('should fall back to client credentials when no refresh token', async () => {
      const clientCredentialsResponse = {
        access_token: 'new-cc-token',
        token_type: 'Bearer',
        expires_in: 3600
      };

      mockAxiosInstance.post.mockResolvedValue({ data: clientCredentialsResponse });

      await provider.refreshToken();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'https://example.com/token',
        expect.any(URLSearchParams)
      );
    });
  });
});

describe('createJWTAuthProvider', () => {
  it('should create StaticJWTAuthProvider for static type', () => {
    const config: StaticJWTAuth = {
      type: 'static',
      token: 'test-token'
    };

    const provider = createJWTAuthProvider(config);
    expect(provider).toBeInstanceOf(StaticJWTAuthProvider);
  });

  it('should create OAuthJWTAuthProvider for oauth type', () => {
    const config: OAuthJWTAuth = {
      type: 'oauth',
      clientId: 'test-client',
      clientSecret: 'test-secret',
      tokenEndpoint: 'https://example.com/token'
    };

    const provider = createJWTAuthProvider(config);
    expect(provider).toBeInstanceOf(OAuthJWTAuthProvider);
  });

  it('should throw error for unsupported type', () => {
    const config = {
      type: 'unsupported'
    } as any;

    expect(() => createJWTAuthProvider(config)).toThrow('Unsupported JWT auth type');
  });
});