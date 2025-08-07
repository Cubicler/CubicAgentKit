import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios, { InternalAxiosRequestConfig } from 'axios';
import { HttpAgentClient } from '../../src/client/http-agent-client.js';
import { MCPResponse } from '../../src/model/mcp.js';

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(),
    isAxiosError: vi.fn()
  }
}));

const mockedAxios = vi.mocked(axios);

describe('HttpAgentClient', () => {
  let client: HttpAgentClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Mock axios.create to return our mock instance
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
    };
    
    // Mock the axios methods
    (mockedAxios.create as any).mockReturnValue(mockAxiosInstance);
    (mockedAxios.isAxiosError as any).mockReturnValue(false);

    client = new HttpAgentClient('http://localhost:3000');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with default timeout', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:3000',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should create client with custom timeout', () => {
      const customClient = new HttpAgentClient('http://localhost:3000', 60000);
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:3000',
        timeout: 60000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should setup JWT auth if config provided', () => {
      const jwtConfig = {
        type: 'static' as const,
        token: 'test-token'
      };
      
      const jwtClient = new HttpAgentClient('http://localhost:3000', 30000, jwtConfig);
      
      // Should have set up JWT interceptor
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
    });
  });

  describe('useMiddleware', () => {
    it('should add middleware to request interceptor', () => {
      const middleware = (config: InternalAxiosRequestConfig) => {
        config.headers['X-Custom'] = 'test';
        return config;
      };

      const result = client.useMiddleware(middleware);
      
      expect(result).toBe(client); // Should return this for chaining
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledWith(middleware);
    });
  });

  describe('useJWTAuth', () => {
    it('should configure JWT authentication', () => {
      const jwtConfig = {
        type: 'static' as const,
        token: 'test-token'
      };

      const result = client.useJWTAuth(jwtConfig);
      
      expect(result).toBe(client); // Should return this for chaining
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
    });
  });

  describe('initialize', () => {
    it('should send MCP initialize request successfully', async () => {
      const mockResponse = {
        data: {
          jsonrpc: '2.0',
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            serverInfo: {
              name: 'Cubicler',
              version: '1.0.0'
            }
          },
          id: 1
        } as MCPResponse
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await expect(client.initialize()).resolves.not.toThrow();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/mcp', {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'CubicAgentKit',
            version: '2.1.0'
          }
        },
        id: 1,
      });
    });

    it('should handle MCP error response', async () => {
      const mockResponse = {
        data: {
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: 'Method not found'
          },
          id: 1
        } as MCPResponse
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await expect(client.initialize()).rejects.toThrow('MCP initialize failed - Error -32601: Method not found');
    });

    it('should handle HTTP request errors', async () => {
      const axiosError = new Error('Network Error');
      mockAxiosInstance.post.mockRejectedValue(axiosError);
      (mockedAxios.isAxiosError as any).mockReturnValue(true);

      await expect(client.initialize()).rejects.toThrow('Failed to initialize connection to Cubicler at http://localhost:3000: Network Error');
    });

    it('should re-throw non-axios errors', async () => {
      const customError = new Error('Custom error');
      mockAxiosInstance.post.mockRejectedValue(customError);
      (mockedAxios.isAxiosError as any).mockReturnValue(false);

      await expect(client.initialize()).rejects.toThrow('Custom error');
    });
  });

  describe('callTool', () => {
    it('should execute tool call successfully', async () => {
      const mockResponse = {
        data: {
          jsonrpc: '2.0',
          result: {
            content: [
              {
                type: 'text',
                text: '{"status": "success", "data": "test result"}'
              }
            ]
          },
          id: 1
        } as MCPResponse
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await client.callTool('testTool', { param1: 'value1' });

      expect(result).toEqual({ status: 'success', data: 'test result' });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/mcp', {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'testTool',
          arguments: { param1: 'value1' },
        },
        id: 1,
      });
    });

    it('should return raw text when JSON parsing fails', async () => {
      const mockResponse = {
        data: {
          jsonrpc: '2.0',
          result: {
            content: [
              {
                type: 'text',
                text: 'Plain text response'
              }
            ]
          },
          id: 1
        } as MCPResponse
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await client.callTool('testTool', {});
      expect(result).toBe('Plain text response');
    });

    it('should return raw result when content format is unexpected', async () => {
      const mockResponse = {
        data: {
          jsonrpc: '2.0',
          result: {
            rawData: 'some data'
          },
          id: 1
        } as MCPResponse
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await client.callTool('testTool', {});
      expect(result).toEqual({ rawData: 'some data' });
    });

    it('should return null when result is null/undefined', async () => {
      const mockResponse = {
        data: {
          jsonrpc: '2.0',
          result: null,
          id: 1
        } as MCPResponse
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await client.callTool('testTool', {});
      expect(result).toBeNull();
    });

    it('should handle MCP error response', async () => {
      const mockResponse = {
        data: {
          jsonrpc: '2.0',
          error: {
            code: -32602,
            message: 'Invalid params'
          },
          id: 1
        } as MCPResponse
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await expect(client.callTool('testTool', {})).rejects.toThrow('MCP Error -32602: Invalid params');
    });

    it('should handle HTTP request errors', async () => {
      const axiosError = new Error('Request timeout');
      mockAxiosInstance.post.mockRejectedValue(axiosError);
      (mockedAxios.isAxiosError as any).mockReturnValue(true);

      await expect(client.callTool('testTool', {})).rejects.toThrow('HTTP request failed: Request timeout');
    });

    it('should re-throw non-axios errors', async () => {
      const customError = new Error('Custom error');
      mockAxiosInstance.post.mockRejectedValue(customError);
      (mockedAxios.isAxiosError as any).mockReturnValue(false);

      await expect(client.callTool('testTool', {})).rejects.toThrow('Custom error');
    });

    it('should handle empty content array', async () => {
      const mockResponse = {
        data: {
          jsonrpc: '2.0',
          result: {
            content: []
          },
          id: 1
        } as MCPResponse
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await client.callTool('testTool', {});
      expect(result).toEqual({ content: [] });
    });

    it('should handle content with non-text type', async () => {
      const mockResponse = {
        data: {
          jsonrpc: '2.0',
          result: {
            content: [
              {
                type: 'image',
                data: 'base64-encoded-image'
              }
            ]
          },
          id: 1
        } as MCPResponse
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await client.callTool('testTool', {});
      expect(result).toEqual({
        content: [{
          type: 'image',
          data: 'base64-encoded-image'
        }]
      });
    });
  });

  describe('request ID management', () => {
    it('should increment request ID for each request', async () => {
      const mockResponse = {
        data: {
          jsonrpc: '2.0',
          result: { success: true },
          id: 1
        } as MCPResponse
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      // First call should use ID 1
      await client.initialize();
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/mcp', expect.objectContaining({ id: 1 }));

      // Second call should use ID 2
      await client.callTool('testTool', {});
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/mcp', expect.objectContaining({ id: 2 }));
    });
  });

  describe('complex scenarios', () => {
    it('should handle complex tool parameters', async () => {
      const complexParams = {
        stringParam: 'test',
        numberParam: 42,
        booleanParam: true,
        arrayParam: [1, 2, 3],
        objectParam: {
          nested: {
            value: 'deep'
          }
        },
        nullParam: null
      };

      const mockResponse = {
        data: {
          jsonrpc: '2.0',
          result: {
            content: [{
              type: 'text',
              text: '{"processed": true}'
            }]
          },
          id: 1
        } as MCPResponse
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await client.callTool('complexTool', complexParams);

      expect(result).toEqual({ processed: true });
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/mcp', expect.objectContaining({
        params: {
          name: 'complexTool',
          arguments: complexParams
        }
      }));
    });
  });
});
