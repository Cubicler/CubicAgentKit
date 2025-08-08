/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import axios, { AxiosInstance } from 'axios';
type SSEMessageEvent = { data: string };

import { AgentServer, RequestHandler } from '../interface/agent-server.js';
import { AgentRequest } from '../model/agent-request.js';
import { AgentResponse } from '../model/agent-response.js';
import { JWTAuthConfig, JWTAuthProvider } from '../interface/jwt-auth.js';
import { createJWTAuthProvider } from '../auth/jwt-auth-provider.js';

/**
 * SSE-specific message format that includes the request ID
 */
interface SSEMessage extends AgentRequest {
  id: string; // The request ID for SSE messages
}

/**
 * Server-Sent Events (SSE) implementation of AgentServer
 * Connects to Cubicler's SSE endpoint to receive agent requests and sends responses back via HTTP POST
 */
export class SSEAgentServer implements AgentServer {
  private eventSource?: any;
  private readonly httpClient: AxiosInstance;
  private handler?: RequestHandler;
  private isRunning = false;
  private jwtAuthProvider?: JWTAuthProvider;

  /**
   * Creates a new SSEAgentServer instance
   * @param cubiclerUrl - The base URL of the Cubicler instance
   * @param agentId - The unique identifier for this agent
   * @param timeout - Request timeout in milliseconds for HTTP responses (default: 30000)
   * @param jwtConfig - Optional JWT authentication configuration
   */
  constructor(
    private readonly cubiclerUrl: string,
    private readonly agentId: string,
    private readonly timeout: number = 30000,
    jwtConfig?: JWTAuthConfig
  ) {
    this.httpClient = axios.create({
      baseURL: this.cubiclerUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Set up JWT authentication if provided
    if (jwtConfig) {
      this.jwtAuthProvider = createJWTAuthProvider(jwtConfig);
    }
  }

  /**
   * Configure JWT authentication for this server
   * @param jwtConfig - JWT authentication configuration
   * @returns this instance for method chaining
   */
  useJWTAuth(jwtConfig: JWTAuthConfig): this {
    this.jwtAuthProvider = createJWTAuthProvider(jwtConfig);
    return this;
  }

  /**
   * Start the SSE connection and register the request handler
   * @param handler - The function to handle incoming agent requests
   * @throws Error if SSE connection setup fails
   */
  async start(handler: RequestHandler): Promise<void> {
    if (this.isRunning) {
      throw new Error('SSE server is already running');
    }

    this.handler = handler;
    this.isRunning = true;

    const sseUrl = `${this.cubiclerUrl}/sse/${this.agentId}`;
    
    // Prepare EventSource options with JWT auth if available
    const prepareEventSourceOptions = async (): Promise<any> => {
      const eventSourceOptions: any = {};
      if (this.jwtAuthProvider) {
        try {
          const token = await this.jwtAuthProvider.getToken();
          eventSourceOptions.headers = {
            'Authorization': `Bearer ${token}`
          };
        } catch (error) {
          console.error('Failed to get JWT token for SSE connection:', error);
          // Continue without auth - let the server handle the auth failure
        }
      }
      return eventSourceOptions;
    };
    
    const eventSourceOptions = await prepareEventSourceOptions();
    
    return new Promise<void>((resolve, reject) => {
      let resolved = false;

      void (async () => {
        try {
          const mod = await import('eventsource');
          const EventSourceCtor: any = (mod as any).EventSource || (mod as any).default || mod;
          this.eventSource = new EventSourceCtor(sseUrl, eventSourceOptions);

          this.eventSource!.onopen = () => {
            if (!resolved) {
              resolved = true;
              console.log(`✅ SSE connection established to ${sseUrl}`);
              resolve();
            }
          };

          this.eventSource!.onmessage = (event: SSEMessageEvent) => {
            void this.handleSSEMessage(event);
          };

          this.eventSource!.onerror = (error: any) => {
            console.error('SSE connection error:', error);
            if (!this.isRunning) {
              // If we're stopping, don't treat this as an error
              return;
            }

            if (!resolved) {
              resolved = true;
              this.isRunning = false;
              reject(new Error(`SSE connection failed: ${error?.message || 'Connection error'}`));
              return;
            }

            if (this.eventSource?.readyState === 2) {
              // EventSource.CLOSED - Connection was closed, try to reconnect after a delay
              setTimeout(() => {
                if (this.isRunning && this.handler) {
                  console.log('Attempting to reconnect to SSE...');
                  void this.start(this.handler);
                }
              }, 5000);
            }
          };

          // Set a timeout for the initial connection
          setTimeout(() => {
            if (!resolved && this.eventSource?.readyState !== 1) {
              // EventSource.OPEN
              resolved = true;
              this.eventSource?.close();
              this.isRunning = false;
              reject(new Error(`Failed to establish SSE connection to ${sseUrl} within timeout`));
            }
          }, this.timeout);
        } catch (error) {
          if (!resolved) {
            resolved = true;
            this.isRunning = false;
            reject(new Error(`Failed to start SSE server: ${error instanceof Error ? error.message : 'Unknown error'}`));
          }
        }
      })();
    });
  }

  /**
   * Handle incoming SSE messages
   * @private
   */
  private async handleSSEMessage(event: SSEMessageEvent): Promise<void> {
    if (!this.handler) {
      console.error('No handler available to process SSE message');
      return;
    }

    try {
      // Parse the incoming message as an SSEMessage
      const data: unknown = JSON.parse(event.data);
      
      // Validate the request structure
      if (!this.isValidSSEMessage(data)) {
        console.error('Invalid SSE message received:', data);
        return;
      }

      const sseMessage = data;
      
      // Extract the AgentRequest from the SSE message (remove the id field)
      const { id, ...agentRequest } = sseMessage;
      
      // Process the request using the provided handler
      const agentResponse = await this.handler(agentRequest);
      
      // Send the response back to Cubicler
      await this.sendResponse(agentResponse, id);
      
    } catch (error) {
      console.error('Error processing SSE message:', error);
      
      // Send an error response back to Cubicler if we have a request ID
      try {
        // Try to extract the ID from the parsed data if possible
        let requestId = 'unknown';
        try {
          const data: unknown = JSON.parse(event.data);
          if (data && typeof data === 'object' && 'id' in data && typeof data.id === 'string') {
            requestId = data.id;
          }
        } catch {
          // If we can't parse the data, use 'unknown'
        }
        
        const errorResponse: AgentResponse = {
          timestamp: new Date().toISOString(),
          type: 'text',
          content: `Error processing request: ${error instanceof Error ? error.message : 'Unknown error'}`,
          metadata: {
            usedTools: 0,
            usedToken: 0,
          }
        };
        await this.sendResponse(errorResponse, requestId);
      } catch (responseError) {
        console.error('Failed to send error response:', responseError);
      }
    }
  }

  /**
   * Validate that the incoming data is a valid SSE message
   * @private
   */
  private isValidSSEMessage(data: unknown): data is SSEMessage {
    if (!data || typeof data !== 'object') {
      return false;
    }
    
    const obj = data as Record<string, unknown>;
    
    const hasMessages = Array.isArray(obj.messages);
    const hasTrigger = obj.trigger && typeof obj.trigger === 'object' && !Array.isArray(obj.trigger);

    // Require exactly one of messages or trigger
    const hasExactlyOne = (hasMessages ? 1 : 0) + (hasTrigger ? 1 : 0) === 1;

    return Boolean(
      obj.id && typeof obj.id === 'string' &&
      obj.agent && typeof obj.agent === 'object' &&
      obj.tools && Array.isArray(obj.tools) &&
      obj.servers && Array.isArray(obj.servers) &&
      hasExactlyOne
    );
  }

  /**
   * Send the agent response back to Cubicler
   * @private
   */
  private async sendResponse(response: AgentResponse, requestId: string): Promise<void> {
    // Post back to the same SSE endpoint path (resource-based):
    // GET subscribes to `/sse/:agentId`, POST sends the response to `/sse/:agentId`
    const responseUrl = `/sse/${this.agentId}`;
    
    // Format the response according to SSE spec: { requestId: string, response: {...} }
    const sseResponse = {
      requestId: requestId,
      response: response
    };
    
    // Add JWT authentication headers if available
    const headers: Record<string, string> = {};
    if (this.jwtAuthProvider) {
      try {
        const token = await this.jwtAuthProvider.getToken();
        headers['Authorization'] = `Bearer ${token}`;
      } catch (error) {
        console.error('Failed to get JWT token for response:', error);
        // Continue without auth - let the server handle the auth failure
      }
    }
    
    try {
      await this.httpClient.post(responseUrl, sseResponse, { headers });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to send response to ${responseUrl}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Stop the SSE connection
   * @throws Error if shutdown fails
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.isRunning) {
        resolve(); // Server is not running
        return;
      }

      this.isRunning = false;
      
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = undefined;
        console.log('✅ SSE connection closed');
      }
      
      this.handler = undefined;
      resolve();
    });
  }
}
