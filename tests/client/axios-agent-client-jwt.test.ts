import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { AxiosAgentClient } from '../../src/client/axios-agent-client.js';
import { StaticJWTAuth, OAuthJWTAuth } from '../../src/interface/jwt-auth.js';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('AxiosAgentClient with JWT Authentication', () => {
  let mockAxiosInstance: any;

  beforeEach(() => {
    mockAxiosInstance = {
      post: vi.fn(),
      interceptors: {
        request: {
          use: vi.fn()
        },
        response: {
          use: vi.fn()
        }
      }
    } as any;
    (mockedAxios.create as any).mockReturnValue(mockAxiosInstance);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Static JWT Authentication', () => {
    it('should create client with static JWT configuration', () => {
      const jwtConfig: StaticJWTAuth = {
        type: 'static',
        token: 'test-static-token'
      };

      const client = new AxiosAgentClient('http://localhost:3000', 30000, jwtConfig);

      // Verify axios instance was created
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:3000',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Verify JWT interceptor was set up
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });

    it('should add JWT configuration via useJWTAuth method', () => {
      const client = new AxiosAgentClient('http://localhost:3000');
      
      const jwtConfig: StaticJWTAuth = {
        type: 'static',
        token: 'test-static-token'
      };

      client.useJWTAuth(jwtConfig);

      // Verify interceptors were set up
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });

    it('should add Authorization header to requests', async () => {
      const jwtConfig: StaticJWTAuth = {
        type: 'static',
        token: 'test-static-token'
      };

      const client = new AxiosAgentClient('http://localhost:3000', 30000, jwtConfig);

      // Get the request interceptor function
      const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];
      
      const config = {
        headers: {}
      };

      const modifiedConfig = await requestInterceptor(config);
      expect(modifiedConfig.headers.Authorization).toBe('Bearer test-static-token');
    });
  });

  describe('OAuth JWT Authentication', () => {
    it('should create client with OAuth JWT configuration', () => {
      const jwtConfig: OAuthJWTAuth = {
        type: 'oauth',
        clientId: 'test-client',
        clientSecret: 'test-secret',
        tokenEndpoint: 'https://auth.example.com/token',
        scope: 'read write'
      };

      const client = new AxiosAgentClient('http://localhost:3000', 30000, jwtConfig);

      expect(mockedAxios.create).toHaveBeenCalledTimes(2); // One for client, one for OAuth provider
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });

    it('should handle token acquisition in request interceptor', async () => {
      // Mock OAuth token response
      const tokenResponse = {
        access_token: 'oauth-access-token',
        token_type: 'Bearer',
        expires_in: 3600
      };

      const mockOAuthInstance = {
        post: vi.fn().mockResolvedValue({ data: tokenResponse })
      } as any;

      (mockedAxios.create as any)
        .mockReturnValueOnce(mockAxiosInstance) // For the main client
        .mockReturnValueOnce(mockOAuthInstance); // For the OAuth provider

      const jwtConfig: OAuthJWTAuth = {
        type: 'oauth',
        clientId: 'test-client',
        clientSecret: 'test-secret',
        tokenEndpoint: 'https://auth.example.com/token'
      };

      const client = new AxiosAgentClient('http://localhost:3000', 30000, jwtConfig);

      // Get the request interceptor function
      const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];
      
      const config = {
        headers: {}
      };

      const modifiedConfig = await requestInterceptor(config);
      
      expect(mockOAuthInstance.post).toHaveBeenCalledWith(
        'https://auth.example.com/token',
        expect.any(URLSearchParams)
      );
      expect(modifiedConfig.headers.Authorization).toBe('Bearer oauth-access-token');
    });
  });

  describe('JWT Request Interceptor Error Handling', () => {
    it('should throw error when JWT token acquisition fails', async () => {
      const jwtConfig: StaticJWTAuth = {
        type: 'static',
        token: 'test-token'
      };

      const client = new AxiosAgentClient('http://localhost:3000', 30000, jwtConfig);

      // Mock the auth provider to throw an error
      const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];
      
      // Create a mock auth provider that throws
      const mockAuthProvider = {
        getToken: vi.fn().mockRejectedValue(new Error('Token acquisition failed'))
      };

      // Replace the auth provider internally (this is a bit hacky for testing)
      (client as any).jwtAuthProvider = mockAuthProvider;

      const config = { headers: {} };

      await expect(requestInterceptor(config)).rejects.toThrow('JWT authentication failed: Token acquisition failed');
    });
  });

  describe('JWT Response Interceptor for Token Refresh', () => {
    it('should refresh token on 401 error', async () => {
      const jwtConfig: StaticJWTAuth = {
        type: 'static',
        token: 'test-token'
      };

      const client = new AxiosAgentClient('http://localhost:3000', 30000, jwtConfig);

      // Get the response interceptor function
      const responseInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

      const error = {
        response: { status: 401 },
        config: { headers: {} as any }
      };

      // Mock the auth provider refresh method
      const mockAuthProvider = {
        refreshToken: vi.fn().mockResolvedValue(undefined),
        getToken: vi.fn().mockResolvedValue('refreshed-token')
      };

      // Replace the auth provider internally
      (client as any).jwtAuthProvider = mockAuthProvider;

      // Create a function that returns a resolved promise for the retry call
      const retryResult = { data: 'success' };
      const mockRetryCall = vi.fn().mockResolvedValue(retryResult);
      
      // Replace the httpClient reference to mock the retry
      (client as any).httpClient = mockRetryCall;

      const result = await responseInterceptor(error);

      expect(mockAuthProvider.refreshToken).toHaveBeenCalled();
      expect(mockAuthProvider.getToken).toHaveBeenCalled();
      expect(error.config.headers.Authorization).toBe('Bearer refreshed-token');
      expect(mockRetryCall).toHaveBeenCalledWith(error.config);
      expect(result).toEqual(retryResult);
    });

    it('should not retry non-401 errors', async () => {
      const jwtConfig: StaticJWTAuth = {
        type: 'static',
        token: 'test-token'
      };

      const client = new AxiosAgentClient('http://localhost:3000', 30000, jwtConfig);

      const responseInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

      const error = {
        response: { status: 500 },
        config: { headers: {} as any }
      };

      await expect(responseInterceptor(error)).rejects.toBe(error);
    });

    it('should not retry already retried requests', async () => {
      const jwtConfig: StaticJWTAuth = {
        type: 'static',
        token: 'test-token'
      };

      const client = new AxiosAgentClient('http://localhost:3000', 30000, jwtConfig);

      const responseInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

      const error = {
        response: { status: 401 },
        config: { headers: {} as any, _retry: true }
      };

      await expect(responseInterceptor(error)).rejects.toBe(error);
    });
  });
});