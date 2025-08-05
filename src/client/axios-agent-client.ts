import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { AgentClient } from '../interface/agent-client.js';
import { JSONValue, JSONObject } from '../model/types.js';
import { MCPRequest, MCPResponse } from '../model/mcp.js';
import { JWTAuthProvider, JWTAuthConfig } from '../interface/jwt-auth.js';
import { createJWTAuthProvider } from '../auth/jwt-auth-provider.js';

/**
 * Middleware function type for request modification
 */
export type RequestMiddleware = (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>;

/**
 * Axios-based implementation of AgentClient for Cubicler MCP communication
 * Handles HTTP communication with Cubicler's MCP endpoint using JSON-RPC 2.0 protocol
 */
export class AxiosAgentClient implements AgentClient {
  private readonly httpClient: AxiosInstance;
  private requestId: number = 1;
  private jwtAuthProvider?: JWTAuthProvider;

  /**
   * Creates a new AxiosAgentClient instance
   * @param url - The base URL of the Cubicler instance
   * @param timeout - Request timeout in milliseconds (default: 30000)
   * @param jwtConfig - Optional JWT authentication configuration
   */
  constructor(
    private readonly url: string,
    private readonly timeout: number = 30000,
    jwtConfig?: JWTAuthConfig
  ) {
    this.httpClient = axios.create({
      baseURL: this.url,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Set up JWT authentication if provided
    if (jwtConfig) {
      this.jwtAuthProvider = createJWTAuthProvider(jwtConfig);
      this.setupJWTInterceptor();
    }
  }

  /**
   * Add middleware to modify requests (e.g., add headers, authentication)
   * @param middleware - The middleware function to apply
   * @returns this instance for method chaining
   */
  useMiddleware(middleware: RequestMiddleware): this {
    this.httpClient.interceptors.request.use(middleware);
    return this;
  }

  /**
   * Configure JWT authentication for this client
   * @param jwtConfig - JWT authentication configuration
   * @returns this instance for method chaining
   */
  useJWTAuth(jwtConfig: JWTAuthConfig): this {
    this.jwtAuthProvider = createJWTAuthProvider(jwtConfig);
    this.setupJWTInterceptor();
    return this;
  }

  /**
   * Set up JWT authentication interceptor
   * @private
   */
  private setupJWTInterceptor(): void {
    if (!this.jwtAuthProvider) return;

    this.httpClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
      try {
        const token = await this.jwtAuthProvider!.getToken();
        config.headers.Authorization = `Bearer ${token}`;
      } catch (error) {
        console.error('Failed to get JWT token:', error);
        throw new Error(`JWT authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      return config;
    });

    // Set up response interceptor to handle token refresh on 401 errors
    this.httpClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401 && !originalRequest._retry && this.jwtAuthProvider) {
          originalRequest._retry = true;
          
          try {
            await this.jwtAuthProvider.refreshToken();
            const token = await this.jwtAuthProvider.getToken();
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return this.httpClient(originalRequest);
          } catch (refreshError) {
            console.error('Failed to refresh JWT token:', refreshError);
            throw error;
          }
        }
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * Initialize the client connection to Cubicler
   * Makes an MCP initialize call to establish the connection
   * @throws Error if initialization fails
   */
  async initialize(): Promise<void> {
    const mcpRequest: MCPRequest = {
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
      id: this.requestId++,
    };

    try {
      const response = await this.httpClient.post<MCPResponse>('/mcp', mcpRequest);
      const mcpResponse = response.data;

      // Handle MCP error response
      if (mcpResponse.error) {
        throw new Error(`MCP initialize failed - Error ${mcpResponse.error.code}: ${mcpResponse.error.message}`);
      }

      // Initialization successful
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to initialize connection to Cubicler at ${this.url}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Execute a tool call through Cubicler's MCP endpoint
   * @param toolName - The name of the tool to call
   * @param parameters - The parameters to pass to the tool
   * @returns The result from the tool execution
   * @throws Error if the tool call fails or communication fails
   */
  async callTool(toolName: string, parameters: JSONObject): Promise<JSONValue> {
    const mcpRequest: MCPRequest = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: parameters,
      },
      id: this.requestId++,
    };

    try {
      const response = await this.httpClient.post<MCPResponse>('/mcp', mcpRequest);
      const mcpResponse = response.data;

      // Handle MCP error response
      if (mcpResponse.error) {
        throw new Error(`MCP Error ${mcpResponse.error.code}: ${mcpResponse.error.message}`);
      }

      // Handle MCP result - extract content from Cubicler's response format
      const result = mcpResponse.result;
      if (result && typeof result === 'object' && 'content' in result) {
        // Type the content structure properly
        const resultWithContent = result as { content: Array<{ type: string; text: string }> };
        const content = resultWithContent.content;
        if (Array.isArray(content) && content.length > 0 && content[0] && content[0].type === 'text') {
          // Try to parse the text content as JSON, fallback to raw text
          try {
            return JSON.parse(content[0].text) as JSONValue;
          } catch {
            return content[0].text;
          }
        }
      }

      // Return the raw result if it's not in the expected format
      return result ?? null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`HTTP request failed: ${error.message}`);
      }
      throw error;
    }
  }
}
